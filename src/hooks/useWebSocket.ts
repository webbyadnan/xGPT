'use client';

import { useCallback, useEffect, useRef } from 'react';

interface WSMessage {
    type: 'start' | 'chunk' | 'done' | 'error' | 'info';
    content?: string;
}

interface UseWebSocketOptions {
    onChunk?: (text: string) => void;
    onDone?: (fullText: string) => void;
    onError?: (msg: string) => void;
    onStart?: () => void;
}

export function useWebSocket({
    onChunk,
    onDone,
    onError,
    onStart,
}: UseWebSocketOptions = {}) {
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const accumulatedRef = useRef('');
    const isUnmountedRef = useRef(false);

    // Store callbacks in refs so WebSocket handlers always call the latest version
    // without needing to reconnect when callbacks change
    const onChunkRef = useRef(onChunk);
    const onDoneRef = useRef(onDone);
    const onErrorRef = useRef(onError);
    const onStartRef = useRef(onStart);

    // Keep refs updated every render — no reconnect needed
    useEffect(() => { onChunkRef.current = onChunk; });
    useEffect(() => { onDoneRef.current = onDone; });
    useEffect(() => { onErrorRef.current = onError; });
    useEffect(() => { onStartRef.current = onStart; });

    const connect = useCallback(() => {
        if (isUnmountedRef.current) return;
        if (wsRef.current?.readyState === WebSocket.OPEN ||
            wsRef.current?.readyState === WebSocket.CONNECTING) return;

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onmessage = (event) => {
            try {
                const msg: WSMessage = JSON.parse(event.data);
                switch (msg.type) {
                    case 'start':
                        accumulatedRef.current = '';
                        onStartRef.current?.();
                        break;
                    case 'chunk':
                        if (msg.content) {
                            accumulatedRef.current += msg.content;
                            onChunkRef.current?.(accumulatedRef.current);
                        }
                        break;
                    case 'done':
                        onDoneRef.current?.(accumulatedRef.current);
                        accumulatedRef.current = '';
                        break;
                    case 'error':
                        onErrorRef.current?.(msg.content || 'WebSocket error');
                        break;
                }
            } catch {
                // Ignore parse errors
            }
        };

        ws.onclose = () => {
            wsRef.current = null;
            // Reconnect after 3s only if not unmounted
            if (!isUnmountedRef.current) {
                reconnectTimerRef.current = setTimeout(connect, 3000);
            }
        };

        ws.onerror = () => {
            // onclose will fire after onerror, so reconnect happens there
        };
    }, []); // No deps — stable reference forever; callbacks resolved via refs

    useEffect(() => {
        isUnmountedRef.current = false;
        connect();
        return () => {
            isUnmountedRef.current = true;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            wsRef.current?.close();
            wsRef.current = null;
        };
    }, [connect]);

    const sendMessage = useCallback(
        (messages: Array<{ role: string; content: string }>, model = 'llama-3.3-70b-versatile') => {
            const ws = wsRef.current;
            if (!ws || ws.readyState !== WebSocket.OPEN) {
                // WS not ready — caller will use HTTP fallback
                return false;
            }
            ws.send(JSON.stringify({ messages, model, mode: 'text' }));
            return true;
        },
        []
    );

    return { sendMessage, connect };
}
