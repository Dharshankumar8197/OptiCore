'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CameraViewport, Detection, CameraViewportRef } from '@/components/CameraViewport';
import {
  apiClient,
  CameraSourceResponse,
  ModelResponse,
  ModelConfigResponse,
  DetectResponse,
  DetectionItem,
  ModelClassesResponse,
} from '@/lib/api';

/* ── Sample Test Presets (photorealistic obstacles & hazard scenes) ──────── */
const PRESET_IMAGES = [
  {
    id: 'preset_indoor',
    name: 'Indoor Hallway',
    category: 'Obstacles & Stairs',
    description: 'Doors, staircases, and hallway obstacles',
    url: '/presets/indoor.jpg',
  },
  {
    id: 'preset_urban',
    name: 'Urban Street',
    category: 'Pedestrians & Hazards',
    description: 'Waste container obstacle, traffic light, pedestrians',
    url: '/presets/urban.jpg',
  },
  {
    id: 'preset_sidewalk',
    name: 'Sidewalk Hazards',
    category: 'Ground & Furniture',
    description: 'Park bench obstacle, pothole hazard, curb',
    url: '/presets/street_hazards.jpg',
  },
];

/* Helper to convert URL/preset to base64 Data URL */
async function resolveImageBase64(url: string): Promise<string> {
  if (url.startsWith('data:')) return url;
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ── Types passed from shell ─────────────────────────────────────────────── */
export interface ModelPageSystemState {
  inferenceRunning: boolean;
  fps: number | null;
  latency: number | null;
  detectionCount: number | null;
  confidence: number;
  iou: number;
  imageSize: number;
}

interface ModelPageProps {
  state: ModelPageSystemState;
  modelLoadedRef: React.MutableRefObject<boolean>;
  onConfigChange?: (field: 'confidence' | 'iou' | 'imageSize', value: number) => void;
  preSelectedCameraId?: string | null;
  onCameraChange?: (active: boolean) => void;
}

type TestTab = 'live' | 'upload' | 'presets';

/* ── Shared Glass Panel ──────────────────────────────────────────────────── */
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.10)',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.08)',
        padding: '16px 18px',
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
          left: '10%',
          right: '10%',
          height: 1,
          background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
}

