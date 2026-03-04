import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/**
 * Extracts memorable facts from a conversation turn and returns
 * structured data to merge into the user's memory.
 */
export async function POST(req: NextRequest) {
    try {
        const { userMessage, assistantReply, existingMemory } = await req.json();

        if (!userMessage || !assistantReply) {
            return NextResponse.json({ facts: [], topics: [], preferences: {} });
        }

        const result = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `You are a memory extraction system. Analyze a conversation turn and extract key facts about the user.
Return ONLY a valid JSON object with this exact shape (no markdown, no explanation):
{
  "facts": ["string"],
  "topics": ["string"],
  "preferences": { "key": "value" }
}

Rules:
- facts: specific things the user told you about themselves or their work (max 3 new facts)
- topics: subjects they're working on right now (max 3 topics, short labels like "React login form", "shadcn/ui")
- preferences: key tech preferences expressed (e.g. {"framework": "Next.js", "styling": "shadcn/ui"})
- Only include NEW information not already in existing memory
- If nothing memorable, return empty arrays/objects
- Keep facts concise, max 10 words each`,
                },
                {
                    role: 'user',
                    content: `Existing memory summary: ${JSON.stringify(existingMemory || {})}

New conversation turn:
User: ${userMessage.slice(0, 500)}
Assistant: ${assistantReply.slice(0, 500)}

Extract new memorable facts:`,
                },
            ],
            temperature: 0.3,
            max_tokens: 300,
            stream: false,
        });

        const raw = result.choices[0]?.message?.content?.trim() || '{}';

        // Parse and validate the JSON
        let extracted = { facts: [] as string[], topics: [] as string[], preferences: {} as Record<string, string> };
        try {
            const parsed = JSON.parse(raw);
            extracted.facts = Array.isArray(parsed.facts) ? parsed.facts.slice(0, 3) : [];
            extracted.topics = Array.isArray(parsed.topics) ? parsed.topics.slice(0, 3) : [];
            extracted.preferences = typeof parsed.preferences === 'object' && !Array.isArray(parsed.preferences)
                ? parsed.preferences : {};
        } catch {
            // If JSON parsing fails, return empty
        }

        return NextResponse.json(extracted);
    } catch (error: unknown) {
        console.error('Memory extraction error:', error);
        return NextResponse.json({ facts: [], topics: [], preferences: {} });
    }
}
