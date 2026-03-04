'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface UseSocketOptions {
    onStart?: () => void;
    onChunk?: (accumulated: string) => void;
    onDone?: (fullText: string) => void;
    onError?: (msg: string) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
    const socketRef = useRef<Socket | null>(null);
    const accumulated = useRef('');

    // Keep latest callbacks in refs — never stale, no reconnect needed
    const onStartRef = useRef(options.onStart);
    const onChunkRef = useRef(options.onChunk);
    const onDoneRef = useRef(options.onDone);
    const onErrorRef = useRef(options.onError);

    useEffect(() => { onStartRef.current = options.onStart; });
    useEffect(() => { onChunkRef.current = options.onChunk; });
    useEffect(() => { onDoneRef.current = options.onDone; });
    useEffect(() => { onErrorRef.current = options.onError; });

    // Connect once on mount
    useEffect(() => {
        const socket = io({
            path: '/socket.io',
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: Infinity,
        });

        socketRef.current = socket;

        socket.on('start', () => {
            accumulated.current = '';
            onStartRef.current?.();
        });

        socket.on('chunk', (delta: string) => {
            accumulated.current += delta;
            onChunkRef.current?.(accumulated.current);
        });

        socket.on('done', (fullText: string) => {
            onDoneRef.current?.(fullText || accumulated.current);
            accumulated.current = '';
        });

        socket.on('error', (msg: string) => {
            onErrorRef.current?.(msg);
            accumulated.current = '';
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, []); // Runs exactly once — stable forever

    const sendMessage = useCallback(
        (messages: Array<{ role: string; content: string }>, model = 'llama-3.3-70b-versatile', systemPrompt?: string) => {
            const socket = socketRef.current;
            if (!socket?.connected) return false;
            socket.emit('chat', { messages, model, systemPrompt });
            return true;
        },
        []
    );


    return { sendMessage };
}
