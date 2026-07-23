"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
      "hey — i'm clip pal. i hold this whole thing together.",
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
    side: "left" as const,
    y: 0.44,
    lines: [
      "every line is public. read it, fork it, trust it.",
      "don't trust us — trust the code. it's all right there.",
      "built in the open, by people who actually use it.",
    ],
  },
  {
    id: "news",
    side: "right" as const,
    y: 0.46,
    lines: [
      "fresh off the press: android comes first.",
      "that's the tour. built with a paperclip and stubbornness.",
      "news travels fast when there are no algorithms.",
      "stick around. or self-host. or both. i'm easy.",
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
  const [bubSize, setBubSize] = useState<{ w: number; h: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const target = useRef({ x: 40, y: 0 });
  const cur = useRef({ x: 40, y: 0, lean: 0, facing: 1 as 1 | -1 });
  const palWRef = useRef(88);
  const nearRef = useRef(STOPS[0]);
  // first arrival at each stop shows lines[0]; each later visit advances
  const lineIdx = useRef<Record<string, number>>({});

  // measure the bubble's content so the box itself can smoothly grow from
  // the little typing bubble into the full line (width/height transition)
  useLayoutEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    setBubSize({ w: el.offsetWidth + 2, h: el.offsetHeight + 2 }); // +2 for the border
  }, [typing, line, bubbleW, palW, arrivalId]);

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

      // deterministic: he belongs to whichever section the middle of the
      // screen is inside — the divider between two sections is the exact
      // switch point, the same in both scroll directions, no in-between zone
      let near: (typeof STOPS)[number] | null = null;
      let fallback = STOPS[0];
      let bestD = Infinity;
      for (const s of STOPS) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (vc >= r.top && vc <= r.bottom) {
          near = s;
          break;
        }
        // center sits in a gap or past the ends — nearest section edge wins
        const d = Math.min(Math.abs(r.top - vc), Math.abs(r.bottom - vc));
        if (d < bestD) {
          bestD = d;
          fallback = s;
        }
      }
      if (near === null) near = fallback;
      // the footer can never reach the viewport center, so treat "scrolled
      // to the bottom" as arriving at the last stop
      const atBottom =
        h + window.scrollY >= document.documentElement.scrollHeight - 2;
      if (atBottom) near = STOPS[STOPS.length - 1];

      target.current = { x: stopX(near), y: (near.y - 0.5) * h };
      nearRef.current = near;
      setLeftGutter(near.side === "left");
    };

    let raf = 0;
    let wasWalking = false;
    let shownStop: string | null = null; // stop whose line the bubble shows
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
        if (isWalking) {
          // he sets off — put the bubble away until he arrives
          clearTimeout(typeTimer);
          setBubbleOn(false);
          shownStop = null;
        }
      }
      // speak whenever he's standing at a stop he hasn't announced yet —
      // this also covers two same-side stops, where there's no walk at all
      if (!isWalking && shownStop !== nearRef.current.id) {
        const s = nearRef.current;
        shownStop = s.id;
        clearTimeout(typeTimer);
        const i = lineIdx.current[s.id] ?? 0;
        setLine(s.lines[i % s.lines.length]);
        lineIdx.current[s.id] = i + 1;
        setBubbleOn(true);
        setTyping(true);
        setBubSize(null); // fresh bubble starts at the dots' natural size
        setArrivalId((n) => n + 1);
        typeTimer = setTimeout(() => setTyping(false), 850);
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
            className={`${bubbleOn ? "pal-say" : "pal-bubble-hide"} relative ${
              leftGutter ? "origin-bottom-right" : "origin-bottom-left"
            }`}
          >
            {/* the box animates its size, so it morphs smoothly from the
                little typing bubble into the full line */}
            <div
              className={`overflow-hidden rounded-2xl border border-line bg-surface shadow-lg transition-[width,height] duration-300 ease-out ${
                leftGutter ? "ml-auto rounded-br-md" : "rounded-bl-md"
              }`}
              style={
                bubSize ? { width: bubSize.w, height: bubSize.h } : undefined
              }
            >
              {/* content at its natural size — the box above is what's
                  measured against it and clipped while growing */}
              <div
                ref={contentRef}
                className="w-max px-4 py-2.5 text-sm leading-relaxed text-cream"
                style={{
                  maxWidth: bubbleW,
                  // never narrower than the pal — keeps the tail well
                  // inside the bubble even with just the typing dots
                  minWidth: palW + 8,
                }}
              >
                {typing ? (
                  <span className="flex items-center justify-center gap-1 py-1.5">
                    <span className="dot-blink inline-block h-1.5 w-1.5 rounded-full bg-muted" />
                    <span className="dot-blink-2 inline-block h-1.5 w-1.5 rounded-full bg-muted" />
                    <span className="dot-blink-3 inline-block h-1.5 w-1.5 rounded-full bg-muted" />
                  </span>
                ) : (
                  <span className="pal-line-in">{line}</span>
                )}
              </div>
            </div>
            {/* the tail: a rotated square poking out of the bottom edge,
                aimed at the pal's head so the bubble clearly comes from him */}
            <span
              className="absolute -bottom-[7px] h-3.5 w-3.5 rotate-45 border-b border-r border-line bg-surface"
              style={
                leftGutter
                  ? { right: Math.max(10, palW / 2 - 7) }
                  : { left: Math.max(10, palW / 2 - 7) }
              }
            />
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
