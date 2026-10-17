'use client';

import React from 'react';
import { motion } from 'framer-motion';

/* ============================================================
   OPTICORE LOGO — SVG mark + wordmark
   The "O" mark is a geometric iris / aperture ring with
   a central lens dot. Clean, premium, AI-vision identity.
   ============================================================ */

interface OpticoreLogoProps {
  /** Size of the SVG mark in px */
  markSize?: number;
  /** Show or hide the text wordmark beside the mark */
  showWordmark?: boolean;
  /** 'row' = mark left, text right | 'column' = mark above, text below */
  layout?: 'row' | 'column';
  /** If true, animate on mount */
  animate?: boolean;
  /** Override gap between mark and text */
  gap?: number;
}

export function OpticoreLogo({
  markSize = 36,
  showWordmark = true,
  layout = 'row',
  animate = true,
  gap,
}: OpticoreLogoProps) {
  const gapSize = gap ?? (layout === 'row' ? 12 : 8);

  const mark = (
    <OpticoreMark size={markSize} animate={animate} />
  );

  const text = showWordmark ? (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: layout === 'row' ? 2 : 3,
        justifyContent: 'center',
      }}
    >
      {/* OPTICORE — spaced, thin */}
      <span
        style={{
          fontSize: markSize * 0.38,
          fontWeight: 300,
          letterSpacing: '0.32em',
          color: 'rgba(255,255,255,0.90)',
          textTransform: 'uppercase',
          lineHeight: 1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        OPTICORE
      </span>

    </div>
  ) : null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layout === 'row' ? 'row' : 'column',
        alignItems: layout === 'row' ? 'center' : 'flex-start',
        gap: gapSize,
      }}
    >
      {mark}
      {text}
    </div>
  );
}

/* ── The SVG mark ────────────────────────────────────────── */
interface OpticoreMarkProps {
  size?: number;
  animate?: boolean;
  className?: string;
}

export function OpticoreMark({ size = 36, animate: doAnimate = true, className }: OpticoreMarkProps) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;

  // Ring radii
  const outerR  = s * 0.47;   // main ring
  const midR    = s * 0.35;   // inner ring
  const dotR    = s * 0.09;   // center lens

  // Aperture blade count and params
  const bladeCount = 6;
  const bladeAngleStep = 360 / bladeCount;

  const blades = Array.from({ length: bladeCount }, (_, i) => {
    const angleDeg = i * bladeAngleStep;
    const angleRad = (angleDeg * Math.PI) / 180;
    const bx = parseFloat((cx + Math.cos(angleRad) * midR * 0.62).toFixed(4));
    const by = parseFloat((cy + Math.sin(angleRad) * midR * 0.62).toFixed(4));
    return { bx, by, angleDeg };
  });

  const tickCount = 36;
  const ticks = Array.from({ length: tickCount }, (_, i) => {
    const angle = (i * 360) / tickCount;
    const rad   = (angle * Math.PI) / 180;
    const isMajor = i % 6 === 0;
    const r1 = outerR + s * 0.035;
    const r2 = r1 + (isMajor ? s * 0.045 : s * 0.022);
    return {
      x1: parseFloat((cx + Math.cos(rad) * r1).toFixed(4)),
      y1: parseFloat((cy + Math.sin(rad) * r1).toFixed(4)),
      x2: parseFloat((cx + Math.cos(rad) * r2).toFixed(4)),
      y2: parseFloat((cy + Math.sin(rad) * r2).toFixed(4)),
      isMajor,
    };
  });

  const svg = (
    <svg
      viewBox={`0 0 ${s} ${s}`}
      width={s}
      height={s}
      className={className}
      aria-label="OptiCore"
      style={{ display: 'block', flexShrink: 0 }}
      suppressHydrationWarning
    >
      {/* ── Outer tick ring ──────────────────────────── */}
      {ticks.map((t, i) => (
        <line
          key={i}
          x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.isMajor ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.08)'}
          strokeWidth={t.isMajor ? 0.8 : 0.6}
          strokeLinecap="round"
        />
      ))}

      {/* ── Main outer ring ──────────────────────────── */}
      <circle
        cx={cx} cy={cy} r={outerR}
        fill="none"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth={s * 0.022}
      />

      {/* ── Outer ring accent arc (top) ──────────────── */}
      <circle
        cx={cx} cy={cy} r={outerR}
        fill="none"
        stroke="url(#oc-arc-grad)"
        strokeWidth={s * 0.022}
        strokeDasharray={`${outerR * Math.PI * 0.55} ${outerR * Math.PI * 1.45}`}
        strokeDashoffset={outerR * Math.PI * 0.275}
        strokeLinecap="round"
      />

      {/* ── Mid inner ring ───────────────────────────── */}
      <circle
        cx={cx} cy={cy} r={midR}
        fill="none"
        stroke="rgba(255,255,255,0.10)"
        strokeWidth={s * 0.016}
      />

      {/* ── Aperture blades ──────────────────────────── */}
      {blades.map((b, i) => (
        <line
          key={i}
          x1={cx} y1={cy}
          x2={b.bx} y2={b.by}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={s * 0.014}
          strokeLinecap="round"
        />
      ))}

      {/* ── Cross-hair lines ─────────────────────────── */}
      <line x1={cx - midR * 0.9} y1={cy} x2={cx + midR * 0.9} y2={cy}
        stroke="rgba(255,255,255,0.07)" strokeWidth={s * 0.010} />
      <line x1={cx} y1={cy - midR * 0.9} x2={cx} y2={cy + midR * 0.9}
        stroke="rgba(255,255,255,0.07)" strokeWidth={s * 0.010} />

      {/* ── Center lens glow ─────────────────────────── */}
      <circle
        cx={cx} cy={cy} r={dotR * 2.2}
        fill="rgba(155,138,251,0.10)"
      />
      <circle
        cx={cx} cy={cy} r={dotR * 1.4}
        fill="rgba(155,138,251,0.20)"
      />
      <circle
        cx={cx} cy={cy} r={dotR}
        fill="rgba(155,138,251,0.90)"
      />

      {/* ── Highlight on lens ────────────────────────── */}
      <circle
        cx={cx - dotR * 0.35} cy={cy - dotR * 0.35} r={dotR * 0.32}
        fill="rgba(255,255,255,0.60)"
      />

      {/* ── Gradient def ─────────────────────────────── */}
      <defs>
        <linearGradient id="oc-arc-grad" x1="0" y1="0" x2="1" y2="0"
          gradientUnits="objectBoundingBox">
          <stop offset="0%"   stopColor="#9B8AFB" stopOpacity="0.80" />
          <stop offset="50%"  stopColor="#6FA8FF" stopOpacity="0.90" />
          <stop offset="100%" stopColor="#9B8AFB" stopOpacity="0.40" />
        </linearGradient>
      </defs>
    </svg>
  );

  if (!doAnimate) return svg;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85, rotate: -15 }}
      animate={{ opacity: 1, scale: 1,    rotate: 0   }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      style={{ display: 'flex' }}
    >
      {svg}
    </motion.div>
  );
}
