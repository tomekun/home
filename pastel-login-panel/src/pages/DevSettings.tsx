import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings as SettingsIcon, Server, Users, MessageSquare, Shield, Activity, Bell, LogOut, Terminal, Plus, Trash2, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

const Toast = ({ message, type, onClose }: { message: string, type: 'success' | 'error', onClose: () => void }) => (
    <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        onClick={onClose}
        className={`fixed bottom-10 right-10 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold pointer-events-auto cursor-pointer ${type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}
    >
        {message}
    </motion.div>
);

export const DevSettings: React.FC = () => {
    const navigate = useNavigate();
    const [botStats, setBotStats] = useState<any>(null);
    const [settings, setSettings] = useState<any>({ theme: 'light', language: 'ja' });

    useEffect(() => {
        if (settings?.theme) {
            if (settings.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [settings?.theme]);
    const [bots, setBots] = useState<any[]>([]);
    const [activeBotId, setActiveBotId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [adding, setAdding] = useState(false);
    const [switching, setSwitching] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [devSettings, setDevSettings] = useState({ isBlacklistShared: true, isRecentBansShared: true });

    const [newToken, setNewToken] = useState('');
    const [newClientId, setNewClientId] = useState('');
    const [newSecretId, setNewSecretId] = useState('');

    const fetchInitialData = async () => {
        try {
            const res = await authenticatedFetch('/api/handshake');
            if (res.ok) {
                const data = await res.json();
                setBotStats(data.botStats);
                setSettings(data.settings);
                if (!data.settings.isDevModeEnabled) navigate('/dashboard');
            }

            const botsRes = await authenticatedFetch('/api/dev/bots');
            if (botsRes.ok) {
                const botsData = await botsRes.json();
                setBots(botsData.bots);
                setActiveBotId(botsData.activeBotId);
            }

            const devSettingsRes = await authenticatedFetch('/api/dev/settings');
            if (devSettingsRes.ok) {
                const devData = await devSettingsRes.json();
                setDevSettings(devData);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, []);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    };

    const handleAddBot = async (e: React.FormEvent) => {
        e.preventDefault();
        setAdding(true);
        setErrorMsg(null);
        try {
            const res = await authenticatedFetch('/api/dev/bots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: newToken, clientId: newClientId, secretId: newSecretId })
            });
            const data = await res.json();
            if (res.ok) {
                setBots([...bots.filter(b => b.clientId !== newClientId), data.bot]);
                setNewToken('');
                setNewClientId('');
                setNewSecretId('');
                showToast(t.bot_add_success);
            } else {
                setErrorMsg(data.message || data.error);
            }
        } catch (e) {
            setErrorMsg('Failed to add bot');
        } finally {
            setAdding(false);
        }
    };

    const handleRemoveBot = async (id: string) => {
        try {
            const res = await authenticatedFetch(`/api/dev/bots/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setBots(bots.filter(b => b.clientId !== id));
                if (activeBotId === id) setActiveBotId(null);
                showToast(t.bot_remove_success);
            }
        } catch (e) {
            showToast(t.operation_failed, 'error');
        }
    };

    const handleSwitchBot = async (id: string) => {
        setSwitching(id);
        try {
            const res = await authenticatedFetch('/api/dev/bots/switch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: id })
            });
            if (res.ok) {
                setActiveBotId(id);
                showToast(t.bot_switch_success);
                // Refresh status
                const hsRes = await authenticatedFetch('/api/handshake');
                if (hsRes.ok) {
                    const hsData = await hsRes.json();
                    setBotStats(hsData.botStats);
                }
            }
        } catch (e) {
            showToast(t.operation_failed, 'error');
        } finally {
            setSwitching(null);
        }
    };

    const updateDevSetting = async (key: string, value: boolean) => {
        const newSettings = { ...devSettings, [key]: value };
        setDevSettings(newSettings);
        try {
            await authenticatedFetch('/api/dev/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
            showToast(t.settings_saved_toast);
        } catch (e) {
            showToast(t.operation_failed, 'error');
        }
    };

    const lang = settings?.language || 'ja';
    const t = translations[lang] || translations.ja;

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
                            <img src={sanitizeUrl(botStats.avatar)} alt="Bot Avatar" className="w-8 h-8 rounded-full" />
                        ) : (
                            <Terminal size={18} className="text-purple-500" />
                        )}
                    </div>
                    <span className="font-bold text-lg text-primary truncate">
                        {botStats?.name || "Bot Panel"}
                    </span>
                </div>

                <nav className="flex flex-col gap-2 flex-1">
                    <SidebarItem icon={LayoutDashboard} label={t.dashboard} onClick={() => navigate('/dashboard')} />
                    <SidebarItem icon={Server} label={t.server_management} onClick={() => navigate('/servers')} />
                    <SidebarItem icon={Users} label={t.user_management} onClick={() => navigate('/users')} />
                    <SidebarItem icon={MessageSquare} label={t.auto_response} />
                    <SidebarItem icon={Shield} label={t.security} />
                    <SidebarItem icon={Activity} label={t.stats} />
                    <SidebarItem icon={Bell} label={t.notifications} />
                    <div className="my-4 h-[1px] bg-black/5 dark:bg-white/10" />
                    <SidebarItem icon={SettingsIcon} label={t.settings} onClick={() => navigate('/settings')} />
                    <SidebarItem icon={Terminal} label={t.developer_settings} active activeColor="blue" />
                </nav>

                <div className="mt-auto">
                    <SidebarItem icon={LogOut} label={t.logout} onClick={() => navigate('/login')} activeColor="red" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                <div className="mesh-background" />
                <header className="flex justify-between items-center mb-10 relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold mb-1 text-primary flex items-center gap-2">
                            <Terminal />
                            {t.developer_settings}
                        </h2>
                        <p className="text-secondary font-medium">Manage multiple bot accounts and switching</p>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto space-y-8 relative z-10">
                    {/* Add Bot Form */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-full bg-blue-500/10 text-blue-500">
                                <Plus size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-primary">{t.add_bot}</h3>
                        </div>

                        <form onSubmit={handleAddBot} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider">{t.bot_token}</label>
                                    <input
                                        type="password"
                                        value={newToken}
                                        onChange={(e) => setNewToken(e.target.value)}
                                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-primary"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-secondary uppercase tracking-wider">{t.bot_client_id}</label>
                                    <input
                                        type="text"
                                        value={newClientId}
                                        onChange={(e) => setNewClientId(e.target.value)}
                                        className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-primary"
                                        required
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-secondary uppercase tracking-wider">{t.bot_secret_id}</label>
                                <input
                                    type="password"
                                    value={newSecretId}
                                    onChange={(e) => setNewSecretId(e.target.value)}
                                    className="w-full bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500 transition-all text-primary"
                                />
                            </div>

                            <AnimatePresence>
                                {errorMsg && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 text-red-500 text-sm font-medium">
                                        <AlertCircle size={16} />
                                        {errorMsg}
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <button
                                type="submit"
                                disabled={adding}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {adding ? <RefreshCw className="animate-spin" /> : <Plus size={20} />}
                                {t.add_bot}
                            </button>
                        </form>
                    </motion.div>

                    {/* Data Sharing Settings */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-3 rounded-full bg-amber-500/10 text-amber-500">
                                <Shield size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-primary">Data Scope Settings</h3>
                        </div>
                        <p className="text-secondary text-sm mb-6 ml-12">{t.dev_settings_desc}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Blacklist Toggle */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-primary flex items-center gap-2">
                                    <Shield size={16} className="text-purple-500" />
                                    {t.shared_blacklist}
                                </label>
                                <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                                    <button
                                        onClick={() => updateDevSetting('isBlacklistShared', true)}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${devSettings.isBlacklistShared ? 'bg-white dark:bg-white/10 shadow-sm text-primary' : 'text-secondary opacity-60'}`}
                                    >
                                        {t.shared}
                                    </button>
                                    <button
                                        onClick={() => updateDevSetting('isBlacklistShared', false)}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!devSettings.isBlacklistShared ? 'bg-white dark:bg-white/10 shadow-sm text-primary' : 'text-secondary opacity-60'}`}
                                    >
                                        {t.individual}
                                    </button>
                                </div>
                            </div>

                            {/* Auto-Ban Toggle */}
                            <div className="space-y-4">
                                <label className="text-sm font-bold text-primary flex items-center gap-2">
                                    <Activity size={16} className="text-blue-500" />
                                    {t.shared_autoban}
                                </label>
                                <div className="flex p-1 bg-black/5 dark:bg-white/5 rounded-xl border border-black/5 dark:border-white/5">
                                    <button
                                        onClick={() => updateDevSetting('isRecentBansShared', true)}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${devSettings.isRecentBansShared ? 'bg-white dark:bg-white/10 shadow-sm text-primary' : 'text-secondary opacity-60'}`}
                                    >
                                        {t.shared}
                                    </button>
                                    <button
                                        onClick={() => updateDevSetting('isRecentBansShared', false)}
                                        className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${!devSettings.isRecentBansShared ? 'bg-white dark:bg-white/10 shadow-sm text-primary' : 'text-secondary opacity-60'}`}
                                    >
                                        {t.individual}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Bot List */}
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-full bg-purple-500/10 text-purple-500">
                                <Terminal size={24} />
                            </div>
                            <h3 className="text-xl font-bold text-primary">{t.bot_list}</h3>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {bots.length > 0 ? bots.map((bot) => (
                                <div key={bot.clientId} className={`flex items-center justify-between p-5 rounded-2xl border transition-all ${activeBotId === bot.clientId ? 'bg-blue-600/10 border-blue-500/30' : 'bg-black/5 dark:bg-white/5 border-black/5 dark:border-white/5'}`}>
                                    <div className="flex items-center gap-4">
                                        {bot.avatar ? (
                                            <img src={sanitizeUrl(bot.avatar)} alt={bot.name} className="w-12 h-12 rounded-full border-2 border-white/10" />
                                        ) : (
                                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center font-bold text-xl text-primary">
                                                {bot.name?.charAt(0)}
                                            </div>
                                        )}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-bold text-primary text-lg">{bot.name}</h4>
                                                {activeBotId === bot.clientId && (
                                                    <span className="px-2 py-0.5 rounded-full bg-green-500/20 text-green-500 text-[10px] font-bold uppercase tracking-wider">Active</span>
                                                )}
                                            </div>
                                            <p className="text-secondary text-sm font-mono opacity-60">{bot.clientId}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleSwitchBot(bot.clientId)}
                                            disabled={activeBotId === bot.clientId || switching !== null}
                                            className={`px-4 py-2 rounded-xl font-bold transition-all flex items-center gap-2 ${activeBotId === bot.clientId ? 'bg-green-500 text-white cursor-default' : 'bg-white/10 hover:bg-white/20 text-primary'}`}
                                        >
                                            {switching === bot.clientId ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                                            {t.switch_bot}
                                        </button>
                                        <button
                                            onClick={() => handleRemoveBot(bot.clientId)}
                                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-all"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-12 text-secondary opacity-50 border-2 border-dashed border-white/5 rounded-2xl">
                                    No bots added yet.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            </main>

            {/* Toast Notification */}
            <AnimatePresence>
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
