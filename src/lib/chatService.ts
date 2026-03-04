import { db } from '@/lib/firebase';
import {
    collection,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    getDocs,
    query,
    where,
    orderBy,
    serverTimestamp,
    onSnapshot,
    Unsubscribe,
    Timestamp,
} from 'firebase/firestore';

export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    type: 'text' | 'image';
    createdAt: number;
}

export interface Chat {
    id: string;
    userId: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

// Create a new chat
export async function createChat(userId: string, firstMessage: string): Promise<string> {
    const title = firstMessage.length > 40 ? firstMessage.substring(0, 40) + '...' : firstMessage;
    const chatRef = await addDoc(collection(db, 'chats'), {
        userId,
        title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    });
    return chatRef.id;
}

// Add a message to a chat
export async function addMessage(
    chatId: string,
    role: 'user' | 'assistant',
    content: string,
    type: 'text' | 'image' = 'text'
): Promise<string> {
    const msgRef = await addDoc(collection(db, 'chats', chatId, 'messages'), {
        role,
        content,
        type,
        createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'chats', chatId), {
        updatedAt: serverTimestamp(),
    });
    return msgRef.id;
}

// Get all chats for a user (real-time)
// NOTE: We filter by userId only (no orderBy) to avoid requiring a Firestore composite index.
// Sorting is done client-side.
export function subscribeToChats(userId: string, callback: (chats: Chat[]) => void): Unsubscribe {
    const q = query(collection(db, 'chats'), where('userId', '==', userId));
    return onSnapshot(q, (snapshot) => {
        const chats: Chat[] = snapshot.docs
            .map((d) => {
                const data = d.data();
                const updatedAt = data.updatedAt instanceof Timestamp
                    ? data.updatedAt.toMillis()
                    : data.updatedAt ?? Date.now();
                const createdAt = data.createdAt instanceof Timestamp
                    ? data.createdAt.toMillis()
                    : data.createdAt ?? Date.now();
                return {
                    id: d.id,
                    userId: data.userId,
                    title: data.title,
                    createdAt,
                    updatedAt,
                };
            })
            .sort((a, b) => b.updatedAt - a.updatedAt); // most recent first
        callback(chats);
    });
}

// Get messages for a chat (real-time)
export function subscribeToMessages(chatId: string, callback: (messages: Message[]) => void): Unsubscribe {
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const messages: Message[] = snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Message, 'id'>),
            createdAt: d.data().createdAt?.toMillis?.() ?? Date.now(),
        }));
        callback(messages);
    });
}

// Rename a chat
export async function renameChat(chatId: string, title: string): Promise<void> {
    await updateDoc(doc(db, 'chats', chatId), { title });
}

// Delete a chat and all its messages
export async function deleteChat(chatId: string): Promise<void> {
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const messagesSnap = await getDocs(messagesRef);
    const deletionPromises = messagesSnap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletionPromises);
    await deleteDoc(doc(db, 'chats', chatId));
}
