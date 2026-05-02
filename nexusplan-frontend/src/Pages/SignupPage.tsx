import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import logo from '../assets/logoNexus.png';
import Animation from '../components/Animation';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import BackBtn from '../components/BackBtn';

const SignupPage = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');

    const handleGoogleSuccess = async (credentialResponse: any) => {
        try {
            setIsLoading(true);
            const response = await api.post('/auth/google-login/', { credential: credentialResponse.credential });
            const { access, refresh, user } = response.data;
            login(access, refresh, user);
            navigate('/dashboard');
        } catch (error) {
            console.error("Google login failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== passwordConfirm) {
            alert('Les mots de passe ne correspondent pas.');
            return;
        }
        setIsLoading(true);
        try {
            await api.post('/auth/register/', {
                email,
                username: email.split('@')[0],
                password,
                password2: passwordConfirm
            });
            navigate('/login');
        } catch (error) {
            console.error("Signup failed", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex font-sans bg-white">
            <div className="w-full lg:w-[45%] p-8 sm:p-16 flex flex-col justify-center items-center bg-white">
                <div className="flex flex-col items-center mb-10 text-center">
                    <div className="flex items-center gap-2 mb-6">
                        <img src={logo} alt="NexusPlan Logo" className="w-10 h-10 object-contain" />
                        <span className="text-2xl font-bold text-slate-900 tracking-tight">NexusPlan</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1.5">Rejoignez-nous</h2>
                    <p className="text-slate-500 text-sm font-medium">Créez votre compte NexusPlan</p>
                </div>

                <div className="w-full max-w-sm text-center">
                    <form className="space-y-4" onSubmit={handleEmailSignup}>
                        <div className="text-left">
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Adresse e-mail"
                                required
                                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white placeholder-gray-400 text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div className="text-left relative">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mot de passe"
                                required
                                minLength={8}
                                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white placeholder-gray-400 text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                            />
                        </div>
                        <div className="text-left relative">
                            <input
                                type="password"
                                value={passwordConfirm}
                                onChange={(e) => setPasswordConfirm(e.target.value)}
                                placeholder="Confirmer le mot de passe"
                                required
                                minLength={8}
                                className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white placeholder-gray-400 text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                            />
                        </div>

                        <div className="pt-2">
                            <button type="submit" disabled={isLoading} className="w-full bg-[#0d6efd] text-white rounded-xl py-3.5 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 disabled:opacity-70">
                                {isLoading ? 'Chargement...' : "S'inscrire"}
                            </button>
                        </div>
                    </form>

                    <div className="relative mt-6 mb-6">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-4 bg-white text-gray-500 font-medium">Ou</span>
                        </div>
                    </div>

                    <div className="flex justify-center">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => console.error('Google Login Failed')}
                            text="continue_with"
                            shape="rectangular"
                            width="384"
                        />
                    </div>

                    <p className="text-sm text-slate-500 mt-8 font-medium">
                        Vous avez déjà un compte ? <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }} className="text-slate-900 font-bold hover:underline decoration-2 underline-offset-2">Se connecter</a>
                    </p>

                </div>
            </div>

            <div className="hidden lg:flex w-[55%] bg-[#f8f9fa] p-12 flex-col h-[95vh] rounded-[8%] shadow-xl m-5 relative overflow-hidden">
                <div className="z-10 relative mt-8 mb-8">
                    <h1 className="text-4xl xl:text-[2.75rem] font-extrabold text-slate-900 leading-[1.1] mb-5 tracking-tight">
                        Construisez l'avenir <br /> dès aujourd'hui. <br /> Avec NexusPlan.
                    </h1>
                    <p className="text-slate-500 text-lg max-w-sm leading-relaxed">
                        Rejoignez des milliers d'équipes performantes.
                    </p>
                    <BackBtn link={"/"} />
                </div>

                <div className="flex-1 w-full flex items-center justify-center relative">
                    <div className="absolute -top-70 left-55 w-full h-full xl:scale-90 2xl:scale-100">
                        <Animation />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
