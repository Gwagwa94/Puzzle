// ── Classic Jigsaw Piece Path Generator & Audio Synthesizer ──────────

/**
 * Draws a single classic jigsaw puzzle edge from (x1, y1) to (x2, y2).
 * When traversing clockwise:
 *   edgeType ===  1: tab pointing OUTWARDS (away from piece center)
 *   edgeType === -1: blank (slot) pointing INWARDS (toward piece center)
 *   edgeType ===  0: straight flat border edge
 *
 * Symmetrical around t = 0.5 so that reverse traversal matches 100% with no gaps.
 */
export function traceJigsawEdge(ctx, x1, y1, x2, y2, edgeType, customTabSize) {
  if (edgeType === 0) {
    ctx.lineTo(x2, y2);
    return;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const L = Math.hypot(dx, dy);
  if (L === 0) return;

  // Tangent unit vector along edge direction
  const tx = dx / L;
  const ty = dy / L;

  // Outward normal in screen coordinates (+y is down):
  // For clockwise path: outward normal is (ty, -tx)
  // When edgeType === 1 (tab outward): dir = 1
  // When edgeType === -1 (blank inward): dir = -1
  const dir = edgeType === 1 ? 1 : -1;
  const nx = ty * dir;
  const ny = -tx * dir;

  // Tab depth and neck proportions
  const H = customTabSize || L * 0.22;

  // Point helper: returns (x, y) given fractional distance t along edge and fraction n along normal
  const pt = (t, n) => ({
    x: x1 + t * dx + n * H * nx,
    y: y1 + t * dy + n * H * ny,
  });

  // 1. Straight line to start of neck
  const pStartNeck = pt(0.38, 0);
  ctx.lineTo(pStartNeck.x, pStartNeck.y);

  // 2. Smooth pinch into narrow neck
  const pC1 = pt(0.385, -0.04);
  const pC2 = pt(0.395, 0.15);
  const pNeckLeft = pt(0.405, 0.35);
  ctx.bezierCurveTo(pC1.x, pC1.y, pC2.x, pC2.y, pNeckLeft.x, pNeckLeft.y);

  // 3. Left lobe of bulbous head up to apex
  const pC3 = pt(0.34, 0.85);
  const pC4 = pt(0.42, 1.05);
  const pApex = pt(0.50, 1.05);
  ctx.bezierCurveTo(pC3.x, pC3.y, pC4.x, pC4.y, pApex.x, pApex.y);

  // 4. Right lobe of bulbous head from apex down to right neck (symmetric to step 3)
  const pC5 = pt(0.58, 1.05);
  const pC6 = pt(0.66, 0.85);
  const pNeckRight = pt(0.595, 0.35);
  ctx.bezierCurveTo(pC5.x, pC5.y, pC6.x, pC6.y, pNeckRight.x, pNeckRight.y);

  // 5. Smooth pinch out of narrow neck back to baseline (symmetric to step 2)
  const pC7 = pt(0.605, 0.15);
  const pC8 = pt(0.615, -0.04);
  const pEndNeck = pt(0.62, 0);
  ctx.bezierCurveTo(pC7.x, pC7.y, pC8.x, pC8.y, pEndNeck.x, pEndNeck.y);

  // 6. Complete line to edge end
  ctx.lineTo(x2, y2);
}

/**
 * Creates or traces the full closed path of a classic jigsaw piece with notches.
 */
export function buildJigsawPath(ctx, x, y, w, h, edges = {}, tabSize) {
  const top = edges.top || 0;
  const right = edges.right || 0;
  const bottom = edges.bottom || 0;
  const left = edges.left || 0;

  ctx.beginPath();
  ctx.moveTo(x, y);

  // Top edge: Left to Right
  traceJigsawEdge(ctx, x, y, x + w, y, top, tabSize);

  // Right edge: Top to Bottom
  traceJigsawEdge(ctx, x + w, y, x + w, y + h, right, tabSize);

  // Bottom edge: Right to Left
  traceJigsawEdge(ctx, x + w, y + h, x, y + h, bottom, tabSize);

  // Left edge: Bottom to Top
  traceJigsawEdge(ctx, x, y + h, x, y, left, tabSize);

  ctx.closePath();
}

/**
 * Checks if a world point (wx, wy) is inside a piece, considering outward tabs.
 */
export function isPointInsidePiece(ctx, wx, wy, piece, tabSize) {
  const ts = tabSize || piece.tabSize || Math.min(piece.sw, piece.sh) * 0.22;
  const edges = piece.edges || { top: 0, right: 0, bottom: 0, left: 0 };

  const minX = piece.x - (edges.left === 1 ? ts : 0) - 2;
  const maxX = piece.x + piece.sw + (edges.right === 1 ? ts : 0) + 2;
  const minY = piece.y - (edges.top === 1 ? ts : 0) - 2;
  const maxY = piece.y + piece.sh + (edges.bottom === 1 ? ts : 0) + 2;

  // Fast bounding box reject
  if (wx < minX || wx > maxX || wy < minY || wy > maxY) {
    return false;
  }

  // Exact path check
  buildJigsawPath(ctx, piece.x, piece.y, piece.sw, piece.sh, edges, ts);
  return ctx.isPointInPath(wx, wy);
}

// ── Web Audio Synthesizer (No external sound files required) ────────
let audioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Play a subtle "pop" or "grab" sound on piece pickup
 */
export function playGrabSound() {
  try {
    const ac = getAudioContext();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = "sine";
    const now = ac.currentTime;
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(480, now + 0.06);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ac.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Ignore audio errors on unsupported browsers
  }
}

/**
 * Play a satisfying click / lock sound when a piece snaps into correct place!
 */
export function playSnapSound() {
  try {
    const ac = getAudioContext();
    if (!ac) return;
    const now = ac.currentTime;

    const osc1 = ac.createOscillator();
    const osc2 = ac.createOscillator();
    const gain = ac.createGain();

    osc1.type = "triangle";
    osc2.type = "sine";

    osc1.frequency.setValueAtTime(620, now);
    osc1.frequency.exponentialRampToValueAtTime(120, now + 0.1);

    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1400, now + 0.08);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ac.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.16);
    osc2.stop(now + 0.16);
  } catch {
    // Ignore audio errors
  }
}

/**
 * Play an uplifting fanfare on puzzle completion
 */
export function playVictorySound() {
  try {
    const ac = getAudioContext();
    if (!ac) return;
    const now = ac.currentTime;

    const notes = [440, 554.37, 659.25, 880]; // A major chord
    notes.forEach((freq, idx) => {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const start = now + idx * 0.12;

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);

      osc.connect(gain);
      gain.connect(ac.destination);

      osc.start(start);
      osc.stop(start + 0.5);
    });
  } catch {
    // Ignore audio errors
  }
}
