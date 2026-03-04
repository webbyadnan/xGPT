'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import AuthModal from '@/components/AuthModal';
import { Zap, MessageSquare, Image, Code, Brain, ArrowRight, Send, Sparkles } from 'lucide-react';

const FEATURES = [
    { icon: '⚡', title: 'Blazing Fast', desc: 'Groq-powered inference. Responses in milliseconds.' },
    { icon: '🎨', title: 'Image Gen', desc: 'Generate stunning images with FLUX.1-schnell.' },
    { icon: '💻', title: 'Code Assistant', desc: 'Write, debug, refactor code in any language.' },
    { icon: '🧠', title: 'Llama 3.3 70B', desc: "Meta's latest open-source model." },
    { icon: '💾', title: 'Chat History', desc: 'All conversations saved via Firebase.' },
    { icon: '🔒', title: 'Secure Auth', desc: 'Google or email sign-in. Private & secure.' },
];

const EXAMPLE_PROMPTS = [
    'Write a Python web scraper for news articles',
    'Explain quantum entanglement in simple terms',
    'Create a React login form with shadcn/ui',
    'Generate an image of a futuristic city at night',
];

export const PENDING_PROMPT_KEY = 'xgpt_pending_prompt';

export default function LandingPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [showAuth, setShowAuth] = useState(false);
    const [prompt, setPrompt] = useState('');
    const [placeholder, setPlaceholder] = useState(EXAMPLE_PROMPTS[0]);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const promptIdx = useRef(0);

    // Cycle placeholder examples
    useEffect(() => {
        const interval = setInterval(() => {
            promptIdx.current = (promptIdx.current + 1) % EXAMPLE_PROMPTS.length;
            setPlaceholder(EXAMPLE_PROMPTS[promptIdx.current]);
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 140)}px`;
    }, [prompt]);

    const handleSend = () => {
        const trimmed = prompt.trim();
        if (!trimmed) return;

        if (user) {
            // Already logged in → go straight to chat with the prompt
            sessionStorage.setItem(PENDING_PROMPT_KEY, trimmed);
            router.push(`/chat?prompt=${encodeURIComponent(trimmed)}`);
        } else {
            // Not logged in → save prompt, show auth modal
            sessionStorage.setItem(PENDING_PROMPT_KEY, trimmed);
            setShowAuth(true);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleExampleClick = (ex: string) => {
        setPrompt(ex);
        textareaRef.current?.focus();
    };

    return (
        <main className="landing">
            <div className="landing-bg" />

            {/* Nav */}
            <nav className="landing-nav">
                <div className="logo">xGPT</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-muted)' }} className="hide-mobile">
                        <Zap size={12} style={{ color: 'var(--accent-cyan)' }} />
                        Groq + DeepSeek
                    </div>
                    {user ? (
                        <button className="btn-primary" onClick={() => router.push('/chat')} style={{ padding: '8px 18px', fontSize: 14 }}>
                            Go to Chat <ArrowRight size={14} />
                        </button>
                    ) : (
                        <button className="btn-ghost" onClick={() => setShowAuth(true)} style={{ padding: '8px 18px', fontSize: 14 }}>Sign In</button>
                    )}
                </div>
            </nav>

            {/* Hero */}
            <section className="landing-hero">
                <div className="hero-badge">
                    <Zap size={11} /> Blazing fast AI — Ask anything
                </div>

                <h1 className="hero-title">
                    The AI assistant<br />
                    <span className="gradient-text">built for everyone</span>
                </h1>

                <p className="hero-subtitle">
                    Chat, generate images, write code — powered by Groq&apos;s lightning-fast inference.
                </p>

                {/* ── Hero Prompt Box ── */}
                <div className="hero-input-card">
                    <div className="hero-input-wrapper">
                        <textarea
                            ref={textareaRef}
                            className="hero-textarea"
                            placeholder={`Try: "${placeholder}"`}
                            value={prompt}
                            onChange={e => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                        />
                        <button
                            className="hero-send-btn"
                            onClick={handleSend}
                            disabled={!prompt.trim()}
                            title="Send"
                        >
                            <Send size={16} />
                        </button>
                    </div>

                    {/* Example prompt chips */}
                    <div className="hero-examples">
                        <Sparkles size={11} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
                        {EXAMPLE_PROMPTS.slice(0, 3).map(ex => (
                            <button
                                key={ex}
                                className="hero-example-chip"
                                onClick={() => handleExampleClick(ex)}
                            >
                                {ex.length > 36 ? ex.slice(0, 33) + '…' : ex}
                            </button>
                        ))}
                    </div>

                    {!user && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>
                            You&apos;ll be asked to sign in — your prompt will be remembered ✓
                        </div>
                    )}
                </div>

                {/* Capability pills */}
                <div className="hero-pills">
                    {[{ Icon: MessageSquare, label: 'Chat' }, { Icon: Image, label: 'Images' }, { Icon: Code, label: 'Code' }, { Icon: Brain, label: 'Analysis' }].map(({ Icon, label }) => (
                        <div key={label} className="hero-pill">
                            <Icon size={15} style={{ color: 'var(--accent-cyan)' }} />
                            <span>{label}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features — scrollable below hero */}
            <section className="landing-features">
                <div style={{ textAlign: 'center', marginBottom: 28 }}>
                    <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>
                        Everything you need, <span className="gradient-text">in one place</span>
                    </h2>
                </div>
                <div className="features-grid">
                    {FEATURES.map((f, i) => (
                        <div key={f.title} className="feature-card" style={{ animationDelay: `${0.07 * i}s` }}>
                            <div className="feature-icon">{f.icon}</div>
                            <div className="feature-title">{f.title}</div>
                            <div className="feature-desc">{f.desc}</div>
                        </div>
                    ))}
                </div>
            </section>

            {showAuth && (
                <AuthModal
                    onClose={() => setShowAuth(false)}
                    initialMode="signup"
                />
            )}
        </main>
    );
}
