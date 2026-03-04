import { db } from '@/lib/firebase';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp,
} from 'firebase/firestore';

export interface UserMemory {
    facts: string[];          // e.g. ["prefers TypeScript", "uses React", "likes dark themes"]
    recentTopics: string[];   // e.g. ["login form", "shadcn/ui", "authentication"]
    preferences: Record<string, string>; // e.g. { framework: "Next.js", styling: "Tailwind" }
    updatedAt?: number;
}

const DEFAULT_MEMORY: UserMemory = {
    facts: [],
    recentTopics: [],
    preferences: {},
};

export async function getUserMemory(userId: string): Promise<UserMemory> {
    const ref = doc(db, 'users', userId, 'private', 'memory');
    const snap = await getDoc(ref);
    if (!snap.exists()) return DEFAULT_MEMORY;
    return snap.data() as UserMemory;
}

export async function saveUserMemory(userId: string, memory: UserMemory): Promise<void> {
    const ref = doc(db, 'users', userId, 'private', 'memory');
    const snap = await getDoc(ref);
    if (snap.exists()) {
        await updateDoc(ref, { ...memory, updatedAt: serverTimestamp() });
    } else {
        await setDoc(ref, { ...memory, updatedAt: serverTimestamp() });
    }
}

/**
 * Build the system prompt that includes the user's memory.
 * This is injected at the start of every Groq conversation.
 */
export function buildSystemPrompt(memory: UserMemory): string {
    const lines: string[] = [
        'You are xGPT, a highly capable AI assistant. You are helpful, concise, and friendly.',
        'You remember things the user has told you and use that to give personalized responses.',
        '',
        'Always answer clearly. For code, use markdown with language identifiers.',
        'For images, act like a creative director — be specific and detailed in descriptions.',
    ];

    if (memory.facts.length > 0) {
        lines.push('', '## What you know about this user:');
        memory.facts.slice(-20).forEach(f => lines.push(`- ${f}`));
    }

    if (memory.recentTopics.length > 0) {
        lines.push('', `## Recent topics they've worked on: ${memory.recentTopics.slice(-8).join(', ')}`);
    }

    const prefEntries = Object.entries(memory.preferences);
    if (prefEntries.length > 0) {
        lines.push('', '## Their preferences:');
        prefEntries.forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
    }

    return lines.join('\n');
}
