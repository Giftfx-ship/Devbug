import isAdmin from "../lib/isadmin.js";

export default {
  name: "hackgc",
  alias: ["groupsteal", "takeover"],
  desc: "Forcefully remove all other admins and keep only yourself + bot as admin",
  group: true,
  admin: true,
  botAdmin: true,

  async execute(sock, message, { groupMetadata }) {
    try {
      const sender = message.sender;
      const botId = sock.user.id;

      // ✅ Check admin status
      const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, message.chat, sender);

      if (!isSenderAdmin) {
        return sock.sendMessage(message.chat, {
          text: "❌ You are not an admin — you can’t hijack this group.",
        }, { quoted: message });
      }

      if (!isBotAdmin) {
        return sock.sendMessage(message.chat, {
          text: "❌ I need to be admin to hijack the group.",
        }, { quoted: message });
      }

      const participants = groupMetadata.participants;

      // ✅ Find other admins except sender and bot
      const adminsToDemote = participants
        .filter(p => (p.admin === "admin" || p.admin === "superadmin") && p.id !== sender && p.id !== botId)
        .map(p => p.id);

      if (adminsToDemote.length === 0) {
        return sock.sendMessage(message.chat, {
          text: "ℹ️ No other admins left to remove.",
        }, { quoted: message });
      }

      // ✅ Demote all other admins
      for (const adminId of adminsToDemote) {
        await sock.groupParticipantsUpdate(message.chat, [adminId], "demote");
      }

      // ✅ Evil styled success message
      await sock.sendMessage(message.chat, {
        text:
          `☠️ *GROUP HIJACKED SUCCESSFULLY* ☠️\n\n` +
          `> All other admins have been demoted\n` +
          `> Only YOU and the BOT remain in power ⚡\n\n` +
          `💀 Enjoy your reign...`,
      }, { quoted: message });

    } catch (err) {
      console.error("❌ HackGC error:", err);
      await sock.sendMessage(message.chat, {
        text: "❌ Hack attempt failed — missing permissions or unexpected error.",
      }, { quoted: message });
    }
  }
};
