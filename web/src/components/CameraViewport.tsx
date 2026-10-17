'use client';

import React, { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Detection {
  id: string;
  label: string;
  confidence: number;
  x: number;       // percentage 0–100
  y: number;
  width: number;
  height: number;
  class_id?: number;
  tracking_id?: number | null;
}

export interface CameraViewportRef {
  captureFrame: () => string | null;
  switchCamera: () => void;
}

interface CameraViewportProps {
  mode?: 'live' | 'image';
  imageUrl?: string | null;
  detections?: Detection[];
  fps?: number;
  latency?: number;
  modelName?: string;
  inferenceRunning?: boolean;
  resolution?: string;
  isScanning?: boolean;
  selectedDetectionId?: string | null;
  onSelectDetection?: (id: string | null) => void;
  onCameraReady?: (ready: boolean) => void;
  selectedCameraId?: string | null;
}

// Class color palette for rich cyber-vision aesthetics
const CLASS_COLORS: string[] = [
  '#9B8AFB', // 0: person (violet)
  '#6FA8FF', // 1: bicycle (blue)
  '#5CE1E6', // 2: car (cyan)
  '#72D6A3', // 3: motorcycle (emerald)
  '#FFD166', // 4: airplane (gold)
  '#FF85A2', // 5: bus (rose)
  '#F78C6C', // 6: train (coral)
  '#B892FF', // 7: truck (purple)
];

function getClassColor(classId?: number): string {
  if (classId === undefined || classId === null) return '#9B8AFB';
  return CLASS_COLORS[Math.abs(classId) % CLASS_COLORS.length];
}

export const CameraViewport = forwardRef<CameraViewportRef, CameraViewportProps>(function CameraViewport(
  {
    mode = 'live',
    imageUrl,
    detections = [],
    fps,
    latency,
    modelName,
    inferenceRunning = false,
    resolution,
    isScanning = false,
    selectedDetectionId,
    onSelectDetection,
    onCameraReady,
    selectedCameraId,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [activeCameraLabel, setActiveCameraLabel] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* Cleanly stop all tracks of any active stream */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStream(null);
  }, []);

  /* List available video devices */
  const enumerateCameras = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return [];
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      setAvailableDevices(videoInputs);
      return videoInputs;
    } catch {
      return [];
    }
  }, []);

  /* Request browser camera stream with reliable device selection */
  const startCamera = useCallback(
    async (deviceIdToUse?: string, facingToUse?: 'user' | 'environment') => {
      if (mode !== 'live') return;
      setRequesting(true);
      setCamError(null);

      // Stop previous stream
      stopStream();

      const devId = deviceIdToUse !== undefined ? deviceIdToUse : selectedDeviceId;
      const facing = facingToUse !== undefined ? facingToUse : facingMode;

      try {
        let newStream: MediaStream;
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: devId
            ? { deviceId: { ideal: devId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        };

        try {
          newStream = await navigator.mediaDevices.getUserMedia(constraints);
        } catch (constraintErr) {
          console.warn('Constrained camera request failed, attempting basic fallback:', constraintErr);
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: devId ? { deviceId: devId } : true,
          });
        }

        streamRef.current = newStream;
        setStream(newStream);
        setRequesting(false);
        setCamError(null);
        onCameraReady?.(true);

        const videoTrack = newStream.getVideoTracks()[0];
        const label = videoTrack?.label || (facing === 'user' ? 'Front Lens' : 'Rear Lens');
        setActiveCameraLabel(label);

        // Bind stream to video element and play
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch((playErr) => {
            console.warn('video.play() auto-playback error:', playErr);
          });
        }

        // Re-enumerate to get real device names now that permission is granted
        const updatedDevices = await enumerateCameras();
        if (updatedDevices && updatedDevices.length > 0 && !devId && videoTrack) {
          const matched = updatedDevices.find((d) => d.label === videoTrack.label);
          if (matched) {
            setSelectedDeviceId(matched.deviceId);
          }
        }
      } catch (err: any) {
        console.error('Camera request error:', err);
        setCamError(err?.message ?? 'Camera access was denied or not found');
        setRequesting(false);
        onCameraReady?.(false);
      }
    },
    [mode, selectedDeviceId, facingMode, stopStream, onCameraReady, enumerateCameras],
  );

  /* Initial mount: start camera */
  useEffect(() => {
    enumerateCameras();
    if (mode === 'live') {
      startCamera();
    }
    return () => {
      stopStream();
    };
  }, [mode]);

  /* Handle external pre-selected camera prop */
  useEffect(() => {
    if (selectedCameraId && selectedCameraId !== selectedDeviceId) {
      setSelectedDeviceId(selectedCameraId);
      startCamera(selectedCameraId, facingMode);
    }
  }, [selectedCameraId]);

  /* Handle manual camera device selection from dropdown */
  const handleSelectCameraDevice = (newDeviceId: string) => {
    setSelectedDeviceId(newDeviceId);
    startCamera(newDeviceId, facingMode);
  };

  /* Toggle Front/Back camera lens */
  const switchCamera = useCallback(() => {
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    setSelectedDeviceId('');
    startCamera('', nextFacing);
  }, [facingMode, startCamera]);

  /* Capture frame to Base64 JPEG string */
  const captureFrame = useCallback((): string | null => {
    if (mode === 'image' && imageUrl) {
      return imageUrl;
    }
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvasRef.current = canvas;
    }

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  }, [mode, imageUrl]);

  /* Expose ref functions */
  useImperativeHandle(ref, () => ({
    captureFrame,
    switchCamera,
  }));

  const hasFeed = mode === 'image' ? !!imageUrl : !!stream && !camError;

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div
      ref={containerRef}
      className="glass-camera"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        borderRadius: 24,
        overflow: 'hidden',
        background: '#06080E',
        boxShadow: '0 25px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.10)',
      }}
    >
      {/* ── Background Media: Live Video or Uploaded Image ──────────────── */}
      {mode === 'live' ? (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            onLoadedMetadata={() => {
              videoRef.current?.play().catch(() => {});
            }}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: hasFeed ? 'block' : 'none',
            }}
          />
          {!hasFeed && (
            <OfflineState error={camError} requesting={requesting} onConnect={() => startCamera()} />
          )}
        </>
      ) : imageUrl ? (
        <img
          src={imageUrl}
          alt="Detection Target"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            background: 'radial-gradient(circle at center, rgba(15,18,28,0.9), #06080E)',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            color: 'var(--text-muted)',
          }}
        >
          <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
            No Image Selected
          </span>
          <span style={{ fontSize: 9, opacity: 0.6 }}>
            Upload an image or choose a preset to test the model
          </span>
        </div>
      )}

      {/* ── Cyber Vignette ────────────────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 55%, rgba(6,8,14,0.75) 100%)',
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {/* ── Subtle Cyber Grid Overlay ─────────────────────────────────── */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />

      {/* ── Animated Laser Scanner Sweep ──────────────────────────────── */}
      {isScanning && (
        <motion.div
          initial={{ top: '0%' }}
          animate={{ top: ['0%', '100%', '0%'] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            height: 2,
            background: 'linear-gradient(90deg, transparent, #9B8AFB, #6FA8FF, #9B8AFB, transparent)',
            boxShadow: '0 0 16px rgba(155, 138, 251, 0.8), 0 0 32px rgba(111, 168, 255, 0.5)',
            zIndex: 6,
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── Corner Brackets ───────────────────────────────────────────── */}
      <CornerBrackets />

      {/* ── Dynamic AI Detection Bounding Boxes ───────────────────────── */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8 }}>
        {detections.map((det, idx) => (
          <DetectionBox
            key={det.tracking_id ? `track_${det.tracking_id}` : `${det.label}_${idx}`}
            det={det}
            isSelected={selectedDetectionId === det.id}
            onSelect={() => onSelectDetection?.(selectedDetectionId === det.id ? null : det.id)}
          />
        ))}
      </div>

      {/* ── HUD: Top-Left Info Chip ───────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: 20,
          zIndex: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            className={hasFeed ? 'hud-dot-online animate-live-pulse' : 'hud-dot-offline'}
          />
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: hasFeed ? 'rgba(114,214,163,0.90)' : 'rgba(228,125,135,0.75)',
            }}
          >
            {requesting ? 'Connecting…' : mode === 'image' ? 'Image Test' : hasFeed ? 'Live Camera' : 'Offline'}
          </span>
        </div>
        <span
          style={{
            fontSize: 8.5,
            fontWeight: 500,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          {mode === 'live'
            ? activeCameraLabel
              ? activeCameraLabel.length > 28
                ? `${activeCameraLabel.slice(0, 26)}…`
                : activeCameraLabel
              : facingMode === 'user'
              ? 'Front Lens'
              : 'Rear Lens'
            : 'Static Frame'}
        </span>
      </div>

      {/* ── HUD: Top-Right Controls & Resolution ──────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: 18,
          right: 20,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {mode === 'live' && availableDevices.length > 0 && (
          <select
            value={selectedDeviceId}
            onChange={(e) => handleSelectCameraDevice(e.target.value)}
            style={{
              background: 'rgba(6,8,14,0.75)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.75)',
              fontSize: 9,
              padding: '3px 8px',
              outline: 'none',
              cursor: 'pointer',
              backdropFilter: 'blur(12px)',
            }}
          >
            <option value="">Default Camera</option>
            {availableDevices.map((d, i) => (
              <option key={d.deviceId || `cam-${i}`} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </option>
            ))}
          </select>
        )}

        {mode === 'live' && (
          <button
            onClick={switchCamera}
            title="Switch front/back camera"
            style={{
              background: 'rgba(6,8,14,0.70)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: 'rgba(255,255,255,0.70)',
              fontSize: 10,
              padding: '4px 8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backdropFilter: 'blur(12px)',
            }}
          >
            ↺ Lens
          </button>
        )}

        <button
          onClick={toggleFullscreen}
          title="Fullscreen toggle"
          style={{
            background: 'rgba(6,8,14,0.70)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            color: 'rgba(255,255,255,0.70)',
            fontSize: 10,
            padding: '4px 8px',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
          }}
        >
          {isFullscreen ? '✕ Exit' : '⛶ Expand'}
        </button>

        {resolution && (
          <span style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.30)' }}>
            {resolution}
          </span>
        )}
      </div>

      {/* ── HUD: Bottom-Left Model Indicator ──────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          left: 20,
          zIndex: 10,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.40)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: '50%',
              background: 'var(--oc-accent)',
              boxShadow: '0 0 8px var(--oc-accent)',
            }}
          />
          {modelName ? `YOLOv8 · ${modelName}` : 'best.pt Active'}
        </span>
      </div>

      {/* ── HUD: Bottom-Right Latency & Metrics ────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          bottom: 18,
          right: 20,
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {fps !== undefined && <HUDPill value={`${fps.toFixed(1)}`} unit="FPS" />}
        {latency !== undefined && <HUDPill value={`${latency.toFixed(0)}`} unit="MS" />}
        <HUDPill value={`${detections.length}`} unit="TARGETS" highlight={detections.length > 0} />
      </div>

      {/* ── Detection Summary Pill (Bottom-Center) ────────────────────── */}
      {detections.length > 0 && <DetectionSummary detections={detections} />}
    </div>
  );
});

