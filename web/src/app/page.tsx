'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AtmosphericBackground } from '@/components/AtmosphericBackground';
import { GlassNav, NavPage } from '@/components/GlassNav';
import { OpticoreLogo } from '@/components/OpticoreLogo';
import { DashboardPage, DashboardSystemState } from '@/components/pages/DashboardPage';
import { ModelPage, ModelPageSystemState } from '@/components/pages/ModelPage';
import { ConnectivityPage, ConnectivitySystemState } from '@/components/pages/ConnectivityPage';
import { apiClient } from '@/lib/api';

const rawWsUrl = process.env.NEXT_PUBLIC_WS_URL ?? (
  process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws')
    : 'ws://localhost:8000'
);
const WS_URL = rawWsUrl.replace(/\/+$/, '');

/* ── Full system state ─────────────────────────────────────────────────── */
interface SystemState {
  // Core
  backendOnline: boolean;
  modelLoaded: boolean;
  cameraConnected: boolean;
  inferenceRunning: boolean;
  // Performance (from WebSocket)
  fps: number | null;
  latency: number | null;
  detectionCount: number | null;
  // Model config
  confidence: number;
  iou: number;
  imageSize: number;
  // System resources
  cpu: number | null;
  ram: number | null;
  // Wi-Fi
  wifiConnected: boolean;
  wifiSsid: string | null;
  wifiIp: string | null;
  wifiInterface: string | null;
  wifiSignalDbm: number | null;
  // Connectivity
  bluetoothAdapterAvailable: boolean;
  usbDeviceCount: number;
  // Power
  batteryPercent: number | null;
  batteryPlugged: boolean | null;
}

const DEFAULT: SystemState = {
  backendOnline: false,
  modelLoaded: false,
  cameraConnected: false,
  inferenceRunning: false,
  fps: null, latency: null, detectionCount: null,
  confidence: 0.35, iou: 0.45, imageSize: 640,
  cpu: null, ram: null,
  wifiConnected: false, wifiSsid: null, wifiIp: null, wifiInterface: null, wifiSignalDbm: null,
  bluetoothAdapterAvailable: false, usbDeviceCount: 0,
  batteryPercent: null, batteryPlugged: null,
};

/* ── Settings page ─────────────────────────────────────────────────────── */
function SettingsPage() {
  return (
    <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center' }} className="page-enter">
      <div style={{ padding:'36px 40px',background:'rgba(255,255,255,0.05)',backdropFilter:'blur(24px)',
        WebkitBackdropFilter:'blur(24px)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:24,textAlign:'center',maxWidth:320 }}>
        <span style={{ fontSize:9,fontWeight:600,letterSpacing:'0.24em',color:'var(--text-muted)',textTransform:'uppercase',display:'block',marginBottom:10 }}>
          Settings
        </span>
        <span style={{ fontSize:12,fontWeight:300,color:'var(--text-secondary)',letterSpacing:'0.04em' }}>
          Configuration panel coming soon.
        </span>
      </div>
    </div>
  );
}

/* ── Header status chips ───────────────────────────────────────────────── */
function HeaderChip({ label, active }: { label: string; active: boolean }) {
  return (
    <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:3 }}>
      <span style={{ width:5,height:5,borderRadius:'50%',
        background:active?'var(--status-online)':'var(--status-offline)',
        boxShadow:active?'0 0 6px var(--status-online)':'none' }} />
      <span style={{ fontSize:7.5,fontWeight:600,letterSpacing:'0.18em',
        color:'var(--text-muted)',textTransform:'uppercase' }}>{label}</span>
    </div>
  );
}

