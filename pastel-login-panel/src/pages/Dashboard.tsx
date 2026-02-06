import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Settings as SettingsIcon, Shield, Activity, Bell, Server, Users, MessageSquare, LogOut, Play, Square, AlertTriangle, Copy, Ban, UserX, CheckCircle, XCircle, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { translations } from '../utils/translations';
import { sanitizeUrl } from '../utils/security';
import { authenticatedFetch } from '../utils/api';

interface BanInfo {
    userId: string;
    username: string;
    displayName: string;
    avatar: string | null;
    guildId: string;
    guildName: string;
    timestamp: number;
}

interface SuspiciousBot {
    id: string;
    username: string;
    avatar: string | null;
    guildName: string;
    guildId: string;
    reason: string;
}

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

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
    <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        onClick={onClose}
        className={`fixed bottom-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold pointer-events-auto cursor-pointer ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
    >
        {type === 'success' ? <CheckCircle size={24} /> : <XCircle size={24} />}
        {message}
    </motion.div>
);

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Confirm", confirmColor = "red" }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onCancel}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="glass-card max-w-sm w-full p-8 relative z-10 text-center shadow-2xl border-white/20"
            >
                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 bg-${confirmColor}-500/20 text-${confirmColor}-500`}>
                    <AlertTriangle size={32} />
                </div>
                <h3 className="text-xl font-bold text-primary mb-2">{title}</h3>
                <p className="text-secondary mb-8 leading-relaxed">{message}</p>
                <div className="flex gap-3">
                    <button
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-secondary bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-colors bg-${confirmColor}-600 hover:bg-${confirmColor}-700`}
                    >
                        {confirmText}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

export const Dashboard: React.FC = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState<any>(null);
    const [botStats, setBotStats] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [blacklist, setBlacklist] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState<{ isOpen: boolean, type: 'stop' | 'blacklist' | 'remove_blacklist', data?: any } | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

    const fetchInitialData = async () => {
        try {
            const res = await authenticatedFetch('/api/handshake');
            if (!res.ok) {
                if (res.status === 401) navigate('/login');
                throw new Error('Failed to handshake');
            }
            const data = await res.json();
            setUserData({ user: data.user, guilds: data.userGuilds });
            setBotStats(data.botStats);
            setSettings(data.settings);

            // Fetch detailed blacklist
            const blRes = await authenticatedFetch('/api/blacklist');
            if (blRes.ok) {
                const blData = await blRes.json();
                setBlacklist(Array.isArray(blData) ? blData : []);
            }
        } catch (err) {
            console.error('Handshake error:', err);
        } finally {
            setLoading(false);
        }
    };

    const refreshBotStatus = async () => {
        try {
            const res = await authenticatedFetch('/api/bot/stats');
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

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const lang = settings?.language || 'ja';
    const t = translations[lang] || translations.ja;

    const handleLogout = () => { navigate('/login'); };

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    };

    const handleStartBot = async () => {
        try {
            const res = await authenticatedFetch('/api/bot/start', { method: 'POST' });
            if (res.ok) {
                const handshakeRes = await authenticatedFetch('/api/handshake');
                if (handshakeRes.ok) {
                    const data = await handshakeRes.json();
                    setBotStats(data.botStats);
                }
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handleConfirmAction = async () => {
        if (!modal) return;

        if (modal.type === 'stop') {
            try {
                const res = await authenticatedFetch('/api/bot/stop', { method: 'POST' });
                if (res.ok) {
                    setBotStats((prev: any) => ({ ...prev, status: 'offline' }));
                }
            } catch (error) {
                console.error(error);
            } finally {
                setModal(null);
            }
        } else if (modal.type === 'blacklist') {
            const userId = modal.data?.id;
            if (!userId) return;
            try {
                const res = await authenticatedFetch('/api/blacklist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                if (res.ok) {
                    const data = await res.json();
                    setBlacklist(data.blacklist);
                    showToast(t.blacklist_add_success);
                } else {
                    showToast(t.blacklist_add_fail, 'error');
                }
            } catch (e) {
                showToast(t.operation_failed, 'error');
            } finally {
                setModal(null);
            }
        } else if (modal.type === 'remove_blacklist') {
            const userId = modal.data?.id;
            if (!userId) return;
            try {
                const res = await authenticatedFetch(`/api/blacklist/${userId}`, { method: 'DELETE' });
                if (res.ok) {
                    const data = await res.json();
                    setBlacklist(data.blacklist);
                    showToast(t.blacklist_remove_success);
                } else {
                    showToast(t.blacklist_remove_fail, 'error');
                }
            } catch (e) {
                showToast(t.operation_failed, 'error');
            } finally {
                setModal(null);
            }
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
                        {botStats?.avatar ? (
                            <img
                                src={sanitizeUrl(botStats.avatar)}
                                alt="Logo"
                                className="w-8 h-8 rounded-full"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                                <Server size={18} />
                            </div>
                        )}
                    </div>
                    <span className="font-bold text-lg text-primary truncate max-w-[140px]">
                        {botStats?.name || "Bot Panel"}
                    </span>
                </div>

                <nav className="flex flex-col gap-2 flex-1">
                    <SidebarItem icon={LayoutDashboard} label={t.dashboard} active activeColor="purple" onClick={() => navigate('/dashboard')} />
                    <SidebarItem icon={Server} label={`${t.server_management} (${userData?.guilds?.length || 0})`} onClick={() => navigate('/servers')} />
                    <SidebarItem icon={Users} label={t.user_management} onClick={() => navigate('/users')} />
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
                                        onClick={() => setModal({ isOpen: true, type: 'stop' })}
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

                {/* Recent Bans & Suspicious Bots */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Recent Bans */}
                    <div className="glass-card p-7 shadow-2xl">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
                            <Ban className="text-red-500" />
                            {t.recent_bans}
                        </h3>
                        <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {botStats?.recentBans && botStats.recentBans.length > 0 ? (
                                botStats.recentBans.map((ban: BanInfo, i: number) => (
                                    <div key={i} className="flex items-center justify-between p-4 bg-red-500/5 border border-red-500/20 rounded-xl hover:bg-red-500/10 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-red-500/20 overflow-hidden flex items-center justify-center shrink-0">
                                                {ban.avatar ? (
                                                    <img src={sanitizeUrl(ban.avatar)} alt={ban.username} className="w-full h-full object-cover" />
                                                ) : (
                                                    <UserX className="text-red-500" size={20} />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold flex items-center gap-2 text-primary truncate">
                                                    {ban.displayName}
                                                    <span className="text-xs font-normal text-secondary bg-black/5 dark:bg-white/10 px-2 py-0.5 rounded truncate">@{ban.username}</span>
                                                </div>
                                                <div className="text-xs text-secondary mt-1 truncate">
                                                    {t.banned_from} <span className="font-medium text-primary">{ban.guildName}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(ban.userId);
                                                showToast(t.copy_id_success);
                                            }}
                                            className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-secondary hover:text-primary transition-colors shrink-0"
                                            title="Copy ID"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-secondary py-8 flex flex-col items-center gap-2">
                                    <Ban size={40} className="opacity-20" />
                                    <p>{t.no_bans}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Suspicious Bots & Blacklist Management */}
                    <div className="space-y-6">
                        {/* Suspicious Bots */}
                        <div className="glass-card p-7 shadow-2xl">
                            <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-primary">
                                <AlertTriangle className="text-yellow-500" />
                                {t.suspicious_bots}
                            </h3>
                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {botStats?.suspiciousBots && botStats.suspiciousBots.length > 0 ? (
                                    botStats.suspiciousBots.map((bot: SuspiciousBot, i: number) => (
                                        <div key={i} className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-xl">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center overflow-hidden shrink-0">
                                                        {bot.avatar ? (
                                                            <img src={sanitizeUrl(bot.avatar)} alt={bot.username} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <Server size={14} className="text-yellow-500" />
                                                        )}
                                                    </div>
                                                    <span className="font-bold text-primary">{bot.username}</span>
                                                </div>
                                                <button
                                                    className="px-3 py-1 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-colors border border-red-500/20"
                                                    onClick={() => setModal({
                                                        isOpen: true,
                                                        type: 'blacklist',
                                                        data: bot
                                                    })}
                                                >
                                                    {t.add_to_blacklist}
                                                </button>
                                            </div>
                                            <div className="text-xs text-secondary mt-2 pl-11">
                                                <div>Server: <span className="font-medium text-primary">{bot.guildName}</span></div>
                                                <div className="text-yellow-600 dark:text-yellow-400 mt-1">{t.reason} {bot.reason}</div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center text-secondary py-8 flex flex-col items-center gap-2">
                                        <Shield size={40} className="opacity-20" />
                                        <p>{t.no_suspicious}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Global Blacklist Management */}
                        <div className="glass-card p-7 shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-bold flex items-center gap-2 text-primary">
                                    <Shield className="text-red-500" />
                                    {t.global_blacklist}
                                </h3>
                                <div className="px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-xs font-bold">
                                    {blacklist.length}
                                </div>
                            </div>

                            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {blacklist.length > 0 ? (
                                    blacklist.map((user: any) => {
                                        if (!user || !user.id) return null;
                                        return (
                                            <div key={user.id} className="flex items-center justify-between p-4 bg-white dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 hover:border-red-500/30 transition-all shadow-sm">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center overflow-hidden shrink-0">
                                                        {user.avatar ? (
                                                            <img src={sanitizeUrl(user.avatar)} alt={user.username} className="w-full h-full object-cover" />
                                                        ) : (
                                                            <div className="text-red-500 font-bold text-lg">
                                                                {user.username?.charAt(0) || '?'}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="font-bold text-primary truncate flex items-center gap-2">
                                                            {user.displayName || user.username}
                                                            <span className="text-[10px] font-normal text-secondary bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">@{user.username}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 mt-0.5">
                                                            <span className="font-mono text-[10px] text-secondary">{user.id}</span>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(user.id);
                                                                    showToast(t.copy_id_success);
                                                                }}
                                                                className="text-secondary hover:text-primary transition-colors"
                                                            >
                                                                <Copy size={10} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setModal({
                                                        isOpen: true,
                                                        type: 'remove_blacklist',
                                                        data: user
                                                    })}
                                                    className="p-2 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Remove"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center text-secondary py-8 flex flex-col items-center gap-2">
                                        <Shield size={40} className="opacity-20" />
                                        <p>{t.no_bans}</p>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => navigate('/users')}
                                className="w-full mt-6 py-3 rounded-xl border border-dashed border-black/10 dark:border-white/10 text-secondary hover:text-primary hover:bg-white/5 transition-all text-sm font-medium"
                            >
                                {t.user_management}で詳細設定
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Modal */}
            <AnimatePresence>
                {modal && (
                    <ConfirmModal
                        isOpen={!!modal}
                        title={
                            modal.type === 'stop' ? t.bot_stop_confirm_title :
                                modal.type === 'remove_blacklist' ? t.confirm_blacklist_remove_title :
                                    'Add to Blacklist?'
                        }
                        message={
                            modal.type === 'stop' ? t.bot_stop_confirm_desc :
                                modal.type === 'remove_blacklist' ? (t.confirm_blacklist_remove_msg || '').replace('{user}', modal.data?.username || modal.data?.id) :
                                    `Are you sure you want to ban ${modal.data?.username} (${modal.data?.id}) globally?`
                        }
                        confirmText={
                            modal.type === 'stop' ? t.execute :
                                modal.type === 'remove_blacklist' ? t.confirm_blacklist_remove_btn :
                                    t.add_to_blacklist
                        }
                        confirmColor="red"
                        onConfirm={handleConfirmAction}
                        onCancel={() => setModal(null)}
                    />
                )}
                {toast && (
                    <Toast
                        message={toast.message}
                        type={toast.type}
                        onClose={() => setToast(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};
