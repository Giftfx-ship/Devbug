// index.js
const startWA = require('./wa-init');
const express = require('express');

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    const sock = await startWA(); // returns the active socket
    // small express server for health/menu
    const app = express();
    app.get('/health', (req, res) => res.json({ ok: true }));
    app.get('/menu', async (req, res) => {
      const { evilMenu } = require('./utils/menu');
      res.type('text/plain').send(evilMenu('!'));
    });

    app.listen(PORT, () => console.log(`✅ HTTP server listening on ${PORT}`));
  } catch (e) {
    console.error('Fatal startup error', e);
    process.exit(1);
  }
})();
