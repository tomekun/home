import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, Settings as SettingsIcon, Shield, Activity, Bell, Server, Users, MessageSquare, LogOut, Trash2, Plus, Copy, CheckCircle, XCircle, AlertTriangle, Code } from 'lucide-react';
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
        {type === 'success' ? <CheckCircle size={24} /> : <XCircle size={24} />}
        {message}
    </motion.div>
);

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, confirmText, confirmColor = "red" }: any) => {
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

export const UsersPage: React.FC = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState<any>(null);
    const [botStats, setBotStats] = useState<any>(null);
    const [settings, setSettings] = useState<any>({ theme: 'light', language: 'ja' });
    const [blacklist, setBlacklist] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
    const [modal, setModal] = useState<{ isOpen: boolean, type: 'add' | 'remove', userId: string } | null>(null);

    const fetchInitialData = async () => {
        try {
            // Handshake for basic user/bot data
            const res = await authenticatedFetch('/api/handshake');
            if (!res.ok) {
                if (res.status === 401) navigate('/login');
                throw new Error('Failed to handshake');
            }
            const data = await res.json();
            setUserData({ user: data.user, guilds: data.userGuilds });
            setBotStats(data.botStats);
            setSettings(data.settings);

            // Get detailed blacklist separately
            const blRes = await authenticatedFetch('/api/blacklist');
            if (blRes.ok) {
                const blData = await blRes.json();
                setBlacklist(Array.isArray(blData) ? blData : []);
            } else {
                // Fallback to handshake blacklist (IDs only) if API fails
                setBlacklist((data.blacklist || []).map((id: string) => ({ id, username: 'Unknown', displayName: 'ID Only', avatar: null })));
            }
        } catch (err) {
            console.error('Handshake error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInitialData();
    }, [navigate]);

    useEffect(() => {
        if (settings?.theme) {
            if (settings.theme === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }
    }, [settings?.theme]);

    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    const handleLogout = () => { navigate('/login'); };
    const lang = settings?.language || 'ja';
    const t = translations[lang] || translations.ja;

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
    };

    const confirmAction = async () => {
        if (!modal) return;
        const { type, userId } = modal;

        try {
            if (type === 'add') {
                const res = await authenticatedFetch('/api/blacklist', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                if (res.ok) {
                    const data = await res.json();
                    setBlacklist(data.blacklist);
                    const input = document.getElementById('blacklist-input-page') as HTMLInputElement;
                    if (input) input.value = '';
                    showToast(t.blacklist_add_success || 'Added to blacklist');
                } else {
                    showToast(t.blacklist_add_fail || 'Failed to add', 'error');
                }
            } else if (type === 'remove') {
                const res = await authenticatedFetch(`/api/blacklist/${userId}`, { method: 'DELETE' });
                if (res.ok) {
                    const data = await res.json();
                    setBlacklist(data.blacklist);
                    showToast(t.blacklist_remove_success);
                } else {
                    showToast(t.blacklist_remove_fail, 'error');
                }
            }
        } catch (e) {
            showToast(t.operation_failed, 'error');
        } finally {
            setModal(null);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        showToast(t.copy_id_success || 'Copied to clipboard!');
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
                    <SidebarItem icon={LayoutDashboard} label={t.dashboard} onClick={() => navigate('/dashboard')} />
                    <SidebarItem icon={Server} label={`${t.server_management} (${userData?.guilds?.length || 0})`} onClick={() => navigate('/servers')} />
                    <SidebarItem icon={Users} label={t.user_management} active activeColor="purple" />
                    <SidebarItem icon={MessageSquare} label={t.auto_response} />
                    <SidebarItem icon={Shield} label={t.security} />
                    <SidebarItem icon={Activity} label={t.stats} />
                    <SidebarItem icon={Bell} label={t.notifications} />
                    <div className="my-4 h-[1px] bg-black/5 dark:bg-white/10" />
                    <SidebarItem icon={SettingsIcon} label={t.settings} onClick={() => navigate('/settings')} />
                    {settings?.isDevModeEnabled && (
                        <SidebarItem icon={Code} label={t.developer_settings} onClick={() => navigate('/dev-settings')} activeColor="blue" />
                    )}
                </nav>

                <div className="mt-auto">
                    <SidebarItem icon={LogOut} label={t.logout} onClick={handleLogout} activeColor="red" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                <div className="mesh-background" />
                <header className="flex justify-between items-center mb-10 relative z-10">
                    <div>
                        <h2 className="text-2xl font-bold mb-1 text-primary flex items-center gap-2">
                            <Users />
                            {t.user_management}
                        </h2>
                        <p className="text-secondary font-medium">Manage users and global blacklists</p>
                    </div>
                </header>

                <div className="max-w-4xl mx-auto relative z-10">
                    {/* Blacklist Management */}
                    <div className="glass-card p-8 shadow-2xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 rounded-full bg-red-500/10 text-red-500">
                                <Shield size={24} />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-primary">{t.global_blacklist}</h3>
                                <p className="text-sm text-secondary">Manage users banned from all bot-managed servers</p>
                            </div>
                        </div>

                        <div className="bg-black/5 dark:bg-white/5 rounded-2xl p-6 mb-8 border border-black/5 dark:border-white/5">
                            <label className="text-xs font-bold text-secondary uppercase tracking-wider mb-2 block">
                                Add New User to Blacklist
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder={t.user_id_placeholder}
                                    className="flex-1 bg-white dark:bg-black/20 border border-black/10 dark:border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition-all text-primary"
                                    id="blacklist-input-page"
                                />
                                <button
                                    onClick={() => {
                                        const input = document.getElementById('blacklist-input-page') as HTMLInputElement;
                                        const id = input.value.trim();
                                        if (id) setModal({ isOpen: true, type: 'add', userId: id });
                                    }}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-red-500/20 flex items-center gap-2"
                                >
                                    <Plus size={18} />
                                    {t.add_to_blacklist}
                                </button>
                            </div>
                            <p className="text-xs text-secondary mt-3">
                                {t.blacklist_desc}
                            </p>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-4">
                                <h4 className="font-bold text-primary flex items-center gap-2">
                                    Blacklisted Users
                                    <span className="px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/10 text-xs">
                                        {blacklist.length}
                                    </span>
                                </h4>
                            </div>

                            {blacklist.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    <AnimatePresence>
                                        {blacklist.map((user: any) => {
                                            if (!user || user.id === '' || user.id === null || user.id === undefined) return null;
                                            return (
                                                <motion.div
                                                    key={user.id}
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.9 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.9 }}
                                                    className="flex justify-between items-center p-4 bg-white dark:bg-black/20 rounded-xl border border-black/5 dark:border-white/5 group hover:border-red-500/30 transition-all shadow-sm"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        {user.avatar ? (
                                                            <img src={sanitizeUrl(user.avatar)} alt={user.username} className="w-10 h-10 rounded-full bg-black/10" />
                                                        ) : (
                                                            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 font-bold text-lg">
                                                                {user.username?.charAt(0) || '?'}
                                                            </div>
                                                        )}

                                                        <div>
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-primary block">{user.displayName || user.username}</span>
                                                                <span className="text-xs text-secondary bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded">{user.username}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="font-mono text-xs text-secondary">{user.id}</span>
                                                                <button
                                                                    onClick={() => copyToClipboard(user.id)}
                                                                    className="text-secondary hover:text-primary transition-colors p-1"
                                                                    title="Copy ID"
                                                                >
                                                                    <Copy size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => setModal({ isOpen: true, type: 'remove', userId: user.id })}
                                                        className="flex items-center gap-2 px-3 py-1.5 text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
                                                    >
                                                        <Trash2 size={16} />
                                                        Remove
                                                    </button>
                                                </motion.div>
                                            );
                                        })}
                                    </AnimatePresence>
                                </div>
                            ) : (
                                <div className="text-center py-12 text-secondary bg-black/5 dark:bg-white/5 rounded-xl border border-dashed border-black/10 dark:border-white/10">
                                    <Shield size={32} className="mx-auto mb-2 opacity-20" />
                                    No users in global blacklist
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <AnimatePresence>
                {/* Custom Modal */}
                {modal && (
                    <ConfirmModal
                        isOpen={!!modal}
                        title={modal.type === 'add' ? t.confirm_blacklist_add_title : t.confirm_blacklist_remove_title}
                        message={modal.type === 'add'
                            ? (t.confirm_blacklist_add_msg || '').replace('{user}', modal.userId)
                            : (t.confirm_blacklist_remove_msg || '').replace('{user}', modal.userId)}
                        confirmText={modal.type === 'add' ? t.confirm_blacklist_add_btn : t.confirm_blacklist_remove_btn}
                        confirmColor="red"
                        onConfirm={confirmAction}
                        onCancel={() => setModal(null)}
                    />
                )}
                {/* Toast Notification */}
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
