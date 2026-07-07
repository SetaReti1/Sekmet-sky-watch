import React, { useEffect, useRef } from '@fuser/vendor/react';

// ==========================================
// THREAT WAVEFORM — small "psychographic display"-style oscilloscope chart.
// Plots simulated ground overpressure falloff vs. range, scaled to the
// current impact result. Calm/low-energy impacts produce a gentle decaying
// curve; severe events tip into a dense chaotic scribble band (matching the
// "APPROACHING LIMITS / DANGER" waveform break from the Evangelion-style
// psychographic display reference) before decaying to noise floor.
// ==========================================

interface Props {
  severity: number; // 0..1
  labelLeft: string;
  labelRight: string;
}

export function ThreatWaveform({ severity, labelLeft, labelRight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const severityRef = useRef(severity);
  severityRef.current = severity;

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, rect.width * dpr);
      canvas.height = Math.max(2, rect.height * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const sev = severityRef.current;
      t += 0.045;
      ctx.clearRect(0, 0, w, h);

      // vertical grid ticks — green, like the psychographic reference
      ctx.strokeStyle = 'rgba(16,243,165,0.14)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const x = (i / 8) * w;
        ctx.beginPath();ctx.moveTo(x, 0);ctx.lineTo(x, h);ctx.stroke();
      }
      const midY = h * 0.55;
      ctx.strokeStyle = 'rgba(250,204,21,0.2)';
      ctx.beginPath();ctx.moveTo(0, midY);ctx.lineTo(w, midY);ctx.stroke();

      // waveform: rises, breaks into chaotic scribble proportional to severity, decays
      ctx.beginPath();
      ctx.strokeStyle = sev > 0.65 ? '#ef4444' : sev > 0.35 ? '#facc15' : '#10f3a5';
      ctx.lineWidth = Math.max(1, w / 500);
      ctx.shadowColor = ctx.strokeStyle as string;
      ctx.shadowBlur = 6;
      const n = 140;
      for (let i = 0; i <= n; i++) {
        const px = (i / n) * w;
        const phase = i / n;
        const rise = Math.min(1, phase / 0.35);
        const chaos = Math.max(0, 1 - Math.abs(phase - 0.5) / 0.22) * sev;
        const decay = phase > 0.6 ? Math.exp(-(phase - 0.6) * 4) : 1;
        const noise = Math.sin(phase * 60 + t * 3) * chaos * 0.9 + Math.sin(phase * 130 - t * 5) * chaos * 0.5;
        const base = Math.sin(phase * 10 + t) * 0.08 * rise;
        const amp = (rise * decay * 0.32 + noise * 0.42 + base) * h * 0.42;
        const py = midY - amp;
        if (i === 0) ctx.moveTo(px, py);else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <div ref={containerRef} className="relative w-full h-16 rounded border border-space-orange/15 bg-black/40 overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
      <div className="flex justify-between text-[7px] text-space-muted/70 tracking-wider font-bold">
        <span>{labelLeft}</span>
        <span>{labelRight}</span>
      </div>
    </div>);

}
