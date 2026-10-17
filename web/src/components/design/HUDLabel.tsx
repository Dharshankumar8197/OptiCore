'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface HUDLabelProps {
  text: string;
  sub?: string;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export function HUDLabel({ text, sub, className, align = 'left' }: HUDLabelProps) {
  return (
    <div
      className={cn(
        'flex flex-col',
        align === 'right' && 'items-end',
        align === 'center' && 'items-center',
        className
      )}
    >
      <span
        className="text-[10px] font-medium tracking-[0.18em] uppercase leading-none"
        style={{ color: 'rgba(255,255,255,0.55)' }}
      >
        {text}
      </span>
      {sub && (
        <span
          className="text-[9px] font-normal tracking-[0.12em] mt-0.5 uppercase"
          style={{ color: 'rgba(255,255,255,0.28)' }}
        >
          {sub}
        </span>
      )}
    </div>
  );
}

/* Live badge */
export function LiveBadge({ active = true }: { active?: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          'w-[6px] h-[6px] rounded-full',
          active ? 'bg-[rgba(134,239,172,0.85)] animate-live-pulse' : 'bg-[rgba(248,113,113,0.85)]'
        )}
        style={active ? { boxShadow: '0 0 6px rgba(134,239,172,0.6)' } : {}}
      />
      <span
        className="text-[9px] font-medium tracking-[0.20em] uppercase"
        style={{ color: active ? 'rgba(134,239,172,0.75)' : 'rgba(248,113,113,0.65)' }}
      >
        {active ? 'LIVE' : 'OFFLINE'}
      </span>
    </div>
  );
}

/* Data row used in panels */
export function DataRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className="flex items-center justify-between py-2.5"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
    >
      <span
        className="text-[10px] font-medium tracking-[0.14em] uppercase"
        style={{ color: 'rgba(255,255,255,0.30)' }}
      >
        {label}
      </span>
      <span
        className="text-[13px] font-light tracking-wide"
        style={{ color: accent ? 'rgba(167,139,250,0.90)' : 'rgba(255,255,255,0.75)' }}
      >
        {value}
      </span>
    </div>
  );
}
