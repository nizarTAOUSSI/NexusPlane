import { motion } from 'framer-motion';
import logo from '../assets/logoNexus.png';

const LINKS = [
    { label: 'Fonctionnalités', href: '#' },
    { label: 'Tarifs', href: '#' },
    { label: 'Changelog', href: '#' },
    { label: 'À propos', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Confidentialité', href: '#' },
    { label: 'CGU', href: '#' },
];

const SOCIALS = [
    {
        label: 'X',
        href: '#',
        icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.733-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
            </svg>
        ),
    },
    {
        label: 'GitHub',
        href: '#',
        icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
        ),
    },
    {
        label: 'LinkedIn',
        href: '#',
        icon: (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
            </svg>
        ),
    },
];

export default function Footer() {
    return (
        <footer className="relative overflow-hidden bg-[#030712] font-sans">
            <div className="absolute top-0 inset-x-0 h-px bg-linear-to-r from-transparent via-blue-500/50 to-transparent" />
            <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-200 h-100 bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

            <div className="relative z-10 max-w-5xl mx-auto px-5 sm:px-6 pt-16 sm:pt-20 pb-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5 }}
                    className="flex flex-col sm:flex-row items-center justify-between gap-8 p-8 md:p-10 mb-16 rounded-3xl bg-white/2 border border-white/5 shadow-[0_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md"
                >
                    <div className="flex items-center gap-4 text-center sm:text-left">
                        <div className="bg-white/10 p-3 rounded-2xl border border-white/10 shadow-inner">
                            <img src={logo} alt="NexusPlan" className="h-8 w-auto brightness-0 invert opacity-90" />
                        </div>
                        <div>
                            <p className="text-slate-100 font-bold text-xl tracking-tight">NexusPlan</p>
                            <p className="text-slate-400 text-sm mt-1">Gestion de projet intelligente.</p>
                        </div>
                    </div>

                    <a
                        href="#"
                        className="group relative inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold rounded-xl px-7 py-3.5 overflow-hidden transition-all duration-200 active:scale-95 shadow-[0_4px_20px_rgb(5,104,250,0.3)] hover:shadow-[0_4px_25px_rgb(5,104,250,0.5)] shrink-0"
                    >
                        <div className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent translate-x-full group-hover:translate-x-full transition-transform duration-500" />
                        <span className="relative flex items-center gap-2">
                            Démarrer gratuitement
                            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </span>
                    </a>
                </motion.div>

                <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
                    <nav className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-4">
                        {LINKS.map((l) => (
                            <a
                                key={l.label}
                                href={l.href}
                                className="text-sm font-medium text-slate-400 hover:text-slate-100 transition-colors duration-200"
                            >
                                {l.label}
                            </a>
                        ))}
                    </nav>

                    <div className="flex items-center gap-3">
                        {SOCIALS.map((s) => (
                            <a
                                key={s.label}
                                href={s.href}
                                aria-label={s.label}
                                className="w-10 h-10 rounded-full bg-white/3 hover:bg-white/8 border border-white/5 hover:border-white/1 text-slate-400 hover:text-white flex items-center justify-center transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-white/5"
                            >
                                {s.icon}
                            </a>
                        ))}
                    </div>
                </div>

                <div className="flex items-center justify-center pt-8 border-t border-white/5">
                    <p className="text-xs text-slate-500 font-medium tracking-wide">
                        © 2026 NexusPlan. Tous droits réservés.
                    </p>
                </div>

            </div>
        </footer>
    );
}