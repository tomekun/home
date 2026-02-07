import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { sanitizeUrl } from '../utils/security';
import { authenticatedFetch } from '../utils/api';


export const Login: React.FC = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [botInfo, setBotInfo] = useState<any>(null);

    useEffect(() => {
        authenticatedFetch('http://localhost:3001/api/bot/stats')
            .then(res => res.json())
            .then(data => setBotInfo(data))
            .catch(console.error);
    }, []);

    const handleLogin = () => {
        setIsLoading(true);
        window.location.href = 'http://localhost:3001/api/auth/login';
    };

    useEffect(() => {
        // Default to light mode for login unless we know otherwise
        // (In a real app, we might check localStorage)
        document.documentElement.classList.remove('dark');
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-500 bg-slate-100 dark:bg-[#07070a]">
            <div className="mesh-background" />

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-10 max-w-md w-full text-center relative z-10"
            >
                <div className="mb-8 relative inline-block">
                    <img
                        src={sanitizeUrl(botInfo?.avatar || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6984096db2b7dca33a74c9bf/01f395860_logo.png")}
                        alt="Logo"
                        className="w-24 h-24 rounded-full border-2 border-white/20 relative z-10 shadow-2xl"
                    />
                    <div className="absolute inset-0 bg-white/10 blur-2xl rounded-full" />
                </div>

                <h1 className="text-3xl font-bold mb-2 tracking-tight text-primary uppercase">
                    {botInfo?.name || "Pastel BOT"}
                </h1>
                <p className="text-secondary mb-8 font-medium">Control Panel</p>

                <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/20 to-transparent mb-8" />

                <button
                    onClick={handleLogin}
                    disabled={isLoading}
                    className="w-full bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-70 text-white font-semibold py-3 px-6 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:-translate-y-1 shadow-lg shadow-black/20"
                >
                    {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                        <>
                            <img
                                src="https://cdn.prod.website-files.com/6257adef93867e3d03440e66/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png"
                                alt="Discord"
                                className="w-6 h-6"
                            />
                            <span>Discordでログイン</span>
                        </>
                    )}
                </button>

                <div className="mt-8 flex justify-center gap-4 text-sm text-white/50">
                    <a href="#" className="hover:text-white transition-colors">利用規約</a>
                    <span>•</span>
                    <a href="#" className="hover:text-white transition-colors">プライバシーポリシー</a>
                </div>
            </motion.div>
        </div>
    );
};
