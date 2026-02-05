require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

let client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

let botStats = {
    status: 'offline',
    guildCount: 0,
    userCount: 0,
};

const setupClientEvents = (c) => {
    // Standard discord.js event is 'ready'
    let readyFired = false;
    const onReady = async (readyClient) => {
        if (readyFired) return;
        readyFired = true;
        console.log(`Logged in as ${readyClient.user.tag}!`);
        try {
            const app = await readyClient.application.fetch();
            botStats.status = 'online';
            botStats.guildCount = readyClient.guilds.cache.size;
            botStats.userCount = readyClient.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            botStats.name = app.name;
            botStats.avatar = readyClient.user.displayAvatarURL();

            // Register Slash Commands
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_BOT_TOKEN);
            console.log('[BOT] Registering slash commands...');
            await rest.put(
                Routes.applicationCommands(readyClient.user.id),
                { body: [{ name: 'ping', description: 'Replies with Pong!' }] },
            );
            console.log('[BOT] Slash commands registered successfully.');
        } catch (err) {
            console.error('Error in onReady:', err);
        }
    };

    c.on('interactionCreate', async (interaction) => {
        if (!interaction.isChatInputCommand()) return;

        if (interaction.commandName === 'ping') {
            await interaction.reply('pong');
        }
    });

    c.once('ready', onReady);
};

setupClientEvents(client);

if (process.env.DISCORD_BOT_TOKEN) {
    client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error);
}

const getBotStats = async () => {
    if (!client.isReady()) return { ...botStats, status: 'offline' };

    try {
        const app = await client.application.fetch();
        return {
            status: 'online',
            guildCount: client.guilds.cache.size,
            userCount: client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0),
            name: app.name,
            avatar: client.user.displayAvatarURL(),
        };
    } catch (error) {
        console.error('Error fetching bot stats:', error);
        return botStats;
    }
};

const leaveGuild = async (guildId) => {
    const guild = client.guilds.cache.get(guildId);
    if (guild) {
        await guild.leave();
        return true;
    }
    return false;
};

const startBot = async () => {
    if (client && client.isReady()) {
        console.log('[BOT] Bot is already online.');
        return true;
    }

    try {
        console.log('[BOT] Starting bot...');
        // If client exists but not ready, destroy it safely first
        if (client) {
            try { client.destroy(); } catch (e) { }
        }

        client = new Client({
            intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
        });
        setupClientEvents(client);

        await client.login(process.env.DISCORD_BOT_TOKEN);

        return new Promise((resolve) => {
            if (client.isReady()) {
                botStats.status = 'online';
                resolve(true);
            }
            const timeout = setTimeout(() => resolve(false), 15000);
            client.once('ready', () => {
                clearTimeout(timeout);
                botStats.status = 'online';
                resolve(true);
            });
        });
    } catch (error) {
        console.error('Failed to start bot:', error);
        botStats.status = 'offline';
        return false;
    }
};

const stopBot = async () => {
    if (!client || !client.isReady()) {
        console.log('\n[BOT] Bot is already offline.');
        botStats.status = 'offline';
        return true;
    }

    try {
        console.log('[BOT] Stopping bot...');
        client.destroy();
        botStats.status = 'offline';
        console.log('\n=========================================');
        console.log('[BOT] Bot has been STOPPED from the panel.');
        console.log('[SYS] You can now enter commands in this terminal.');
        console.log('      (e.g., "start", "status", "exit")');
        console.log('=========================================');

        if (!process.stdin.isPaused()) {
            process.stdin.resume();
        }
        return true;
    } catch (error) {
        console.error('Error stopping bot:', error);
        return false;
    }
};

// Handle terminal commands
process.stdin.setEncoding('utf8');
process.stdin.on('data', async (data) => {
    const cmd = data.trim().toLowerCase();
    if (cmd === 'start') {
        console.log('[SYS] Starting bot from terminal...');
        await startBot();
    } else if (cmd === 'stop') {
        await stopBot();
    } else if (cmd === 'status') {
        console.log(`[SYS] Bot Status: ${botStats.status}`);
        console.log(`[SYS] Guilds: ${botStats.guildCount}`);
    } else if (cmd === 'exit') {
        console.log('[SYS] Exiting process...');
        process.exit(0);
    } else if (cmd !== '') {
        console.log(`[SYS] Unknown command: ${cmd}`);
    }
});

module.exports = { getBotStats, leaveGuild, startBot, stopBot, client: () => client };