/* ── Sub-components ──────────────────────────────────────────────────────── */

function OfflineState({
  error,
  requesting,
  onConnect,
}: {
  error: string | null;
  requesting: boolean;
  onConnect: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        zIndex: 5,
        padding: 24,
        textAlign: 'center',
      }}
    >
      <motion.div
        animate={{ opacity: [0.35, 0.7, 0.35] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.03)',
        }}
      >
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
          <path
            d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
            stroke="rgba(255,255,255,0.30)"
            strokeWidth="1.2"
          />
          {error && <line x1="1" y1="1" x2="23" y2="23" stroke="rgba(228,125,135,0.55)" strokeWidth="1.4" />}
        </svg>
      </motion.div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.20em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.60)',
          }}
        >
          {requesting ? 'Initializing Camera…' : error ? 'Camera Permission Denied' : 'Camera Feed Idle'}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.30)',
            maxWidth: 320,
          }}
        >
          {error ?? 'Click below to allow browser camera access, or upload an image to test.'}
        </span>
      </div>

      {!requesting && (
        <button
          onClick={onConnect}
          style={{
            padding: '9px 24px',
            background: 'linear-gradient(135deg, rgba(155,138,251,0.25), rgba(111,168,255,0.15))',
            border: '1px solid rgba(155,138,251,0.40)',
            borderRadius: 999,
            color: '#E8E5FF',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 4px 20px rgba(155,138,251,0.20)',
          }}
        >
          Enable Camera Feed
        </button>
      )}
    </div>
  );
}

