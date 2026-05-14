module.exports = async (message) => {

  const SOURCE_CHANNEL =
    process.env.SOURCE_CHANNEL;

  const TARGET_CHANNELS = [
    process.env.TARGET1,
  ];

  if (message.author.id === message.client.user.id) return;

  if (message.channel.id !== SOURCE_CHANNEL) return;

  for (const channelId of TARGET_CHANNELS) {

    try {

      const channel =
        await message.client.channels.fetch(channelId);

      if (!channel) continue;

      await channel.send({
        content: message.content || null,
        embeds: message.embeds,
        files: [...message.attachments.values()]
      });

    } catch (err) {
      console.log(err);
    }
  }
};