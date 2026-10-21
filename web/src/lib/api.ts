/**
 * OptiCore typed API client.
 * All fetch calls go through this module — no direct fetch() in components.
 * Types mirror the backend Pydantic schemas exactly (field names, optionals).
 */

export function getApiBase(): string {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      const queryApi = params.get('api') || params.get('server');
      if (queryApi && queryApi.trim()) {
        const clean = queryApi.trim().replace(/\/+$/, '');
        localStorage.setItem('opticore_api_url', clean);
        return clean;
      }
    } catch {}

    const saved = localStorage.getItem('opticore_api_url');
    if (saved && saved.trim()) return saved.trim().replace(/\/+$/, '');
  }
  const rawApiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
  return rawApiBase.replace(/\/+$/, '');
}

export function getWsBase(): string {
  if (typeof window !== 'undefined') {
    const savedWs = localStorage.getItem('opticore_ws_url');
    if (savedWs && savedWs.trim()) return savedWs.trim().replace(/\/+$/, '');
    const savedApi = localStorage.getItem('opticore_api_url');
    if (savedApi && savedApi.trim()) {
      return savedApi.trim().replace(/^http/, 'ws').replace(/\/+$/, '');
    }
  }
  const rawWsUrl = process.env.NEXT_PUBLIC_WS_URL ?? (
    process.env.NEXT_PUBLIC_API_URL
      ? process.env.NEXT_PUBLIC_API_URL.replace(/^http/, 'ws')
      : 'ws://localhost:8000'
  );
  return rawWsUrl.replace(/\/+$/, '');
}

export function setServerUrl(apiUrl: string, wsUrl?: string) {
  if (typeof window === 'undefined') return;
  const cleanApi = apiUrl.trim().replace(/\/+$/, '');
  localStorage.setItem('opticore_api_url', cleanApi);
  const cleanWs = wsUrl && wsUrl.trim()
    ? wsUrl.trim().replace(/\/+$/, '')
    : cleanApi.replace(/^http/, 'ws');
  localStorage.setItem('opticore_ws_url', cleanWs);
}

// ── Response types ────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'ok' | 'error';
  model_loaded: boolean;
  model_status: string;
  version: string;
}

export interface SystemStatusResponse {
  backend: string;
  cpu: { percent: number; count: number };
  memory: { percent: number; used_mb: number; total_mb: number };
  disk: { percent: number; used_gb: number; total_gb: number };
  cpu_temp: number | null;
  // Wi-Fi
  wifi_connected: boolean;
  wifi_ssid: string | null;
  wifi_ip: string | null;
  wifi_interface: string | null;
  wifi_signal_dbm: number | null;
  // USB
  usb_device_count: number;
  // Bluetooth adapter
  bluetooth_adapter_available: boolean;
  // Power
  battery_percent: number | null;
  battery_plugged: boolean | null;
}

export interface CameraSourceResponse {
  id: string;
  name: string;
  /** 'local' | 'usb' | 'rtsp' | 'http' */
  source_type: string;
  status: 'connected' | 'disconnected' | 'error';
  resolution: string | null;
  fps: number;
  device_id?: string;
}

export interface ModelResponse {
  id: string;
  name: string;
  version: string;
  file_name: string;
  framework: string;
  task: string;
  class_count: number;
  status: string;
  created_at: string;
}

export interface ModelConfigResponse {
  confidence_threshold: number;
  iou_threshold: number;
  image_size: number;
}

export interface ModelConfigUpdate {
  confidence_threshold?: number;
  iou_threshold?: number;
  image_size?: number;
}

export interface DetectionItem {
  id: string;
  class_id: number;
  class_name: string;
  confidence: number;
  box: { x: number; y: number; width: number; height: number };
  normalized_box: { x: number; y: number; width: number; height: number };
  tracking_id?: number | null;
}

export interface DetectResponse {
  inference_time_ms: number;
  preprocess_ms: number;
  postprocess_ms: number;
  total_time_ms: number;
  detection_count: number;
  image_width: number;
  image_height: number;
  detections: DetectionItem[];
  annotated_image_base64: string | null;
  model_name: string;
  is_mock: boolean;
}

export interface ModelClassesResponse {
  class_count: number;
  classes: Record<string, string>;
  model_file: string;
  framework: string;
}

