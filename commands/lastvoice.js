const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('lastvoice')
        .setDescription('Show last voice channel join timestamp of a user')
        .addUserOption(opt => opt.setName('user').setDescription('User to check')),

    ephemeral: false,

    async execute(interaction, db) {
        const target = interaction.options.getUser('user') || interaction.user;
        const entry = db[target.id];

        if (!entry || !entry.lastVoice) {
            await interaction.editReply(`${target.tag} has no recorded voice activity.`);
        } else {
            const date = new Date(entry.lastVoice).toLocaleString();
            await interaction.editReply(`${target.tag} last joined a voice channel on ${date}.`);
        }
    }
};