/* ── Root component ────────────────────────────────────────────────────── */
export default function OptiCoreApp() {
  const [activePage, setActivePage] = useState<NavPage>('DASHBOARD');
  const [state, setState]           = useState<SystemState>(DEFAULT);
  const [preSelectedCamera, setPreSelectedCamera] = useState<string | null>(null);
  const [lastWsMsg, setLastWsMsg]   = useState<Record<string,string> | null>(null);
  const modelLoadedRef              = useRef<boolean>(false);

  /* ── Poll /health + /api/status every 5 s ── */
  const poll = useCallback(async () => {
    try {
      const health = await apiClient.getHealth();
      const cams   = await apiClient.getCameras().catch(() => ({ cameras: [] }));
      setState(prev => ({
        ...prev,
        backendOnline: health.status === 'ok',
        modelLoaded:   health.model_loaded,
        cameraConnected: cams.cameras.some(c => c.status === 'connected') || prev.cameraConnected,
      }));
    } catch {
      setState(prev => ({ ...prev, backendOnline: prev.inferenceRunning ? true : false }));
    }

    try {
      const status = await apiClient.getSystemStatus();
      setState(prev => ({
        ...prev,
        backendOnline: true,
        cpu:  status.cpu?.percent ?? null,
        ram:  status.memory?.percent ?? null,
        wifiConnected:             status.wifi_connected,
        wifiSsid:                  status.wifi_ssid,
        wifiIp:                    status.wifi_ip,
        wifiInterface:             status.wifi_interface,
        wifiSignalDbm:             status.wifi_signal_dbm,
        bluetoothAdapterAvailable: status.bluetooth_adapter_available,
        usbDeviceCount:            status.usb_device_count,
        batteryPercent:            status.battery_percent,
        batteryPlugged:            status.battery_plugged,
      }));
    } catch { /* backend may not be up yet */ }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, 5000);
    return () => clearInterval(id);
  }, [poll]);

  /* ── WebSocket /ws/inference ── */
  useEffect(() => {
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        ws = new WebSocket(`${WS_URL}/ws/inference`);
        ws.onopen  = () => {
          setState(prev => ({ ...prev, backendOnline: true }));
        };
        ws.onclose = () => { retry = setTimeout(connect, 5000); };
        ws.onerror = () => ws?.close();
        ws.onmessage = (ev) => {
          try {
            const msg = JSON.parse(ev.data as string);
            // Camera access updates
            if (msg.type === 'camera_access_update') {
              setLastWsMsg(msg);
              return;
            }
            setState(prev => ({
              ...prev,
              backendOnline: true,
              modelLoaded: true,
              inferenceRunning: msg.running ?? prev.inferenceRunning,
              cameraConnected: (msg.running || prev.cameraConnected),
              fps:              msg.fps             ?? prev.fps,
              latency:          msg.latency         ?? prev.latency,
              detectionCount:   msg.detection_count ?? prev.detectionCount,
            }));
          } catch { /* ignore malformed */ }
        };
      } catch {
        retry = setTimeout(connect, 5000);
      }
    };

    connect();
    return () => { clearTimeout(retry); ws?.close(); };
  }, []);

  /* ── Navigate to Model with pre-selected camera ── */
  const goToModel = useCallback((cameraId?: string) => {
    if (cameraId) setPreSelectedCamera(cameraId);
    setActivePage('MODEL');
  }, []);

  /* ── Derive sub-state slices ── */
  const dashState: DashboardSystemState = {
    backendOnline: state.backendOnline,
    modelLoaded: state.modelLoaded,
    inferenceRunning: state.inferenceRunning,
    cameraConnected: state.cameraConnected,
    wifiConnected: state.wifiConnected,
    wifiSsid: state.wifiSsid,
    wifiIp: state.wifiIp,
    bluetoothAdapterAvailable: state.bluetoothAdapterAvailable,
    usbDeviceCount: state.usbDeviceCount,
    batteryPercent: state.batteryPercent,
    batteryPlugged: state.batteryPlugged,
    fps: state.fps,
    latency: state.latency,
    cpu: state.cpu,
    ram: state.ram,
    detectionCount: state.detectionCount,
  };

  const modelState: ModelPageSystemState = {
    inferenceRunning: state.inferenceRunning,
    fps: state.fps,
    latency: state.latency,
    detectionCount: state.detectionCount,
    confidence: state.confidence,
    iou: state.iou,
    imageSize: state.imageSize,
  };

  const connState: ConnectivitySystemState = {
    wifiConnected: state.wifiConnected,
    wifiSsid: state.wifiSsid,
    wifiIp: state.wifiIp,
    wifiInterface: state.wifiInterface,
    wifiSignalDbm: state.wifiSignalDbm,
    bluetoothAdapterAvailable: state.bluetoothAdapterAvailable,
    usbDeviceCount: state.usbDeviceCount,
  };

  return (
    <>
      <AtmosphericBackground />
      <div style={{ position:'relative',display:'flex',flexDirection:'column',
        height:'100vh',width:'100vw',zIndex:10,padding:'18px 24px 14px',gap:0,overflow:'hidden' }}>

        {/* Header */}
        <header style={{ display:'flex',alignItems:'center',justifyContent:'space-between',zIndex:20,flexShrink:0 }}>
          <motion.div initial={{ opacity:0,x:-8 }} animate={{ opacity:1,x:0 }}
            transition={{ duration:0.55,ease:'easeOut' }} style={{ minWidth:140 }}>
            <OpticoreLogo markSize={32} layout="row" animate />
          </motion.div>

          <GlassNav active={activePage} onChange={setActivePage} />

          <motion.div initial={{ opacity:0,y:-6 }} animate={{ opacity:1,y:0 }}
            transition={{ duration:0.5,delay:0.1 }}
            style={{ display:'flex',alignItems:'center',gap:18,minWidth:120,justifyContent:'flex-end' }}>
            <HeaderChip label="Backend" active={state.backendOnline} />
            <HeaderChip label="Model"   active={state.modelLoaded} />
            <HeaderChip label="Camera"  active={state.cameraConnected} />
          </motion.div>
        </header>

        {/* Page content */}
        <div style={{ flex:1,minHeight:0,display:'flex',flexDirection:'column',marginTop:14 }}>
          <AnimatePresence mode="wait">
            <motion.div key={activePage}
              initial={{ opacity:0,y:6 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-4 }}
              transition={{ duration:0.25,ease:'easeOut' }}
              style={{ flex:1,minHeight:0,display:'flex',flexDirection:'column' }}>

              {activePage === 'DASHBOARD' && <DashboardPage state={dashState} />}

              {activePage === 'MODEL' && (
                <ModelPage
                  state={modelState}
                  modelLoadedRef={modelLoadedRef}
                  preSelectedCameraId={preSelectedCamera}
                  onCameraChange={(active) =>
                    setState(prev => ({ ...prev, cameraConnected: active }))
                  }
                  onConfigChange={(field, value) =>
                    setState(prev => ({
                      ...prev,
                      confidence: field==='confidence' ? value : prev.confidence,
                      iou:        field==='iou'        ? value : prev.iou,
                      imageSize:  field==='imageSize'  ? value : prev.imageSize,
                    }))
                  }
                />
              )}

              {activePage === 'CONNECTIVITY' && (
                <ConnectivityPage
                  state={connState}
                  onNavigateToModel={goToModel}
                  lastWsMessage={lastWsMsg}
                />
              )}

              {activePage === 'SETTINGS' && <SettingsPage />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
