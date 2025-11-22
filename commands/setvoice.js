const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setvoice')
        .setDescription('Manually set a user’s last voice timestamp for testing')
        .addUserOption(opt => 
            opt.setName('user')
               .setDescription('User to set')
               .setRequired(true))
        .addIntegerOption(opt => 
            opt.setName('daysago')
               .setDescription('Number of days ago to set the last voice')
               .setRequired(true)),

    ephemeral: true, // only visible to the command user

    async execute(interaction, db, helpers) {
        const user = interaction.options.getUser('user');
        const daysAgo = interaction.options.getInteger('daysago');

        if (!db[user.id]) db[user.id] = { name: user.username, id: user.id, nagged: false };

        const timestamp = new Date();
        timestamp.setDate(timestamp.getDate() - daysAgo);

        db[user.id].lastVoice = timestamp.toLocaleString();
        db[user.id].nagged = false;
        db[user.id].nagStep = 0; // reset all nags
        helpers.saveDB();


        await interaction.editReply({
            content: `Last voice timestamp for ${user.tag} set to ${db[user.id].lastVoice} (${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago)`,
            flags: this.ephemeral ? 64 : undefined
        });
    }
};
