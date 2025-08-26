const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');
const { checkCooldown } = require('../utils/cooldown.js')

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription(`Manage your profile.`)
        .addSubcommand(sub => sub.setName('create').setDescription('Create your profile.'))
        .addSubcommand(sub => sub.setName('delete').setDescription('Delete your profile.'))
        .addSubcommand(sub => 
            sub.setName('view')
               .setDescription('View a profile')
               .addUserOption(option => 
                   option.setName('user').setDescription('The user to view').setRequired(false)
               )
        ),

    async execute(interaction) {
        const cooldown = checkCooldown(interaction.user.id, 'profile', 5);
        if (cooldown > 0) {
            return interaction.reply({
                content: `You must wait **${cooldown}s** before using this again.`,
                ephemeral: true
            });
        }

        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user') || interaction.user;
        const userId = user.id;

        // CREATE PROFILE
        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });

            const { data: existing, error: fetchError } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (fetchError) {
                console.error(fetchError);
                return interaction.editReply({ content: 'Error checking existing profile.' });
            }

            if (existing) return interaction.editReply({ content: 'You already have a profile!' });

            const { error: insertError } = await supabase
                .from('profiles')
                .insert([{ user_id: userId, gems: 0, trait_rerolls: 0, level: 1, exp: 0 }]);

            if (insertError) {
                console.error(insertError);
                return interaction.editReply({ content: 'Failed to create profile.' });
            }

            // Starter equipment
            const starterItems = [`Vagabond's Hood`, `Vagabond's Tunic`, `Vagabond's Trousers`, `Vagabond's Boots`];
            const { data: equipmentData, error: eqFetchError } = await supabase
                .from('equipment')
                .select('id')
                .in('item_name', starterItems);

            if (eqFetchError) console.error(eqFetchError);

            if (equipmentData?.length > 0) {
                const inserts = equipmentData.map(item => ({
                    user_id: userId,
                    equipment_id: item.id,
                    is_equipped: false
                }));
                const { error: eqInsertError } = await supabase.from('user_equipment').insert(inserts);
                if (eqInsertError) console.error(eqInsertError);
            }

            return interaction.editReply({ content: 'Profile created! You have received starter items, use `/inventory` to check them.' });
        }

        // DELETE PROFILE
        if (sub === 'delete') {
            const { data: existing, error: fetchError } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (fetchError) {
                console.error(fetchError);
                return interaction.reply({ content: 'Error checking your profile.', ephemeral: true });
            }

            if (!existing) return interaction.reply({ content: `You don't have a profile to delete.`, ephemeral: true });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('confirm_delete').setLabel('Confirm').setStyle(ButtonStyle.Danger),
                new ButtonBuilder().setCustomId('cancel_delete').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.reply({
                content: 'Are you sure you want to delete your profile? This cannot be undone.',
                components: [row],
                ephemeral: true
            });

            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === userId,
                max: 1,
                time: 15000
            });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_delete') {
                    const { error: deleteError } = await supabase.from('profiles').delete().eq('user_id', userId);
                    if (deleteError) console.error(deleteError);
                    return i.update({ content: 'Profile deleted.', components: [] });
                } else {
                    return i.update({ content: 'Profile deletion canceled.', components: [] });
                }
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    await interaction.editReply({ content: 'Profile deletion timed out.', components: [] });
                }
            });
        }

        // VIEW PROFILE
        if (sub === 'view') {
            if (user.bot) return interaction.reply({ content: `You cannot view a bot's profile.`, ephemeral: true });

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error(error);
                return interaction.reply({ content: 'Failed to fetch profile.', ephemeral: true });
            }

            if (!profile) return interaction.reply({ content: `No profile found. Use /profile create.`, ephemeral: true });

            const { data: equipment, error: eqError } = await supabase
                .from('user_equipment')
                .select(`is_equipped, equipment(item_name, slot, stat_bonus)`)
                .eq('user_id', userId);

            if (eqError) console.error(eqError);

            const slots = ['head', 'chest', 'legs', 'feet', 'ring', 'necklace'];
            const equippedMap = {};

            for (const slot of slots) {
                const item = equipment?.find(e => e.equipment?.slot === slot && e.is_equipped);
                equippedMap[slot] = item?.equipment?.item_name || 'None';
            }

            // Power & level calculations
            const getMaxExp = level => 350 + 100 * (level - 1);
            let level = profile.level || 1;
            let remainingExp = profile.exp || 0;
            while (remainingExp >= getMaxExp(level)) {
                remainingExp -= getMaxExp(level);
                level++;
            }

            let power = 0;
            for (const item of equipment || []) {
                if (!item.equipment || !item.is_equipped) continue;
                for (const key in item.equipment.stat_bonus || {}) power += item.equipment.stat_bonus[key];
            }
            power += Math.floor(level / 5) * 10 + (level % 5) * 5;

            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Profile`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                    { name: 'General', value: `**Level**: ${level} (${remainingExp}/${getMaxExp(level)})\n**Power**: ${power}`, inline: false },
                    { name: 'Currency', value: `<:Gems:1409160813024907409> **Gems**: ${profile.gems || 0}\n<:TraitRerolls:1409158948929405022> **Trait Rerolls**: ${profile.trait_rerolls || 0}`, inline: false },
                    { name: 'Equipment', value: slots.map(s => `**${s.charAt(0).toUpperCase() + s.slice(1)}:** ${equippedMap[s]}`).join('\n'), inline: false },
                )
                .setFooter({ text: `🔥 Daily Streak: ${profile.daily_streak || 0} days` }) 
                .setColor('Blue')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }
};
