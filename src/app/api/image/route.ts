import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
    try {
        const { prompt, conversationHistory = [] } = await req.json();
        if (!prompt) {
            return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
        }

        // Use Groq to generate a detailed, context-aware image prompt
        // by understanding what the user is referring to in the conversation
        let enhancedPrompt = prompt;

        if (conversationHistory.length > 0) {
            try {
                const contextMessages = conversationHistory.slice(-8); // last 8 messages for context
                const contextStr = contextMessages
                    .map((m: { role: string; content: string }) => `${m.role}: ${m.content.slice(0, 300)}`)
                    .join('\n');

                const promptResult = await groq.chat.completions.create({
                    model: 'llama-3.3-70b-versatile',
                    messages: [
                        {
                            role: 'system',
                            content: `You are an expert image prompt engineer. Given a conversation and a user's image request, 
generate a single, detailed image generation prompt that:
1. Understands what the user is referring to from the conversation context
2. Is specific, visual, and detailed (describe colors, style, layout, elements)
3. Is optimized for FLUX.1 image generation
4. Is 1-3 sentences maximum
Return ONLY the prompt text, no explanation, no quotes.`,
                        },
                        {
                            role: 'user',
                            content: `Conversation context:\n${contextStr}\n\nUser's image request: "${prompt}"\n\nGenerate a detailed image prompt:`,
                        },
                    ],
                    temperature: 0.7,
                    max_tokens: 200,
                    stream: false,
                });

                const generated = promptResult.choices[0]?.message?.content?.trim();
                if (generated) enhancedPrompt = generated;
            } catch {
                // Fall back to original prompt if enhancement fails
                enhancedPrompt = prompt;
            }
        }

        const HF_TOKEN = process.env.HUGGINGFACE_API_TOKEN;
        const model = 'black-forest-labs/FLUX.1-schnell';

        const response = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${HF_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: enhancedPrompt,
                parameters: { num_inference_steps: 4 },
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            if (response.status === 503) {
                return NextResponse.json({ error: 'Image model is loading, please try again in 30 seconds.' }, { status: 503 });
            }
            return NextResponse.json({ error: `Image API error: ${errText}` }, { status: response.status });
        }

        const imageBlob = await response.blob();
        const arrayBuffer = await imageBlob.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const mimeType = imageBlob.type || 'image/png';
        const dataUrl = `data:${mimeType};base64,${base64}`;

        // Return the enhanced prompt too so UI can show what was generated
        return NextResponse.json({ imageUrl: dataUrl, enhancedPrompt });
    } catch (error: unknown) {
        console.error('Image API error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Internal server error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
