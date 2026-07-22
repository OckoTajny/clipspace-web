"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { who: "them" | "me"; text: string };

// A looping, scripted conversation — the crew keeps marvelling that it's
// free, private and open source. Restarts forever.
const SCRIPT: Msg[] = [
  { who: "them", text: "so… no ads in here? ever?" },
  { who: "me", text: "ever. and nobody can read this – not even the server" },
  { who: "them", text: "okay this is what the internet was supposed to be" },
  { who: "them", text: "wait it's actually open source too?" },
  { who: "me", text: "every line. fork it, break it, keep it" },
  { who: "them", text: "and it's free??" },
  { who: "me", text: "free. no catch, no premium privacy tier" },
  { who: "them", text: "moving the group chat here tonight" },
];

const WINDOW = 4;

function Bubble({ who, children }: { who: "them" | "me"; children: React.ReactNode }) {
  return (
    <div className={`flex ${who === "me" ? "justify-end" : "justify-start"}`}>
      <div
        className={`msg-in max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          who === "me"
            ? "bg-brass text-bg rounded-br-md font-medium"
            : "bg-surface-2 text-cream rounded-bl-md"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

export default function ChatDemo() {
  const [shown, setShown] = useState<{ m: Msg; key: number }[]>([
    { m: SCRIPT[0], key: 0 },
    { m: SCRIPT[1], key: 1 },
  ]);
  const [typingSide, setTypingSide] = useState<"them" | "me" | null>(null);
  const idx = useRef(2);
  const nextKey = useRef(2);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(SCRIPT.slice(0, 3).map((m, i) => ({ m, key: i })));
      return;
    }

    let typeTimer: ReturnType<typeof setTimeout>;
    let nextTimer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const next = SCRIPT[idx.current % SCRIPT.length];
      setTypingSide(next.who);
      typeTimer = setTimeout(() => {
        setTypingSide(null);
        setShown((prev) => {
          const arr = [...prev, { m: next, key: nextKey.current }];
          return arr.slice(-WINDOW);
        });
        nextKey.current += 1;
        idx.current += 1;
        nextTimer = setTimeout(tick, 2400);
      }, 1300);
    };

    nextTimer = setTimeout(tick, 2000);
    return () => {
      clearTimeout(typeTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  return (
    <div className="flex h-[224px] flex-col justify-end gap-3 overflow-hidden py-5">
      {shown.map(({ m, key }) => (
        <Bubble key={key} who={m.who}>
          {m.text}
        </Bubble>
      ))}
      {typingSide ? (
        <div className={`flex ${typingSide === "me" ? "justify-end" : "justify-start"}`}>
          <div
            className={`flex items-center gap-1.5 rounded-2xl px-4 py-3 ${
              typingSide === "me" ? "bg-brass/70 rounded-br-md" : "bg-surface-2 rounded-bl-md"
            }`}
          >
            <span className="dot-blink h-2 w-2 rounded-full bg-muted" />
            <span className="dot-blink-2 h-2 w-2 rounded-full bg-muted" />
            <span className="dot-blink-3 h-2 w-2 rounded-full bg-muted" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
