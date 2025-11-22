require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// ------------- Configuration -------------
const useGlobalCommands = false; // set true to deploy globally
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // required for guild commands

// 1️⃣ Gather current local commands
const commands = [];
const commandFiles = fs.readdirSync('./commands').filter(f => f.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    commands.push(command.data.toJSON());
}

// 2️⃣ Deploy function
(async () => {
    try {
        if (useGlobalCommands) {
            console.log('⚠ Deploying global commands. Updates may take up to 1 hour to propagate.');
            await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
            console.log('✅ Global commands deployed.');
        } else {
            console.log('Fetching existing guild commands...');
            const existing = await rest.get(Routes.applicationGuildCommands(clientId, guildId));

            // Delete stale commands
            for (const cmd of existing) {
                if (!commands.find(c => c.name === cmd.name)) {
                    console.log(`Deleting stale command: ${cmd.name}`);
                    await rest.delete(Routes.applicationGuildCommand(clientId, guildId, cmd.id));
                }
            }

            // Register/update current commands
            await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
            console.log('✅ Guild commands deployed successfully!');
        }
    } catch (err) {
        console.error('❌ Error deploying commands:', err);
    }
})();
