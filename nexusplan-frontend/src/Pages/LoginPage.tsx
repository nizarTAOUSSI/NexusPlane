import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import logo from '../assets/logoNexus.png';
import Animation from '../components/Animation';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const LoginPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleGoogleSuccess = async (tokenResponse: any) => {
        try {
            setIsLoading(true);
            const { access_token } = tokenResponse;
            const response = await api.post('/auth/google-login/', { credential: access_token });
            const { access, refresh, user } = response.data;
            login(access, refresh, user);
            navigate('/');
        } catch (error) {
            console.error("Google login failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    const googleLogin = useGoogleLogin({
        onSuccess: handleGoogleSuccess,
        onError: () => console.error('Login Failed'),
    });

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await api.post('/auth/login/', { email, password });
            const { access, refresh, user } = response.data;
            login(access, refresh, user);
            navigate('/');
        } catch (error) {
            console.error("Login failed", error);
            alert("Identifiants incorrects");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex font-sans bg-white">
            <div className="hidden lg:flex w-[55%] bg-[#f8f9fa] p-12 flex-col h-[95vh] rounded-[8%] shadow-xl m-5 relative overflow-hidden">
                <div className="z-10 relative mt-8 mb-8">
                    <h1 className="text-4xl xl:text-[2.75rem] font-extrabold text-slate-900 leading-[1.1] mb-5 tracking-tight">
                        Gérez vos projets à la vitesse <br /> de la pensée. <br /> Ensemble.
                    </h1>
                    <p className="text-slate-500 text-lg max-w-sm leading-relaxed">
                        La première plateforme collaborative en temps réel propulsée par l'IA.
                    </p>
                </div>

                <div className="flex-1 w-full flex items-center justify-center relative">
                    <div className="absolute -top-70 left-45 w-full h-full xl:scale-90 2xl:scale-100">
                        <Animation />
                    </div>
                </div>
            </div>

            <div className="w-full lg:w-[45%] p-8 sm:p-16 flex flex-col justify-center items-center bg-white">
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="flex items-center gap-2 mb-6">
                        <img src={logo} alt="NexusPlan Logo" className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">NexusPlan</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1.5">Bienvenue sur NexusPlan</h2>
                    <p className="text-slate-500 text-sm font-medium">Connectez-vous à votre compte</p>
                </div>

                <div className="w-full max-w-sm text-center">
                    <form className="space-y-4" onSubmit={handleEmailLogin}>
                        <div className="text-left">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Adresse e-mail"
                                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white placeholder-gray-400 text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div className="text-left relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mot de passe"
                                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white placeholder-gray-400 text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                            />
                            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                            </button>
                        </div>

                        <div className="pt-1">
                            <a href="#" className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors">
                                Mot de passe oublié ?
                            </a>
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={isLoading} className="w-full bg-[#0d6efd] text-white rounded-xl py-3.5 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 disabled:opacity-70">
                                {isLoading ? 'Chargement...' : 'Se connecter'}
                            </button>
                        </div>
                    </form>

                    {/* Séparateur */}
                    <div className="relative mt-6 mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500 font-medium">Ou</span>
                        </div>
                    </div>

                    <button type="button" onClick={() => googleLogin()} disabled={isLoading} className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 text-slate-700 rounded-xl py-3 font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all shadow-sm disabled:opacity-70">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continuer avec Google
                    </button>

                    <p className="text-sm text-slate-500 mt-8 font-medium">
                        Vous n'avez pas de compte ? <a href="/signup" onClick={(e) => { e.preventDefault(); navigate('/signup'); }} className="text-slate-900 font-bold hover:underline decoration-2 underline-offset-2">S'inscrire</a>
                    </p>

                </div>
            </div>
        </div>
    );
};

export default LoginPage;