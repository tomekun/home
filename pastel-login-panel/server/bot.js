require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, PermissionFlagsBits, UserFlagsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const {
    getBlacklist,
    getRecentBans,
    addRecentBan,
    getSuspiciousBots,
    saveSuspiciousBots,
    getBypassList,
    addToBypassList
} = require('./storage');

let client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildModeration],
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
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'ping') {
                await interaction.reply('pong');
            }
        } else if (interaction.isButton()) {
            const [action, guildId, targetUserId] = interaction.customId.split(':');

            if (action === 'bypass_allow') {
                try {
                    const guild = await c.guilds.fetch(guildId);
                    if (!guild) return await interaction.reply({ content: 'サーバーが見つかりませんでした。', ephemeral: true });

                    // Add to bypass and unban
                    addToBypassList(guildId, targetUserId);
                    await guild.members.unban(targetUserId, 'Owner approved via Dashboard Alert').catch(e => console.error('Unban failed:', e));

                    await interaction.update({
                        content: interaction.message.content + '\n\n✅ **承認されました。** ユーザーをリストから除外し、BANを解除しました。',
                        components: []
                    });
                } catch (e) {
                    console.error(e);
                    await interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
                }
            } else if (action === 'bypass_deny') {
                await interaction.update({
                    content: interaction.message.content + '\n\n❌ **拒否されました。** ユーザーはBAN状態のまま維持されます。',
                    components: []
                });
            }
        }
    });

    c.on('guildMemberAdd', async (member) => {
        const blacklist = getBlacklist();
        const bypassList = getBypassList(member.guild.id);

        if (blacklist.includes(member.id) && !bypassList.includes(member.id)) {
            try {
                // Determine if we should notify
                const owner = await member.guild.fetchOwner();

                // Ban the user
                await member.ban({ reason: '[SYSTEM] Global Blacklisted User Detected.' });

                // Construct Buttons
                const row = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(`bypass_allow:${member.guild.id}:${member.id}`)
                            .setLabel('参加を許可する')
                            .setStyle(ButtonStyle.Success),
                        new ButtonBuilder()
                            .setCustomId(`bypass_deny:${member.guild.id}:${member.id}`)
                            .setLabel('拒否する')
                            .setStyle(ButtonStyle.Danger),
                    );

                // Notify owner with buttons
                await owner.send({
                    content: `【セキュリティアラート】ブラックリストユーザー **${member.user.tag}** (${member.id}) が **${member.guild.name}** に参加しようとしました。\nシステムにより自動的にBANされました。このユーザーの参加を例外的に許可しますか？`,
                    components: [row]
                }).catch(() => console.log('Could not DM owner'));

            } catch (err) {
                console.error('Error handling blacklisted user join:', err);
            }
        }
    });

    c.on('guildBanAdd', async (ban) => {
        try {
            // Attempt to fetch more details if partial
            if (ban.partial) await ban.fetch();

            addRecentBan({
                userId: ban.user.id,
                username: ban.user.username,
                displayName: ban.user.globalName || ban.user.username,
                avatar: ban.user.displayAvatarURL(),
                guildId: ban.guild.id,
                guildName: ban.guild.name,
                reason: ban.reason || 'No reason provided'
            });
            console.log(`[BOT] Recorded ban for ${ban.user.tag} in ${ban.guild.name}`);
        } catch (err) {
            console.error('Error handling guildBanAdd:', err);
        }
    });

    const scanForSuspiciousBots = async () => {
        if (!c.isReady()) return;
        const suspicious = [];
        for (const [_, guild] of c.guilds.cache) {
            try {
                const members = await guild.members.fetch();
                const bots = members.filter(m => m.user.bot && m.id !== c.user.id);

                for (const [_, bot] of bots) {
                    // Unverified bots with high permissions (Administrator)
                    // Note: bot.permissions handles member permissions in the guild
                    const isAdmin = bot.permissions.has(PermissionFlagsBits.Administrator);

                    // Check if the bot is verified
                    // UserFlagsBitField.Flags.VerifiedBot is the correct bit check in v14
                    const isVerified = bot.user.flags?.has(UserFlagsBitField.Flags.VerifiedBot);

                    if (!isVerified && isAdmin) {
                        suspicious.push({
                            id: bot.id,
                            username: bot.user.username,
                            avatar: bot.user.displayAvatarURL(),
                            guildName: guild.name,
                            guildId: guild.id,
                            reason: 'Unverified bot with Administrator permissions'
                        });
                    }
                }
            } catch (e) {
                // Ignore errors picking up guild members
            }
        }
        saveSuspiciousBots(suspicious);
    };

    c.once('ready', (readyClient) => {
        onReady(readyClient);
        // Periodic scans
        scanForSuspiciousBots();
        setInterval(scanForSuspiciousBots, 30 * 60 * 1000); // Every 30 mins
    });
};

setupClientEvents(client);

if (process.env.DISCORD_BOT_TOKEN) {
    try {
        client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
            console.error('[BOT] Error during initial login:', err.message);
        });
    } catch (err) {
        console.error('[BOT] Synchronous error during login:', err.message);
    }
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
            recentBans: getRecentBans(),
            suspiciousBots: getSuspiciousBots()
        };
    } catch (error) {
        console.error('Error fetching bot stats:', error);
        return {
            ...botStats,
            recentBans: getRecentBans(),
            suspiciousBots: getSuspiciousBots()
        };
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

// Only handle terminal commands if it's a TTY
if (process.stdin.isTTY) {
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
}

const resolveUser = async (userId) => {
    if (!client.isReady()) return { id: userId, username: 'Bot Offline', displayName: 'Bot Offline', avatar: null };
    try {
        const user = await client.users.fetch(userId);
        return {
            id: user.id,
            username: user.username,
            displayName: user.globalName || user.username,
            avatar: user.displayAvatarURL(),
            bot: user.bot
        };
    } catch (e) {
        return { id: userId, username: 'Unknown User', displayName: 'Unknown', avatar: null };
    }
};

module.exports = { getBotStats, leaveGuild, startBot, stopBot, client: () => client, resolveUser };
