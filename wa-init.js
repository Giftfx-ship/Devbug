// wa-init.js
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');
const commandHandler = require('./command-handler');

const AUTH_DIR = path.resolve('./auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

module.exports = async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`📡 Using WA version v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: true // 🔹 QR displayed in terminal
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('📲 Scan this QR code with WhatsApp to link your bot!');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed, code =', code);
      if (code !== DisconnectReason.loggedOut) {
        console.log('Reconnecting...');
        setTimeout(() => start(), 2000);
      } else {
        console.log('⚠️ Logged out. Delete auth folder to re-scan.');
      }
    } else if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
      try {
        // Send self-message
        const selfId = sock.user.id;
        await sock.sendMessage(selfId, { text: '🤖 Bot started and connected!' });
        console.log('📩 Sent self-message to yourself.');
      } catch (err) {
        console.error('❌ Failed to send self-message:', err);
      }
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages) return;
      const msg = m.messages[0];
      if (!msg.message || msg.key.fromMe) return;
      await commandHandler(msg, sock);
    } catch (e) {
      console.error('messages.upsert error', e);
    }
  });

  global.MRDEV_SOCK = sock;
  console.log('✅ MRDEV_SOCK is available as global.MRDEV_SOCK');

  return sock;
};
