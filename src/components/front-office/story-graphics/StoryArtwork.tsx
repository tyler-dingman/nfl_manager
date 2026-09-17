"use client";
import { useId, type SVGProps } from "react";

export type StoryArtworkId =
  | "arrow-up"
  | "arrow-down"
  | "bars-ascending"
  | "bars-descending"
  | "trend-up"
  | "trend-down"
  | "stopwatch"
  | "medical-cross"
  | "return-arrow"
  | "map-pin"
  | "visit-route"
  | "clipboard"
  | "versus"
  | "declaration-card"
  | "transfer-arrows"
  | "trophy"
  | "milestone-marker"
  | "draft-card"
  | "draft-shield"
  | "puzzle"
  | "signal"
  | "target"
  | "radar"
  | "football"
  | "playbook-marks"
  | "diagonal-slashes"
  | "accent-rule"
  | "playbook-pattern"
  | "measurement-grid"
  | "etched-texture"
  | "calendar"
  | "star"
  | "checkmark"
  | "chevron-right"
  | "arrow-right"
  | "minus"
  | "plus"
  | "status-dot"
  | "bookmark"
  | "clock"
  | "gauge"
  | "corner-brackets"
  | "burst"
  | "handshake";

export function StoryArtwork({
  id,
  ...props
}: Omit<SVGProps<SVGSVGElement>, "id"> & { id: StoryArtworkId }) {
  const uid = useId().replace(/:/g, "");
  switch (id) {
    case "arrow-up":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M120 28 210 117H153V207H87V117H30Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M120 28 210 117H153V207H87V117H30Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M120 28 210 117H153V207H87V117H30Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="M42 113 120 36l78 77"
              fill="none"
              stroke="#fff"
              strokeWidth="1.5"
              opacity=".35"
            ></path>
          </g>
        </svg>
      );
    case "arrow-down":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="rotate(180 120 120)">
              <g transform="translate(0 5)">
                <path
                  d="M120 28 210 117H153V207H87V117H30Z"
                  fill="#000"
                  opacity=".65"
                ></path>
              </g>
              <path
                d="M120 28 210 117H153V207H87V117H30Z"
                fill={`url(#${uid}-metal)`}
                stroke="currentColor"
                strokeWidth="1.2"
              ></path>
              <path
                d="M120 28 210 117H153V207H87V117H30Z"
                fill={`url(#${uid}-sheen)`}
                stroke="#fff"
                strokeOpacity=".22"
                strokeWidth=".8"
              ></path>
            </g>
          </g>
        </svg>
      );
    case "bars-ascending":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <rect
              x="24"
              y="175"
              width="40"
              height="46"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="20"
              y="171"
              width="39"
              height="46"
              rx="0"
              fill={`url(#${uid}-steel)`}
              opacity=".55"
            ></rect>
            <rect
              x="20"
              y="171"
              width="39"
              height="46"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M20 217V171h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <rect
              x="78"
              y="139"
              width="40"
              height="82"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="74"
              y="135"
              width="39"
              height="82"
              rx="0"
              fill={`url(#${uid}-steel)`}
              opacity=".55"
            ></rect>
            <rect
              x="74"
              y="135"
              width="39"
              height="82"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M74 217V135h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <rect
              x="132"
              y="97"
              width="40"
              height="124"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="128"
              y="93"
              width="39"
              height="124"
              rx="0"
              fill={`url(#${uid}-steel)`}
              opacity=".55"
            ></rect>
            <rect
              x="128"
              y="93"
              width="39"
              height="124"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M128 217V93h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <rect
              x="186"
              y="50"
              width="40"
              height="171"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="182"
              y="46"
              width="39"
              height="171"
              rx="0"
              fill={`url(#${uid}-metal)`}
              opacity="1"
            ></rect>
            <rect
              x="182"
              y="46"
              width="39"
              height="171"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M182 217V46h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <path
              d="M13 218h219"
              fill="none"
              stroke="#778792"
              strokeWidth="1"
              opacity=".25"
            ></path>
          </g>
        </svg>
      );
    case "bars-descending":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <rect
              x="24"
              y="50"
              width="40"
              height="171"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="20"
              y="46"
              width="39"
              height="171"
              rx="0"
              fill={`url(#${uid}-steel)`}
              opacity=".55"
            ></rect>
            <rect
              x="20"
              y="46"
              width="39"
              height="171"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M20 217V46h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <rect
              x="78"
              y="97"
              width="40"
              height="124"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="74"
              y="93"
              width="39"
              height="124"
              rx="0"
              fill={`url(#${uid}-steel)`}
              opacity=".55"
            ></rect>
            <rect
              x="74"
              y="93"
              width="39"
              height="124"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M74 217V93h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <rect
              x="132"
              y="139"
              width="40"
              height="82"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="128"
              y="135"
              width="39"
              height="82"
              rx="0"
              fill={`url(#${uid}-steel)`}
              opacity=".55"
            ></rect>
            <rect
              x="128"
              y="135"
              width="39"
              height="82"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M128 217V135h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <rect
              x="186"
              y="175"
              width="40"
              height="46"
              rx="0"
              fill="#000"
              opacity=".35"
            ></rect>
            <rect
              x="182"
              y="171"
              width="39"
              height="46"
              rx="0"
              fill={`url(#${uid}-metal)`}
              opacity="1"
            ></rect>
            <rect
              x="182"
              y="171"
              width="39"
              height="46"
              rx="0"
              fill={`url(#${uid}-sheen)`}
            ></rect>
            <path
              d="M182 217V171h39"
              fill="none"
              stroke="#fff"
              strokeWidth="0.8"
              opacity=".23"
            ></path>
            <path
              d="M13 218h219"
              fill="none"
              stroke="#778792"
              strokeWidth="1"
              opacity=".25"
            ></path>
          </g>
        </svg>
      );
    case "trend-up":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M40 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 40H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M80 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 80H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M120 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 120H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M160 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 160H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M200 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 200H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M15 191 56 152 85 169 124 114 153 126 184 75 221 28 L221 220H15Z"
              fill="currentColor"
              opacity=".07"
            ></path>
            <path
              d="M15 191 56 152 85 169 124 114 153 126 184 75 221 28"
              fill="none"
              stroke="#000"
              strokeWidth="7"
              opacity=".7"
            ></path>
            <path
              d="M15 191 56 152 85 169 124 114 153 126 184 75 221 28"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="5"
            ></path>
            <circle
              cx="56"
              cy="152"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="85"
              cy="169"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="124"
              cy="114"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="153"
              cy="126"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="184"
              cy="75"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <g transform="translate(0 5)">
              <path
                d="M204 28h23v25l-6-9-14-4Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M204 28h23v25l-6-9-14-4Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M204 28h23v25l-6-9-14-4Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "trend-down":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M40 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 40H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M80 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 80H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M120 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 120H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M160 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 160H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M200 22V220"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M10 200H230"
              fill="none"
              stroke="#91a3b4"
              strokeWidth="0.6"
              opacity=".13"
            ></path>
            <path
              d="M15 28 56 75 85 58 124 113 153 101 184 153 221 201 L221 220H15Z"
              fill="currentColor"
              opacity=".07"
            ></path>
            <path
              d="M15 28 56 75 85 58 124 113 153 101 184 153 221 201"
              fill="none"
              stroke="#000"
              strokeWidth="7"
              opacity=".7"
            ></path>
            <path
              d="M15 28 56 75 85 58 124 113 153 101 184 153 221 201"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="5"
            ></path>
            <circle
              cx="56"
              cy="75"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="85"
              cy="58"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="124"
              cy="113"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="153"
              cy="101"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="184"
              cy="153"
              r="4"
              fill="#e6eaf0"
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <g transform="translate(0 5)">
              <path
                d="M204 201h23v-25l-6 9-14 4Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M204 201h23v-25l-6 9-14 4Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M204 201h23v-25l-6 9-14 4Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "stopwatch":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M105 9h30l7 7v14h-14v15h-16V30H98V16Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M105 9h30l7 7v14h-14v15h-16V30H98V16Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M105 9h30l7 7v14h-14v15h-16V30H98V16Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <g transform="translate(0 5)">
              <path
                d="m177 47 12-12 13 13-12 12Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="m177 47 12-12 13 13-12 12Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="m177 47 12-12 13 13-12 12Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <circle cx="120" cy="136" r="91" fill="#000" opacity=".65"></circle>
            <circle
              cx="120"
              cy="130"
              r="91"
              fill={`url(#${uid}-metal)`}
            ></circle>
            <circle
              cx="120"
              cy="130"
              r="87"
              fill={`url(#${uid}-sheen)`}
            ></circle>
            <circle
              cx="120"
              cy="130"
              r="78"
              fill={`url(#${uid}-dark)`}
              stroke="currentColor"
              strokeWidth="2"
            ></circle>
            <circle
              cx="120"
              cy="130"
              r="72"
              fill="none"
              stroke="#fff"
              strokeOpacity=".09"
            ></circle>
            <path
              d="M120.00 66.00 120.00 56.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M127.21 61.38 127.74 56.41"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M134.35 62.51 135.39 57.62"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M141.32 64.38 142.87 59.62"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M148.06 66.97 150.10 62.40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M152.00 74.57 157.00 65.91"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M160.56 74.18 163.50 70.13"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M166.17 78.72 169.52 75.01"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M171.28 83.83 174.99 80.48"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M175.82 89.44 179.87 86.50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M175.43 98.00 184.09 93.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M183.03 101.94 187.60 99.90"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M185.62 108.68 190.38 107.13"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M187.49 115.65 192.38 114.61"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M188.62 122.79 193.59 122.26"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M184.00 130.00 194.00 130.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M188.62 137.21 193.59 137.74"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M187.49 144.35 192.38 145.39"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M185.62 151.32 190.38 152.87"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M183.03 158.06 187.60 160.10"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M175.43 162.00 184.09 167.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M175.82 170.56 179.87 173.50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M171.28 176.17 174.99 179.52"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M166.17 181.28 169.52 184.99"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M160.56 185.82 163.50 189.87"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M152.00 185.43 157.00 194.09"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M148.06 193.03 150.10 197.60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M141.32 195.62 142.87 200.38"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M134.35 197.49 135.39 202.38"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M127.21 198.62 127.74 203.59"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M120.00 194.00 120.00 204.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M112.79 198.62 112.26 203.59"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M105.65 197.49 104.61 202.38"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M98.68 195.62 97.13 200.38"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M91.94 193.03 89.90 197.60"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M88.00 185.43 83.00 194.09"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M79.44 185.82 76.50 189.87"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M73.83 181.28 70.48 184.99"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M68.72 176.17 65.01 179.52"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M64.18 170.56 60.13 173.50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M64.57 162.00 55.91 167.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M56.97 158.06 52.40 160.10"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M54.38 151.32 49.62 152.87"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M52.51 144.35 47.62 145.39"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M51.38 137.21 46.41 137.74"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M56.00 130.00 46.00 130.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M51.38 122.79 46.41 122.26"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M52.51 115.65 47.62 114.61"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M54.38 108.68 49.62 107.13"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M56.97 101.94 52.40 99.90"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M64.57 98.00 55.91 93.00"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M64.18 89.44 60.13 86.50"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M68.72 83.83 65.01 80.48"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M73.83 78.72 70.48 75.01"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M79.44 74.18 76.50 70.13"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M88.00 74.57 83.00 65.91"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              opacity=".95"
            ></path>
            <path
              d="M91.94 66.97 89.90 62.40"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M98.68 64.38 97.13 59.62"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M105.65 62.51 104.61 57.62"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <path
              d="M112.79 61.38 112.26 56.41"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.8"
              opacity=".35"
            ></path>
            <g transform="translate(0 5)">
              <path
                d="M113 132 160 86l-33 55-21 16 9-21Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M113 132 160 86l-33 55-21 16 9-21Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M113 132 160 86l-33 55-21 16 9-21Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <circle
              cx="120"
              cy="130"
              r="7"
              fill={`url(#${uid}-metal)`}
              stroke="#dcfff4"
              strokeOpacity=".6"
            ></circle>
            <path
              d="M49 115a73 73 0 0 1 121-41"
              fill="none"
              stroke="#fff"
              strokeWidth="1"
              opacity=".2"
            ></path>
          </g>
        </svg>
      );
    case "medical-cross":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M88 26h64v62h62v64h-62v62H88v-62H26V88h62Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M88 26h64v62h62v64h-62v62H88v-62H26V88h62Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M88 26h64v62h62v64h-62v62H88v-62H26V88h62Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="M96 35h47v61h62v47h-62v62H96v-62H35V96h61Z"
              fill={`url(#${uid}-glass)`}
            ></path>
          </g>
        </svg>
      );
    case "return-arrow":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M55 67A86 86 0 1 1 38 152l27-10a57 57 0 1 0 14-55l23 22H24V32Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M55 67A86 86 0 1 1 38 152l27-10a57 57 0 1 0 14-55l23 22H24V32Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M55 67A86 86 0 1 1 38 152l27-10a57 57 0 1 0 14-55l23 22H24V32Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "map-pin":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M120 18c-44 0-72 32-72 69 0 48 72 136 72 136s72-88 72-136c0-37-28-69-72-69Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M120 18c-44 0-72 32-72 69 0 48 72 136 72 136s72-88 72-136c0-37-28-69-72-69Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M120 18c-44 0-72 32-72 69 0 48 72 136 72 136s72-88 72-136c0-37-28-69-72-69Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <circle
              cx="120"
              cy="85"
              r="27"
              fill={`url(#${uid}-dark)`}
              stroke="#fff"
              strokeOpacity=".2"
              strokeWidth="2"
            ></circle>
            <path
              d="M67 66c10-28 40-37 61-35"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              opacity=".35"
            ></path>
          </g>
        </svg>
      );
    case "visit-route":
      return (
        <svg
          {...props}
          viewBox="0 0 300 110"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M12 75C65 10 96 113 150 64S219 23 274 45"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeDasharray="10 12"
              strokeLinecap="round"
            ></path>
            <circle cx="12" cy="75" r="5" fill="#b8cad6"></circle>
            <circle cx="278" cy="46" r="5" fill="currentColor"></circle>
          </g>
        </svg>
      );
    case "clipboard":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M48 38h144l9 9v172H39V47Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M48 38h144l9 9v172H39V47Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M48 38h144l9 9v172H39V47Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <rect
              x="50"
              y="49"
              width="140"
              height="158"
              rx="4"
              fill={`url(#${uid}-dark)`}
            ></rect>
            <g transform="translate(0 5)">
              <path
                d="M91 26h15a14 14 0 0 1 28 0h15v32H91Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M91 26h15a14 14 0 0 1 28 0h15v32H91Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M91 26h15a14 14 0 0 1 28 0h15v32H91Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <circle cx="120" cy="27" r="6" fill="#101a20"></circle>
            <rect
              x="68"
              y="81"
              width="93"
              height="7"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <path
              d="M68 81h93"
              fill="none"
              stroke="#fff"
              strokeWidth="1"
              opacity=".3"
            ></path>
            <rect
              x="68"
              y="110"
              width="93"
              height="7"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <path
              d="M68 110h93"
              fill="none"
              stroke="#fff"
              strokeWidth="1"
              opacity=".3"
            ></path>
            <rect
              x="68"
              y="139"
              width="93"
              height="7"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <path
              d="M68 139h93"
              fill="none"
              stroke="#fff"
              strokeWidth="1"
              opacity=".3"
            ></path>
            <rect
              x="68"
              y="168"
              width="66"
              height="7"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <path
              d="M68 168h66"
              fill="none"
              stroke="#fff"
              strokeWidth="1"
              opacity=".3"
            ></path>
          </g>
        </svg>
      );
    case "versus":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M20 63h29l14 86 42-86h31L77 180H43Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M20 63h29l14 86 42-86h31L77 180H43Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M20 63h29l14 86 42-86h31L77 180H43Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <g transform="translate(0 5)">
              <path
                d="M145 63h77l-9 24h-48l-6 22h37l14 17-10 34-22 20h-77l10-25h50l5-20h-37l-14-17 11-36Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M145 63h77l-9 24h-48l-6 22h37l14 17-10 34-22 20h-77l10-25h50l5-20h-37l-14-17 11-36Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M145 63h77l-9 24h-48l-6 22h37l14 17-10 34-22 20h-77l10-25h50l5-20h-37l-14-17 11-36Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "declaration-card":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M48 19h115l24 24v166H48Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M48 19h115l24 24v166H48Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M48 19h115l24 24v166H48Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <rect
              x="56"
              y="29"
              width="120"
              height="170"
              rx="0"
              fill={`url(#${uid}-dark)`}
            ></rect>
            <path
              d="M159 26v26h20"
              fill="none"
              stroke="#b2c9d8"
              strokeWidth="3"
            ></path>
            <rect
              x="72"
              y="65"
              width="87"
              height="5"
              rx="0"
              fill={`url(#${uid}-steel)`}
            ></rect>
            <rect
              x="72"
              y="93"
              width="70"
              height="5"
              rx="0"
              fill={`url(#${uid}-steel)`}
            ></rect>
            <rect
              x="72"
              y="121"
              width="83"
              height="5"
              rx="0"
              fill={`url(#${uid}-steel)`}
            ></rect>
            <rect
              x="72"
              y="149"
              width="53"
              height="5"
              rx="0"
              fill={`url(#${uid}-steel)`}
            ></rect>
            <circle cx="178" cy="178" r="39" fill="#060c10"></circle>
            <circle
              cx="175"
              cy="173"
              r="39"
              fill={`url(#${uid}-steel)`}
            ></circle>
            <circle
              cx="175"
              cy="173"
              r="36"
              fill={`url(#${uid}-sheen)`}
            ></circle>
            <path
              d="m153 172 14 13 25-30 9 8-33 39-23-23Z"
              fill="#10202c"
            ></path>
          </g>
        </svg>
      );
    case "transfer-arrows":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M26 47h133V24l59 43-59 43V85H26Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M26 47h133V24l59 43-59 43V85H26Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M26 47h133V24l59 43-59 43V85H26Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <g transform="translate(0 5)">
              <path
                d="M214 155H81v-25l-59 43 59 43v-23h133Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M214 155H81v-25l-59 43 59 43v-23h133Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M214 155H81v-25l-59 43 59 43v-23h133Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "trophy":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M70 31h100v68c0 42-22 57-41 63v29h35v23H76v-23h35v-29c-19-6-41-21-41-63Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M70 31h100v68c0 42-22 57-41 63v29h35v23H76v-23h35v-29c-19-6-41-21-41-63Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M70 31h100v68c0 42-22 57-41 63v29h35v23H76v-23h35v-29c-19-6-41-21-41-63Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="M71 48H38v30c0 35 15 49 43 50M169 48h33v30c0 35-15 49-43 50"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="10"
            ></path>
            <path
              d="M77 38h85M83 199h73"
              fill="none"
              stroke="#fff"
              strokeWidth="2"
              opacity=".42"
            ></path>
            <path
              d="M79 40h14v63c0 18 2 27 9 36-17-10-23-27-23-42Z"
              fill="#fff"
              opacity=".13"
            ></path>
          </g>
        </svg>
      );
    case "milestone-marker":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path d="M40 20h16v190H40Z" fill="#000" opacity=".65"></path>
            </g>
            <path
              d="M40 20h16v190H40Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M40 20h16v190H40Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <g transform="translate(0 5)">
              <path
                d="M57 24h147l-36 47 36 47H57Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M57 24h147l-36 47 36 47H57Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M57 24h147l-36 47 36 47H57Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <g transform="translate(0 5)">
              <path d="M23 210h75v14H23Z" fill="#000" opacity=".65"></path>
            </g>
            <path
              d="M23 210h75v14H23Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M23 210h75v14H23Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <circle
              cx="174"
              cy="179"
              r="39"
              fill={`url(#${uid}-steel)`}
            ></circle>
            <circle
              cx="174"
              cy="179"
              r="30"
              fill={`url(#${uid}-dark)`}
            ></circle>
            <path
              d="m174 156 6 14 15 2-11 10 3 15-13-7-13 7 3-15-11-10 15-2Z"
              fill={`url(#${uid}-metal)`}
            ></path>
          </g>
        </svg>
      );
    case "draft-card":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path d="M24 48h192v146H24Z" fill="#000" opacity=".65"></path>
            </g>
            <path
              d="M24 48h192v146H24Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M24 48h192v146H24Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <rect
              x="31"
              y="56"
              width="178"
              height="129"
              rx="0"
              fill={`url(#${uid}-dark)`}
            ></rect>
            <rect
              x="31"
              y="56"
              width="178"
              height="29"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <rect
              x="47"
              y="105"
              width="87"
              height="8"
              rx="0"
              fill={`url(#${uid}-steel)`}
            ></rect>
            <rect
              x="47"
              y="132"
              width="116"
              height="8"
              rx="0"
              fill={`url(#${uid}-steel)`}
            ></rect>
            <rect
              x="47"
              y="159"
              width="65"
              height="6"
              rx="0"
              fill={`url(#${uid}-steel)`}
            ></rect>
            <rect
              x="171"
              y="103"
              width="22"
              height="37"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
          </g>
        </svg>
      );
    case "draft-shield":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M120 18 204 46v90c0 38-39 65-84 87-45-22-84-49-84-87V46Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M120 18 204 46v90c0 38-39 65-84 87-45-22-84-49-84-87V46Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M120 18 204 46v90c0 38-39 65-84 87-45-22-84-49-84-87V46Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="M120 30 192 55v78c0 31-34 57-72 77-38-20-72-46-72-77V55Z"
              fill={`url(#${uid}-dark)`}
            ></path>
            <rect
              x="75"
              y="76"
              width="90"
              height="12"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <rect
              x="75"
              y="106"
              width="90"
              height="12"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <rect
              x="90"
              y="136"
              width="60"
              height="12"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
          </g>
        </svg>
      );
    case "puzzle":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M38 45h57c-10-28 3-40 21-40s31 12 21 40h59v55c29-10 39 3 39 21s-10 30-39 20v57h-59c10-28-3-40-21-40s-31 12-21 40H38v-57c28 10 40-2 40-20s-12-31-40-21Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M38 45h57c-10-28 3-40 21-40s31 12 21 40h59v55c29-10 39 3 39 21s-10 30-39 20v57h-59c10-28-3-40-21-40s-31 12-21 40H38v-57c28 10 40-2 40-20s-12-31-40-21Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M38 45h57c-10-28 3-40 21-40s31 12 21 40h59v55c29-10 39 3 39 21s-10 30-39 20v57h-59c10-28-3-40-21-40s-31 12-21 40H38v-57c28 10 40-2 40-20s-12-31-40-21Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "signal":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <circle
              cx="120"
              cy="97"
              r="13"
              fill={`url(#${uid}-metal)`}
            ></circle>
            <g transform="translate(0 5)">
              <path d="M112 116h16l13 92H99Z" fill="#000" opacity=".65"></path>
            </g>
            <path
              d="M112 116h16l13 92H99Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M112 116h16l13 92H99Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="M94.1 70.36a37 37 0 0 0 0 53.28M145.9 70.36a37 37 0 0 1 0 53.28"
              fill="none"
              stroke="#000"
              strokeWidth="11"
            ></path>
            <path
              d="M94.1 70.36a37 37 0 0 0 0 53.28M145.9 70.36a37 37 0 0 1 0 53.28"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="7"
            ></path>
            <path
              d="M74.5 50.2a65 65 0 0 0 0 93.6M165.5 50.2a65 65 0 0 1 0 93.6"
              fill="none"
              stroke="#000"
              strokeWidth="11"
            ></path>
            <path
              d="M74.5 50.2a65 65 0 0 0 0 93.6M165.5 50.2a65 65 0 0 1 0 93.6"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="7"
            ></path>
            <path
              d="M54.2 29.320000000000007a94 94 0 0 0 0 135.35999999999999M185.8 29.320000000000007a94 94 0 0 1 0 135.35999999999999"
              fill="none"
              stroke="#000"
              strokeWidth="11"
            ></path>
            <path
              d="M54.2 29.320000000000007a94 94 0 0 0 0 135.35999999999999M185.8 29.320000000000007a94 94 0 0 1 0 135.35999999999999"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="7"
            ></path>
          </g>
        </svg>
      );
    case "target":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <circle
              cx="120"
              cy="120"
              r="102"
              fill={`url(#${uid}-halo)`}
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="96"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="5"
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="67"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity=".4"
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="35"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity=".4"
            ></circle>
            <path
              d="M120 13v214M13 120h214"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity=".25"
            ></path>
            <circle
              cx="120"
              cy="120"
              r="9"
              fill={`url(#${uid}-metal)`}
            ></circle>
            <path
              d="M120 10v24M120 206v24M10 120h24M206 120h24"
              fill="none"
              stroke={`url(#${uid}-steel)`}
              strokeWidth="5"
            ></path>
          </g>
        </svg>
      );
    case "radar":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <circle
              cx="120"
              cy="120"
              r="102"
              fill={`url(#${uid}-halo)`}
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="96"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="5"
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="67"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity=".4"
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="35"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              opacity=".4"
            ></circle>
            <path
              d="M120 13v214M13 120h214"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              opacity=".25"
            ></path>
            <path
              d="M120 120V26a94 94 0 0 1 81 47Z"
              fill="currentColor"
              opacity=".2"
            ></path>
            <path
              d="M120 120 201 73"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="4"
            ></path>
            <circle cx="81" cy="155" r="5" fill="currentColor"></circle>
            <circle cx="158" cy="77" r="4" fill="#e0e9ef"></circle>
          </g>
        </svg>
      );
    case "football":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M27 209C-2 91 98 1 211 28c29 113-66 211-184 181Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M27 209C-2 91 98 1 211 28c29 113-66 211-184 181Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M27 209C-2 91 98 1 211 28c29 113-66 211-184 181Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="M66 174 174 66"
              fill="none"
              stroke="#d3dce3"
              strokeWidth="6"
            ></path>
            <path
              d="M78 142 98 162"
              fill="none"
              stroke="#d3dce3"
              strokeWidth="5"
            ></path>
            <path
              d="M99 121 119 141"
              fill="none"
              stroke="#d3dce3"
              strokeWidth="5"
            ></path>
            <path
              d="M120 100 140 120"
              fill="none"
              stroke="#d3dce3"
              strokeWidth="5"
            ></path>
            <path
              d="M141 79 161 99"
              fill="none"
              stroke="#d3dce3"
              strokeWidth="5"
            ></path>
            <path
              d="M29 132 109 212M132 29l79 80"
              fill="none"
              stroke="#07131b"
              strokeWidth="10"
              opacity=".6"
            ></path>
          </g>
        </svg>
      );
    case "playbook-marks":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <circle
              cx="40"
              cy="183"
              r="19"
              fill="none"
              stroke={`url(#${uid}-steel)`}
              strokeWidth="6"
            ></circle>
            <path
              d="M40 151V57h134m-28-26 29 26-29 26"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="6"
            ></path>
            <path
              d="m88 166 32 32m0-32-32 32m75-32 32 32m0-32-32 32"
              fill="none"
              stroke={`url(#${uid}-steel)`}
              strokeWidth="6"
            ></path>
          </g>
        </svg>
      );
    case "diagonal-slashes":
      return (
        <svg
          {...props}
          viewBox="0 0 320 300"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M219-20h86L145 320H59Z"
              fill="currentColor"
              opacity=".07"
            ></path>
            <path
              d="M253-20h45L138 320H93Z"
              fill={`url(#${uid}-metal)`}
              opacity=".5"
            ></path>
            <path d="M257-20h14L111 320H97Z" fill={`url(#${uid}-sheen)`}></path>
            <path
              d="M253-20 93 320"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              opacity=".9"
            ></path>
            <path
              d="M298-20 138 320"
              fill="none"
              stroke="#fff"
              strokeWidth="0.7"
              opacity=".24"
            ></path>
            <path
              d="M316-20 156 320"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.7"
              opacity=".25"
            ></path>
          </g>
        </svg>
      );
    case "accent-rule":
      return (
        <svg
          {...props}
          viewBox="0 0 300 34"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M5 23h181l17-18h92v5h-89l-18 18H5Z"
              fill={`url(#${uid}-metal)`}
            ></path>
            <path
              d="M5 22h181l17-18h92"
              fill="none"
              stroke="#fff"
              strokeWidth="0.7"
              opacity=".4"
            ></path>
          </g>
        </svg>
      );
    case "playbook-pattern":
      return (
        <svg
          {...props}
          viewBox="0 0 320 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <circle
              cx="33"
              cy="44"
              r="9"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".18"
            ></circle>
            <circle
              cx="123"
              cy="102"
              r="9"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".18"
            ></circle>
            <circle
              cx="227"
              cy="58"
              r="9"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".18"
            ></circle>
            <circle
              cx="281"
              cy="149"
              r="9"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".18"
            ></circle>
            <circle
              cx="58"
              cy="180"
              r="9"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".18"
            ></circle>
            <path
              d="M73 23l14 14m0-14-14 14"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".2"
            ></path>
            <path
              d="M163 154l14 14m0-14-14 14"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".2"
            ></path>
            <path
              d="M262 23l14 14m0-14-14 14"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".2"
            ></path>
            <path
              d="M108 197l14 14m0-14-14 14"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="2"
              opacity=".2"
            ></path>
            <path
              d="M33 60v62h56M123 87V47h61M228 73v123h39"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="1.4"
              opacity=".14"
              strokeDasharray="5 7"
            ></path>
            <path
              d="m79 112 10 10-10 10m94-95 11 10-11 10"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="1.4"
              opacity=".2"
            ></path>
          </g>
        </svg>
      );
    case "measurement-grid":
      return (
        <svg
          {...props}
          viewBox="0 0 320 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M0 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M20 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M40 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M60 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M80 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M100 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M120 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M140 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M160 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M180 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M200 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M220 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M240 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M260 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M280 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M300 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M320 0v240"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 0h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 20h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 40h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 60h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 80h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 100h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 120h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 140h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 160h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 180h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 200h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 220h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M0 240h320"
              fill="none"
              stroke="#a8bdc9"
              strokeWidth="0.6"
              opacity=".11"
            ></path>
            <path
              d="M37 40h6M40 37v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M37 120h6M40 117v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M37 200h6M40 197v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M117 40h6M120 37v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M117 120h6M120 117v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M117 200h6M120 197v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M197 40h6M200 37v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M197 120h6M200 117v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M197 200h6M200 197v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M277 40h6M280 37v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M277 120h6M280 117v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
            <path
              d="M277 200h6M280 197v6"
              fill="none"
              stroke="#c8d6df"
              strokeWidth="0.8"
              opacity=".24"
            ></path>
          </g>
        </svg>
      );
    case "etched-texture":
      return (
        <svg
          {...props}
          viewBox="0 0 320 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M-30 0 -190 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M-23 0 -183 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M-16 0 -176 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M-9 0 -169 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M-2 0 -162 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M5 0 -155 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M12 0 -148 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M19 0 -141 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M26 0 -134 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M33 0 -127 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M40 0 -120 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M47 0 -113 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M54 0 -106 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M61 0 -99 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M68 0 -92 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M75 0 -85 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M82 0 -78 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M89 0 -71 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M96 0 -64 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M103 0 -57 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M110 0 -50 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M117 0 -43 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M124 0 -36 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M131 0 -29 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M138 0 -22 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M145 0 -15 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M152 0 -8 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M159 0 -1 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M166 0 6 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M173 0 13 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M180 0 20 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M187 0 27 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M194 0 34 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M201 0 41 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M208 0 48 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M215 0 55 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M222 0 62 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M229 0 69 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M236 0 76 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M243 0 83 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M250 0 90 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M257 0 97 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M264 0 104 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M271 0 111 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M278 0 118 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M285 0 125 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M292 0 132 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M299 0 139 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M306 0 146 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M313 0 153 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M320 0 160 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M327 0 167 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M334 0 174 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M341 0 181 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M348 0 188 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M355 0 195 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M362 0 202 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M369 0 209 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M376 0 216 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M383 0 223 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M390 0 230 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M397 0 237 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M404 0 244 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M411 0 251 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M418 0 258 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M425 0 265 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M432 0 272 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M439 0 279 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M446 0 286 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M453 0 293 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M460 0 300 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M467 0 307 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M474 0 314 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M481 0 321 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
            <path
              d="M488 0 328 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.065"
            ></path>
            <path
              d="M495 0 335 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.08"
            ></path>
            <path
              d="M502 0 342 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.035"
            ></path>
            <path
              d="M509 0 349 240"
              fill="none"
              stroke="#b8c8d0"
              strokeWidth="0.45"
              opacity="0.05"
            ></path>
          </g>
        </svg>
      );
    case "calendar":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path d="M35 41h170v178H35Z" fill="#000" opacity=".65"></path>
            </g>
            <path
              d="M35 41h170v178H35Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M35 41h170v178H35Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <rect
              x="44"
              y="78"
              width="152"
              height="132"
              rx="0"
              fill={`url(#${uid}-dark)`}
            ></rect>
            <rect
              x="44"
              y="49"
              width="152"
              height="29"
              rx="0"
              fill={`url(#${uid}-metal)`}
            ></rect>
            <path
              d="M77 22v40M163 22v40"
              fill="none"
              stroke={`url(#${uid}-steel)`}
              strokeWidth="10"
            ></path>
            <g transform="translate(0 5)">
              <path
                d="m72 146 26 26 70-73 15 14-85 89-40-41Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="m72 146 26 26 70-73 15 14-85 89-40-41Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="m72 146 26 26 70-73 15 14-85 89-40-41Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "star":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M120 17 151 80l70 10-51 49 12 70-62-33-62 33 12-70-51-49 70-10Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M120 17 151 80l70 10-51 49 12 70-62-33-62 33 12-70-51-49 70-10Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M120 17 151 80l70 10-51 49 12 70-62-33-62 33 12-70-51-49 70-10Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "checkmark":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="m30 122 26-26 48 49 81-94 27 24-107 123Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="m30 122 26-26 48 49 81-94 27 24-107 123Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="m30 122 26-26 48 49 81-94 27 24-107 123Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "chevron-right":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="m75 31 88 89-88 89-23-23 66-66-66-66Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="m75 31 88 89-88 89-23-23 66-66-66-66Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="m75 31 88 89-88 89-23-23 66-66-66-66Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "arrow-right":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="rotate(90 120 120)">
              <g transform="translate(0 5)">
                <path
                  d="M120 28 210 117H153V207H87V117H30Z"
                  fill="#000"
                  opacity=".65"
                ></path>
              </g>
              <path
                d="M120 28 210 117H153V207H87V117H30Z"
                fill={`url(#${uid}-metal)`}
                stroke="currentColor"
                strokeWidth="1.2"
              ></path>
              <path
                d="M120 28 210 117H153V207H87V117H30Z"
                fill={`url(#${uid}-sheen)`}
                stroke="#fff"
                strokeOpacity=".22"
                strokeWidth=".8"
              ></path>
            </g>
          </g>
        </svg>
      );
    case "minus":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path d="M34 105h172v30H34Z" fill="#000" opacity=".65"></path>
            </g>
            <path
              d="M34 105h172v30H34Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M34 105h172v30H34Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "plus":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M105 34h30v71h71v30h-71v71h-30v-71H34v-30h71Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M105 34h30v71h71v30h-71v71h-30v-71H34v-30h71Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M105 34h30v71h71v30h-71v71h-30v-71H34v-30h71Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "status-dot":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <circle
              cx="120"
              cy="120"
              r="59"
              fill={`url(#${uid}-halo)`}
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="29"
              fill={`url(#${uid}-metal)`}
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="29"
              fill={`url(#${uid}-sheen)`}
            ></circle>
          </g>
        </svg>
      );
    case "bookmark":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="M58 21h124v200l-62-47-62 47Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M58 21h124v200l-62-47-62 47Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M58 21h124v200l-62-47-62 47Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="M68 31h104v165l-52-38-52 38Z"
              fill="none"
              stroke="#fff"
              strokeWidth="1"
              opacity=".2"
            ></path>
          </g>
        </svg>
      );
    case "clock":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <circle
              cx="120"
              cy="120"
              r="96"
              fill={`url(#${uid}-metal)`}
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="86"
              fill={`url(#${uid}-dark)`}
            ></circle>
            <circle
              cx="120"
              cy="120"
              r="78"
              fill="none"
              stroke="#fff"
              strokeOpacity=".1"
            ></circle>
            <path
              d="M120 62v63l43 24"
              fill="none"
              stroke={`url(#${uid}-steel)`}
              strokeWidth="7"
            ></path>
            <circle
              cx="120"
              cy="120"
              r="8"
              fill={`url(#${uid}-metal)`}
            ></circle>
          </g>
        </svg>
      );
    case "gauge":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M40 187a95 95 0 1 1 160 0"
              fill="none"
              stroke="#182a35"
              strokeWidth="18"
            ></path>
            <path
              d="M40 187a95 95 0 0 1 120-135"
              fill="none"
              stroke={`url(#${uid}-metal)`}
              strokeWidth="18"
            ></path>
            <g transform="translate(0 5)">
              <path
                d="M111 134 185 65l-55 86Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="M111 134 185 65l-55 86Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="M111 134 185 65l-55 86Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <circle
              cx="120"
              cy="140"
              r="14"
              fill={`url(#${uid}-metal)`}
            ></circle>
          </g>
        </svg>
      );
    case "corner-brackets":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <path
              d="M21 77V21h56M163 21h56v56M219 163v56h-56M77 219H21v-56"
              fill="none"
              stroke={`url(#${uid}-steel)`}
              strokeWidth="5"
            ></path>
          </g>
        </svg>
      );
    case "burst":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="m120 8 17 69 56-40-30 61 69 22-69 21 30 62-56-40-17 69-18-69-55 40 30-62-69-21 69-22-30-61 55 40Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="m120 8 17 69 56-40-30 61 69 22-69 21 30 62-56-40-17 69-18-69-55 40 30-62-69-21 69-22-30-61 55 40Z"
              fill={`url(#${uid}-metal)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="m120 8 17 69 56-40-30 61 69 22-69 21 30 62-56-40-17 69-18-69-55 40 30-62-69-21 69-22-30-61 55 40Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
          </g>
        </svg>
      );
    case "handshake":
      return (
        <svg
          {...props}
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <g>
            <defs>
              <linearGradient
                id={`${uid}-metal`}
                x1="0"
                y1="0"
                x2=".28"
                y2="1"
                gradientUnits="objectBoundingBox"
              >
                <stop stopColor="currentColor"></stop>
                <stop offset=".48" stopColor="currentColor"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity=".38"
                ></stop>
              </linearGradient>
              <linearGradient id={`${uid}-sheen`} x1="0" y1="0" x2=".7" y2="1">
                <stop stopColor="#fff" stopOpacity=".52"></stop>
                <stop offset=".28" stopColor="#fff" stopOpacity=".08"></stop>
                <stop offset=".52" stopColor="#000" stopOpacity=".08"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".52"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-steel`} x1="0" y1="0" x2=".6" y2="1">
                <stop stopColor="#aebbc7"></stop>
                <stop offset=".48" stopColor="#627482"></stop>
                <stop offset="1" stopColor="#15222d"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-dark`} x1="0" y1="0" x2="0" y2="1">
                <stop stopColor="#20323b"></stop>
                <stop offset="1" stopColor="#080e13"></stop>
              </linearGradient>
              <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
                <stop stopColor="#c4d4df" stopOpacity=".15"></stop>
                <stop offset=".5" stopColor="#b0cad7" stopOpacity=".02"></stop>
                <stop offset="1" stopColor="#000" stopOpacity=".45"></stop>
              </linearGradient>
              <radialGradient id={`${uid}-halo`}>
                <stop stopColor="currentColor" stopOpacity=".15"></stop>
                <stop
                  offset="1"
                  stopColor="currentColor"
                  stopOpacity="0"
                ></stop>
              </radialGradient>
            </defs>
            <g transform="translate(0 5)">
              <path
                d="m20 99 36-52 41 18 32-17 44 18 46 52-46 55-28 19-68-22-39-47Z"
                fill="#000"
                opacity=".65"
              ></path>
            </g>
            <path
              d="m20 99 36-52 41 18 32-17 44 18 46 52-46 55-28 19-68-22-39-47Z"
              fill={`url(#${uid}-steel)`}
              stroke="currentColor"
              strokeWidth="1.2"
            ></path>
            <path
              d="m20 99 36-52 41 18 32-17 44 18 46 52-46 55-28 19-68-22-39-47Z"
              fill={`url(#${uid}-sheen)`}
              stroke="#fff"
              strokeOpacity=".22"
              strokeWidth=".8"
            ></path>
            <path
              d="m97 65-27 37 22 21 36-32 57 63M98 145l36 34M78 165l31 26"
              fill="none"
              stroke="#14242e"
              strokeWidth="6"
            ></path>
          </g>
        </svg>
      );
    default:
      return null;
  }
}
