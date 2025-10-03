const path = require('path');
const fs = require('fs');
const readline = require('readline');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');
const commandHandler = require('./command-handler');
const { phoneNumber } = require('./config');

const AUTH_DIR = path.resolve('./auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

async function isValidPhoneNumber(number) {
  try {
    const pkg = require('google-libphonenumber');
    const phoneUtil = pkg.PhoneNumberUtil.getInstance();
    const parsedNumber = phoneUtil.parseAndKeepRawInput(number);
    return phoneUtil.isValidNumber(parsedNumber);
  } catch {
    return false;
  }
}

module.exports = async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  console.log(`📡 Using WA version v${version.join('.')}`);

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: false, // we will use 6-digit pairing code
    browser: ['MrDevbot', 'Edge', '20.0.04'],
  });

  sock.ev.on('creds.update', saveCreds);

  // 6-digit pairing logic
  if (!state.creds?.registered) {
    let addNumber;
    if (phoneNumber) {
      addNumber = phoneNumber.replace(/\D/g, '');
    } else {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      do {
        addNumber = await new Promise(resolve => {
          rl.question('📲 Enter your WhatsApp number with country code (+521234567890): ', resolve);
        });
        addNumber = addNumber.trim();
        if (!addNumber.startsWith('+')) addNumber = `+${addNumber}`;
      } while (!(await isValidPhoneNumber(addNumber)));
      rl.close();
      addNumber = addNumber.replace(/\D/g, '');
    }

    const code = await sock.requestPairingCode(addNumber);
    const formattedCode = code?.match(/.{1,3}/g)?.join('-') || code;
    console.log('📌 Your 6-digit WhatsApp pairing code:', formattedCode);
    console.log('Enter this code on your WhatsApp mobile to link the bot.');
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;

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
        // Self-message
        const selfId = sock.user.id;
        await sock.sendMessage(selfId, { text: '🤖 Bot connected successfully!' });
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
