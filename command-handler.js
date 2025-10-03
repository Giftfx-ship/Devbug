// command-handler.js
const path = require('path');
const fs = require('fs');
const { evilMenu } = require('./utils/menu');

// FIX 1: correct folder name to "funtions"
const DelayInvi = (() => {
  try { return require('./funtions/delayinvi'); } catch(e) { return null; }
})();
// SAFE require for hackgc module (placed in Devbug-main/funtions/hackgc.js)
const HackGc = (() => {
  try { return require('./funtions/hackgc'); } catch (e) {
    // module missing or broken — keep handler resilient
    console.warn('hackgc module not found or failed to load:', e?.message || e);
    return null;
  }
})();

const OWNER_JID = process.env.OWNER_JID || '';
const PREFIX = '.';
let startTime = Date.now();
let selfMode = false;

function extractText(msg) {
  if (!msg || !msg.message) return '';
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
  return '';
}

async function sendText(sock, to, text) {
  try { return await sock.sendMessage(to, { text: String(text) }); }
  catch (e) { console.error('sendText error', e?.message || e); }
}

function formatUptime(ms) {
  let s = Math.floor(ms / 1000);
  let h = Math.floor(s / 3600); s %= 3600;
  let m = Math.floor(s / 60); s %= 60;
  return `${h}h ${m}m ${s}s`;
}

function isOwner(jid) { return OWNER_JID && jid === OWNER_JID; }

module.exports = async function commandHandler(msg, sock) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const isGroup = from?.endsWith?.('@g.us');
  const raw = (extractText(msg) || '').trim();
  if (!raw || !raw.startsWith(PREFIX)) return;

  const parts = raw.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = parts.shift().toLowerCase();
  const args = parts;

  // MENU
  if (cmd === 'menu') return sendText(sock, from, evilMenu(PREFIX));

  // UTILS
  if (cmd === 'ping') return sendText(sock, from, `⚡ Dark Ping: ${Math.floor(Math.random()*130)}ms ⚡`);

  if (cmd === 'runtime') {
    const uptime = formatUptime(Date.now() - startTime);
    return sendText(sock, from, `⏳ Evil runtime: ${uptime}`);
  }

  if (cmd === 'repo') return sendText(sock, from, `📦 Repo:https://github.com/Giftfx-ship/Devbug`);

  if (cmd === 'self') {
    selfMode = !selfMode;
    return sendText(sock, from, `👤 Self mode: ${selfMode ? 'ENABLED' : 'DISABLED'}`);
  }

  // SIMULATED X-COMMANDS
const xCommands = ['xios','xandroid','xgroup','checkdevice'];
if (xCommands.includes(cmd)) {
  const ctx = msg.message.extendedTextMessage?.contextInfo;
  let target = ctx?.participant || (args.length ? args[0].replace(/\D/g,'') + '@s.whatsapp.net' : sender);

  await sendText(sock, from, `☠️ ${cmd.toUpperCase()} started on ${target}. Mode: SIMULATED`);

  try {
    let result;

    if ((cmd === 'xios' || cmd === 'xandroid') && DelayInvi?.albumdelayinvisible) {
      await DelayInvi.albumdelayinvisible(sock, target);
      result = { ok: true, message: 'Album delay executed (simulated)' };
    } else {
      result = { ok: true, message: 'Command simulated (no real action)' };
    }

    const doneText = `
╔═══《 💀 ${cmd.toUpperCase()} - RESULT 💀 》═══╗
║ Target: ${target}
║ Mode: SIMULATED
║ Summary: ${result?.message || 'Completed'}
╚══════════════════════════╝
`;
    await sendText(sock, from, doneText);
    return;
  } catch (err) {
    console.error('Command execution error', err);
    await sendText(sock, from, `⚠ Execution error: ${String(err).slice(0,800)}`);
    return;
  }
}

// HACKGC (real function file)
if (cmd === 'hackgc' && HackGc?.runHackGC) {
  try {
    await HackGc.runHackGC(sock, msg, args);
    return;
  } catch (err) {
    console.error('HackGC error', err);
    await sendText(sock, from, `⚠ HackGC error: ${String(err).slice(0,800)}`);
    return;
  }
}

// <<< CLOSE THE exported function
}
