'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type GlassPanelVariant = 'dim' | 'default' | 'bright' | 'camera';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: GlassPanelVariant;
  radius?: 'sm' | 'md' | 'lg' | 'xl';
  onClick?: () => void;
  style?: React.CSSProperties;
}

const variantClass: Record<GlassPanelVariant, string> = {
  dim:     'glass-dim',
  default: 'glass',
  bright:  'glass-bright',
  camera:  'glass-camera',
};

const radiusClass = {
  sm:  'rounded-[12px]',
  md:  'rounded-[18px]',
  lg:  'rounded-[24px]',
  xl:  'rounded-[32px]',
};

export function GlassPanel({
  children,
  className,
  variant = 'default',
  radius = 'lg',
  onClick,
  style,
}: GlassPanelProps) {
  return (
    <div
      className={cn(variantClass[variant], radiusClass[radius], 'relative overflow-hidden', className)}
      onClick={onClick}
      style={style}
    >
      {/* Subtle top-edge highlight — inner glass reflection */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />
      <div style={{ position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  );
}
