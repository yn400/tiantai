import { useRef, useState, useCallback, useEffect } from "react";
import { Trash2 } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

export default function DoodlePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [vanishing, setVanishing] = useState(false);
  const pointsRef = useRef<Point[][]>([]);
  const currentStrokeRef = useRef<Point[]>([]);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = "rgba(240,185,107,0.6)";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctxRef.current = ctx;
    }
  }, []);

  useEffect(() => {
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  const redraw = useCallback(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

    ctx.strokeStyle = "rgba(240,185,107,0.6)";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of pointsRef.current) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
      ctx.stroke();
    }

    if (currentStrokeRef.current.length > 0) {
      const s = currentStrokeRef.current;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (let i = 1; i < s.length; i++) {
        ctx.lineTo(s[i].x, s[i].y);
      }
      ctx.stroke();
    }
  }, []);

  const getPos = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>): Point => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      const pt = getPos(e);
      currentStrokeRef.current = [pt];
      setIsDrawing(true);
      setHasDrawing(true);
    },
    [getPos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const pt = getPos(e);
      currentStrokeRef.current.push(pt);
      redraw();
    },
    [isDrawing, getPos, redraw],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.releasePointerCapture(e.pointerId);
      if (currentStrokeRef.current.length > 0) {
        pointsRef.current.push([...currentStrokeRef.current]);
        currentStrokeRef.current = [];
      }
      setIsDrawing(false);
      redraw();
    },
    [redraw],
  );

  const clear = useCallback(() => {
    if (!hasDrawing) return;
    setVanishing(true);
    // Particle vanish effect
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;

    // Create particles from the canvas
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.clearRect(0, 0, w, h);

    const particles: { x: number; y: number; dx: number; dy: number; life: number }[] = [];
    const dpr = window.devicePixelRatio || 1;

    for (let py = 0; py < h; py += 4) {
      for (let px = 0; px < w; px += 4) {
        const idx = (py * dpr * canvas.width + px * dpr) * 4;
        if (imageData.data[idx + 3] > 10) {
          particles.push({
            x: px,
            y: py,
            dx: (Math.random() - 0.5) * 3,
            dy: -Math.random() * 3 - 1,
            life: 1,
          });
        }
      }
    }

    const animateParticles = () => {
      ctx.clearRect(0, 0, w, h);
      let alive = false;
      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy;
        p.life -= 0.02;
        if (p.life > 0) {
          alive = true;
          ctx.fillStyle = `rgba(240,185,107,${p.life * 0.6})`;
          ctx.fillRect(p.x, p.y, 2, 2);
        }
      }
      if (alive) {
        requestAnimationFrame(animateParticles);
      } else {
        setVanishing(false);
        setHasDrawing(false);
        pointsRef.current = [];
        currentStrokeRef.current = [];
      }
    };
    animateParticles();
  }, [hasDrawing]);

  return (
    <div className="flex flex-col h-full page-enter">
      {/* Header */}
      <div className="pt-[52px] px-[18px] shrink-0 flex justify-between items-center">
        <div>
          <h1 className="font-xiaowei text-[25px] text-warm-50">天台画板</h1>
          <p className="text-[11px] text-warm-300 mt-1 tracking-[.08em]">涂鸦会随风飘散</p>
        </div>
        {hasDrawing && !vanishing && (
          <button
            onClick={clear}
            className="text-warm-400 hover:text-warm-300 transition-colors p-1"
            aria-label="清除画布"
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 mx-[18px] my-3 rounded-2xl overflow-hidden border border-white/10 bg-white/[.02] relative">
        <canvas
          ref={canvasRef}
          className="w-full h-full touch-none cursor-crosshair"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ opacity: vanishing ? 0 : 1, transition: "opacity 0.3s" }}
          aria-label="涂鸦画布，手指画完后点击清除按钮看画飘散"
        />
        {!hasDrawing && !vanishing && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-sm text-warm-400">在这里随意画点什么……</p>
          </div>
        )}
      </div>
    </div>
  );
}
