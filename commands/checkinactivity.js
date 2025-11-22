const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('checkinactivity')
        .setDescription('Manually trigger inactivity check'),

    ephemeral: true, // only visible to command user

    async execute(interaction, db, helpers) {
        await interaction.editReply({
            content: 'Running inactivity check...',
            flags: 64
        });

        // Collect action log
        const actionLog = [];
        await helpers.checkInactivity(async (action) => {
            // The scheduler now calls this callback with messages like:
            // "Nagged @User for 30 days" or "Kicked @User for 90 days"
            actionLog.push(action);
        });

        const content = actionLog.length
            ? `Inactivity check completed. Actions taken:\n${actionLog.join('\n')}`
            : 'Inactivity check completed. No actions were needed.';

        await interaction.editReply({
            content,
            flags: 64
        });
    }
};
