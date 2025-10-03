// command-handler.js
const path = require('path');
const fs = require('fs');
const { evilMenu } = require('./utils/menu');

const OWNER_JID = process.env.OWNER_JID || '';
const ENABLE_DANGEROUS = process.env.ENABLE_DANGEROUS === 'true';
const DANGER_KEY = process.env.DANGER_KEY || '';

let Mrdev = null;
const MRDEV_PATH = path.resolve('./Mrdev.js');
if (fs.existsSync(MRDEV_PATH)) {
  try { Mrdev = require(MRDEV_PATH); console.log('✅ Mrdev adapter loaded'); }
  catch (e) { console.warn('⚠ Could not load Mrdev.js', e.message); Mrdev = null; }
} else {
  console.log('ℹ Mrdev.js not present — create it to forward calls to your functions.');
}

// load delayinvi if present
let DelayInvi = null;
try { DelayInvi = require('./delayinvi'); console.log('✅ delayinvi loaded'); } catch(e) { /* absent */ }

function extractText(msg) {
  if (!msg || !msg.message) return '';
  if (msg.message.conversation) return msg.message.conversation;
  if (msg.message.extendedTextMessage && msg.message.extendedTextMessage.text) return msg.message.extendedTextMessage.text;
  if (msg.message.imageMessage?.caption) return msg.message.imageMessage.caption;
  return '';
}

async function sendText(sock, to, text) {
  try { return await sock.sendMessage(to, { text: String(text) }); }
  catch (e) { console.error('sendText error', e?.message || e); }
}

function isOwner(jid) { return OWNER_JID && jid === OWNER_JID; }

function determineExecMode(senderJid, args) {
  // If owner and enabled & first arg equals DANGER_KEY -> real run
  if (isOwner(senderJid) && ENABLE_DANGEROUS && args.length && args[0] === DANGER_KEY) {
    return { simulate: false, args: args.slice(1) };
  }
  return { simulate: true, args };
}

module.exports = async function commandHandler(msg, sock) {
  const from = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const isGroup = from && from.endsWith && from.endsWith('@g.us');
  const raw = (extractText(msg) || '').trim();
  if (!raw) return;
  const prefix = '!';
  if (!raw.startsWith(prefix)) return;

  const parts = raw.slice(prefix.length).trim().split(/\s+/);
  const cmd = parts.shift().toLowerCase();
  const args = parts;

  // Menu
  if (cmd === 'menu') {
    return sendText(sock, from, evilMenu('!'));
  }

  // Utils
  if (cmd === 'ping') return sendText(sock, from, `⚡ Dark Ping: ${Math.floor(Math.random()*130)}ms ⚡`);
  if (cmd === 'runtime') return sendText(sock, from, `⏳ Evil runtime: 0h 0m (stub)`);
  if (cmd === 'repo') return sendText(sock, from, `📦 Repo: add your repo here`);
  if (cmd === 'self') return sendText(sock, from, `👤 Self mode: toggled (simulated)`);

  // x-commands
  const xCommands = ['xios','xandroid','xgroup','hackgc','checkdevice'];
  if (xCommands.includes(cmd)) {
    const exec = determineExecMode(sender, args);
    const simulate = exec.simulate;
    const execArgs = exec.args;

    // determine target: replied user -> context participant, else arg[0], else sender
    const ctx = msg.message.extendedTextMessage?.contextInfo;
    let target = null;
    if (ctx?.participant) target = ctx.participant;
    else if (execArgs.length) {
      const digits = String(execArgs[0]).replace(/\D/g,'');
      if (digits) target = digits + '@s.whatsapp.net';
    } else {
      target = sender;
    }

    // announce start
    await sendText(sock, from, `☠️ ${cmd.toUpperCase()} started on ${target}. Mode: ${simulate ? 'SIMULATE' : 'REAL'}`);

    try {
      let result;
      if ((cmd === 'xios' || cmd === 'xandroid') && DelayInvi && typeof DelayInvi.albumdelayinvisible === 'function') {
        // albumdelayinvisible might have different signatures: support both (sock, target, opts) and (target)
        if (DelayInvi.albumdelayinvisible.length >= 2) {
          // signature (sock, target, opts)
          result = await DelayInvi.albumdelayinvisible(sock, target, { simulate, args: execArgs });
        } else {
          // signature (target) or (target, sock)
          // try call with (target, sock) then (target)
          try { result = await DelayInvi.albumdelayinvisible(target, sock, { simulate, args: execArgs }); }
          catch(e) { result = await DelayInvi.albumdelayinvisible(target, { simulate, args: execArgs }); }
        }
      } else if (Mrdev && typeof Mrdev[`perform${cmd.charAt(0).toUpperCase()+cmd.slice(1)}`] === 'function') {
        // call Mrdev.performX... if present
        const fnName = { xgroup:'performXgroup', hackgc:'performHackGc', checkdevice:'checkDevice' }[cmd] || null;
        if (fnName) result = await Mrdev[fnName](sock, target, { simulate, args: execArgs, issuer: sender });
        else result = { ok:false, error:'mapped function not found' };
      } else if (Mrdev && typeof Mrdev[cmd] === 'function') {
        result = await Mrdev[cmd](sock, target, { simulate, args: execArgs });
      } else {
        // fallback simulation: report group admin list for xgroup/hackgc
        if ((cmd === 'xgroup' || cmd === 'hackgc') && isGroup) {
          try {
            const meta = await sock.groupMetadata(from);
            const admins = (meta?.participants||[]).filter(p => p.admin).map(p=>p.id);
            result = { ok:true, simulated:true, admins };
          } catch(e) {
            result = { ok:false, error: String(e) };
          }
        } else {
          result = { ok:false, error: `No implementation found for ${cmd}. Provide Mrdev.js or delayinvi.js` };
        }
      }

      // final evil UI message after execution
      const doneText = `
╔═══《 💀 ${cmd.toUpperCase()} - RESULT 💀 》═══╗
║ Target: ${target}
║ Mode: ${simulate ? 'SIMULATED' : 'REAL'}
║ Summary: ${result?.message || (result?.ok ? 'Completed' : (result?.error || JSON.stringify(result)))}
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

  // default: unknown
  return;
};
