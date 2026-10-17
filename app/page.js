"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const CURATED_IMAGES = [
  {
    id: "mountain-lake",
    label: "Alpine Mountain Lake",
    category: "Nature",
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=450&q=70&auto=format&fit=crop",
  },
  {
    id: "autumn-forest",
    label: "Golden Autumn Forest",
    category: "Landscape",
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=450&q=70&auto=format&fit=crop",
  },
  {
    id: "coastal-sunset",
    label: "Tropical Coastal Sunset",
    category: "Ocean",
    url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=450&q=70&auto=format&fit=crop",
  },
  {
    id: "wildflowers",
    label: "Meadow of Wildflowers",
    category: "Flora",
    url: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=450&q=70&auto=format&fit=crop",
  },
  {
    id: "cyberpunk-tokyo",
    label: "Cyberpunk Tokyo City",
    category: "Urban",
    url: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=450&q=70&auto=format&fit=crop",
  },
  {
    id: "galaxy-nebula",
    label: "Cosmic Nebula",
    category: "Space",
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=450&q=70&auto=format&fit=crop",
  },
  {
    id: "alpine-village",
    label: "Swiss Alpine Village",
    category: "Travel",
    url: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=450&q=70&auto=format&fit=crop",
  },
  {
    id: "red-canyon",
    label: "Desert Canyon Arches",
    category: "Geology",
    url: "https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=1600&q=85&auto=format&fit=crop",
    thumb: "https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=450&q=70&auto=format&fit=crop",
  },
];

const AVATAR_COLORS = [
  "#6366F1", "#EC4899", "#10B981", "#06B6D4",
  "#F59E0B", "#8B5CF6", "#EF4444", "#3B82F6",
];

const FUN_NAMES = [
  "Swift Otter", "Cosmic Fox", "Neon Eagle", "Pixel Panda",
  "Shadow Lynx", "Starling", "Zen Master", "Puzzle Wizard",
  "Aura Bear", "Solar Falcon", "Turbo Badger", "Lucky Owl"
];