function SectionLabel({ label, color }: { label: string; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: color ?? 'var(--oc-accent)',
          boxShadow: `0 0 8px ${color ?? 'var(--oc-accent)'}`,
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

function InfoRow({ label, value, accent, color }: { label: string; value: string; accent?: boolean; color?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '7px 0',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <span
        style={{
          fontSize: 9,
          fontWeight: 500,
          letterSpacing: '0.14em',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 400,
          letterSpacing: '0.03em',
          color: color ? color : accent ? 'var(--oc-accent)' : 'var(--text-primary)',
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}
      >
        {value}
      </span>
    </div>
  );
}

/* ── Slider Control ──────────────────────────────────────────────────────── */
function SliderControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange?: (v: number) => void;
  format?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const display = format ? format(value) : value.toFixed(step < 1 ? 2 : 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: 9,
            fontWeight: 500,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '0.04em',
          }}
        >
          {display}
        </span>
      </div>
      <div style={{ position: 'relative', height: 4 }}>
        <div
          style={{
            position: 'absolute',
            top: 1,
            left: 0,
            width: `${pct}%`,
            height: 2,
            background: 'linear-gradient(90deg, #9B8AFB, #6FA8FF)',
            borderRadius: 2,
            pointerEvents: 'none',
            boxShadow: '0 0 8px rgba(155,138,251,0.5)',
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange?.(parseFloat(e.target.value))}
          style={{
            position: 'absolute',
            top: -4,
            left: 0,
            width: '100%',
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────────────────── */
export function ModelPage({
  state,
  modelLoadedRef,
  onConfigChange,
  preSelectedCameraId,
  onCameraChange,
}: ModelPageProps) {
  const viewportRef = useRef<CameraViewportRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Testing mode
  const [activeTab, setActiveTab] = useState<TestTab>('live');

  // Model & Config
  const [modelInfo, setModelInfo] = useState<ModelResponse | null>(null);
  const [modelClasses, setModelClasses] = useState<Record<string, string>>({});
  const [modelConfig, setModelConfig] = useState<ModelConfigResponse | null>(null);

  // Active Detections & View
  const [detections, setDetections] = useState<Detection[]>([]);
  const [selectedDetectionId, setSelectedDetectionId] = useState<string | null>(null);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);

  // Execution Metrics
  const [isInferring, setIsInferring] = useState(false);
  const [continuousScan, setContinuousScan] = useState(false);
  const [sampleFps, setSampleFps] = useState<number>(3); // 3 FPS auto-sampling
  const [liveLatency, setLiveLatency] = useState<number | null>(null);
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const [timingBreakdown, setTimingBreakdown] = useState<{
    pre: number;
    infer: number;
    post: number;
    total: number;
  } | null>(null);
  const [lastRawJson, setLastRawJson] = useState<DetectResponse | null>(null);
  const [copiedJson, setCopiedJson] = useState(false);
  const [showJsonInspector, setShowJsonInspector] = useState(false);

  // Cameras
  const [cameras, setCameras] = useState<CameraSourceResponse[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loopRef = useRef<number | null>(null);

  /* Load model & class list */
  const loadModelDetails = useCallback(async () => {
    try {
      const [info, cfg, cls] = await Promise.all([
        apiClient.getModel(),
        apiClient.getModelConfig(),
        apiClient.getModelClasses().catch(() => null),
      ]);
      setModelInfo(info);
      setModelConfig(cfg);
      if (cls?.classes) {
        setModelClasses(cls.classes);
      }
      if (!modelLoadedRef.current && info?.status === 'available') {
        modelLoadedRef.current = true;
      }
    } catch {
      /* ignore */
    }
  }, [modelLoadedRef]);

  useEffect(() => {
    loadModelDetails();
  }, [loadModelDetails]);

  /* Load camera sources */
  useEffect(() => {
    apiClient
      .getCameras()
      .then((res) => setCameras(res.cameras ?? []))
      .catch(() => setCameras([]));
  }, []);

  useEffect(() => {
    if (preSelectedCameraId) setSelectedCamera(preSelectedCameraId);
  }, [preSelectedCameraId]);

  const isInferringRef = useRef(false);

  /* Execute one-shot detection on current frame / image */
  const runSingleDetection = useCallback(async () => {
    if (isInferringRef.current) return;
    isInferringRef.current = true;
    setIsInferring(true);

    try {
      let b64: string | null = null;
      if (activeTab === 'live') {
        b64 = viewportRef.current?.captureFrame() ?? null;
      } else if (uploadedImageUrl) {
        b64 = await resolveImageBase64(uploadedImageUrl);
      }

      if (!b64) {
        return;
      }

      const conf = modelConfig?.confidence_threshold ?? state.confidence;
      const iou = modelConfig?.iou_threshold ?? state.iou;
      const imgSize = modelConfig?.image_size ?? state.imageSize;

      const res = await apiClient.detectBase64({
        image_base64: b64,
        confidence_threshold: conf,
        iou_threshold: iou,
        image_size: imgSize,
      });

      // Map detection items
      const mapped: Detection[] = (res.detections || []).map((d: DetectionItem) => ({
        id: d.id,
        label: d.class_name,
        confidence: d.confidence,
        x: d.normalized_box.x,
        y: d.normalized_box.y,
        width: d.normalized_box.width,
        height: d.normalized_box.height,
        class_id: d.class_id,
        tracking_id: d.tracking_id,
      }));

      setDetections(mapped);
      setLiveLatency(res.total_time_ms);
      setLiveFps(res.total_time_ms > 0 ? +(1000 / res.total_time_ms).toFixed(1) : 60);
      setTimingBreakdown({
        pre: res.preprocess_ms,
        infer: res.inference_time_ms,
        post: res.postprocess_ms,
        total: res.total_time_ms,
      });
      setLastRawJson(res);
    } catch (err) {
      console.error('Detection request failed:', err);
    } finally {
      isInferringRef.current = false;
      setIsInferring(false);
    }
  }, [activeTab, uploadedImageUrl, modelConfig, state]);

  /* Continuous Auto-Scan Loop (Live Camera) — self-pacing async recursion */
  useEffect(() => {
    let isMounted = true;
    let timerId: ReturnType<typeof setTimeout>;

    const tick = async () => {
      if (!continuousScan || activeTab !== 'live') return;
      await runSingleDetection();
      if (isMounted && continuousScan && activeTab === 'live') {
        const delay = Math.max(80, Math.round(1000 / sampleFps));
        timerId = setTimeout(tick, delay);
      }
    };

    if (continuousScan && activeTab === 'live') {
      tick();
    }

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [continuousScan, activeTab, sampleFps, runSingleDetection]);

  /* Handle File Upload */
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const b64 = reader.result as string;
      setUploadedImageUrl(b64);
      setActiveTab('upload');
      setDetections([]);
      // Run detection immediately on uploaded file
      setTimeout(() => {
        apiClient
          .detectBase64({
            image_base64: b64,
            confidence_threshold: modelConfig?.confidence_threshold ?? state.confidence,
            iou_threshold: modelConfig?.iou_threshold ?? state.iou,
          })
          .then((res) => {
            const mapped: Detection[] = (res.detections || []).map((d) => ({
              id: d.id,
              label: d.class_name,
              confidence: d.confidence,
              x: d.normalized_box.x,
              y: d.normalized_box.y,
              width: d.normalized_box.width,
              height: d.normalized_box.height,
              class_id: d.class_id,
              tracking_id: d.tracking_id,
            }));
            setDetections(mapped);
            setTimingBreakdown({
              pre: res.preprocess_ms,
              infer: res.inference_time_ms,
              post: res.postprocess_ms,
              total: res.total_time_ms,
            });
            setLastRawJson(res);
          })
          .catch(() => {});
      }, 100);
    };
    reader.readAsDataURL(file);
  };

  /* Select preset */
  const handleSelectPreset = async (preset: (typeof PRESET_IMAGES)[0]) => {
    setUploadedImageUrl(preset.url);
    setActiveTab('presets');
    setDetections([]);
    setIsInferring(true);

    try {
      const b64 = await resolveImageBase64(preset.url);
      const conf = Math.min(modelConfig?.confidence_threshold ?? state.confidence, 0.35);

      const res = await apiClient.detectBase64({
        image_base64: b64,
        confidence_threshold: conf,
        iou_threshold: modelConfig?.iou_threshold ?? state.iou,
      });

      const mapped: Detection[] = (res.detections || []).map((d) => ({
        id: d.id,
        label: d.class_name,
        confidence: d.confidence,
        x: d.normalized_box.x,
        y: d.normalized_box.y,
        width: d.normalized_box.width,
        height: d.normalized_box.height,
        class_id: d.class_id,
        tracking_id: d.tracking_id,
      }));
      setDetections(mapped);
      setLiveLatency(res.total_time_ms);
      setLiveFps(res.total_time_ms > 0 ? +(1000 / res.total_time_ms).toFixed(1) : 60);
      setTimingBreakdown({
        pre: res.preprocess_ms,
        infer: res.inference_time_ms,
        post: res.postprocess_ms,
        total: res.total_time_ms,
      });
      setLastRawJson(res);
    } catch (err) {
      console.error('Preset detection error:', err);
    } finally {
      setIsInferring(false);
    }
  };

  /* Copy raw JSON */
  const copyJsonToClipboard = () => {
    if (!lastRawJson) return;
    navigator.clipboard.writeText(JSON.stringify(lastRawJson, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  /* Slider debounced update to backend */
  const handleSliderChange = (
    field: 'confidence_threshold' | 'iou_threshold' | 'image_size',
    value: number,
  ) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const updated = await apiClient.updateModelConfig({ [field]: value });
        setModelConfig(updated);
      } catch {
        /* snap back */
      }
    }, 400);

    setModelConfig((prev) => (prev ? { ...prev, [field]: value } : prev));
    if (field === 'confidence_threshold') onConfigChange?.('confidence', value);
    if (field === 'iou_threshold') onConfigChange?.('iou', value);
    if (field === 'image_size') onConfigChange?.('imageSize', value);
  };

  const conf = modelConfig?.confidence_threshold ?? state.confidence;
  const iou = modelConfig?.iou_threshold ?? state.iou;
  const imgSize = modelConfig?.image_size ?? state.imageSize;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'grid',
        gridTemplateColumns: '1fr 340px',
        gap: 16,
      }}
      className="page-enter"
    >
      {/* ── LEFT COLUMN: Vision Viewport & Quick Mode Switcher ────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
        {/* Testing Mode Selector Chips */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 6px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 14,
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {(
              [
                { id: 'live', label: '📹 Live Camera Feed' },
                { id: 'upload', label: '📁 Upload Image' },
                { id: 'presets', label: '⚡ 1-Click Presets' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'live') setContinuousScan(false);
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  cursor: 'pointer',
                  border:
                    activeTab === tab.id
                      ? '1px solid rgba(155,138,251,0.50)'
                      : '1px solid transparent',
                  background:
                    activeTab === tab.id
                      ? 'linear-gradient(135deg, rgba(155,138,251,0.22), rgba(111,168,255,0.12))'
                      : 'transparent',
                  color: activeTab === tab.id ? '#FFFFFF' : 'var(--text-muted)',
                  transition: 'all 0.18s ease',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {activeTab === 'live' && (
              <button
                onClick={() => setContinuousScan((c) => !c)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 8,
                  fontSize: 9.5,
                  fontWeight: 600,
                  letterSpacing: '0.10em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  border: continuousScan
                    ? '1px solid #72D6A3'
                    : '1px solid rgba(255,255,255,0.14)',
                  background: continuousScan ? 'rgba(114,214,163,0.20)' : 'rgba(255,255,255,0.04)',
                  color: continuousScan ? '#72D6A3' : 'var(--text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: continuousScan ? '#72D6A3' : 'rgba(255,255,255,0.3)',
                    boxShadow: continuousScan ? '0 0 8px #72D6A3' : 'none',
                  }}
                />
                {continuousScan ? 'Auto-Scanning' : 'Start Auto-Scan'}
              </button>
            )}

            <button
              onClick={runSingleDetection}
              disabled={isInferring}
              style={{
                padding: '5px 14px',
                borderRadius: 8,
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                cursor: isInferring ? 'not-allowed' : 'pointer',
                border: '1px solid rgba(155,138,251,0.60)',
                background: 'linear-gradient(135deg, #9B8AFB, #6FA8FF)',
                color: '#080A10',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                boxShadow: '0 0 16px rgba(155,138,251,0.4)',
              }}
            >
              {isInferring ? '⚡ Analyzing…' : '⚡ Detect Frame'}
            </button>
          </div>
        </div>

        {/* Viewport Card */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <CameraViewport
            ref={viewportRef}
            mode={activeTab === 'live' ? 'live' : 'image'}
            imageUrl={activeTab !== 'live' ? uploadedImageUrl : undefined}
            detections={detections}
            fps={liveFps ?? state.fps ?? undefined}
            latency={liveLatency ?? state.latency ?? undefined}
            modelName={modelInfo?.name ?? 'best.pt'}
            inferenceRunning={continuousScan || isInferring}
            isScanning={continuousScan || isInferring}
            selectedDetectionId={selectedDetectionId}
            onSelectDetection={setSelectedDetectionId}
            onCameraReady={onCameraChange}
            selectedCameraId={preSelectedCameraId}
            resolution={
              activeTab === 'live'
                ? cameras.find((c) => c.id === selectedCamera)?.resolution ?? '1280x720'
                : 'Target Frame'
            }
          />
        </div>

        {/* Tab-Specific Bottom Tray */}
        <AnimatePresence mode="wait">
          {activeTab === 'presets' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}
            >
              {PRESET_IMAGES.map((preset) => (
                <div
                  key={preset.id}
                  onClick={() => handleSelectPreset(preset)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    background:
                      uploadedImageUrl === preset.url
                        ? 'rgba(155,138,251,0.18)'
                        : 'rgba(255,255,255,0.03)',
                    border:
                      uploadedImageUrl === preset.url
                        ? '1px solid rgba(155,138,251,0.50)'
                        : '1px solid rgba(255,255,255,0.07)',
                    cursor: 'pointer',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: '#F5F7FA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    {preset.name}
                    <span style={{ fontSize: 9, color: 'var(--oc-accent)' }}>1-Click Test</span>
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 3 }}>
                    {preset.description}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'upload' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/mp4"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '1.5px dashed rgba(155,138,251,0.35)',
                  borderRadius: 14,
                  padding: '16px',
                  textAlign: 'center',
                  background: 'rgba(155,138,251,0.03)',
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--oc-accent)',
                  }}
                >
                  Drag & Drop Image or Click to Browse
                </span>
                <span
                  style={{
                    display: 'block',
                    fontSize: 9,
                    color: 'var(--text-muted)',
                    marginTop: 4,
                  }}
                >
                  Supports JPG, PNG, WEBP, or sample test frames
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── RIGHT COLUMN: Control Panel & Output Breakdown Visualizer ── */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          overflowY: 'auto',
          minHeight: 0,
          paddingRight: 2,
        }}
      >
        {/* Model Status & Loaded Check */}
        <Panel>
          <SectionLabel label="Model Status" color="#72D6A3" />
          <InfoRow
            label="Weights File"
            value={modelInfo?.file_name ?? 'best.pt'}
            accent
          />
          <InfoRow
            label="Inference State"
            value={
              isInferring
                ? 'Processing Frame…'
                : continuousScan
                ? 'Continuous Loop Active'
                : 'Ready for Testing'
            }
            color={continuousScan ? '#72D6A3' : '#6FA8FF'}
          />
          <InfoRow
            label="Active Classes"
            value={`${Object.keys(modelClasses).length || 80} Recognized`}
          />
        </Panel>

        {/* Live Performance & Latency Telemetry */}
        <Panel>
          <SectionLabel label="Inference Telemetry" color="#6FA8FF" />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                padding: '8px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Preprocess
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#C4CAD4', marginTop: 2 }}>
                {timingBreakdown ? `${timingBreakdown.pre}ms` : '—'}
              </div>
            </div>
            <div
              style={{
                padding: '8px',
                borderRadius: 10,
                background: 'rgba(155,138,251,0.08)',
                border: '1px solid rgba(155,138,251,0.20)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 8, color: 'var(--oc-accent)', textTransform: 'uppercase' }}>
                YOLO Infer
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#FFFFFF', marginTop: 2 }}>
                {timingBreakdown ? `${timingBreakdown.infer}ms` : '—'}
              </div>
            </div>
            <div
              style={{
                padding: '8px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.03)',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Postprocess
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#C4CAD4', marginTop: 2 }}>
                {timingBreakdown ? `${timingBreakdown.post}ms` : '—'}
              </div>
            </div>
          </div>
          <InfoRow
            label="Total Latency"
            value={timingBreakdown ? `${timingBreakdown.total} ms` : '—'}
            color="#9B8AFB"
            accent
          />
          <InfoRow
            label="Inference Speed"
            value={liveFps ? `${liveFps} FPS` : 'Standby'}
            color="#72D6A3"
          />
        </Panel>

        {/* Live Detected Objects Inspector */}
        <Panel>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <SectionLabel label={`Detections (${detections.length})`} color="#FFD166" />
            <button
              onClick={() => setShowJsonInspector((v) => !v)}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 8.5,
                color: 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {showJsonInspector ? 'Hide JSON' : '{ } Raw JSON'}
            </button>
          </div>

          {detections.length === 0 ? (
            <div
              style={{
                fontSize: 10,
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: '14px 0',
                letterSpacing: '0.08em',
              }}
            >
              No objects above {Math.round(conf * 100)}% confidence threshold.
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                maxHeight: 180,
                overflowY: 'auto',
              }}
            >
              {detections.map((det) => (
                <div
                  key={det.id}
                  onClick={() =>
                    setSelectedDetectionId((curr) => (curr === det.id ? null : det.id))
                  }
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 10,
                    background:
                      selectedDetectionId === det.id
                        ? 'rgba(155,138,251,0.22)'
                        : 'rgba(255,255,255,0.03)',
                    border:
                      selectedDetectionId === det.id
                        ? '1px solid rgba(155,138,251,0.50)'
                        : '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: 'var(--oc-accent)',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#F5F7FA',
                        textTransform: 'capitalize',
                      }}
                    >
                      {det.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                      [{det.x.toFixed(0)}%, {det.y.toFixed(0)}%]
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--oc-accent)',
                      }}
                    >
                      {(det.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Collapsible Raw JSON Inspector */}
          {showJsonInspector && lastRawJson && (
            <div style={{ marginTop: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 600,
                    letterSpacing: '0.14em',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  API Output Payload
                </span>
                <button
                  onClick={copyJsonToClipboard}
                  style={{
                    background: 'rgba(155,138,251,0.15)',
                    border: '1px solid rgba(155,138,251,0.30)',
                    borderRadius: 6,
                    padding: '2px 8px',
                    fontSize: 8.5,
                    color: '#E8E5FF',
                    cursor: 'pointer',
                  }}
                >
                  {copiedJson ? '✓ Copied' : 'Copy JSON'}
                </button>
              </div>
              <pre
                style={{
                  fontSize: 8.5,
                  padding: 10,
                  borderRadius: 10,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#6FA8FF',
                  overflowX: 'auto',
                  maxHeight: 140,
                }}
              >
                {JSON.stringify(lastRawJson, null, 2)}
              </pre>
            </div>
          )}
        </Panel>

        {/* Dynamic Sliders & AI Threshold Configuration */}
        <Panel>
          <SectionLabel label="Inference Parameters" color="var(--oc-accent-2)" />
          <SliderControl
            label="Confidence Threshold"
            value={conf}
            min={0.1}
            max={0.95}
            step={0.05}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => handleSliderChange('confidence_threshold', v)}
          />
          <div style={{ height: 14 }} />
          <SliderControl
            label="IoU (NMS Overlap)"
            value={iou}
            min={0.1}
            max={0.95}
            step={0.05}
            format={(v) => `${(v * 100).toFixed(0)}%`}
            onChange={(v) => handleSliderChange('iou_threshold', v)}
          />
          <div style={{ height: 14 }} />
          <SliderControl
            label="Inference Resolution"
            value={imgSize}
            min={320}
            max={1280}
            step={32}
            format={(v) => `${v}px`}
            onChange={(v) => handleSliderChange('image_size', v)}
          />
          {activeTab === 'live' && (
            <>
              <div style={{ height: 14 }} />
              <SliderControl
                label="Auto-Scan Sample Rate"
                value={sampleFps}
                min={1}
                max={10}
                step={1}
                format={(v) => `${v} FPS`}
                onChange={setSampleFps}
              />
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
