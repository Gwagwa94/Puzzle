const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");
const crypto = require("crypto");

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ── In-memory state ──────────────────────────────────────────────
const rooms = new Map(); // roomCode -> { pieces, image, cols, rows, players, createdAt }
const sessions = new Map(); // sessionId -> { name, color }

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous characters (0, O, 1, I)
  let code = "";
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

function generateSessionId() {
  return crypto.randomUUID();
}

const PLAYER_COLORS = [
  "#6C5CE7", "#00B894", "#E17055", "#0984E3",
  "#FDCB6E", "#E84393", "#00CEC9", "#FF7675",
  "#A29BFE", "#55EFC4", "#FAB1A0", "#74B9FF",
  "#9B59B6", "#1ABC9C", "#E67E22", "#3498DB",
];

// ── Classic Jigsaw Puzzle generation with Notches ───────────────
function generatePuzzlePieces(cols, rows, imageWidth, imageHeight) {
  const pieceW = imageWidth / cols;
  const pieceH = imageHeight / rows;
  const tabSize = Math.min(pieceW, pieceH) * 0.22; // 22% notch depth

  // Generate random internal edges
  // verticalEdges[r][c] is boundary between (r, c) and (r, c + 1)
  const verticalEdges = [];
  for (let r = 0; r < rows; r++) {
    verticalEdges[r] = [];
    for (let c = 0; c < cols - 1; c++) {
      verticalEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
    }
  }

  // horizontalEdges[r][c] is boundary between (r, c) and (r + 1, c)
  const horizontalEdges = [];
  for (let r = 0; r < rows - 1; r++) {
    horizontalEdges[r] = [];
    for (let c = 0; c < cols; c++) {
      horizontalEdges[r][c] = Math.random() < 0.5 ? 1 : -1;
    }
  }

  const pieces = [];
  const zones = ["left", "right", "bottom", "top"];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = row * cols + col;

      // Edges: 1 = tab outward, -1 = blank inward, 0 = straight boundary
      const top = row === 0 ? 0 : -horizontalEdges[row - 1][col];
      const bottom = row === rows - 1 ? 0 : horizontalEdges[row][col];
      const left = col === 0 ? 0 : -verticalEdges[row][col - 1];
      const right = col === cols - 1 ? 0 : verticalEdges[row][col];

      // Scatter piece in outer margins around the target frame
      const zone = zones[id % zones.length];
      let sx, sy;
      if (zone === "left") {
        sx = -pieceW * 1.25 - Math.random() * (imageWidth * 0.4);
        sy = (Math.random() * 1.1 - 0.05) * imageHeight - pieceH * 0.5;
      } else if (zone === "right") {
        sx = imageWidth + pieceW * 0.25 + Math.random() * (imageWidth * 0.4);
        sy = (Math.random() * 1.1 - 0.05) * imageHeight - pieceH * 0.5;
      } else if (zone === "bottom") {
        sx = (Math.random() * 1.1 - 0.05) * imageWidth - pieceW * 0.5;
        sy = imageHeight + pieceH * 0.25 + Math.random() * (imageHeight * 0.4);
      } else {
        sx = (Math.random() * 1.1 - 0.05) * imageWidth - pieceW * 0.5;
        sy = -pieceH * 1.25 - Math.random() * (imageHeight * 0.4);
      }

      pieces.push({
        id,
        col,
        row,
        // Source rect on image
        sx: col * pieceW,
        sy: row * pieceH,
        sw: pieceW,
        sh: pieceH,
        // Classic jigsaw notch edge indicators
        edges: { top, right, bottom, left },
        tabSize,
        // Current position on board
        x: sx,
        y: sy,
        // Correct target position
        correctX: col * pieceW,
        correctY: row * pieceH,
        placed: false,
        lockedBy: null,
      });
    }
  }

  // Shuffle array for natural board disorder
  for (let i = pieces.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
  }

  return pieces;
}

function getGridSize(totalPieces) {
  const sqrt = Math.sqrt(totalPieces);
  let cols = Math.round(sqrt);
  let rows = Math.round(totalPieces / cols);
  while (cols * rows < totalPieces) rows++;
  while (cols * rows > totalPieces && rows > 1) rows--;
  if (cols * rows !== totalPieces) {
    for (let c = Math.ceil(sqrt); c >= 1; c--) {
      if (totalPieces % c === 0) {
        cols = c;
        rows = totalPieces / c;
        break;
      }
    }
  }
  return { cols: Math.max(2, cols), rows: Math.max(2, rows) };
}

