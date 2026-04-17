import React, { useEffect, useRef, useState, useCallback } from "react";

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
    <div style={styles.root}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <span style={styles.title}>PGM STREAM</span>
          <div style={styles.badges}>
            <span style={{ ...styles.badge, background: statusColor }}>
              SERVER {status.toUpperCase()}
            </span>
            <span style={{ ...styles.badge, background: sourceColor }}>
              SOURCE {sourceActive ? "LIVE" : "WAITING"}
            </span>
          </div>
        </div>

        <div style={styles.canvasWrapper}>
          <canvas ref={canvasRef} style={styles.canvas} />
          {!sourceActive && (
            <div style={styles.overlay}>
              <span style={styles.overlayText}>
                {status === "connected" ? "Waiting for source…" : "Connecting to server…"}
              </span>
            </div>
          )}
        </div>

        <div style={styles.statsRow}>
          <Stat label="FRAME" value={stats.frame || "—"} />
          <Stat label="FPS" value={stats.fps || "—"} />
          <Stat label="SIZE" value={stats.width ? `${stats.width}×${stats.height}` : "—"} />
        </div>

        <div style={styles.pgmBox}>
          <span style={styles.pgmLabel}>PGM HEADER</span>
          <code style={styles.pgmCode}>{pgmHeader || "waiting for data…"}</code>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  );
}

const styles = {
  root: {
    minHeight: "100vh",
    background: "#0a0a0f",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Courier New', monospace",
  },
  panel: {
    background: "#111118",
    border: "1px solid #2a2a3a",
    borderRadius: 4,
    padding: 24,
    width: 420,
    boxShadow: "0 0 40px rgba(0,255,136,0.05)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    color: "#e0e0e0",
    fontSize: 13,
    letterSpacing: "0.15em",
    fontWeight: 700,
  },
  badges: { display: "flex", gap: 6 },
  badge: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.1em",
    padding: "3px 8px",
    borderRadius: 2,
    color: "#000",
  },
  canvasWrapper: {
    position: "relative",
    background: "#000",
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 12,
    border: "1px solid #1e1e2e",
    lineHeight: 0,
    minHeight: 120,
  },
  canvas: {
    width: "100%",
    imageRendering: "pixelated",
    display: "block",
  },
  overlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.85)",
  },
  overlayText: { color: "#555", fontSize: 11, letterSpacing: "0.1em" },
  statsRow: { display: "flex", gap: 8, marginBottom: 12 },
  stat: {
    flex: 1,
    background: "#0d0d16",
    border: "1px solid #1e1e2e",
    borderRadius: 2,
    padding: "8px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  statLabel: { color: "#555", fontSize: 9, letterSpacing: "0.12em" },
  statValue: { color: "#00ff88", fontSize: 18, fontWeight: 700 },
  pgmBox: {
    background: "#0d0d16",
    border: "1px solid #1e1e2e",
    borderRadius: 2,
    padding: "10px 12px",
  },
  pgmLabel: {
    color: "#555",
    fontSize: 9,
    letterSpacing: "0.12em",
    display: "block",
    marginBottom: 6,
  },
  pgmCode: { color: "#7a7aff", fontSize: 11, wordBreak: "break-all", display: "block" },
};

export default App;