'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface MetricChipProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
  size?: 'sm' | 'md';
}

export function MetricChip({ label, value, unit, className, size = 'md' }: MetricChipProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center',
        size === 'sm' ? 'px-3 py-2' : 'px-4 py-3',
        className
      )}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '14px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-baseline gap-1">
        <span
          className={cn(
            'font-light tracking-tight',
            size === 'sm' ? 'text-base' : 'text-lg'
          )}
          style={{ color: 'rgba(255,255,255,0.88)' }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-[9px] font-medium tracking-wider"
            style={{ color: 'rgba(255,255,255,0.35)' }}
          >
            {unit}
          </span>
        )}
      </div>
      <span
        className="text-[8px] font-medium tracking-[0.16em] uppercase mt-0.5"
        style={{ color: 'rgba(255,255,255,0.28)' }}
      >
        {label}
      </span>
    </div>
  );
}

/* Inline floating metric pill — used near camera */
export function MetricPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5"
      style={{
        background: 'rgba(7,8,12,0.70)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: '999px',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <span
        className="text-[9px] font-medium tracking-[0.14em] uppercase"
        style={{ color: 'rgba(255,255,255,0.30)' }}
      >
        {label}
      </span>
      <span
        className="text-[11px] font-light"
        style={{ color: 'rgba(255,255,255,0.75)' }}
      >
        {value}
      </span>
    </div>
  );
}
