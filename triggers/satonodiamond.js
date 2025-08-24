const cooldown = new Map();
const cooldownTime = 5000;

module.exports = {
    name: "satonoGIF",
    description: "Send the Satono Diamond freaky image... For some reason.",
    triggers: ["satono", "dia", "mond"],
    gifUrl: "https://cdn.discordapp.com/attachments/1392828300803440730/1408777099157835896/FB_IMG_1754669133817.jpg?ex=68aaf96a&is=68a9a7ea&hm=2afa7dac83f25179721e30c80733c3c850e173d0c55713138e51a778edde6420&",

    async execute(message) {
        const userId = message.author.id;
        const now = Date.now();

        if (cooldown.has(userId)) {
            const lastUsed = cooldown.get(userId);
            if (now - lastUsed < cooldownTime) return;
        }

        const messageContent = message.content.toLowerCase();

        // Check if any trigger matches in message content only
        const matched = this.triggers.some(trigger => {
            const lowerTrigger = trigger.toLowerCase();
            return messageContent.includes(lowerTrigger);
        });

        if (!matched) return;

        cooldown.set(userId, now);

        await message.channel.send(this.gifUrl);

        // Uncomment if you want the GIF to auto-delete after 2 seconds
        // setTimeout(() => {
        //     if (sent.deletable) sent.delete().catch(() => {});
        // }, 2000);
    }
};