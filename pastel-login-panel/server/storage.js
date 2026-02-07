const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'storage.json');

// In-memory cache to avoid frequent disk I/O
let cachedStorage = null;

const DEFAULT_SETTINGS = {
    language: 'ja',
    furigana: {},
    customOrder: [],
    isCustomSortEnabled: false,
    isFuriganaEnabled: true,
    isDevModeEnabled: false,
    theme: 'light'
};

const readStorage = () => {
    if (cachedStorage) return cachedStorage;
    try {
        if (!fs.existsSync(STORAGE_PATH)) {
            cachedStorage = {};
            return cachedStorage;
        }
        const data = fs.readFileSync(STORAGE_PATH, 'utf8');
        if (!data.trim()) {
            cachedStorage = {};
            return cachedStorage;
        }
        cachedStorage = JSON.parse(data);

        // Migration: Ensure botData structure exists
        if (!cachedStorage.botData) cachedStorage.botData = {};

        // Sync botAccounts with botData
        if (cachedStorage.botAccounts) {
            cachedStorage.botAccounts.forEach(bot => {
                if (!cachedStorage.botData[bot.clientId]) {
                    cachedStorage.botData[bot.clientId] = { blacklist: [], recentBans: [] };
                } else {
                    if (!cachedStorage.botData[bot.clientId].blacklist) cachedStorage.botData[bot.clientId].blacklist = [];
                    if (!cachedStorage.botData[bot.clientId].recentBans) cachedStorage.botData[bot.clientId].recentBans = [];
                }
            });
        }

        // Migration: Move existing global data to the primary bot if its individual data is empty
        const primaryBotId = "1468812333492211954";
        if (cachedStorage.botData[primaryBotId] &&
            (!cachedStorage.botData[primaryBotId].blacklist || cachedStorage.botData[primaryBotId].blacklist.length === 0) &&
            cachedStorage.globalBlacklist && cachedStorage.globalBlacklist.length > 0) {

            cachedStorage.botData[primaryBotId].blacklist = [...cachedStorage.globalBlacklist];
            cachedStorage.botData[primaryBotId].recentBans = [...(cachedStorage.recentBans || [])];
        }

        // Keep root migration for botAccounts if needed
        if (!cachedStorage.botAccounts) {
            let foundBots = [];
            let foundActive = null;
            for (const key in cachedStorage) {
                if (cachedStorage[key] && cachedStorage[key].botAccounts && cachedStorage[key].botAccounts.length > 0) {
                    foundBots = cachedStorage[key].botAccounts;
                    foundActive = cachedStorage[key].activeBotId;
                    break;
                }
            }
            if (foundBots.length > 0) {
                cachedStorage.botAccounts = foundBots;
                cachedStorage.activeBotId = foundActive;
            }
        }
        return cachedStorage;
    } catch (error) {
        console.error('Error reading storage:', error);
        // If parsing fails, do NOT overwrite with an empty object if we already have a cache
        // but since this is first load, we should probably backup or throw.
        // Returning empty object here is what caused data loss if write follows.
        return cachedStorage || {};
    }
};

const writeStorage = (data) => {
    try {
        cachedStorage = data;
        const tempPath = STORAGE_PATH + '.tmp';
        fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
        fs.renameSync(tempPath, STORAGE_PATH);
    } catch (error) {
        console.error('Error writing storage:', error);
    }
};

const getUserSettings = (userId) => {
    const storage = readStorage();
    if (!storage[userId]) return { ...DEFAULT_SETTINGS };
    return {
        ...DEFAULT_SETTINGS,
        ...storage[userId]
    };
};

const saveUserSettings = (userId, settings) => {
    const storage = readStorage();
    // Deep merge or at least ensure we don't wipe botAccounts if not provided
    const current = getUserSettings(userId);
    storage[userId] = {
        ...current,
        ...settings
    };
    writeStorage(storage);
};

const getBlacklist = (botId) => {
    const storage = readStorage();
    const settings = getDevSettings();
    if (settings.isBlacklistShared) {
        return storage.globalBlacklist || [];
    } else {
        const id = botId || storage.activeBotId || 'default';
        if (!storage.botData) storage.botData = {};
        if (!storage.botData[id]) storage.botData[id] = {};
        return storage.botData[id].blacklist || [];
    }
};

const addToBlacklist = (userId, botId) => {
    const storage = readStorage();
    const id = botId || storage.activeBotId || 'default';

    // Always add to global
    if (!storage.globalBlacklist) storage.globalBlacklist = [];
    if (!storage.globalBlacklist.includes(userId)) {
        storage.globalBlacklist.unshift(userId);
    }

    // Always add to bot-specific
    if (!storage.botData) storage.botData = {};
    if (!storage.botData[id]) storage.botData[id] = { blacklist: [], recentBans: [] };
    if (!storage.botData[id].blacklist) storage.botData[id].blacklist = [];
    if (!storage.botData[id].blacklist.includes(userId)) {
        storage.botData[id].blacklist.unshift(userId);
    }

    writeStorage(storage);
};

