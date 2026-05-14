const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('relay')
        .setDescription('Toggle the message relay system on or off')
        .addBooleanOption(option =>
            option
                .setName('status')
                .setDescription('Select True to enable or False to disable')
                .setRequired(true)
        )
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const isEnabled = interaction.options.getBoolean('status');
        
        if (interaction.client.relayEnabled === isEnabled) {
            return await interaction.reply({
                content: `The relay is already ${isEnabled ? 'enabled' : 'disabled'}.`,
                ephemeral: true
            });
        }

        interaction.client.relayEnabled = isEnabled;

        const responseEmbed = new EmbedBuilder()
            .setTitle('Relay System Updated')
            .setDescription(`The message relay has been successfully **${isEnabled ? 'Activated' : 'Deactivated'}**.`)
            .setColor(isEnabled ? 0x00FF00 : 0xFF0000)
            .setTimestamp()
            .setFooter({ text: `Action by ${interaction.user.tag}` });

        await interaction.reply({ embeds: [responseEmbed] });
    },
};