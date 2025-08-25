const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { ButtonBuilder } = require('discord.js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const categories = ['Weapon', 'Armor', 'Consumable', 'Artifact']

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
            .select('is_equipped, equipment(item_name, category)')
            .eq('user_id', userId);

        if (error) {
            console.error('Supabase fetch error:', error);
            return interaction.editReply({ content: 'Failed to fetch inventory.' });
        }

        const categorized = {};
        categories.forEach(cat => categorized[cat] = []);

        userItems.forEach(i => {
            if (!i.equipment) return;
            const cat = i.equipment.category || 'Misc';
            const name = i.equipment.item_name + (i.is_equipped ? ' - equipped' : '');
            if (!categorized[cat]) categorized[cat] = [];
            categorized[cat].push(name);
        });
        
        const createEmbed = (cat) => {
            const items = categorized[cat].length ? categorized[cat].join('\n') : 'Empty';
            return new EmbedBuilder()
                .setTitle(`${user.username}'s Inventory - ${cat}`)
                .setThumbnail(user.displayAvatarURL())
                .setDescription(items)
                .setColor('Blue')
                .setTimestamp();
        }

        const row = new ActionRowBuilder().addComponents(
            categories.map(cat => new ButtonBuilder()
                .setCustomId(`inv_${cat.toLowerCase()}`)
                .setLabel(cat)
                .setStyle(ButtonStyle.Primary)
            )
        );

        const message = await interaction.editReply({ embeds: [createEmbed(categories[0])], components: [row] });

        // button interaction collector
        const collector = message.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

        collector.on('collect', async i => {
            const cat = categories.find(c => i.customId === `inv_${c.toLowerCase()}`);
            if (!cat) return;
            await i.update({ embeds: [createEmbed(cat)], components: [row] });
        });

        collector.on('end', async () => {
            await interaction.editReply({ components: [] });
        });
    }
};
