import { Piece, EdgeSides } from "../types";

// Generates the Bezier curve edge path
function drawEdge(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  earType: number,
  size: number
) {
  // earType: 0 = FLAT, 1 = OUTSIDE, -1 = INSIDE
  if (earType === 0) {
    ctx.lineTo(x2, y2);
    return;
  }

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);

  // Clockwise normal and tangent calculation
  const tx = dx / dist;
  const ty = dy / dist;
  const nx = ty;
  const ny = -tx;

  // Set the tab proportions based on piece size
  const tabHeight = size * 0.18 * earType;
  const tabWidth = size * 0.18;

  // Center of control boundary
  const cx = x1 + dx * 0.5;
  const cy = y1 + dy * 0.5;

  // Curve points: Divide the line into segments
  const p1x = x1 + dx * 0.35;
  const p1y = y1 + dy * 0.35;

  const p2x = x1 + dx * 0.65;
  const p2y = y1 + dy * 0.65;

  // Neck bases and dome controls
  const neck1x = p1x + nx * tabHeight * 0.1;
  const neck1y = p1y + ny * tabHeight * 0.1;

  const head1x = cx - tx * tabWidth + nx * tabHeight * 0.9;
  const head1y = cy - ty * tabWidth + ny * tabHeight * 0.9;

  const headTop1x = cx - tx * tabWidth * 0.65 + nx * tabHeight * 1.3;
  const headTop1y = cy - ty * tabWidth * 0.65 + ny * tabHeight * 1.3;

  const headTop2x = cx + tx * tabWidth * 0.65 + nx * tabHeight * 1.3;
  const headTop2y = cy + ty * tabWidth * 0.65 + ny * tabHeight * 1.3;

  const head2x = cx + tx * tabWidth + nx * tabHeight * 0.9;
  const head2y = cy + ty * tabWidth + ny * tabHeight * 0.9;

  const neck2x = p2x + nx * tabHeight * 0.1;
  const neck2y = p2y + ny * tabHeight * 0.1;

  // Render the interlocking jigsaw connector path
  ctx.lineTo(p1x, p1y);
  ctx.bezierCurveTo(neck1x, neck1y, head1x - tx * tabWidth * 0.4, head1y - ty * tabWidth * 0.4, head1x, head1y);
  ctx.bezierCurveTo(headTop1x, headTop1y, headTop2x, headTop2y, head2x, head2y);
  ctx.bezierCurveTo(head2x + tx * tabWidth * 0.4, head2y + ty * tabWidth * 0.4, neck2x, neck2y, p2x, p2y);
  ctx.lineTo(x2, y2);
}

// Generate edge descriptors matching outer boundaries and connecting inner seams
export function generatePuzzleEdges(rows: number, cols: number): EdgeSides[][] {
  const edges: EdgeSides[][] = [];

  for (let r = 0; r < rows; r++) {
    edges[r] = [];
    for (let c = 0; c < cols; c++) {
      edges[r][c] = { top: 0, right: 0, bottom: 0, left: 0 };
    }
  }

  // Iterate and stitch matching edges
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      // Top edge
      if (r === 0) {
        edges[r][c].top = 0;
      } else {
        // Must match opposite of the piece above's bottom edge
        edges[r][c].top = -edges[r - 1][c].bottom;
      }

      // Left edge
      if (c === 0) {
        edges[r][c].left = 0;
      } else {
        // Must match opposite of the left piece's right edge
        edges[r][c].left = -edges[r][c - 1].right;
      }

      // Right edge
      if (c === cols - 1) {
        edges[r][c].right = 0;
      } else {
        // Randomly point out (1) or in (-1)
        edges[r][c].right = Math.random() < 0.5 ? 1 : -1;
      }

      // Bottom edge
      if (r === rows - 1) {
        edges[r][c].bottom = 0;
      } else {
        // Randomly point out (1) or in (-1)
        edges[r][c].bottom = Math.random() < 0.5 ? 1 : -1;
      }
    }
  }

  return edges;
}

interface SlicedPuzzleResult {
  pieces: Piece[];
  boardWidth: number;
  boardHeight: number;
}

