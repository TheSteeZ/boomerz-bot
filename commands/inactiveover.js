const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inactiveover')
        .setDescription('List users inactive over a specified threshold in days')
        .addIntegerOption(opt => 
            opt.setName('days')
               .setDescription('Number of days inactive')
               .setRequired(true)),

    async execute(interaction, db, helpers) {
        const days = interaction.options.getInteger('days');
        const now = new Date();

        const inactiveUsers = Object.values(db).filter(user => {
            if (!user.lastVoice) return true;
            const lastVoice = new Date(user.lastVoice);
            const diffDays = (now - lastVoice) / (1000 * 60 * 60 * 24);
            return diffDays >= days;
        });

        if (!inactiveUsers.length) {
            return await interaction.editReply({
                content: `No users have been inactive for ${days} days or more.`,
                flags: 64
            });
        }

        const list = inactiveUsers.map(u => `• ${u.name} — Last voice: ${u.lastVoice || 'Never'}`).join('\n');

        await interaction.editReply({
            content: `Users inactive for ${days}+ days:\n${list}`,
            flags: 64
        });
    }
};
