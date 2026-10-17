'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type StatusState = 'online' | 'offline' | 'standby' | 'loading';

interface GlassStatusProps {
  label: string;
  state: StatusState;
  className?: string;
  showLabel?: boolean;
}

const dotClass: Record<StatusState, string> = {
  online:  'hud-dot-online animate-pulse-glow',
  offline: 'hud-dot-offline',
  standby: 'hud-dot-standby animate-pulse-glow',
  loading: 'hud-dot-standby animate-live-pulse',
};

const stateText: Record<StatusState, string> = {
  online:  'Online',
  offline: 'Offline',
  standby: 'Standby',
  loading: 'Loading',
};

export function GlassStatus({ label, state, className, showLabel = true }: GlassStatusProps) {
  return (
    <div className={cn('hud-chip', className)}>
      <span className={dotClass[state]} />
      {showLabel && (
        <span
          className="text-[9px] font-medium tracking-[0.12em] uppercase"
          style={{ color: 'rgba(255,255,255,0.45)' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* Compact status dot — just a circle + label stacked */
export function StatusRow({
  label,
  state,
  value,
}: {
  label: string;
  state: StatusState;
  value?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2.5">
        <span className={dotClass[state]} />
        <span className="text-label" style={{ color: 'rgba(255,255,255,0.38)' }}>
          {label}
        </span>
      </div>
      {value && (
        <span
          className="text-[11px] font-light tracking-wider"
          style={{ color: 'rgba(255,255,255,0.65)' }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
