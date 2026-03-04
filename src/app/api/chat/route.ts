import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
    try {
        const { messages, model = 'llama-3.3-70b-versatile', systemPrompt } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
        }

        // Build full message list — inject system prompt with user memory if provided
        const fullMessages = [
            {
                role: 'system' as const,
                content: systemPrompt || 'You are xGPT, a helpful AI assistant. Be concise, helpful, and friendly. For code, use markdown with language identifiers.',
            },
            ...messages,
        ];

        const stream = await groq.chat.completions.create({
            model,
            messages: fullMessages,
            stream: true,
            temperature: 0.7,
            max_tokens: 4096,
        });

        const encoder = new TextEncoder();
        const readable = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of stream) {
                        const delta = chunk.choices[0]?.delta?.content || '';
                        if (delta) controller.enqueue(encoder.encode(delta));
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });

        return new Response(readable, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'X-Accel-Buffering': 'no',
                'Cache-Control': 'no-cache',
                'Transfer-Encoding': 'chunked',
            },
        });
    } catch (error: unknown) {
        console.error('Chat API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
