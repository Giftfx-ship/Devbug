/**
 * Check if the sender and the bot are admins in a group.
 * @param {object} sock - Baileys socket instance
 * @param {string} chatId - Group chat ID (must end with "@g.us")
 * @param {string} senderId - Message sender JID
 * @returns {Promise<{isSenderAdmin: boolean, isBotAdmin: boolean}>}
 */
async function isAdmin(sock, chatId, senderId) {
  try {
    if (!chatId.endsWith("@g.us")) {
      return { isSenderAdmin: false, isBotAdmin: false };
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata?.participants || [];

    // Handle Baileys v4 style ids
    const botId = sock.user?.id?.split(":")[0] + "@s.whatsapp.net";

    // Normalize IDs (sometimes they come with device suffixes)
    const normalize = jid => jid?.split(":")[0];

    const sender = participants.find(p => normalize(p.id) === normalize(senderId));
    const bot = participants.find(p => normalize(p.id) === normalize(botId));

    const isSenderAdmin = sender?.admin === "admin" || sender?.admin === "superadmin";
    const isBotAdmin = bot?.admin === "admin" || bot?.admin === "superadmin";

    return { isSenderAdmin, isBotAdmin };
  } catch (error) {
    console.error("❌ Error in isAdmin helper:", error);
    return { isSenderAdmin: false, isBotAdmin: false };
  }
}

module.exports = isAdmin;
