"use client";

import { useEffect, useRef, useState } from "react";
import PalSvg from "./PalSvg";

// Desktop-only scroll guide.
//
// He only ever *targets* a parking spot in a side gutter — never a point in
// between. Whatever the scroll does (anchor clicks, scrubbing, stopping
// mid-way), when he comes to rest he is standing beside the content, not on
// it. The walk between spots is a time-based ease in screen space.
//
// The bubble sits ABOVE his head and grows toward the screen edge, so it
// lives entirely in the gutter and never covers text. It only appears while
// he stands still.
//
// Shown only on screens ≥1600px, where the gutter is wide enough for him
// and his bubble; below that the static pal in the "why" section takes over.
// (Placeholder lines — the user will replace them.)
const STOPS = [
  {
    id: "hero",
    side: "left" as const,
    y: 0.5,
    lines: [
      "hey — i'm the paperclip. i hold this whole thing together.",
      "it looks like you're trying to leave big tech. want a hand?",
      "one clip, zero data harvested. good start, right?",
    ],
  },
  {
    id: "features",
    side: "right" as const,
    y: 0.42,
    lines: [
      "no ads, no tracking, no catch. all of it, yours.",
      "encrypted on your phone, unreadable everywhere else.",
      "no phone number, no real name, no problem.",
    ],
  },
  {
    id: "why",
    side: "left" as const,
    y: 0.54,
    lines: [
      "remember when software was on your side? same.",
      "your feed used to be yours. let's do that again.",
      "90s helpfulness, 2026 cryptography. weird mix, i know.",
    ],
  },
  {
    id: "opensource",
    side: "right" as const,
    y: 0.44,
    lines: [
      "every line is public. read it, fork it, trust it.",
      "don't trust us — trust the code. it's all right there.",
      "built in the open, by people who actually use it.",
    ],
  },
  {
    id: "contact",
    side: "left" as const,
    y: 0.5,
    lines: [
      "that's the tour. built with a paperclip and stubbornness.",
      "stick around. or self-host. or both. i'm easy.",
      "made with one clip and a grudge against ads.",
    ],
  },
];

const GAP = 12; // clearance between the pal and the content column
const EDGE = 8; // clearance from the screen edge

export default function ScrollPal() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const palRef = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState(STOPS[0].lines[0]);
  const [leftGutter, setLeftGutter] = useState(true);
  const [bubbleOn, setBubbleOn] = useState(true);
  const [typing, setTyping] = useState(true);
  const [arrivalId, setArrivalId] = useState(0);
  const [walking, setWalking] = useState(false);
  const [palW, setPalW] = useState(88);
  const [bubbleW, setBubbleW] = useState(240);

  const target = useRef({ x: 40, y: 0 });
  const cur = useRef({ x: 40, y: 0, lean: 0, facing: 1 as 1 | -1 });
  const palWRef = useRef(88);
  const nearRef = useRef(STOPS[0]);
  // first arrival at each stop shows lines[0]; each later visit advances
  const lineIdx = useRef<Record<string, number>>({});

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // the content box is 72rem wide and the root font size scales up on big
    // screens, so measure the rem instead of hardcoding pixels
    const contentW = () =>
      72 * parseFloat(getComputedStyle(document.documentElement).fontSize);
    const gutter = () => Math.max(0, (window.innerWidth - contentW()) / 2);

    const sizePal = () => {
      // as big as the gutter can hold, within a sensible range
      const room = gutter() - GAP - EDGE;
      const w = Math.max(46, Math.min(92, Math.floor(room)));
      if (w !== palWRef.current) {
        palWRef.current = w;
        setPalW(w);
      }
      setBubbleW(Math.round(Math.max(150, Math.min(260, gutter() - 20))));
    };

    // park just outside the content box: his content-facing edge stops a
    // GAP short of it, so text and buttons are never covered
    const parkLeft = () => Math.max(EDGE, gutter() - GAP - palWRef.current);
    const parkRight = () =>
      Math.min(
        window.innerWidth - EDGE - palWRef.current,
        window.innerWidth - gutter() + GAP,
      );
    const stopX = (s: (typeof STOPS)[number]) =>
      s.side === "left" ? parkLeft() : parkRight();

    const computeTarget = () => {
      sizePal();
      const h = window.innerHeight;
      const vc = h / 2;

      // nearest section center wins, with hysteresis so slow scrolling
      // around a midpoint doesn't ping-pong him back and forth
      let best: { stop: (typeof STOPS)[number]; d: number } | null = null;
      let curD = Infinity;
      for (const s of STOPS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - vc);
        if (s.id === nearRef.current.id) curD = d;
        if (!best || d < best.d) best = { stop: s, d };
      }
      if (!best) return;

      let near = nearRef.current;
      // the footer can never reach the viewport center, so treat "scrolled
      // to the bottom" as arriving at the last stop
      const atBottom =
        h + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) near = STOPS[STOPS.length - 1];
      else if (curD === Infinity || best.d < curD - h * 0.12) near = best.stop;

      target.current = { x: stopX(near), y: (near.y - 0.5) * h };
      nearRef.current = near;
      setLeftGutter(near.side === "left");
    };

    let raf = 0;
    let wasWalking = true; // start "walking" so the first idle frame counts as an arrival
    let typeTimer: ReturnType<typeof setTimeout> | undefined;

    const loop = () => {
      const c = cur.current;
      const dx = target.current.x - c.x;
      // gentle ease with a speed cap so crossing the screen reads as a
      // stroll, never a teleport
      let step = dx * 0.08;
      const MAX = 7;
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
          // arrived: pick the next line from this stop's pool, type it out,
          // then hold it until he leaves again
          const s = nearRef.current;
          const i = lineIdx.current[s.id] ?? 0;
          setLine(s.lines[i % s.lines.length]);
          lineIdx.current[s.id] = i + 1;
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
      className="pointer-events-none fixed left-0 top-1/2 z-40 hidden min-[1600px]:block"
      style={{ transform: "translate(40px, -50%)" }}
      aria-hidden
    >
      <div className="relative">
        {/* above his head, growing toward the screen edge — it stays in the
            gutter, so it can never cover text. types on arrival (key
            remount), then holds the line until he walks off */}
        <div
          className="absolute bottom-full mb-3"
          style={leftGutter ? { right: 0 } : { left: 0 }}
        >
          <div
            key={arrivalId}
            className={`${bubbleOn ? "pal-say" : "pal-bubble-hide"} rounded-2xl border border-line bg-surface px-4 py-2.5 text-sm leading-relaxed text-cream shadow-lg ${
              leftGutter
                ? "origin-bottom-right rounded-br-md"
                : "origin-bottom-left rounded-bl-md"
            }`}
            style={{ width: "max-content", maxWidth: bubbleW }}
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
