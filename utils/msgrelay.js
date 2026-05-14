module.exports = async (message) => {

  console.log("MESSAGE DETECTED");

  if (!message.client.relayEnabled) {
    console.log("Relay disabled");
    return;
  }

  const SOURCE_CHANNEL =
    process.env.SOURCE_CHANNEL;

  console.log("Channel:", message.channel.id);
  console.log("Source:", SOURCE_CHANNEL);

  const TARGET_CHANNELS = [
    process.env.TARGET1,
  ];

  if (message.author.id === message.client.user.id) {
    console.log("Own bot message ignored");
    return;
  }

  if (message.channel.id !== SOURCE_CHANNEL) {
    console.log("Wrong source channel");
    return;
  }

  console.log("Passing checks");

  for (const channelId of TARGET_CHANNELS) {

    try {

      console.log("Sending to:", channelId);

      const channel =
        await message.client.channels.fetch(channelId);

      if (!channel) {
        console.log("Channel not found");
        continue;
      }

      await channel.send({
        content: message.content || null,
        embeds: message.embeds,
        files: [...message.attachments.values()]
      });

      console.log("Sent successfully");

    } catch (err) {
      console.log(err);
    }
  }
};