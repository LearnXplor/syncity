module.exports.init = function({ wss }) {
    // Listen for new client connections and log them
    wss.on('connection', (ws) => {
      console.log('samplePlugin: New client connected.');
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'update') {
            console.log('samplePlugin: Update received:', data);
          }
        } catch (e) {
          console.error('samplePlugin: Error parsing message:', e);
        }
      });
    });
  };
  