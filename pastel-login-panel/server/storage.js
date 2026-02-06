const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'storage.json');

// In-memory cache to avoid frequent disk I/O
let cachedStorage = null;

const readStorage = () => {
    if (cachedStorage) return cachedStorage;
    try {
        if (!fs.existsSync(STORAGE_PATH)) {
            cachedStorage = {};
            return cachedStorage;
        }
        cachedStorage = JSON.parse(fs.readFileSync(STORAGE_PATH, 'utf8'));
        return cachedStorage;
    } catch (error) {
        console.error('Error reading storage:', error);
        return {};
    }
};

const writeStorage = (data) => {
    try {
        cachedStorage = data;
        // Basic throttle or simple write
        fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing storage:', error);
    }
};

const getUserSettings = (userId) => {
    const storage = readStorage();
    return storage[userId] || {
        language: 'ja',
        furigana: {},
        customOrder: [],
        isCustomSortEnabled: false,
        isFuriganaEnabled: true,
        isDevModeEnabled: false
    };
};

const saveUserSettings = (userId, settings) => {
    const storage = readStorage();
    storage[userId] = {
        ...getUserSettings(userId),
        ...settings
    };
    writeStorage(storage);
};

const getBlacklist = () => {
    const storage = readStorage();
    return storage.globalBlacklist || [];
};

const addToBlacklist = (userId) => {
    const storage = readStorage();
    if (!storage.globalBlacklist) storage.globalBlacklist = [];
    if (!storage.globalBlacklist.includes(userId)) {
        storage.globalBlacklist.push(userId);
        writeStorage(storage);
    }
};

const removeFromBlacklist = (userId) => {
    const storage = readStorage();
    if (storage.globalBlacklist) {
        storage.globalBlacklist = storage.globalBlacklist.filter(id => id !== userId);
        writeStorage(storage);
    }
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

const getRecentBans = () => {
    const storage = readStorage();
    return storage.recentBans || [];
};

const addRecentBan = (banInfo) => {
    const storage = readStorage();
    if (!storage.recentBans) storage.recentBans = [];
    storage.recentBans.unshift({
        ...banInfo,
        timestamp: Date.now()
    });
    // Keep only last 20
    storage.recentBans = storage.recentBans.slice(0, 20);
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
    saveSuspiciousBots
};
