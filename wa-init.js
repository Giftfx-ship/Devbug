// wa-pair.js — pairing-only helper: requests & prints 6-digit pairing token
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers
} = require('@whiskeysockets/baileys');

const CONFIG_PATH = path.join(process.cwd(), 'config.js'); // expects module.exports = { PHONE_FOR_PAIR: '234...' }
let config = {};
try { config = require(CONFIG_PATH); } catch (e) { console.warn('No config.js found or it failed to load — falling back to env PHONE_FOR_PAIR'); }

const PHONE_FOR_PAIR = (config.PHONE_FOR_PAIR || process.env.PHONE_FOR_PAIR || '').toString().trim();
const AUTH_DIR = path.resolve('./auth_pair'); // separate folder for pairing session (persist this)

if (!PHONE_FOR_PAIR) {
  console.error('ERROR: PHONE_FOR_PAIR not set in config.js and not present in env PHONE_FOR_PAIR.');
  console.error('Set config.js: module.exports = { PHONE_FOR_PAIR: "2349164624021" } or set env PHONE_FOR_PAIR.');
  process.exit(1);
}

// small helper to extract a 6-digit token from string
function extract6(s) {
  if (!s) return null;
  const digits = String(s).replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(0, 6);
  return null;
}

async function run() {
  if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion().catch(()=>({ version: [2,3000,1023223821] }));
  console.log(`Using WA version v${version.join('.')}`);

  // create socket (no store)
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: state,
    version,
    browser: Browsers.ubuntu('Edge'),
    getMessage: async () => '' // no store
  });

  // save creds on update
  sock.ev.on('creds.update', saveCreds);

  let pairingRequested = false;
  async function requestPairingOnce() {
    if (pairingRequested) return;
    pairingRequested = true;
    try {
      console.log(`Requesting pairing code for ${PHONE_FOR_PAIR} ...`);
      const resp = await sock.requestPairingCode(PHONE_FOR_PAIR);
      console.log('Raw pairing response:', resp);
      const token = extract6(String(resp));
      if (token) {
        console.log('📲 6-digit pairing token (enter in WhatsApp -> Linked devices -> Link a device -> Enter code):', token);
      } else {
        console.log('Pairing response received. If WhatsApp expects a code, check the raw pairing response above.');
      }
    } catch (err) {
      console.error('Pairing request failed:', err?.message || err);
    }
  }

  // Listen for connection updates — some Baileys builds put the token in update fields
  sock.ev.on('connection.update', async (update) => {
    try {
      const u = Object.assign({}, update);
      if (u.qr) u.qr = '<<QR_PRESENT>>';
      console.log('connection.update', u);

      // try to extract token from update fields
      const fields = [update.code, update.pairingCode, update.qr].filter(Boolean);
      for (const f of fields) {
        const token = extract6(String(f));
        if (token) {
          console.log('📲 6-digit pairing token (enter on phone -> Linked devices -> Link a device):', token);
        }
      }

      // If not registered, trigger pairing request once
      if (!state.creds?.registered) {
        await requestPairingOnce();
      }

      // handle close / logged out
      const { connection, lastDisconnect } = update;
      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.log('Connection closed, statusCode=', code);
        if (code === DisconnectReason.loggedOut) {
          console.log('Logged out. Remove the auth folder and re-run to request a fresh pairing.');
        }
      } else if (connection === 'open') {
        console.log('✅ Connected — if you paired successfully the session is stored in', AUTH_DIR);
      }
    } catch (e) {
      console.error('connection.update handler error', e);
    }
  });

  // minimal messages handler (keep process alive)
  sock.ev.on('messages.upsert', m => {
    // noop — pairing script doesn't handle commands
  });

  // expose sock for debug (optional)
  global.MRDEV_PAIR_SOCK = sock;
  console.log('Pairing helper started — watching console for token output.');
}

run().catch(err => { console.error('Fatal error', err); process.exit(1); });