function HUDPill({ value, unit, highlight }: { value: string; unit: string; highlight?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 3,
        padding: '3px 9px',
        background: highlight ? 'rgba(155,138,251,0.18)' : 'rgba(6,8,14,0.70)',
        border: highlight ? '1px solid rgba(155,138,251,0.40)' : '1px solid rgba(255,255,255,0.10)',
        borderRadius: 999,
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: highlight ? '#E8E5FF' : 'rgba(255,255,255,0.85)',
          letterSpacing: '0.02em',
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: highlight ? 'rgba(155,138,251,0.85)' : 'rgba(255,255,255,0.35)',
        }}
      >
        {unit}
      </span>
    </div>
  );
}

function CornerBrackets() {
  const bracket = (pos: React.CSSProperties, h: boolean, v: boolean) => (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        ...pos,
        width: 18,
        height: 18,
        borderColor: 'rgba(255,255,255,0.25)',
        borderStyle: 'solid',
        borderTopWidth: v ? 1.5 : 0,
        borderBottomWidth: v ? 0 : 1.5,
        borderLeftWidth: h ? 1.5 : 0,
        borderRightWidth: h ? 0 : 1.5,
        zIndex: 5,
        pointerEvents: 'none',
      }}
    />
  );
  return (
    <>
      {bracket({ top: 12, left: 12 }, true, true)}
      {bracket({ top: 12, right: 12 }, false, true)}
      {bracket({ bottom: 12, left: 12 }, true, false)}
      {bracket({ bottom: 12, right: 12 }, false, false)}
    </>
  );
}

