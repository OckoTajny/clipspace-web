"use client";

import { useEffect, useRef, useState } from "react";
import PalSvg from "./PalSvg";

// Desktop-only scroll guide, scrollytelling style.
//
// The pal follows a hand-authored PATH: each section has a waypoint — a side
// (which gutter he parks in) and a height (where on the screen he stands).
// As you scroll he travels between waypoints along a gentle arc, leaning into
// his stride and stepping with his leg, so it reads like a designed route
// rather than a sprite sliding on a rail.
//
// He always parks in the empty gutter beside the content column, sized to fit
// that gutter, so he never stands on top of text or a button. His speech
// bubble types out on arrival and stays up until he sets off for the next
// stop. (Placeholder lines — the user will replace them.)
const STOPS = [
  { id: "hero", side: "left" as const, y: 0.5, line: "hey — i'm the paperclip. i hold this whole thing together." },
  { id: "features", side: "right" as const, y: 0.38, line: "no ads, no tracking, no catch. all of it, yours." },
  { id: "why", side: "left" as const, y: 0.55, line: "remember when software was on your side? same." },
  { id: "opensource", side: "right" as const, y: 0.42, line: "every line is public. read it, fork it, trust it." },
  { id: "contact", side: "left" as const, y: 0.5, line: "that's the tour. built with a paperclip and stubbornness." },
];

const CONTENT_W = 1152; // max-w-6xl — the pal lives in the gutter beside it
const GAP = 12; // clearance between the pal and the content column
const EDGE = 8; // clearance from the screen edge

