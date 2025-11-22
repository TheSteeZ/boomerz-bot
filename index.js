require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client, GatewayIntentBits, Collection, Events } = require('discord.js');

const DATA_FILE = path.join(__dirname, 'voiceData.json');

// ------------------- Load DB -------------------
let db = {};
if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE));
        console.log('DB loaded.');
    } catch (err) {
        console.error('Failed to load DB:', err);
    }
}

// ------------------- Save DB -------------------
function saveDB() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('Failed to save DB:', err);
    }
}

// ------------------- Client -------------------
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

// Collection for commands
client.commands = new Collection();

// ------------------- Helper: format timestamp -------------------
function formatLastVoice(timestamp) {
    if (!timestamp) return 'No recorded voice activity';

    const lastDate = new Date(timestamp);
    const now = new Date();
    const diffMs = now - lastDate;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const dateStr = lastDate.toLocaleString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });

    return `${dateStr} (${diffDays} day${diffDays !== 1 ? 's' : ''} ago)`;
}

// ------------------- Load commands -------------------
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.data.name, command);
}

// ------------------- Voice State Tracking -------------------
client.on('voiceStateUpdate', async (oldState, newState) => {
    const member = newState.member;
    if (!member || member.user.bot) return;

    if (oldState.channelId !== newState.channelId && newState.channelId) {
        const nagged = db[member.id]?.nagged || false;
        const now = new Date();

        db[member.id] = {
            name: member.user.username,
            id: member.id,
            lastVoice: now.toLocaleString(), // readable format
            nagged
        };

        saveDB();
        console.log(`Updated voice data for ${member.user.tag}: ${db[member.id].lastVoice}`);

        // Send to Discord channel
        if (process.env.NOTIFY_CHANNEL_ID) {
            const channel = await client.channels.fetch(process.env.NOTIFY_CHANNEL_ID).catch(() => null);
            if (channel) {
                channel.send(`📢 Updated voice data for **${member.user.tag}**: ${db[member.id].lastVoice}`).catch(console.error);
            }
        }
    }
});


// ------------------- Automatic Inactivity Scheduler -------------------
const ONE_DAY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

async function runDailyInactivityCheck() {
    if (!client.helpers?.checkInactivity) return;

    const actionLog = [];

    // Run the inactivity check with a callback to collect messages
    await client.helpers.checkInactivity((action) => {
        actionLog.push(action);
    });

    // Get the Discord channel to post to
    const channel = await client.channels.fetch(process.env.NOTIFY_CHANNEL_ID).catch(() => null);
    if (!channel) {
        console.warn('Notify channel not found. Skipping Discord notification.');
        return;
    }

    // Prepare message content
    const content = actionLog.length
        ? `**Inactivity check results:**\n${actionLog.join('\n')}`
        : 'Inactivity check completed. No actions taken today.';

    // Send the message
    await channel.send(content).catch(console.error);
}

// Run the first check immediately
runDailyInactivityCheck().catch(console.error);

// Schedule daily checks
setInterval(() => {
    runDailyInactivityCheck().catch(console.error);
}, ONE_DAY);

console.log('Automatic inactivity scheduler started: checks every 24 hours and posts to Discord.');



// ------------------- Inactivity scheduler -------------------
async function checkInactivity(actionCallback) {
    if (!client.guilds.cache.size) return;

    const settings = client.helpers.settings || {};
    const now = Date.now();
    const kickDays = settings.kickDays || 90;

    // Nag thresholds in days
    const thresholds = [30, 60, kickDays - 1].map(d => d * 24 * 60 * 60 * 1000);

    for (const guild of client.guilds.cache.values()) {
        for (const [userId, data] of Object.entries(db)) {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (!member) continue;

            const lastVoice = data.lastVoice ? new Date(data.lastVoice).getTime() : 0;
            if (!lastVoice) continue;

            if (data.nagStep === undefined) data.nagStep = 0;

            // ---------- NAG LOGIC ----------
            // Determine latest nag step eligible (but only if under kick threshold)
            let stepToRun = null;
            for (let i = 0; i < thresholds.length; i++) {
                if (
                    now - lastVoice >= thresholds[i] && 
                    i >= data.nagStep && 
                    now - lastVoice < kickDays * 24 * 60 * 60 * 1000
                ) {
                    stepToRun = i;
                }
            }

            if (stepToRun !== null) {
                let msg;
                if (stepToRun === thresholds.length - 1) {
                    msg = `Hi ${member.user.tag}, inactive for ${kickDays - 1} days — you will be kicked tomorrow if you don't join a voice channel.`;
                } else {
                    msg = `Hi ${member.user.tag}, inactive for ${thresholds[stepToRun] / (24*60*60*1000)} days! You will be kicked after ${kickDays} days of inactivity. Please join a voice channel to reset your inactivity timer.`;
                }

                member.send(msg).catch(() => {});
                data.nagStep = stepToRun + 1;

                if (actionCallback) {
                    actionCallback(`Sent nag to ${member.user.tag} (${stepToRun === thresholds.length - 1 ? '1 day before kick' : thresholds[stepToRun]/(24*60*60*1000)+' days'})`);
                }
            }

            // ---------- KICK LOGIC ----------
            if (now - lastVoice >= kickDays * 24 * 60 * 60 * 1000) {
                if (member.kickable) {
                    await member.kick(`Inactive for ${kickDays} days`);
                    if (actionCallback) actionCallback(`Kicked ${member.user.tag} for inactivity`);
                } else {
                    if (actionCallback) actionCallback(`Could not kick ${member.user.tag}: insufficient permissions`);
                }
                // Prevent any repeated nag after kick
                data.nagStep = thresholds.length;
            }
        }
    }

    // Save DB if helper exists
    client.helpers.saveDB?.();
}




// ------------------- Helpers object -------------------
client.helpers = {
    saveDB,
    formatLastVoice,
    checkInactivity,
    settings: {
        nagDays: 30,
        kickDays: 90
    }
};

// ------------------- Interaction Handler -------------------
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
        // Defer the reply if it hasn't been deferred yet
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: command.ephemeral ?? true });
        }

        // Execute command with db and helpers
        await command.execute(interaction, db, client.helpers);
    } catch (err) {
        console.error(`Error executing ${interaction.commandName}:`, err);
        if (!interaction.replied) {
            await interaction.reply({ content: 'There was an error executing this command.', ephemeral: true });
        }
    }
});

// ------------------- New Member Joins Discord-----------
client.on('guildMemberAdd', member => {
    if (member.user.bot) return; // skip bots

    const now = new Date().toLocaleString();

    db[member.id] = {
        name: member.user.username,
        id: member.id,
        lastVoice: now,  // baseline = join date
        nagged: false,
        nagStep: 0
    };

    client.helpers.saveDB?.();
    console.log(`New member added to voiceData.json: ${member.user.tag}`);
});



// ------------------- Ready -------------------
client.once(Events.ClientReady, async () => {
    console.log(`Logged in as ${client.user.tag}`);
});



// ------------------- Login -------------------
client.login(process.env.TOKEN);
