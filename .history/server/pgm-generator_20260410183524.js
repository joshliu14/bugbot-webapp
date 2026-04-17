/**
 * Mock PGM Data Generator
 *
 * PGM (Portable GrayMap) format:
 *   P2          - magic number (ASCII)
 *   width height
 *   maxval
 *   pixel data (row by row, space-separated)
 *
 * This generator creates synthetic PGM frames simulating
 * a moving gradient/noise pattern to prove continuous streaming.
 */

const { broadcastPGMFrame } = require('./index');

const WIDTH = 64;
const HEIGHT = 64;
const MAXVAL = 255;
const FPS = 10; // frames per second

let frameIndex = 0;

function generatePGMFrame(frame) {
  const pixels = [];

  for (let y = 0; y < HEIGHT; y++) {
    const row = [];
    for (let x = 0; x < WIDTH; x++) {
      // Animated sine-wave pattern
      const wave1 = Math.sin((x + frame) * 0.2) * 0.5 + 0.5;
      const wave2 = Math.cos((y + frame * 0.7) * 0.15) * 0.5 + 0.5;
      const noise = (Math.sin(x * 1.3 + y * 0.9 + frame * 0.3) + 1) * 0.5;
      const value = Math.round(((wave1 + wave2 + noise) / 3) * MAXVAL);
      row.push(Math.min(MAXVAL, Math.max(0, value)));
    }
    pixels.push(row);
  }

  // Build ASCII PGM string
  const header = `P2\n${WIDTH} ${HEIGHT}\n${MAXVAL}\n`;
  const body = pixels.map((row) => row.join(' ')).join('\n');
  const pgmString = header + body;

  return {
    width: WIDTH,
    height: HEIGHT,
    maxval: MAXVAL,
    frame: frame,
    pgm: pgmString,
    pixels: pixels, // also send raw pixel array for easy canvas rendering
  };
}

function tick() {
  const pgmData = generatePGMFrame(frameIndex);
  broadcastPGMFrame(pgmData);
  frameIndex++;
}

console.log(`PGM generator started: ${WIDTH}x${HEIGHT} @ ${FPS}fps`);
setInterval(tick, 1000 / FPS);