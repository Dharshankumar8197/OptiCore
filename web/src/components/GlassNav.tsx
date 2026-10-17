'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type NavPage = 'DASHBOARD' | 'MODEL' | 'CONNECTIVITY' | 'SETTINGS';
export const NAV_PAGES: NavPage[] = ['DASHBOARD', 'MODEL', 'CONNECTIVITY', 'SETTINGS'];

interface GlassNavProps {
  active: NavPage;
  onChange: (page: NavPage) => void;
}

/* ── Icons — thin SVG, 13×13 ───────────────────────────────────────────────── */
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  );
}

function ModelIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}

function ConnectivityIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12.55a11 11 0 0114.08 0"/>
      <path d="M1.42 9a16 16 0 0121.16 0"/>
      <path d="M8.53 16.11a6 6 0 016.95 0"/>
      <circle cx="12" cy="20" r="1" fill="currentColor"/>
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  );
}

const PAGE_ICONS: Record<NavPage, React.ReactNode> = {
  DASHBOARD:    <DashboardIcon />,
  MODEL:        <ModelIcon />,
  CONNECTIVITY: <ConnectivityIcon />,
  SETTINGS:     <SettingsIcon />,
};

const PAGE_LABELS: Record<NavPage, string> = {
  DASHBOARD:    'Dashboard',
  MODEL:        'Model',
  CONNECTIVITY: 'Connectivity',
  SETTINGS:     'Settings',
};

export function GlassNav({ active, onChange }: GlassNavProps) {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut', delay: 0.15 }}
      className="glass-nav"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: '5px 5px',
        borderRadius: 'var(--radius-full)',
      }}
      role="navigation"
      aria-label="Main navigation"
    >
      {NAV_PAGES.map((page) => (
        <NavItem
          key={page}
          page={page}
          isActive={page === active}
          icon={PAGE_ICONS[page]}
          label={PAGE_LABELS[page]}
          onClick={() => onChange(page)}
        />
      ))}
    </motion.nav>
  );
}

interface NavItemProps {
  page: NavPage;
  isActive: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}

function NavItem({ isActive, icon, label, onClick }: NavItemProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 14px',
        borderRadius: 'var(--radius-full)',
        border: isActive ? '1px solid rgba(255,255,255,0.15)' : '1px solid transparent',
        background: isActive ? 'rgba(255,255,255,0.105)' : 'transparent',
        boxShadow: isActive
          ? '0 4px 16px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.10)'
          : 'none',
        cursor: 'pointer',
        color: isActive ? '#F5F7FA' : 'rgba(255,255,255,0.45)',
        transition: 'color 0.18s ease, background 0.18s ease, border-color 0.18s ease',
        outline: 'none',
        whiteSpace: 'nowrap',
        userSelect: 'none',
        fontSize: 11,
        fontWeight: isActive ? 500 : 400,
        letterSpacing: '0.08em',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.75)';
          (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.45)';
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        }
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.75 }}>
        {icon}
      </span>
      <span>{label}</span>

      <AnimatePresence>
        {isActive && (
          <motion.span
            key="dot"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              width: 3,
              height: 3,
              borderRadius: '50%',
              background: 'var(--oc-accent)',
              boxShadow: '0 0 5px var(--oc-accent)',
              marginLeft: 1,
              flexShrink: 0,
            }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  );
}
