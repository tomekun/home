require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const { getBotStats, leaveGuild, startBot, stopBot, client: getClient } = require('./bot');
const { getUserSettings, saveUserSettings } = require('./storage');

const app = express();
const PORT = process.env.PORT || 3001;

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

app.get('/api/user', async (req, res) => {
    const token = req.cookies.discord_token;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const userData = await getCachedOrFetch(token, 'user', async () => {
            const userRes = await axios.get('https://discord.com/api/users/@me', {
                headers: { Authorization: `Bearer ${token}` }
            });
            const guildsRes = await axios.get('https://discord.com/api/users/@me/guilds', {
                headers: { Authorization: `Bearer ${token}` }
            });
            return { user: userRes.data, guilds: guildsRes.data };
        });
        res.json(userData);
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

        res.json({
            user: userData.user,
            userGuilds: userData.guilds,
            botStats: stats,
            botGuilds,
            settings
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
        const userResponse = await axios.get('https://discord.com/api/users/@me', {
            headers: { Authorization: `Bearer ${token}` }
        });
        saveUserSettings(userResponse.data.id, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(401).json({ error: 'Unauthorized' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
