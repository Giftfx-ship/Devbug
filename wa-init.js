// wa-init.js
const path = require('path');
const fs = require('fs');
const pino = require('pino');
const readline = require('readline');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const commandHandler = require('./command-handler');

const AUTH_DIR = path.resolve('./auth'); // persist this on your host
if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

function extract6DigitFromStr(s) {
  if (!s) return null;
  const digits = String(s).replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  return null;
}

function askConsole(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, answer => { rl.close(); resolve(answer); }));
}

module.exports = async function start() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA version v${version.join('.')}, latest: ${isLatest}`);

  const PRINT_QR = (process.env.PRINT_QR === 'true');
  const PHONE_FOR_PAIR = (process.env.PHONE_FOR_PAIR || '').trim();

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'info' }),
    printQRInTerminal: !!PRINT_QR, // if you still want QR displayed
  });

  // Save creds on update
  sock.ev.on('creds.update', saveCreds);

  // Track whether we've requested pairing this run (avoid repeats)
  let pairingRequested = false;

  // Helper to request pairing code once
  async function requestPairing() {
    if (pairingRequested) return;
    pairingRequested = true;

    // Determine phone number to request pairing for
    let phone = PHONE_FOR_PAIR;
    if (!phone) {
      // interactive prompt if running in console
      try {
        const answer = await askConsole('No PHONE_FOR_PAIR env set. Enter phone (country code + number, no "+"), e.g. 2349118300204: ');
        phone = (answer || '').trim();
      } catch (e) {
        console.warn('Console prompt failed (non-interactive environment). Skipping pairing code request.');
        return;
      }
    }

    if (!phone) {
      console.warn('No phone provided for pairing. Set PHONE_FOR_PAIR env var or run interactively.');
      return;
    }

    try {
      console.log(`Requesting pairing code for ${phone}...`);
      // requestPairingCode may return a long token or code depending on Baileys version
      const pairing = await sock.requestPairingCode(phone);
      // try to extract 6-digit from returned pairing
      const short = extract6DigitFromStr(String(pairing));
      console.log('📲 Pairing response from server (raw):', pairing);
      if (short) {
        console.log('🔐 6-digit pairing token (use WhatsApp -> Linked devices -> Link a device -> Enter code):', short);
      } else {
        console.log('🔐 Pairing token received. If your WhatsApp wants a code, check the raw pairing above.');
      }
      console.log('👉 Also watch the terminal for connection.update messages (they may contain a QR or full pairing payload).');
    } catch (err) {
      console.warn('⚠️ Pairing code request failed:', err?.message || err);
    }
  }

  // connection updates: print 6-digit pairing token if provided; trigger requestPairing when not registered
  sock.ev.on('connection.update', async (update) => {
    try {
      const u = Object.assign({}, update);
      if (u.qr) u.qr = '<<QR_PRESENT>>'; // avoid huge console QR blobs unless PRINT_QR true
      console.log('connection.update', u);

      // extract potential 6-digit token from several fields
      const candidates = [update.code, update.pairingCode, update.qr].filter(Boolean);
      let token = null;
      for (const c of candidates) {
        token = extract6DigitFromStr(String(c));
        if (token) break;
      }
      if (token) {
        console.log('📲 6-digit pairing token (use WhatsApp -> Linked devices -> Link a device -> Enter code):', token);
      } else if (update.qr && !PRINT_QR) {
        console.log('📲 Pairing QR available from WA; enable PRINT_QR=true to show it in terminal for scanning.');
      }

      // If session is not yet registered, request pairing (either auto via env or via prompt)
      // `state.creds.registered` may be false when not paired. Check and trigger request once.
      if (!state.creds?.registered) {
        // Only attempt if not already requested in this process
        await requestPairing();
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

  // expose sock globally if you want to debug from REPL
  global.MRDEV_SOCK = sock;
  console.log('✅ MRDEV_SOCK is available as global.MRDEV_SOCK');

  return sock;
};
