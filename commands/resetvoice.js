const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('resetvoice')
        .setDescription('Reset a user’s last voice timestamp')
        .addUserOption(opt => 
            opt.setName('user')
               .setDescription('User to reset')
               .setRequired(true)),

    async execute(interaction, db, helpers) {
        const user = interaction.options.getUser('user');

        if (!db[user.id]) {
            db[user.id] = {};
        } else {
            delete db[user.id].lastVoice;
            db[user.id].nagged = false;
        }

        helpers.saveDB();

        await interaction.editReply({
            content: `Last voice timestamp for ${user.tag} has been reset.`,
            flags: 64
        });
    }
};
