'use client';

import React from 'react';
import { motion } from 'framer-motion';

/* ============================================================
   GlassCard — small floating glass information card
   Used for MODEL, PERFORMANCE, SYSTEM info panels
   ============================================================ */

interface GlassCardProps {
  title: string;
  children: React.ReactNode;
  accentColor?: string;
  className?: string;
  style?: React.CSSProperties;
  animate?: boolean;
  delay?: number;
}

export function GlassCard({
  title,
  children,
  accentColor = 'var(--oc-accent)',
  className,
  style,
  animate = true,
  delay = 0,
}: GlassCardProps) {
  const content = (
    <div
      className={className}
      style={{
        background: 'rgba(255,255,255,0.055)',
        backdropFilter: 'blur(24px) saturate(180%)',
        WebkitBackdropFilter: 'blur(24px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.07)',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {/* Top highlight reflection */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '15%',
          right: '15%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.11), transparent)',
          pointerEvents: 'none',
        }}
      />

      {/* Card header */}
      <div
        style={{
          padding: '14px 16px 0 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          marginBottom: 10,
        }}
      >
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 600,
            letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.32)',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </span>
      </div>

      {/* Card body */}
      <div style={{ padding: '0 16px 14px 16px' }}>
        {children}
      </div>
    </div>
  );

  if (!animate) return content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut', delay }}
    >
      {content}
    </motion.div>
  );
}

/* ── DataRow — label / value pair used in GlassCard ──────── */
export function CardRow({
  label,
  value,
  accent = false,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  accent?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="data-row">
      <span className="data-row-label">{label}</span>
      <span
        className={accent ? 'data-row-value data-row-value-accent' : 'data-row-value'}
        style={mono ? { fontFamily: 'monospace', letterSpacing: '0.05em' } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

/* ── MetricRow — large number with unit + label ──────────── */
export function MetricRow({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 0',
        borderBottom: '1px solid rgba(255,255,255,0.045)',
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.30)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 200,
            letterSpacing: '-0.01em',
            color: accent ? 'var(--oc-accent)' : 'rgba(255,255,255,0.85)',
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              letterSpacing: '0.10em',
              color: 'rgba(255,255,255,0.30)',
              textTransform: 'uppercase',
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── StatusRow — dot + label + state ─────────────────────── */
export function StatusRow({
  label,
  state,
}: {
  label: string;
  state: 'online' | 'offline' | 'standby' | 'loading';
}) {
  const dotClass: Record<string, string> = {
    online:  'hud-dot-online animate-pulse-glow',
    offline: 'hud-dot-offline',
    standby: 'hud-dot-standby animate-pulse-glow',
    loading: 'hud-dot-loading animate-live-pulse',
  };
  const stateLabel: Record<string, string> = {
    online:  'Online',
    offline: 'Offline',
    standby: 'Standby',
    loading: 'Loading',
  };
  const stateColor: Record<string, string> = {
    online:  'var(--status-online)',
    offline: 'var(--status-offline)',
    standby: 'var(--status-standby)',
    loading: 'var(--status-loading)',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '9px 0',
        borderBottom: '1px solid rgba(255,255,255,0.045)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className={dotClass[state]} />
        <span
          style={{
            fontSize: 11,
            fontWeight: 300,
            color: 'rgba(255,255,255,0.60)',
            letterSpacing: '0.03em',
          }}
        >
          {label}
        </span>
      </div>
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.16em',
          color: stateColor[state],
          textTransform: 'uppercase',
          opacity: 0.80,
        }}
      >
        {stateLabel[state]}
      </span>
    </div>
  );
}
