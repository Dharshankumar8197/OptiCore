'use client';

import React from 'react';
import { motion } from 'framer-motion';

/* ============================================================
   ATMOSPHERIC BACKGROUND
   Rich dark glass environment — deep-field gradient base,
   floating blurred light sources, glass spheres, translucent
   cubes, soft rings. Extremely slow animation.
   ============================================================ */

export function AtmosphericBackground() {
  return (
    <>
      {/* ── Base gradient ─────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          background: `
            radial-gradient(ellipse 70% 55% at 18% 18%, rgba(91, 71, 150, 0.18) 0%, transparent 55%),
            radial-gradient(ellipse 60% 50% at 82% 72%, rgba(40, 92, 130, 0.16) 0%, transparent 50%),
            radial-gradient(ellipse 50% 40% at 50% 50%, rgba(50, 55, 140, 0.08) 0%, transparent 60%),
            #080A10
          `,
          pointerEvents: 'none',
        }}
      />

      {/* ── Ambient light orbs — large blurred spheres ───── */}
      <AmbientOrb
        x={-6} y={-12} size={680} blur={130} opacity={0.22}
        color="radial-gradient(circle, rgba(91,71,150,0.58) 0%, transparent 68%)"
        dur={24} dx={28} dy={18}
      />
      <AmbientOrb
        x={68} y={58} size={720} blur={140} opacity={0.18}
        color="radial-gradient(circle, rgba(40,92,130,0.55) 0%, transparent 68%)"
        dur={30} delay={5} dx={-22} dy={-16}
      />
      <AmbientOrb
        x={52} y={8} size={480} blur={100} opacity={0.14}
        color="radial-gradient(circle, rgba(50,55,140,0.50) 0%, transparent 65%)"
        dur={20} delay={9} dx={-18} dy={24}
      />
      <AmbientOrb
        x={80} y={2} size={300} blur={65} opacity={0.22}
        color="radial-gradient(circle, rgba(155,138,251,0.45) 0%, transparent 65%)"
        dur={17} delay={2} dx={-14} dy={16}
      />
      <AmbientOrb
        x={28} y={22} size={950} blur={180} opacity={0.06}
        color="radial-gradient(circle, rgba(37,99,235,0.38) 0%, transparent 62%)"
        dur={38} delay={12} dx={12} dy={-8}
      />

      {/* ── Glass sphere — lower left ────────────────────── */}
      <GlassSphere
        x={3} y={44}
        size={118}
        opacity={0.22}
        bg="radial-gradient(circle at 32% 26%, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 55%, rgba(91,71,150,0.09) 100%)"
        borderColor="rgba(255,255,255,0.13)"
        dur={22} delay={1}
      />

      {/* ── Glass sphere — top center-right ─────────────── */}
      <GlassSphere
        x={63} y={6}
        size={58}
        opacity={0.24}
        bg="radial-gradient(circle at 36% 28%, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 65%)"
        borderColor="rgba(255,255,255,0.18)"
        dur={16} delay={3}
      />

      {/* ── Small glass sphere — bottom right ───────────── */}
      <GlassSphere
        x={84} y={70}
        size={76}
        opacity={0.20}
        bg="radial-gradient(circle at 38% 30%, rgba(80,80,110,0.42) 0%, rgba(18,18,30,0.65) 68%)"
        borderColor="rgba(255,255,255,0.07)"
        dur={19} delay={6}
      />

      {/* ── Glass sphere — medium, upper left ───────────── */}
      <GlassSphere
        x={12} y={14}
        size={88}
        opacity={0.14}
        bg="radial-gradient(circle at 40% 35%, rgba(155,138,251,0.15) 0%, rgba(255,255,255,0.02) 60%)"
        borderColor="rgba(155,138,251,0.18)"
        dur={26} delay={4}
      />

      {/* ── Translucent cube — upper right ──────────────── */}
      <GlassCube
        x={89} y={18}
        size={84}
        opacity={0.14}
        bg="linear-gradient(135deg, rgba(255,255,255,0.07) 0%, rgba(91,71,150,0.06) 100%)"
        borderColor="rgba(255,255,255,0.09)"
        rotate={22}
        dur={27} delay={5}
      />

      {/* ── Smaller cube — lower left area ──────────────── */}
      <GlassCube
        x={7} y={78}
        size={52}
        opacity={0.12}
        bg="linear-gradient(140deg, rgba(255,255,255,0.05) 0%, rgba(40,92,130,0.07) 100%)"
        borderColor="rgba(255,255,255,0.07)"
        rotate={-15}
        dur={32} delay={8}
      />

      {/* ── Ring — bottom left ───────────────────────────── */}
      <GlassRing
        x={6} y={74}
        size={168}
        opacity={0.10}
        borderColor="rgba(155,138,251,0.22)"
        dur={33} delay={7}
      />

      {/* ── Ring — wide, center-left ─────────────────────── */}
      <GlassRing
        x={36} y={40}
        size={340}
        opacity={0.042}
        borderColor="rgba(255,255,255,0.09)"
        dur={44} delay={0}
        rotate={18}
      />

      {/* ── Very faint grid overlay ───────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.013) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.013) 1px, transparent 1px)
          `,
          backgroundSize: '88px 88px',
          maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, black 30%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

/* ── Helpers ─────────────────────────────────────────────── */

interface AmbientOrbProps {
  x: number; y: number; size: number; blur: number; opacity: number;
  color: string; dur: number; delay?: number; dx?: number; dy?: number;
}
function AmbientOrb({ x, y, size, blur, opacity, color, dur, delay = 0, dx = 0, dy = 0 }: AmbientOrbProps) {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ x: 0, y: 0 }}
      animate={{ x: [0, dx, 0], y: [0, dy, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'fixed',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: '50%',
        background: color,
        filter: `blur(${blur}px)`,
        opacity,
        pointerEvents: 'none',
        zIndex: 0,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

interface GlassSphereProps {
  x: number; y: number; size: number; opacity: number;
  bg: string; borderColor: string; dur: number; delay?: number;
}
function GlassSphere({ x, y, size, opacity, bg, borderColor, dur, delay = 0 }: GlassSphereProps) {
  return (
    <motion.div
      aria-hidden="true"
      animate={{ y: [0, -11, 0] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'fixed',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        opacity,
        pointerEvents: 'none',
        zIndex: 1,
        transform: 'translate(-50%, -50%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.09), 0 8px 28px rgba(0,0,0,0.32)',
      }}
    />
  );
}

interface GlassCubeProps {
  x: number; y: number; size: number; opacity: number;
  bg: string; borderColor: string; rotate: number; dur: number; delay?: number;
}
function GlassCube({ x, y, size, opacity, bg, borderColor, rotate, dur, delay = 0 }: GlassCubeProps) {
  return (
    <motion.div
      aria-hidden="true"
      animate={{
        y: [0, -8, 0],
        rotate: [rotate, rotate + 5, rotate],
      }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'fixed',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: '14px',
        background: bg,
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        opacity,
        pointerEvents: 'none',
        zIndex: 1,
        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), 0 6px 20px rgba(0,0,0,0.28)',
      }}
    />
  );
}

interface GlassRingProps {
  x: number; y: number; size: number; opacity: number;
  borderColor: string; dur: number; delay?: number; rotate?: number;
}
function GlassRing({ x, y, size, opacity, borderColor, dur, delay = 0, rotate = 0 }: GlassRingProps) {
  return (
    <motion.div
      aria-hidden="true"
      animate={{ rotate: [rotate, rotate + 360] }}
      transition={{ duration: dur, delay, repeat: Infinity, ease: 'linear' }}
      style={{
        position: 'fixed',
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'transparent',
        border: `1px solid ${borderColor}`,
        opacity,
        pointerEvents: 'none',
        zIndex: 1,
        transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
      }}
    />
  );
}
