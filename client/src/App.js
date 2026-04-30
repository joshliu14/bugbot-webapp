import React, { useEffect, useRef, useState, useCallback } from "react";
import "./App.css"; // Ensure you import the CSS file

const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/stream`;

function App() {
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const [status, setStatus] = useState("connecting");
  const [sourceActive, setSourceActive] = useState(false);
  const [stats, setStats] = useState({ frame: 0, fps: 0, width: 0, height: 0 });
  const [pgmHeader, setPgmHeader] = useState("");
  const fpsCounterRef = useRef({ count: 0, last: Date.now() });

  const drawFrame = useCallback((pixels, width, height, maxval) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // The actual internal resolution of the canvas remains unchanged
    canvas.width = width;
    canvas.height = height;
    
    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const gray = Math.round((pixels[y][x] / maxval) * 255);
        imageData.data[idx] = gray;
        imageData.data[idx + 1] = gray;
        imageData.data[idx + 2] = gray;
        imageData.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    function connect() {
      setStatus("connecting");
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => setStatus("connected");

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "source_connected") {
          setSourceActive(true);
        } else if (msg.type === "source_disconnected") {
          setSourceActive(false);
          setPgmHeader("");
          setStats({ frame: 0, fps: 0, width: 0, height: 0 });
        } else if (msg.type === "pgm_frame") {
          drawFrame(msg.pixels, msg.width, msg.height, msg.maxval);

          const now = Date.now();
          fpsCounterRef.current.count++;
          const elapsed = now - fpsCounterRef.current.last;
          if (elapsed >= 1000) {
            const fps = Math.round((fpsCounterRef.current.count / elapsed) * 1000);
            fpsCounterRef.current = { count: 0, last: now };
            setStats({ frame: msg.frame, fps, width: msg.width, height: msg.height });
          }

          const headerLines = msg.pgm.split("\n").slice(0, 3).join("  |  ");
          setPgmHeader(headerLines);
        }
      };

      ws.onclose = () => {
        setStatus("disconnected");
        setSourceActive(false);
        setTimeout(connect, 2000);
      };

      ws.onerror = () => ws.close();
    }

    connect();
    return () => wsRef.current?.close();
  }, [drawFrame]);

  const statusColor = {
    connected: "#00ff88",
    connecting: "#ffcc00",
    disconnected: "#ff4455",
  }[status];

  const sourceColor = sourceActive ? "#00ff88" : "#ff4455";

  return (
    <div className="root">
      <div className="panel">
        <div className="header">
          <span className="title">PGM STREAM</span>
          <div className="badges">
            <span className="badge" style={{ background: statusColor }}>
              SERVER {status.toUpperCase()}
            </span>
            <span className="badge" style={{ background: sourceColor }}>
              SOURCE {sourceActive ? "LIVE" : "WAITING"}
            </span>
          </div>
        </div>

        <div className="canvas-wrapper">
          <canvas ref={canvasRef} className="canvas" />
          {!sourceActive && (
            <div className="overlay">
              <span className="overlay-text">
                {status === "connected" ? "Waiting for source…" : "Connecting to server…"}
              </span>
            </div>
          )}
        </div>

        <div className="stats-row">
          <Stat label="FRAME" value={stats.frame || "—"} />
          <Stat label="FPS" value={stats.fps || "—"} />
          <Stat label="SIZE" value={stats.width ? `${stats.width}×${stats.height}` : "—"} />
        </div>

        <div className="pgm-box">
          <span className="pgm-label">PGM HEADER</span>
          <code className="pgm-code">{pgmHeader || "waiting for data…"}</code>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

export default App;