export default function ScrollPal() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const palRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(STOPS[0].line);
  const [bubbleRight, setBubbleRight] = useState(STOPS[0].side === "left");
  const [bubbleOn, setBubbleOn] = useState(true);
  const [typing, setTyping] = useState(true);
  const [arrivalId, setArrivalId] = useState(0);
  const [walking, setWalking] = useState(false);
  const [palW, setPalW] = useState(88);

  const target = useRef({ x: 40, y: 0 });
  const cur = useRef({ x: 40, y: 0, lean: 0, facing: 1 as 1 | -1 });
  const palWRef = useRef(88);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // width of the empty margin on each side of the centered content box
    const gutter = () => Math.max(0, (window.innerWidth - CONTENT_W) / 2);

    const sizePal = () => {
      // as big as the gutter can hold, within a sensible range
      const room = gutter() - GAP - EDGE;
      const w = Math.max(46, Math.min(92, Math.floor(room)));
      if (w !== palWRef.current) {
        palWRef.current = w;
        setPalW(w);
      }
    };

    // park just outside the content box: his content-facing edge stops a
    // GAP short of it, so text and buttons are never covered
    const parkLeft = () =>
      Math.max(EDGE, gutter() - GAP - palWRef.current);
    const parkRight = () =>
      Math.min(
        window.innerWidth - EDGE - palWRef.current,
        window.innerWidth - gutter() + GAP,
      );

    const stopX = (s: (typeof STOPS)[number]) =>
      s.side === "left" ? parkLeft() : parkRight();
    // vertical offset from screen center for a waypoint's height anchor
    const stopY = (s: (typeof STOPS)[number]) =>
      (s.y - 0.5) * window.innerHeight;

    const computeTarget = () => {
      sizePal();
      const vc = window.innerHeight / 2;
      const pts: { center: number; stop: (typeof STOPS)[number] }[] = [];
      for (const s of STOPS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        pts.push({ center: r.top + r.height / 2, stop: s });
      }
      if (pts.length === 0) return;

      let near = pts[pts.length - 1].stop;
      let x = stopX(near);
      let y = stopY(near);
      // the footer can never reach the viewport center, so treat "scrolled
      // to the bottom" as arriving at the last stop
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) {
        // settled at the last stop
      } else if (vc <= pts[0].center) {
        near = pts[0].stop;
        x = stopX(near);
        y = stopY(near);
      } else {
        for (let i = 0; i < pts.length - 1; i++) {
          const a = pts[i];
          const b = pts[i + 1];
          if (vc >= a.center && vc <= b.center) {
            let t = (vc - a.center) / Math.max(b.center - a.center, 1);
            near = t < 0.5 ? a.stop : b.stop;
            t = t * t * (3 - 2 * t); // smoothstep: rest at stops, glide between
            const ax = stopX(a.stop);
            const bx = stopX(b.stop);
            const ay = stopY(a.stop);
            const by = stopY(b.stop);
            x = ax + (bx - ax) * t;
            y = ay + (by - ay) * t - Math.sin(t * Math.PI) * 26; // arced hop
            break;
          }
        }
      }
      target.current = { x, y };
      setLine(near.line);
      setBubbleRight(near.side === "left");
    };

    let raf = 0;
    let wasWalking = true; // start "walking" so the first idle frame counts as an arrival
    let typeTimer: ReturnType<typeof setTimeout> | undefined;

    const loop = () => {
      const c = cur.current;
      const dx = target.current.x - c.x;
      // gentle ease with a speed cap so crossing the screen reads as a
      // stroll, never a teleport
      let step = dx * 0.07;
      const MAX = 6;
      if (step > MAX) step = MAX;
      if (step < -MAX) step = -MAX;
      if (Math.abs(dx) > 0.4) c.x += step;
      c.y += (target.current.y - c.y) * 0.1;

      // lean into the stride, straighten out when idle
      const leanTarget = Math.max(-9, Math.min(9, step * 1.6));
      c.lean += (leanTarget - c.lean) * 0.12;
      if (Math.abs(step) > 0.6) c.facing = step > 0 ? 1 : -1;

      const isWalking = Math.abs(step) > 0.45;
      if (isWalking !== wasWalking) {
        wasWalking = isWalking;
        setWalking(isWalking);
        clearTimeout(typeTimer);
        if (isWalking) {
          // he sets off — put the bubble away until he arrives
          setBubbleOn(false);
        } else {
          // arrived: type out the line, then hold it until he leaves again
          setBubbleOn(true);
          setTyping(true);
          setArrivalId((n) => n + 1);
          typeTimer = setTimeout(() => setTyping(false), 850);
        }
      }

      if (wrapRef.current) {
        wrapRef.current.style.transform = `translate(${c.x}px, calc(-50% + ${c.y}px))`;
      }
      if (palRef.current) {
        // rotate first (screen space) so the lean isn't mirrored by the flip
        palRef.current.style.transform = `rotate(${c.lean}deg) scaleX(${c.facing})`;
      }
      raf = requestAnimationFrame(loop);
    };

    computeTarget();
    cur.current.x = target.current.x;
    cur.current.y = target.current.y;
    raf = requestAnimationFrame(loop);
    window.addEventListener("scroll", computeTarget, { passive: true });
    window.addEventListener("resize", computeTarget);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(typeTimer);
      window.removeEventListener("scroll", computeTarget);
      window.removeEventListener("resize", computeTarget);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none fixed left-0 top-1/2 z-40 hidden xl:block"
      style={{ transform: "translate(40px, -50%)" }}
      aria-hidden
    >
      <div className="relative">
        {/* sits up by his head; types on arrival (key remount), then holds
            the line until he walks off to the next stop */}
        <div
          className="absolute -translate-y-1/2"
          style={{
            top: "calc(50% - 72px)",
            ...(bubbleRight ? { left: palW + 14 } : { right: palW + 14 }),
          }}
        >
          <div
            key={arrivalId}
            className={`${bubbleOn ? "pal-say" : "pal-bubble-hide"} w-max max-w-[260px] rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-cream shadow-lg ${
              bubbleRight ? "origin-bottom-left rounded-bl-md" : "origin-bottom-right rounded-br-md"
            }`}
          >
            {typing ? (
              <span className="flex items-center gap-1 py-1.5">
                <span className="dot-blink inline-block h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="dot-blink-2 inline-block h-1.5 w-1.5 rounded-full bg-muted" />
                <span className="dot-blink-3 inline-block h-1.5 w-1.5 rounded-full bg-muted" />
              </span>
            ) : (
              line
            )}
          </div>
        </div>
        <div ref={palRef}>
          <div className={walking ? "pal-walk" : "pal-idle"}>
            <PalSvg width={palW} walking={walking} />
          </div>
        </div>
      </div>
    </div>
  );
}
