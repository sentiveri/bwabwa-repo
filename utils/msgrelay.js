module.exports = async (message) => {
  console.log(`[${message.client.instanceId}] MESSAGE DETECTED`);

  if (!message.client.relayEnabled) return;

  if (message.author.id === message.client.user.id) {
    console.log(`[${message.client.instanceId}] Ignored self-message`);
    return;
  }

  const targetChannelId = process.env.TARGET1;

  if (message.channel.id === targetChannelId) {
    console.log(`[${message.client.instanceId}] Source is same as Target, skipping`);
    return;
  }

  if (!message.content && message.embeds.length === 0 && message.attachments.size === 0) {
    console.log(`[${message.client.instanceId}] Empty message payload, skipping`);
    return;
  }

  try {
    console.log(`[${message.client.instanceId}] Relaying to:`, targetChannelId);
    const channel = await message.client.channels.fetch(targetChannelId);

    if (!channel) {
      console.log(`[${message.client.instanceId}] Target channel not found`);
      return;
    }

    const embedsToSend = message.embeds.map(embed => embed.toJSON());

    await channel.send({
      content: message.content || null,
      embeds: embedsToSend,
      files: [...message.attachments.values()]
    });

    console.log(`[${message.client.instanceId}] Sent successfully`);
  } catch (err) {
    console.error(`[${message.client.instanceId}] Error relaying message:`, err);
  }
};