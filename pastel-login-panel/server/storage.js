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

module.exports = { getUserSettings, saveUserSettings };
