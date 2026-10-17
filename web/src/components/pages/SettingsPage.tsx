'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getApiBase, getWsBase, setServerUrl } from '@/lib/api';

/* ── Shared Glass Panel ──────────────────────────────────────────────────── */
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
      transition={{ duration: 0.35, ease: 'easeOut', delay }}
      style={{
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: '15%',
          right: '15%',
          height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </motion.div>
  );
}

function SectionLabel({ label, color }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14 }}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: color ?? 'var(--oc-accent)',
          boxShadow: `0 0 6px ${color ?? 'var(--oc-accent)'}`,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.22em',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          textShadow: '0 1px 3px rgba(0,0,0,0.5)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function SettingsPage() {
  const [apiUrl, setApiUrl] = useState('');
  const [wsUrl, setWsUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latencyMs?: number;
  } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setApiUrl(getApiBase());
    setWsUrl(getWsBase());
  }, []);

  const handleApiUrlChange = (val: string) => {
    setApiUrl(val);
    const trimmed = val.trim();
    if (trimmed.startsWith('https://')) {
      setWsUrl(trimmed.replace(/^https:\/\//, 'wss://'));
    } else if (trimmed.startsWith('http://')) {
      setWsUrl(trimmed.replace(/^http:\/\//, 'ws://'));
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();
    try {
      const cleanUrl = apiUrl.trim().replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/health`, { signal: AbortSignal.timeout(5000) });
      const elapsed = Math.round(performance.now() - start);
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setTestResult({
          success: true,
          message: `Connected! Version: ${data.version || '1.0.0'} (YOLO ${data.model_status || 'ready'})`,
          latencyMs: elapsed,
        });
      } else {
        setTestResult({
          success: false,
          message: `Server returned HTTP ${res.status}`,
          latencyMs: elapsed,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err?.message || 'Server unreachable. Verify Ngrok tunnel or local backend.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    setServerUrl(apiUrl, wsUrl);
    setSavedSuccess(true);
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  const handleSetLocalhost = () => {
    setApiUrl('http://localhost:8000');
    setWsUrl('ws://localhost:8000');
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        paddingBottom: 24,
      }}
      className="page-enter"
    >
      <div style={{ marginBottom: 18 }}>
        <h2
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.26em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        >
          System Configuration
        </h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 14,
          alignItems: 'start',
        }}
      >
        {/* Left Column: Server Connection Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GlassPanel delay={0.05}>
            <SectionLabel label="Backend Server Connection" />

            <p
              style={{
                fontSize: 11,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Configure the OptiCore backend host. When testing remotely or via Vercel, enter your public{' '}
              <strong style={{ color: 'var(--oc-accent)' }}>Ngrok HTTPS</strong> URL below.
            </p>

            {/* API URL Input */}
            <div style={{ marginBottom: 14 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                REST API Base URL
              </label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => handleApiUrlChange(e.target.value)}
                placeholder="e.g. https://xxxx.ngrok-free.dev or http://localhost:8000"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: '#F5F7FA',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>

            {/* WebSocket URL Input */}
            <div style={{ marginBottom: 16 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 9,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                WebSocket Live Stream URL
              </label>
              <input
                type="text"
                value={wsUrl}
                onChange={(e) => setWsUrl(e.target.value)}
                placeholder="e.g. wss://xxxx.ngrok-free.dev or ws://localhost:8000"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 12,
                  color: '#9B8AFB',
                  fontSize: 12,
                  fontFamily: 'monospace',
                  outline: 'none',
                }}
              />
            </div>

            {/* Quick Preset Buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                onClick={handleSetLocalhost}
                style={{
                  padding: '6px 12px',
                  fontSize: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8,
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Default Localhost (:8000)
              </button>
            </div>

            {/* Connection Test Result Banner */}
            {testResult && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  marginBottom: 16,
                  background: testResult.success
                    ? 'rgba(114,214,163,0.12)'
                    : 'rgba(228,125,135,0.12)',
                  border: `1px solid ${
                    testResult.success
                      ? 'rgba(114,214,163,0.30)'
                      : 'rgba(228,125,135,0.30)'
                  }`,
                  color: testResult.success ? '#72D6A3' : '#E47D87',
                  fontSize: 11,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{testResult.message}</span>
                {testResult.latencyMs !== undefined && (
                  <span style={{ fontSize: 9, opacity: 0.8 }}>{testResult.latencyMs}ms</span>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting}
                style={{
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 12,
                  color: '#FFFFFF',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  cursor: isTesting ? 'wait' : 'pointer',
                }}
              >
                {isTesting ? 'Testing…' : '⚡ Test Connection'}
              </button>

              <button
                type="button"
                onClick={handleSave}
                style={{
                  padding: '10px 20px',
                  background: savedSuccess
                    ? 'linear-gradient(135deg, #72D6A3, #5CE1E6)'
                    : 'linear-gradient(135deg, #9B8AFB, #6FA8FF)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#080A10',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '0 0 20px rgba(155,138,251,0.35)',
                }}
              >
                {savedSuccess ? '✓ Saved (Reloading…)' : 'Save & Connect'}
              </button>
            </div>
          </GlassPanel>
        </div>

        {/* Right Column: Connection Guide & Architecture */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <GlassPanel delay={0.10}>
            <SectionLabel label="Connecting from Anywhere" color="var(--oc-accent-2)" />

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <h4 style={{ color: '#F5F7FA', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                1. Local Machine Access
              </h4>
              <p style={{ marginBottom: 12 }}>
                When running the web dashboard on the same PC as Docker, keep the default{' '}
                <code style={{ color: 'var(--oc-accent)' }}>http://localhost:8000</code>.
              </p>

              <h4 style={{ color: '#F5F7FA', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                2. Remote & Vercel Web Deployment
              </h4>
              <p style={{ marginBottom: 12 }}>
                When your frontend is hosted on Vercel or accessed on mobile, copy the{' '}
                <strong style={{ color: '#72D6A3' }}>Ngrok Public URL</strong> printed in your backend
                terminal (e.g.{' '}
                <code style={{ color: 'var(--oc-accent)' }}>https://xxxx.ngrok-free.dev</code>) and paste it into
                the input on the left.
              </p>

              <h4 style={{ color: '#F5F7FA', fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                3. Permanent Vercel Config
              </h4>
              <p style={{ marginBottom: 6 }}>
                In your Vercel Project Settings &gt; Environment Variables, add:
              </p>
              <pre
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  padding: 8,
                  borderRadius: 8,
                  fontSize: 9,
                  color: '#6FA8FF',
                  overflowX: 'auto',
                }}
              >
                NEXT_PUBLIC_API_URL=https://xxxx.ngrok-free.dev{'\n'}
                NEXT_PUBLIC_WS_URL=wss://xxxx.ngrok-free.dev
              </pre>
            </div>
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
