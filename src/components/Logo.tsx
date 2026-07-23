// Clipspace logo – a speech bubble bent from a single paperclip wire.
// The wire enters at the tail, wraps the bubble, and curls inward like
// a paperclip coil. Brass wire, cream dots.

export function LogoIcon({
  size = 48,
  wire = "#D9A441",
  dots = "#F2EDE0",
}: {
  size?: number;
  wire?: string;
  dots?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Clipspace logo"
    >
      {/* one continuous wire: tail → around the bubble → inner coil */}
      <path
        d="M24 61
           L24 46
           L17 46
           C10.4 46 6 41.6 6 35
           L6 17
           C6 10.4 10.4 6 17 6
           L47 6
           C53.6 6 58 10.4 58 17
           L58 35
           C58 41.6 53.6 46 47 46
           L36 46
           C28 46 22 41 22 34
           L22 24
           C22 19.6 25 17 29.5 17
           L44 17
           C48 17 50 19.5 50 23
           L50 28"
        stroke={wire}
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* typing dots */}
      <circle cx="30" cy="31.5" r="2.9" fill={dots} />
      <circle cx="38.5" cy="31.5" r="2.9" fill={dots} />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight lowercase ${className}`}>
      <span className="text-cream">clip</span>
      <span className="text-brass">space</span>
    </span>
  );
}

export function Logo({ size = 40, textClass = "text-2xl" }: { size?: number; textClass?: string }) {
  return (
    <span className="inline-flex items-center gap-3">
      <LogoIcon size={size} />
      <Wordmark className={textClass} />
    </span>
  );
}
