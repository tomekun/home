import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Settings as SettingsIcon, Shield, Activity, Bell, Server, Users, MessageSquare, LogOut, CheckCircle, Save, Languages, SortAsc, RefreshCw, GripVertical, Sun, Moon, Code } from 'lucide-react';
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

export const Settings: React.FC = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState<any>(null);
    const [botStats, setBotStats] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [savedNotice, setSavedNotice] = useState(false);

    const fetchAllData = async () => {
        try {
            const res = await authenticatedFetch('http://localhost:3001/api/handshake');
            const data = await res.json();
            if (data.error === 'Unauthorized') {
                navigate('/login');
                return;
            }
            setUserData({ user: data.user, guilds: data.userGuilds });
            setBotStats(data.botStats);
            setSettings(data.settings);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    useEffect(() => {
        if (settings?.theme) {
            if (settings.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [settings?.theme]);

    const lang = settings?.language || 'ja';
    const t = translations[lang] || translations.ja;

    const handleSave = async () => {
        setSaving(true);
        try {
            await authenticatedFetch('http://localhost:3001/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            setSavedNotice(true);
            setTimeout(() => setSavedNotice(false), 3000);
        } catch (error) {
            console.error(error);
        } finally {
            setSaving(false);
        }
    };

    const updateSettings = (key: string, value: any) => {
        setSettings({ ...settings, [key]: value });
    };

    const updateFurigana = (guildId: string, value: string) => {
        setSettings({
            ...settings,
            furigana: { ...settings.furigana, [guildId]: value }
        });
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
                            <img src={sanitizeUrl(botStats.avatar)} alt="Logo" className="w-8 h-8 rounded-full" />
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
                    <SidebarItem icon={LayoutDashboard} label={t.dashboard} onClick={() => navigate('/dashboard')} />
                    <SidebarItem icon={Server} label={t.server_management} onClick={() => navigate('/servers')} />
                    <SidebarItem icon={Users} label={t.user_management} onClick={() => navigate('/users')} />
                    <SidebarItem icon={MessageSquare} label={t.auto_response} />
                    <SidebarItem icon={Shield} label={t.security} />
                    <SidebarItem icon={Activity} label={t.stats} />
                    <SidebarItem icon={Bell} label={t.notifications} />
                    <div className="my-4 h-[1px] bg-black/5 dark:bg-white/10" />
                    <SidebarItem icon={SettingsIcon} label={t.settings} active activeColor="purple" />
                </nav>

                <div className="mt-auto">
                    <SidebarItem icon={LogOut} label={t.logout} onClick={() => navigate('/login')} activeColor="red" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                <div className="mesh-background" />
                <header className="mb-10 relative z-10 flex justify-between items-end">
                    <div>
                        <h2 className="text-3xl font-bold mb-2 text-primary">{t.settings}</h2>
                        <p className="text-secondary font-medium">{t.general_settings}</p>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-purple-500/20 transition-all active:scale-95"
                    >
                        {saving ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                        {t.save_settings}
                    </button>
                </header>

                <div className="max-w-4xl space-y-8 relative z-10">
                    <div className="glass-card p-8 shadow-2xl space-y-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Language Selection */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-primary">
                                    <Languages size={18} className="text-purple-500" />
                                    {t.language}
                                </label>
                                <select
                                    value={settings.language}
                                    onChange={(e) => updateSettings('language', e.target.value)}
                                    className="w-full bg-white/50 dark:bg-black/40 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 text-primary focus:ring-2 focus:ring-purple-500 outline-none transition-all cursor-pointer"
                                >
                                    <option value="ja" className="bg-white dark:bg-slate-900">日本語 (Japanese)</option>
                                    <option value="en" className="bg-white dark:bg-slate-900">English</option>
                                </select>
                            </div>

                            {/* Custom Sort Toggle */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-primary">
                                    <GripVertical size={18} className="text-purple-500" />
                                    {t.custom_sort}
                                </label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => updateSettings('isCustomSortEnabled', true)}
                                        className={`flex-1 py-3 rounded-xl border font-bold transition-all ${settings.isCustomSortEnabled ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        {t.enabled}
                                    </button>
                                    <button
                                        onClick={() => updateSettings('isCustomSortEnabled', false)}
                                        className={`flex-1 py-3 rounded-xl border font-bold transition-all ${!settings.isCustomSortEnabled ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        {t.disabled}
                                    </button>
                                </div>
                                <p className="text-xs text-secondary leading-relaxed">{t.custom_sort_desc}</p>
                            </div>

                            {/* Furigana Sort Toggle */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-primary">
                                    <SortAsc size={18} className="text-purple-500" />
                                    {t.furigana_sort}
                                </label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => updateSettings('isFuriganaEnabled', true)}
                                        className={`flex-1 py-3 rounded-xl border font-bold transition-all ${settings.isFuriganaEnabled ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        {t.enabled}
                                    </button>
                                    <button
                                        onClick={() => updateSettings('isFuriganaEnabled', false)}
                                        className={`flex-1 py-3 rounded-xl border font-bold transition-all ${!settings.isFuriganaEnabled ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        {t.disabled}
                                    </button>
                                </div>
                                <p className="text-xs text-secondary leading-relaxed">{t.furigana_sort_desc}</p>
                            </div>

                            {/* Theme Selection */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-primary">
                                    {settings.theme === 'dark' ? <Moon size={18} className="text-purple-500" /> : <Sun size={18} className="text-amber-500" />}
                                    {t.theme}
                                </label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => updateSettings('theme', 'light')}
                                        className={`flex-1 py-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${settings.theme !== 'dark' ? 'bg-amber-500 text-white border-amber-400 shadow-lg shadow-amber-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        <Sun size={18} />
                                        {t.light}
                                    </button>
                                    <button
                                        onClick={() => updateSettings('theme', 'dark')}
                                        className={`flex-1 py-3 rounded-xl border font-bold flex items-center justify-center gap-2 transition-all ${settings.theme === 'dark' ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        <Moon size={18} />
                                        {t.dark}
                                    </button>
                                </div>
                            </div>

                            {/* Developer Options Toggle */}
                            <div className="space-y-4">
                                <label className="flex items-center gap-2 text-sm font-bold text-primary">
                                    <Code size={18} className="text-purple-500" />
                                    {t.developer_options}
                                </label>
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => updateSettings('isDevModeEnabled', true)}
                                        className={`flex-1 py-3 rounded-xl border font-bold transition-all ${settings.isDevModeEnabled ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        {t.enabled}
                                    </button>
                                    <button
                                        onClick={() => updateSettings('isDevModeEnabled', false)}
                                        className={`flex-1 py-3 rounded-xl border font-bold transition-all ${!settings.isDevModeEnabled ? 'bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/20' : 'bg-white/5 dark:bg-black/20 text-secondary border-transparent hover:bg-white/10'}`}
                                    >
                                        {t.disabled}
                                    </button>
                                </div>
                                <p className="text-xs text-secondary leading-relaxed">{t.developer_mode_desc}</p>
                            </div>
                        </div>
                    </div>

                    {/* Furigana Settings */}
                    <AnimatePresence>
                        {settings.isFuriganaEnabled && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <h3 className="text-xl font-bold mb-6 text-primary flex items-center gap-3">
                                    <SortAsc className="text-purple-500" />
                                    {t.furigana_settings}
                                </h3>
                                <div className="glass-card p-6 shadow-xl mb-4 bg-blue-500/5 border-blue-500/10">
                                    <p className="text-sm text-secondary leading-relaxed">{t.furigana_desc}</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                                    {userData?.guilds?.filter((g: any) => g.owner || (parseInt(g.permissions) & 0x8) === 0x8).map((guild: any) => (
                                        <div key={guild.id} className="glass-card p-4 flex items-center gap-4 group hover:border-purple-500/30 transition-all">
                                            {guild.icon ? (
                                                <img src={sanitizeUrl(`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`)} className="w-10 h-10 rounded-lg" alt="" />
                                            ) : (
                                                <div className="w-10 h-10 rounded-lg bg-slate-500 flex items-center justify-center text-white font-bold">{guild.name.charAt(0)}</div>
                                            )}
                                            <div className="flex-1 space-y-1">
                                                <p className="text-xs font-bold text-primary truncate">{guild.name}</p>
                                                <input
                                                    type="text"
                                                    value={settings.furigana?.[guild.id] || ''}
                                                    onChange={(e) => updateFurigana(guild.id, e.target.value)}
                                                    placeholder={t.furigana_placeholder}
                                                    className="w-full bg-black/5 dark:bg-black/20 border border-transparent focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-primary outline-none transition-all font-medium"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <AnimatePresence>
                    {savedNotice && (
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 50 }}
                            className="fixed bottom-10 right-10 z-50 bg-green-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-3 font-bold"
                        >
                            <CheckCircle />
                            {t.settings_saved_toast}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
};
