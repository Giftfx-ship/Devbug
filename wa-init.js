const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
} = require('@whiskeysockets/baileys');
const commandHandler = require('./command-handler');
const { phoneNumber } = require('./config');

const AUTH_DIR = path.resolve('./auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

module.exports = async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: false, // disable QR, we’ll use pairing code
    browser: ['CypherBot', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  // connection updates
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'connecting' && !state.creds?.registered) {
      try {
        const digitsOnly = phoneNumber.replace(/\D/g, '');
        const code = await sock.requestPairingCode(digitsOnly);
        const formatted = code?.match(/.{1,3}/g)?.join('-') || code;
        console.log('📌 Your 6-digit WhatsApp pairing code:', formatted);
        console.log('👉 Enter this on WhatsApp: Linked Devices → Add device → Use code');
      } catch (err) {
        console.error('❌ Failed to get pairing code:', err);
      }
    }

    if (connection === 'open') {
      console.log('✅ WhatsApp connected!');
      try {
        if (sock.user?.id) {
          await sock.sendMessage(sock.user.id, { text: '🤖 Bot connected successfully!' });
          console.log('📩 Sent self-message to yourself.');
        }
      } catch (err) {
        console.error('❌ Failed to send self-message:', err);
      }
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed, code =', code);
      if (code !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconnecting...');
        setTimeout(() => start(), 2000);
      } else {
        console.log('⚠️ Logged out. Delete auth folder to re-scan.');
      }
    }
  });

  // message handler
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

  global.CYPHER_SOCK = sock;
  console.log('✅ CYPHER_SOCK is available as global.CYPHER_SOCK');

  return sock;
};
