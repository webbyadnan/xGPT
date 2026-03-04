'use client';

import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, User } from 'lucide-react';
import { Message as MessageType } from '@/lib/chatService';
import Image from 'next/image';

interface MessageProps {
    message: MessageType;
    isStreaming?: boolean;
}

function CodeBlock({ language, value }: { language: string; value: string }) {
    const [copied, setCopied] = useState(false);
    const handleCopy = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="code-block-wrapper">
            <div className="code-header">
                <span className="code-lang">{language || 'code'}</span>
                <button className="copy-btn" onClick={handleCopy}>
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                </button>
            </div>
            <SyntaxHighlighter
                style={oneDark}
                language={language || 'text'}
                PreTag="div"
                customStyle={{ margin: 0, borderRadius: '0 0 12px 12px', fontSize: '13px' }}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
}

// AI Avatar — uses generated logo image with fallback
function AIAvatar() {
    const [imgError, setImgError] = useState(false);
    return (
        <div className="message-avatar assistant" style={{ background: 'none', border: 'none', padding: 0, width: 34, height: 34, flexShrink: 0 }}>
            {!imgError ? (
                <Image
                    src="/ai-avatar.png"
                    alt="xGPT"
                    width={34}
                    height={34}
                    style={{ borderRadius: '50%', objectFit: 'cover' }}
                    onError={() => setImgError(true)}
                />
            ) : (
                // Fallback: gradient X circle
                <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #00d4ff, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 12px rgba(0,212,255,0.35)',
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M4 4L20 20M20 4L4 20" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                    </svg>
                </div>
            )}
        </div>
    );
}

export default function Message({ message, isStreaming }: MessageProps) {
    const isUser = message.role === 'user';
    // Track if user photo failed
    const [userImgError, setUserImgError] = useState(false);
    const userPhotoRef = useRef<string | null>(null);

    // Try to get user photoURL from local storage for user messages
    if (typeof window !== 'undefined' && !userPhotoRef.current) {
        try {
            const cached = sessionStorage.getItem('userPhotoURL');
            if (cached) userPhotoRef.current = cached;
        } catch { /* ignore */ }
    }

    return (
        <div className={`message-wrapper ${isUser ? 'user' : 'assistant'}`}>
            {isUser ? (
                <div className="message-avatar user">
                    {userPhotoRef.current && !userImgError ? (
                        <Image
                            src={userPhotoRef.current}
                            alt="user"
                            width={34}
                            height={34}
                            style={{ borderRadius: '50%', objectFit: 'cover' }}
                            onError={() => setUserImgError(true)}
                        />
                    ) : (
                        <User size={16} />
                    )}
                </div>
            ) : (
                <AIAvatar />
            )}

            <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
                {message.type === 'image' ? (
                    <div>
                        <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}>🎨 Generated image</div>
                        <Image
                            src={message.content}
                            alt="AI generated image"
                            width={512}
                            height={512}
                            className="message-image"
                            unoptimized
                        />
                    </div>
                ) : (
                    <>
                        {isUser ? (
                            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{message.content}</span>
                        ) : (
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    code({ inline, className, children, ...props }: any) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        const lang = match ? match[1] : '';
                                        const value = String(children).replace(/\n$/, '');
                                        if (!inline && (match || value.includes('\n'))) {
                                            return <CodeBlock language={lang} value={value} />;
                                        }
                                        return <code className={className} {...props}>{children}</code>;
                                    },
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        )}
                        {isStreaming && <span className="streaming-cursor" />}
                    </>
                )}
            </div>
        </div>
    );
}
