const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const commandHandler = require('./command-handler');
const { phoneNumber: PHONE_FOR_PAIR } = require('./config');

const AUTH_DIR = path.resolve('./auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

function extract6DigitFromStr(s) {
  if (!s) return null;
  const digits = String(s).replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  return null;
}

module.exports = async function start() {
  if (!PHONE_FOR_PAIR) {
    console.error('❌ phoneNumber not set in config.js! Cannot start bot.');
    process.exit(1);
  }

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA version v${version.join('.')}, latest: ${isLatest}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: false, // QR disabled
  });

  sock.ev.on('creds.update', saveCreds);

  async function requestPairing() {
    try {
      console.log(`Requesting 6-digit pairing code for ${PHONE_FOR_PAIR}...`);
      const pairing = await sock.requestPairingCode(PHONE_FOR_PAIR);
      const token = extract6DigitFromStr(String(pairing));
      console.log('📲 6-digit pairing token:', token || pairing);
      console.log('👉 Enter this code on WhatsApp -> Linked devices -> Link a device -> Enter code.');
    } catch (err) {
      console.warn('⚠️ Pairing code request failed:', err?.message || err);
    }
  }

  sock.ev.on('connection.update', async (update) => {
    try {
      console.log('connection.update', { ...update });

      // If session is not registered yet, request 6-digit code
      if (!state.creds?.registered) {
        await requestPairing();
      }

      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log('Connection closed, statusCode=', code);
        if (code !== DisconnectReason.loggedOut) {
          console.log('Reconnecting (exiting to let supervisor restart)...');
          setTimeout(() => process.exit(0), 1500);
        } else console.log('Logged out. Delete auth folder to re-scan.');
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected (socket open).');
      }
    } catch (e) {
      console.error('connection.update handler error', e);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages) return;
      const msg = m.messages[0];
      if (!msg.message) return;
      if (msg.key && msg.key.fromMe) return; // ignore own messages
      await commandHandler(msg, sock);
    } catch (e) {
      console.error('messages.upsert error', e);
    }
  });

  global.MRDEV_SOCK = sock;
  console.log('✅ MRDEV_SOCK is available as global.MRDEV_SOCK');

  return sock;
};
