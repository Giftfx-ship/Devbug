const startWA = require('./wa-init');

(async () => {
  try {
    const sock = await startWA();
    console.log('✅ WhatsApp bot started successfully!');

    // Optional: send a test message to yourself after connecting
    if (sock?.user?.id) {
      try {
        await sock.sendMessage(sock.user.id, { text: '🤖 Bot connected and ready!' });
        console.log('📩 Test message sent to yourself.');
      } catch (err) {
        console.error('❌ Failed to send test message:', err);
      }
    }
  } catch (err) {
    console.error('❌ Fatal startup error:', err);
    process.exit(1);
  }
})();
