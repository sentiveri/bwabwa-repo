const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    owner: true,
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Set an avatar for the bot.')
        .addAttachmentOption(option => 
            option.setName('avatar')
                .setDescription('The avatar you wanna set as')
                .setRequired(true)
        ),
    async execute (interaction, client) {
        
        const { options } = interaction;
        const avatar = options.getAttachment('avatar');

        async function sendResponse (message) {
            const embed = new EmbedBuilder()
                .setColor("Blurple")
                .setDescription(message);

            if (interaction.deferred) {
                await interaction.editReply({ embeds: [embed] });
            } else if (interaction.replied) {
                await interaction.followUp({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            }
        }

        if (!avatar.contentType || !avatar.contentType.startsWith('image/')) {
            return await sendResponse("Please use a supported file type (.png, .jpeg, .gif)");
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const response = await fetch(avatar.url);
            if (!response.ok) throw new Error("Cannot download image from Discord CDN.");
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            await interaction.client.user.setAvatar(buffer);
            
            return await sendResponse("Changed the avatar for the bot successfully!");
        } catch (err) {
            console.error(err);
            return await sendResponse(`Error: \`${err.message || err.toString()}\``);
        }
    }
}