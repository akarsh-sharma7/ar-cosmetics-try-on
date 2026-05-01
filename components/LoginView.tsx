import React, { useState, useContext, useEffect, useRef } from 'react';
import { login, register, loginWithGoogle } from '../services/api';
import { AuthContext } from '../context/AuthContext';

// Extend window to include the Google GSI types
declare global {
    interface Window {
        google?: {
            accounts: {
                id: {
                    initialize: (config: object) => void;
                    renderButton: (el: HTMLElement, config: object) => void;
                    prompt: () => void;
                };
            };
        };
    }
}

// Read from Vite env — set VITE_GOOGLE_CLIENT_ID in .env.local
const GOOGLE_CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || '';

interface LoginViewProps {
    onClose: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onClose }) => {
    const [isSigningUp, setIsSigningUp] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const { refreshUser } = useContext(AuthContext);
    const googleBtnRef = useRef<HTMLDivElement>(null);

    // Initialise Google GSI after the script loads
    useEffect(() => {
        if (!GOOGLE_CLIENT_ID) return;

        const initGSI = () => {
            if (!window.google || !googleBtnRef.current) return;

            window.google.accounts.id.initialize({
                client_id: GOOGLE_CLIENT_ID,
                callback: handleGoogleCredential,
                auto_select: false,
                cancel_on_tap_outside: true,
            });

            // Render the official Google button (hidden — we show our own styled button)
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                theme: 'outline',
                size: 'large',
                type: 'standard',
                width: 320,
            });
        };

        // GSI may already be loaded or need to wait for the script
        if (window.google) {
            initGSI();
        } else {
            const script = document.querySelector('script[src*="accounts.google.com/gsi/client"]');
            script?.addEventListener('load', initGSI);
            return () => script?.removeEventListener('load', initGSI);
        }
    }, []);

    const handleGoogleCredential = async (response: { credential: string }) => {
        setIsGoogleLoading(true);
        setError(null);
        try {
            await loginWithGoogle(response.credential);
            await refreshUser();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Google sign-in failed. Please try again.');
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleGoogleClick = () => {
        if (!GOOGLE_CLIENT_ID) {
            setError('VITE_GOOGLE_CLIENT_ID is not set in .env.local — see setup instructions below.');
            return;
        }
        // Click the hidden GSI-rendered button to trigger the popup
        const gsiBtn = googleBtnRef.current?.querySelector<HTMLElement>('[role="button"]');
        if (gsiBtn) {
            gsiBtn.click();
        } else {
            window.google?.accounts.id.prompt();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (isSigningUp) {
                if (name.trim() === '') {
                    setError('Please enter your name.');
                    setIsLoading(false);
                    return;
                }
                await register(email, password, name);
            } else {
                await login(email, password);
            }
            await refreshUser();
            onClose();
        } catch (err: any) {
            setError(err.message || 'An unexpected error occurred. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col items-center relative overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Decorative gradient header strip */}
                <div className="w-full h-1.5 bg-gradient-to-r from-pink-400 via-rose-400 to-fuchsia-400" />

                <div className="w-full px-8 pt-7 pb-8">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors text-2xl font-light leading-none"
                        aria-label="Close"
                    >
                        ✕
                    </button>

                    {/* Heading */}
                    <h2 className="text-2xl font-bold text-gray-800 mb-1">
                        {isSigningUp ? 'Create Account' : 'Welcome Back'}
                    </h2>
                    <p className="text-sm text-gray-500 mb-6">
                        {isSigningUp ? 'Join AR Shop to save your looks.' : 'Sign in to access your profile.'}
                    </p>

                    {/* ── Google Sign-In button ─────────────────────────────── */}
                    <button
                        id="google-signin-btn"
                        type="button"
                        onClick={handleGoogleClick}
                        disabled={isGoogleLoading}
                        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 active:bg-gray-100 shadow-sm transition-all font-medium text-gray-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {isGoogleLoading ? (
                            <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                            </svg>
                        ) : (
                            /* Official Google "G" logo */
                            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                                <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                            </svg>
                        )}
                        {isGoogleLoading ? 'Signing in…' : 'Continue with Google'}
                    </button>

                    {/* Hidden GSI-rendered button (drives the popup) */}
                    <div ref={googleBtnRef} className="hidden" aria-hidden="true" />

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-5">
                        <div className="flex-1 h-px bg-gray-200" />
                        <span className="text-xs text-gray-400 font-medium">or</span>
                        <div className="flex-1 h-px bg-gray-200" />
                    </div>

                    {/* ── Email / Password form ─────────────────────────────── */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {isSigningUp && (
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide" htmlFor="name">
                                    Full Name
                                </label>
                                <input
                                    id="name"
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    required={isSigningUp}
                                    className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition"
                                    placeholder="Jane Doe"
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide" htmlFor="email">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition"
                                placeholder="you@example.com"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide" htmlFor="password">
                                Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent transition"
                                placeholder="••••••••"
                            />
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5">
                                <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                                <p className="text-red-600 text-xs leading-relaxed">{error}</p>
                            </div>
                        )}

                        <button
                            type="submit"
                            id="email-signin-btn"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-pink-500 to-rose-500 text-white font-semibold py-2.5 px-4 rounded-xl hover:from-pink-600 hover:to-rose-600 active:scale-[0.98] transition-all shadow-md disabled:opacity-60 disabled:cursor-not-allowed text-sm"
                        >
                            {isLoading ? 'Please wait…' : (isSigningUp ? 'Create Account' : 'Sign In')}
                        </button>
                    </form>

                    {/* Toggle sign up / sign in */}
                    <p className="text-xs text-gray-500 mt-5 text-center">
                        {isSigningUp ? 'Already have an account?' : "Don't have an account?"}
                        <button
                            onClick={() => { setIsSigningUp(!isSigningUp); setError(null); }}
                            className="font-semibold text-pink-500 hover:text-pink-600 hover:underline ml-1 transition-colors"
                        >
                            {isSigningUp ? 'Sign In' : 'Sign Up'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};