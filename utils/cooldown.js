// store cd
const cooldowns = new Map();

/** 
 * check and apply cd
 * @param {string} userId 
 * @param {string} comamndName
 * @param {string} seconds
 * @returns {number} 
*/

function checkCooldown(userId, commandName, seconds) {
    const key = `${userId}_${commandName}`;
    const now = Date.now();
    const expires = cooldowns.get(key) || 0;

    if (now < expires) {
        return Math.ceil((expires - now) / 1000); // on cd
    }

    cooldowns.set(key, now + seconds * 1000); // set new cd
    return 0; // ready
}

module.exports = { checkCooldown };