// ── Start server ─────────────────────────────────────────────────
app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: { origin: "*" },
    maxHttpBufferSize: 15e6, // 15 MB for image uploads
  });

  io.on("connection", (socket) => {
    let currentRoom = null;
    let sessionId = null;

    socket.on("register-session", (data, cb) => {
      sessionId = data.sessionId || generateSessionId();
      const existing = sessions.get(sessionId) || {};
      sessions.set(sessionId, {
        name: data.name || existing.name || "Puzzler",
        color: data.color || existing.color || PLAYER_COLORS[sessions.size % PLAYER_COLORS.length],
      });
      cb({ sessionId, ...sessions.get(sessionId) });
    });

    socket.on("create-room", (data, cb) => {
      let code;
      let attempts = 0;
      do {
        code = generateRoomCode();
        attempts++;
      } while (rooms.has(code) && attempts < 10);

      const targetPieces = Math.max(4, Math.min(200, parseInt(data.pieceCount, 10) || 24));
      const { cols, rows } = getGridSize(targetPieces);
      const imageW = data.imageWidth || 800;
      const imageH = data.imageHeight || 600;

      const room = {
        code,
        imageUrl: data.imageUrl,
        imageWidth: imageW,
        imageHeight: imageH,
        cols,
        rows,
        pieceCount: cols * rows,
        pieces: generatePuzzlePieces(cols, rows, imageW, imageH),
        players: new Map(),
        createdAt: Date.now(),
      };
      rooms.set(code, room);
      cb({ code, pieceCount: room.pieceCount });
    });

    socket.on("join-room", (data, cb) => {
      const roomCode = (data.code || "").toUpperCase().trim();
      const room = rooms.get(roomCode);
      if (!room) {
        cb({ error: "Puzzle room not found. Please check your room code." });
        return;
      }

      currentRoom = roomCode;
      socket.join(roomCode);

      const session = sessions.get(sessionId) || {
        name: "Puzzler",
        color: PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)],
      };

      room.players.set(sessionId, {
        ...session,
        socketId: socket.id,
        sessionId,
      });

      cb({
        code: room.code,
        imageUrl: room.imageUrl,
        imageWidth: room.imageWidth,
        imageHeight: room.imageHeight,
        cols: room.cols,
        rows: room.rows,
        pieceCount: room.pieceCount,
        pieces: room.pieces,
        players: Array.from(room.players.values()),
      });

      socket.to(roomCode).emit("player-joined", {
        ...session,
        sessionId,
      });
    });

    socket.on("piece-grab", (data) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;

      const piece = room.pieces.find((p) => p.id === data.pieceId);
      if (piece && !piece.placed && (!piece.lockedBy || piece.lockedBy === sessionId)) {
        piece.lockedBy = sessionId;
        // Bring piece to top of z-order
        const idx = room.pieces.indexOf(piece);
        if (idx !== -1) {
          room.pieces.splice(idx, 1);
          room.pieces.push(piece);
        }

        io.to(currentRoom).emit("piece-grabbed", {
          pieceId: data.pieceId,
          by: sessionId,
          zOrder: room.pieces.map((p) => p.id),
        });
      }
    });

    socket.on("piece-move", (data) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;

      const piece = room.pieces.find((p) => p.id === data.pieceId);
      if (piece && piece.lockedBy === sessionId) {
        piece.x = data.x;
        piece.y = data.y;
        socket.to(currentRoom).emit("piece-moved", {
          pieceId: data.pieceId,
          x: data.x,
          y: data.y,
          by: sessionId,
        });
      }
    });

    socket.on("piece-drop", (data) => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;

      const piece = room.pieces.find((p) => p.id === data.pieceId);
      if (piece && piece.lockedBy === sessionId) {
        piece.x = data.x;
        piece.y = data.y;
        piece.lockedBy = null;

        // Snapping tolerance: roughly 32% of piece dimensions or minimum 26px
        const snapDist = Math.max(26, Math.min(piece.sw, piece.sh) * 0.32);
        const dx = Math.abs(piece.x - piece.correctX);
        const dy = Math.abs(piece.y - piece.correctY);

        let didSnap = false;
        if (dx < snapDist && dy < snapDist) {
          piece.x = piece.correctX;
          piece.y = piece.correctY;
          piece.placed = true;
          didSnap = true;
        }

        io.to(currentRoom).emit("piece-dropped", {
          pieceId: data.pieceId,
          x: piece.x,
          y: piece.y,
          placed: piece.placed,
          didSnap,
          by: sessionId,
        });

        // Check if all pieces placed
        const isComplete = room.pieces.every((p) => p.placed);
        if (isComplete) {
          io.to(currentRoom).emit("puzzle-complete");
        }
      }
    });

    socket.on("cursor-move", (data) => {
      if (!currentRoom) return;
      socket.to(currentRoom).emit("cursor-moved", {
        sessionId,
        x: data.x,
        y: data.y,
      });
    });

    // Scatter unplaced pieces around the edges if requested
    socket.on("scatter-pieces", () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;

      const zones = ["left", "right", "bottom", "top"];
      room.pieces.forEach((piece) => {
        if (!piece.placed) {
          const zone = zones[piece.id % zones.length];
          if (zone === "left") {
            piece.x = -piece.sw * 1.25 - Math.random() * (room.imageWidth * 0.4);
            piece.y = (Math.random() * 1.1 - 0.05) * room.imageHeight - piece.sh * 0.5;
          } else if (zone === "right") {
            piece.x = room.imageWidth + piece.sw * 0.25 + Math.random() * (room.imageWidth * 0.4);
            piece.y = (Math.random() * 1.1 - 0.05) * room.imageHeight - piece.sh * 0.5;
          } else if (zone === "bottom") {
            piece.x = (Math.random() * 1.1 - 0.05) * room.imageWidth - piece.sw * 0.5;
            piece.y = room.imageHeight + piece.sh * 0.25 + Math.random() * (room.imageHeight * 0.4);
          } else {
            piece.x = (Math.random() * 1.1 - 0.05) * room.imageWidth - piece.sw * 0.5;
            piece.y = -piece.sh * 1.25 - Math.random() * (room.imageHeight * 0.4);
          }
          piece.lockedBy = null;
        }
      });

      io.to(currentRoom).emit("pieces-scattered", {
        pieces: room.pieces,
      });
    });

    socket.on("disconnect", () => {
      if (currentRoom) {
        const room = rooms.get(currentRoom);
        if (room) {
          room.pieces.forEach((p) => {
            if (p.lockedBy === sessionId) p.lockedBy = null;
          });
          room.players.delete(sessionId);
          socket.to(currentRoom).emit("player-left", { sessionId });

          if (room.players.size === 0) {
            setTimeout(() => {
              const r = rooms.get(currentRoom);
              if (r && r.players.size === 0) {
                rooms.delete(currentRoom);
              }
            }, 10 * 60 * 1000); // 10 min grace period
          }
        }
      }
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`> Puzzle app ready on http://${hostname}:${port}`);
  });
});
