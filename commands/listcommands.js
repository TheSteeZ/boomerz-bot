const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('listcommands')
        .setDescription('List all currently registered commands for this bot'),

    // default visibility; can be overridden
    ephemeral: true, 

    async execute(interaction) {
        // Auto-defer if not already deferred/replied
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: this.ephemeral });
        }

        const commands = interaction.client.commands;

        if (!commands || !commands.size) {
            return await interaction.editReply({
                content: 'No commands are currently registered.',
                flags: this.ephemeral ? 64 : undefined
            });
        }

        const commandList = commands
            .map(cmd => `• ${cmd.data.name} — ${cmd.data.description}`)
            .join('\n');

        await interaction.editReply({
            content: `**Registered commands:**\n${commandList}`,
            flags: this.ephemeral ? 64 : undefined
        });
    }
};
