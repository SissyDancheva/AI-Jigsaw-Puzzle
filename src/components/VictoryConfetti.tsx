import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  speedY: number;
  speedX: number;
  rotation: number;
  rotationSpeed: number;
  shape: "circle" | "square" | "triangle";
}

export default function VictoryConfetti({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (canvasRef.current) {
        width = canvasRef.current.width = window.innerWidth;
        height = canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener("resize", handleResize);

    const colors = [
      "#FF3B30", // Red
      "#FF9500", // Orange
      "#FFCC00", // Yellow
      "#4CD964", // Green
      "#5AC8FA", // Sky Blue
      "#007AFF", // Blue
      "#5856D6", // Indigo
      "#FF2D55", // Neon Magenta
      "#A259FF", // Violet
    ];

    const particles: Particle[] = Array.from({ length: 140 }, () => {
      const size = Math.random() * 8 + 5;
      const shapes: Array<"circle" | "square" | "triangle"> = ["circle", "square", "triangle"];
      return {
        x: Math.random() * width,
        y: Math.random() * height - height, // Start off-screen vertically
        size,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedY: Math.random() * 3 + 2,
        speedX: Math.random() * 2 - 1,
        rotation: Math.random() * 360,
        rotationSpeed: Math.random() * 4 - 2,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
      };
    });

    const updateAndDraw = () => {
      ctx.clearRect(0, 0, width, height);

      particles.forEach((p) => {
        p.y += p.speedY;
        p.x += p.speedX + Math.sin(p.y * 0.02) * 0.5; // subtle sway
        p.rotation += p.rotationSpeed;

        // Wrap around margins
        if (p.y > height) {
          p.y = -20;
          p.x = Math.random() * width;
          p.speedY = Math.random() * 3 + 2;
        }
        if (p.x > width) p.x = 0;
        if (p.x < 0) p.x = width;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;

        ctx.beginPath();
        if (p.shape === "circle") {
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
        } else if (p.shape === "triangle") {
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
        } else {
          // Square/Rectangle
          ctx.rect(-p.size / 2, -p.size / 2, p.size, p.size);
        }
        ctx.fill();
        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(updateAndDraw);
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-50"
      id="victory-confetti"
    />
  );
}
