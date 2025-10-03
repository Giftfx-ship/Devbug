// commands/hackgc.js  (CommonJS version)
const isAdmin = require('../lib/isadmin');

module.exports = {
  name: 'hackgc',
  alias: ['groupsteal', 'takeover'],
  desc: 'Forcefully remove all other admins and keep only yourself + bot as admin',
  group: true,
  admin: true,
  botAdmin: true,

  async execute(sock, message, { groupMetadata } = {}) {
    try {
      const sender = message.sender || message.key?.participant || message.key?.fromMe;
      const botId = sock.user && (sock.user.id || sock.user?.jid) ? (sock.user.id || sock.user.jid) : null;

      // Validate we have group metadata
      if (!groupMetadata) {
        // try to fetch group metadata if your command handler didn't pass it
        if (typeof sock.groupMetadata === 'function') {
          groupMetadata = await sock.groupMetadata(message.chat || message.key?.remoteJid);
        }
      }

      // ✅ Check admin status
      const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, message.chat || message.key?.remoteJid, sender);

      if (!isSenderAdmin) {
        return await sock.sendMessage(message.chat || message.key?.remoteJid, {
          text: "❌ You are not an admin — you can’t hijack this group.",
        }, { quoted: message });
      }

      if (!isBotAdmin) {
        return await sock.sendMessage(message.chat || message.key?.remoteJid, {
          text: "❌ I need to be admin to hijack the group.",
        }, { quoted: message });
      }

      const participants = (groupMetadata && groupMetadata.participants) || [];

      // ✅ Find other admins except sender and bot
      const adminsToDemote = participants
        .filter(p => {
          const isAdminFlag = p.admin === 'admin' || p.admin === 'superadmin';
          const id = p.id || p.jid || p;
          return isAdminFlag && id !== sender && id !== botId;
        })
        .map(p => (p.id || p.jid || p));

      if (adminsToDemote.length === 0) {
        return await sock.sendMessage(message.chat || message.key?.remoteJid, {
          text: "ℹ️ No other admins left to remove.",
        }, { quoted: message });
      }

      // ✅ Demote all other admins (Baileys expects jid array)
      // groupParticipantsUpdate(jid, participants, action)
      for (const adminId of adminsToDemote) {
        try {
          await sock.groupParticipantsUpdate(message.chat || message.key?.remoteJid, [adminId], 'demote');
        } catch (err) {
          console.warn(`Failed to demote ${adminId}:`, err && err.message ? err.message : err);
        }
      }

      // ✅ Evil styled success message
      await sock.sendMessage(message.chat || message.key?.remoteJid, {
        text:
          `☠️ *GROUP HIJACKED SUCCESSFULLY* ☠️\n\n` +
          `> All other admins have been demoted\n` +
          `> Only YOU and the BOT remain in power ⚡\n\n` +
          `💀 Enjoy your reign...`,
      }, { quoted: message });

    } catch (err) {
      console.error('❌ HackGC error:', err);
      try {
        await sock.sendMessage(message.chat || message.key?.remoteJid, {
          text: "❌ Hack attempt failed — missing permissions or unexpected error.",
        }, { quoted: message });
      } catch (sendErr) {
        console.error('Also failed to notify chat of error:', sendErr);
      }
    }
  }
};
