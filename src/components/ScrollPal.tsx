"use client";

import { useEffect, useRef, useState } from "react";

// Desktop-only scroll guide: the clip pal flows continuously through the page
// as you scroll — his position is interpolated between section stops, so he
// glides across the screen in sync with the scrollbar instead of teleporting.
// He taps his leg while moving, blinks, and comments on the nearest section.
// (Placeholder lines — the user will replace them.)
const STOPS = [
  { id: "hero", side: "left" as const, line: "hey — i'm the paperclip. i hold this whole thing together." },
  { id: "features", side: "right" as const, line: "no ads, no tracking, no catch. all of it, yours." },
  { id: "why", side: "left" as const, line: "remember when software was on your side? same." },
  { id: "opensource", side: "right" as const, line: "every line is public. read it, fork it, trust it." },
  { id: "contact", side: "left" as const, line: "that's the tour. built with a paperclip and stubbornness." },
];

const PAL_W = 64;
const PAL_H = 102;
const EDGE = 48; // keep him (and his bubble) comfortably on screen

function PalFace({ walking }: { walking: boolean }) {
  return (
    <svg
      width={PAL_W}
      height={PAL_H}
      viewBox="0 0 50 80"
      fill="none"
      aria-hidden
      className={walking ? "pal-walk" : undefined}
    >
      <g stroke="#D9A441" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 62 L15 14 C15 7 19 3 25 3 C31 3 35 7 35 14 L35 50 C35 55 32 58 28 58 C24 58 21 55 21 50 L21 20" />
        <path d="M15 63 C15 71 20 75 27 75 C35 75 41 71 41 62 L41 54" />
      </g>
      <circle className="pal-eye" cx="22" cy="12" r="2.4" fill="#F2EDE0" />
      <circle className="pal-eye" cx="30" cy="12" r="2.4" fill="#F2EDE0" />
    </svg>
  );
}

export default function ScrollPal() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(STOPS[0].line);
  const [facing, setFacing] = useState<1 | -1>(1);
  const [walking, setWalking] = useState(false);
  const [onLeftHalf, setOnLeftHalf] = useState(true);

  const curX = useRef(EDGE);
  const targetX = useRef(EDGE);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const leftX = () => EDGE;
    const rightX = () => window.innerWidth - PAL_W - EDGE;

    // Where should he be for the current scroll position? Interpolate between
    // the two stops whose section centers straddle the viewport center.
    const computeTarget = () => {
      const vc = window.innerHeight / 2;
      const pts: { center: number; x: number; line: string }[] = [];
      for (const s of STOPS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        pts.push({
          center: r.top + r.height / 2,
          x: s.side === "left" ? leftX() : rightX(),
          line: s.line,
        });
      }
      if (pts.length === 0) return;

      let x = pts[pts.length - 1].x;
      let nearLine = pts[pts.length - 1].line;
      // the footer can never reach the viewport center, so treat "scrolled
      // to the bottom" as arriving at the last stop
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) {
        // keep x/nearLine at the last stop
      } else if (vc <= pts[0].center) {
        x = pts[0].x;
        nearLine = pts[0].line;
      } else {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          if (vc >= a.center && vc <= b.center) {
            const t = (vc - a.center) / Math.max(b.center - a.center, 1);
            x = a.x + (b.x - a.x) * t;
            nearLine = t < 0.5 ? a.line : b.line;
            break;
          }
        }
      }
      targetX.current = x;
      setLine(nearLine);
    };

    let raf = 0;
    let wasWalking = false;
    let lastFacing: 1 | -1 = 1;
    let wasLeftHalf = true;

    const loop = () => {
      const dx = targetX.current - curX.current;
      // gentle ease with a speed cap so crossing the screen reads as a
      // stroll, never a teleport
      let step = dx * 0.06;
      const MAX = 5;
      if (step > MAX) step = MAX;
      if (step < -MAX) step = -MAX;

      const moving = Math.abs(dx) > 0.5;
      if (moving) {
        curX.current += step;
        const f: 1 | -1 = dx > 0 ? 1 : -1;
        if (f !== lastFacing) {
          lastFacing = f;
          setFacing(f);
        }
      }
      const isWalking = Math.abs(step) > 0.4;
      if (isWalking !== wasWalking) {
        wasWalking = isWalking;
        setWalking(isWalking);
      }
      const leftHalf = curX.current + PAL_W / 2 < window.innerWidth / 2;
      if (leftHalf !== wasLeftHalf) {
        wasLeftHalf = leftHalf;
        setOnLeftHalf(leftHalf);
      }
      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate(${curX.current}px, -50%)`;
      }
      raf = requestAnimationFrame(loop);
    };

    computeTarget();
    curX.current = targetX.current;
    raf = requestAnimationFrame(loop);
    window.addEventListener("scroll", computeTarget, { passive: true });
    window.addEventListener("resize", computeTarget);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", computeTarget);
      window.removeEventListener("resize", computeTarget);
    };
  }, []);

  // bubble always points toward the middle of the screen, so it can never
  // hang off the edge
  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed left-0 top-1/2 z-40 hidden xl:block"
      style={{ transform: `translate(${EDGE}px, -50%)` }}
      aria-hidden
    >
      <div className="relative">
        <div
          className={`absolute top-1/2 w-max max-w-[280px] -translate-y-1/2 rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-cream shadow-lg ${
            onLeftHalf ? "left-[76px] rounded-bl-md" : "right-[76px] rounded-br-md"
          }`}
        >
          {line}
        </div>
        <div style={{ transform: `scaleX(${facing})` }}>
          <PalFace walking={walking} />
        </div>
      </div>
    </div>
  );
}
