"use client";

import React, { useState } from "react";

/**
 * IPA brand mark as inline vector paths, rebuilt geometrically from the original raster logo.
 * Paths are split into "IP" and "A" so the sidebar can reveal "IP" next to the "A".
 */

export const IPA_LOGO_VIEWBOX = "1 1 597.2 244";
export const IPA_LOGO_ASPECT = 597.2 / 244;

const I_PATH = "M4.1 1H64Q67 1 67 4V242Q67 245 64 245H4.1Q1.1 245 1.1 242V4Q1.1 1 4.1 1Z";

const P_OUTER_PATH =
  "M125.6 1H284A77.5 73 0 0 1 361.5 74C361.5 92 356.9 95 349.3 112L335.9 142C332.3 150 301 165.9 283 165.9H187V242Q187 245 184 245H125.6Q122.6 245 122.6 242V4Q122.6 1 125.6 1Z";

const P_INNER_PATH = "M187 56V111H270A28 27.5 0 0 0 270 56Z";

const P_PATH = P_OUTER_PATH + P_INNER_PATH;

const A_PATH =
  "M424.6 1H484.9Q487.6 1 488.8 3.6L597.2 245H527.8L454.25 70.9L380.8 245H313L420.6 3.6Q421.8 1 424.6 1Z";

interface IpaLogoProps {
  className?: string;
  /** Extra classes for the "IP" group (used to animate it independently from the "A"). */
  ipClassName?: string;
  title?: string;
  /** Enables the continuous stroke-draw + fill loop animation (used on the login screen). */
  animated?: boolean;
}

export default function IpaLogo({
  className,
  ipClassName,
  title = "IPA",
  animated = false,
}: IpaLogoProps) {
  const [cycle, setCycle] = useState(0);

  if (!animated) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={IPA_LOGO_VIEWBOX}
        fill="currentColor"
        role="img"
        aria-label={title}
        className={className}
      >
        <g className={ipClassName}>
          <path d={I_PATH} />
          <path d={P_PATH} fillRule="evenodd" />
        </g>
        <path d={A_PATH} />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={IPA_LOGO_VIEWBOX}
      fill="currentColor"
      role="img"
      aria-label={title}
      className={`${className ?? ""} overflow-visible`}
    >
      <style>{`
        .ipa-f {
          animation: ipaFill 0.8s ease-out var(--fd) both;
        }
        .ipa-s {
          fill: none;
          stroke: currentColor;
          stroke-width: 2.8;
          stroke-dasharray: var(--L) var(--L);
          stroke-dashoffset: var(--L);
          animation:
            ipaDraw var(--dur) cubic-bezier(0.65, 0, 0.35, 1) var(--dl) both,
            ipaFade 0.8s ease-out var(--fd) both;
        }
        .ipa-cycle {
          animation: ipaCycleOut 0.65s ease-in-out 4.8s both;
        }
        @keyframes ipaDraw {
          from { stroke-dashoffset: var(--L); }
          to { stroke-dashoffset: 0; }
        }
        @keyframes ipaFade {
          from { stroke-opacity: 1; }
          to { stroke-opacity: 0; }
        }
        @keyframes ipaFill {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ipaCycleOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ipa-f, .ipa-s, .ipa-cycle {
            animation: none !important;
          }
        }
      `}</style>
      <g
        key={cycle}
        className="ipa-cycle"
        onAnimationEnd={(e) => {
          if (e.animationName === "ipaCycleOut") {
            setCycle((c) => c + 1);
          }
        }}
      >
        {/* Solid Fill Layers */}
        <g className={ipClassName}>
          <path
            className="ipa-f"
            d={I_PATH}
            style={{ "--fd": "0.8s" } as React.CSSProperties}
          />
          <path
            className="ipa-f"
            d={P_PATH}
            fillRule="evenodd"
            style={{ "--fd": "1.65s" } as React.CSSProperties}
          />
        </g>
        <path
          className="ipa-f"
          d={A_PATH}
          style={{ "--fd": "2.45s" } as React.CSSProperties}
        />

        {/* Animated Stroke Layers */}
        <path
          className="ipa-s"
          d={I_PATH}
          style={
            {
              "--L": 620,
              "--dl": "0.2s",
              "--dur": "0.7s",
              "--fd": "0.8s",
            } as React.CSSProperties
          }
        />
        <path
          className="ipa-s"
          d={P_OUTER_PATH}
          style={
            {
              "--L": 900,
              "--dl": "0.65s",
              "--dur": "1.1s",
              "--fd": "1.65s",
            } as React.CSSProperties
          }
        />
        <path
          className="ipa-s"
          d={P_INNER_PATH}
          style={
            {
              "--L": 320,
              "--dl": "1.2s",
              "--dur": "0.5s",
              "--fd": "1.65s",
            } as React.CSSProperties
          }
        />
        <path
          className="ipa-s"
          d={A_PATH}
          style={
            {
              "--L": 1120,
              "--dl": "1.2s",
              "--dur": "1.35s",
              "--fd": "2.45s",
            } as React.CSSProperties
          }
        />
      </g>
    </svg>
  );
}
