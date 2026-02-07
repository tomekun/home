require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const csrf = require('csurf');

const {
    getBotStats,
    leaveGuild,
    startBot,
    stopBot,
    client: getClient,
    resolveUser
} = require('./bot');
const {
    getUserSettings,
    saveUserSettings,
    addToBlacklist,
    removeFromBlacklist,
    getBlacklist,
    addToBypassList,
    getBypassList,
    getBotAccounts,
    addBotAccount,
    removeBotAccount,
    setActiveBot,
    getActiveBotToken,
    readStorage,
    getDevSettings,
    saveDevSettings
} = require('./storage');

const app = express();
const PORT = process.env.PORT || 3001;

// Global error handlers to prevent process crash
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception thrown:', err);
});

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            ...helmet.contentSecurityPolicy.getDefaultDirectives(),
            "img-src": ["'self'", "data:", "https://cdn.discordapp.com", "https://*.supabase.co", "https://cdn.prod.website-files.com"],
            "connect-src": ["'self'", "http://localhost:3001"],
            "form-action": ["'self'", "https://discord.com"]
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
}));

app.disable('x-powered-by'); // Explicitly disable to satisfy scanners

// Simple in-memory cache to reduce Discord API load (30s TTL)
const apiCache = new Map();
const CACHE_TTL = 30 * 1000;

const getCachedOrFetch = async (token, key, fetchFn) => {
    const cacheKey = `${token}:${key}`;
    const cached = apiCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
        return cached.data;
    }
    const data = await fetchFn();
    apiCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
};

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin.startsWith('http://localhost:')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Discord OAuth2 Endpoints
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI;

app.get('/api/auth/login', (req, res) => {
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=identify%20guilds`;
    res.redirect(url);
});

app.get('/api/auth/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) return res.status(400).send('No code provided');

    try {
        // Exchange code for token
        const tokenResponse = await axios.post('https://discord.com/api/oauth2/token', new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
        }), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        const { access_token } = tokenResponse.data;

        // Get user info
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: {
                Authorization: `Bearer ${access_token}`,
            },
        });

        // In a real app, you'd create a JWT or session here
        res.cookie('discord_token', access_token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Set to true if served over HTTPS
            sameSite: 'lax', // CSRF Protection
            path: '/', // サイト全体でクッキーを有効にする
            maxAge: 24 * 60 * 60 * 1000 // 1日間有効
        });

        // Redirect back to frontend
        res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
    } catch (error) {
        console.error('OAuth Error:', error.response?.data || error.message);
        res.status(500).send('Authentication failed');
    }
});

// CSRF Protection
const csrfProtection = csrf({
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
});
app.use(csrfProtection);

// Middleware to set CSRF token in a cookie that the frontend can read
app.use((req, res, next) => {
    // This cookie is NOT httpOnly so the frontend JS can read it
    res.cookie('XSRF-TOKEN', req.csrfToken(), {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });
    next();
});


app.get('/api/user', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const data = await getCachedOrFetch(token, 'user', async () => {
            const userRes = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return { user: userRes.data, guilds: guildsRes.data };
        });
        res.json(data);
    } catch (error) {
        res.status(401).json({ error: 'Token expired or invalid' });
    }
});

app.get('/api/handshake', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const stats = await getBotStats();
        const clientInstance = getClient();
        const botGuilds = clientInstance.isReady() ? clientInstance.guilds.cache.map(g => g.id) : [];
        const userData = await getCachedOrFetch(token, 'user', async () => {
            const userRes = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return { user: userRes.data, guilds: guildsRes.data };
        });
        const settings = getUserSettings(userData.user.id);
        const blacklist = getBlacklist();
        // Since we don't know which guild is "currently selected" in a generic context, 
        // we might just return the blacklist here. Bypass lists are per-guild.

        res.json({
            user: userData.user,
            userGuilds: userData.guilds,
            botStats: stats,
            botGuilds,
            settings,
            blacklist
        });
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('discord_token');
    res.json({ success: true });
});

app.get('/api/bot/stats', async (req, res) => {
    const stats = await getBotStats();
    res.json(stats);
});

app.get('/api/bot/guilds', (req, res) => {
    const clientInstance = getClient();
    const guildIds = clientInstance.isReady() ? clientInstance.guilds.cache.map(g => g.id) : [];
    res.json(guildIds);
});

app.post('/api/bot/start', async (req, res) => {
    const success = await startBot();
    res.json({ success });
});

app.post('/api/bot/stop', async (req, res) => {
    const success = await stopBot();
    res.json({ success });
});

app.post('/api/guilds/:id/leave', async (req, res) => {
    const { id } = req.params;
    try {
        const success = await leaveGuild(id);
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/settings', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const settings = getUserSettings(userResponse.data.id);
        res.json(settings);
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.post('/api/settings', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const data = await getCachedOrFetch(token, 'user', () =>
            axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${token}` } }).then(r => ({ user: r.data }))
        );
        const userId = data.user.id;

        // Protect bot management fields from being overwritten by general settings
        const { botAccounts, activeBotId, ...otherSettings } = req.body;
        saveUserSettings(userId, otherSettings);
        res.json({ success: true });
    } catch (error) {
        console.error('Settings save error:', error);
        res.status(500).json({ error: 'Failed to save settings' });
    }
});

