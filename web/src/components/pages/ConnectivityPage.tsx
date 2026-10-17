'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  apiClient,
  OpticalEndpoint,
  HostNetworkInfo,
  TTSRouteInfo,
  ConnectivityScanResponse,
} from '@/lib/api';

export interface ConnectivitySystemState {
  wifiConnected: boolean;
  wifiSsid: string | null;
  wifiIp: string | null;
  wifiInterface: string | null;
  wifiSignalDbm: number | null;
  bluetoothAdapterAvailable: boolean;
  usbDeviceCount: number;
}

interface ConnectivityPageProps {
  state: ConnectivitySystemState;
  onNavigateToModel?: (cameraSourceId?: string) => void;
  lastWsMessage?: { type?: string; camera_source_id?: string; access_state?: string } | null;
}

type FilterCategory = 'ALL' | 'CAMERAS' | 'AUDIO' | 'APP_USERS' | 'WIFI' | 'BLUETOOTH' | 'USB';

/* ── Glass Panel Wrapper ─────────────────────────────────────────────────── */
function GlassPanel({
  children,
  style,
  className,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        background: 'rgba(255, 255, 255, 0.045)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.10)',
        borderRadius: 20,
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
        padding: '18px 20px',
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
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
          pointerEvents: 'none',
        }}
      />
      {children}
    </div>
  );
}

/* ── Section Header Tag ─────────────────────────────────────────────────── */
function SectionTag({ label, color, rightBadge }: { label: string; color?: string; rightBadge?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: color ?? 'var(--oc-accent)',
            boxShadow: `0 0 7px ${color ?? 'var(--oc-accent)'}`,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: '0.20em',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {label}
        </span>
      </div>
      {rightBadge}
    </div>
  );
}

/* ── Category Badges ─────────────────────────────────────────────────────── */
function ConnectionBadge({ mode }: { mode: 'wifi' | 'bluetooth' | 'usb' }) {
  const map = {
    wifi: {
      label: 'Wi-Fi',
      color: '#72D6A3',
      bg: 'rgba(114, 214, 163, 0.12)',
      border: 'rgba(114, 214, 163, 0.28)',
      icon: (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 12.55a11 11 0 0114.08 0" />
          <path d="M1.42 9a16 16 0 0121.16 0" />
          <circle cx="12" cy="20" r="1.5" fill="currentColor" />
        </svg>
      ),
    },
    bluetooth: {
      label: 'Bluetooth',
      color: '#60A5FA',
      bg: 'rgba(96, 165, 250, 0.12)',
      border: 'rgba(96, 165, 250, 0.28)',
      icon: (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5" />
        </svg>
      ),
    },
    usb: {
      label: 'USB',
      color: '#FBBF24',
      bg: 'rgba(251, 191, 36, 0.12)',
      border: 'rgba(251, 191, 36, 0.28)',
      icon: (
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="19" r="2" />
          <path d="M12 17V7" />
          <path d="M5 12l7-5 7 5" />
        </svg>
      ),
    },
  };
  const c = map[mode] || map.wifi;

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.color,
        fontSize: 8.5,
        fontWeight: 600,
        letterSpacing: '0.10em',
        textTransform: 'uppercase',
      }}
    >
      {c.icon}
      <span>{c.label}</span>
    </span>
  );
}

/* ── Category Icon Helper ───────────────────────────────────────────────── */
function EndpointTypeIcon({ category, isAppUser }: { category: string; isAppUser?: boolean }) {
  if (isAppUser) {
    return (
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(155, 138, 251, 0.25), rgba(111, 168, 255, 0.15))',
          border: '1px solid rgba(155, 138, 251, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#F5F7FA',
          position: 'relative',
        }}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span
          style={{
            position: 'absolute',
            bottom: -2,
            right: -2,
            width: 14,
            height: 14,
            borderRadius: '50%',
            background: '#10B981',
            border: '2px solid #080A10',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg viewBox="0 0 24 24" width="8" height="8" fill="currentColor">
            <circle cx="12" cy="12" r="5" />
          </svg>
        </span>
      </div>
    );
  }

  const icons: Record<string, React.ReactNode> = {
    earbuds: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M3 14h3a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-7a9 9 0 0118 0v7a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3" />
      </svg>
    ),
    speaker: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="4" y="2" width="16" height="20" rx="2" />
        <circle cx="12" cy="14" r="4" />
        <line x1="12" y1="6" x2="12.01" y2="6" strokeWidth="3" />
      </svg>
    ),
    camera: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    ),
    device: (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <rect x="9" y="9" width="6" height="6" />
        <line x1="9" y1="1" x2="9" y2="4" />
        <line x1="15" y1="1" x2="15" y2="4" />
        <line x1="9" y1="20" x2="9" y2="23" />
        <line x1="15" y1="20" x2="15" y2="23" />
      </svg>
    ),
  };

  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 12,
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.09)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--text-secondary)',
      }}
    >
      {icons[category] || icons.device}
    </div>
  );
}

