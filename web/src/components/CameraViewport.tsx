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
  const [liveResolution, setLiveResolution] = useState<string>('1280x720');
  const [showDeviceMenu, setShowDeviceMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  /* Close camera menu on outside click */
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowDeviceMenu(false);
      }
    };
    if (showDeviceMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDeviceMenu]);

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

      // Brief delay to allow Windows Media Foundation driver to release hardware handle
      await new Promise((r) => setTimeout(r, 180));

      let devId = deviceIdToUse !== undefined ? deviceIdToUse : selectedDeviceId;
      const facing = facingToUse !== undefined ? facingToUse : facingMode;

      // If no deviceId specified yet, check localStorage for previously preferred camera
      if (!devId && typeof window !== 'undefined') {
        try {
          const storedId = localStorage.getItem('opticore_preferred_camera_id');
          if (storedId) {
            devId = storedId;
          }
        } catch {
          /* ignore */
        }
      }

      try {
        let newStream: MediaStream | null = null;

        if (devId) {
          // Attempt 1: Exact device ID with ideal 720p resolution
          try {
            newStream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                deviceId: { exact: devId },
                width: { ideal: 1280 },
                height: { ideal: 720 },
              },
            });
          } catch (err1) {
            console.warn('Attempt 1 (exact + 720p) failed, trying exact device alone:', err1);
            // Attempt 2: Exact device ID alone (native hardware resolution)
            try {
              newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  deviceId: { exact: devId },
                },
              });
            } catch (err2) {
              console.warn('Attempt 2 (exact alone) failed, falling back to ideal deviceId:', err2);
              // Attempt 3: Ideal device ID
              newStream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: {
                  deviceId: { ideal: devId },
                },
              });
            }
          }
        } else {
          // Default camera or facing mode
          newStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              facingMode: facing,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          });
        }

        if (!newStream) {
          throw new Error('Could not acquire media stream from camera.');
        }

        streamRef.current = newStream;
        setStream(newStream);
        setRequesting(false);
        setCamError(null);
        onCameraReady?.(true);

        const videoTrack = newStream.getVideoTracks()[0];
        const label = videoTrack?.label || (facing === 'user' ? 'Front Lens' : 'Rear Lens');
        setActiveCameraLabel(label);

        const settings = videoTrack?.getSettings();
        if (settings?.deviceId) {
          setSelectedDeviceId(settings.deviceId);
        } else if (devId) {
          setSelectedDeviceId(devId);
        }

        if (settings?.width && settings?.height) {
          setLiveResolution(`${settings.width}x${settings.height}`);
        }

        // Bind stream to video element and play
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.play().catch((playErr) => {
            console.warn('video.play() auto-playback error:', playErr);
          });
        }

        // Re-enumerate to get real device names now that permission is granted
        const updatedDevices = await enumerateCameras();
        if (updatedDevices && updatedDevices.length > 0) {
          if (!devId && videoTrack) {
            const matched = updatedDevices.find((d) => d.label === videoTrack.label);
            if (matched) {
              setSelectedDeviceId(matched.deviceId);
            }

            // Smart Auto-Promotion: If Chromium defaulted to a virtual/phone camera (like Redmi A2+ or DroidCam),
            // and a physical hardware Integrated Camera is present on the PC, auto-promote to the physical camera!
            const isVirtual =
              videoTrack.label.toLowerCase().includes('virtual') ||
              videoTrack.label.toLowerCase().includes('redmi');
            const physicalCam = updatedDevices.find(
              (d) =>
                d.label.toLowerCase().includes('integrated') ||
                d.label.toLowerCase().includes('built-in') ||
                (!d.label.toLowerCase().includes('virtual') && !d.label.toLowerCase().includes('redmi'))
            );

            if (isVirtual && physicalCam && physicalCam.deviceId) {
              console.log('OptiCore: Auto-promoting physical Integrated Camera over virtual device:', physicalCam.label);
              // Switch directly to the physical camera
              setSelectedDeviceId(physicalCam.deviceId);
              try {
                localStorage.setItem('opticore_preferred_camera_id', physicalCam.deviceId);
                localStorage.setItem('opticore_preferred_camera_label', physicalCam.label);
              } catch {}
              // Restart with the physical camera device
              setTimeout(() => {
                startCamera(physicalCam.deviceId, facing);
              }, 50);
              return;
            }
          }
        }
      } catch (err: any) {
        console.error('Camera request error:', err);
        const errMsg =
          err?.name === 'NotReadableError'
            ? 'Camera hardware is locked by another application (Zoom, Teams, or Windows Camera)'
            : err?.message ?? 'Camera access was denied or not found';
        setCamError(errMsg);
        setRequesting(false);
        onCameraReady?.(false);
      }
    },
    [mode, selectedDeviceId, facingMode, stopStream, onCameraReady, enumerateCameras],
  );

  /* Handle manual camera device selection from dropdown */
  const handleSelectCameraDevice = useCallback(
    (newDeviceId: string) => {
      setSelectedDeviceId(newDeviceId);
      try {
        localStorage.setItem('opticore_preferred_camera_id', newDeviceId);
        const dev = availableDevices.find((d) => d.deviceId === newDeviceId);
        if (dev && dev.label) {
          localStorage.setItem('opticore_preferred_camera_label', dev.label);
        }
      } catch {
        /* ignore localStorage error */
      }
      startCamera(newDeviceId, facingMode);
    },
    [availableDevices, facingMode, startCamera],
  );

  /* Initial mount: probe devices and restore saved camera */
  useEffect(() => {
    let mounted = true;
    const initCameras = async () => {
      const devices = await enumerateCameras();
      if (!mounted) return;

      let preferredId: string | null = null;
      try {
        const storedId = localStorage.getItem('opticore_preferred_camera_id');
        const storedLabel = localStorage.getItem('opticore_preferred_camera_label');
        if (devices.length > 0 && storedLabel) {
          const match = devices.find((d) => d.label === storedLabel);
          if (match) preferredId = match.deviceId;
        } else if (storedId) {
          preferredId = storedId;
        }
      } catch {
        /* ignore */
      }

      if (mode === 'live') {
        startCamera(preferredId || undefined);
      }
    };

    initCameras();
    return () => {
      mounted = false;
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

  /* Toggle Front/Back camera lens or cycle detected cameras */
  const switchCamera = useCallback(() => {
    if (availableDevices.length > 1) {
      const currentIndex = availableDevices.findIndex(
        (d) => d.deviceId === selectedDeviceId || (activeCameraLabel && d.label === activeCameraLabel),
      );
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % availableDevices.length : 0;
      const nextDevice = availableDevices[nextIndex];
      if (nextDevice && nextDevice.deviceId) {
        handleSelectCameraDevice(nextDevice.deviceId);
        return;
      }
    }
    const nextFacing = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextFacing);
    setSelectedDeviceId('');
    startCamera('', nextFacing);
  }, [availableDevices, selectedDeviceId, activeCameraLabel, facingMode, handleSelectCameraDevice, startCamera]);

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
            <OfflineState
              error={camError}
              requesting={requesting}
              availableDevices={availableDevices}
              onConnect={() => startCamera()}
              onSelectAlternate={(devId) => handleSelectCameraDevice(devId)}
            />
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
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        {/* Custom Glassmorphic Camera Device Selector */}
        {mode === 'live' && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowDeviceMenu((prev) => !prev)}
              title="Select camera sensor"
              style={{
                background: 'rgba(6,8,14,0.85)',
                border: showDeviceMenu ? '1px solid rgba(155,138,251,0.60)' : '1px solid rgba(155,138,251,0.30)',
                borderRadius: 10,
                color: '#FFFFFF',
                fontSize: 9.5,
                fontWeight: 600,
                padding: '5px 11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                cursor: 'pointer',
                backdropFilter: 'blur(16px)',
                boxShadow: showDeviceMenu ? '0 0 20px rgba(155,138,251,0.35)' : '0 4px 20px rgba(0,0,0,0.5)',
                transition: 'all 0.18s ease',
              }}
            >
              {/* Live status dot */}
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: hasFeed ? '#10B981' : '#F59E0B',
                  boxShadow: hasFeed ? '0 0 8px #10B981' : '0 0 6px #F59E0B',
                  flexShrink: 0,
                }}
              />
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              <span style={{ maxWidth: 165, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {activeCameraLabel || (availableDevices.length > 0 ? availableDevices[0].label : 'Select Camera')}
              </span>
              {availableDevices.length > 1 && (
                <span
                  style={{
                    fontSize: 8,
                    fontWeight: 700,
                    padding: '1px 5px',
                    borderRadius: 999,
                    background: 'rgba(155,138,251,0.20)',
                    color: '#B892FF',
                    border: '1px solid rgba(155,138,251,0.30)',
                  }}
                >
                  {availableDevices.length}
                </span>
              )}
              <svg
                viewBox="0 0 24 24"
                width="10"
                height="10"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{
                  transform: showDeviceMenu ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                  opacity: 0.7,
                }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* Glassmorphic Animated Dropdown Menu */}
            <AnimatePresence>
              {showDeviceMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 280,
                    background: '#0B0E17',
                    border: '1px solid rgba(155,138,251,0.35)',
                    borderRadius: 14,
                    padding: 8,
                    boxShadow: '0 20px 50px rgba(0,0,0,0.7), 0 0 25px rgba(155,138,251,0.18)',
                    zIndex: 50,
                    backdropFilter: 'blur(24px)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px 6px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 8,
                        fontWeight: 700,
                        letterSpacing: '0.16em',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                      }}
                    >
                      Detected Camera Hardware
                    </span>
                    <span style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                      {availableDevices.length} available
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {availableDevices.map((d, i) => {
                      const isSelected =
                        (selectedDeviceId && d.deviceId === selectedDeviceId) ||
                        (activeCameraLabel && d.label === activeCameraLabel);
                      const isIntegrated =
                        d.label.toLowerCase().includes('integrated') ||
                        d.label.toLowerCase().includes('built-in');
                      const isVirtual =
                        d.label.toLowerCase().includes('virtual') ||
                        d.label.toLowerCase().includes('redmi');

                      return (
                        <button
                          key={d.deviceId || `cam-${i}`}
                          type="button"
                          onClick={() => {
                            handleSelectCameraDevice(d.deviceId);
                            setShowDeviceMenu(false);
                          }}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 9,
                            background: isSelected
                              ? 'linear-gradient(135deg, rgba(155,138,251,0.22), rgba(111,168,255,0.15))'
                              : 'rgba(255,255,255,0.03)',
                            border: isSelected
                              ? '1px solid rgba(155,138,251,0.45)'
                              : '1px solid rgba(255,255,255,0.06)',
                            color: isSelected ? '#FFFFFF' : 'rgba(255,255,255,0.80)',
                            fontSize: 10,
                            textAlign: 'left',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            <span
                              style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: isSelected ? '#10B981' : 'rgba(255,255,255,0.25)',
                                boxShadow: isSelected ? '0 0 8px #10B981' : 'none',
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontWeight: isSelected ? 600 : 400,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {d.label || `Camera ${i + 1}`}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 7.5,
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: isIntegrated
                                ? 'rgba(114,214,163,0.15)'
                                : isVirtual
                                ? 'rgba(96,165,250,0.15)'
                                : 'rgba(255,255,255,0.08)',
                              color: isIntegrated ? '#72D6A3' : isVirtual ? '#60A5FA' : 'var(--text-muted)',
                              textTransform: 'uppercase',
                              letterSpacing: '0.08em',
                              flexShrink: 0,
                            }}
                          >
                            {isIntegrated ? 'Physical' : isVirtual ? 'Virtual' : 'USB'}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div
                    style={{
                      borderTop: '1px solid rgba(255,255,255,0.08)',
                      marginTop: 6,
                      paddingTop: 6,
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        enumerateCameras();
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--oc-accent)',
                        fontSize: 8.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        letterSpacing: '0.10em',
                        textTransform: 'uppercase',
                        padding: '4px 8px',
                      }}
                    >
                      🔄 Refresh Camera Sensors
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
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
              padding: '5px 9px',
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
            padding: '5px 9px',
            cursor: 'pointer',
            backdropFilter: 'blur(12px)',
          }}
        >
          {isFullscreen ? '✕ Exit' : '⛶ Expand'}
        </button>

        <span style={{ fontSize: 8.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.40)', fontFamily: 'monospace' }}>
          {liveResolution || resolution || '1280x720'}
        </span>
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
  availableDevices = [],
  onConnect,
  onSelectAlternate,
}: {
  error: string | null;
  requesting: boolean;
  availableDevices?: MediaDeviceInfo[];
  onConnect: () => void;
  onSelectAlternate?: (devId: string) => void;
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
            color: error ? '#F87171' : 'rgba(255,255,255,0.60)',
          }}
        >
          {requesting ? 'Initializing Camera…' : error ? 'Camera Hardware Busy or Denied' : 'Camera Feed Idle'}
        </span>
        <span
          style={{
            fontSize: 9,
            fontWeight: 400,
            letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.35)',
            maxWidth: 360,
            lineHeight: 1.5,
          }}
        >
          {error ?? 'Click below to allow browser camera access, or upload an image to test.'}
        </span>
      </div>

      {!requesting && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
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
            {error ? 'Retry Camera Feed' : 'Enable Camera Feed'}
          </button>

          {error && availableDevices.length > 0 && onSelectAlternate && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 8, color: 'var(--text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Or select an alternate camera sensor:
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', maxWidth: 380 }}>
                {availableDevices.map((d, i) => (
                  <button
                    key={d.deviceId || i}
                    type="button"
                    onClick={() => onSelectAlternate(d.deviceId)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(155,138,251,0.35)',
                      color: 'rgba(255,255,255,0.90)',
                      fontSize: 8.5,
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <span>📷</span>
                    <span>{d.label ? (d.label.length > 22 ? d.label.slice(0, 20) + '…' : d.label) : `Sensor ${i + 1}`}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
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
