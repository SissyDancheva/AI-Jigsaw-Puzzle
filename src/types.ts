export interface PresetImage {
  id: string;
  name: string;
  category: string;
  url: string;
  description: string;
  credit: string;
}

export interface EdgeSides {
  top: number;    // -1: indent, 0: flat boundary, 1: tab/ear
  right: number;
  bottom: number;
  left: number;
}

export interface Piece {
  id: string; // e.g. "piece-row-col"
  row: number;
  col: number;
  correctX: number; // correct relative position X on board
  correctY: number; // correct relative position Y on board
  currentX: number; // current absolute position X inside workarea
  currentY: number; // current absolute position Y inside workarea
  width: number;
  height: number;
  padding: number;
  edges: EdgeSides;
  isSnapped: boolean;
  canvasDataUrl: string; // cropped, shaped piece visual
}

export interface GameStats {
  moves: number;
  startTime: number | null;
  elapsedSeconds: number;
  isTimerRunning: boolean;
  totalPieces: number;
  snappedCount: number;
}

export enum GameStage {
  Lobby = "LOBBY",
  Generating = "GENERATING",
  Playing = "PLAYING",
  Victory = "VICTORY",
}
