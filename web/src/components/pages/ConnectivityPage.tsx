'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  apiClient,
  BluetoothDeviceResponse,
  BluetoothScanResult,
  WiFiDeviceResponse,
  CameraSourceResponse,
  WiFiNetwork,
} from '@/lib/api';

type ConnectivityTab = 'WIFI' | 'BLUETOOTH' | 'USB';
type CameraAccessState = 'idle' | 'pending' | 'approved' | 'denied';

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

/* ── Shared primitives ─────────────────────────────────────────────────── */
function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)',
      borderRadius: 20, boxShadow: '0 20px 60px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
      padding: '18px 20px', position: 'relative', overflow: 'hidden', ...style,
    }}>
      <div aria-hidden style={{ position:'absolute',top:0,left:'15%',right:'15%',height:1,
        background:'linear-gradient(90deg,transparent,rgba(255,255,255,0.10),transparent)',pointerEvents:'none'}} />
      {children}
    </div>
  );
}

function SectionLabel({ label, color }: { label: string; color?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:14 }}>
      <span style={{ width:4,height:4,borderRadius:'50%',background:color??'var(--oc-accent)',
        boxShadow:`0 0 6px ${color??'var(--oc-accent)'}`,flexShrink:0 }} />
      <span style={{ fontSize:8.5,fontWeight:600,letterSpacing:'0.22em',color:'var(--text-muted)',
        textTransform:'uppercase',textShadow:'0 1px 3px rgba(0,0,0,0.5)' }}>{label}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
      <span style={{ fontSize:9,fontWeight:500,letterSpacing:'0.14em',color:'var(--text-muted)',textTransform:'uppercase' }}>{label}</span>
      <span style={{ fontSize:12,fontWeight:300,color:'var(--text-primary)',letterSpacing:'0.03em',textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>{value}</span>
    </div>
  );
}

function StatusDot({ ok }: { ok: boolean }) {
  return <span style={{ width:6,height:6,borderRadius:'50%',flexShrink:0,display:'inline-block',
    background:ok?'var(--status-online)':'var(--status-offline)',
    boxShadow:ok?'0 0 7px var(--status-online)':'none' }} />;
}

