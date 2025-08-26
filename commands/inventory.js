const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { ButtonBuilder } = require('discord.js');
const { checkCooldown } = require('../utils/cooldown.js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

const categories = ['Weapon', 'Armor', 'Consumable', 'Artifact'];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('item')
        .setDescription('Manage your items.')
        .addSubcommand(sub => sub
            .setName('view')
            .setDescription('View your items.')
            .addStringOption(option =>
                option.setName('category')
                        .setDescription('Category to view.')  
                        .setRequired(false)
                        .addChoices(
                            { name: 'Weapon', value: 'Weapon' },
                            { name: 'Armor', value: 'Armor' },
                            { name: 'Consumable', value: 'Consumable' },
                            { name: 'Artifact', value: 'Artifact' }
                        )
            )
        )
        .addSubcommand(sub => sub
            .setName('equip')
            .setDescription('Equip an item in your inventory.')
            .addStringOption(option => 
                option.setName('name')
                      .setDescription('Name of the item to equip.')
                      .setRequired(true)
            )
        )
         .addSubcommand(sub => sub
            .setName('unequip')
            .setDescription('Unequip an item in your inventory.')
            .addStringOption(option => 
                option.setName('name')
                      .setDescription('Name of the item to unequip.')
                      .setRequired(true)
            )
        ),

    async execute(interaction) {
        const cooldown = checkCooldown(interaction.user.id, 'inventory', 5);
        if (cooldown > 0) {
            return interaction.reply({
                content: `You must wait **${cooldown}s** before using this again.`,
                ephemeral: true
            });
        }
        const sub = interaction.options.getSubcommand();
        const user = interaction.user;
        const userId = user.id;

        if (sub === 'view') {
            await interaction.deferReply();

            const { data: userItems, error } = await supabase
                .from('user_equipment')
                .select('is_equipped, equipment(item_name, category)')
                .eq('user_id', userId);

            if (error) {
                console.error('Supabase fetch error', error);
                return await interaction.editReply({ content: 'Failed to fetch inventory' });
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
            };

            const row = new ActionRowBuilder().addComponents(
                categories.map(cat => new ButtonBuilder()
                    .setCustomId(`inv_${cat.toLowerCase()}`)
                    .setLabel(cat)
                    .setStyle(ButtonStyle.Primary)
                )
            );

            const message = await interaction.editReply({ embeds: [createEmbed(categories[0])], components: [row] });

            const collector = message.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id, time: 60000 });

            collector.on('collect', async i => {
                const cat = categories.find(c => i.customId === `inv_${c.toLowerCase()}`);
                if (!cat) return;
                await i.update({ embeds: [createEmbed(cat)], components: [row] });
            });

            collector.on('end', async () => {
                await interaction.editReply({ components: [] });
            });
            
        } else if (sub === 'equip' || sub === 'unequip') {
            const search = interaction.options.getString('name');

            // fetch all items
            const { data: items, error } = await supabase
                .from('user_equipment')
                .select('id, is_equipped, equipment(item_name, slot, category)')
                .eq('user_id', userId);
             
            if (error) {
                console.error(error);
                return interaction.reply({ content: 'Failed to fetch items.', ephemeral: true });
            }     

            // fuzzy match prio: exact -> starts with -> includes
            function normalize(str) {
                return str.toLowerCase().replace(/[^a-z0-9]/g, ''); 
            }

            const searchLower = normalize(search);

            let found = items.find(i => normalize(i.equipment.item_name) === searchLower);
            if (!found) found = items.find(i => normalize(i.equipment.item_name).startsWith(searchLower));
            if (!found) found = items.find(i => normalize(i.equipment.item_name).includes(searchLower));

            if (!found) {
                return interaction.reply({ content: `No item found matching "${search}".`, ephemeral: true});
            }

            if (sub === 'equip') {
                // make sure only 1 item is equipped per slot
                const sameSlot = items.filter(i =>
                    i.equipment.slot === found.equipment.slot &&
                    i.is_equipped === true
                );

                // unequip if already equipped in that slot
                if (sameSlot.length > 0) {
                    await supabase.from('user_equipment')
                        .update({ is_equipped: false })
                        .in('id', sameSlot.map(i => i.id))
                        .eq('user_id', userId);
                }

                // equip with new 
                await supabase.from('user_equipment')
                    .update({ is_equipped: true })
                    .eq('id', found.id)
                    .eq('user_id', userId);

                return interaction.reply({ content: `Equipped **${found.equipment.item_name}**!`, ephemeral: true});

            } else {
                // unequip specific item
                await supabase.from('user_equipment')
                    .update({ is_equipped: false })
                    .eq('id', found.id)
                    .eq('user_id', userId);
                
                return interaction.reply({ content: `Unequipped **${found.equipment.item_name}**!`, ephemeral: true});
            }
        }
    }
};
      