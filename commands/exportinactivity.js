const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('exportinactivity')
        .setDescription('Export inactivity data as CSV'),

    ephemeral: true, // only visible to the user who runs it

    async execute(interaction, db) {
        const lines = ['Name,ID,LastVoice,Nagged'];

        for (const userId in db) {
            const user = db[userId];
            lines.push(`"${user.name}","${user.id}","${user.lastVoice}","${user.nagged}"`);
        }

        const filePath = path.join(__dirname, '../inactivity.csv');
        fs.writeFileSync(filePath, lines.join('\n'));

        // Create Discord attachment
        const attachment = new AttachmentBuilder(filePath);

        await interaction.editReply({
            content: 'Here is the exported inactivity data:',
            files: [attachment],
            flags: 64
        });
    }
};
