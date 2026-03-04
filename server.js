// Load .env.local before any other imports so env vars are available
const fs = require('fs');
const path = require('path');

const envFile = path.resolve(__dirname, '.env.local');
if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf8').split('\n');
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx === -1) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
    }
}

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const Groq = require('groq-sdk');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── AI Providers ─────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// DeepSeek uses OpenAI-compatible API
const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;
let deepseekClient = null;
if (hasDeepSeek) {
    const OpenAI = require('openai');
    deepseekClient = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
    });
    console.log('> DeepSeek API enabled — load balancing active');
} else {
    console.log('> DeepSeek API not configured — using Groq only');
}

// Round-robin counter for load balancing
let requestCount = 0;

/**
 * Pick which provider to use.
 * Alternates between Groq and DeepSeek when both are available.
 * Falls back to Groq if DeepSeek isn't configured.
 */
function pickProvider() {
    if (!hasDeepSeek) return 'groq';
    requestCount++;
    return requestCount % 2 === 0 ? 'deepseek' : 'groq';
}

/**
 * Stream a chat completion from the selected provider.
 * Yields token strings via an async generator.
 */
async function* streamChat(provider, messages, model) {
    if (provider === 'deepseek') {
        const dsModel = 'deepseek-chat';
        const stream = await deepseekClient.chat.completions.create({
            model: dsModel,
            messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 4096,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) yield delta;
        }
    } else {
        // Groq
        const groqModel = model || 'llama-3.3-70b-versatile';
        const stream = await groq.chat.completions.create({
            model: groqModel,
            messages,
            stream: true,
            temperature: 0.7,
            max_tokens: 4096,
        });
        for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || '';
            if (delta) yield delta;
        }
    }
}

// ── Next.js + Socket.IO Server ────────────────────────────────────────────────
app.prepare().then(() => {
    const httpServer = createServer(async (req, res) => {
        try {
            const parsedUrl = parse(req.url, true);
            await handle(req, res, parsedUrl);
        } catch (err) {
            console.error('Error:', err);
            res.statusCode = 500;
            res.end('Internal Server Error');
        }
    });

    const io = new Server(httpServer, {
        path: '/socket.io',
        cors: { origin: '*' },
        transports: ['websocket', 'polling'],
    });

    io.on('connection', (socket) => {
        console.log('[Socket.IO] Client connected:', socket.id);

        // Client sends: { messages, model?, systemPrompt? }
        socket.on('chat', async ({ messages, model = 'llama-3.3-70b-versatile', systemPrompt }) => {
            if (!Array.isArray(messages) || messages.length === 0) {
                socket.emit('error', 'messages array required');
                return;
            }

            const provider = pickProvider();
            console.log(`[Socket.IO] Using provider: ${provider} (request #${requestCount})`);

            socket.emit('start', { provider }); // tell client which provider is responding

            const fullMessages = [
                {
                    role: 'system',
                    content: systemPrompt ||
                        'You are xGPT, a helpful AI assistant. Be concise and friendly. For code, use markdown.',
                },
                ...messages,
            ];

            try {
                let fullContent = '';
                for await (const delta of streamChat(provider, fullMessages, model)) {
                    fullContent += delta;
                    socket.emit('chunk', delta);
                }
                socket.emit('done', fullContent);
            } catch (err) {
                // If chosen provider fails, try the other one
                console.error(`[Socket.IO] ${provider} failed, trying fallback:`, err.message);
                const fallback = provider === 'groq' ? 'deepseek' : 'groq';
                if (fallback === 'deepseek' && !hasDeepSeek) {
                    socket.emit('error', err.message || 'Streaming error');
                    return;
                }
                try {
                    let fullContent = '';
                    for await (const delta of streamChat(fallback, fullMessages, model)) {
                        fullContent += delta;
                        socket.emit('chunk', delta);
                    }
                    socket.emit('done', fullContent);
                } catch (err2) {
                    socket.emit('error', err2.message || 'All providers failed');
                }
            }
        });

        socket.on('disconnect', () => {
            console.log('[Socket.IO] Client disconnected:', socket.id);
        });
    });

    httpServer.listen(port, () => {
        console.log(`> Ready on http://${hostname}:${port}`);
        console.log(`> Socket.IO on ws://${hostname}:${port}/socket.io`);
    });
});
