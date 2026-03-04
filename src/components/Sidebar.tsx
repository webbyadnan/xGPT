'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Chat, renameChat, deleteChat } from '@/lib/chatService';
import { Plus, MessageSquare, Pencil, Trash2, Check, X, Settings, LogOut, Zap } from 'lucide-react';
import Image from 'next/image';
import SettingsModal from './SettingsModal';

interface SidebarProps {
    chats: Chat[];
    activeChatId: string | null;
    onSelectChat: (chatId: string) => void;
    onNewChat: () => void;
    collapsed: boolean;
}

export default function Sidebar({ chats, activeChatId, onSelectChat, onNewChat, collapsed }: SidebarProps) {
    const { user, logout } = useAuth();
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [showSettings, setShowSettings] = useState(false);

    const handleStartRename = (chat: Chat, e: React.MouseEvent) => {
        e.stopPropagation();
        setRenamingId(chat.id);
        setRenameValue(chat.title);
    };

    const handleConfirmRename = async (chatId: string) => {
        if (renameValue.trim()) await renameChat(chatId, renameValue.trim());
        setRenamingId(null);
    };

    const handleDelete = async (chatId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (confirm('Delete this conversation?')) {
            await deleteChat(chatId);
            if (activeChatId === chatId) onNewChat();
        }
    };

    const groupedChats = React.useMemo(() => {
        const now = Date.now();
        const today: Chat[] = [], yesterday: Chat[] = [], older: Chat[] = [];
        chats.forEach(chat => {
            const diff = now - chat.updatedAt;
            if (diff < 86400000) today.push(chat);
            else if (diff < 172800000) yesterday.push(chat);
            else older.push(chat);
        });
        return { today, yesterday, older };
    }, [chats]);

    const renderChatGroup = (label: string, group: Chat[]) => {
        if (group.length === 0) return null;
        return (
            <React.Fragment key={label}>
                <div className="chat-section-label">{label}</div>
                {group.map(chat => (
                    <div
                        key={chat.id}
                        className={`chat-item ${activeChatId === chat.id ? 'active' : ''}`}
                        onClick={() => renamingId !== chat.id && onSelectChat(chat.id)}
                    >
                        <MessageSquare size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        {renamingId === chat.id ? (
                            <>
                                <input
                                    className="rename-input"
                                    value={renameValue}
                                    onChange={e => setRenameValue(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleConfirmRename(chat.id);
                                        if (e.key === 'Escape') setRenamingId(null);
                                    }}
                                    autoFocus onClick={e => e.stopPropagation()}
                                />
                                <div className="chat-item-actions" style={{ opacity: 1 }}>
                                    <button className="chat-action-btn" onClick={() => handleConfirmRename(chat.id)}><Check size={13} /></button>
                                    <button className="chat-action-btn" onClick={() => setRenamingId(null)}><X size={13} /></button>
                                </div>
                            </>
                        ) : (
                            <>
                                <span className="chat-item-title">{chat.title}</span>
                                <div className="chat-item-actions">
                                    <button className="chat-action-btn" onClick={e => handleStartRename(chat, e)}><Pencil size={13} /></button>
                                    <button className="chat-action-btn delete" onClick={e => handleDelete(chat.id, e)}><Trash2 size={13} /></button>
                                </div>
                            </>
                        )}
                    </div>
                ))}
            </React.Fragment>
        );
    };

    return (
        <>
            <div className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Image src="/xgpt-logo.png" alt="xGPT" width={24} height={24} style={{ borderRadius: 6 }} />
                        <span className="sidebar-logo">xGPT</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={12} style={{ color: 'var(--accent-cyan)' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>AI</span>
                    </div>
                </div>

                <button className="new-chat-btn" onClick={onNewChat}>
                    <Plus size={16} /> New Chat
                </button>

                <div className="sidebar-chats">
                    {chats.length === 0 ? (
                        <div style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            No conversations yet.<br />Start a new chat!
                        </div>
                    ) : (
                        <>
                            {renderChatGroup('Today', groupedChats.today)}
                            {renderChatGroup('Yesterday', groupedChats.yesterday)}
                            {renderChatGroup('Older', groupedChats.older)}
                        </>
                    )}
                </div>

                {/* Footer: avatar + settings + logout */}
                <div className="sidebar-footer">
                    <div className="user-profile" style={{ cursor: 'default' }}>
                        {user?.photoURL ? (
                            <Image src={user.photoURL} alt="avatar" width={34} height={34} className="user-avatar" />
                        ) : (
                            <div className="user-avatar-placeholder" style={{ width: 34, height: 34, fontSize: 14 }}>
                                {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
                            </div>
                        )}
                        <div className="user-info">
                            <div className="user-name">{user?.displayName || 'User'}</div>
                            <div className="user-email">{user?.email}</div>
                        </div>
                        {/* Settings button */}
                        <button
                            onClick={() => setShowSettings(true)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                            title="Settings"
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                            <Settings size={15} />
                        </button>
                        {/* Logout button — restored to original position */}
                        <button
                            onClick={logout}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, transition: 'color 0.15s' }}
                            title="Sign out"
                            onMouseEnter={e => (e.currentTarget.style.color = '#f87171')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                        >
                            <LogOut size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </>
    );
}
