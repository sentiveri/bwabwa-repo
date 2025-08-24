const cooldown = new Map();
const cooldownTime = 5000;

module.exports = {
    name: "donGIF",
    description: "Send the Don Quixote exploding head GIF... For some reason.",
    triggers: ["don", "quixote"],
    gifUrl: "https://cdn.discordapp.com/attachments/1018157222393557125/1302001387005018112/togif.gif?ex=68aac888&is=68a97708&hm=6bf9ddcb5b54734b0ec9b714fb5bc302f59c87ea7c12837714b0002cd498062b&",

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