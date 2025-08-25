const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your inventory.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('View another user\'s inventory.')
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser('user') || interaction.user;
        const userId = user.id;

        await interaction.deferReply();

        // fetch equipment
        const { data: userItems, error } = await supabase
            .from('user_equipment')
            .select('is_equipped, equipment(item_name)')
            .eq('user_id', userId);

        if (error) {
            console.error('Supabase fetch error:', error);
            return interaction.editReply({ content: 'Failed to fetch inventory.' });
        }

        // prepare inventory list
        let inventoryList = [];
        if (!userItems || userItems.length === 0) {
            inventoryList = ['Empty'];
        } else {
            inventoryList = userItems
                .map(i => i.equipment?.item_name)
                .filter(Boolean);

            if (inventoryList.length === 0) inventoryList.push('Empty');
        }

        // format into rows 
        const chunkSize = 6;
        const rows = [];
        for (let i = 0; i < inventoryList.length; i += chunkSize) {
            rows.push(inventoryList.slice(i, i + chunkSize).join(' | '));
        }

        // build embed
        const embed = new EmbedBuilder()
            .setTitle(`**${user.username}**'s Inventory`)
            .setThumbnail(user.displayAvatarURL())
            .setDescription(rows.join('\n'))
            .setColor('Blue')
            .setTimestamp();

        // show equipped count
        const equippedCount = userItems?.filter(i => i.is_equipped).length || 0;
        embed.setFooter({ text: `${equippedCount} item(s) equipped` });

        await interaction.editReply({ embeds: [embed] });
    }
};
