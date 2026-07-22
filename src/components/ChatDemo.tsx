"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { who: "them" | "me"; text: string };

// A looping, scripted conversation. "me" lines are typed out live in the
// input box below, then "sent"; "them" lines arrive with a typing indicator.
// Sprinkled with paperclip / Clippy easter eggs.
const SCRIPT: Msg[] = [
  { who: "them", text: "ok real question. ads in here?" },
  { who: "me", text: "none. you're not the product this time" },
  { who: "them", text: "my old group chat literally put an ad in the middle of a family argument" },
  { who: "me", text: "yeah, that's the app you're leaving. not this one" },
  { who: "them", text: "and nobody can read this? like actually?" },
  { who: "me", text: "i can't read it and i built it" },
  { who: "them", text: "even the server?" },
  { who: "me", text: "the server just holds noise. your key is the only thing that turns it back into words" },
  { who: "them", text: "okay this is unreasonably based" },
  { who: "them", text: "what's the whole paperclip thing about anyway" },
  { who: "me", text: "half Clippy meme, half middle finger to big tech" },
  { who: "them", text: "😂" },
  { who: "me", text: "he holds your stuff together and, unlike some companies, keeps his mouth shut" },
  { who: "them", text: "moving movie night here. i'll bring snacks 🖇️" },
];

const WINDOW = 4;
const PLACEHOLDER = "Message weekend crew…";

function Bubble({ who, children }: { who: "them" | "me"; children: React.ReactNode }) {
  return (
    <div className={`flex ${who === "me" ? "justify-end" : "justify-start"}`}>
      <div
        className={`msg-in max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
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
  const [themTyping, setThemTyping] = useState(false);
  const [inputText, setInputText] = useState("");
  const [sendPressed, setSendPressed] = useState(false);
  const idx = useRef(2);
  const nextKey = useRef(2);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(SCRIPT.slice(0, 3).map((m, i) => ({ m, key: i })));
      return;
    }

    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = (ms: number) =>
      new Promise<void>((res) => {
        const t = setTimeout(res, ms);
        timers.push(t);
      });

    const push = (m: Msg) => {
      setShown((prev) => [...prev, { m, key: nextKey.current++ }].slice(-WINDOW));
    };

    const typeInto = async (text: string) => {
      for (let i = 1; i <= text.length; i++) {
        if (cancelled) return;
        setInputText(text.slice(0, i));
        await wait(22 + Math.random() * 34);
      }
    };

    const run = async () => {
      await wait(1600);
      while (!cancelled) {
        const next = SCRIPT[idx.current % SCRIPT.length];
        if (next.who === "them") {
          setThemTyping(true);
          await wait(1050);
          if (cancelled) return;
          setThemTyping(false);
          push(next);
        } else {
          await typeInto(next.text);
          await wait(260);
          if (cancelled) return;
          setSendPressed(true);
          await wait(170);
          setSendPressed(false);
          setInputText("");
          push(next);
        }
        idx.current += 1;
        await wait(1700);
      }
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <>
      <div className="flex h-[224px] flex-col justify-end gap-3 overflow-hidden py-5">
        {shown.map(({ m, key }) => (
          <Bubble key={key} who={m.who}>
            {m.text}
          </Bubble>
        ))}
        {themTyping ? (
          <div className="flex justify-start">
            <div className="msg-in flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-surface-2 px-4 py-3">
              <span className="dot-blink h-2 w-2 rounded-full bg-muted" />
              <span className="dot-blink-2 h-2 w-2 rounded-full bg-muted" />
              <span className="dot-blink-3 h-2 w-2 rounded-full bg-muted" />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 truncate rounded-full border border-line px-4 py-2.5 text-sm">
          {inputText ? (
            <span className="text-cream">
              {inputText}
              <span className="type-caret text-brass">|</span>
            </span>
          ) : (
            <span className="text-muted">{PLACEHOLDER}</span>
          )}
        </div>
        <button
          type="button"
          aria-label="Send message"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brass text-bg transition-transform duration-150 hover:bg-brass-soft ${
            sendPressed ? "scale-90" : "scale-100"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M2.5 20.5 L21.5 12 L2.5 3.5 L2.5 10.2 L15.5 12 L2.5 13.8 Z" />
          </svg>
        </button>
      </div>
    </>
  );
}
