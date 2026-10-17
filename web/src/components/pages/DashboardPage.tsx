'use client';

import React from 'react';
import { motion } from 'framer-motion';

/* ── Types ────────────────────────────────────────────────────────────────── */
export interface DashboardSystemState {
  // Backend / model
  backendOnline: boolean;
  modelLoaded: boolean;
  inferenceRunning: boolean;
  cameraConnected: boolean;
  // Wi-Fi
  wifiConnected: boolean;
  wifiSsid: string | null;
  wifiIp: string | null;
  // Bluetooth
  bluetoothAdapterAvailable: boolean;
  // USB
  usbDeviceCount: number;
  // Power
  batteryPercent: number | null;
  batteryPlugged: boolean | null;
  // Performance
  fps: number | null;
  latency: number | null;
  cpu: number | null;
  ram: number | null;
  detectionCount: number | null;
}

interface DashboardPageProps {
  state: DashboardSystemState;
}

/* ── Shared panel wrapper ─────────────────────────────────────────────────── */
function GlassPanel({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut', delay }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        padding: '20px 22px',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {/* top reflection line */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </motion.div>
  );
}

/* ── Section label ────────────────────────────────────────────────────────── */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16,
    }}>
      <span style={{
        width: 4, height: 4, borderRadius: '50%',
        background: 'var(--oc-accent)',
        boxShadow: '0 0 6px var(--oc-accent)',
        flexShrink: 0,
      }} />
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: '0.22em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
      }}>
        {children}
      </span>
    </div>
  );
}

/* ── Status row ───────────────────────────────────────────────────────────── */
type DotState = 'online' | 'offline' | 'standby' | 'loading';

function statusDotColor(s: DotState) {
  switch (s) {
    case 'online':  return 'var(--status-online)';
    case 'offline': return 'var(--status-offline)';
    case 'standby': return 'var(--status-standby)';
    case 'loading': return 'var(--status-loading)';
  }
}

function StatusRow({
  label,
  value,
  dotState,
  sub,
}: {
  label: string;
  value: string;
  dotState: DotState;
  sub?: string;
}) {
  const color = statusDotColor(dotState);
  const isActive = dotState === 'online' || dotState === 'standby';

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '9px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 500, letterSpacing: '0.14em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
        textShadow: '0 1px 3px rgba(0,0,0,0.4)',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, textAlign: 'right' }}>
        {sub && (
          <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
            {sub}
          </span>
        )}
        <span style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
        }}>
          {value}
        </span>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: color,
          boxShadow: isActive ? `0 0 7px ${color}` : 'none',
          flexShrink: 0,
        }} />
      </div>
    </div>
  );
}

/* ── Metric card ──────────────────────────────────────────────────────────── */
function MetricCard({
  label,
  value,
  unit,
  accent,
  delay,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, delay: delay ?? 0 }}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span style={{
        fontSize: 8.5, fontWeight: 600, letterSpacing: '0.20em',
        color: 'var(--text-muted)', textTransform: 'uppercase',
      }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{
          fontSize: 22, fontWeight: 200, letterSpacing: '-0.01em',
          color: accent ?? 'var(--text-primary)',
          textShadow: '0 1px 8px rgba(0,0,0,0.4)',
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.08em' }}>
            {unit}
          </span>
        )}
      </div>
    </motion.div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function unavailable(v: unknown): boolean {
  return v === null || v === undefined;
}

function fmt(v: number | null | undefined, decimals = 0): string {
  if (unavailable(v)) return 'UNAVAILABLE';
  return (v as number).toFixed(decimals);
}

