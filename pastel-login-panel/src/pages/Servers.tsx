import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Settings as SettingsIcon, Shield, Activity, Bell, Server, Users, MessageSquare, LogOut, ExternalLink, Trash2, AlertTriangle, SortAsc, SortDesc, Clock, Calendar, ChevronUp, ChevronDown, GripVertical, Save, Info } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { translations } from '../utils/translations';

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

type SortOption = 'join' | 'creation' | 'alphabetical' | 'custom';
type SortOrder = 'asc' | 'desc';

export const Servers: React.FC = () => {
    const navigate = useNavigate();
    const [userData, setUserData] = useState<any>(null);
    const [botStats, setBotStats] = useState<any>(null);
    const [settings, setSettings] = useState<any>(null);
    const [botGuilds, setBotGuilds] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [sortBy, setSortBy] = useState<SortOption>('join');
    const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
    const [showModal, setShowModal] = useState<{ type: 'invite' | 'kick' | 'save_confirm', guild?: any } | null>(null);
    const [customOrderList, setCustomOrderList] = useState<any[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [pendingNavigate, setPendingNavigate] = useState<string | null>(null);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

    const fetchAllData = async () => {
        try {
            const res = await fetch('http://localhost:3001/api/handshake', { credentials: 'include' });
            const data = await res.json();

            if (data.error === 'Unauthorized') {
                navigate('/login');
                return;
            }

            setUserData({ user: data.user, guilds: data.userGuilds });
            setBotGuilds(data.botGuilds);
            setBotStats(data.botStats);
            setSettings(data.settings);

            if (data.settings.isCustomSortEnabled) {
                setSortBy('custom');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const lang = settings?.language || 'ja';
    const t = translations[lang] || translations.ja;

    const hasPermission = (guild: any) => {
        const ADMIN_PERMISSION = 0x8;
        return guild.owner || (parseInt(guild.permissions) & ADMIN_PERMISSION) === ADMIN_PERMISSION;
    };

    const adminGuilds = useMemo(() => {
        if (!userData?.guilds) return [];
        return userData.guilds.filter(hasPermission);
    }, [userData]);

    useEffect(() => {
        if (!loading && adminGuilds.length > 0 && settings) {
            let list = [...adminGuilds];
            if (settings.customOrder && settings.customOrder.length > 0) {
                list.sort((a, b) => {
                    const idxA = settings.customOrder.indexOf(a.id);
                    const idxB = settings.customOrder.indexOf(b.id);
                    if (idxA === -1 && idxB === -1) return 0;
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            }
            setCustomOrderList(list);
        }
    }, [loading, adminGuilds, settings]);

    const handleSort = (option: SortOption) => {
        if (sortBy === option) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(option);
            setSortOrder('asc');
        }
    };

    const onDragStart = (e: React.DragEvent, index: number) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const onDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedIndex === null || draggedIndex === index) return;

        const newList = [...customOrderList];
        const draggedItem = newList[draggedIndex];
        newList.splice(draggedIndex, 1);
        newList.splice(index, 0, draggedItem);

        setDraggedIndex(index);
        setCustomOrderList(newList);
        setIsDirty(true);
    };

    const onDragEnd = () => {
        setDraggedIndex(null);
    };

    const finalGuilds = useMemo(() => {
        if (sortBy === 'custom') return customOrderList;

        let result = [...adminGuilds];
        if (sortBy === 'creation') {
            result.sort((a, b) => {
                const idA = BigInt(a.id);
                const idB = BigInt(b.id);
                return idA < idB ? -1 : idA > idB ? 1 : 0;
            });
        } else if (sortBy === 'alphabetical') {
            result.sort((a, b) => {
                const nameA = (settings?.isFuriganaEnabled !== false && settings?.furigana?.[a.id]) || a.name;
                const nameB = (settings?.isFuriganaEnabled !== false && settings?.furigana?.[b.id]) || b.name;
                return nameA.localeCompare(nameB, 'ja', { numeric: true, sensitivity: 'base' });
            });
        }

        if (sortOrder === 'desc') {
            result.reverse();
        }
        return result;
    }, [adminGuilds, sortBy, sortOrder, customOrderList, settings]);

    const saveOrder = async () => {
        const newOrder = customOrderList.map(g => g.id);
        const prevLoading = loading;
        setLoading(true);
        try {
            await fetch('http://localhost:3001/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...settings, customOrder: newOrder }),
                credentials: 'include'
            });
            setIsDirty(false);
            setSettings({ ...settings, customOrder: newOrder });
            if (pendingNavigate) navigate(pendingNavigate);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(prevLoading);
            setShowModal(null);
        }
    };

    const tryNavigate = (path: string) => {
        if (isDirty) {
            setPendingNavigate(path);
            setShowModal({ type: 'save_confirm' });
        } else {
            navigate(path);
        }
    };

    const handleConfirm = async () => {
        if (!showModal) return;

        if (showModal.type === 'invite') {
            const clientId = '1468812333492211954';
            const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=8&scope=bot%20applications.commands&guild_id=${showModal.guild.id}&disable_guild_select=true`;
            window.open(inviteUrl, '_blank');
            setShowModal(null);
        } else if (showModal.type === 'kick') {
            await fetch(`http://localhost:3001/api/guilds/${showModal.guild.id}/leave`, {
                method: 'POST',
                credentials: 'include'
            });
            await fetchAllData();
            setShowModal(null);
        } else if (showModal.type === 'save_confirm') {
            saveOrder();
        }
    };

    if (loading && !isDirty) {
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
                            src={botStats?.avatar || ""}
                            alt="Logo"
                            className="w-8 h-8 rounded-full"
                        />
                    </div>
                    <span className="font-bold text-lg text-primary truncate max-w-[140px]">
                        {botStats?.name || "Bot Panel"}
                    </span>
                </div>

                <nav className="flex flex-col gap-2 flex-1">
                    <SidebarItem icon={LayoutDashboard} label={t.dashboard} onClick={() => tryNavigate('/dashboard')} />
                    <SidebarItem icon={Server} label={t.server_management} active activeColor="blue" />
                    <SidebarItem icon={Users} label={t.user_management} />
                    <SidebarItem icon={MessageSquare} label={t.auto_response} />
                    <SidebarItem icon={Shield} label={t.security} />
                    <SidebarItem icon={Activity} label={t.stats} />
                    <SidebarItem icon={Bell} label={t.notifications} />
                    <div className="my-4 h-[1px] bg-black/5 dark:bg-white/10" />
                    <SidebarItem icon={SettingsIcon} label={t.settings} onClick={() => tryNavigate('/settings')} />
                </nav>

                <div className="mt-auto">
                    <SidebarItem icon={LogOut} label={t.logout} onClick={() => navigate('/login')} activeColor="red" />
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8 overflow-y-auto relative">
                <div className="mesh-background" />
                <header className="mb-10 relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-bold mb-2 text-primary">{t.server_management}</h2>
                        <p className="text-secondary font-medium">{t.server_subtitle}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {isDirty && (
                            <button
                                onClick={saveOrder}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-bold shadow-lg shadow-green-500/20 transition-all animate-bounce"
                            >
                                <Save size={18} />
                                {t.save_order}
                            </button>
                        )}

                        <div className="flex items-center gap-2 bg-white/40 dark:bg-black/20 p-1.5 rounded-2xl border border-black/5 dark:border-white/5 backdrop-blur-md">
                            <button
                                onClick={() => handleSort('join')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${sortBy === 'join' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-secondary hover:text-primary hover:bg-white/10'}`}
                            >
                                <Clock size={16} />
                                {t.join_order}
                                {sortBy === 'join' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </button>
                            <button
                                onClick={() => handleSort('creation')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${sortBy === 'creation' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-secondary hover:text-primary hover:bg-white/10'}`}
                            >
                                <Calendar size={16} />
                                {t.creation_order}
                                {sortBy === 'creation' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </button>
                            <button
                                onClick={() => handleSort('alphabetical')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${sortBy === 'alphabetical' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-secondary hover:text-primary hover:bg-white/10'}`}
                            >
                                {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
                                {t.alphabetical}
                                {sortBy === 'alphabetical' && (sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
                            </button>
                            {settings?.isCustomSortEnabled && (
                                <button
                                    onClick={() => handleSort('custom')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${sortBy === 'custom' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-secondary hover:text-primary hover:bg-white/10'}`}
                                >
                                    <GripVertical size={16} />
                                    {t.custom}
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 relative z-10">
                    <AnimatePresence mode="popLayout">
                        {finalGuilds.map((guild: any, index: number) => (
                            <motion.div
                                key={guild.id}
                                layout
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.2 }}
                                draggable={sortBy === 'custom'}
                                onDragStart={(e) => onDragStart(e, index)}
                                onDragOver={(e) => onDragOver(e, index)}
                                onDragEnd={onDragEnd}
                                className={sortBy === 'custom' ? 'cursor-move' : ''}
                            >
                                <ServerCard
                                    guild={guild}
                                    isBotIn={botGuilds.includes(guild.id)}
                                    showModal={setShowModal}
                                    isCustom={sortBy === 'custom'}
                                    isDragging={draggedIndex === index}
                                    t={t}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>

                {/* Confirm Modals */}
                <AnimatePresence>
                    {showModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowModal(null)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="glass-card max-w-sm w-full p-8 relative z-10 text-center shadow-2xl border-white/20"
                            >
                                <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 ${showModal.type === 'invite' ? 'bg-blue-500/20 text-blue-400' :
                                    showModal.type === 'kick' ? 'bg-red-500/20 text-red-400' :
                                        'bg-amber-500/20 text-amber-500'
                                    }`}>
                                    {showModal.type === 'invite' ? <ExternalLink size={32} /> :
                                        showModal.type === 'kick' ? <AlertTriangle size={32} /> :
                                            <Info size={32} />}
                                </div>
                                <h3 className="text-xl font-bold text-primary mb-2">
                                    {showModal.type === 'save_confirm' ? t.save_confirm_title : t.confirm}
                                </h3>
                                <div className="text-secondary mb-8">
                                    {showModal.type === 'save_confirm' ?
                                        t.save_confirm_desc :
                                        <>
                                            {lang === 'ja'
                                                ? <>本当にサーバー「<strong>{showModal.guild?.name}</strong>」に<br />BOTを{showModal.type === 'invite' ? '招待' : '退場'}させますか？</>
                                                : <>Are you sure you want to {showModal.type === 'invite' ? 'invite' : 'remove'} the bot <br />{showModal.type === 'invite' ? 'to' : 'from'} <strong>{showModal.guild?.name}</strong>?</>
                                            }
                                        </>
                                    }
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => {
                                            if (showModal.type === 'save_confirm') {
                                                setIsDirty(false);
                                                setShowModal(null);
                                                if (pendingNavigate) navigate(pendingNavigate);
                                            } else {
                                                setShowModal(null);
                                            }
                                        }}
                                        className="flex-1 px-4 py-2.5 rounded-xl font-bold text-secondary bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        {showModal.type === 'save_confirm' ? t.leave_anyway : t.cancel}
                                    </button>
                                    <button
                                        onClick={handleConfirm}
                                        className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-white transition-colors ${showModal.type === 'invite' ? 'bg-blue-600 hover:bg-blue-700' :
                                            showModal.type === 'kick' ? 'bg-red-600 hover:bg-red-700' :
                                                'bg-green-600 hover:bg-green-700'
                                            }`}
                                    >
                                        {showModal.type === 'save_confirm' ? t.save_and_move : t.execute}
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

const ServerCard = ({ guild, isBotIn, showModal, isCustom = false, isDragging = false, t }: any) => (
    <div className={`glass-card p-6 flex flex-col gap-6 group transition-all relative h-full ${isDragging ? 'opacity-30 scale-95' : 'hover:scale-[1.02]'}`}>
        {isCustom && (
            <div className="absolute top-4 right-4 text-secondary/30 group-hover:text-secondary transition-colors">
                <GripVertical size={20} />
            </div>
        )}
        <div className="flex items-center gap-4">
            {guild.icon ? (
                <img
                    src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
                    alt={guild.name}
                    className="w-16 h-16 rounded-2xl shadow-lg border border-white/10 pointer-events-none"
                />
            ) : (
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 flex items-center justify-center font-bold text-xl text-white pointer-events-none">
                    {guild.name.charAt(0)}
                </div>
            )}
            <div className="flex-1 min-w-0 pointer-events-none">
                <h3 className="font-bold text-lg text-primary truncate">{guild.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                    <span className={`w-2 h-2 rounded-full ${isBotIn ? 'bg-green-500' : 'bg-slate-400'}`} />
                    <span className="text-xs font-bold text-secondary">
                        {isBotIn ? t.bot_added : t.not_added}
                    </span>
                </div>
            </div>
        </div>

        <div className="mt-auto pt-4 border-t border-black/5 dark:border-white/5">
            {isBotIn ? (
                <button
                    onClick={(e) => { e.stopPropagation(); showModal({ type: 'kick', guild }); }}
                    className="w-full bg-red-500/10 hover:bg-red-500 text-red-600 dark:text-red-400 hover:text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
                >
                    <Trash2 size={18} />
                    {t.kick_bot}
                </button>
            ) : (
                <button
                    onClick={(e) => { e.stopPropagation(); showModal({ type: 'invite', guild }); }}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-500/20"
                >
                    <ExternalLink size={18} />
                    {t.invite_bot}
                </button>
            )}
        </div>
    </div>
);
