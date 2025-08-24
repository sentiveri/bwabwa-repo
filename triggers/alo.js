const cooldown = new Map();
const cooldownTime = 5000;

module.exports = {
    name: "aloGIF",
    description: "Send the alo GIF... For some reason.",
    triggers: ["ogugu", "oguri", "cap", "ali", "alo"],
    gifUrl: "https://cdn.discordapp.com/attachments/1392828300803440730/1408327318056730724/attachment.gif?ex=68abf986&is=68aaa806&hm=ac7f0d5fb321c753876e383a602db60838258a618e3a9a1a2b62c90e56bd09e5&",

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