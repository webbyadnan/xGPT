'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getSettings, saveSettings, applyTheme, AppSettings, DEFAULT_SETTINGS } from '@/lib/settingsService';
import { getUserCredits, UserCredits, DAILY_MSG_CREDITS, DAILY_IMG_CREDITS } from '@/lib/creditService';
import {
    X, User, Bell, Palette, Shield,
    Sun, Moon, Monitor, Save, Loader2, CheckCircle, BarChart2,
} from 'lucide-react';

interface SettingsModalProps { onClose: () => void; }
type Section = 'profile' | 'appearance' | 'notifications' | 'privacy';

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
    return (
        <button onClick={() => onChange(!value)} style={{
            width: 40, height: 22, borderRadius: 100, border: 'none', cursor: 'pointer', flexShrink: 0,
            background: value ? 'linear-gradient(135deg, #00d4ff, #7c3aed)' : 'var(--bg-glass)',
            outline: `1px solid ${value ? 'transparent' : 'var(--border-subtle)'}`,
            position: 'relative', transition: 'all 0.2s',
        }}>
            <div style={{
                position: 'absolute', top: 2, left: value ? 20 : 2,
                width: 18, height: 18, borderRadius: '50%', background: 'white',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            }} />
        </button>
    );
}

function Row({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-subtle)', marginBottom: 8, gap: 12 }}>
            <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
            </div>
            {children}
        </div>
    );
}

const sections: Array<{ id: Section; label: string; icon: React.ElementType }> = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'privacy', label: 'Privacy', icon: Shield },
];