function DetectionBox({
  det,
  isSelected,
  onSelect,
}: {
  det: Detection;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const color = getClassColor(det.class_id);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
      style={{
        position: 'absolute',
        zIndex: isSelected ? 12 : 8,
        left: `${det.x}%`,
        top: `${det.y}%`,
        width: `${det.width}%`,
        height: `${det.height}%`,
        border: `1.5px solid ${isSelected ? '#FFFFFF' : color}`,
        borderRadius: 6,
        boxShadow: isSelected
          ? `0 0 20px ${color}, inset 0 0 10px rgba(255,255,255,0.2)`
          : `0 0 12px ${color}44`,
        cursor: 'pointer',
        pointerEvents: 'auto',
        transition: 'left 0.14s ease-out, top 0.14s ease-out, width 0.14s ease-out, height 0.14s ease-out, border-color 0.2s ease, box-shadow 0.2s ease',
        willChange: 'left, top, width, height',
      }}
    >
      {/* Corner crosshair accents on bounding box */}
      <div
        style={{
          position: 'absolute',
          top: -3,
          left: -3,
          width: 7,
          height: 7,
          borderTop: `2px solid ${color}`,
          borderLeft: `2px solid ${color}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -3,
          right: -3,
          width: 7,
          height: 7,
          borderBottom: `2px solid ${color}`,
          borderRight: `2px solid ${color}`,
        }}
      />

      {/* Floating Tag */}
      <div
        style={{
          position: 'absolute',
          top: -22,
          left: -1,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 7px',
          background: 'rgba(6,8,14,0.92)',
          border: `1px solid ${color}66`,
          borderRadius: '4px 4px 4px 0',
          backdropFilter: 'blur(8px)',
          fontSize: 8.5,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#F5F7FA',
          whiteSpace: 'nowrap',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >
        <span
          style={{
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
          }}
        />
        <span>{det.label.toUpperCase()}</span>
        <span style={{ color, fontWeight: 700 }}>{(det.confidence * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function DetectionSummary({ detections }: { detections: Detection[] }) {
  const counts: Record<string, number> = {};
  detections.forEach((d) => {
    counts[d.label] = (counts[d.label] ?? 0) + 1;
  });
  const entries = Object.entries(counts).slice(0, 4);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        position: 'absolute',
        bottom: 18,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '5px 14px',
        background: 'rgba(6,8,14,0.78)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        pointerEvents: 'none',
      }}
    >
      {entries.map(([label, count]) => (
        <span
          key={label}
          style={{
            fontSize: 9,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.65)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span style={{ color: 'var(--oc-accent)', fontWeight: 700 }}>{count}</span>
          {label}
        </span>
      ))}
    </motion.div>
  );
}