export interface BluetoothDeviceResponse {
  id: string;
  device_id: string;
  name: string;
  address: string;
  device_type: string;
  status: string;
  signal_strength: number | null;
  last_seen: string | null;
}

export interface BluetoothScanResult {
  address: string;
  name: string;
  device_type: string;
  rssi: number | null;
  status: string;
}

export interface WiFiDeviceResponse {
  id: string;
  device_id: string;
  name: string;
  ip_address: string;
  port: number;
  device_type: string;
  status: string;
  last_seen: string | null;
}

export interface TTSTestResponse {
  status: string;
  routed_to: string;
}

export interface OpticalEndpoint {
  id: string;
  name: string;
  endpoint_category: 'app_user' | 'camera' | 'earbuds' | 'speaker' | 'device';
  connection_mode: 'wifi' | 'bluetooth' | 'usb';
  status: string;
  address?: string | null;
  signal_strength?: number | null;
  capabilities: string[];
  camera_status?: string | null;
  camera_label?: string | null;
  user_name?: string | null;
  stream_url?: string | null;
  is_app_user: boolean;
  is_tts_sink: boolean;
  resolution?: string | null;
}

export interface HostNetworkInfo {
  wifi_connected: boolean;
  wifi_ssid: string | null;
  wifi_ip: string | null;
  wifi_interface: string | null;
  wifi_signal_dbm: number | null;
  bluetooth_adapter_available: boolean;
  usb_device_count: number;
}

export interface TTSRouteInfo {
  active: boolean;
  routed_to: string;
  device_address?: string | null;
  sink_type: 'earbuds' | 'speaker' | 'system';
}

export interface ConnectivityScanResponse {
  scan_timestamp: string;
  host: HostNetworkInfo;
  endpoints: OpticalEndpoint[];
  tts_route: TTSRouteInfo;
}

export interface ShareCameraPayload {
  user_name: string;
  device_name: string;
  camera_facing?: 'front' | 'rear';
  is_public?: boolean;
  stream_url?: string;
  resolution?: string;
}

export interface ShareCameraResponse {
  status: string;
  endpoint_id: string;
  message: string;
  endpoint: OpticalEndpoint;
}

export interface WiFiNetwork {
  ssid: string;
  bssid: string | null;
  signal: number | null;        // 0-100 %
  signal_dbm: number | null;    // dBm
  security: string | null;
  frequency: string | null;
  connected: boolean;
}

