'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AtmosphericBackground } from '@/components/AtmosphericBackground';
import { GlassInput } from '@/components/design/GlassInput';
import { GlassButton } from '@/components/design/GlassButton';
import { OpticoreMark } from '@/components/OpticoreLogo';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export default function RegisterPage() {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return; }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: name, email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { detail?: string }).detail ?? 'Registration failed');
      }
      setSuccess(true);
      setTimeout(() => { window.location.href = '/login'; }, 2000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
            maxWidth: 420,
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, marginBottom: 30 }}>
            <span style={{ fontSize: 20, fontWeight: 200, letterSpacing: '0.40em', color: 'rgba(255,255,255,0.90)', textTransform: 'uppercase' }}>
              OPTICORE
            </span>
            <span style={{ fontSize: 8.5, fontWeight: 500, letterSpacing: '0.26em', color: 'rgba(255,255,255,0.26)', textTransform: 'uppercase' }}>
              VISION LAB
            </span>
            <div style={{ width: 32, height: 1, background: 'linear-gradient(90deg, transparent, rgba(155,138,251,0.45), transparent)', margin: '12px 0 4px' }} />
            <span style={{ fontSize: 11, fontWeight: 300, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.36)', textAlign: 'center' }}>
              Create your account.
            </span>
          </div>

          {/* Success state */}
          {success ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}
            >
              <div
                style={{
                  width: 44, height: 44, borderRadius: '50%',
                  border: '1px solid rgba(114,214,163,0.38)',
                  background: 'rgba(114,214,163,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                  <polyline points="20 6 9 17 4 12" stroke="rgba(114,214,163,0.80)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 11, fontWeight: 300, color: 'rgba(114,214,163,0.65)', letterSpacing: '0.08em' }}>
                Account created. Redirecting…
              </span>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <GlassInput
                label="Full Name"
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoComplete="name"
              />
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
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
              <GlassInput
                label="Confirm Password"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
              />

              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    fontSize: 10, letterSpacing: '0.06em',
                    color: 'var(--status-offline)', textAlign: 'center', opacity: 0.80,
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
                {loading ? 'Creating account…' : 'Create Account'}
              </GlassButton>
            </form>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <span style={{ fontSize: 9, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.18)' }}>
              Already have an account?{' '}
              <a
                href="/login"
                style={{
                  color: 'rgba(155,138,251,0.72)',
                  textDecoration: 'none',
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  fontSize: 9,
                }}
              >
                Sign In
              </a>
            </span>
          </div>
        </motion.div>
      </div>
    </>
  );
}