/* ── Primary Component ───────────────────────────────────────────────────── */
export function ConnectivityPage({ state, onNavigateToModel, lastWsMessage }: ConnectivityPageProps) {
  const [endpoints, setEndpoints] = useState<OpticalEndpoint[]>([]);
  const [hostInfo, setHostInfo] = useState<HostNetworkInfo | null>(null);
  const [ttsRoute, setTtsRoute] = useState<TTSRouteInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [filter, setFilter] = useState<FilterCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [activeMessage, setActiveMessage] = useState<string | null>(null);

  // Camera sharing modal state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareUserName, setShareUserName] = useState('My Optical Client');
  const [shareCameraFacing, setShareCameraFacing] = useState<'front' | 'rear'>('rear');
  const [sharePublic, setSharePublic] = useState(true);
  const [mySharedEndpointId, setMySharedEndpointId] = useState<string | null>(null);
  const [sharingLoading, setSharingLoading] = useState(false);

  // TTS testing state
  const [ttsTesting, setTtsTesting] = useState(false);
  const [ttsResult, setTtsResult] = useState<string | null>(null);

  /* ── Load unified connectivity scan ────────────────────────────────────── */
  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res = await apiClient.scanConnectivity();
      setEndpoints(res.endpoints || []);
      setHostInfo(res.host);
      setTtsRoute(res.tts_route);
    } catch (err: any) {
      console.warn('Unified connectivity scan failed:', err);
      // No dummy data — preserve real state or display accurate empty list
    } finally {
      setTimeout(() => setScanning(false), 600);
    }
  }, []);

  useEffect(() => {
    runScan();
    const interval = setInterval(runScan, 12000);
    return () => clearInterval(interval);
  }, [runScan]);

  /* ── Handle live WebSocket events ──────────────────────────────────────── */
  useEffect(() => {
    if (lastWsMessage?.type === 'camera_access_update' && lastWsMessage.camera_source_id) {
      const { camera_source_id, access_state } = lastWsMessage;
      setEndpoints(prev =>
        prev.map(ep =>
          ep.id === camera_source_id
            ? { ...ep, camera_status: access_state, status: access_state === 'approved' ? 'connected' : ep.status }
            : ep
        )
      );
      if (access_state === 'approved') {
        setActiveMessage(`Camera access granted for endpoint ${camera_source_id}`);
      }
    }
  }, [lastWsMessage]);

  /* ── Connect / Pair Endpoint Handler ────────────────────────────────────── */
  const handleConnectEndpoint = async (endpoint: OpticalEndpoint) => {
    setConnectingId(endpoint.id);
    setActiveMessage(null);
    try {
      const res = await apiClient.connectEndpoint(endpoint.id);

      setEndpoints(prev =>
        prev.map(ep => {
          if (ep.id === endpoint.id) {
            return {
              ...ep,
              status: 'connected',
              camera_status: ep.capabilities.includes('camera') ? 'approved' : ep.camera_status,
            };
          }
          return ep;
        })
      );

      if (endpoint.is_tts_sink) {
        setTtsRoute({
          active: true,
          routed_to: endpoint.name,
          device_address: endpoint.address,
          sink_type: endpoint.endpoint_category as 'earbuds' | 'speaker',
        });
      }

      setActiveMessage(res.message || `Connected to ${endpoint.name}`);

      // If it's a camera and access is immediately approved, offer direct navigation
      if (endpoint.capabilities.includes('camera') && onNavigateToModel) {
        // Automatically link to ModelPage
        setActiveMessage(`Connected to ${endpoint.name} camera. Ready for Vision Model.`);
      }
    } catch (e: any) {
      setActiveMessage(`Connection failed: ${e.message}`);
    } finally {
      setConnectingId(null);
    }
  };

  /* ── Share My Camera (Turn app user into Optical Endpoint) ───────────────── */
  const handleToggleShareCamera = async () => {
    if (mySharedEndpointId) {
      // Unshare
      try {
        await apiClient.unshareCamera(mySharedEndpointId);
        setMySharedEndpointId(null);
        setActiveMessage('Your camera is no longer shared on the mesh.');
        runScan();
      } catch (e: any) {
        setActiveMessage(`Could not stop sharing: ${e.message}`);
      }
      return;
    }

    setSharingLoading(true);
    try {
      const res = await apiClient.shareCamera({
        user_name: shareUserName,
        device_name: 'Android / Web Terminal',
        camera_facing: shareCameraFacing,
        is_public: sharePublic,
        resolution: '1920x1080',
      });
      setMySharedEndpointId(res.endpoint_id);
      setShowShareModal(false);
      setActiveMessage(`Camera shared publicly as "${res.endpoint.name}"! Peer devices can now connect.`);
      runScan();
    } catch (e: any) {
      setActiveMessage(`Failed to share camera: ${e.message}`);
    } finally {
      setSharingLoading(false);
    }
  };

  /* ── Trigger TTS Audio Test to Earbuds/Speaker ───────────────────────────── */
  const handleTestTts = async () => {
    setTtsTesting(true);
    setTtsResult(null);
    try {
      const res = await apiClient.triggerTtsTest();
      setTtsResult(`Speech routed to: ${res.routed_to}`);
    } catch (e: any) {
      setTtsResult(`TTS error: ${e.message}`);
    } finally {
      setTtsTesting(false);
    }
  };

  /* ── Filtered Optical Endpoints ─────────────────────────────────────────── */
  const filteredEndpoints = useMemo(() => {
    return endpoints.filter(ep => {
      // Category filter
      if (filter === 'CAMERAS' && !ep.capabilities.includes('camera')) return false;
      if (filter === 'AUDIO' && !ep.is_tts_sink) return false;
      if (filter === 'APP_USERS' && !ep.is_app_user) return false;
      if (filter === 'WIFI' && ep.connection_mode !== 'wifi') return false;
      if (filter === 'BLUETOOTH' && ep.connection_mode !== 'bluetooth') return false;
      if (filter === 'USB' && ep.connection_mode !== 'usb') return false;

      // Text search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = ep.name.toLowerCase().includes(q);
        const matchAddr = (ep.address || '').toLowerCase().includes(q);
        const matchUser = (ep.user_name || '').toLowerCase().includes(q);
        const matchMode = ep.connection_mode.toLowerCase().includes(q);
        return matchName || matchAddr || matchUser || matchMode;
      }
      return true;
    });
  }, [endpoints, filter, searchQuery]);

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingBottom: 20 }} className="page-enter">
      {/* ── Top Hero: Sonar Scanner Pulse & Mesh Radar ────────────────────── */}
      <GlassPanel style={{ marginBottom: 16, padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
          {/* Left: Animated Sonar Visualizer */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <div
              style={{
                position: 'relative',
                width: 72,
                height: 72,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {/* Concentric Sonar Pulses */}
              <div className="sonar-ring-pulse" style={{ animationDelay: '0s' }} />
              <div className="sonar-ring-pulse" style={{ animationDelay: '1.0s' }} />
              <div className="sonar-ring-pulse" style={{ animationDelay: '2.0s' }} />
              <div className="sonar-radar-sweep" />

              {/* Sonar Core Node */}
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #9B8AFB, #6FA8FF)',
                  boxShadow: '0 0 16px rgba(155, 138, 251, 0.7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#FFFFFF',
                    boxShadow: '0 0 8px #FFFFFF',
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-primary)', textTransform: 'uppercase' }}>
                  Unified Connectivity Mesh
                </span>
                <span
                  style={{
                    fontSize: 8.5,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 999,
                    background: scanning ? 'rgba(155, 138, 251, 0.2)' : 'rgba(114, 214, 163, 0.15)',
                    border: scanning ? '1px solid rgba(155, 138, 251, 0.4)' : '1px solid rgba(114, 214, 163, 0.3)',
                    color: scanning ? 'var(--oc-accent)' : 'var(--status-online)',
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                  }}
                >
                  {scanning ? '∿∿ Sonar Pulsing…' : '● Sonar Mesh Online'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Detecting all Wi-Fi nodes, Bluetooth audio endpoints, USB optical devices, and peer App Users on one radar.
              </div>
            </div>
          </div>

          {/* Right: Actions (Sonar Re-scan & Share Camera) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={runScan}
              disabled={scanning}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 12,
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.14)',
                color: 'var(--text-primary)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: scanning ? 'not-allowed' : 'pointer',
                backdropFilter: 'blur(10px)',
                transition: 'all 0.18s ease',
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: scanning ? 'rotate(180deg)' : 'none', transition: 'transform 0.6s ease' }}
              >
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
              </svg>
              {scanning ? 'Scanning…' : 'Ping Mesh'}
            </button>

            <button
              onClick={() => {
                if (mySharedEndpointId) {
                  handleToggleShareCamera();
                } else {
                  setShowShareModal(true);
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 18px',
                borderRadius: 12,
                background: mySharedEndpointId
                  ? 'rgba(239, 68, 68, 0.18)'
                  : 'linear-gradient(135deg, rgba(155, 138, 251, 0.25), rgba(111, 168, 255, 0.20))',
                border: mySharedEndpointId
                  ? '1px solid rgba(239, 68, 68, 0.45)'
                  : '1px solid rgba(155, 138, 251, 0.45)',
                color: mySharedEndpointId ? '#FCA5A5' : 'var(--text-primary)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                backdropFilter: 'blur(10px)',
                boxShadow: mySharedEndpointId ? '0 0 15px rgba(239, 68, 68, 0.2)' : '0 0 20px rgba(155, 138, 251, 0.15)',
                transition: 'all 0.2s ease',
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              {mySharedEndpointId ? 'Stop Sharing Camera' : '📷 Share My Camera (Make Public)'}
            </button>
          </div>
        </div>

        {/* Host Interface Summary Bar */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: '1px solid rgba(255, 255, 255, 0.07)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                Host Wi-Fi:
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                {hostInfo?.wifi_ssid || state.wifiSsid || 'Active Local Network'}
              </span>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: '50%',
                  background: hostInfo?.wifi_connected || state.wifiConnected ? 'var(--status-online)' : 'var(--status-offline)',
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                IP Address:
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {hostInfo?.wifi_ip || state.wifiIp || '127.0.0.1'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                Bluetooth:
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: hostInfo?.bluetooth_adapter_available ? 'var(--status-online)' : 'var(--text-muted)' }}>
                {hostInfo?.bluetooth_adapter_available ? 'Available' : 'Emulated / Standby'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.10em' }}>
                USB Devices:
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-primary)' }}>
                {hostInfo?.usb_device_count ?? state.usbDeviceCount} connected
              </span>
            </div>
          </div>

          <div style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.45)', letterSpacing: '0.08em' }}>
            {endpoints.length} Optical Endpoints Active
          </div>
        </div>
      </GlassPanel>

      {/* Active toast notification */}
      {activeMessage && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 14,
            padding: '10px 16px',
            borderRadius: 12,
            background: 'rgba(155, 138, 251, 0.12)',
            border: '1px solid rgba(155, 138, 251, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: 10,
            color: '#E0E7FF',
            letterSpacing: '0.04em',
          }}
        >
          <span>✦ {activeMessage}</span>
          <button
            onClick={() => setActiveMessage(null)}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12 }}
          >
            ✕
          </button>
        </motion.div>
      )}

      {/* ── Filter & Search Toolbar ────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
        }}
      >
        {/* Filter Chips */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '4px 6px',
            background: 'rgba(255, 255, 255, 0.035)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: 999,
            backdropFilter: 'blur(16px)',
          }}
        >
          {(
            [
              { id: 'ALL', label: 'All Endpoints' },
              { id: 'CAMERAS', label: 'Cameras 📷' },
              { id: 'AUDIO', label: 'Audio / TTS 🎧' },
              { id: 'APP_USERS', label: 'App Users 👤' },
              { id: 'WIFI', label: 'Wi-Fi 📶' },
              { id: 'BLUETOOTH', label: 'Bluetooth ᛒ' },
              { id: 'USB', label: 'USB ⑂' },
            ] as const
          ).map(tab => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: active ? '1px solid rgba(255, 255, 255, 0.16)' : '1px solid transparent',
                  background: active ? 'rgba(255, 255, 255, 0.11)' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 9,
                  fontWeight: active ? 600 : 400,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  boxShadow: active ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Quick Search */}
        <div style={{ position: 'relative', width: 220 }}>
          <input
            type="text"
            placeholder="Search endpoint or IP…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 30px',
              borderRadius: 12,
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.10)',
              color: 'var(--text-primary)',
              fontSize: 10,
              outline: 'none',
              backdropFilter: 'blur(10px)',
            }}
          />
          <svg
            viewBox="0 0 24 24"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </div>
      </div>

      {/* ── Optical Endpoints Grid ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        <AnimatePresence>
          {filteredEndpoints.map(ep => {
            const isConnecting = connectingId === ep.id;
            const isConnected = ep.status === 'connected';
            const isApproved = ep.camera_status === 'approved' || ep.camera_status === 'shared_public';

            return (
              <motion.div
                key={ep.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="endpoint-hover-card"
                style={{
                  background: isConnected
                    ? 'rgba(255, 255, 255, 0.055)'
                    : 'rgba(255, 255, 255, 0.035)',
                  border: isConnected
                    ? '1px solid rgba(114, 214, 163, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 16,
                  padding: '16px 18px',
                  position: 'relative',
                  overflow: 'hidden',
                  backdropFilter: 'blur(20px)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 14,
                }}
              >
                {/* Top: Header with Icon, Name, and Badges */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <EndpointTypeIcon category={ep.endpoint_category} isAppUser={ep.is_app_user} />
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span>{ep.name}</span>
                          {ep.is_app_user && (
                            <span
                              style={{
                                fontSize: 8,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: 'rgba(155, 138, 251, 0.2)',
                                color: 'var(--oc-accent)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                              }}
                            >
                              App User
                            </span>
                          )}
                        </div>

                        <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2, letterSpacing: '0.04em' }}>
                          {ep.address || 'Local Hardware'}
                          {ep.signal_strength != null ? ` · ${ep.signal_strength} dBm` : ''}
                          {ep.resolution ? ` · ${ep.resolution}` : ''}
                        </div>
                      </div>
                    </div>

                    <ConnectionBadge mode={ep.connection_mode} />
                  </div>

                  {/* Capabilities Tags & Camera Label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                    {ep.camera_label && (
                      <span
                        style={{
                          fontSize: 8.5,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.09)',
                          color: 'var(--text-secondary)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <svg viewBox="0 0 24 24" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="3" />
                          <path d="M19 4h-3.5L14 2H10L8.5 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z" />
                        </svg>
                        {ep.camera_label}
                      </span>
                    )}

                    {ep.is_tts_sink && (
                      <span
                        style={{
                          fontSize: 8.5,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(96, 165, 250, 0.12)',
                          border: '1px solid rgba(96, 165, 250, 0.25)',
                          color: '#93C5FD',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        🔊 Voice TTS Output
                      </span>
                    )}

                    {ep.camera_status === 'shared_public' && (
                      <span
                        style={{
                          fontSize: 8.5,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: 'rgba(114, 214, 163, 0.12)',
                          border: '1px solid rgba(114, 214, 163, 0.25)',
                          color: '#72D6A3',
                        }}
                      >
                        ✓ Public Camera Access
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom: Context-aware Connection & Actions */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: 12,
                    borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isConnected
                          ? 'var(--status-online)'
                          : ep.status === 'pending'
                          ? 'var(--status-standby)'
                          : 'rgba(255, 255, 255, 0.3)',
                        boxShadow: isConnected ? '0 0 8px var(--status-online)' : 'none',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 9,
                        color: isConnected ? 'var(--status-online)' : 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.10em',
                        fontWeight: 600,
                      }}
                    >
                      {isConnected ? 'Connected' : ep.status}
                    </span>
                  </div>

                  {/* Action Buttons based on Endpoint Category */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {/* Camera / App User Endpoints */}
                    {ep.capabilities.includes('camera') && (
                      <>
                        {!isConnected && ep.camera_status !== 'shared_public' && (
                          <button
                            onClick={() => handleConnectEndpoint(ep)}
                            disabled={isConnecting}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 10,
                              background: 'rgba(155, 138, 251, 0.16)',
                              border: '1px solid rgba(155, 138, 251, 0.35)',
                              color: 'rgba(155, 138, 251, 0.95)',
                              fontSize: 9.5,
                              fontWeight: 600,
                              letterSpacing: '0.10em',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                              backdropFilter: 'blur(8px)',
                            }}
                          >
                            {isConnecting ? 'Connecting…' : '📷 Connect Camera'}
                          </button>
                        )}

                        {(isConnected || ep.camera_status === 'shared_public') && onNavigateToModel && (
                          <button
                            onClick={() => onNavigateToModel(ep.id)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: 10,
                              background: 'linear-gradient(135deg, rgba(114, 214, 163, 0.20), rgba(155, 138, 251, 0.20))',
                              border: '1px solid rgba(114, 214, 163, 0.4)',
                              color: '#F5F7FA',
                              fontSize: 9.5,
                              fontWeight: 600,
                              letterSpacing: '0.10em',
                              textTransform: 'uppercase',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              boxShadow: '0 0 12px rgba(114, 214, 163, 0.15)',
                            }}
                          >
                            <span>⚡ Open in Model</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Bluetooth Earbuds / Speaker Endpoints */}
                    {ep.is_tts_sink && (
                      <button
                        onClick={() => handleConnectEndpoint(ep)}
                        disabled={isConnecting}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 10,
                          background: isConnected
                            ? 'rgba(114, 214, 163, 0.15)'
                            : 'rgba(96, 165, 250, 0.15)',
                          border: isConnected
                            ? '1px solid rgba(114, 214, 163, 0.35)'
                            : '1px solid rgba(96, 165, 250, 0.35)',
                          color: isConnected ? '#72D6A3' : '#93C5FD',
                          fontSize: 9.5,
                          fontWeight: 600,
                          letterSpacing: '0.10em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        {isConnecting
                          ? 'Pairing…'
                          : isConnected
                          ? '✓ TTS Bound'
                          : 'ᛒ Pair & Route TTS'}
                      </button>
                    )}

                    {/* Standard USB Camera */}
                    {ep.connection_mode === 'usb' && !ep.is_tts_sink && onNavigateToModel && (
                      <button
                        onClick={() => onNavigateToModel(ep.id)}
                        style={{
                          padding: '6px 14px',
                          borderRadius: 10,
                          background: 'rgba(251, 191, 36, 0.14)',
                          border: '1px solid rgba(251, 191, 36, 0.35)',
                          color: '#FCD34D',
                          fontSize: 9.5,
                          fontWeight: 600,
                          letterSpacing: '0.10em',
                          textTransform: 'uppercase',
                          cursor: 'pointer',
                        }}
                      >
                        Use in Model
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredEndpoints.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 13, marginBottom: 6 }}>No Optical Endpoints match this filter</div>
          <div style={{ fontSize: 10 }}>Try selecting "All Endpoints" or tap "Ping Mesh" above to scan.</div>
        </div>
      )}

      {/* ── Persistent Bottom Bar: Bluetooth Audio & TTS Output ─────────────── */}
      <GlassPanel style={{ marginTop: 20, padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Audio Waveform Animation */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 20 }}>
              <span className="audio-wave-bar" style={{ width: 3, background: '#60A5FA', borderRadius: 999, animation: 'audioWaveBar 1.0s ease-in-out infinite' }} />
              <span className="audio-wave-bar" style={{ width: 3, background: '#9B8AFB', borderRadius: 999, animation: 'audioWaveBar 0.8s ease-in-out 0.2s infinite' }} />
              <span className="audio-wave-bar" style={{ width: 3, background: '#72D6A3', borderRadius: 999, animation: 'audioWaveBar 1.2s ease-in-out 0.4s infinite' }} />
              <span className="audio-wave-bar" style={{ width: 3, background: '#60A5FA', borderRadius: 999, animation: 'audioWaveBar 0.9s ease-in-out 0.1s infinite' }} />
              <span className="audio-wave-bar" style={{ width: 3, background: '#9B8AFB', borderRadius: 999, animation: 'audioWaveBar 1.1s ease-in-out 0.3s infinite' }} />
            </div>

            <div>
              <div style={{ fontSize: 8.5, fontWeight: 600, letterSpacing: '0.18em', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                OptiCore Voice & Audio TTS Route
              </div>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-primary)', marginTop: 2 }}>
                {ttsRoute?.active
                  ? `Active Sink: ${ttsRoute.routed_to} (${ttsRoute.sink_type.toUpperCase()})`
                  : 'Active Sink: System Audio (Default)'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {ttsResult && (
              <span style={{ fontSize: 9.5, color: '#93C5FD', letterSpacing: '0.04em' }}>
                {ttsResult}
              </span>
            )}

            <button
              onClick={handleTestTts}
              disabled={ttsTesting}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 16px',
                borderRadius: 10,
                background: 'rgba(96, 165, 250, 0.15)',
                border: '1px solid rgba(96, 165, 250, 0.35)',
                color: '#93C5FD',
                fontSize: 9.5,
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                cursor: ttsTesting ? 'not-allowed' : 'pointer',
              }}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07" />
              </svg>
              {ttsTesting ? 'Speaking…' : 'Test Audio TTS'}
            </button>
          </div>
        </div>
      </GlassPanel>

      {/* ── Share Camera Modal ──────────────────────────────────────────────── */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(12px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              width: '100%',
              maxWidth: 420,
              background: '#0D101B',
              border: '1px solid rgba(155, 138, 251, 0.35)',
              borderRadius: 24,
              padding: '24px 26px',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.5), 0 0 30px rgba(155, 138, 251, 0.15)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Share Camera as Endpoint
              </div>
              <button
                onClick={() => setShowShareModal(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16 }}
              >
                ✕
              </button>
            </div>

            <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 16, lineHeight: 1.5 }}>
              Publish your Android or client camera to the OptiCore sonar mesh so other users and the Vision Model can access the live feed.
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  User / Device Name
                </label>
                <input
                  type="text"
                  value={shareUserName}
                  onChange={e => setShareUserName(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    color: '#FFFFFF',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>
                  Camera Lens Facing
                </label>
                <div style={{ display: 'flex', gap: 10 }}>
                  {(['rear', 'front'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setShareCameraFacing(f)}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: 10,
                        border: shareCameraFacing === f ? '1px solid var(--oc-accent)' : '1px solid rgba(255, 255, 255, 0.10)',
                        background: shareCameraFacing === f ? 'rgba(155, 138, 251, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                        color: shareCameraFacing === f ? 'var(--text-primary)' : 'var(--text-muted)',
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                      }}
                    >
                      {f === 'rear' ? 'Rear Sensor' : 'Front Selfie'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 12 }}>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 500, color: 'var(--text-primary)' }}>Make Camera Public</div>
                  <div style={{ fontSize: 8.5, color: 'var(--text-muted)' }}>Auto-approve access requests from peer users</div>
                </div>
                <input
                  type="checkbox"
                  checked={sharePublic}
                  onChange={e => setSharePublic(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#9B8AFB', cursor: 'pointer' }}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  style={{
                    flex: 1,
                    padding: '10px 0',
                    borderRadius: 12,
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.10)',
                    color: 'var(--text-muted)',
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleToggleShareCamera}
                  disabled={sharingLoading}
                  style={{
                    flex: 2,
                    padding: '10px 0',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg, rgba(155, 138, 251, 0.35), rgba(111, 168, 255, 0.30))',
                    border: '1px solid rgba(155, 138, 251, 0.5)',
                    color: '#FFFFFF',
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.10em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: '0 0 15px rgba(155, 138, 251, 0.25)',
                  }}
                >
                  {sharingLoading ? 'Publishing…' : 'Publish to Mesh'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
