const path = require('path');
const fs = require('fs');
const pino = require('pino');
const readline = require('readline');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const commandHandler = require('./command-handler');
const { phoneNumber } = require('./config');

const AUTH_DIR = path.resolve('./auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// Helper to prompt in terminal (if needed)
function askConsole(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

// Extract 6-digit code from string
function extract6DigitFromStr(s) {
  if (!s) return null;
  const digits = String(s).replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(0, 6) : null;
}

module.exports = async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`📡 Using WA version v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: false // no QR, 6-digit only
  });

  sock.ev.on('creds.update', saveCreds);

  // Request 6-digit pairing code
  async function request6Digit() {
    try {
      console.log(`📲 Requesting 6-digit pairing code for ${phoneNumber}...`);
      const pairing = await sock.requestPairingCode(phoneNumber);
      const shortCode = extract6DigitFromStr(String(pairing));

      console.log('🔐 6-digit pairing token received:', shortCode);
      console.log('👉 Use this code in WhatsApp → Linked Devices → Link a Device → Enter Code');
    } catch (err) {
      console.warn('⚠️ Pairing code request failed:', err?.message || err);
    }
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    console.log('connection.update', update);

    // Only request 6-digit if not registered
    if (!state.creds?.registered) {
      await request6Digit();
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
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages) return;
    const msg = m.messages[0];
    if (!msg.message || (msg.key && msg.key.fromMe)) return;

    try {
      await commandHandler(msg, sock);
    } catch (err) {
      console.error('messages.upsert error:', err);
    }
  });

  global.MRDEV_SOCK = sock;
  console.log('⚡ MRDEV_SOCK available globally');
};
