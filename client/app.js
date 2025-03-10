// Global state and offline update queue
let state = {};
let offlineQueue = [];

// Load persisted offline queue from localStorage, if available
function loadPersistedQueue() {
  const stored = localStorage.getItem('syncityOfflineQueue');
  if (stored) {
    offlineQueue = JSON.parse(stored);
  }
}
loadPersistedQueue();

// Persist the offline queue to localStorage
function persistQueue() {
  localStorage.setItem('syncityOfflineQueue', JSON.stringify(offlineQueue));
}

let ws;

// Connect to the Syncity WebSocket server
function connect() {
  ws = new WebSocket(`ws://${window.location.host}`);

  ws.onopen = () => {
    console.log('Connected to Syncity server');
    // Flush any queued updates once reconnected
    flushUpdateQueue();
  };

  ws.onmessage = (message) => {
    try {
      const data = JSON.parse(message.data);
      if (data.type === 'init') {
        state = data.state;
        updateDisplay();
      } else if (data.type === 'update') {
        state = { ...state, ...data.payload };
        updateDisplay();
      }
    } catch (e) {
      console.error('Error parsing message:', e);
    }
  };

  ws.onclose = () => {
    console.log('Disconnected from server. Retrying in 3 seconds...');
    setTimeout(connect, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    ws.close();
  };
}

connect();

// Flush offline queue updates to the server
function flushUpdateQueue() {
  if (offlineQueue.length > 0 && ws.readyState === WebSocket.OPEN) {
    console.log('Flushing offline updates:', offlineQueue);
    offlineQueue.forEach(item => {
      ws.send(JSON.stringify(item));
    });
    offlineQueue = [];
    localStorage.removeItem('syncityOfflineQueue');
  }
}

// Listen for when the browser comes online
window.addEventListener('online', flushUpdateQueue);

// Update the displayed state in the UI
function updateDisplay() {
  document.getElementById('stateDisplay').textContent = JSON.stringify(state, null, 2);
}

// Handle the state update button click
document.getElementById('updateBtn').addEventListener('click', () => {
  const key = document.getElementById('key').value;
  const value = document.getElementById('value').value;
  if (key) {
    const payload = { [key]: value };
    // Include a timestamp for conflict resolution
    const updateData = {
      type: 'update',
      payload,
      timestamp: Date.now()
    };

    // Update local state immediately for responsiveness
    state = { ...state, ...payload };
    updateDisplay();

    // If offline or WebSocket is not ready, queue the update
    if (!navigator.onLine || ws.readyState !== WebSocket.OPEN) {
      console.log('Offline detected, queuing update:', updateData);
      offlineQueue.push(updateData);
      persistQueue();
    } else {
      ws.send(JSON.stringify(updateData));
    }
  }
});
