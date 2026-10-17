'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AtmosphericBackground } from '@/components/AtmosphericBackground';
import { GlassInput } from '@/components/design/GlassInput';
import { GlassButton } from '@/components/design/GlassButton';
import { OpticoreMark } from '@/components/OpticoreLogo';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function LoginPage() {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? 'Invalid credentials');
      }
      const data = await res.json() as { access_token: string };
      localStorage.setItem('oc_token', data.access_token);
      window.location.href = '/';
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AtmosphericBackground />

      <div
        style={{
          position: 'relative',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          padding: '0 16px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '48px 40px 40px',
            background: 'rgba(255,255,255,0.058)',
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.11)',
            borderRadius: 32,
            boxShadow: '0 40px 100px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.09)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top reflection */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', top: 0, left: '12%', right: '12%', height: 1,
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
              pointerEvents: 'none',
            }}
          />

          {/* Wordmark */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 36 }}>
            {/* Mark */}
            <OpticoreMark size={48} animate />
            <div style={{ height: 10 }} />
            <span
              style={{
                fontSize: 18,
                fontWeight: 200,
                letterSpacing: '0.38em',
                color: 'rgba(255,255,255,0.92)',
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              OPTICORE
            </span>
            <span
              style={{
                fontSize: 8,
                fontWeight: 500,
                letterSpacing: '0.30em',
                color: 'rgba(255,255,255,0.24)',
                textTransform: 'uppercase',
                marginTop: 3,
              }}
            >
              VISION LAB
            </span>
            <div
              style={{
                width: 40, height: 1,
                background: 'linear-gradient(90deg, transparent, rgba(155,138,251,0.50), transparent)',
                margin: '14px 0 6px',
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 300,
                letterSpacing: '0.06em',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Welcome back.
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <GlassInput
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <GlassInput
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />

            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  fontSize: 10,
                  letterSpacing: '0.06em',
                  color: 'var(--status-offline)',
                  textAlign: 'center',
                  opacity: 0.80,
                }}
              >
                {error}
              </motion.p>
            )}

            <GlassButton
              type="submit"
              size="lg"
              variant="primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </GlassButton>
          </form>

          {/* Links */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 24 }}>
            <button
              type="button"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 9, letterSpacing: '0.14em',
                color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase',
              }}
            >
              Forgot password?
            </button>
            <span style={{ fontSize: 9, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.18)' }}>
              Don&apos;t have an account?{' '}
              <a
                href="/register"
                style={{
                  color: 'rgba(155,138,251,0.72)',
                  textDecoration: 'none',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontSize: 9,
                }}
              >
                Register
              </a>
            </span>
          </div>
        </motion.div>
      </div>
    </>
  );
}
