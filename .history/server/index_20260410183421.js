const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('PGM WebSocket Server is running');
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// Track connected clients
let clientCount = 0;

wss.on('connection', (ws) => {
  clientCount++;
  console.log(`Client connected. Total clients: ${clientCount}`);

  ws.on('close', () => {
    clientCount--;
    console.log(`Client disconnected. Total clients: ${clientCount}`);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  // Send a welcome message
  ws.send(JSON.stringify({ type: 'connected', message: 'PGM stream ready' }));
});

// Broadcast PGM frame to all connected clients
function broadcastPGMFrame(pgmData) {
  const payload = JSON.stringify({
    type: 'pgm_frame',
    timestamp: Date.now(),
    ...pgmData,
  });

  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(payload);
    }
  });
}

// Export broadcast so pgm-generator can use it
module.exports = { broadcastPGMFrame };

const PORT = 8080;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  // Start the PGM generator after server is up
  require('./pgm-generator');
});