// Load and slice an image into standard pieces
export function slicePuzzleImage(
  imageSrc: string,
  rows: number,
  cols: number,
  maxBoardWidth: number = 720,
  maxBoardHeight: number = 520
): Promise<SlicedPuzzleResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = () => {
      // 1. Calculate ideal board dimensions preserving the image's layout aspect ratio
      const imgRatio = img.width / img.height;
      let boardWidth = maxBoardWidth;
      let boardHeight = maxBoardWidth / imgRatio;

      if (boardHeight > maxBoardHeight) {
        boardHeight = maxBoardHeight;
        boardWidth = maxBoardHeight * imgRatio;
      }

      // Bound to clean integers
      boardWidth = Math.round(boardWidth);
      boardHeight = Math.round(boardHeight);

      const cellWidth = boardWidth / cols;
      const cellHeight = boardHeight / rows;

      // Produce 2D edges configuration
      const edgesMatrix = generatePuzzleEdges(rows, cols);
      const pieces: Piece[] = [];

      // Create an off-screen canvas to resize the image to exactly boardWidth x boardHeight
      const resizedCanvas = document.createElement("canvas");
      resizedCanvas.width = boardWidth;
      resizedCanvas.height = boardHeight;
      const resizedCtx = resizedCanvas.getContext("2d");
      if (!resizedCtx) {
        reject(new Error("Failed to initialize resizing 2D canvas"));
        return;
      }
      resizedCtx.drawImage(img, 0, 0, boardWidth, boardHeight);

      // 2. Loop through and carve individual piece canvases
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const edges = edgesMatrix[r][c];
          
          // Piece dimensions
          const pw = cellWidth;
          const ph = cellHeight;
          const size = Math.min(pw, ph);
          
          // Padding to ensure tabs are not clipped
          const padding = Math.max(pw, ph) * 0.35;

          const pieceCanvas = document.createElement("canvas");
          pieceCanvas.width = pw + padding * 2;
          pieceCanvas.height = ph + padding * 2;
          
          const ctx = pieceCanvas.getContext("2d");
          if (!ctx) continue;

          // Local corners offset by padding to draw securely
          const x0 = padding;
          const y0 = padding;
          const x1 = padding + pw;
          const y1 = padding;
          const x2 = padding + pw;
          const y2 = padding + ph;
          const x3 = padding;
          const y3 = padding + ph;

          // Start drawing the clipped path
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          drawEdge(ctx, x0, y0, x1, y1, edges.top, size);
          drawEdge(ctx, x1, y1, x2, y2, edges.right, size);
          drawEdge(ctx, x2, y2, x3, y3, edges.bottom, size);
          drawEdge(ctx, x3, y3, x0, y0, edges.left, size);
          ctx.closePath();

          // Stroke and Clip shadows first if we want outline borders, or just clip directly
          ctx.save();
          ctx.clip();

          // Draw corresponding cropped section of resized original image
          // Slices are shifted by padding on the original coords as well
          const sx = c * pw - padding;
          const sy = r * ph - padding;
          const sw = pw + padding * 2;
          const sh = ph + padding * 2;

          ctx.drawImage(resizedCanvas, sx, sy, sw, sh, 0, 0, sw, sh);
          ctx.restore();

          // Draw an elegant, ultra-subtle borders outline for easier placement
          ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
          ctx.lineWidth = 0.8;
          ctx.stroke();

          // Export as PNG Data URL
          const canvasDataUrl = pieceCanvas.toDataURL("image/png");

          // Target grid position coordinates relative to solved board
          const correctX = c * pw;
          const correctY = r * ph;

          pieces.push({
            id: `piece-${r}-${c}`,
            row: r,
            col: c,
            correctX,
            correctY,
            currentX: 0, // initially zero, randomized in the app level workspace
            currentY: 0,
            width: pw,
            height: ph,
            padding,
            edges,
            isSnapped: false,
            canvasDataUrl,
          });
        }
      }

      resolve({
        pieces,
        boardWidth,
        boardHeight,
      });
    };

    img.onerror = (err) => {
      reject(new Error("Unable to load the puzzle image. Please try a different category or upload a direct path."));
    };
  });
}
