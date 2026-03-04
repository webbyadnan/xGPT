'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { PENDING_PROMPT_KEY } from '@/app/page';

interface AuthModalProps {
    onClose: () => void;
    initialMode?: 'login' | 'signup';
}

export default function AuthModal({ onClose, initialMode = 'login' }: AuthModalProps) {
    const { signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth();
    const router = useRouter();
    const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    /** After successful auth, redirect to /chat — with pending prompt if one exists */
    const handleAuthSuccess = () => {
        onClose();
        const pending = sessionStorage.getItem(PENDING_PROMPT_KEY);
        if (pending) {
            sessionStorage.removeItem(PENDING_PROMPT_KEY);
            router.push(`/chat?prompt=${encodeURIComponent(pending)}`);
        } else {
            router.push('/chat');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            if (mode === 'login') {
                await signInWithEmail(email, password);
            } else {
                if (!name.trim()) { setError('Please enter your name'); setLoading(false); return; }
                await signUpWithEmail(email, password, name);
            }
            handleAuthSuccess();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An error occurred';
            setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)\./, '').trim());
        } finally {
            setLoading(false);
        }
    };

    const handleGoogle = async () => {
        setLoading(true);
        setError('');
        try {
            await signInWithGoogle();
            handleAuthSuccess();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Google sign-in failed';
            setError(msg.replace('Firebase: ', '').trim());
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <button className="modal-close" onClick={onClose} aria-label="Close">
                    <X size={16} />
                </button>

                <h2>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
                <p>
                    {mode === 'login'
                        ? 'Sign in to continue chatting with xGPT'
                        : 'Start your AI journey with xGPT'}
                </p>

                {error && <div className="error-msg">{error}</div>}

                <button className="btn-ghost" style={{ width: '100%', marginBottom: '4px' }} onClick={handleGoogle} disabled={loading}>
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                        <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                <div className="divider">or</div>

                <form onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <div className="form-group">
                            <label htmlFor="name">Full Name</label>
                            <input id="name" className="input" type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} required />
                        </div>
                    )}
                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input id="email" className="input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input id="password" className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
                    </div>
                    <button className="btn-primary" style={{ width: '100%', marginTop: '8px' }} type="submit" disabled={loading}>
                        {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div className="modal-switch">
                    {mode === 'login' ? (
                        <>Don&apos;t have an account?<button onClick={() => { setMode('signup'); setError(''); }}>Sign up</button></>
                    ) : (
                        <>Already have an account?<button onClick={() => { setMode('login'); setError(''); }}>Sign in</button></>
                    )}
                </div>
            </div>
        </div>
    );
}