const removeFromBlacklist = (userId, botId) => {
    const storage = readStorage();
    const id = botId || storage.activeBotId || 'default';

    // Remove from global
    if (storage.globalBlacklist) {
        storage.globalBlacklist = storage.globalBlacklist.filter(uid => uid !== userId);
    }

    // Remove from bot-specific
    if (storage.botData && storage.botData[id] && storage.botData[id].blacklist) {
        storage.botData[id].blacklist = storage.botData[id].blacklist.filter(uid => uid !== userId);
    }

    writeStorage(storage);
};

const getBypassList = (guildId) => {
    const storage = readStorage();
    if (!storage.serverBypasses) storage.serverBypasses = {};
    return storage.serverBypasses[guildId] || [];
};

const addToBypassList = (guildId, userId) => {
    const storage = readStorage();
    if (!storage.serverBypasses) storage.serverBypasses = {};
    if (!storage.serverBypasses[guildId]) storage.serverBypasses[guildId] = [];
    if (!storage.serverBypasses[guildId].includes(userId)) {
        storage.serverBypasses[guildId].push(userId);
        writeStorage(storage);
    }
};

const getRecentBans = (botId) => {
    const storage = readStorage();
    const settings = getDevSettings();
    if (settings.isRecentBansShared) {
        return storage.recentBans || [];
    } else {
        const id = botId || storage.activeBotId || 'default';
        if (!storage.botData) storage.botData = {};
        if (!storage.botData[id]) storage.botData[id] = {};
        return storage.botData[id].recentBans || [];
    }
};

const addRecentBan = (banInfo, botId) => {
    const storage = readStorage();
    const id = botId || storage.activeBotId || 'default';
    const banWithTs = { ...banInfo, timestamp: Date.now() };

    // Always add to global
    if (!storage.recentBans) storage.recentBans = [];
    storage.recentBans.unshift(banWithTs);
    storage.recentBans = storage.recentBans.slice(0, 50);

    // Always add to bot-specific
    if (!storage.botData) storage.botData = {};
    if (!storage.botData[id]) storage.botData[id] = { blacklist: [], recentBans: [] };
    if (!storage.botData[id].recentBans) storage.botData[id].recentBans = [];
    storage.botData[id].recentBans.unshift(banWithTs);
    storage.botData[id].recentBans = storage.botData[id].recentBans.slice(0, 50);

    writeStorage(storage);
};

const getSuspiciousBots = () => {
    const storage = readStorage();
    return storage.suspiciousBots || [];
};

const saveSuspiciousBots = (bots) => {
    const storage = readStorage();
    storage.suspiciousBots = bots;
    writeStorage(storage);
};

const getBotAccounts = () => {
    const storage = readStorage();
    return storage.botAccounts || [];
};

const addBotAccount = (botAccount) => {
    const storage = readStorage();
    if (!storage.botAccounts) storage.botAccounts = [];

    const index = storage.botAccounts.findIndex(b => b.clientId === botAccount.clientId);
    if (index !== -1) {
        storage.botAccounts[index] = { ...storage.botAccounts[index], ...botAccount };
    } else {
        storage.botAccounts.push(botAccount);
    }

    writeStorage(storage);
};

const removeBotAccount = (clientId) => {
    const storage = readStorage();
    if (storage.botAccounts) {
        storage.botAccounts = storage.botAccounts.filter(b => b.clientId !== clientId);
        if (storage.activeBotId === clientId) {
            storage.activeBotId = null;
        }
        writeStorage(storage);
    }
};

const setActiveBot = (clientId) => {
    const storage = readStorage();
    storage.activeBotId = clientId;
    writeStorage(storage);
};

const getDevSettings = () => {
    const storage = readStorage();
    return {
        isBlacklistShared: storage.isBlacklistShared !== false, // default true
        isRecentBansShared: storage.isRecentBansShared !== false // default true
    };
};

const saveDevSettings = (settings) => {
    const storage = readStorage();
    if (settings.isBlacklistShared !== undefined) storage.isBlacklistShared = settings.isBlacklistShared;
    if (settings.isRecentBansShared !== undefined) storage.isRecentBansShared = settings.isRecentBansShared;
    writeStorage(storage);
};

const getActiveBotToken = () => {
    const storage = readStorage();
    if (!storage.activeBotId) return process.env.DISCORD_BOT_TOKEN;
    const bot = (storage.botAccounts || []).find(b => b.clientId === storage.activeBotId);
    return bot ? bot.token : process.env.DISCORD_BOT_TOKEN;
};

module.exports = {
    getUserSettings,
    saveUserSettings,
    getBlacklist,
    addToBlacklist,
    removeFromBlacklist,
    getBypassList,
    addToBypassList,
    getRecentBans,
    addRecentBan,
    getSuspiciousBots,
    saveSuspiciousBots,
    getBotAccounts,
    addBotAccount,
    removeBotAccount,
    setActiveBot,
    getActiveBotToken,
    readStorage,
    getDevSettings,
    saveDevSettings
};
