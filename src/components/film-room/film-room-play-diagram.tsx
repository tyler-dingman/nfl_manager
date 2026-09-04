export default function FilmRoomPlayDiagram() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-12 -right-20 top-0 hidden w-[58%] overflow-hidden opacity-[0.24] sm:block md:-right-14 md:w-[55%] lg:-right-6 lg:w-1/2"
      style={{
        color: 'color-mix(in srgb, var(--dark) 70%, var(--light))',
        WebkitMaskImage: 'linear-gradient(to right, transparent 0%, black 45%)',
        maskImage: 'linear-gradient(to right, transparent 0%, black 45%)',
      }}
    >
      <svg
        viewBox="0 0 760 330"
        className="h-full w-full scale-125"
        fill="none"
        stroke="currentColor"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <marker
            id="film-room-route-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 1 1 L 9 5 L 1 9" />
          </marker>
        </defs>

        <g opacity="0.9">
          <path
            d="M106 238c42-4 75-36 94-82 13-32 32-47 63-51"
            markerEnd="url(#film-room-route-arrow)"
          />
          <path
            d="M277 238c20-20 31-45 30-76-1-38 14-73 52-93"
            markerEnd="url(#film-room-route-arrow)"
          />
          <path
            d="M440 239c-6-34 7-62 37-85 33-25 51-53 49-88"
            markerEnd="url(#film-room-route-arrow)"
          />
          <path
            d="M568 237c24-4 47-23 61-48 18-33 45-48 82-47"
            markerEnd="url(#film-room-route-arrow)"
          />
          <path
            d="M361 241c31-14 56-14 77 0 33 23 77 28 127 15"
            markerEnd="url(#film-room-route-arrow)"
          />
        </g>

        <g strokeWidth="6">
          <circle cx="106" cy="239" r="15" />
          <circle cx="277" cy="239" r="15" />
          <circle cx="361" cy="241" r="15" />
          <circle cx="440" cy="239" r="15" />
          <circle cx="568" cy="237" r="15" />
          <circle cx="655" cy="250" r="15" />
        </g>

        <g strokeWidth="6">
          <path d="m151 126 22 22m0-22-22 22" />
          <path d="m226 75 22 22m0-22-22 22" />
          <path d="m341 134 22 22m0-22-22 22" />
          <path d="m407 85 22 22m0-22-22 22" />
          <path d="m592 101 22 22m0-22-22 22" />
          <path d="m676 73 22 22m0-22-22 22" />
          <path d="m692 192 22 22m0-22-22 22" />
        </g>

        <path
          d="M85 283c105-15 197-15 278 1 92 18 195 15 309-8"
          strokeDasharray="3 22"
          opacity="0.55"
        />
      </svg>
    </div>
  );
}
