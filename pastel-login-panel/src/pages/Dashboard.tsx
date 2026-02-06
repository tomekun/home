import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Settings as SettingsIcon, Shield, Activity, Bell, Server, Users, MessageSquare, LogOut, Play, Square, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { translations } from '../utils/translations';
import { sanitizeUrl } from '../utils/security';
import { authenticatedFetch } from '../utils/api';


const SidebarItem = ({ icon: Icon, label, active = false, onClick, activeColor = "purple" }: { icon: any, label: string, active?: boolean, onClick?: () => void, activeColor?: string }) => (
    <div
        onClick={onClick}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all ${active ? `bg-${activeColor}-600/20 text-primary border border-${activeColor}-500/30` : 'text-secondary hover:text-primary hover:bg-white/5'}`}
    >
        <div className={active ? `text-${activeColor}-500 dark:text-${activeColor}-400` : ""}>
            <Icon size={20} />
        </div>
        <span className="font-medium">{label}</span>
    </div>
);

const StatCard = ({ label, value, icon: Icon, color }: { label: string, value: string, icon: any, color: string }) => {
    const colorClasses: Record<string, string> = {
        blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
        purple: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
        pink: "bg-pink-500/20 text-pink-600 dark:text-pink-400",
        green: "bg-green-500/20 text-green-600 dark:text-green-400"
    };

    return (
        <div className="glass-card p-6 flex flex-col gap-4 shadow-lg">
            <div className="flex justify-between items-start">
                <div className={`p-3 rounded-xl ${colorClasses[color] || "bg-white/10 text-primary"}`}>
                    <Icon size={24} />
                </div>
                <span className="text-2xl font-bold text-primary">{value}</span>
            </div>
            <span className="text-secondary text-sm font-medium">{label}</span>
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState<any>(null);
    const [botStats, setBotStats] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showStopModal, setShowStopModal] = useState(false);

    const fetchInitialData = async () => {
        try {
            const res = await authenticatedFetch('http://localhost:3001/api/handshake');
            if (!res.ok) {
                if (res.status === 401) navigate('/login');
                throw new Error('Failed to handshake');
            }
            const data = await res.json();
            setUserData({ user: data.user, guilds: data.userGuilds });
            setBotStats(data.botStats);
            setSettings(data.settings);
        } catch (err) {
            console.error('Handshake error:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshBotStatus = async () => {
        try {
            const res = await authenticatedFetch('http://localhost:3001/api/bot/stats');
            if (res.ok) {
                const data = await res.json();
                setBotStats((prev: any) => ({ ...prev, ...data }));
            }
        } catch (err) {
            // Silently fail for background refresh
        }
    };

    useEffect(() => {
        fetchInitialData();
        const interval = setInterval(refreshBotStatus, 5000);
        return () => clearInterval(interval);
    }, [navigate]);

    const lang = settings?.language || 'ja';
    const t = translations[lang] || translations.ja;

    const handleLogout = () => { navigate('/login'); };

    const handleStartBot = async () => {
        try {
            const res = await authenticatedFetch('http://localhost:3001/api/bot/start', { method: 'POST' });
            if (res.ok) {
                const handshakeRes = await authenticatedFetch('http://localhost:3001/api/handshake');
                if (handshakeRes.ok) {
                    const data = await handshakeRes.json();
                    setBotStats(data.botStats);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleStopBot = async () => {
        try {
            const res = await authenticatedFetch('http://localhost:3001/api/bot/stop', { method: 'POST' });
            if (res.ok) {
                setBotStats((prev: any) => ({ ...prev, status: 'offline' }));
            }
        } catch (error) {
            console.error(error);
        } finally {
            setShowStopModal(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center text-primary bg-slate-100 dark:bg-[#07070a]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex transition-colors duration-500 bg-slate-100 dark:bg-[#07070a]">
            {/* Sidebar */}
            <aside className="sidebar w-64 p-6 flex flex-col gap-8 z-20 bg-white/50 dark:bg-black/40 backdrop-blur-xl">
                <div className="flex items-center gap-3 px-2">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                        <img
                            src={sanitizeUrl(botStats?.avatar)}
                            alt="Logo"
                            className="w-8 h-8 rounded-full"
                        />
                    </div>
                    <span className="font-bold text-lg text-primary truncate max-w-[140px]">
                        {botStats?.name || "Bot Panel"}
                    </span>
                </div>

                <nav className="flex flex-col gap-2 flex-1">
                    <SidebarItem icon={LayoutDashboard} label={t.dashboard} active activeColor="purple" onClick={() => navigate('/dashboard')} />
                    <SidebarItem icon={Server} label={`${t.server_management} (${userData?.guilds?.length || 0})`} onClick={() => navigate('/servers')} />
                    <SidebarItem icon={Users} label={t.user_management} />
                    <SidebarItem icon={MessageSquare} label={t.auto_response} />
                    <SidebarItem icon={Shield} label={t.security} />
                    <SidebarItem icon={Activity} label={t.stats} />
                    <SidebarItem icon={Bell} label={t.notifications} />
                    <div className="my-4 h-[1px] bg-black/5 dark:bg-white/10" />
                    <SidebarItem icon={SettingsIcon} label={t.settings} onClick={() => navigate('/settings')} />
                </nav>

                <div className="mt-auto">
                    <SidebarItem icon={LogOut} label={t.logout} onClick={handleLogout} activeColor="red" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                <div className="mesh-background" />
                <header className="flex justify-between items-center mb-10 relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="relative">
                            {userData?.user?.avatar ? (
                                <img
                                    src={sanitizeUrl(`https://cdn.discordapp.com/avatars/${userData.user.id}/${userData.user.avatar}.png`)}
                                    alt="User Avatar"
                                    className="w-14 h-14 rounded-full border-2 border-purple-500/30 shadow-2xl relative z-10"
                                />
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center font-bold text-white border-2 border-white/10 shadow-2xl relative z-10">
                                    {userData?.user?.username?.charAt(0).toUpperCase() || '?'}
                                </div>
                            )}
                            <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold mb-1 text-primary flex items-center gap-2">
                                {lang === 'ja'
                                    ? `${userData?.user?.username || userData?.user?.global_name}${t.welcome_back}`
                                    : `${t.welcome_back} ${userData?.user?.username || userData?.user?.global_name}`
                                }
                                <span className="text-xl">👋</span>
                            </h2>
                            <p className="text-secondary font-medium">{botStats?.name || "Bot"} {t.welcome_subtitle}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        {settings?.isDevModeEnabled && (
                            <div className="flex gap-2">
                                {botStats?.status === 'online' ? (
                                    <button
                                        onClick={() => setShowStopModal(true)}
                                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-red-500/20"
                                    >
                                        <Square size={16} />
                                        {t.bot_stop}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleStartBot}
                                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-green-500/20"
                                    >
                                        <Play size={16} />
                                        {t.bot_start}
                                    </button>
                                )}
                            </div>
                        )}
                        <div className={`px-5 py-2.5 ${botStats?.status === 'online' ? 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'} rounded-full text-sm font-bold flex items-center gap-3 border backdrop-blur-md`}>
                            <span className={`w-2.5 h-2.5 ${botStats?.status === 'online' ? 'bg-green-500 dark:bg-green-400' : 'bg-red-500 dark:bg-red-400'} rounded-full animate-pulse`} />
                            {botStats?.status === 'online' ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 relative z-10">
                    <StatCard label={t.active_servers} value={botStats?.guildCount?.toLocaleString() || '0'} icon={Server} color="blue" />
                    <StatCard label={t.total_users} value={botStats?.userCount?.toLocaleString() || '0'} icon={Users} color="purple" />
                    <StatCard label={t.joined_servers} value={userData?.guilds?.length.toString() || '0'} icon={LayoutDashboard} color="pink" />
                    <StatCard label={t.uptime} value="99.9%" icon={Activity} color="green" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
                    <div className="glass-card p-7 shadow-2xl">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-3 text-primary">
                            <Activity size={22} className="text-purple-600 dark:text-purple-400" />
                            {t.recent_logs}
                            <span className="ml-auto text-xs font-medium text-secondary px-2 py-1 bg-black/5 dark:bg-white/5 rounded-md">{t.realtime}</span>
                        </h3>
                        <div className="flex flex-col gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div key={i} className="flex items-center gap-4 p-4 rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition-all border border-transparent hover:border-black/5 dark:hover:border-white/10 group">
                                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500/40 group-hover:bg-purple-500 transition-colors" />
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-primary group-hover:text-purple-600 dark:group-hover:text-purple-100 transition-colors">{t.log_update}</p>
                                        <p className="text-xs text-secondary font-medium group-hover:text-primary transition-colors">{i * 2} {t.minutes_ago}</p>
                                    </div>
                                    <div className="text-secondary opacity-40 group-hover:opacity-100 transition-opacity">
                                        <SettingsIcon size={14} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass-card p-7 shadow-2xl">
                        <h3 className="font-bold text-lg mb-6 flex items-center gap-3 text-primary">
                            <Server size={22} className="text-blue-600 dark:text-blue-400" />
                            {t.bot_status}
                        </h3>
                        <div className="space-y-8 mt-4">
                            <div>
                                <div className="flex justify-between text-sm mb-3">
                                    <span className="text-secondary font-semibold tracking-wide uppercase text-xs">RAM Usage</span>
                                    <span className="text-primary font-bold bg-purple-500/10 px-2 py-0.5 rounded text-xs">25%</span>
                                </div>
                                <div className="h-2.5 bg-black/5 dark:bg-black/40 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '25%' }}
                                        className="h-full bg-gradient-to-r from-purple-600 to-indigo-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                                    />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-3">
                                    <span className="text-secondary font-semibold tracking-wide uppercase text-xs">CPU Usage</span>
                                    <span className="text-primary font-bold bg-blue-500/10 px-2 py-0.5 rounded text-xs">14%</span>
                                </div>
                                <div className="h-2.5 bg-black/5 dark:bg-black/40 rounded-full overflow-hidden border border-black/5 dark:border-white/5">
                                    <motion.div
                                        initial={{ width: 0 }}
                                        animate={{ width: '14%' }}
                                        className="h-full bg-gradient-to-r from-blue-600 to-cyan-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bot Stop Confirmation Modal */}
                <AnimatePresence>
                    {showStopModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowStopModal(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="glass-card max-w-sm w-full p-8 relative z-10 text-center shadow-2xl border-white/20"
                            >
                                <div className="mx-auto w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mb-6">
                                    <AlertTriangle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-primary mb-2">
                                    {t.bot_stop_confirm_title}
                                </h3>
                                <div className="text-secondary mb-8">
                                    {t.bot_stop_confirm_desc}
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowStopModal(false)}
                                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-secondary bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        {t.cancel}
                                    </button>
                                    <button
                                        onClick={handleStopBot}
                                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-white bg-red-600 hover:bg-red-700 transition-colors"
                                    >
                                        {t.execute}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};
