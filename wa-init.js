// bot.js
'use strict';

const path = require('path');
const fs = require('fs');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require('@whiskeysockets/baileys');

const { phoneNumber } = require('./config');
const commandHandler = require('./command-handler');

if (!phoneNumber) {
  throw new Error('You must set phoneNumber in config.js (E.164 including country code, no “+” in storage).');
}

// Auth directory
const AUTH_DIR = path.resolve(__dirname, 'auth');
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

async function start() {
  // load or initialize auth state
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: false,  // we won’t use QR, we’ll use pairing code
    browser: ['Devbug', 'Chrome', '1.0.0'],
  });

  // persist creds updates
  sock.ev.on('creds.update', saveCreds);

  // Pairing logic: if not already registered, request pairing code
  if (!state.creds?.registered) {
    try {
      // phoneNumber in config must be digits only (no “+”)
      const digitsOnly = phoneNumber.replace(/\D/g, '');
      const code = await sock.requestPairingCode(digitsOnly);
      const formatted = code?.match(/.{1,3}/g)?.join('-') || code;
      console.log('📌 Your 6-digit pairing code:', formatted);
      console.log('👉 In WhatsApp mobile: Linked Devices → Use code to link this bot.');
    } catch (err) {
      console.error('❌ requestPairingCode failed:', err);
    }
  }

  // connection updates
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'open') {
      console.log('✅ Connected to WhatsApp');
      // optionally send a self message
      (async () => {
        try {
          if (sock.user && sock.user.id) {
            await sock.sendMessage(sock.user.id, { text: '🤖 Bot online' });
          }
        } catch (e) {
          console.warn('Warning: cannot send self message:', e);
        }
      })();
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('☠️ Disconnected, status code =', code);
      if (code !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconnecting...');
        setTimeout(() => start().catch(e => console.error('Restart failed:', e)), 2000);
      } else {
        console.log('⚠️ Logged out. Remove auth folder to relink.');
      }
    }
  });

  // message listener
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || !m.messages[0]) return;
      const msg = m.messages[0];
      if (!msg.message) return;
      if (msg.key?.fromMe) return;  // ignore our own messages
      await commandHandler(msg, sock);
    } catch (err) {
      console.error('messages.upsert error:', err);
    }
  });

  // expose globally for debugging if needed
  global.CPHER_SOCK = sock;

  return sock;
}

module.exports = { start };

// If run directly:
if (require.main === module) {
  start().catch(err => {
    console.error('bot start error:', err);
    process.exit(1);
  });
}
