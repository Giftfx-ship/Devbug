// index.js
const start = require('./wa-init'); // default export from wa-init.js

(async () => {
  try {
    const sock = await start();
    console.log('✅ WhatsApp bot started successfully!');

    // Self-test: send a message to yourself once connected
    if (sock?.user?.id) {
      try {
        await sock.sendMessage(sock.user.id, { text: '🤖 Bot connected and ready!' });
        console.log('📩 Test message sent to yourself.');
      } catch (err) {
        console.error('❌ Failed to send self-test message:', err);
      }
    }
  } catch (err) {
    console.error('❌ Fatal startup error:', err);
    process.exit(1);
  }
})();
