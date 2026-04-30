import React, { useState, useContext } from 'react';
import { login, register } from '../services/api';
import { AuthContext } from '../context/AuthContext';

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
    const { refreshUser } = useContext(AuthContext);

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

            // Refresh user context
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
                className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm flex flex-col items-center relative"
                onClick={e => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 transition-colors text-3xl font-bold z-10"
                    aria-label="Close Login"
                >
                    &times;
                </button>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">{isSigningUp ? 'Create an Account' : 'Welcome Back!'}</h2>
                <p className="text-gray-500 mb-6">{isSigningUp ? 'Get started with your new account.' : 'Sign in to access your profile.'}</p>

                <form onSubmit={handleSubmit} className="w-full space-y-4">
                    {isSigningUp && (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">Name</label>
                            <input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                required={isSigningUp}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                                placeholder="Your Name"
                            />
                        </div>
                    )}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                            placeholder="you@example.com"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-pink-500 focus:border-pink-500"
                            placeholder="••••••••"
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-pink-500 text-white font-bold py-3 px-4 rounded-lg hover:bg-pink-600 transition-colors disabled:bg-gray-400"
                    >
                        {isLoading ? 'Please wait...' : (isSigningUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <p className="text-sm text-gray-600 mt-6">
                    {isSigningUp ? 'Already have an account?' : "Don't have an account?"}
                    <button onClick={() => { setIsSigningUp(!isSigningUp); setError(null); }} className="font-medium text-pink-500 hover:underline ml-1">
                        {isSigningUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </div>
        </div>
    );
};