export default function SettingsModal({ onClose }: SettingsModalProps) {
    const { user, updateDisplayName } = useAuth();
    const [section, setSection] = useState<Section>('profile');
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
    const [credits, setCredits] = useState<UserCredits | null>(null);
    const [loading, setLoading] = useState(true);
    const [displayName, setDisplayName] = useState(user?.displayName || '');
    const [nameError, setNameError] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

    useEffect(() => {
        if (!user) return;
        Promise.all([getSettings(user.uid), getUserCredits(user.uid)])
            .then(([s, c]) => { setSettings(s); setCredits(c); setDisplayName(user.displayName || ''); applyTheme(s); })
            .finally(() => setLoading(false));
    }, [user]);

    const updateSetting = useCallback(async (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => {
        if (!user) return;
        const updated = { ...settings, [key]: value } as AppSettings;
        setSettings(updated);
        if (key === 'theme' || key === 'fontSize' || key === 'messageDensity') applyTheme(updated);
        setSaveStatus('saving');
        await saveSettings(user.uid, { [key]: value }).catch(() => { });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
    }, [user, settings]);

    const handleSaveName = async () => {
        if (!displayName.trim() || displayName.trim().length < 2) { setNameError('Name must be at least 2 characters'); return; }
        setNameError(''); setSaving(true);
        try { await updateDisplayName(displayName.trim()); setSaveStatus('saved'); setTimeout(() => setSaveStatus('idle'), 1500); }
        catch { setNameError('Failed to update. Try again.'); }
        finally { setSaving(false); }
    };

    if (loading) return (
        <div className="modal-overlay">
            <div className="modal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 160 }}>
                <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-cyan)' }} />
            </div>
        </div>
    );

    const themeOpts: Array<{ v: AppSettings['theme']; l: string; I: React.ElementType }> = [
        { v: 'dark', l: 'Dark', I: Moon }, { v: 'light', l: 'Light', I: Sun }, { v: 'system', l: 'System', I: Monitor },
    ];

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
                {/* Compact sidebar */}
                <div className="settings-nav">
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', padding: '0 8px 10px', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Settings</div>
                    {sections.map(s => (
                        <button key={s.id} onClick={() => setSection(s.id)} className={`settings-nav-item ${section === s.id ? 'active' : ''}`}>
                            <s.icon size={13} /> {s.label}
                        </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    {saveStatus !== 'idle' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderRadius: 8, fontSize: 11, fontWeight: 500, background: saveStatus === 'saved' ? 'rgba(74,222,128,0.1)' : 'rgba(0,212,255,0.1)', color: saveStatus === 'saved' ? '#4ade80' : 'var(--accent-cyan)', border: `1px solid ${saveStatus === 'saved' ? 'rgba(74,222,128,0.3)' : 'rgba(0,212,255,0.3)'}`, margin: '0 4px' }}>
                            {saveStatus === 'saved' ? <CheckCircle size={10} /> : <Loader2 size={10} style={{ animation: 'spin 1s linear infinite' }} />}
                            {saveStatus === 'saved' ? 'Saved' : 'Saving…'}
                        </div>
                    )}
                </div>

                {/* Content */}
                <div className="settings-content">
                    <button className="modal-close" onClick={onClose}><X size={14} /></button>

                    {/* ── PROFILE ── */}
                    {section === 'profile' && (
                        <div>
                            <h3 className="settings-title">Profile</h3>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                                {user?.photoURL ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={user.photoURL} alt="avatar" style={{ width: 52, height: 52, borderRadius: '50%', border: '2px solid var(--border-bright)', objectFit: 'cover' }} />
                                ) : (
                                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #00d4ff, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white' }}>
                                        {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
                                    </div>
                                )}
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 14 }}>{user?.displayName || 'User'}</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{user?.email}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                        Since {user?.metadata?.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '—'}
                                    </div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Display Name</label>
                                <input className="input" value={displayName} onChange={e => { setDisplayName(e.target.value); setNameError(''); }}
                                    placeholder="Your name" onKeyDown={e => e.key === 'Enter' && handleSaveName()} />
                                {nameError && <div style={{ fontSize: 11, color: '#f87171', marginTop: 4 }}>{nameError}</div>}
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input className="input" value={user?.email || ''} disabled style={{ opacity: 0.5, cursor: 'not-allowed' }} />
                            </div>
                            <button onClick={handleSaveName} disabled={saving} className="btn-primary" style={{ width: '100%', gap: 6 }}>
                                {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={13} />}
                                {saving ? 'Saving...' : 'Save Profile'}
                            </button>

                            {/* Usage stats */}
                            {credits && (
                                <div style={{ marginTop: 16, padding: '12px 14px', background: 'var(--bg-glass)', borderRadius: 10, border: '1px solid var(--border-subtle)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: 13, fontWeight: 600 }}>
                                        <BarChart2 size={12} style={{ color: 'var(--accent-cyan)' }} /> Usage Today
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                                        {[
                                            { l: 'Msgs left', v: `${credits.msgCredits}/${DAILY_MSG_CREDITS}`, c: '#4ade80' },
                                            { l: 'Imgs left', v: `${credits.imgCredits}/${DAILY_IMG_CREDITS}`, c: '#c4b5fd' },
                                            { l: 'Total msgs', v: credits.totalMsgUsed, c: '#00d4ff' },
                                            { l: 'Total imgs', v: credits.totalImgUsed, c: '#f9a8d4' },
                                        ].map(s => (
                                            <div key={s.l} style={{ padding: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-subtle)', textAlign: 'center' }}>
                                                <div style={{ fontSize: 18, fontWeight: 700, color: s.c }}>{s.v}</div>
                                                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{s.l}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── APPEARANCE ── */}
                    {section === 'appearance' && (
                        <div>
                            <h3 className="settings-title">Appearance</h3>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Theme</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {themeOpts.map(o => (
                                        <button key={o.v} onClick={() => updateSetting('theme', o.v)} style={{
                                            flex: 1, padding: '10px 6px', borderRadius: 10, fontSize: 12, fontWeight: 500,
                                            border: `2px solid ${settings.theme === o.v ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                                            background: settings.theme === o.v ? 'rgba(0,212,255,0.1)' : 'var(--bg-glass)',
                                            color: settings.theme === o.v ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                            cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, fontFamily: 'var(--font-sans)', transition: 'all 0.15s',
                                        }}><o.I size={15} />{o.l}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Font Size</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {(['small', 'medium', 'large'] as const).map(v => (
                                        <button key={v} onClick={() => updateSetting('fontSize', v)} style={{
                                            flex: 1, padding: '9px 6px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                            border: `2px solid ${settings.fontSize === v ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                                            background: settings.fontSize === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-glass)',
                                            color: settings.fontSize === v ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                            fontSize: v === 'small' ? 11 : v === 'large' ? 15 : 13, fontWeight: settings.fontSize === v ? 600 : 400,
                                            textTransform: 'capitalize', transition: 'all 0.15s',
                                        }}>{v}</button>
                                    ))}
                                </div>
                            </div>

                            <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Message Density</div>
                                <div style={{ display: 'flex', gap: 6 }}>
                                    {(['compact', 'comfortable', 'spacious'] as const).map(v => (
                                        <button key={v} onClick={() => updateSetting('messageDensity', v)} style={{
                                            flex: 1, padding: '9px 4px', borderRadius: 10, cursor: 'pointer', fontFamily: 'var(--font-sans)',
                                            border: `2px solid ${settings.messageDensity === v ? 'var(--accent-cyan)' : 'var(--border-subtle)'}`,
                                            background: settings.messageDensity === v ? 'rgba(0,212,255,0.1)' : 'var(--bg-glass)',
                                            color: settings.messageDensity === v ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                            fontSize: 12, fontWeight: settings.messageDensity === v ? 600 : 400,
                                            textTransform: 'capitalize', transition: 'all 0.15s',
                                        }}>{v}</button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── NOTIFICATIONS ── */}
                    {section === 'notifications' && (
                        <div>
                            <h3 className="settings-title">Notifications</h3>
                            <Row label="Credit Alerts" desc="Warn when ≤2 credits remain">
                                <Toggle value={settings.notifyCreditAlerts} onChange={v => updateSetting('notifyCreditAlerts', v)} />
                            </Row>
                            <Row label="New Features" desc="xGPT updates and new capabilities">
                                <Toggle value={settings.notifyNewFeatures} onChange={v => updateSetting('notifyNewFeatures', v)} />
                            </Row>
                            <button className="btn-ghost" style={{ width: '100%', margin: '8px 0', fontSize: 13, gap: 6 }}
                                onClick={async () => {
                                    if ('Notification' in window) {
                                        const p = await Notification.requestPermission();
                                        if (p === 'granted') new Notification('xGPT', { body: 'Desktop notifications enabled ✓' });
                                    }
                                }}>
                                <Bell size={13} /> Enable Desktop Notifications
                            </button>
                        </div>
                    )}

                    {/* ── PRIVACY ── */}
                    {section === 'privacy' && (
                        <div>
                            <h3 className="settings-title">Privacy</h3>
                            <Row label="Save Chat History" desc="Store conversations in Firestore">
                                <Toggle value={settings.saveChatHistory} onChange={v => updateSetting('saveChatHistory', v)} />
                            </Row>
                            <Row label="AI Memory" desc="Remember your preferences across chats">
                                <Toggle value={settings.enableMemory} onChange={v => updateSetting('enableMemory', v)} />
                            </Row>
                            <Row label="Anonymous Analytics" desc="Help improve xGPT (no messages shared)">
                                <Toggle value={settings.shareAnalytics} onChange={v => updateSetting('shareAnalytics', v)} />
                            </Row>
                            <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(248,113,113,0.05)', borderRadius: 10, border: '1px solid rgba(248,113,113,0.15)' }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#f87171', marginBottom: 8 }}>Danger Zone</div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="btn-ghost" style={{ flex: 1, fontSize: 12, padding: '7px 10px', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}
                                        onClick={() => confirm('Clear all chat history? Cannot be undone.')}>Clear History</button>
                                    <button className="btn-ghost" style={{ flex: 1, fontSize: 12, padding: '7px 10px', borderColor: 'rgba(248,113,113,0.3)', color: '#f87171' }}
                                        onClick={() => confirm('Clear AI memory? Cannot be undone.')}>Clear Memory</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
