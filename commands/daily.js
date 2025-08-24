const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

module.exports = {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily reward!'),

    async execute(interaction) {
        const userId = interaction.user.id;

        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error || !profile) {
            return await interaction.reply({
                content: `You don't have a profile, use \`/profile create\` to create one.`,
                ephemeral: true
            });
        }

        const now = new Date();
        const lastClaim = profile.last_daily ? new Date(profile.last_daily) : null;

        // already claimed today
        if (lastClaim && now.toDateString() === lastClaim.toDateString()) {
            return await interaction.reply({
                content: 'You already claimed your daily today!',
                ephemeral: true
            });
        }

        let streak = profile.daily_streak || 0;

        if (lastClaim) {
            const diffDays = Math.floor((now - lastClaim) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) streak++;
            else if (diffDays > 1) streak = 1; // reset streak
        } else {
            streak = 1; // first time claiming
        }

        // scaling
        const BASE_GEMS = 150;
        const GEMS_PER_3_DAYS = 100;
        const BASE_EXP = 50;
        const EXP_PER_DAY = 10;
        const BASE_REROLLS = 1;
        const REROLLS_PER_3_DAYS = 2;

        // rewards
        const streakBonus = Math.floor(streak / 3) * GEMS_PER_3_DAYS;
        const rewardGems = BASE_GEMS + streakBonus;
        const rewardRerolls = BASE_REROLLS + Math.floor(streak / 3) * REROLLS_PER_3_DAYS;
        const rewardExp = BASE_EXP + (streak * EXP_PER_DAY);

        // update data
        const { error: updateError } = await supabase
            .from('profiles')
            .update({
                gems: (profile.gems || 0) + rewardGems,
                trait_rerolls: (profile.trait_rerolls || 0) + rewardRerolls,
                exp: (profile.exp || 0) + rewardExp,
                last_daily: now.toISOString(),
                daily_streak: streak
            })
            .eq('user_id', userId);

        if (updateError) {
            console.error('Supabase update error:', updateError);
            return await interaction.reply({ content: 'Failed to claim daily.', ephemeral: true});
        }

        // build embed
        const embed = new EmbedBuilder()
            .setTitle(`Daily rewards for ${interaction.user.username}`)
            .setThumbnail(interaction.user.displayAvatarURL())
            .addFields(
                { 
                name: '**Currency**', 
                value: `<:Gems:1409160813024907409> Gems: +${rewardGems}\n<:TraitRerolls:1409158948929405022> Trait Rerolls: +${rewardRerolls}` 
            },
            { name: '⭐ EXP', value: `+${rewardExp}` },
            { name: '🔥 Streak', value: `${streak} days` }
            );
        await interaction.reply({ embeds: [embed] });    
    }  
}
