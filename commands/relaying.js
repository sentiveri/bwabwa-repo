const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('relay')
        .setDescription('Enable or disable relay')
        .addBooleanOption(option =>
            option
                .setName('enabled')
                .setDescription('true = on, false = off')
                .setRequired(true)
        ),

    async execute(interaction) {

        const enabled =
            interaction.options.getBoolean('enabled');

        interaction.client.relayEnabled = enabled;

        await interaction.reply(
            `Relay is now ${enabled ? 'enabled' : 'disabled'}`
        );
    },
};