'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import ChatArea from '@/components/ChatArea';
import { Chat, subscribeToChats } from '@/lib/chatService';

export default function ChatPage() {
    const { user, loading } = useAuth();
    const router = useRouter();
    const [chats, setChats] = useState<Chat[]>([]);
    const [activeChatId, setActiveChatId] = useState<string | null>(null);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            setSidebarCollapsed(true);
        }
    }, []);

    useEffect(() => {
        if (!loading && !user) router.push('/');
    }, [user, loading, router]);

    useEffect(() => {
        if (!user) return;
        const unsub = subscribeToChats(user.uid, setChats);
        // Apply saved appearance settings immediately
        import('@/lib/settingsService').then(({ getSettings, applyTheme }) => {
            getSettings(user.uid).then(applyTheme).catch(() => { });
        });
        return () => unsub();
    }, [user]);


    const activeChat = chats.find(c => c.id === activeChatId) || null;

    if (loading) {
        return (
            <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 40, fontWeight: 900, background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>xGPT</div>
                    <div className="typing-indicator" style={{ justifyContent: 'center' }}>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                        <div className="typing-dot"></div>
                    </div>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="chat-layout">
            <Sidebar
                chats={chats}
                activeChatId={activeChatId}
                onSelectChat={(id) => {
                    setActiveChatId(id);
                    if (typeof window !== 'undefined' && window.innerWidth <= 768) setSidebarCollapsed(true);
                }}
                onNewChat={() => {
                    setActiveChatId(null);
                    if (typeof window !== 'undefined' && window.innerWidth <= 768) setSidebarCollapsed(true);
                }}
                collapsed={sidebarCollapsed}
            />
            {/* Mobile Sidebar Overlay */}
            {!sidebarCollapsed && (
                <div
                    className="sidebar-mobile-overlay"
                    onClick={() => setSidebarCollapsed(true)}
                />
            )}
            <ChatArea
                activeChat={activeChat}
                onChatCreated={(id) => setActiveChatId(id)}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={() => setSidebarCollapsed(p => !p)}
                onNewChat={() => setActiveChatId(null)}
            />
        </div>
    );
}
