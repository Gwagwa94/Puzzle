# 🧩 PuzzleTogether — Multiplayer Online Jigsaw Puzzles

A real-time cooperative jigsaw puzzle web app built with **Next.js**, **Socket.io**, and **HTML5 Canvas**.

Play together with friends using 6-character room codes — no login or account required.

---

## ✨ Features

- **🧩 Classic Squared Pieces with Authentic Notches**: Pieces feature smooth interlocking bulbous tabs and blanks (with straight exterior borders) computed using parametric cubic Bézier curves.
- **🌐 Real-Time Multiplayer**: Collaborate simultaneously with friends. See other players' cursors in real time, active piece drag highlights with player names, and instant snap updates.
- **🔑 Room Codes**: Quick 6-character codes (e.g. `K9N2P4`) with one-click copy and share.
- **🎨 Beautiful Responsive UI**: Sleek dark glassmorphic interface that scales across mobile phones, tablets, and 4K desktop screens.
- **📱 Touch & Gesture Support**: Single-touch piece dragging, two-finger pinch-to-zoom, and touch panning on mobile/tablets.
- **🖼️ Curated High-Res Artwork & Custom Upload**: 8 curated open-source nature/landscape photos, plus drag-and-drop custom image file upload or paste URL.
- **🔢 Custom Piece Counts**: Choose from 12, 24, 48, 80, or 120 pieces or adjust with the fine slider.
- **🔊 Synthesized Web Audio Effects**: Satisfying piece pickup clicks, snap-into-place locks, and victory fanfare (all generated on the fly via Web Audio API, no external audio files needed).
- **👻 Ghost Guide Overlay**: Toggle a faint 16% opacity guide of the finished image on the target frame.
- **👤 Persistent Web Sessions**: Player name, avatar color, and session ID persist in `localStorage` without requiring any account creation.

---

## 🚀 Running with Docker (Recommended for Server Deployment)

You can deploy the app to any server or cloud VPS with a single Docker command.

### Option 1: Docker Compose

```bash
# Build and run in detached mode
docker compose up -d --build

# View container logs
docker compose logs -f

# Stop container
docker compose down
```

The app will be accessible at `http://your-server-ip:3000` (or behind a reverse proxy like Nginx/Caddy on port 80/443).

### Option 2: Docker CLI

```bash
# 1. Build the Docker image
docker build -t puzzle-together .

# 2. Run the container
docker run -d \
  --name puzzle-together \
  --restart unless-stopped \
  -p 3000:3000 \
  -e PORT=3000 \
  -e HOSTNAME=0.0.0.0 \
  puzzle-together
```

---

## 💻 Running Locally for Development

### 1. Install dependencies
```bash
npm install
```

### 2. Start the development server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build locally
```bash
npm run build
npm start
```

---

## 🛠️ Tech Stack & Architecture

- **Next.js (App Router)**: Client and server components, standalone build optimization.
- **Socket.io**: Low-latency WebSocket room state synchronization, piece locking, and cursor broadcasting.
- **Node.js Custom Server (`server.js`)**: Coordinates HTTP and WebSocket handlers on a single port (`3000`) bound to `0.0.0.0`.
- **HTML5 Canvas & Web Audio API**: 60fps piece rendering, clipping, and audio synthesis.
