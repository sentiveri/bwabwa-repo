const cooldown = new Map();
const cooldownTime = 5000;

module.exports = {
    name: "uraraGIF",
    description: "Send the urara dead GIF... For some reason.",
    triggers: ["urara", "haru", "gone", "angels", "cement"],
    gifUrl: "https://cdn.discordapp.com/attachments/972654563884662784/1395816376366661673/uragone.gif?ex=68abf18d&is=68aaa00d&hm=367521177746501ed5a7949e02873a1ab699a6cbd8ec5cfad0418bca478cfc6b&",

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