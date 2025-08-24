const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription(`Manage your profile.`)
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create your profile.'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('delete')
                .setDescription('Delete your profile.'))
        .addSubcommand(subcommand => 
            subcommand
                .setName('view')
                .setDescription('View a profile')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to view')
                        .setRequired(false)
                )),

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const user = interaction.options.getUser('user') || interaction.user;
        const userId = user.id;

        // create
        if (sub === 'create') {
            await interaction.deferReply({ ephemeral: true });

            const { data: existing, error: fetchError } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', userId)
                .maybeSingle();

            if (fetchError) {
                console.error('Supabase fetch error:', fetchError);
                return await interaction.editReply({ content: 'Error checking existing profile.' });
            }

            if (existing) {
                return await interaction.editReply({ content: 'You already have a profile!' });
            }

            const { data, error: insertError } = await supabase
                .from('profiles')
                .insert([{ 
                    user_id: userId,
                    gems: 0,
                    trait_rerolls: 0,
                    level: 1,
                    exp: 0
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Supabase insert error:', insertError);
                return await interaction.editReply({ content: 'Failed to create profile.' });
            }

            await interaction.editReply({ content: 'Profile created successfully!' });
        }

        // delete
        if (sub === 'delete') {
            const { data: existing, error: fetchError } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', interaction.user.id)
                .maybeSingle();
        
            if (fetchError) {
                console.error('Supabase fetch error:', fetchError);
                return await interaction.reply({ content: 'Error checking your profile.', ephemeral: true });
            }

            if (!existing) {
                return await interaction.reply({ content: `You don't have a profile to delete.`, ephemeral: true });
            }

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_delete')
                    .setLabel('Confirm')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_delete')    
                    .setLabel('Cancel')
                    .setStyle(ButtonStyle.Secondary)
            );

            const message = await interaction.reply({
                content: 'Are you sure you want to **delete your profile**? This cannot be undone.',
                components: [row],
                ephemeral: true
            });

            const collector = message.createMessageComponentCollector({
                filter: i => i.user.id === interaction.user.id,
                time: 15000,
                max: 1
            });

            collector.on('collect', async i => {
                if (i.customId === 'confirm_delete') {
                    // delete profile
                    const { error: deleteError } = await supabase
                        .from('profiles')
                        .delete()
                        .eq('user_id', interaction.user.id);

                    if (deleteError) {
                        console.error('Supabase delete error: ', deleteError);
                        return await i.update({ content: 'Failed to delete profile.', components: [] });
                    }

                    await i.update({ content: 'Your profile has been deleted.', components: [] });
                } else {
                    await i.update({ content: 'Profile deletion canceled.', components: [] });
                }    
            });

            collector.on('end', async collected => {
                if (collected.size === 0) {
                    await interaction.editReply({   
                        content: 'Profile deletion timed out.',
                        components: []
                    });
                } 
            });
        }

        // view
        if (sub === 'view') {
            // prevent bot profiles
            if (user.bot) {
                return await interaction.reply({
                    content: `You cannot view a bot's profile.`,
                    ephemeral: true
                });
            }

            const { data: profile, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', userId)
                .maybeSingle();

            if (error) {
                console.error('Supabase fetch error', error);
                return await interaction.reply({
                    content: 'Failed to fetch profile',
                    ephemeral: true
                });
            }

            if (!profile) {
                return await interaction.reply({
                    content: `You don't have a profile, use \`/profile create\` to create one.`,
                    ephemeral: true
                });
            }

            function getMaxExp(level) {
                return 350 + 100 * (level - 1);
            }

            function calculateLevel(exp) {
                let level = profile.level || 1; 
                let remainingExp = exp;

                while (remainingExp >= getMaxExp(level)) {
                    remainingExp -= getMaxExp(level);
                    level++;
                }

                while (level > 1 && remainingExp < 0) {
                    level--;
                    remainingExp += getMaxExp(level - 1); 
                }

                return { level, remainingExp: Math.max(0, remainingExp) }; 
            }

            const currentExp = profile.exp || 0;
            const { level: calculatedLevel, remainingExp } = calculateLevel(currentExp);
            const maxExp = getMaxExp(calculatedLevel);

            if (calculatedLevel !== profile.level) {
                const { error: updateError } = await supabase
                    .from('profiles')
                    .update({ level: calculatedLevel, exp: remainingExp })
                    .eq('user_id', userId);
                if (updateError) {
                    console.error('Supabase update error', updateError); 
                }
            }

            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Profile`)
                .setThumbnail(user.displayAvatarURL())
                .addFields(
                { 
                    name: 'General', 
                    value: `Level: ${calculatedLevel} (${remainingExp.toLocaleString()}/${maxExp.toLocaleString()})`, 
                    inline: true 
                },
                {
                    name: 'Currency', 
                    value: `<:Gems:1409160813024907409> Gems: ${profile.gems || 0}\n<:TraitRerolls:1409158948929405022> Trait Rerolls: ${profile.trait_rerolls || 0}`, 
                    inline: false 
                }
                )
                .setColor('Blue')
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    },
};