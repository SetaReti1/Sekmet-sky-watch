import React, { useState, useEffect, useRef } from '@fuser/vendor/react';

// ==========================================
// BOOT SEQUENCE (PROXIMITY ALERT LOADER)
// ==========================================
export function BootSequence({ onComplete }: {onComplete: () => void;}) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);

  // Keep the latest onComplete in a ref so the timing effect below never
  // restarts just because the parent re-renders with a fresh inline callback
  // (the parent re-renders every animation frame while the mission clock runs).
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const start = Date.now();
    const duration = 2000;
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, elapsed / duration * 100);
      setProgress(pct);
      if (pct < 100) {
        raf = requestAnimationFrame(tick);
      } else {
        setExiting(true);
        setTimeout(() => onCompleteRef.current(), 210);
      }
    };
    const enterRaf = requestAnimationFrame(() => setEntered(true));
    raf = requestAnimationFrame(tick);
    const blink = setInterval(() => setBlinkOn((v) => !v), 420);
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(enterRaf);
      clearInterval(blink);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const threatLevel = Math.min(5, Math.floor(progress / 20) + 1);

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${
      exiting ? 'opacity-0 scale-[1.04] backdrop-blur-0' : 'opacity-100 scale-100'}`
      }>
      
      {/* translucent scrim so background panels stay visible through the alert screen */}
      <div className="absolute inset-0 bg-space-black/60 backdrop-blur-[2px]" />

      {/* scanline texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.1]"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, rgba(239,68,68,0.6) 0px, transparent 1px, transparent 3px)'
        }} />
      
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_transparent_20%,_rgba(0,0,0,0.65)_100%)]" />

      {/* pulsing red vignette to sell the alarm */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          boxShadow: 'inset 0 0 160px rgba(239,68,68,0.35)',
          opacity: blinkOn ? 0.9 : 0.35
        }} />

      <div
        className={`relative z-10 flex flex-col items-center gap-5 w-full max-w-[440px] px-6 font-mono select-none transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        entered && !exiting ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`
        }>

        {/* WARNING alert bar */}
        <div className="w-full flex items-center gap-2 border-2 border-red-500 bg-red-950/40 px-3 py-1.5 rounded-sm"
        style={{
          boxShadow: blinkOn ? '0 0 18px rgba(239,68,68,0.6), inset 0 0 12px rgba(239,68,68,0.25)' : '0 0 6px rgba(239,68,68,0.25)'
        }}>
          <span
            className="text-red-500 font-bold text-sm leading-none"
            style={{ opacity: blinkOn ? 1 : 0.3 }}>
            ▲
          </span>
          <span data-fuser-slot-id="boot-label" className="text-[11px] tracking-[0.35em] text-red-400 font-bold uppercase">
            WARNING — PROXIMITY ALERT
          </span>
        </div>

        {/* Threat level meter, alarm-console style */}
        <div className="w-full flex items-center justify-between gap-3 text-[9px] tracking-widest text-space-muted">
          <span data-fuser-slot-id="boot-threat-title">RISK LEVEL</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((lvl) =>
            <span
              key={lvl}
              className="w-3 h-3 border border-red-500/60"
              style={{
                background: lvl <= threatLevel ? '#ef4444' : 'transparent',
                boxShadow: lvl <= threatLevel ? '0 0 6px rgba(239,68,68,0.8)' : 'none'
              }} />
            )}
          </div>
          <span data-fuser-slot-id="boot-threat-label" className="text-red-400 font-bold">
            {threatLevel <= 2 ? 'MONITORING' : threatLevel <= 4 ? 'ELEVATED' : 'SEVERE'}
          </span>
        </div>

        {/* Title, alert-styled — condensed uppercase, matching the reference sci-fi HUD */}
        <div className="w-full flex items-center gap-4 py-2 border-y border-red-500/30">
          {/* Earth-Moon orbital glyph, purely decorative — reinforces the near-Earth theme */}
          <div className="relative shrink-0 w-16 h-16" aria-hidden="true">
            <style>{`@keyframes boot-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            <svg viewBox="0 0 64 64" className="w-full h-full overflow-visible">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="1 3" opacity="0.4" />
              <circle
                cx="32" cy="32" r="9"
                fill="rgba(16,243,165,0.12)"
                stroke="#10f3a5"
                strokeWidth="1.4"
                style={{ filter: 'drop-shadow(0 0 4px rgba(16,243,165,0.8))' }} />
              <path d="M24 27 Q32 24 40 29" stroke="#10f3a5" strokeWidth="0.6" fill="none" opacity="0.6" />
              <path d="M23 36 Q32 40 41 34" stroke="#10f3a5" strokeWidth="0.6" fill="none" opacity="0.6" />
              <g style={{ transformOrigin: '32px 32px', animation: 'boot-orbit 1.5s linear infinite' }}>
                <circle cx="32" cy="6" r="2.6" fill="#facc15" style={{ filter: 'drop-shadow(0 0 3px rgba(250,204,21,0.9))' }} />
              </g>
            </svg>
          </div>
          <div className="flex-1 text-left">
            <div data-fuser-slot-id="boot-eyebrow" className="text-[9px] tracking-[0.4em] text-space-muted mb-1">TACTICAL ORBITAL COMMAND</div>
            <h1 data-fuser-slot-id="section-title-7bca5c5e"
            className="font-display uppercase text-glow-green leading-[0.82] tracking-tight"
            style={{
              fontSize: 'clamp(26px, 6vw, 42px)',
              transform: 'scaleX(0.82)',
              transformOrigin: 'left center',
              textShadow: '0 0 10px rgba(16,243,165,0.7), 0 0 26px rgba(16,243,165,0.35)'
            }}>
              NEAR EARTH<br />OBJECT<br />ENCOUNTERS
            </h1>
          </div>
        </div>

        {/* progress bar — fully fictional, self-contained animation from 0 to 100, no external service */}
        <div className="w-full flex flex-col gap-1.5">
          <div className="flex justify-between text-[9px] text-space-muted tracking-wider">
            <span data-fuser-slot-id="boot-status">INITIALIZING TRACKING DISPLAY</span>
            <span className="text-red-400 font-bold tabular-nums">{Math.floor(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-space-black/60 border border-red-500/40 rounded-sm overflow-hidden">
            <div
              className="h-full rounded-sm transition-[width] duration-100 ease-linear"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, #7f1d1d, #ef4444)',
                boxShadow: '0 0 10px rgba(239,68,68,0.8)'
              }} />
          </div>
        </div>
      </div>
    </div>);

}
