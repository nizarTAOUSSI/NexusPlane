import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import logo from '../assets/logoNexus.png';
import Animation from '../components/Animation';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import BackBtn from '../components/BackBtn';

const LoginPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errorMsg, setErrorMsg] = useState<React.ReactNode | null>(null);

    // States for Banned/Deactivated Appeals Form
    const [isBanned, setIsBanned] = useState(false);
    const [bannedEmail, setBannedEmail] = useState('');
    const [appealMessage, setAppealMessage] = useState('');
    const [appealSent, setAppealSent] = useState(false);

    const inviteProject = searchParams.get('invite_project');

    const claimInviteAndRedirect = async (_userId: string) => {
        if (!inviteProject) return navigate('/dashboard');
        try {
            await api.post('/projects/claim-invite/');
        } catch {}
        navigate(`/projects/${inviteProject}`);
    };

    const handleGoogleSuccess = async (credentialResponse: { credential?: string }) => {
        const credential = credentialResponse?.credential;
        if (!credential) {
            console.error('Google login: missing credential');
            return;
        }
        try {
            setErrorMsg(null);
            setIsLoading(true);
            const response = await api.post('/auth/google-login/', { credential });
            const { access, refresh, user } = response.data;
            login(access, refresh, user);
            await claimInviteAndRedirect(user.id);
        } catch (error: any) {
            console.error("Google login failed", error);
            const detail = error?.response?.data?.detail;
            if (detail?.toLowerCase().includes("disabled") || detail?.toLowerCase().includes("banned")) {
                setIsBanned(true);
                setBannedEmail('');
                setErrorMsg(
                    <span>
                        Your account has been deactivated. You can send a direct appeal to support using the form below.
                    </span>
                );
            } else {
                setErrorMsg("Google authentication failed. Please try again.");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);
        try {
            const normalizedEmail = email.trim().toLowerCase();
            const response = await api.post('/auth/login/', { email: normalizedEmail, password });
            const { access, refresh, user } = response.data;
            login(access, refresh, user);
            await claimInviteAndRedirect(user.id);
        } catch (error: any) {
            console.error("Login failed", error);
            const detail = error?.response?.data?.detail;
            if (detail?.toLowerCase().includes("disabled") || detail?.toLowerCase().includes("banned")) {
                setIsBanned(true);
                setBannedEmail(email.trim().toLowerCase());
                setErrorMsg(
                    <span>
                        Your account has been deactivated. You can send a direct appeal to support using the form below.
                    </span>
                );
            } else {
                setErrorMsg(detail || "Invalid credentials");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendAppeal = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setErrorMsg(null);
        try {
            // Natively submits appeal (saves in DB + sends email via backend Resend SMTP)
            await api.post('/auth/appeal/', {
                email: bannedEmail.trim().toLowerCase(),
                message: appealMessage.trim(),
            });
            
            setAppealSent(true);
        } catch (err: any) {
            console.error(err);
            setErrorMsg("Failed to submit appeal. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex font-sans bg-white">
            <div className="hidden lg:flex w-[55%] bg-[#f8f9fa] p-12 flex-col h-[95vh] rounded-[8%] shadow-xl m-5 relative overflow-hidden">
                <div className="z-10 relative mt-8 mb-8">
                    <h1 className="text-4xl xl:text-[2.75rem] font-extrabold text-slate-900 leading-[1.1] mb-5 tracking-tight">
                        Manage projects at <br />  the speed of thought <br />  together.
                    </h1>
                    <p className="text-slate-500 text-lg max-w-sm leading-relaxed">
                        The first AI-powered real-time collaborative platform.
                    </p>
                    <BackBtn link={"/"} />
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
                    <h2 className="text-xl font-bold text-slate-900 mb-1.5">
                        {isBanned ? 'Appeal Account Status' : 'Welcome to NexusPlan'}
                    </h2>
                    <p className="text-slate-500 text-sm font-medium">
                        {isBanned ? 'Appeal your account deactivation' : 'Sign in to your account'}
                    </p>
                </div>

                <div className="w-full max-w-sm text-center">
                    {errorMsg && !appealSent && (
                        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm font-medium text-left flex items-start gap-3 shadow-sm">
                            <span className="mt-0.5">⚠️</span>
                            <div>{errorMsg}</div>
                        </div>
                    )}

                    {appealSent ? (
                        <div className="space-y-4 text-left">
                            <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-green-800 text-sm font-medium shadow-sm">
                                🎉 <strong>Appeal Submitted!</strong> Your reactivation request has been securely sent to our database.
                            </div>
                            
                            <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 text-xs font-medium space-y-2 leading-relaxed">
                                <p className="font-semibold text-slate-800">Our administrators will review your appeal shortly.</p>
                                <p>If you have urgent questions, you can still contact support directly at <strong>othmane10baz@gmail.com</strong>.</p>
                            </div>

                            <button 
                                type="button" 
                                onClick={() => {
                                    setIsBanned(false);
                                    setErrorMsg(null);
                                    setAppealSent(false);
                                    setAppealMessage('');
                                }} 
                                className="w-full border border-gray-200 text-slate-700 rounded-xl py-3.5 font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer text-center"
                            >
                                Back to Sign In
                            </button>
                        </div>
                    ) : isBanned ? (
                        <form className="space-y-4" onSubmit={handleSendAppeal}>
                            <div className="text-left">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Your Email</label>
                                <input
                                    type="email"
                                    value={bannedEmail}
                                    onChange={(e) => setBannedEmail(e.target.value)}
                                    placeholder="Your email address"
                                    className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                                    required
                                />
                            </div>
                            <div className="text-left">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1">Appeal Message</label>
                                <textarea
                                    value={appealMessage}
                                    onChange={(e) => setAppealMessage(e.target.value)}
                                    placeholder="Describe why your account should be reactivated..."
                                    rows={4}
                                    className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white placeholder-gray-400 text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium resize-none"
                                    required
                                />
                            </div>

                            <div className="pt-2 flex flex-col gap-2">
                                <button type="submit" disabled={isLoading} className="w-full bg-[#0d6efd] text-white rounded-xl py-3.5 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 cursor-pointer disabled:opacity-75">
                                    {isLoading ? 'Submitting Appeal...' : '🚀 Submit Appeal'}
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => {
                                        setIsBanned(false);
                                        setErrorMsg(null);
                                        setAppealMessage('');
                                    }} 
                                    className="w-full border border-gray-200 text-slate-700 rounded-xl py-3.5 font-semibold hover:bg-gray-50 active:scale-[0.98] transition-all cursor-pointer"
                                >
                                    Back to Sign In
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <form className="space-y-4" onSubmit={handleEmailLogin}>
                                <div className="text-left">
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="Email address"
                                        className="w-full px-5 py-3.5 rounded-xl border border-gray-200 bg-white placeholder-gray-400 text-gray-900 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10 outline-none transition-all text-sm font-medium"
                                    />
                                </div>
                                <div className="text-left relative">
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Password"
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
                                        Forgot password?
                                    </a>
                                </div>

                                <div className="pt-2">
                                    <button type="submit" disabled={isLoading} className="w-full bg-[#0d6efd] text-white rounded-xl py-3.5 font-semibold hover:bg-blue-700 active:scale-[0.98] transition-all shadow-lg shadow-blue-600/20 disabled:opacity-70">
                                        {isLoading ? 'Loading...' : 'Sign in'}
                                    </button>
                                </div>
                            </form>

                            <div className="relative mt-6 mb-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-white text-gray-500 font-medium">Or</span>
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
                                Don't have an account? <a href="/signup" onClick={(e) => { e.preventDefault(); navigate('/signup'); }} className="text-slate-900 font-bold hover:underline decoration-2 underline-offset-2">Sign up</a>
                            </p>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LoginPage;