// Blacklist & Bypass Endpoints
// Blacklist & Bypass Endpoints
app.post('/api/blacklist', async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    addToBlacklist(userId);
    const blacklist = await Promise.all(getBlacklist().map(id => resolveUser(id)));
    res.json({ success: true, blacklist });
});

app.delete('/api/blacklist/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });

    removeFromBlacklist(userId);
    const blacklist = await Promise.all(getBlacklist().map(id => resolveUser(id)));
    res.json({ success: true, blacklist });
});

app.get('/api/blacklist', async (req, res) => {
    const blacklist = await Promise.all(getBlacklist().map(id => resolveUser(id)));
    res.json(blacklist);
});

app.post('/api/bypass', (req, res) => {
    const { guildId, userId } = req.body;
    if (!guildId || !userId) return res.status(400).json({ error: 'Guild ID and User ID are required' });

    addToBypassList(guildId, userId);
    res.json({ success: true, bypassList: getBypassList(guildId) });
});


// Developer Options - Bot Management
app.get('/api/dev/bots', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const bots = getBotAccounts();
        const storage = readStorage(); // Direct read for activeBotId
        res.json({ bots, activeBotId: storage.activeBotId });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch bot accounts' });
    }
});

app.get('/api/dev/settings', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { getDevSettings } = require('./storage');
        res.json(getDevSettings());
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch dev settings' });
    }
});

app.post('/api/dev/settings', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { saveDevSettings } = require('./storage');
        saveDevSettings(req.body);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to save dev settings' });
    }
});

app.post('/api/dev/bots', async (req, res) => {
    const userToken = req.cookies.discord_token;
    const { token, clientId, secretId } = req.body;
    if (!userToken) return res.status(401).json({ error: 'Unauthorized' });
    if (!token || !clientId) return res.status(400).json({ error: 'Token and Client ID are required' });

    try {
        const data = await getCachedOrFetch(userToken, 'user', () =>
            axios.get('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${userToken}` } }).then(r => ({ user: r.data }))
        );
        const user = data.user;

        // Verify bot token
        let botInfo;
        try {
            const botRes = await axios.get('https://discord.com/api/v10/applications/@me', {
                headers: { Authorization: `Bot ${token}` }
            });
            botInfo = botRes.data;
        } catch (err) {
            return res.status(400).json({ error: 'Invalid Bot Token or Client ID' });
        }

        const botAccount = {
            id: botInfo.id,
            name: botInfo.name,
            token,
            clientId,
            secretId,
            avatar: botInfo.icon ? `https://cdn.discordapp.com/app-icons/${botInfo.id}/${botInfo.icon}.png` : null
        };

        addBotAccount(botAccount);
        res.json({ success: true, bot: botAccount });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Failed to add bot' });
    }
});

app.delete('/api/dev/bots/:id', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        removeBotAccount(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to remove bot' });
    }
});

app.post('/api/dev/bots/switch', async (req, res) => {
    const token = req.cookies.discord_token;
    const { clientId } = req.body;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        setActiveBot(clientId);
        const botToken = getActiveBotToken();

        // Restart bot with new token
        await stopBot();
        const started = await startBot(botToken);

        res.json({ success: started });
    } catch (e) {
        res.status(500).json({ error: 'Failed to switch bot' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