/* ── Main component ───────────────────────────────────────────────────────── */
export function DashboardPage({ state }: DashboardPageProps) {
  // Wi-Fi sub-label
  const wifiSub = state.wifiConnected && state.wifiSsid
    ? state.wifiSsid
    : undefined;

  // Power value
  let powerValue = 'UNAVAILABLE';
  let powerSub: string | undefined;
  if (!unavailable(state.batteryPercent)) {
    powerValue = `${state.batteryPercent?.toFixed(0)}%`;
    powerSub = state.batteryPlugged ? 'AC' : 'Battery';
  }

  return (
    <div
      style={{
        flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 12,
      }}
      className="page-enter"
    >
      {/* Page heading */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{
          fontSize: 10, fontWeight: 600, letterSpacing: '0.26em',
          color: 'var(--text-muted)', textTransform: 'uppercase',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
        }}>
          System Overview
        </h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 14,
        alignItems: 'start',
      }}>

        {/* ── LEFT column ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* System status panel */}
          <GlassPanel delay={0.05}>
            <SectionLabel>System Status</SectionLabel>
            <StatusRow
              label="Backend"
              value={state.backendOnline ? 'Online' : 'Offline'}
              dotState={state.backendOnline ? 'online' : 'offline'}
            />
            <StatusRow
              label="Model"
              value={state.modelLoaded ? 'Loaded' : 'Not Loaded'}
              dotState={state.modelLoaded ? 'online' : 'offline'}
            />
            <StatusRow
              label="Inference"
              value={state.inferenceRunning ? 'Running' : 'Stopped'}
              dotState={state.inferenceRunning ? 'standby' : 'offline'}
            />
            <StatusRow
              label="Camera"
              value={state.cameraConnected ? 'Connected' : 'Disconnected'}
              dotState={state.cameraConnected ? 'online' : 'offline'}
            />
          </GlassPanel>

          {/* Connectivity status panel */}
          <GlassPanel delay={0.10}>
            <SectionLabel>Connectivity</SectionLabel>
            <StatusRow
              label="Wi-Fi"
              value={state.wifiConnected ? 'Connected' : 'Disconnected'}
              dotState={state.wifiConnected ? 'online' : 'offline'}
              sub={wifiSub}
            />
            {state.wifiConnected && state.wifiIp && (
              <div style={{
                padding: '6px 0',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.10em', textTransform: 'uppercase' }}>IP Address</span>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', letterSpacing: '0.04em' }}>{state.wifiIp}</span>
              </div>
            )}
            <StatusRow
              label="Bluetooth"
              value={state.bluetoothAdapterAvailable ? 'Available' : 'Unavailable'}
              dotState={state.bluetoothAdapterAvailable ? 'online' : 'offline'}
            />
            <StatusRow
              label="USB Devices"
              value={String(state.usbDeviceCount)}
              dotState={state.usbDeviceCount > 0 ? 'online' : 'standby'}
            />
          </GlassPanel>

          {/* Power panel */}
          <GlassPanel delay={0.15}>
            <SectionLabel>Power</SectionLabel>
            <StatusRow
              label="Battery"
              value={powerValue}
              dotState={
                unavailable(state.batteryPercent)
                  ? 'offline'
                  : (state.batteryPercent! > 20 ? 'online' : 'standby')
              }
              sub={powerSub}
            />
          </GlassPanel>
        </div>

        {/* ── RIGHT column ────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Performance metrics */}
          <GlassPanel delay={0.07}>
            <SectionLabel>Performance</SectionLabel>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              marginTop: 4,
            }}>
              <MetricCard
                label="FPS"
                value={unavailable(state.fps) ? '—' : fmt(state.fps, 1)}
                unit={unavailable(state.fps) ? undefined : 'fps'}
                accent="var(--oc-accent)"
                delay={0.10}
              />
              <MetricCard
                label="Latency"
                value={unavailable(state.latency) ? '—' : fmt(state.latency, 1)}
                unit={unavailable(state.latency) ? undefined : 'ms'}
                accent="var(--oc-accent-2)"
                delay={0.12}
              />
              <MetricCard
                label="CPU"
                value={unavailable(state.cpu) ? '—' : fmt(state.cpu, 0)}
                unit={unavailable(state.cpu) ? undefined : '%'}
                delay={0.14}
              />
              <MetricCard
                label="RAM"
                value={unavailable(state.ram) ? '—' : fmt(state.ram, 0)}
                unit={unavailable(state.ram) ? undefined : '%'}
                delay={0.16}
              />
            </div>
          </GlassPanel>

          {/* Detections */}
          <GlassPanel delay={0.12}>
            <SectionLabel>Detections</SectionLabel>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '12px 0',
            }}>
              <span style={{
                fontSize: 48, fontWeight: 100, letterSpacing: '-0.02em',
                color: 'var(--text-primary)',
                textShadow: '0 2px 16px rgba(155,138,251,0.3)',
                lineHeight: 1,
              }}>
                {unavailable(state.detectionCount) ? '—' : state.detectionCount}
              </span>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '0.20em',
                color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 6,
              }}>
                {state.inferenceRunning ? 'Objects Detected' : 'Inference Stopped'}
              </span>
            </div>
          </GlassPanel>

          {/* Quick links */}
          <GlassPanel delay={0.18}>
            <SectionLabel>Quick Access</SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: 'Open Model', hint: 'Run YOLO inference', page: 'MODEL' },
                { label: 'Connectivity', hint: 'Manage devices', page: 'CONNECTIVITY' },
                { label: 'Settings', hint: 'Configure system', page: 'SETTINGS' },
              ].map((item) => (
                <div
                  key={item.page}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: 'rgba(255,255,255,0.035)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12,
                    cursor: 'default',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-primary)', letterSpacing: '0.04em' }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: 2 }}>
                      {item.hint}
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.22)' }}>›</span>
                </div>
              ))}
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
