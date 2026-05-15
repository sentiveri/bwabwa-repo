module.exports = async (message) => {
  console.log("MESSAGE DETECTED");

  if (!message.client.relayEnabled) {
    console.log("Relay disabled");
    return;
  }

  if (message.author.id === message.client.user.id) {
    console.log("Own bot message ignored");
    return;
  }

  const TARGET_CHANNELS = [
    process.env.TARGET1,
  ];

  for (const channelId of TARGET_CHANNELS) {
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