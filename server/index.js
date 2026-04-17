const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const url = require('url');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('PGM WebSocket Server is running');
});

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

let activeSource = null;   // the one connected source
const viewers = new Set(); // all connected browser clients

// Route upgrades by path
server.on('upgrade', (req, socket, head) => {
  const { pathname } = url.parse(req.url);

  if (pathname === '/source' || pathname === '/stream') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const { pathname } = url.parse(req.url);

  if (pathname === '/source') {
    handleSource(ws);
  } else if (pathname === '/stream') {
    handleViewer(ws);
  }
});

function handleSource(ws) {
  if (activeSource) {
    console.log('New source connected — replacing existing source');
    activeSource.close();
  }

  activeSource = ws;
  console.log('Source connected');
  broadcastToViewers({ type: 'source_connected' });

  ws.on('message', (data) => {
    // Forward raw frame to all viewers
    const payload = data.toString();
    viewers.forEach((viewer) => {
      if (viewer.readyState === 1) {
        viewer.send(payload);
      }
    });
  });

  ws.on('close', () => {
    activeSource = null;
    console.log('Source disconnected');
    broadcastToViewers({ type: 'source_disconnected' });
  });

  ws.on('error', (err) => console.error('Source error:', err));
}

function handleViewer(ws) {
  viewers.add(ws);
  console.log(`Viewer connected. Total viewers: ${viewers.size}`);

  // Immediately tell viewer if a source is already live
  ws.send(JSON.stringify({
    type: activeSource ? 'source_connected' : 'source_disconnected'
  }));

  ws.on('close', () => {
    viewers.delete(ws);
    console.log(`Viewer disconnected. Total viewers: ${viewers.size}`);
  });

  ws.on('error', (err) => console.error('Viewer error:', err));
}

function broadcastToViewers(msg) {
  const payload = JSON.stringify(msg);
  viewers.forEach((viewer) => {
    if (viewer.readyState === 1) viewer.send(payload);
  });
}

const PORT = 8080;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
