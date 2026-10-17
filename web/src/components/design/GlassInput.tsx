'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface GlassInputProps {
  label?: string;
  type?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  required?: boolean;
  autoComplete?: string;
}

export function GlassInput({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  className,
  required,
  autoComplete,
}: GlassInputProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <label
          className="text-[10px] font-medium tracking-[0.18em] uppercase"
          style={{ color: 'rgba(255,255,255,0.35)' }}
        >
          {label}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        autoComplete={autoComplete}
        className="w-full outline-none text-[13px] font-light py-3 px-4 rounded-[14px] transition-all duration-200"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(139,92,246,0.45)';
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(109,40,217,0.12), inset 0 1px 0 rgba(255,255,255,0.04)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
          e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04)';
        }}
      />
    </div>
  );
}
