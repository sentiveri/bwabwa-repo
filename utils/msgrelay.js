module.exports = async (message) => {
  console.log("MESSAGE DETECTED");

  if (!message.client.relayEnabled) {
    console.log("Relay disabled");
    return;
  }

  // CRITICAL: Ignore if the message was sent by this bot OR any webhook owned by this bot
  if (message.author.id === message.client.user.id || message.webhookId) {
    console.log("Ignored self-message or webhook to prevent looping");
    return;
  }

  const TARGET_CHANNELS = [
    process.env.TARGET1,
  ];

  for (const channelId of TARGET_CHANNELS) {
    // If the message is already in the target channel, do nothing
    if (message.channel.id === channelId) {
      console.log("Source is same as Target, skipping to avoid loop");
      continue;
    }

    try {
      console.log("Relaying to:", channelId);

      const channel = await message.client.channels.fetch(channelId);

      if (!channel) {
        console.log("Target channel not found");
        continue;
      }

      // Safeguard: Ensure we aren't sending an entirely empty payload
      if (!message.content && message.embeds.length === 0 && message.attachments.size === 0) {
        console.log("Empty message payload, skipping");
        continue;
      }

      await channel.send({
        content: message.content || null,
        embeds: message.embeds,
        files: [...message.attachments.values()]
      });

      console.log("Sent successfully");

    } catch (err) {
      console.log("Error relaying message:", err);
    }
  }
};