export interface WiFiConnectResponse {
  status: string;
  ssid: string;
  message: string;
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = {};
    if (options?.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    if (options?.headers) {
      Object.assign(headers, options.headers);
    }

    const baseUrl = getApiBase();
    const res = await fetch(`${baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timer);
  }
}

// ── API client ────────────────────────────────────────────────────────────────

export const apiClient = {
  // Health
  getHealth(): Promise<HealthResponse> {
    return apiFetch<HealthResponse>('/health', undefined, 3000);
  },

  // System status
  getSystemStatus(): Promise<SystemStatusResponse> {
    return apiFetch<SystemStatusResponse>('/api/status');
  },

  // Cameras
  getCameras(): Promise<{ cameras: CameraSourceResponse[] }> {
    return apiFetch<{ cameras: CameraSourceResponse[] }>('/api/cameras');
  },

  // Model
  getModel(): Promise<ModelResponse | null> {
    return apiFetch<ModelResponse | null>('/api/model');
  },

  getModelClasses(): Promise<ModelClassesResponse> {
    return apiFetch<ModelClassesResponse>('/api/model/classes');
  },

  getModelConfig(): Promise<ModelConfigResponse | null> {
    return apiFetch<ModelConfigResponse | null>('/api/model/config');
  },

  updateModelConfig(cfg: ModelConfigUpdate): Promise<ModelConfigResponse> {
    return apiFetch<ModelConfigResponse>('/api/model/config', {
      method: 'PUT',
      body: JSON.stringify(cfg),
    });
  },

  detectBase64(payload: {
    image_base64: string;
    confidence_threshold?: number;
    iou_threshold?: number;
    image_size?: number;
    return_annotated?: boolean;
  }): Promise<DetectResponse> {
    return apiFetch<DetectResponse>('/api/model/detect/base64', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, 10000);
  },

  async detectImage(
    file: File | Blob,
    options?: {
      confidence_threshold?: number;
      iou_threshold?: number;
      image_size?: number;
      return_annotated?: boolean;
    },
  ): Promise<DetectResponse> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.confidence_threshold !== undefined) {
      formData.append('confidence_threshold', String(options.confidence_threshold));
    }
    if (options?.iou_threshold !== undefined) {
      formData.append('iou_threshold', String(options.iou_threshold));
    }
    if (options?.image_size !== undefined) {
      formData.append('image_size', String(options.image_size));
    }
    if (options?.return_annotated !== undefined) {
      formData.append('return_annotated', String(options.return_annotated));
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const baseUrl = getApiBase();
      const res = await fetch(`${baseUrl}/api/model/detect`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return res.json() as Promise<DetectResponse>;
    } finally {
      clearTimeout(timer);
    }
  },

  // Bluetooth
  getBluetoothDevices(): Promise<BluetoothDeviceResponse[]> {
    return apiFetch<BluetoothDeviceResponse[]>('/api/bluetooth/devices');
  },

  scanBluetooth(): Promise<BluetoothScanResult[]> {
    return apiFetch<BluetoothScanResult[]>('/api/bluetooth/scan', { method: 'POST' }, 12000);
  },

  connectBluetooth(address: string): Promise<BluetoothDeviceResponse> {
    return apiFetch<BluetoothDeviceResponse>('/api/bluetooth/connect', {
      method: 'POST',
      body: JSON.stringify({ address }),
    }, 15000);
  },

  disconnectBluetooth(address: string): Promise<void> {
    return apiFetch<void>('/api/bluetooth/disconnect', {
      method: 'POST',
      body: JSON.stringify({ address }),
    });
  },

  testTTS(): Promise<TTSTestResponse> {
    return apiFetch<TTSTestResponse>('/api/bluetooth/tts-test', { method: 'POST' }, 15000);
  },

  // Wi-Fi devices
  getWifiDevices(): Promise<{ devices: WiFiDeviceResponse[] }> {
    return apiFetch<{ devices: WiFiDeviceResponse[] }>('/api/wifi/devices');
  },

  // Camera access authorization
  requestCameraAccess(cameraSourceId: string): Promise<{ status: string; camera_source_id: string }> {
    return apiFetch(`/api/devices/cameras/${cameraSourceId}/request-access`, { method: 'POST' });
  },

  // Wi-Fi scan & connect
  scanWifi(): Promise<WiFiNetwork[]> {
    return apiFetch<WiFiNetwork[]>('/api/wifi/scan', undefined, 15000);
  },

  connectWifi(ssid: string, password?: string): Promise<WiFiConnectResponse> {
    return apiFetch<WiFiConnectResponse>('/api/wifi/connect', {
      method: 'POST',
      body: JSON.stringify({ ssid, password: password ?? null }),
    }, 25000);
  },

  disconnectWifi(): Promise<{ status: string }> {
    return apiFetch('/api/wifi/disconnect', { method: 'POST' });
  },

  // ── Unified Connectivity & Sonar Mesh ───────────────────────────────────────
  scanConnectivity(): Promise<ConnectivityScanResponse> {
    return apiFetch<ConnectivityScanResponse>('/api/connectivity/scan', undefined, 12000);
  },

  shareCamera(payload: ShareCameraPayload): Promise<ShareCameraResponse> {
    return apiFetch<ShareCameraResponse>('/api/connectivity/share-camera', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  unshareCamera(endpointId: string): Promise<{ status: string }> {
    return apiFetch<{ status: string }>(`/api/connectivity/share-camera/${endpointId}`, {
      method: 'DELETE',
    });
  },

  connectEndpoint(endpointId: string): Promise<{
    status: string;
    endpoint_id: string;
    type?: string;
    camera_access?: string;
    tts_routed?: boolean;
    message?: string;
    stream_url?: string;
  }> {
    return apiFetch(`/api/connectivity/connect-endpoint/${endpointId}`, {
      method: 'POST',
    });
  },

  triggerTtsTest(): Promise<TTSTestResponse> {
    return apiFetch<TTSTestResponse>('/api/connectivity/tts-test', { method: 'POST' }, 12000);
  },
};
