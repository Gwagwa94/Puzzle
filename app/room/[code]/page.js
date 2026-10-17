"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import styles from "./room.module.css";
import {
  buildJigsawPath,
  isPointInsidePiece,
  playGrabSound,
  playSnapSound,
  playVictorySound,
} from "../../utils/jigsaw";

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCodeParam = params.code;

  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const animFrameRef = useRef(null);

  // UI state
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomData, setRoomData] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [complete, setComplete] = useState(false);
  const [showRef, setShowRef] = useState(false);
  const [showGhost, setShowGhost] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const toolsMenuRef = useRef(null);

  // Close tools dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target)) {
        setShowToolsMenu(false);
      }
    };
    if (showToolsMenu) {
      document.addEventListener("pointerdown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };
  }, [showToolsMenu]);

  // Refs for high-performance canvas loop
  const piecesRef = useRef([]);
  const imageRef = useRef(null);
  const draggingRef = useRef(null); // { pieceId, offsetX, offsetY }
  const cursorsRef = useRef({}); // sessionId -> { x, y, color, name }
  const isPanningRef = useRef(false);
  const lastPanRef = useRef({ x: 0, y: 0 });
  const touchPinchRef = useRef(null); // { dist, midX, midY }
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const roomDataRef = useRef(null);
  const showGhostRef = useRef(false);
  const soundEnabledRef = useRef(true);
  const particlesRef = useRef([]); // Victory particles

  // Keep refs in sync with state
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { roomDataRef.current = roomData; }, [roomData]);
  useEffect(() => { showGhostRef.current = showGhost; }, [showGhost]);
  useEffect(() => { soundEnabledRef.current = soundEnabled; }, [soundEnabled]);

  const showToast = useCallback((msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((cur) => (cur === msg ? "" : cur));
    }, 2200);
  }, []);

  // ── Fit Puzzle to Canvas Viewport ───────────────────────────────
  const fitPuzzleToView = useCallback(() => {
    const canvas = canvasRef.current;
    const rd = roomDataRef.current;
    if (!canvas || !rd) return;

    const parent = canvas.parentElement;
    const cw = parent.clientWidth;
    const ch = parent.clientHeight;

    // Generous padding around the target board
    const pad = Math.min(cw, ch) > 600 ? 120 : 60;
    const scaleX = (cw - pad * 2) / (rd.imageWidth * 1.5);
    const scaleY = (ch - pad * 2) / (rd.imageHeight * 1.5);
    const fitZoom = Math.min(Math.max(Math.min(scaleX, scaleY), 0.2), 1.5);

    setZoom(fitZoom);
    zoomRef.current = fitZoom;

    const centerX = (cw - rd.imageWidth * fitZoom) / 2;
    const centerY = (ch - rd.imageHeight * fitZoom) / 2;
    setPan({ x: centerX, y: centerY });
    panRef.current = { x: centerX, y: centerY };
  }, []);

  // ── Socket.io Connection & Event Setup ─────────────────────────
  useEffect(() => {
    let socket;
    const initSocket = async () => {
      const { io } = await import("socket.io-client");
      socket = io(window.location.origin, {
        transports: ["websocket", "polling"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setConnected(true);

        const storedSession = localStorage.getItem("puzzle-session-id");
        const name =
          sessionStorage.getItem("puzzle-player-name-join") ||
          localStorage.getItem("puzzle-player-name") ||
          "Puzzler";
        const color =
          sessionStorage.getItem("puzzle-player-color-join") ||
          localStorage.getItem("puzzle-player-color") ||
          "#6366F1";

        socket.emit("register-session", { sessionId: storedSession, name, color }, (res) => {
          setSessionId(res.sessionId);
          localStorage.setItem("puzzle-session-id", res.sessionId);

          if (roomCodeParam === "new") {
            // Create Room Flow
            const rawCreate = sessionStorage.getItem("puzzle-create-data");
            if (!rawCreate) {
              setError("Missing puzzle setup. Please create a new game.");
              setLoading(false);
              return;
            }
            const createData = JSON.parse(rawCreate);

            socket.emit("create-room", {
              imageUrl: createData.imageUrl,
              imageWidth: createData.imageWidth,
              imageHeight: createData.imageHeight,
              pieceCount: createData.pieceCount,
            }, (roomRes) => {
              if (roomRes?.code) {
                window.history.replaceState(null, "", `/room/${roomRes.code}`);
                joinActiveRoom(socket, roomRes.code, res.sessionId);
              } else {
                setError("Failed to create room.");
                setLoading(false);
              }
            });
          } else {
            // Join Existing Room
            joinActiveRoom(socket, roomCodeParam, res.sessionId);
          }
        });
      });

      socket.on("disconnect", () => setConnected(false));

      // Realtime Puzzle Events
      socket.on("piece-grabbed", (data) => {
        const pieces = piecesRef.current;
        if (data.zOrder) {
          const reordered = [];
          data.zOrder.forEach((id) => {
            const p = pieces.find((item) => item.id === id);
            if (p) reordered.push(p);
          });
          piecesRef.current = reordered;
        }
        const piece = piecesRef.current.find((p) => p.id === data.pieceId);
        if (piece) piece.lockedBy = data.by;
      });

      socket.on("piece-moved", (data) => {
        const piece = piecesRef.current.find((p) => p.id === data.pieceId);
        if (piece) {
          piece.x = data.x;
          piece.y = data.y;
        }
      });

      socket.on("piece-dropped", (data) => {
        const piece = piecesRef.current.find((p) => p.id === data.pieceId);
        if (piece) {
          piece.x = data.x;
          piece.y = data.y;
          piece.placed = data.placed;
          piece.lockedBy = null;

          if (data.didSnap && soundEnabledRef.current) {
            playSnapSound();
          }
        }
      });

      socket.on("pieces-scattered", (data) => {
        if (data?.pieces) {
          piecesRef.current = data.pieces;
          showToast("Pieces rearranged cleanly around board");
        }
      });

      socket.on("cursor-moved", (data) => {
        cursorsRef.current[data.sessionId] = {
          x: data.x,
          y: data.y,
          ...cursorsRef.current[data.sessionId],
        };
      });

      socket.on("player-joined", (data) => {
        setPlayers((prev) => {
          if (prev.some((p) => p.sessionId === data.sessionId)) return prev;
          return [...prev, data];
        });
        cursorsRef.current[data.sessionId] = {
          x: 0,
          y: 0,
          color: data.color,
          name: data.name,
        };
        showToast(`👋 ${data.name || "A player"} joined`);
      });

      socket.on("player-left", (data) => {
        setPlayers((prev) => prev.filter((p) => p.sessionId !== data.sessionId));
        delete cursorsRef.current[data.sessionId];
      });

      socket.on("puzzle-complete", () => {
        setComplete(true);
        if (soundEnabledRef.current) {
          playVictorySound();
        }
        // Spawn victory confetti particles
        spawnConfetti();
      });
    };

    initSocket();
    return () => {
      if (socket) socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const joinActiveRoom = (socket, code, sid) => {
    socket.emit("join-room", { code }, (res) => {
      if (res.error) {
        setError(res.error);
        setLoading(false);
        return;
      }

      setRoomData({
        code: res.code,
        imageUrl: res.imageUrl,
        imageWidth: res.imageWidth,
        imageHeight: res.imageHeight,
        cols: res.cols,
        rows: res.rows,
        pieceCount: res.pieceCount,
      });
      piecesRef.current = res.pieces;
      setPlayers(res.players || []);

      // Prepopulate other player cursor references
      res.players?.forEach((p) => {
        if (p.sessionId !== sid) {
          cursorsRef.current[p.sessionId] = {
            x: 0,
            y: 0,
            color: p.color,
            name: p.name,
          };
        }
      });

      // Load Image
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        imageRef.current = img;
        setLoading(false);
        setTimeout(() => fitPuzzleToView(), 50);
      };
      img.onerror = () => {
        setError("Unable to load puzzle artwork. Please check image permissions.");
        setLoading(false);
      };
      img.src = res.imageUrl;
    });
  };

  // ── Confetti Particle System on Victory ─────────────────────────
  const spawnConfetti = () => {
    const colors = ["#6366F1", "#EC4899", "#10B981", "#06B6D4", "#F59E0B", "#F43F5E"];
    const particles = [];
    for (let i = 0; i < 90; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight * 0.3 - 50,
        vx: (Math.random() - 0.5) * 8,
        vy: Math.random() * 6 + 3,
        rot: Math.random() * 360,
        vRot: (Math.random() - 0.5) * 12,
        size: Math.random() * 8 + 6,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
    particlesRef.current = particles;
  };

  // ── Canvas Main Render Loop ─────────────────────────────────────
  useEffect(() => {
    if (loading || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const render = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      // Handle retina / responsive display sizing
      const dpr = window.devicePixelRatio || 1;
      const width = parent.clientWidth;
      const height = parent.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // World matrix
      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      const rd = roomDataRef.current;
      const img = imageRef.current;
      const pieces = piecesRef.current;
      const curZoom = zoomRef.current;

      if (rd && img) {
        // 1. Draw Target Board Frame
        ctx.fillStyle = "rgba(14, 18, 32, 0.75)";
        ctx.fillRect(0, 0, rd.imageWidth, rd.imageHeight);

        // Optional Ghost Image
        if (showGhostRef.current) {
          ctx.save();
          ctx.globalAlpha = 0.16;
          ctx.drawImage(img, 0, 0, rd.imageWidth, rd.imageHeight);
          ctx.restore();
        }

        // Target Frame Outer Blueprint Line
        ctx.strokeStyle = "rgba(99, 102, 241, 0.4)";
        ctx.lineWidth = 2.5 / curZoom;
        ctx.strokeRect(0, 0, rd.imageWidth, rd.imageHeight);

        // Subtle Target Grid lines
        const pieceW = rd.imageWidth / rd.cols;
        const pieceH = rd.imageHeight / rd.rows;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
        ctx.lineWidth = 1 / curZoom;

        for (let c = 1; c < rd.cols; c++) {
          ctx.beginPath();
          ctx.moveTo(c * pieceW, 0);
          ctx.lineTo(c * pieceW, rd.imageHeight);
          ctx.stroke();
        }
        for (let r = 1; r < rd.rows; r++) {
          ctx.beginPath();
          ctx.moveTo(0, r * pieceH);
          ctx.lineTo(rd.imageWidth, r * pieceH);
          ctx.stroke();
        }

        // 2. Draw Already Placed Pieces First
        pieces.forEach((piece) => {
          if (!piece.placed) return;
          drawJigsawPiece(ctx, img, piece, curZoom, false, rd.imageWidth, rd.imageHeight);
        });

        // 3. Draw Unplaced & Floating Pieces
        pieces.forEach((piece) => {
          if (piece.placed) return;
          drawJigsawPiece(ctx, img, piece, curZoom, true, rd.imageWidth, rd.imageHeight);
        });

        // 4. Draw Other Players' Floating Cursors
        const sid = localStorage.getItem("puzzle-session-id");
        Object.entries(cursorsRef.current).forEach(([csid, cur]) => {
          if (csid === sid || !cur.x) return;

          ctx.save();
          ctx.translate(cur.x, cur.y);

          // Arrow Pointer
          ctx.fillStyle = cur.color || "#6366F1";
          ctx.strokeStyle = "#FFFFFF";
          ctx.lineWidth = 1.5 / curZoom;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(0, 16 / curZoom);
          ctx.lineTo(5 / curZoom, 11 / curZoom);
          ctx.lineTo(12 / curZoom, 11 / curZoom);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Player Name Tag
          const fontSize = Math.max(10, 11 / curZoom);
          ctx.font = `700 ${fontSize}px 'Plus Jakarta Sans', sans-serif`;
          const nameText = cur.name || "Player";
          const textW = ctx.measureText(nameText).width;

          const tagX = 14 / curZoom;
          const tagY = 8 / curZoom;
          const tagPad = 4 / curZoom;

          ctx.fillStyle = cur.color || "#6366F1";
          ctx.beginPath();
          ctx.roundRect(
            tagX,
            tagY - fontSize + tagPad,
            textW + tagPad * 4,
            fontSize + tagPad * 2,
            4 / curZoom
          );
          ctx.fill();

          ctx.fillStyle = "#FFFFFF";
          ctx.fillText(nameText, tagX + tagPad * 2, tagY + tagPad);
          ctx.restore();
        });
      }

      ctx.restore(); // Restore world transform

      // 5. Draw Victory Confetti Particles (in screen space)
      if (particlesRef.current.length > 0) {
        particlesRef.current.forEach((p) => {
          p.x += p.vx;
          p.y += p.vy;
          p.rot += p.vRot;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate((p.rot * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          ctx.restore();
        });

        // Filter out fallen particles
        particlesRef.current = particlesRef.current.filter((p) => p.y < height + 50);
      }

      ctx.restore(); // Restore dpr transform
      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [loading]);

  // ── Helper to Render a Classic Notched Jigsaw Piece ─────────────
  const drawJigsawPiece = (ctx, img, piece, curZoom, isFloating, boardWidth, boardHeight) => {
    const ts = piece.tabSize || Math.min(piece.sw, piece.sh) * 0.22;
    const edges = piece.edges || { top: 0, right: 0, bottom: 0, left: 0 };

    ctx.save();

    // Floating drop shadow for realism
    if (isFloating) {
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = 14 / curZoom;
      ctx.shadowOffsetX = 3 / curZoom;
      ctx.shadowOffsetY = 6 / curZoom;
    }

    // 1. Build the exact jigsaw notch path and clip to it
    buildJigsawPath(ctx, piece.x, piece.y, piece.sw, piece.sh, edges, ts);
    ctx.clip();

    // 2. Draw image translated so (piece.sx, piece.sy) lands at (piece.x, piece.y)
    // This allows tabs to sample pixels seamlessly without clamping or holes!
    ctx.translate(piece.x - piece.sx, piece.y - piece.sy);
    ctx.drawImage(img, 0, 0, boardWidth || img.width, boardHeight || img.height);

    ctx.restore();

    // Stroke Notch Outline
    ctx.save();
    buildJigsawPath(ctx, piece.x, piece.y, piece.sw, piece.sh, edges, ts);

    if (piece.lockedBy) {
      // Active player dragging outline
      const lockingPlayer = players.find((p) => p.sessionId === piece.lockedBy);
      ctx.strokeStyle = lockingPlayer?.color || "#EC4899";
      ctx.lineWidth = 2.5 / curZoom;
      ctx.stroke();
    } else if (piece.placed) {
      // Placed piece: subtle flush border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
      ctx.lineWidth = 0.8 / curZoom;
      ctx.stroke();
    } else {
      // Unplaced floating piece: distinct 3D border
      ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
      ctx.lineWidth = 1.2 / curZoom;
      ctx.stroke();
    }

    ctx.restore();
  };

  // ── Coordinate Mapping ──────────────────────────────────────────
  const screenToWorld = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return {
      x: (sx - panRef.current.x) / zoomRef.current,
      y: (sy - panRef.current.y) / zoomRef.current,
    };
  }, []);

  // ── Mouse Interaction Handlers ──────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)) {
      // Middle or Alt click: Board Pan
      isPanningRef.current = true;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);
    const pieces = piecesRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    // Hit test pieces from top to bottom (reverse z-order)
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      if (p.placed || p.lockedBy) continue;

      if (isPointInsidePiece(ctx, wx, wy, p, p.tabSize)) {
        draggingRef.current = {
          pieceId: p.id,
          offsetX: wx - p.x,
          offsetY: wy - p.y,
        };
        socketRef.current?.emit("piece-grab", { pieceId: p.id });
        if (soundEnabledRef.current) playGrabSound();
        return;
      }
    }

    // Clicked empty canvas: start panning board
    isPanningRef.current = true;
    lastPanRef.current = { x: e.clientX, y: e.clientY };
  }, [screenToWorld]);

  const handleMouseMove = useCallback((e) => {
    if (isPanningRef.current) {
      const dx = e.clientX - lastPanRef.current.x;
      const dy = e.clientY - lastPanRef.current.y;
      lastPanRef.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => {
        const nextPan = { x: prev.x + dx, y: prev.y + dy };
        panRef.current = nextPan;
        return nextPan;
      });
      return;
    }

    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY);

    // Broadcast cursor position
    socketRef.current?.emit("cursor-move", { x: wx, y: wy });

    // Drag active piece
    if (draggingRef.current) {
      const piece = piecesRef.current.find((p) => p.id === draggingRef.current.pieceId);
      if (piece) {
        piece.x = wx - draggingRef.current.offsetX;
        piece.y = wy - draggingRef.current.offsetY;
        socketRef.current?.emit("piece-move", {
          pieceId: piece.id,
          x: piece.x,
          y: piece.y,
        });
      }
    }
  }, [screenToWorld]);

  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
    }

    if (draggingRef.current) {
      const piece = piecesRef.current.find((p) => p.id === draggingRef.current.pieceId);
      if (piece) {
        socketRef.current?.emit("piece-drop", {
          pieceId: piece.id,
          x: piece.x,
          y: piece.y,
        });
      }
      draggingRef.current = null;
    }
  }, []);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;

    setZoom((prev) => {
      const newZoom = Math.min(Math.max(prev * factor, 0.15), 3.5);
      zoomRef.current = newZoom;

      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const worldX = (mx - panRef.current.x) / prev;
        const worldY = (my - panRef.current.y) / prev;
        const nextPan = {
          x: mx - worldX * newZoom,
          y: my - worldY * newZoom,
        };
        setPan(nextPan);
        panRef.current = nextPan;
      }
      return newZoom;
    });
  }, []);

  // ── Full Touch & Pinch-to-Zoom Gesture Handlers ─────────────────
  const handleTouchStart = useCallback((e) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const { x: wx, y: wy } = screenToWorld(touch.clientX, touch.clientY);
      const pieces = piecesRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      for (let i = pieces.length - 1; i >= 0; i--) {
        const p = pieces[i];
        if (p.placed || p.lockedBy) continue;

        if (isPointInsidePiece(ctx, wx, wy, p, p.tabSize)) {
          draggingRef.current = {
            pieceId: p.id,
            offsetX: wx - p.x,
            offsetY: wy - p.y,
          };
          socketRef.current?.emit("piece-grab", { pieceId: p.id });
          if (soundEnabledRef.current) playGrabSound();
          return;
        }
      }

      // Empty touch: Pan
      isPanningRef.current = true;
      lastPanRef.current = { x: touch.clientX, y: touch.clientY };
    } else if (e.touches.length === 2) {
      // Two finger pinch start
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      touchPinchRef.current = {
        dist,
        midX: (t1.clientX + t2.clientX) / 2,
        midY: (t1.clientY + t2.clientY) / 2,
      };
      if (draggingRef.current) {
        draggingRef.current = null;
      }
    }
  }, [screenToWorld]);

  const handleTouchMove = useCallback((e) => {
    e.preventDefault();

    if (e.touches.length === 2 && touchPinchRef.current) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const ratio = newDist / touchPinchRef.current.dist;

      const midX = (t1.clientX + t2.clientX) / 2;
      const midY = (t1.clientY + t2.clientY) / 2;

      setZoom((prev) => {
        const newZoom = Math.min(Math.max(prev * ratio, 0.15), 3.5);
        zoomRef.current = newZoom;

        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const mx = midX - rect.left;
          const my = midY - rect.top;
          const worldX = (mx - panRef.current.x) / prev;
          const worldY = (my - panRef.current.y) / prev;
          const nextPan = {
            x: mx - worldX * newZoom,
            y: my - worldY * newZoom,
          };
          setPan(nextPan);
          panRef.current = nextPan;
        }
        return newZoom;
      });

      touchPinchRef.current = { dist: newDist, midX, midY };
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (isPanningRef.current) {
        const dx = touch.clientX - lastPanRef.current.x;
        const dy = touch.clientY - lastPanRef.current.y;
        lastPanRef.current = { x: touch.clientX, y: touch.clientY };
        setPan((prev) => {
          const nextPan = { x: prev.x + dx, y: prev.y + dy };
          panRef.current = nextPan;
          return nextPan;
        });
        return;
      }

      if (draggingRef.current) {
        const { x: wx, y: wy } = screenToWorld(touch.clientX, touch.clientY);
        const piece = piecesRef.current.find((p) => p.id === draggingRef.current.pieceId);
        if (piece) {
          piece.x = wx - draggingRef.current.offsetX;
          piece.y = wy - draggingRef.current.offsetY;
          socketRef.current?.emit("piece-move", {
            pieceId: piece.id,
            x: piece.x,
            y: piece.y,
          });
        }
      }
    }
  }, [screenToWorld]);

  const handleTouchEnd = useCallback((e) => {
    if (e.touches.length === 0) {
      touchPinchRef.current = null;
      if (isPanningRef.current) isPanningRef.current = false;
      if (draggingRef.current) {
        const piece = piecesRef.current.find((p) => p.id === draggingRef.current.pieceId);
        if (piece) {
          socketRef.current?.emit("piece-drop", {
            pieceId: piece.id,
            x: piece.x,
            y: piece.y,
          });
        }
        draggingRef.current = null;
      }
    }
  }, []);

  // Bind non-passive wheel & context menu events
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    parent.addEventListener("wheel", handleWheel, { passive: false });
    const noContext = (e) => e.preventDefault();
    document.addEventListener("contextmenu", noContext);

    return () => {
      parent.removeEventListener("wheel", handleWheel);
      document.removeEventListener("contextmenu", noContext);
    };
  }, [handleWheel, loading]);

  const copyRoomCode = () => {
    const code = roomData?.code || roomCodeParam;
    if (code) {
      navigator.clipboard.writeText(code).catch(() => {});
      showToast(`🔑 Room code "${code}" copied!`);
    }
  };

  const scatterUnplacedPieces = () => {
    socketRef.current?.emit("scatter-pieces");
  };

  // Progress metrics
  const totalPieces = piecesRef.current.length || roomData?.pieceCount || 1;
  const placedPieces = piecesRef.current.filter((p) => p.placed).length;
  const progressPercent = Math.round((placedPieces / totalPieces) * 100);

  // ── Render Error View ───────────────────────────────────────────
  if (error) {
    return (
      <div className={styles.roomWrapper}>
        <div className={styles.topNav}>
          <Link href="/" className={styles.homeBtn}>
            ← <span>Home</span>
          </Link>
        </div>
        <div className={styles.errorScreen}>
          <div className={styles.errorEmoji}>🧩</div>
          <div className={styles.errorHeading}>Room Unavailable</div>
          <div className={styles.errorDesc}>{error}</div>
          <Link href="/" className="btn btn-primary" style={{ marginTop: 12 }}>
            Return to Lobby
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.roomWrapper}>
      {/* Top Navigation Bar */}
      <header className={styles.topNav}>
        <div className={styles.navLeft}>
          <Link href="/" className={styles.homeBtn} title="Back to Lobby">
            ← <span>Home</span>
          </Link>
          <div
            className={styles.roomBadge}
            onClick={copyRoomCode}
            title="Click to copy room code"
          >
            <span>🔑</span>
            <span className={styles.roomCodeText}>
              {roomData?.code || roomCodeParam}
            </span>
            <span className={styles.copyIcon}>📋</span>
          </div>
        </div>

        {/* Center Progress Bar */}
        {!loading && (
          <div className={styles.navCenter}>
            <div className={styles.progressInfo}>
              <span className={styles.progressText}>Progress</span>
              <span className={styles.progressCount}>
                {placedPieces} / {totalPieces} ({progressPercent}%)
              </span>
            </div>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Right Actions & Players */}
        <div className={styles.navRight}>
          {/* Active Player Avatars */}
          <div className={styles.playerStack}>
            {players.map((p) => (
              <div
                key={p.sessionId}
                className={styles.playerAvatar}
                style={{ backgroundColor: p.color || "#6366F1" }}
              >
                {(p.name || "P")[0].toUpperCase()}
                <div className={styles.avatarTooltip}>{p.name}</div>
              </div>
            ))}
          </div>

          {/* Desktop Actions Bar (Hidden on Mobile) */}
          <div className={styles.desktopActions}>
            <button
              type="button"
              className={`${styles.controlBtn} ${soundEnabled ? styles.btnActive : ""}`}
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute audio" : "Enable audio"}
            >
              {soundEnabled ? "🔊" : "🔇"}
            </button>

            <button
              type="button"
              className={`${styles.controlBtn} ${showGhost ? styles.btnActive : ""}`}
              onClick={() => setShowGhost(!showGhost)}
              title="Toggle faint background guide"
            >
              👻 <span>Guide</span>
            </button>

            <button
              type="button"
              className={`${styles.controlBtn} ${showRef ? styles.btnActive : ""}`}
              onClick={() => setShowRef(!showRef)}
              title="View finished image reference"
            >
              🖼️ <span>Reference</span>
            </button>

            <button
              type="button"
              className={styles.controlBtn}
              onClick={fitPuzzleToView}
              title="Fit board to screen"
            >
              🎯 <span>Center</span>
            </button>

            <button
              type="button"
              className={styles.controlBtn}
              onClick={scatterUnplacedPieces}
              title="Arrange unplaced pieces neatly in outer margins"
            >
              🔀 <span>Scatter</span>
            </button>
          </div>

          {/* Mobile Tools Dropdown Menu (Visible on narrow screens) */}
          <div className={styles.mobileToolsWrapper} ref={toolsMenuRef}>
            <button
              type="button"
              className={`${styles.toolsToggleBtn} ${showToolsMenu ? styles.toolsToggleActive : ""}`}
              onClick={() => setShowToolsMenu((prev) => !prev)}
              title="Outils"
              aria-label="Outils"
            >
              🛠️
            </button>

            {showToolsMenu && (
              <div className={styles.toolsDropdown}>
                <button
                  type="button"
                  className={`${styles.dropdownItem} ${showRef ? styles.dropdownActive : ""}`}
                  onClick={() => {
                    setShowRef(!showRef);
                    setShowToolsMenu(false);
                  }}
                >
                  <span className={styles.dropdownIcon}>🖼️</span>
                  <span>Photo modèle</span>
                  {showRef && <span className={styles.dropdownCheck}>✓</span>}
                </button>

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${showGhost ? styles.dropdownActive : ""}`}
                  onClick={() => {
                    setShowGhost(!showGhost);
                    setShowToolsMenu(false);
                  }}
                >
                  <span className={styles.dropdownIcon}>👻</span>
                  <span>Guide fantôme</span>
                  {showGhost && <span className={styles.dropdownCheck}>✓</span>}
                </button>

                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    fitPuzzleToView();
                    setShowToolsMenu(false);
                  }}
                >
                  <span className={styles.dropdownIcon}>🎯</span>
                  <span>Centrer le puzzle</span>
                </button>

                <button
                  type="button"
                  className={styles.dropdownItem}
                  onClick={() => {
                    scatterUnplacedPieces();
                    setShowToolsMenu(false);
                  }}
                >
                  <span className={styles.dropdownIcon}>🔀</span>
                  <span>Ranger les pièces</span>
                </button>

                <div className={styles.dropdownDivider} />

                <button
                  type="button"
                  className={`${styles.dropdownItem} ${soundEnabled ? styles.dropdownActive : ""}`}
                  onClick={() => setSoundEnabled(!soundEnabled)}
                >
                  <span className={styles.dropdownIcon}>{soundEnabled ? "🔊" : "🔇"}</span>
                  <span>{soundEnabled ? "Effets sonores (On)" : "Effets sonores (Off)"}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className={styles.toastNotice}>
          {toastMessage}
        </div>
      )}

      {/* Main Interactive Canvas */}
      {loading ? (
        <div className={styles.loadingScreen}>
          <div className="spinner" style={{ width: 44, height: 44 }} />
          <div className={styles.loadingHeading}>Connecting to Puzzle Room...</div>
          <div className={styles.loadingSub}>
            Carving classic notched pieces & synchronizing board state
          </div>
        </div>
      ) : (
        <div
          className={`${styles.canvasArea} touch-canvas`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        >
          <canvas
            ref={canvasRef}
            className={`${styles.gameCanvas} ${draggingRef.current ? styles.isDragging : ""}`}
          />

          {/* Desktop Floating Zoom Pill */}
          <div className={styles.desktopControls}>
            <div className={styles.zoomPill}>
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={() => {
                  setZoom((z) => {
                    const nz = Math.min(z * 1.25, 3.5);
                    zoomRef.current = nz;
                    return nz;
                  });
                }}
                title="Zoom In"
              >
                +
              </button>
              <div className={styles.zoomPercentage}>{Math.round(zoom * 100)}%</div>
              <button
                type="button"
                className={styles.zoomBtn}
                onClick={() => {
                  setZoom((z) => {
                    const nz = Math.max(z * 0.8, 0.15);
                    zoomRef.current = nz;
                    return nz;
                  });
                }}
                title="Zoom Out"
              >
                −
              </button>
            </div>
          </div>

          {/* Reference Image Drawer / Modal */}
          {showRef && roomData && (
            <div className={styles.referenceDrawer}>
              <div className={styles.refHeader}>
                <div className={styles.refTitle}>
                  <span>🖼️</span> Completed Picture Reference
                </div>
                <button
                  type="button"
                  className={styles.refCloseBtn}
                  onClick={() => setShowRef(false)}
                >
                  ✕
                </button>
              </div>
              <img
                className={styles.refImagePreview}
                src={roomData.imageUrl}
                alt="Reference artwork"
                crossOrigin="anonymous"
              />
            </div>
          )}

          {/* Mobile Bottom Quick-Access Toolbar */}
          <div className={styles.mobileToolbar}>
            <button
              type="button"
              className={styles.mobileToolBtn}
              onClick={() => {
                setZoom((z) => {
                  const nz = Math.min(z * 1.25, 3.5);
                  zoomRef.current = nz;
                  return nz;
                });
              }}
            >
              <span className={styles.mobileToolIcon}>🔍+</span>
              Zoom In
            </button>
            <button
              type="button"
              className={styles.mobileToolBtn}
              onClick={() => {
                setZoom((z) => {
                  const nz = Math.max(z * 0.8, 0.15);
                  zoomRef.current = nz;
                  return nz;
                });
              }}
            >
              <span className={styles.mobileToolIcon}>🔍−</span>
              Zoom Out
            </button>
            <button
              type="button"
              className={styles.mobileToolBtn}
              onClick={fitPuzzleToView}
            >
              <span className={styles.mobileToolIcon}>🎯</span>
              Fit
            </button>
            <button
              type="button"
              className={`${styles.mobileToolBtn} ${showGhost ? styles.mobileActive : ""}`}
              onClick={() => setShowGhost(!showGhost)}
            >
              <span className={styles.mobileToolIcon}>👻</span>
              Guide
            </button>
            <button
              type="button"
              className={`${styles.mobileToolBtn} ${showRef ? styles.mobileActive : ""}`}
              onClick={() => setShowRef(!showRef)}
            >
              <span className={styles.mobileToolIcon}>🖼️</span>
              Photo
            </button>
          </div>
        </div>
      )}

      {/* Victory Celebration Overlay */}
      {complete && (
        <div className={styles.victoryOverlay}>
          <div className={styles.victoryCard}>
            <div className={styles.victoryIcon}>🏆</div>
            <h2 className={styles.victoryTitle}>Puzzle Complete!</h2>
            <p className={styles.victoryMessage}>
              Incredible teamwork! Every classic notched piece was solved and locked into place.
            </p>
            <div className={styles.victoryActions}>
              <Link href="/" className="btn btn-primary btn-lg">
                🚀 Create New Puzzle
              </Link>
              <button
                type="button"
                className="btn btn-secondary btn-lg"
                onClick={() => setComplete(false)}
              >
                Inspect Board
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
