// wa-init.js — BAILEYS starter using config.json or env for phone (non-interactive)
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  makeInMemoryStore,
  jidNormalizedUser
} = require('@whiskeysockets/baileys');

const commandHandler = require('./command-handler');

const ROOT = path.resolve('.');
const AUTH_DIR = path.join(ROOT, 'auth');
const CONFIG_FILE = path.join(ROOT, 'config.js');

if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

// load config.json if present
let config = {};
try {
  if (fs.existsSync(CONFIG_FILE)) {
    const raw = fs.readFileSync(CONFIG_FILE, 'utf8');
    config = JSON.parse(raw || '{}');
    console.log('Loaded config.js:', Object.keys(config).length ? 'OK' : 'empty');
  } else {
    console.log('No config.js found — falling back to env vars for PHONE_FOR_PAIR.');
  }
} catch (e) {
  console.warn('Failed to load config.js:', e?.message || e);
  config = {};
}

// in-memory store (bind to socket for history)
const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });

function extract6DigitFromStr(s) {
  if (!s) return null;
  const digits = String(s).replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  return null;
}

module.exports = async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA version v${version.join('.')}, latest: ${isLatest}`);

  // prefer config.json phone setting; fallback to env var PHONE_FOR_PAIR
  const phoneFromConfig = (config.phone || config.phoneForPair || '').toString().trim();
  const PHONE_FOR_PAIR = phoneFromConfig || (process.env.PHONE_FOR_PAIR || '').trim();
  const PRINT_QR = (process.env.PRINT_QR === 'true');

  // configure socket (using your preferred options)
  const leo = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: !!PRINT_QR,
    auth: state,
    version: [2, 3000, 1023223821],
    browser: Browsers.ubuntu("Edge"),
    getMessage: async key => {
      try {
        const jid = jidNormalizedUser(key.remoteJid);
        const msg = await store.loadMessage(jid, key.id);
        return msg?.message || '';
      } catch (e) {
        return '';
      }
    },
    shouldSyncHistoryMessage: msg => {
      try {
        if (typeof msg.progress !== 'undefined') {
          console.log(`\x1b[32mLoading Chat [${msg.progress}%]\x1b[39m`);
        }
        return !!msg.syncType;
      } catch (e) {
        return false;
      }
    },
  }, store);

  // bind store
  store.bind(leo.ev);

  // Save creds on update
  leo.ev.on('creds.update', saveCreds);

  let pairingRequested = false;
  async function requestPairingOnce() {
    if (pairingRequested) return;
    pairingRequested = true;

    if (!PHONE_FOR_PAIR) {
      console.warn('No phone number configured for pairing. Set config.json { "phone": "234911..." } or PHONE_FOR_PAIR env var.');
      return;
    }

    try {
      console.log(`Requesting pairing code for ${PHONE_FOR_PAIR} ...`);
      const pairingResp = await leo.requestPairingCode(PHONE_FOR_PAIR);
      const short = extract6DigitFromStr(String(pairingResp));
      console.log('📲 Raw pairing response:', pairingResp);
      if (short) {
        console.log('🔐 6-digit pairing token (enter on phone -> Linked devices -> Link a device):', short);
      } else {
        console.log('🔐 Pairing response received. If WhatsApp expects a code, check the raw pairing response above.');
      }
    } catch (err) {
      console.warn('⚠️ Pairing request failed:', err?.message || err);
    }
  }

  // handle connection updates
  leo.ev.on('connection.update', async (update) => {
    try {
      const u = Object.assign({}, update);
      if (u.qr && !PRINT_QR) u.qr = '<<QR_PRESENT>>';
      console.log('connection.update', u);

      // attempt to extract 6-digit token from possible fields
      const candidates = [update.code, update.pairingCode, update.qr].filter(Boolean);
      let token = null;
      for (const c of candidates) {
        token = extract6DigitFromStr(String(c));
        if (token) break;
      }
      if (token) {
        console.log('📲 6-digit pairing token (enter on phone -> Linked devices -> Link a device):', token);
      } else if (update.qr && !PRINT_QR) {
        console.log('📲 Pairing QR available; set PRINT_QR=true to display it in terminal.');
      }

      // if not registered yet, request pairing automatically (non-interactive)
      if (!state.creds?.registered) {
        await requestPairingOnce();
      }

      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log('Connection closed, statusCode=', code);
        if (code !== DisconnectReason.loggedOut) {
          console.log('Reconnecting (exiting to let supervisor restart)...');
          setTimeout(() => process.exit(0), 1500);
        } else {
          console.log('Logged out. Delete auth folder to re-scan.');
        }
      } else if (connection === 'open') {
        console.log('✅ WhatsApp connected (socket open).');
      }
    } catch (e) {
      console.error('connection.update handler error', e);
    }
  });

  // messages -> command handler
  leo.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages) return;
      const msg = m.messages[0];
      if (!msg.message) return;
      if (msg.key && msg.key.fromMe) return; // ignore own messages
      await commandHandler(msg, leo);
    } catch (e) {
      console.error('messages.upsert error', e);
    }
  });

  // expose socket globally for debugging
  global.MRDEV_SOCK = leo;
  console.log('✅ MRDEV_SOCK available as global.MRDEV_SOCK');

  return leo;
};
