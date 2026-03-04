'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Message as MessageType,
    Chat,
    createChat,
    addMessage,
    subscribeToMessages,
} from '@/lib/chatService';
import { getUserMemory, saveUserMemory, buildSystemPrompt, UserMemory } from '@/lib/memoryService';
import { getUserCredits, deductMsgCredit, deductImgCredit, UserCredits, DAILY_MSG_CREDITS, DAILY_IMG_CREDITS } from '@/lib/creditService';
import { useSocket } from '@/hooks/useSocket';
import Message from './Message';
import { Send, Image as ImageIcon, PanelLeftClose, PanelLeftOpen, Zap, MessageCircle, Plus } from 'lucide-react';

type LocalMessage = MessageType;

interface ChatAreaProps {
    activeChat: Chat | null;
    onChatCreated: (chatId: string) => void;
    sidebarCollapsed: boolean;
    onToggleSidebar: () => void;
    onNewChat?: () => void;
}

const WELCOME_SUGGESTIONS = [
    '✍️ Write a story about a robot learning to paint',
    '💡 Explain quantum computing simply',
    '🎨 Generate an image of a futuristic city',
    '🔧 Write a Python web scraper',
    '🧠 What is the meaning of life?',
    '📧 Write a professional email template',
];

function generateFollowUps(lastReply: string): string[] {
    const text = lastReply.toLowerCase();
    if (text.includes('code') || text.includes('function') || text.includes('```'))
        return ['Explain this code', 'Add error handling', 'Write unit tests for this'];
    if (text.includes('image') || text.includes('generate') || text.includes('picture'))
        return ['Generate a variation', 'Make it more detailed', 'Try a different style'];
    if (text.includes('story') || text.includes('once upon'))
        return ['Continue the story', 'Add a twist ending', 'Write it as a poem'];
    return ['Tell me more', 'Give me an example', 'Summarize this'];
}

function ImageLoadingState() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '20px 0' }}>
            <div style={{ position: 'relative', width: 80, height: 80 }}>
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '2px solid transparent', borderTopColor: '#00d4ff', borderRightColor: '#7c3aed',
                    animation: 'spin 1.2s linear infinite',
                }} />
                <div style={{
                    position: 'absolute', inset: 10, borderRadius: '50%',
                    background: 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(124,58,237,0.2))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'pulse 1.5s ease-in-out infinite',
                }}>
                    <ImageIcon size={22} style={{ color: 'var(--accent-cyan)' }} />
                </div>
            </div>
            <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>Generating image...</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Powered by FLUX.1-schnell</div>
            </div>
        </div>
    );
}

function AIAvatarInline() {
    return (
        <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 12px rgba(0,212,255,0.35)',
        }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M4 4L20 20M20 4L4 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
        </div>
    );
}