function Btn({ children, onClick, variant='default', loading=false, disabled=false, sm=false }:
  { children:React.ReactNode; onClick?:()=>void; variant?:'default'|'primary'|'danger'|'ghost';
    loading?:boolean; disabled?:boolean; sm?:boolean }) {
  const map = {
    default:{ bg:'rgba(255,255,255,0.06)',  border:'rgba(255,255,255,0.12)', color:'var(--text-primary)' },
    primary:{ bg:'rgba(155,138,251,0.15)',  border:'rgba(155,138,251,0.35)', color:'rgba(155,138,251,0.9)' },
    danger: { bg:'rgba(228,125,135,0.12)',  border:'rgba(228,125,135,0.30)', color:'rgba(228,125,135,0.85)' },
    ghost:  { bg:'transparent',            border:'rgba(255,255,255,0.08)', color:'var(--text-muted)' },
  };
  const c = map[variant];
  return (
    <button onClick={onClick} disabled={disabled||loading} style={{
      padding:sm?'6px 12px':'8px 16px', background:c.bg, border:`1px solid ${c.border}`,
      borderRadius:10, color:c.color, fontSize:sm?9:10, fontWeight:500,
      letterSpacing:'0.14em', textTransform:'uppercase',
      cursor:(disabled||loading)?'not-allowed':'pointer', opacity:disabled?0.45:1,
      backdropFilter:'blur(8px)', WebkitBackdropFilter:'blur(8px)',
      transition:'opacity 0.15s', whiteSpace:'nowrap',
    }}>{loading?'…':children}</button>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div style={{ padding:'22px 0',textAlign:'center',fontSize:10,
    color:'var(--text-muted)',letterSpacing:'0.14em',textTransform:'uppercase' }}>{msg}</div>;
}

/* ── WiFi section ──────────────────────────────────────────────────────── */
function WiFiSection({ state, onNavigateToModel, lastWsMessage }:
  { state: ConnectivitySystemState; onNavigateToModel?:(id?:string)=>void;
    lastWsMessage?: ConnectivityPageProps['lastWsMessage'] }) {

  const [devices, setDevices] = useState<WiFiDeviceResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessStates, setAccessStates] = useState<Record<string,CameraAccessState>>({});
  const timers = useRef<Record<string,ReturnType<typeof setTimeout>>>({});

  // Nearby network scanner state
  const [networks, setNetworks]         = useState<WiFiNetwork[]>([]);
  const [scanning, setScanning]         = useState(false);
  const [scanError, setScanError]       = useState<string | null>(null);
  const [connecting, setConnecting]     = useState<string | null>(null);
  const [connectMsg, setConnectMsg]     = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState<string | null>(null);
  const [passwords, setPasswords]       = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiClient.getWifiDevices(); setDevices(r.devices??[]); }
    catch { setDevices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (lastWsMessage?.type !== 'camera_access_update') return;
    const { camera_source_id: id, access_state: st } = lastWsMessage;
    if (!id || !st) return;
    setAccessStates(p => ({ ...p, [id]: st as CameraAccessState }));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, [lastWsMessage]);

  const requestAccess = async (id: string) => {
    setAccessStates(p => ({ ...p, [id]: 'pending' }));
    try { await apiClient.requestCameraAccess(id); }
    catch { setAccessStates(p => ({ ...p, [id]: 'idle' })); return; }
    timers.current[id] = setTimeout(() =>
      setAccessStates(p => p[id]==='pending' ? { ...p, [id]:'idle' } : p), 30000);
  };

  const handleScan = async () => {
    setScanning(true); setScanError(null);
    try {
      const nets = await apiClient.scanWifi();
      setNetworks(nets);
    } catch (e) {
      setScanError(e instanceof Error ? e.message : 'Scan failed');
      setNetworks([]);
    } finally {
      setScanning(false);
    }
  };

  const handleConnect = async (ssid: string) => {
    setConnecting(ssid);
    setConnectMsg(p => ({ ...p, [ssid]: '' }));
    try {
      const pwd = passwords[ssid] || undefined;
      const res = await apiClient.connectWifi(ssid, pwd);
      setConnectMsg(p => ({ ...p, [ssid]: `✓ ${res.message}` }));
      setShowPassword(null);
      // refresh current network info after a moment
      setTimeout(load, 2000);
    } catch (e) {
      setConnectMsg(p => ({ ...p, [ssid]: `✕ ${e instanceof Error ? e.message : 'Failed'}` }));
    } finally {
      setConnecting(null);
    }
  };

  const signalBar = (sig: number | null) => {
    if (sig === null) return '—';
    if (sig >= 80) return '████';
    if (sig >= 60) return '███░';
    if (sig >= 40) return '██░░';
    if (sig >= 20) return '█░░░';
    return '░░░░';
  };

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      {/* Current network state */}
      <Panel>
        <SectionLabel label="Current Network" />
        <InfoRow label="Status"     value={state.wifiConnected ? 'Connected' : 'Disconnected'} />
        <InfoRow label="SSID"       value={state.wifiSsid ?? 'NOT DETECTED'} />
        <InfoRow label="IP Address" value={state.wifiIp ?? 'NOT DETECTED'} />
        <InfoRow label="Interface"  value={state.wifiInterface ?? 'NOT DETECTED'} />
        <InfoRow label="Signal"     value={state.wifiSignalDbm != null ? `${state.wifiSignalDbm} dBm` : 'NOT DETECTED'} />
      </Panel>

      {/* Nearby networks scanner */}
      <Panel>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
          <SectionLabel label="Available Networks" color="var(--oc-accent-2)" />
          <Btn variant="primary" sm onClick={handleScan} loading={scanning}>
            {scanning ? 'Scanning…' : '⌖ Scan'}
          </Btn>
        </div>

        {scanError && (
          <div style={{ padding:'8px 12px',background:'rgba(228,125,135,0.10)',border:'1px solid rgba(228,125,135,0.25)',
            borderRadius:10,fontSize:10,color:'rgba(228,125,135,0.85)',letterSpacing:'0.06em',marginBottom:12 }}>
            {scanError}
          </div>
        )}

        {networks.length === 0 && !scanning && (
          <Empty msg={scanError ? 'Scan failed — check Wi-Fi adapter' : 'Tap Scan to discover nearby networks'} />
        )}

        <div style={{ display:'flex',flexDirection:'column',gap:6 }}>
          {networks.map(net => {
            const isConnected = net.connected;
            const isBusy = connecting === net.ssid;
            const msg = connectMsg[net.ssid];
            const needsPassword = showPassword === net.ssid;
            return (
              <div key={net.ssid} style={{
                padding:'11px 13px',
                background: isConnected ? 'rgba(114,214,163,0.06)' : 'rgba(255,255,255,0.03)',
                border:`1px solid ${isConnected ? 'rgba(114,214,163,0.22)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius:13,
              }}>
                {/* Network row */}
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',gap:10 }}>
                  <div style={{ display:'flex',alignItems:'center',gap:9,minWidth:0 }}>
                    <StatusDot ok={isConnected} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:12,fontWeight:500,color:'var(--text-primary)',
                        whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>
                        {net.ssid}
                      </div>
                      <div style={{ fontSize:8.5,color:'var(--text-muted)',letterSpacing:'0.08em',
                        textTransform:'uppercase',marginTop:1,display:'flex',gap:8 }}>
                        <span style={{ color:'var(--oc-accent-2)',fontFamily:'monospace' }}>{signalBar(net.signal)}</span>
                        {net.signal != null && <span>{net.signal}%</span>}
                        {net.security && <span>{net.security}</span>}
                        {net.frequency && <span>{net.frequency}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ flexShrink:0 }}>
                    {isConnected
                      ? <span style={{ fontSize:9,color:'var(--status-online)',letterSpacing:'0.12em',textTransform:'uppercase' }}>● Connected</span>
                      : <Btn variant="primary" sm loading={isBusy}
                          onClick={() => net.security && net.security !== 'Open'
                            ? setShowPassword(needsPassword ? null : net.ssid)
                            : handleConnect(net.ssid)}>
                          {isBusy ? 'Connecting…' : 'Connect'}
                        </Btn>
                    }
                  </div>
                </div>

                {/* Password input */}
                {needsPassword && (
                  <div style={{ marginTop:10,display:'flex',gap:8,alignItems:'center' }}>
                    <input
                      type="password"
                      placeholder="Wi-Fi Password"
                      value={passwords[net.ssid] ?? ''}
                      onChange={e => setPasswords(p => ({ ...p, [net.ssid]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleConnect(net.ssid)}
                      style={{
                        flex:1, padding:'7px 12px',
                        background:'rgba(255,255,255,0.06)',
                        border:'1px solid rgba(255,255,255,0.15)',
                        borderRadius:9,
                        color:'var(--text-primary)', fontSize:12,
                        outline:'none',
                      }}
                    />
                    <Btn variant="primary" sm loading={isBusy} onClick={() => handleConnect(net.ssid)}>
                      Join
                    </Btn>
                    <Btn variant="ghost" sm onClick={() => setShowPassword(null)}>✕</Btn>
                  </div>
                )}

                {/* Status message */}
                {msg && (
                  <div style={{ marginTop:6,fontSize:9,
                    color: msg.startsWith('✓') ? 'var(--status-online)' : 'var(--status-offline)',
                    letterSpacing:'0.08em' }}>
                    {msg}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* OptiCore devices */}
      <Panel>
        <SectionLabel label="OptiCore Devices" color="var(--oc-accent)" />
        {loading ? <Empty msg="Checking for devices…" /> : devices.length === 0
          ? <Empty msg="No OptiCore devices registered on this network" />
          : <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
              {devices.map(dev => {
                const st = accessStates[dev.id] ?? 'idle';
                return (
                  <div key={dev.id} style={{ padding:'12px 14px', background:'rgba(255,255,255,0.03)',
                    border:'1px solid rgba(255,255,255,0.07)', borderRadius:14 }}>
                    <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                        <StatusDot ok={dev.status==='online'} />
                        <div>
                          <div style={{ fontSize:12,fontWeight:500,color:'var(--text-primary)' }}>{dev.name}</div>
                          <div style={{ fontSize:9,color:'var(--text-muted)',letterSpacing:'0.08em',textTransform:'uppercase',marginTop:2 }}>
                            {dev.ip_address} · {dev.device_type}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div style={{ display:'flex',alignItems:'center',gap:8,flexWrap:'wrap' }}>
                      {st==='idle' && <Btn variant="primary" sm onClick={()=>requestAccess(dev.id)}>📷 Request Camera Access</Btn>}
                      {st==='pending' && <span style={{ fontSize:9,color:'var(--status-standby)',letterSpacing:'0.12em',textTransform:'uppercase' }}>⏳ Awaiting Approval…</span>}
                      {st==='approved' && <>
                        <span style={{ fontSize:9,color:'var(--status-online)',letterSpacing:'0.12em',textTransform:'uppercase' }}>✓ Camera Available</span>
                        <Btn variant="primary" sm onClick={()=>onNavigateToModel?.(dev.id)}>Open in Model</Btn>
                      </>}
                      {st==='denied' && <>
                        <span style={{ fontSize:9,color:'var(--status-offline)',letterSpacing:'0.12em',textTransform:'uppercase' }}>✕ Access Denied</span>
                        <Btn variant="ghost" sm onClick={()=>setAccessStates(p=>({...p,[dev.id]:'idle'}))}>Retry</Btn>
                      </>}
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </Panel>
    </div>
  );
}

/* ── Bluetooth section ─────────────────────────────────────────────────── */
function BluetoothSection({ adapterAvailable }: { adapterAvailable: boolean }) {
  const [devices, setDevices]       = useState<BluetoothDeviceResponse[]>([]);
  const [scanExtra, setScanExtra]   = useState<BluetoothScanResult[]>([]);
  const [scanning, setScanning]     = useState(false);
  const [busy, setBusy]             = useState<string|null>(null);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsMsg, setTtsMsg]         = useState<string|null>(null);
  const [loading, setLoading]       = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiClient.getBluetoothDevices(); setDevices(Array.isArray(r)?r:[]); }
    catch { setDevices([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const scan = async () => {
    setScanning(true); setScanExtra([]);
    try { const r = await apiClient.scanBluetooth(); setScanExtra(Array.isArray(r)?r:[]); await load(); }
    catch { /* show empty */ }
    finally { setScanning(false); }
  };

  const connect = async (addr: string) => {
    setBusy(addr);
    try { await apiClient.connectBluetooth(addr); await load(); }
    catch { /* device stays disconnected */ }
    finally { setBusy(null); }
  };

  const disconnect = async (addr: string) => {
    setBusy(addr);
    try { await apiClient.disconnectBluetooth(addr); await load(); }
    catch { /* ignore */ }
    finally { setBusy(null); }
  };

  const testTTS = async () => {
    setTtsLoading(true); setTtsMsg(null);
    try {
      const r = await apiClient.testTTS();
      setTtsMsg(r.status==='ok' ? `✓ Routed to: ${r.routed_to}` : `✕ ${r.routed_to}`);
    } catch(e) { setTtsMsg(e instanceof Error ? `✕ ${e.message}` : '✕ Request failed'); }
    finally { setTtsLoading(false); }
  };

  const merged: BluetoothDeviceResponse[] = [
    ...devices,
    ...scanExtra.filter(r => !devices.some(d => d.address===r.address)).map(r => ({
      id:r.address, device_id:'', name:r.name, address:r.address,
      device_type:r.device_type, status:r.status,
      signal_strength:r.rssi??null, last_seen:null,
    })),
  ];

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      <Panel>
        <SectionLabel label="Bluetooth Adapter" />
        <InfoRow label="Status" value={adapterAvailable ? 'Available' : 'Unavailable'} />
        <div style={{ display:'flex',gap:8,marginTop:14,flexWrap:'wrap' }}>
          <Btn variant="primary" onClick={scan} loading={scanning} disabled={!adapterAvailable}>
            {scanning?'Scanning…':'⌖ Scan for Devices'}
          </Btn>
          <Btn onClick={testTTS} loading={ttsLoading} disabled={!adapterAvailable}>🔊 Test TTS</Btn>
        </div>
        {ttsMsg && <div style={{ marginTop:10,padding:'7px 12px',background:'rgba(255,255,255,0.04)',
          borderRadius:10,fontSize:10,color:'var(--text-secondary)',letterSpacing:'0.06em' }}>{ttsMsg}</div>}
      </Panel>
      <Panel>
        <SectionLabel label="Devices" color="var(--oc-accent-2)" />
        {loading ? <Empty msg="Loading…" /> : merged.length===0
          ? <Empty msg="No Bluetooth devices — tap Scan" />
          : <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {merged.map(dev => {
                const conn = dev.status==='connected';
                const isBusy = busy===dev.address;
                return (
                  <div key={dev.id||dev.address} style={{ padding:'11px 13px',background:'rgba(255,255,255,0.03)',
                    border:`1px solid ${conn?'rgba(114,214,163,0.20)':'rgba(255,255,255,0.07)'}`,borderRadius:13,
                    display:'flex',alignItems:'center',justifyContent:'space-between',gap:10 }}>
                    <div style={{ display:'flex',alignItems:'center',gap:9,minWidth:0 }}>
                      <StatusDot ok={conn} />
                      <div style={{ minWidth:0 }}>
                        <div style={{ fontSize:12,fontWeight:500,color:'var(--text-primary)',
                          whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis' }}>{dev.name}</div>
                        <div style={{ fontSize:8.5,color:'var(--text-muted)',letterSpacing:'0.08em',textTransform:'uppercase',marginTop:1 }}>
                          {dev.address}{dev.signal_strength!=null?` · ${dev.signal_strength} dBm`:''} · {dev.device_type}
                        </div>
                      </div>
                    </div>
                    {conn
                      ? <Btn variant="danger"  sm loading={isBusy} onClick={()=>disconnect(dev.address)}>Disconnect</Btn>
                      : <Btn variant="primary" sm loading={isBusy} onClick={()=>connect(dev.address)}>Connect</Btn>
                    }
                  </div>
                );
              })}
            </div>
        }
      </Panel>
    </div>
  );
}

/* ── USB / Local section ───────────────────────────────────────────────── */
function USBSection({ count, onNavigateToModel }:
  { count: number; onNavigateToModel?:(id?:string)=>void }) {

  const [cams, setCams]     = useState<CameraSourceResponse[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await apiClient.getCameras(); setCams((r.cameras??[]).filter(c=>c.source_type==='usb')); }
    catch { setCams([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      <Panel>
        <SectionLabel label="USB / Local Devices" />
        <InfoRow label="Total USB Devices" value={String(count)} />
      </Panel>
      <Panel>
        <SectionLabel label="USB Cameras" color="var(--oc-accent-2)" />
        {loading ? <Empty msg="Detecting…" /> : cams.length===0
          ? <Empty msg="No USB cameras detected by the system" />
          : <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
              {cams.map(cam => (
                <div key={cam.id} style={{ padding:'11px 13px',background:'rgba(255,255,255,0.03)',
                  border:'1px solid rgba(255,255,255,0.07)',borderRadius:13,
                  display:'flex',alignItems:'center',justifyContent:'space-between' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:9 }}>
                    <StatusDot ok={cam.status==='connected'} />
                    <div>
                      <div style={{ fontSize:12,fontWeight:500,color:'var(--text-primary)' }}>{cam.name}</div>
                      <div style={{ fontSize:8.5,color:'var(--text-muted)',letterSpacing:'0.08em',textTransform:'uppercase',marginTop:1 }}>
                        USB{cam.resolution?` · ${cam.resolution}`:''}
                      </div>
                    </div>
                  </div>
                  <Btn variant="primary" sm onClick={()=>onNavigateToModel?.(cam.id)}>Use in Model</Btn>
                </div>
              ))}
            </div>
        }
        <button onClick={load} style={{ marginTop:12,width:'100%',padding:'7px 0',
          background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',
          borderRadius:10,cursor:'pointer',fontSize:9,fontWeight:500,letterSpacing:'0.16em',
          textTransform:'uppercase',color:'var(--text-muted)' }}>↻ Refresh</button>
      </Panel>
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export function ConnectivityPage({ state, onNavigateToModel, lastWsMessage }: ConnectivityPageProps) {
  const [tab, setTab] = useState<ConnectivityTab>('WIFI');
  const tabs = [
    { id:'WIFI' as const, label:'Wi-Fi' },
    { id:'BLUETOOTH' as const, label:'Bluetooth' },
    { id:'USB' as const, label:'USB / Local' },
  ];

  return (
    <div style={{ flex:1,minHeight:0,overflowY:'auto',paddingBottom:12 }} className="page-enter">
      {/* Tab bar */}
      <div style={{ display:'inline-flex',alignItems:'center',gap:2,padding:'4px 4px',
        background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',
        borderRadius:999,marginBottom:18,backdropFilter:'blur(16px)',WebkitBackdropFilter:'blur(16px)' }}>
        {tabs.map(t => {
          const active = t.id===tab;
          return (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:'7px 18px',borderRadius:999,
              border:active?'1px solid rgba(255,255,255,0.15)':'1px solid transparent',
              background:active?'rgba(255,255,255,0.10)':'transparent',
              color:active?'var(--text-primary)':'var(--text-muted)',
              fontSize:10,fontWeight:active?500:400,letterSpacing:'0.12em',textTransform:'uppercase',
              cursor:'pointer',transition:'all 0.18s ease',
              boxShadow:active?'0 2px 10px rgba(0,0,0,0.20)':'none',
            }}>{t.label}</button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
          transition={{ duration:0.22, ease:'easeOut' }}>
          {tab==='WIFI' && (
            <WiFiSection state={state} onNavigateToModel={onNavigateToModel} lastWsMessage={lastWsMessage} />
          )}
          {tab==='BLUETOOTH' && (
            <BluetoothSection adapterAvailable={state.bluetoothAdapterAvailable} />
          )}
          {tab==='USB' && (
            <USBSection count={state.usbDeviceCount} onNavigateToModel={onNavigateToModel} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
