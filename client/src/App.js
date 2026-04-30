import React, { useEffect, useRef, useState, useCallback } from "react";
import "./App.css";

// Automatically use wss:// in production and ws:// in local development
const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/stream`;

function App() {
  const mapCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const wsRef = useRef(null);

  const [sourceActive, setSourceActive] = useState(false);
  const [fps, setFps] = useState(0);
  const [stats, setStats] = useState({ width: 0, height: 0, frame: 0 });

  const lastFrameTimeRef = useRef(performance.now());
  const frameCountRef = useRef(0);

  // 1. Function to draw the base PGM Map
  const drawFrame = useCallback((pixels, width, height) => {
    const canvas = mapCanvasRef.current;
    if (!canvas) return;
    
    // Only resize the internal canvas resolution if the map size changes
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }

    const ctx = canvas.getContext("2d");
    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;

    // Flatten the 2D array from Python and map to RGBA
    let i = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const val = pixels[y][x];
        data[i] = val;     // R
        data[i + 1] = val; // G
        data[i + 2] = val; // B
        data[i + 3] = 255; // Alpha (fully opaque)
        i += 4;
      }
    }
    ctx.putImageData(imageData, 0, 0);
  }, []);

  // 2. Function to draw the Robot Overlay (NOW BULLETPROOF)
  const drawRobot = useCallback((pose, mapInfo, width, height) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    
    // The overlay must have the exact same internal resolution as the map
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
    
    const ctx = canvas.getContext("2d");
    
    // ALWAYS clear the canvas first. This prevents a "ghost" robot 
    // from getting stuck if the pose data suddenly drops out.
    ctx.clearRect(0, 0, width, height); 

    // SAFETY CHECKS: Ensure objects exist
    if (!pose || !mapInfo) return;

    // SAFETY CHECKS: Ensure the required numbers are actually present and valid
    if (
        typeof pose.x !== 'number' || 
        typeof pose.y !== 'number' || 
        typeof pose.theta !== 'number' ||
        typeof mapInfo.origin_x !== 'number' ||
        typeof mapInfo.origin_y !== 'number' ||
        typeof mapInfo.resolution !== 'number'
    ) {
        return; // Exit silently without crashing if data is malformed
    }

    // Convert ROS real-world coordinates to HTML Canvas pixels
    const pixelX = (pose.x - mapInfo.origin_x) / mapInfo.resolution;
    const pixelY = height - ((pose.y - mapInfo.origin_y) / mapInfo.resolution);
    const canvasTheta = -pose.theta; // Invert rotation for canvas

    // Draw the Robot Marker
    ctx.save();
    ctx.translate(pixelX, pixelY);
    ctx.rotate(canvasTheta);
    
    ctx.fillStyle = "#00ff88"; // Bright green
    ctx.beginPath();
    ctx.moveTo(10, 0);     // Nose of the robot
    ctx.lineTo(-10, 8);    // Back left
    ctx.lineTo(-10, -8);   // Back right
    ctx.fill();
    
    ctx.restore();
  }, []);

  // 3. WebSocket Connection & Data Handling
  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => console.log("Connected to viewer stream");

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "source_connected") {
          setSourceActive(true);
        } else if (msg.type === "source_disconnected") {
          setSourceActive(false);
          setStats({ width: 0, height: 0, frame: 0 });
          setFps(0);
          
          // Clear both canvases when stream stops
          const mCtx = mapCanvasRef.current?.getContext("2d");
          mCtx?.clearRect(0, 0, mapCanvasRef.current?.width || 0, mapCanvasRef.current?.height || 0);
          
          const oCtx = overlayCanvasRef.current?.getContext("2d");
          oCtx?.clearRect(0, 0, overlayCanvasRef.current?.width || 0, overlayCanvasRef.current?.height || 0);
          
        } else if (msg.type === "pgm_frame") {
          setSourceActive(true);
          
          // Draw the background map
          drawFrame(msg.pixels, msg.width, msg.height);
          
          // ALWAYS call drawRobot. If msg.robot_pose is undefined, 
          // drawRobot will safely catch it and just clear the canvas.
          drawRobot(msg.robot_pose, msg.map_info, msg.width, msg.height);

          setStats({ width: msg.width, height: msg.height, frame: msg.frame });

          // Calculate FPS
          frameCountRef.current += 1;
          const now = performance.now();
          if (now - lastFrameTimeRef.current >= 1000) {
            setFps(frameCountRef.current);
            frameCountRef.current = 0;
            lastFrameTimeRef.current = now;
          }
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting in 2s...");
        setSourceActive(false);
        setTimeout(connect, 2000);
      };
    }

    connect();
    return () => wsRef.current?.close();
  }, [drawFrame, drawRobot]);

  return (
    <div className="root">
      <div className="panel">
        <h2>Live SLAM Map Viewer</h2>
        
        {/* Canvas Wrapper */}
        <div className="canvas-wrapper" style={{ position: "relative", width: "100%", height: "600px", background: "#000", overflow: "hidden" }}>
          
          {/* Base Map Canvas (z-index 1) */}
          <canvas 
            ref={mapCanvasRef} 
            className="canvas" 
            style={{ 
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%", 
                zIndex: 1, imageRendering: "pixelated", objectFit: "contain" 
            }} 
          />
          
          {/* Robot Overlay Canvas (z-index 2) */}
          <canvas 
            ref={overlayCanvasRef} 
            className="canvas" 
            style={{ 
                position: "absolute", top: 0, left: 0, width: "100%", height: "100%", 
                zIndex: 2, background: "transparent", imageRendering: "pixelated", objectFit: "contain" 
            }} 
          />
          
          {/* Offline Message (z-index 3) */}
          {!sourceActive && (
             <div style={{ position: "absolute", zIndex: 3, color: "white", width: "100%", textAlign: "center", top: "50%", transform: "translateY(-50%)" }}>
                Waiting for ROS stream...
             </div>
          )}
        </div>

        {/* Stats Footer */}
        <div style={{ color: "#a6accd", marginTop: "16px", display: "flex", justifyContent: "space-between" }}>
            <span>Status: <strong style={{ color: sourceActive ? "#00ff88" : "#f07178" }}>{sourceActive ? "Live" : "Offline"}</strong></span>
            {sourceActive && (
                <span>
                    Map: {stats.width}x{stats.height} | Frame: {stats.frame} | {fps} FPS
                </span>
            )}
        </div>
      </div>
    </div>
  );
}

export default App;