export default function ChatArea({ activeChat, onChatCreated, sidebarCollapsed, onToggleSidebar, onNewChat }: ChatAreaProps) {
    const { user } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialPromptSent = useRef(false);

    // ── Message state ─────────────────────────────────────────────────────────
    const [firestoreMessages, setFirestoreMessages] = useState<MessageType[]>([]);
    const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
    const subscribedChatIdRef = useRef<string | null>(null);

    const [streamingContent, setStreamingContent] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [isImageMode, setIsImageMode] = useState(false);
    const [isGeneratingImage, setIsGeneratingImage] = useState(false);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [followUpSuggestions, setFollowUpSuggestions] = useState<string[]>([]);

    // ── Memory ────────────────────────────────────────────────────────────────
    const [userMemory, setUserMemory] = useState<UserMemory>({ facts: [], recentTopics: [], preferences: {} });
    const systemPromptRef = useRef<string>('');

    // ── Credits ───────────────────────────────────────────────────────────────
    const [credits, setCredits] = useState<UserCredits | null>(null);

    // Load memory + credits on mount
    useEffect(() => {
        if (!user) return;
        getUserMemory(user.uid).then(mem => {
            setUserMemory(mem);
            systemPromptRef.current = buildSystemPrompt(mem);
        }).catch(() => { });
        getUserCredits(user.uid).then(setCredits).catch(() => { });
    }, [user]);

    // ── Refs ──────────────────────────────────────────────────────────────────
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const currentChatIdRef = useRef<string | null>(activeChat?.id ?? null);
    const lastUserMsgRef = useRef<string>('');

    useEffect(() => {
        if (activeChat?.id) currentChatIdRef.current = activeChat.id;
    }, [activeChat?.id]);

    // ── Socket.IO ─────────────────────────────────────────────────────────────
    const { sendMessage: socketSend } = useSocket({
        onStart: () => {
            setIsStreaming(true);
            setStreamingContent('');
            setFollowUpSuggestions([]);
        },
        onChunk: (accumulated) => setStreamingContent(accumulated),
        onDone: async (fullText) => {
            const chatId = currentChatIdRef.current;
            if (chatId && fullText) await addMessage(chatId, 'assistant', fullText, 'text');
            setStreamingContent('');
            setIsStreaming(false);
            setIsLoading(false);
            if (fullText) setFollowUpSuggestions(generateFollowUps(fullText));
            if (user && lastUserMsgRef.current && fullText) extractAndSaveMemory(user.uid, lastUserMsgRef.current, fullText);
        },
        onError: async (msg) => {
            const chatId = currentChatIdRef.current;
            if (chatId) await addMessage(chatId, 'assistant', `❌ ${msg}`, 'text');
            setStreamingContent('');
            setIsStreaming(false);
            setIsLoading(false);
        },
    });

    // ── Memory extraction ─────────────────────────────────────────────────────
    const extractAndSaveMemory = useCallback(async (uid: string, userMsg: string, aiReply: string) => {
        try {
            const res = await fetch('/api/memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userMessage: userMsg, assistantReply: aiReply, existingMemory: userMemory }),
            });
            const extracted = await res.json();
            if (extracted.facts?.length || extracted.topics?.length || Object.keys(extracted.preferences || {}).length) {
                const newMemory: UserMemory = {
                    facts: [...(userMemory.facts || []), ...(extracted.facts || [])].slice(-30),
                    recentTopics: [...(extracted.topics || []), ...(userMemory.recentTopics || [])].slice(0, 10),
                    preferences: { ...userMemory.preferences, ...extracted.preferences },
                };
                setUserMemory(newMemory);
                systemPromptRef.current = buildSystemPrompt(newMemory);
                await saveUserMemory(uid, newMemory);
            }
        } catch { /* non-critical */ }
    }, [userMemory]);

    // ── Firestore subscription ────────────────────────────────────────────────
    useEffect(() => {
        const newId = activeChat?.id ?? null;
        if (newId === subscribedChatIdRef.current) return;
        if (!newId) return;
        subscribedChatIdRef.current = newId;
        setFirestoreMessages([]);
        setLocalMessages([]);
        setFollowUpSuggestions([]);
        const unsub = subscribeToMessages(newId, (msgs) => {
            setFirestoreMessages(msgs);
            if (msgs.length > 0) setLocalMessages([]);
        });
        return () => unsub();
    }, [activeChat?.id]);

    // Detect explicit "New Chat" navigation
    const prevActiveChatIdRef = useRef<string | null>(activeChat?.id ?? null);
    useEffect(() => {
        const prev = prevActiveChatIdRef.current;
        const curr = activeChat?.id ?? null;
        prevActiveChatIdRef.current = curr;
        if (prev !== null && curr === null) {
            subscribedChatIdRef.current = null;
            currentChatIdRef.current = null;
            setFirestoreMessages([]);
            setLocalMessages([]);
            setStreamingContent('');
            setIsStreaming(false);
            setIsLoading(false);
            setIsGeneratingImage(false);
            setFollowUpSuggestions([]);
        }
    }, [activeChat?.id]);

    const messages = firestoreMessages.length > 0 ? firestoreMessages : localMessages;

    // ── Auto-scroll + resize ──────────────────────────────────────────────────
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent, isGeneratingImage]);

    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }, [input]);

    // ── Send message ──────────────────────────────────────────────────────────
    const sendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isLoading || !user) return;

        // Credit check
        const freshCredits = await getUserCredits(user.uid);
        setCredits(freshCredits);

        if (!isImageMode && freshCredits.msgCredits <= 0) {
            setLocalMessages(prev => [...prev, {
                id: 'no-credits-msg', role: 'assistant', type: 'text', createdAt: Date.now(),
                content: '⚠️ You have used all your **10 daily message credits**. They reset at midnight. Come back tomorrow!',
            }]);
            return;
        }
        if (isImageMode && freshCredits.imgCredits <= 0) {
            setLocalMessages(prev => [...prev, {
                id: 'no-credits-img', role: 'assistant', type: 'text', createdAt: Date.now(),
                content: '⚠️ You have used all your **3 daily image credits**. They reset at midnight. Come back tomorrow!',
            }]);
            return;
        }

        setInput('');
        setIsLoading(true);
        setFollowUpSuggestions([]);
        lastUserMsgRef.current = text;

        const optimisticMsg: LocalMessage = {
            id: `local_${Date.now()}`, role: 'user', content: text, type: 'text', createdAt: Date.now(),
        };
        setLocalMessages(prev => [...prev, optimisticMsg]);

        let chatId = currentChatIdRef.current;
        if (!chatId) {
            chatId = await createChat(user.uid, text);
            currentChatIdRef.current = chatId;
            onChatCreated(chatId);
        }
        await addMessage(chatId, 'user', text, 'text');

        if (isImageMode) {
            setIsGeneratingImage(true);
            await deductImgCredit(user.uid);
            setCredits(prev => prev ? { ...prev, imgCredits: Math.max(0, prev.imgCredits - 1) } : prev);
            try {
                const conversationHistory = messages
                    .filter(m => m.id !== optimisticMsg.id)
                    .map(m => ({ role: m.role, content: m.content.slice(0, 400) }));
                const res = await fetch('/api/image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ prompt: text, conversationHistory }),
                });
                const data = await res.json();
                if (data.error) {
                    await addMessage(chatId, 'assistant', `❌ ${data.error}`, 'text');
                } else {
                    if (data.enhancedPrompt && data.enhancedPrompt !== text)
                        await addMessage(chatId, 'assistant', `🎨 *Prompt used:* ${data.enhancedPrompt}`, 'text');
                    await addMessage(chatId, 'assistant', data.imageUrl, 'image');
                    setFollowUpSuggestions(['Generate a variation', 'Make it more detailed', 'Try a different style']);
                }
            } catch {
                await addMessage(chatId, 'assistant', '❌ Failed to generate image. Try again.', 'text');
            }
            setIsGeneratingImage(false);
            setIsLoading(false);
        } else {
            await deductMsgCredit(user.uid);
            setCredits(prev => prev ? { ...prev, msgCredits: Math.max(0, prev.msgCredits - 1) } : prev);

            const history = messages
                .filter(m => m.id !== optimisticMsg.id)
                .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));
            history.push({ role: 'user', content: text });

            const sent = socketSend(history, 'llama-3.3-70b-versatile', systemPromptRef.current);
            if (!sent) {
                // HTTP fallback
                try {
                    const res = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages: history, systemPrompt: systemPromptRef.current }),
                    });
                    if (!res.ok || !res.body) throw new Error('Stream failed');
                    const reader = res.body.getReader();
                    const decoder = new TextDecoder();
                    let full = '';
                    setIsStreaming(true);
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        full += decoder.decode(value, { stream: true });
                        setStreamingContent(full);
                    }
                    await addMessage(chatId, 'assistant', full, 'text');
                    setFollowUpSuggestions(generateFollowUps(full));
                    setStreamingContent('');
                    if (user) extractAndSaveMemory(user.uid, text, full);
                } catch {
                    await addMessage(chatId, 'assistant', '❌ Something went wrong. Try again.', 'text');
                    setStreamingContent('');
                } finally {
                    setIsStreaming(false);
                    setIsLoading(false);
                }
            }
        }
    }, [isLoading, user, messages, isImageMode, onChatCreated, socketSend, extractAndSaveMemory]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
    };

    // Handle initial prompt from URL
    useEffect(() => {
        const promptParam = searchParams.get('prompt');
        if (promptParam && user && credits && !initialPromptSent.current) {
            initialPromptSent.current = true;
            setTimeout(() => {
                setInput('');
                sendMessage(promptParam);
                router.replace('/chat');
            }, 100);
        }
    }, [searchParams, user, credits, sendMessage, router]);

    const displayMessages = [...messages];
    if (isStreaming && streamingContent) {
        displayMessages.push({ id: '__streaming__', role: 'assistant', content: streamingContent, type: 'text', createdAt: Date.now() });
    }

    return (
        <div className="chat-main">
            {/* Header with credits */}
            <div className="chat-header">
                <button className="header-action-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
                    {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
                {onNewChat && (
                    <button className="header-action-btn" onClick={onNewChat} aria-label="New chat" style={{ marginLeft: -4 }}>
                        <Plus size={18} />
                    </button>
                )}
                <span className="chat-title" style={{ marginLeft: 4 }}>{activeChat ? activeChat.title : 'New Chat'}</span>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
                    {/* Credit counters */}
                    {credits && (
                        <>
                            <div
                                title={`${credits.msgCredits}/${DAILY_MSG_CREDITS} message credits today`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 100,
                                    background: credits.msgCredits <= 2 ? 'rgba(251,191,36,0.12)' : 'rgba(0,212,100,0.1)',
                                    border: `1px solid ${credits.msgCredits <= 2 ? 'rgba(251,191,36,0.4)' : 'rgba(0,212,100,0.3)'}`,
                                    fontSize: 12, fontWeight: 600, color: credits.msgCredits <= 2 ? '#fbbf24' : '#4ade80',
                                }}
                            >
                                <MessageCircle size={11} /> {credits.msgCredits}/{DAILY_MSG_CREDITS}
                            </div>
                            <div
                                title={`${credits.imgCredits}/${DAILY_IMG_CREDITS} image credits today`}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 100,
                                    background: credits.imgCredits <= 0 ? 'rgba(248,113,113,0.12)' : 'rgba(124,58,237,0.12)',
                                    border: `1px solid ${credits.imgCredits <= 0 ? 'rgba(248,113,113,0.4)' : 'rgba(124,58,237,0.4)'}`,
                                    fontSize: 12, fontWeight: 600, color: credits.imgCredits <= 0 ? '#f87171' : '#c4b5fd',
                                }}
                            >
                                <ImageIcon size={11} /> {credits.imgCredits}/{DAILY_IMG_CREDITS}
                            </div>
                        </>
                    )}
                    <div className="model-badge"><Zap size={12} />llama-3.3-70b</div>
                </div>
            </div>

            {/* Messages */}
            <div className="messages-container">
                {displayMessages.length === 0 && !isLoading && !isGeneratingImage ? (
                    <div className="welcome-screen">
                        <div className="welcome-logo">xGPT</div>
                        <h1 className="welcome-title">
                            {userMemory.facts.length > 0 ? 'Welcome back!' : 'What can I help with?'}
                        </h1>
                        <p className="welcome-subtitle">
                            {userMemory.recentTopics.length > 0
                                ? `I remember you were working on: ${userMemory.recentTopics.slice(0, 3).join(', ')}`
                                : "Powered by Groq's blazing-fast Llama 3.3. Ask anything, generate images, write code, and more."}
                        </p>
                        <div className="suggestion-chips">
                            {WELCOME_SUGGESTIONS.map((s, i) => (
                                <button key={i} className="chip" onClick={() => sendMessage(s.replace(/^[^\s]+\s/, ''))}>{s}</button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <>
                        {displayMessages.map(msg => (
                            <Message key={msg.id} message={msg} isStreaming={msg.id === '__streaming__'} />
                        ))}
                        {isGeneratingImage && (
                            <div className="message-wrapper assistant">
                                <AIAvatarInline />
                                <div className="message-bubble assistant"><ImageLoadingState /></div>
                            </div>
                        )}
                        {isLoading && !isStreaming && !isGeneratingImage && (
                            <div className="message-wrapper assistant">
                                <AIAvatarInline />
                                <div className="message-bubble assistant">
                                    <div className="typing-indicator">
                                        <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                                    </div>
                                </div>
                            </div>
                        )}
                        {!isLoading && !isStreaming && followUpSuggestions.length > 0 && (
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 48, animation: 'fadeInUp 0.3s ease' }}>
                                {followUpSuggestions.map((s, i) => (
                                    <button key={i} className="chip" onClick={() => sendMessage(s)} style={{ fontSize: 13, padding: '8px 16px' }}>{s}</button>
                                ))}
                            </div>
                        )}
                    </>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="input-area">
                <div className="input-wrapper">
                    <textarea
                        ref={textareaRef}
                        className="chat-input"
                        placeholder={isImageMode ? 'Describe the image you want to generate...' : 'Message xGPT...'}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        rows={1}
                        disabled={isLoading}
                    />
                    <div className="input-controls">
                        <button className={`image-toggle ${isImageMode ? 'active' : ''}`} onClick={() => setIsImageMode(!isImageMode)} title="Image mode">
                            <ImageIcon size={14} /> Image
                        </button>
                        <button className="send-btn" onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} aria-label="Send">
                            <Send size={16} />
                        </button>
                    </div>
                </div>
                <p className="input-hint">
                    {isImageMode ? '🎨 Image mode — context-aware via FLUX.1-schnell' : 'Press Enter to send · Shift+Enter for new line'}
                </p>
            </div>
        </div>
    );
}
