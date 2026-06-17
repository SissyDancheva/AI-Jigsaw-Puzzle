import React, { useState, useEffect, useRef } from "react";
import { 
  Puzzle, 
  Sparkles, 
  Upload, 
  Timer, 
  CheckCircle2, 
  Grid, 
  Image as ImageIcon, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Play, 
  ChevronLeft, 
  HelpCircle, 
  Trophy, 
  Sliders, 
  Loader2,
  Maximize2,
  Sparkle
} from "lucide-react";
import { GameStage, Piece, PresetImage, GameStats } from "./types";
import { PRESET_IMAGES } from "./data";
import { slicePuzzleImage } from "./utils/jigsawSlicer";
import { 
  playClickSound, 
  playPickupSound, 
  playSnapSound, 
  playWinSound 
} from "./utils/audioSynthesizer";
import VictoryConfetti from "./components/VictoryConfetti";

export default function App() {
  //Stage States
  const [stage, setStage] = useState<GameStage>(GameStage.Lobby);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  // Selection configurations
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>(PRESET_IMAGES[0].url);
  const [selectedPresetId, setSelectedPresetId] = useState<string>(PRESET_IMAGES[0].id);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Difficulty metrics
  const [rows, setRows] = useState<number>(4);
  const [cols, setCols] = useState<number>(4);

  // Loaded Puzzle states
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [boardWidth, setBoardWidth] = useState<number>(640);
  const [boardHeight, setBoardHeight] = useState<number>(480);
  const [stats, setStats] = useState<GameStats>({
    moves: 0,
    startTime: null,
    elapsedSeconds: 0,
    isTimerRunning: false,
    totalPieces: 0,
    snappedCount: 0,
  });

  // UI view controls
  const [showGhost, setShowGhost] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);

  // Drag and Drop workspace states
  const [activePieceId, setActivePieceId] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const dragStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const pieceStartPos = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Custom suggestions for AI images
  const samplePrompts = [
    "a castle floating in bioluminescent clouds, watercolor",
    "a cozy log cabin in snowy pine woods, northern lights high detail",
    "glowing cyberpunk panda eating ramen in neon back-alleys",
    "mystical undersea palace surrounded by giant neon jellyfish"
  ];

  // Load preset categories
  const categories = ["All", ...Array.from(new Set(PRESET_IMAGES.map(img => img.category)))];
  const filteredPresets = activeCategory === "All" 
    ? PRESET_IMAGES 
    : PRESET_IMAGES.filter(img => img.category === activeCategory);

  // Timer intervals
  useEffect(() => {
    let interval: any = null;
    if (stats.isTimerRunning && stage === GameStage.Playing) {
      interval = setInterval(() => {
        setStats(prev => ({
          ...prev,
          elapsedSeconds: prev.elapsedSeconds + 1
        }));
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [stats.isTimerRunning, stage]);

  // Adjust columns/rows for standard fast presets
  const applyDifficultyPreset = (r: number, c: number) => {
    setRows(r);
    setCols(c);
    playClickSound();
  };

  // Convert files on local upload slot
  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setSelectedImageUrl(reader.result);
        setSelectedPresetId("custom-upload");
        playClickSound();
      }
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop event integrations for device images
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setSelectedImageUrl(reader.result);
          setSelectedPresetId("custom-upload");
          playClickSound();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Generate dynamic puzzles using the server endpoint
  const generateAIImage = async () => {
    if (!customPrompt.trim()) return;

    setIsGenerating(true);
    setGenError(null);
    playClickSound();

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: customPrompt }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to generate AI artwork");
      }

      setSelectedImageUrl(data.imageUrl);
      setSelectedPresetId("ai-generated");
      playClickSound();
    } catch (err: any) {
      console.error(err);
      setGenError(err.message || "An unexpected error occurred during stardust generation");
    } finally {
      setIsGenerating(false);
    }
  };

  // Build the game board by slicing the active image
  const startNewGameStage = async () => {
    setStage(GameStage.Generating);
    playClickSound();

    try {
      // Clean up previous game metrics
      setPieces([]);
      setStats({
        moves: 0,
        startTime: Date.now(),
        elapsedSeconds: 0,
        isTimerRunning: true,
        totalPieces: rows * cols,
        snappedCount: 0,
      });

      const result = await slicePuzzleImage(selectedImageUrl, rows, cols, 740, 500);
      setBoardWidth(result.boardWidth);
      setBoardHeight(result.boardHeight);

      // Pre-scatter or neatly align the pieces in the tray initially to guarantee perfect visibility
      const rawPieces = result.pieces.map(piece => ({
        ...piece,
        currentX: 0,
        currentY: 0,
        isSnapped: false,
      }));

      const scatteredPieces = layoutPiecesInTray(rawPieces, result.boardWidth);
      setPieces(scatteredPieces);
      setStage(GameStage.Playing);
    } catch (err) {
      console.error(err);
      alert("Failed to cut the puzzle image. Please try a different artwork.");
      setStage(GameStage.Lobby);
    }
  };

  // Layout remaining pieces neatly inside the Jigsaw Tray Organizer
  const layoutPiecesInTray = (piecesList: typeof pieces, bWidth: number) => {
    const unsnapped = piecesList.filter(p => !p.isSnapped);
    if (unsnapped.length === 0) return piecesList;

    // Determine safe grid boundaries inside the tray
    // Vertical usable range: [610px, 810px] inside playstage top-left coordinates.
    // Horizontal bounds: [-330px, 330px] from playstage container center.
    let numRows = 1;
    if (unsnapped.length > 24) {
      numRows = 4;
    } else if (unsnapped.length > 12) {
      numRows = 3;
    } else if (unsnapped.length > 6) {
      numRows = 2;
    }

    const itemsPerRow = Math.ceil(unsnapped.length / numRows);
    
    const trayWidth = 660; // safe horizontal width inside the tray
    const colWidth = trayWidth / Math.max(1, itemsPerRow);
    
    const trayHeight = 170; // safe vertical height inside the tray
    const rowHeight = trayHeight / Math.max(1, numRows);

    return piecesList.map(p => {
      if (p.isSnapped) return p;

      const index = unsnapped.findIndex(u => u.id === p.id);
      if (index === -1) return p;

      const col = index % itemsPerRow;
      const row = Math.floor(index / itemsPerRow);

      // Center of the grid cell relative to container center
      const centerX = -330 + col * colWidth + colWidth / 2;
      // Center of the grid cell relative to container top (starts at 615px)
      const centerY = 615 + row * rowHeight + rowHeight / 2;

      // Perfectly center the piece mathematically inside that cell
      const rx = bWidth / 2 + centerX - p.width / 2;
      const ry = centerY - p.height / 2 - 24;

      return {
        ...p,
        currentX: rx,
        currentY: ry,
      };
    });
  };

  // Sort all remaining pieces neatly in the bottom tray
  const sortRemainingInTray = () => {
    playClickSound();
    setPieces(prev => layoutPiecesInTray(prev, boardWidth));
  };

  // Scatter remaining pieces randomly but strictly inside the tray bounds
  const scatterRemainingInTray = () => {
    playClickSound();
    setPieces(prev => {
      return prev.map(p => {
        if (p.isSnapped) return p;

        // Horizontally inside [-310px, 310px] from playstage center
        const centerX = -310 + Math.random() * 620;
        // Vertically inside [615px, 785px] absolute Y
        const centerY = 615 + Math.random() * 170;

        const rx = boardWidth / 2 + centerX - p.width / 2;
        const ry = centerY - p.height / 2 - 24;

        return {
          ...p,
          currentX: rx,
          currentY: ry,
        };
      });
    });
  };

  // Reshuffle un-snapped elements
  const reshuffleRemainingPieces = () => {
    scatterRemainingInTray();
  };

  // Quick Autosolve Cheat Helper - Solves one piece at a time
  const autosolveOnePiece = () => {
    const unsnapped = pieces.filter(p => !p.isSnapped);
    if (unsnapped.length === 0) return;

    // Pick a random unsnapped piece or the first one
    const target = unsnapped[Math.floor(Math.random() * unsnapped.length)];
    
    playSnapSound();
    setPieces(prev => {
      const updated = prev.map(p => {
        if (p.id === target.id) {
          return {
            ...p,
            currentX: p.correctX,
            currentY: p.correctY,
            isSnapped: true,
          };
        }
        return p;
      });

      // Recalculate snap counters
      const snapped = updated.filter(u => u.isSnapped).length;
      if (snapped === updated.length) {
        setStage(GameStage.Victory);
        playWinSound();
        setStats(s => ({ ...s, isTimerRunning: false, snappedCount: snapped }));
      } else {
        setStats(s => ({ ...s, snappedCount: snapped }));
      }

      return updated;
    });
  };

  // Instant solve-all cheat
  const autoSolveFullPuzzle = () => {
    playWinSound();
    setPieces(prev => {
      return prev.map(p => ({
        ...p,
        currentX: p.correctX,
        currentY: p.correctY,
        isSnapped: true,
      }));
    });
    setStats(prev => ({
      ...prev,
      snappedCount: prev.totalPieces,
      isTimerRunning: false,
    }));
    setStage(GameStage.Victory);
  };

  // DRAG & DROP POINTER HANDLERS
  const handlePiecePointerDown = (e: React.PointerEvent, pieceId: string) => {
    const piece = pieces.find(p => p.id === pieceId);
    if (!piece || piece.isSnapped) return;

    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    playPickupSound();
    setActivePieceId(pieceId);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    pieceStartPos.current = { x: piece.currentX, y: piece.currentY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activePieceId) return;

    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;

    const newX = pieceStartPos.current.x + dx;
    const newY = pieceStartPos.current.y + dy;

    setPieces(prev =>
      prev.map(p => (p.id === activePieceId ? { ...p, currentX: newX, currentY: newY } : p))
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!activePieceId) return;

    const piece = pieces.find(p => p.id === activePieceId);
    if (!piece) {
      setActivePieceId(null);
      return;
    }

    // Check if close to target solve coordinates
    const dist = Math.hypot(piece.currentX - piece.correctX, piece.currentY - piece.correctY);
    // Standard Snap distance threshold (28px for smooth comfort)
    const canSnapVal = dist < 28;

    setPieces(prev => {
      const updated = prev.map(p => {
        if (p.id === activePieceId) {
          if (canSnapVal) {
            return {
              ...p,
              currentX: p.correctX,
              currentY: p.correctY,
              isSnapped: true,
            };
          }
        }
        return p;
      });

      // Recalculate snap stats
      const totalSnapped = updated.filter(p => p.isSnapped).length;
      
      if (canSnapVal) {
        playSnapSound();
        if (totalSnapped === updated.length) {
          setStage(GameStage.Victory);
          playWinSound();
          setStats(s => ({
            ...s,
            moves: s.moves + 1,
            snappedCount: totalSnapped,
            isTimerRunning: false,
          }));
        } else {
          setStats(s => ({
            ...s,
            moves: s.moves + 1,
            snappedCount: totalSnapped,
          }));
        }
      } else {
        setStats(s => ({
          ...s,
          moves: s.moves + 1,
        }));
      }

      return updated;
    });

    setActivePieceId(null);
  };

  // Format Elapsed Digital clock
  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Live Score Calculator
  const calculateCurrentScore = () => {
    const totalP = stats.totalPieces || (rows * cols);
    const completed = stats.snappedCount;
    const elapsed = stats.elapsedSeconds;
    const moves = stats.moves;
    
    // Base completed points
    const baseScore = completed * 150;
    
    // Speed bonus: starts with a budget and decays with elapsed seconds
    const timeLimit = totalP * 25;
    const speedBonus = elapsed < timeLimit ? Math.round((timeLimit - elapsed) * 15) : 0;
    
    // Efficiency/Moves bonus based on moves multiplier
    const efficiencyBonus = Math.max(0, (totalP * 2.5 - moves) * 35);
    
    // We only reward speed & efficiency if they've placed pieces to prevent idle bonuses
    const total = baseScore + (completed > 0 ? (speedBonus + efficiencyBonus) : 0);
    return Math.round(total);
  };

  const getDifficultyLabel = (c: number, r: number) => {
    const total = c * r;
    if (total <= 12) {
      return {
        label: "Easy",
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-sm",
      };
    } else if (total <= 25) {
      return {
        label: "Medium",
        className: "bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-sm",
      };
    } else if (total <= 50) {
      return {
        label: "Hard",
        className: "bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20 shadow-sm",
      };
    } else {
      return {
        label: "Expert",
        className: "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-sm",
      };
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans relative overflow-hidden select-none">
      
      {/* Background Mesh Gradients */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[120px] opacity-40 pointer-events-none"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-fuchsia-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 pointer-events-none"></div>
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500 rounded-full mix-blend-screen filter blur-[120px] opacity-30 pointer-events-none"></div>

      {/* HEADER BAR */}
      <header className="h-16 border-b border-white/10 bg-white/5 backdrop-blur-xl flex items-center justify-between px-8 z-40 relative">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-fuchsia-500 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-550/20">
            <Puzzle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight uppercase">
              AURA<span className="text-fuchsia-400">JIGSAW</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">
              Premium AI Puzzle Lab
            </p>
          </div>
        </div>

        {stage === GameStage.Playing && (
          <div className="hidden md:flex items-center gap-8">
            <div className="text-center">
              <p className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest">Time</p>
              <p className="font-mono text-md text-slate-100 font-semibold">{formatTime(stats.elapsedSeconds)}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest">Moves</p>
              <p className="font-mono text-md text-slate-100 font-semibold">{stats.moves}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest">Solved</p>
              <p className="font-mono text-md text-slate-100 font-semibold">{stats.snappedCount}/{stats.totalPieces}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase text-slate-400 font-semibold tracking-widest">Score</p>
              <p className="font-mono text-md text-emerald-400 font-black tracking-wide">{calculateCurrentScore()} pts</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {stage === GameStage.Playing && (
            <button
              onClick={() => {
                setStage(GameStage.Lobby);
                setStats(s => ({ ...s, isTimerRunning: false }));
                playClickSound();
              }}
              className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full text-sm font-semibold shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
            >
              Exit Game
            </button>
          )}
          {stage === GameStage.Lobby && (
            <span className="hidden sm:inline bg-white/5 border border-white/10 text-slate-400 font-mono text-[10px] tracking-wider uppercase px-3 py-1 rounded-full">
              Lab Active
            </span>
          )}
        </div>
      </header>

      {/* LOBBY / SETUP VIEW */}
      {stage === GameStage.Lobby && (
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 z-20">
          
          {/* LEFT COLUMN: SOURCE SELECTION */}
          <section className="lg:col-span-8 space-y-6">
            
            {/* Curated Pre-loaded Galleries */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[24px] space-y-5 shadow-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-100 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5 text-indigo-400" /> Curated Masterpieces
                  </h2>
                  <p className="text-xs text-slate-400">Choose a gorgeous high-fidelity artwork from our preset collection</p>
                </div>
                {/* Category Tags */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => {
                        setActiveCategory(cat);
                        playClickSound();
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-medium border transition-all pointer-events-auto cursor-pointer ${
                        activeCategory === cat
                           ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                           : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-300"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of curates */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-h-[290px] overflow-y-auto pr-1">
                {filteredPresets.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedImageUrl(preset.url);
                      setSelectedPresetId(preset.id);
                      playClickSound();
                    }}
                    className={`relative aspect-video rounded-xl overflow-hidden border group transition-all duration-200 pointer-events-auto cursor-pointer ${
                      selectedPresetId === preset.id
                        ? "border-indigo-400 ring-2 ring-indigo-500/30 ring-offset-2 ring-offset-slate-950 scale-[1.02]"
                        : "border-white/10 hover:border-white/30 scale-100"
                    }`}
                  >
                    <img
                      src={preset.url}
                      alt={preset.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 to-transparent p-2">
                      <p className="text-[11px] font-medium text-slate-200 truncate">{preset.name}</p>
                      <p className="text-[9px] text-slate-400 truncate">by {preset.credit}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* AI Infinite Prompt Generator */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-[24px] p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-fuchsia-500/5 rounded-full blur-2xl pointer-events-none" />

              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold tracking-tight text-slate-100 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" /> AI Infinite Canvas
                  </h2>
                  <p className="text-xs text-slate-400">Type any prompt to generate a custom masterpiece using Gemini</p>
                </div>
                <span className="bg-indigo-500/10 text-indigo-400 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-indigo-550/20 uppercase tracking-widest">
                  Gemini API
                </span>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    placeholder="Enter absolute imagination: 'a brave astronaut tasting alien tea on Mars, retro cyberpunk style'..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-550 placeholder-slate-505 transition-all font-sans"
                  />
                  <button
                    onClick={generateAIImage}
                    disabled={isGenerating || !customPrompt.trim()}
                    className={`px-5 py-3 rounded-xl font-medium text-sm flex items-center gap-2 transition-all active:scale-95 cursor-pointer pointer-events-auto ${
                      isGenerating || !customPrompt.trim()
                        ? "bg-white/5 text-slate-500 border border-white/5 cursor-not-allowed"
                        : "bg-indigo-500 hover:bg-indigo-400 text-white font-semibold shadow-lg shadow-indigo-500/20"
                    }`}
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Synthesizing...
                      </>
                    ) : (
                      <>
                        <Sparkle className="w-4 h-4 fill-white" /> Generate
                      </>
                    )}
                  </button>
                </div>

                {genError && (
                  <p className="text-xs text-red-400 bg-red-500/10 border border-red-550/20 p-2.5 rounded-xl">
                    ⚠️ {genError}
                  </p>
                )}

                {/* Suggestions chip links */}
                <div className="space-y-1.5">
                  <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Example Inspirations:</p>
                  <div className="flex flex-wrap gap-2">
                    {samplePrompts.map((prompt, n) => (
                      <button
                        key={n}
                        onClick={() => {
                          setCustomPrompt(prompt);
                          playClickSound();
                        }}
                        className="text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 px-3 py-1.5 rounded-lg truncate max-w-xs transition-colors cursor-pointer"
                      >
                        "{prompt}"
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Local Device Slicing */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-[24px] flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xl transition-all duration-300 ${
                isDraggingOver 
                  ? "border-emerald-500/50 bg-emerald-500/10 scale-[1.01] shadow-[0_0_20px_rgba(16,185,129,0.15)]" 
                  : "hover:border-white/15 hover:bg-white/10"
              }`}
            >
              <div>
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <Upload className="w-4 h-4 text-emerald-400" /> Play Your Own Photos
                </h3>
                <p className="text-xs text-slate-400">Drag and drop your own photo here, or browse local files to design custom puzzles.</p>
              </div>
              <label className="bg-white/5 hover:bg-indigo-500 hover:text-white border border-white/10 text-slate-200 px-5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all active:scale-95 whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Select Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLocalImageUpload}
                  className="hidden"
                />
              </label>
            </div>

          </section>

          {/* RIGHT COLUMN: DIFFICULTY & MATCH GENERATION */}
          <section className="lg:col-span-4 space-y-6">
            
            {/* Live active Selected image preview */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-[24px] space-y-4 shadow-2xl">
              <h3 className="text-sm font-semibold tracking-wide text-slate-300 uppercase font-mono">Active Target Canvas</h3>
              <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-slate-950/40">
                <img
                  src={selectedImageUrl}
                  alt="Selected Masterpiece"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5 z-10">
                  <span className="bg-slate-950/80 backdrop-blur-md border border-white/5 px-2.5 py-1 rounded text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                    {selectedPresetId === "custom-upload" ? "Upload" : selectedPresetId === "ai-generated" ? "Generated" : "Curated Preset"}
                  </span>
                  <span className={`px-2.5 py-1 rounded text-[10px] font-bold font-mono uppercase tracking-widest border backdrop-blur-md transition-all duration-300 ${getDifficultyLabel(cols, rows).className}`}>
                    {getDifficultyLabel(cols, rows).label}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid layout selection panel */}
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[24px] space-y-6 shadow-2xl">
              <div>
                <h2 className="text-md font-semibold text-slate-100 flex items-center gap-2">
                  <Sliders className="w-5 h-5 text-indigo-400" /> Layout Grid Difficulty
                </h2>
                <p className="text-xs text-slate-400">Configure pieces columns and rows count</p>
              </div>

              {/* Slider scales */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Grid Width (Columns):</span>
                    <span className="text-indigo-400 font-bold">{cols} columns</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={cols}
                    onChange={(e) => {
                      setCols(parseInt(e.target.value));
                      playClickSound();
                    }}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-400">Grid Height (Rows):</span>
                    <span className="text-indigo-400 font-bold">{rows} rows</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    value={rows}
                    onChange={(e) => {
                      setRows(parseInt(e.target.value));
                      playClickSound();
                    }}
                    className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-mono">Total Pieces Count:</span>
                  <span className="text-md font-extrabold text-indigo-300 font-mono">
                    {rows * cols === 4 ? "4 (Warmup)" : `${rows * cols} pieces`}
                  </span>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Comfort Presets:</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => applyDifficultyPreset(3, 3)}
                    className="p-2 border border-white/10 hover:border-white/20 rounded-lg text-xs hover:bg-white/5 active:scale-95 transition-all text-slate-300 text-left font-sans cursor-pointer flex items-center justify-between"
                  >
                    <span>Cozy Afternoon</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-semibold">3x3</span>
                  </button>
                  <button
                    onClick={() => applyDifficultyPreset(4, 4)}
                    className="p-2 border border-white/10 hover:border-white/20 rounded-lg text-xs hover:bg-white/5 active:scale-95 transition-all text-slate-300 text-left font-sans cursor-pointer flex items-center justify-between"
                  >
                    <span>Standard Table</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-semibold">4x4</span>
                  </button>
                  <button
                    onClick={() => applyDifficultyPreset(6, 6)}
                    className="p-2 border border-white/10 hover:border-white/20 rounded-lg text-xs hover:bg-white/5 active:scale-95 transition-all text-slate-300 text-left font-sans cursor-pointer flex items-center justify-between"
                  >
                    <span>Expert Maker</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-semibold">6x6</span>
                  </button>
                  <button
                    onClick={() => applyDifficultyPreset(8, 8)}
                    className="p-2 border border-white/10 hover:border-white/20 rounded-lg text-xs hover:bg-white/5 active:scale-95 transition-all text-slate-300 text-left font-sans cursor-pointer flex items-center justify-between"
                  >
                    <span>Grand Legend</span>
                    <span className="text-[10px] text-indigo-400 font-mono font-semibold">8x8</span>
                  </button>
                </div>
              </div>

              {/* Start Trigger Button - Pill Shaped Shadow Glow */}
              <button
                onClick={startNewGameStage}
                className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full text-sm font-semibold shadow-lg shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer pointer-events-auto flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-white text-white" /> Start Lab Session
              </button>
            </div>

          </section>

        </main>
      )}

      {/* GENERATIVE TRANSITION LOADING PHASE */}
      {stage === GameStage.Generating && (
        <main className="flex-1 flex flex-col items-center justify-center py-20 px-6 z-20">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 max-w-md w-full p-8 rounded-[32px] space-y-6 text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-emerald-400 animate-pulse" />
            
            <div className="flex justify-center">
              <div className="relative p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/20">
                <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
                <Puzzle className="w-6 h-6 text-indigo-300 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 animate-bounce" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-slate-100">
                Reshaping Stardust
              </h3>
              <p className="text-xs text-slate-400">
                Synthesizing interlocking tabs and recesses. Please hold your tools steady...
              </p>
            </div>

            <div className="w-full bg-white/5 rounded-full h-1 border border-white/5">
              <div className="bg-gradient-to-r from-indigo-500 to-fuchsia-550 h-full rounded-full animate-pulse w-full duration-1000" />
            </div>
          </div>
        </main>
      )}

      {/* MAIN PLAYING BOARD ENGINE */}
      {stage === GameStage.Playing && (
        <main className="flex-1 flex flex-col xl:flex-row p-4 gap-6 relative z-10 max-w-7xl mx-auto w-full">
          
          {/* PLAYGROUND VIEWPORT: STAGES PIECES */}
          <section 
            ref={workspaceRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className="flex-1 min-h-[860px] h-[860px] bg-white/5 border border-white/10 rounded-[32px] p-6 relative overflow-hidden shadow-2xl backdrop-blur-md select-none"
            id="puzzle-playstage"
          >
            {/* Ambient subtle outline underlay */}
            <div className="absolute inset-0 bg-transparent pointer-events-none" />

            {/* Central Solving Board Container */}
            <div 
              style={{ 
                position: "absolute",
                left: `calc(50% - ${boardWidth / 2}px)`,
                top: "24px",
                width: boardWidth, 
                height: boardHeight,
                backgroundImage: "radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)",
                backgroundSize: "30px 30px"
              }}
              className="rounded-2xl border-4 border-white/10 bg-black/30 shadow-[inset_0_10px_35px_rgba(0,0,0,0.6)] transition-all flex items-center justify-center z-10 overflow-hidden"
              id="solving-grid-canvas"
            >
              {/* Optional Background Ghost Reference Image */}
              {showGhost && (
                <img
                  src={selectedImageUrl}
                  alt="Board Ghost Reference"
                  referrerPolicy="no-referrer"
                  className="absolute inset-x-0 inset-y-0 w-full h-full object-cover opacity-18 pointer-events-none select-none"
                />
              )}

              {/* Fine Grid Guides Layout overlay */}
              {showGrid && (
                <div className="absolute inset-0 grid pointer-events-none"
                  style={{
                    gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                    gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`
                  }}
                >
                  {Array.from({ length: rows * cols }).map((_, idx) => (
                    <div 
                      key={idx} 
                      className="border border-white/5 shadow-[inset_0_0_15px_rgba(0,0,0,0.1)]" 
                    />
                  ))}
                </div>
              )}

              {/* Informative Grid Status Helper if board is empty */}
              {stats.snappedCount === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center select-none pointer-events-none opacity-25">
                  <Grid className="w-10 h-10 text-slate-400 mb-2" />
                  <p className="text-xs font-mono text-slate-300 uppercase tracking-widest font-semibold">Solve Canvas Area</p>
                  <p className="text-[10px] text-slate-400">Drag scattered pieces from the Tray and snap them here!</p>
                </div>
              )}
            </div>

            {/* RENDER DYNAMIC SHAPED JIGSAW PIECES */}
            {pieces.map(piece => {
              // Calculate screen coordinates matched perfectly with the board coordinates starting at top: 24px
              const style: React.CSSProperties = {
                position: "absolute",
                left: `calc(50% - ${boardWidth / 2}px + ${piece.currentX - piece.padding}px)`,
                top: `calc(24px + ${piece.currentY - piece.padding}px)`,
                width: piece.width + piece.padding * 2,
                height: piece.height + piece.padding * 2,
                zIndex: piece.isSnapped ? 5 : activePieceId === piece.id ? 50 : 20,
                cursor: piece.isSnapped ? "default" : activePieceId === piece.id ? "grabbing" : "grab",
                transition: activePieceId === piece.id ? "none" : "transform 0.18s ease-out, top 0.15s ease-out, left 0.15s ease-out",
                touchAction: "none"
              };

              return (
                <div
                  key={piece.id}
                  style={style}
                  onPointerDown={(e) => handlePiecePointerDown(e, piece.id)}
                  className={`touch-none select-none inline-block ${
                    piece.isSnapped 
                      ? "opacity-100 pointer-events-none animate-snap-glow" 
                      : "active:scale-105 filter drop-shadow-[0_8px_16px_rgba(99,102,241,0.25)] hover:drop-shadow-[0_12px_24px_rgba(99,102,241,0.45)] hover:scale-[1.011]"
                  }`}
                >
                  <img
                    src={piece.canvasDataUrl}
                    alt={`Piece ${piece.row}-${piece.col}`}
                    draggable={false}
                    className="w-full h-full select-none"
                    referrerPolicy="no-referrer"
                  />
                </div>
              );
            })}
            
            {/* PHYSICAL CUSTOM JIGSAW PIECE TRAY CONTAINER */}
            <div className="absolute bottom-6 left-6 right-6 h-[270px] bg-slate-950/70 border border-white/10 rounded-3xl flex flex-col justify-between p-4 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md z-10 select-none">
              {/* Header bar controls */}
              <div className="flex items-center text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-400 px-1 border-b border-white/5 pb-1.5 gap-1.5">
                <Grid className="w-3.5 h-3.5" /> Jigsaw Tray Organizer
              </div>
              
              {/* Inner Empty Area */}
              <div className="flex-1 relative border border-dashed border-white/5 rounded-2xl bg-slate-950/20 mt-2 flex items-center justify-center pointer-events-none">
                {pieces.filter(p => !p.isSnapped).length === 0 ? (
                  <span className="text-[10px] text-emerald-400/60 font-mono tracking-widest uppercase font-bold animate-pulse">All Pieces Placed Perfectly! ✨</span>
                ) : (
                  <span className="text-[9px] text-slate-500 font-mono tracking-wide">Drag & drop pieces inside this spacious tray, or sort them to arrange</span>
                )}
              </div>
            </div>

          </section>

          {/* DOCK / SIDEBAR Dashboard control column */}
          <aside className="w-full xl:w-[280px] bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-[24px] space-y-5 shadow-2xl flex flex-col z-20">
            
            {/* Mini miniature reference image widget */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">Reference Canvas</h4>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold font-mono uppercase tracking-widest border transition-all ${getDifficultyLabel(cols, rows).className}`}>
                  {getDifficultyLabel(cols, rows).label}
                </span>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden border border-white/10 bg-slate-950/40 group">
                <img
                  src={selectedImageUrl}
                  alt="Reference Miniature"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                {/* Expand overlay */}
                <button
                  onClick={() => {
                    setShowPreviewModal(true);
                    playClickSound();
                  }}
                  className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer pointer-events-auto"
                >
                  <Maximize2 className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="h-[1px] bg-white/10 w-full" />

            {/* Assistance Toggles */}
            <div className="space-y-4">
              <h4 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">Solve Assistant</h4>
              
              <div className="space-y-2.5">
                <button
                  onClick={() => {
                    setShowGhost(!showGhost);
                    playClickSound();
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer pointer-events-auto ${
                    showGhost
                      ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                      : "bg-white/5 border-white/10 text-slate-300 hover:text-slate-200 hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {showGhost ? <Eye className="w-4 h-4 text-indigo-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />} Glow Reference
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-305 uppercase">
                    {showGhost ? "On" : "Off"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowGrid(!showGrid);
                    playClickSound();
                  }}
                  className={`w-full py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer pointer-events-auto ${
                    showGrid
                      ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                      : "bg-white/5 border-white/10 text-slate-300 hover:text-slate-200 hover:border-white/20"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Grid className="w-4 h-4 text-indigo-400" /> Slot Matrix Layout
                  </span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/10 text-slate-305 uppercase">
                    {showGrid ? "On" : "Off"}
                  </span>
                </button>

                <button
                  onClick={reshuffleRemainingPieces}
                  className="w-full py-2.5 px-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer pointer-events-auto"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-400" /> Scatter Unsolved Parts
                </button>
              </div>
            </div>

            <div className="h-[1px] bg-white/10 w-full" />

            {/* Smart assist / Cheats section */}
            <div className="space-y-3 mt-auto">
              <h4 className="text-xs font-mono font-semibold text-slate-400 uppercase tracking-widest">Automation Controls</h4>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={autosolveOnePiece}
                  className="p-2.5 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/20 rounded-xl text-[11px] text-slate-200 text-center font-semibold transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 pointer-events-auto"
                >
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  <span>Autosolve One</span>
                </button>
                <button
                  onClick={autoSolveFullPuzzle}
                  className="p-2.5 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/20 rounded-xl text-[11px] text-slate-200 text-center font-semibold transition-all cursor-pointer flex flex-col items-center justify-center gap-1.5 pointer-events-auto"
                >
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Cheat Board</span>
                </button>
              </div>
            </div>
          </aside>
        </main>
      )}

      {/* COMPLETED SUCCESS VICTORY BANNER STAGE */}
      {stage === GameStage.Victory && (
        <main className="flex-1 flex flex-col items-center justify-center p-6 z-20 relative">
          
          <VictoryConfetti active={stage === GameStage.Victory} />

          <div className="bg-white/5 backdrop-blur-md border border-white/10 max-w-lg w-full p-8 rounded-[32px] text-center space-y-6 shadow-2xl relative overflow-hidden animate-float">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-fuchsia-500/5 rounded-full blur-2xl pointer-events-none" />

            {/* Decorative trophy icon wrapper */}
            <div className="flex justify-center">
              <div className="p-5 bg-gradient-to-br from-indigo-500/20 to-transparent border border-indigo-500/30 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/5 animate-pulse">
                <Trophy className="w-12 h-12 text-indigo-400" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white bg-gradient-to-r from-indigo-200 via-slate-100 to-fuchsia-250 bg-clip-text text-transparent">
                Artwork Completed!
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                You have successfully aligned every single tab and recess slot in immaculate perfection.
              </p>
            </div>

            {/* Victory Statistics card */}
            <div className="grid grid-cols-3 gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl text-center shadow-inner">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Duration</span>
                <span className="text-sm font-bold text-indigo-300 font-mono">{formatTime(stats.elapsedSeconds)}</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Complexity</span>
                <span className="text-sm font-bold text-fuchsia-300 font-mono">{stats.totalPieces} Pieces</span>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-500 font-mono uppercase tracking-wider block">Moves</span>
                <span className="text-sm font-bold text-emerald-300 font-mono">{stats.moves} Turns</span>
              </div>
            </div>

            {/* Premium Scoring breakdown */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left space-y-3">
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Aura Laboratory Rating</span>
                <span className="text-sm font-black text-indigo-400 px-3 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20">
                  {(() => {
                    const totalPieces = stats.totalPieces || 16;
                    const elapsed = stats.elapsedSeconds;
                    const moves = stats.moves;
                    const baseScore = totalPieces * 150;
                    const timeLimit = totalPieces * 25;
                    const speedBonus = elapsed < timeLimit ? Math.round((timeLimit - elapsed) * 15) : 0;
                    const efficiencyBonus = Math.max(0, (totalPieces * 2.5 - moves) * 35);
                    const totalScore = baseScore + speedBonus + efficiencyBonus;
                    const scorePerPiece = totalScore / totalPieces;

                    if (scorePerPiece >= 400) return "S+ Rank (Flawless Master)";
                    if (scorePerPiece >= 300) return "S Rank (Elite Precision)";
                    if (scorePerPiece >= 220) return "A Rank (Skilled Artisan)";
                    if (scorePerPiece >= 150) return "B Rank (Capable Hands)";
                    return "C Rank (Casual Explorer)";
                  })()}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between items-center text-slate-300">
                  <span>Base Complexity Points ({stats.totalPieces} × 150)</span>
                  <span className="font-mono text-slate-100 font-bold">+{stats.totalPieces * 150}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Speed Bonus (Limit: {formatTime(stats.totalPieces * 25)})</span>
                  <span className="font-mono text-indigo-300 font-bold">
                    +{(() => {
                      const timeLimit = stats.totalPieces * 25;
                      return stats.elapsedSeconds < timeLimit ? Math.round((timeLimit - stats.elapsedSeconds) * 15) : 0;
                    })()}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Efficiency Bonus (Moves limit threshold: {Math.round(stats.totalPieces * 2.5)})</span>
                  <span className="font-mono text-fuchsia-300 font-semibold">
                    +{Math.max(0, Math.round((stats.totalPieces * 2.5 - stats.moves) * 35))}
                  </span>
                </div>
                <div className="h-[1px] bg-white/10 my-2" />
                <div className="flex justify-between items-center text-sm font-semibold text-slate-100 uppercase tracking-wider">
                  <span>Grand Total Score</span>
                  <span className="font-mono text-emerald-400 font-black text-base">
                    {(() => {
                      const totalPieces = stats.totalPieces || 16;
                      const elapsed = stats.elapsedSeconds;
                      const moves = stats.moves;
                      const baseScore = totalPieces * 150;
                      const timeLimit = totalPieces * 25;
                      const speedBonus = elapsed < timeLimit ? Math.round((timeLimit - elapsed) * 15) : 0;
                      const efficiencyBonus = Math.max(0, (totalPieces * 2.5 - moves) * 35);
                      return Math.round(baseScore + speedBonus + efficiencyBonus);
                    })()} pts
                  </span>
                </div>
              </div>
            </div>

            {/* Actions button */}
            <div className="flex flex-col sm:flex-row gap-3 pointer-events-auto">
              <button
                onClick={startNewGameStage}
                className="flex-1 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full font-semibold text-xs shadow-lg shadow-indigo-550/20 transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Practice Again
              </button>
              <button
                onClick={() => {
                  setStage(GameStage.Lobby);
                  playClickSound();
                }}
                className="flex-1 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 rounded-full font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Curated Galleries
              </button>
            </div>
          </div>
        </main>
      )}

      {/* FULL PREVIEW MODAL REFERENCE */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-6 z-50 pointer-events-auto shadow-2xl">
          <div className="relative max-w-3xl w-full bg-slate-950/40 border border-white/10 p-5 rounded-3xl overflow-hidden shadow-2xl flex flex-col gap-3 animate-float">
            <button
              onClick={() => {
                setShowPreviewModal(false);
                playClickSound();
              }}
              className="absolute top-4 right-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer pointer-events-auto font-medium"
            >
              ✕
            </button>
            <div className="flex-1 rounded-xl overflow-hidden bg-black/40 border border-white/10 aspect-video">
              <img
                src={selectedImageUrl}
                alt="Full Guide Preview"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="px-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono font-semibold text-slate-400 uppercase">Target Blueprint</p>
                <p className="text-[10px] text-slate-500">Close this modal, match scattered borders, and enjoy solving!</p>
              </div>
              <button
                onClick={() => {
                  setShowPreviewModal(false);
                  playClickSound();
                }}
                className="px-5 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full text-xs font-semibold cursor-pointer shadow-lg shadow-indigo-500/10"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Bar */}
      <footer className="h-10 bg-black/40 backdrop-blur-xl px-8 flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] relative z-10 w-full border-t border-white/5">
        <div className="flex gap-6">
          <span>FPS: 60.0</span>
          <span>Latency: 12ms</span>
        </div>
        <div className="hidden md:block">© 2026 Puzzler Entertainment Group • Build 4.2.0-Alpha</div>
        <div className="flex gap-6">
          <span className="text-emerald-400">Cloud Saved</span>
          <span className="text-indigo-400 cursor-pointer">Multiplayer: Off</span>
        </div>
      </footer>

    </div>
  );
}