const DIFFICULTY_PRESETS = [
  { pieces: 12, label: "Quick", time: "~3 min" },
  { pieces: 24, label: "Casual", time: "~8 min" },
  { pieces: 48, label: "Classic", time: "~15 min" },
  { pieces: 80, label: "Challenge", time: "~30 min" },
  { pieces: 120, label: "Master", time: "~1 hr" },
];

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef(null);

  const [activeTab, setActiveTab] = useState("create");
  const [playerName, setPlayerName] = useState("");
  const [playerColor, setPlayerColor] = useState(AVATAR_COLORS[0]);
  const [selectedImageId, setSelectedImageId] = useState(CURATED_IMAGES[0].id);
  const [customImage, setCustomImage] = useState(null);
  const [customFileName, setCustomFileName] = useState("");
  const [pieceCount, setPieceCount] = useState(24);
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Load persistent user profile
  useEffect(() => {
    const savedName = localStorage.getItem("puzzle-player-name");
    const savedColor = localStorage.getItem("puzzle-player-color");

    if (savedName) {
      setPlayerName(savedName);
    } else {
      const randomName = FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
      setPlayerName(randomName);
      localStorage.setItem("puzzle-player-name", randomName);
    }

    if (savedColor) {
      setPlayerColor(savedColor);
    } else {
      const randomColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      setPlayerColor(randomColor);
      localStorage.setItem("puzzle-player-color", randomColor);
    }
  }, []);

  const handleNameChange = (val) => {
    setPlayerName(val);
    localStorage.setItem("puzzle-player-name", val);
  };

  const handleColorChange = (col) => {
    setPlayerColor(col);
    localStorage.setItem("puzzle-player-color", col);
  };

  const randomizeName = () => {
    const random = FUN_NAMES[Math.floor(Math.random() * FUN_NAMES.length)];
    handleNameChange(random);
  };

  const handleCustomUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setErrorMessage("Please select a valid image file (PNG, JPEG, WebP)");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setErrorMessage("Image is larger than 12MB. Please choose a smaller file.");
      return;
    }

    setErrorMessage("");
    setCustomFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      setCustomImage(event.target.result);
      setSelectedImageId("custom");
    };
    reader.readAsDataURL(file);
  };

  const getActiveImageUrl = () => {
    if (selectedImageId === "custom") {
      return customImage;
    }
    const found = CURATED_IMAGES.find((img) => img.id === selectedImageId);
    return found ? found.url : CURATED_IMAGES[0].url;
  };

  // Calculate grid dimensions
  const getColsRows = (total) => {
    const sqrt = Math.sqrt(total);
    let cols = Math.round(sqrt);
    let rows = Math.round(total / cols);
    while (cols * rows < total) rows++;
    while (cols * rows > total && rows > 1) rows--;
    return { cols: Math.max(2, cols), rows: Math.max(2, rows) };
  };

  const { cols, rows } = getColsRows(pieceCount);
  const actualPieces = cols * rows;

  const handleCreateRoom = () => {
    if (!playerName.trim()) {
      setErrorMessage("Please enter your player display name.");
      return;
    }

    const imgUrl = getActiveImageUrl();
    if (!imgUrl) {
      setErrorMessage("Please choose or upload an image.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      // Pass creation metadata via sessionStorage
      const createData = {
        imageUrl: imgUrl,
        imageWidth: img.naturalWidth || 800,
        imageHeight: img.naturalHeight || 600,
        pieceCount: actualPieces,
        playerName: playerName.trim(),
        playerColor: playerColor,
      };
      sessionStorage.setItem("puzzle-create-data", JSON.stringify(createData));
      router.push("/room/new");
    };

    img.onerror = () => {
      setErrorMessage("Failed to load image. If using a custom image, verify the file or link.");
      setLoading(false);
    };

    img.src = imgUrl;
  };

  const handleJoinRoom = () => {
    if (!playerName.trim()) {
      setErrorMessage("Please enter your player display name.");
      return;
    }

    const cleanCode = joinCode.trim().toUpperCase();
    if (cleanCode.length < 4) {
      setErrorMessage("Please enter a valid room code.");
      return;
    }

    sessionStorage.setItem("puzzle-player-name-join", playerName.trim());
    sessionStorage.setItem("puzzle-player-color-join", playerColor);
    router.push(`/room/${cleanCode}`);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJoinCode(text.trim().toUpperCase().slice(0, 8));
      }
    } catch {
      // Clipboard permissions denied
    }
  };

  return (
    <div className={styles.homeWrapper}>
      {/* Top Navbar */}
      <header className={styles.navHeader}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>🧩</div>
          <div className={styles.brandText}>
            <div className={styles.brandName}>Puzzle<span>Together</span></div>
            <div className={styles.brandTagline}>Multiplayer Jigsaw Co-op</div>
          </div>
        </div>
        <div className={styles.navFeatures}>
          <span className="badge badge-brand">⚡ Real-time Notches</span>
          <span className="badge badge-success">🔒 Room Codes</span>
        </div>
      </header>

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBadge}>
          <span className="badge badge-brand">Instant Multiplayer • No Accounts</span>
        </div>
        <h1 className={styles.heroTitle}>
          Assemble Jigsaw Puzzles <span>Together in Real-Time</span>
        </h1>
        <p className={styles.heroSubtitle}>
          Pick a high-res image, choose authentic notched pieces, and share a room code with friends to solve it simultaneously.
        </p>

        {/* Player Identity Pill */}
        <div className={styles.playerProfileBar}>
          <div
            className={styles.playerAvatarPreview}
            style={{ backgroundColor: playerColor }}
          >
            {(playerName || "P")[0].toUpperCase()}
          </div>
          <div className={styles.playerInputs}>
            <div className={styles.playerNameRow}>
              <input
                className={styles.playerNameInput}
                type="text"
                placeholder="Your display name..."
                value={playerName}
                onChange={(e) => handleNameChange(e.target.value)}
                maxLength={20}
              />
              <button
                type="button"
                className={styles.diceBtn}
                onClick={randomizeName}
                title="Randomize name"
              >
                🎲 Random
              </button>
            </div>
            <div className={styles.colorPickerRow}>
              {AVATAR_COLORS.map((col) => (
                <div
                  key={col}
                  className={`${styles.colorSwatch} ${playerColor === col ? styles.colorActive : ""}`}
                  style={{ backgroundColor: col }}
                  onClick={() => handleColorChange(col)}
                  title={col}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Glass Card */}
      <main className={`glass-panel ${styles.mainCard}`}>
        {/* Tab Switcher */}
        <div className={styles.tabSwitch}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "create" ? styles.tabActive : ""}`}
            onClick={() => { setActiveTab("create"); setErrorMessage(""); }}
          >
            <span>🧩</span> Create New Game
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "join" ? styles.tabActive : ""}`}
            onClick={() => { setActiveTab("join"); setErrorMessage(""); }}
          >
            <span>🔑</span> Join with Code
          </button>
        </div>

        {/* CREATE TAB */}
        {activeTab === "create" && (
          <div>
            {/* Step 1: Image Gallery */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <span className={styles.sectionStep}>1</span> Choose a Puzzle Image
                </div>
                <span className="badge badge-brand">High-Res Curated</span>
              </div>

              <div className={styles.imageGrid}>
                {CURATED_IMAGES.map((img) => (
                  <div
                    key={img.id}
                    className={`${styles.imageCard} ${
                      selectedImageId === img.id ? styles.imageSelected : ""
                    }`}
                    onClick={() => {
                      setSelectedImageId(img.id);
                      setCustomImage(null);
                    }}
                  >
                    <img
                      className={styles.cardImg}
                      src={img.thumb}
                      alt={img.label}
                      crossOrigin="anonymous"
                      loading="lazy"
                    />
                    <div className={styles.imageOverlay}>
                      <span className={styles.imageCardLabel}>{img.label}</span>
                    </div>
                    {selectedImageId === img.id && (
                      <div className={styles.checkBadge}>✓</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Upload Your Own Image */}
              <div
                className={`${styles.uploadContainer} ${customImage ? styles.uploadActive : ""}`}
                onClick={() => fileInputRef.current?.click()}
              >
                {customImage ? (
                  <div className={styles.uploadPreviewRow}>
                    <img
                      className={styles.uploadThumb}
                      src={customImage}
                      alt="Custom Preview"
                    />
                    <div className={styles.uploadMeta}>
                      <div className={styles.uploadFileName}>✅ {customFileName || "Custom Image"}</div>
                      <div className={styles.uploadFileHint}>Click to choose a different photo</div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.uploadEmpty}>
                    <div className={styles.uploadIcon}>📸</div>
                    <div className={styles.uploadTitle}>Or Upload Your Own Custom Image</div>
                    <div className={styles.uploadSubtitle}>PNG, JPEG, WebP up to 12MB • High resolution recommended</div>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={handleCustomUpload}
                />
              </div>
            </div>

            {/* Step 2: Piece Count & Difficulty */}
            <div className={styles.sectionBlock}>
              <div className={styles.sectionHeader}>
                <div className={styles.sectionTitle}>
                  <span className={styles.sectionStep}>2</span> Number of Pieces
                </div>
                <span className="badge badge-brand">Classic Notches</span>
              </div>

              {/* Presets */}
              <div className={styles.difficultyPresets}>
                {DIFFICULTY_PRESETS.map((preset) => (
                  <div
                    key={preset.pieces}
                    className={`${styles.presetCard} ${
                      pieceCount === preset.pieces ? styles.presetActive : ""
                    }`}
                    onClick={() => setPieceCount(preset.pieces)}
                  >
                    <div className={styles.presetPieces}>{preset.pieces} pcs</div>
                    <div className={styles.presetLabel}>{preset.label}</div>
                  </div>
                ))}
              </div>

              {/* Fine Slider */}
              <div className={styles.sliderRow}>
                <input
                  className={styles.pieceSlider}
                  type="range"
                  min={8}
                  max={144}
                  value={pieceCount}
                  onChange={(e) => setPieceCount(parseInt(e.target.value, 10))}
                />
                <div className={styles.sliderReadout}>
                  <span className={styles.sliderCount}>{actualPieces} Pieces</span>
                  <span className={styles.sliderGridDim}>{cols} cols × {rows} rows</span>
                </div>
              </div>
            </div>

            {/* Error Feedback */}
            {errorMessage && (
              <div className={styles.errorBanner}>
                ⚠️ {errorMessage}
              </div>
            )}

            {/* Action Button */}
            <div className={styles.actionFooter}>
              <button
                type="button"
                className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                onClick={handleCreateRoom}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    Generating Puzzle Board...
                  </>
                ) : (
                  <>🚀 Launch Puzzle Room</>
                )}
              </button>
            </div>
          </div>
        )}

        {/* JOIN TAB */}
        {activeTab === "join" && (
          <div className={styles.joinContainer}>
            <div className={styles.sectionTitle} style={{ justifyContent: "center" }}>
              Enter 6-Character Room Code
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: 13, marginTop: 6 }}>
              Ask your friend for the code shown in their puzzle header.
            </p>

            <div className={styles.codeBox}>
              <input
                className={styles.codeField}
                type="text"
                placeholder="ABC123"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 8))}
                maxLength={8}
              />
              <button
                type="button"
                className={styles.pasteBtn}
                onClick={pasteFromClipboard}
                title="Paste from clipboard"
              >
                📋 Paste
              </button>
            </div>

            {errorMessage && (
              <div className={styles.errorBanner}>
                ⚠️ {errorMessage}
              </div>
            )}

            <div className={styles.actionFooter}>
              <button
                type="button"
                className={`btn btn-primary btn-lg ${styles.submitBtn}`}
                onClick={handleJoinRoom}
                disabled={!joinCode.trim()}
              >
                🎯 Enter Room & Play
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={styles.appFooter}>
        PuzzleTogether • Real-time cooperative jigsaw puzzles with authentic notches.
      </footer>
    </div>
  );
}
