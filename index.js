const startWA = require('./wa-init');

(async () => {
  try {
    await startWA();
  } catch (err) {
    console.error('❌ Fatal startup error:', err);
    process.exit(1);
  }
})();
