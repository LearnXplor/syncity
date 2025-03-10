const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Serve static files from the "client" folder
app.use(express.static('client'));

// Global state object
let state = {};

// Timestamp map for conflict resolution (key -> last update time)
let stateTimestamps = {};

// Advanced conflict resolution: 
// Here we use a simple last-write-wins strategy based on timestamps.
// In production, replace or extend this with a more robust algorithm if needed.
function resolveConflict(key, newValue, newTimestamp) {
  if (!stateTimestamps[key] || newTimestamp >= stateTimestamps[key]) {
    stateTimestamps[key] = newTimestamp;
    return newValue;
  }
  // Otherwise, keep the existing value.
  return state[key];
}

// Load plugins from the "plugins" folder
const pluginsDir = path.join(__dirname, 'plugins');
if (fs.existsSync(pluginsDir)) {
  fs.readdirSync(pluginsDir).forEach(file => {
    if (file.endsWith('.js')) {
      const pluginPath = path.join(pluginsDir, file);
      try {
        const plugin = require(pluginPath);
        if (typeof plugin.init === 'function') {
          plugin.init({ app, wss, state, broadcast, resolveConflict });
          console.log(`Plugin loaded: ${file}`);
        }
      } catch (e) {
        console.error(`Error loading plugin ${file}:`, e);
      }
    }
  });
}

// Helper to broadcast data to all clients except the sender
function broadcast(data, sender) {
  wss.clients.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
}

// WebSocket server logic
wss.on('connection', (ws) => {
  console.log('Client connected');

  // Send current state to the new client
  ws.send(JSON.stringify({ type: 'init', state }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'update' && data.payload && data.timestamp) {
        // For each key in the payload, resolve conflicts and update state
        Object.keys(data.payload).forEach(key => {
          const newTimestamp = data.timestamp;
          const newValue = data.payload[key];
          const resolvedValue = resolveConflict(key, newValue, newTimestamp);
          state[key] = resolvedValue;
        });

        // Broadcast the update to all other clients
        broadcast({ type: 'update', payload: data.payload, timestamp: data.timestamp }, ws);
      }
    } catch (e) {
      console.error('Error processing message:', e);
    }
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Syncity server running on port ${PORT}`);
});
