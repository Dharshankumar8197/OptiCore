'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type GlassButtonVariant = 'default' | 'primary' | 'ghost' | 'danger';
type GlassButtonSize = 'xs' | 'sm' | 'md' | 'lg';

interface GlassButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  style?: React.CSSProperties;
}

const sizeStyles: Record<GlassButtonSize, React.CSSProperties> = {
  xs: { padding: '4px 10px',  fontSize: 9,  letterSpacing: '0.14em', borderRadius: 'var(--radius-full)' },
  sm: { padding: '6px 14px',  fontSize: 10, letterSpacing: '0.13em', borderRadius: 'var(--radius-full)' },
  md: { padding: '9px 20px',  fontSize: 11, letterSpacing: '0.12em', borderRadius: 'var(--radius-full)' },
  lg: { padding: '12px 28px', fontSize: 12, letterSpacing: '0.12em', borderRadius: 'var(--radius-full)' },
};

const variantStyles: Record<GlassButtonVariant, React.CSSProperties> = {
  default: {
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.72)',
  },
  primary: {
    background: 'rgba(155,138,251,0.18)',
    border: '1px solid rgba(155,138,251,0.32)',
    color: 'rgba(155,138,251,0.95)',
  },
  ghost: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.09)',
    color: 'rgba(255,255,255,0.48)',
  },
  danger: {
    background: 'rgba(228,125,135,0.12)',
    border: '1px solid rgba(228,125,135,0.28)',
    color: 'rgba(228,125,135,0.85)',
  },
};

export function GlassButton({
  children,
  className,
  onClick,
  variant = 'default',
  size = 'md',
  disabled = false,
  type = 'button',
  style,
}: GlassButtonProps) {
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.96 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      className={cn(
        'font-medium uppercase cursor-pointer',
        'backdrop-blur-md',
        'disabled:opacity-35 disabled:cursor-not-allowed',
        'inline-flex items-center justify-center gap-2',
        className
      )}
      style={{
        ...sizeStyles[size],
        ...variantStyles[variant],
        boxShadow: '0 4px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.06)',
        outline: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </motion.button>
  );
}
