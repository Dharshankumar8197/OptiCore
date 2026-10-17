# Implementation Plan: OptiCore UI and Connectivity Restructure

## Overview

Full-stack restructure replacing the current six-page navigation (Vision, Camera, Devices, Model, Status, Settings) with four pages (Dashboard, Model, Connectivity, Settings). All pages consume real data from the FastAPI backend — no hardcoded, mocked, or fabricated values anywhere. The backend gains a WebSocket inference stream, enhanced system-status fields, real OS camera enumeration, and a Bluetooth management module. All schema changes go through Alembic migrations.

---

## Tasks

---

### PHASE 1 — Backend Foundation

- [ ] 1. Fix `main.py` — rename app title and prepare router slots
  - [ ] 1.1 In `backend/app/main.py`, change the `FastAPI(title=...)` argument from `"OptiCore Vision Lab Backend Application"` to `"OptiCore Backend"`
    - Add stub imports for `websocket` and `bluetooth` routers (they will be created in Phase 2); leave `app.include_router` calls commented until the modules exist
    - _Requirements: 17.1 (product name consistency), Design §13_

- [ ] 2. Add `access_state` column to `CameraSource` SQLAlchemy model
  - [ ] 2.1 In `backend/app/database/models.py`, add `access_state = Column(String(20), default="idle")` to the `CameraSource` class
    - Valid values are `"idle"`, `"pending"`, `"approved"`, `"denied"`
    - Do NOT modify any other column or existing model
    - _Requirements: 16.1, 14.2, 14.3, Design §15_

- [ ] 3. Create Alembic migration `002_add_camera_access_state.py`
  - [ ] 3.1 Create `backend/alembic/versions/002_add_camera_access_state.py`
    - Set `revision = '002'`, `down_revision = '001'`
    - `upgrade()`: `op.add_column('camera_sources', sa.Column('access_state', sa.String(20), nullable=False, server_default='idle'))`
    - `downgrade()`: `op.drop_column('camera_sources', 'access_state')`
    - Do NOT touch `001_initial_migration.py`
    - _Requirements: 14.3, 14.4, Design §15_

- [ ] 4. Create `backend/app/inference.py` — YOLO singleton
  - [ ] 4.1 Create the file with a module-level `_model` / `_model_loaded` pair and `get_model()` function that loads `best.pt` exactly once
    - Define `InferenceState` dataclass with fields: `running: bool`, `fps: float`, `latency_ms: float`, `detection_count: int`, `confidence: float`, `iou: float`
    - Expose module-level `inference_state = InferenceState()` instance
    - Wrap the `YOLO(path)` import in `try/except`; on failure set `_model = None` and `_model_loaded = True` so retries are suppressed
    - _Requirements: 3.2, 13.1–13.3, Design §12_

- [ ] 5. Create `backend/app/schemas/bluetooth.py`
  - [ ] 5.1 Define the following Pydantic models in a new file:
    - `BluetoothDeviceResponse` (id, device_id, name, address, device_type, status, signal_strength: Optional[int], last_seen: Optional[datetime]) with `from_attributes = True`
    - `BluetoothScanResult` (address, name, device_type, rssi: Optional[int], status)
    - `BluetoothConnectRequest` (address: str)
    - `TTSTestResponse` (status: str, routed_to: str)
    - _Requirements: 11.1–11.4, 12.4, Design §14_

- [ ] 6. Create `backend/app/schemas/system.py`
  - [ ] 6.1 Define the following Pydantic models in a new file:
    - `SystemStatusResponse` with all existing fields (backend, cpu, memory, disk, cpu_temp) plus new fields: wifi_connected, wifi_ssid, wifi_ip, wifi_interface, wifi_signal_dbm, usb_device_count, bluetooth_adapter_available, battery_percent, battery_plugged
    - `CameraEnumerationResponse` with field `cameras: List[CameraSourceResponse]` (import `CameraSourceResponse` from `schemas.device`)
    - All optional fields typed `Optional[...]`
    - _Requirements: 10.1–10.4, 15.3, Design §14_

---

### PHASE 2 — Backend API Enhancements

- [ ] 7. Enhance `system.py` `/api/status` endpoint with real system metrics
  - [ ] 7.1 Add platform-aware `get_wifi_info()` helper that uses `subprocess` + `platform.system()` to detect SSID on Linux (`iwgetid -r`), macOS (airport), and Windows (`netsh wlan show interfaces`); use `psutil.net_if_addrs()` for IP; return a dict with all five wifi fields, all defaulting to `null`/`False` on any exception
    - _Requirements: 10.1, 10.5_
  - [ ] 7.2 Add `get_usb_device_count()` helper that counts connected USB devices via `psutil` removable device enumeration (or OpenCV index probe as a fallback); return integer, never raise
    - _Requirements: 10.2, 10.5_
  - [ ] 7.3 Add `get_bluetooth_adapter_available()` helper that checks for an OS Bluetooth adapter using a `bleak` scanner availability check or platform command; return bool, never raise
    - _Requirements: 10.3, 10.5_
  - [ ] 7.4 In the `/api/status` route function, call all three new helpers and `psutil.sensors_battery()`; merge results into the existing return dict; add the new wifi, usb, bluetooth, and battery fields; ensure every helper call is wrapped in `try/except` returning `null` fields — the endpoint MUST return HTTP 200 regardless of hardware configuration
    - _Requirements: 10.1–10.5, Design §8_
  - [ ]* 7.5 Write a unit test for `/api/status` fault tolerance: mock all four helpers to raise exceptions and assert the endpoint still returns HTTP 200 with null values for the new fields
    - **Property 12: Backend Status Endpoint Fault Tolerance**
    - **Validates: Requirements 10.5**

- [ ] 8. Replace `/api/cameras` stub with real OpenCV camera enumeration
  - [ ] 8.1 In `system.py`, replace the hardcoded camera list with `enumerate_cameras()` that probes `cv2.VideoCapture(index)` for indices 0–4, builds an entry for each that opens, and releases the capture immediately; each entry must have `id`, `name`, `type` (`"local"` for index 0, `"usb"` for index > 0), `status: "connected"`, and optional `fps`; return empty list when no indices open; wrap in `try/except cv2.error`
    - _Requirements: 15.1–15.5, Design §9_
  - [ ]* 8.2 Write a unit test that mocks `cv2.VideoCapture` to always fail and asserts `GET /api/cameras` returns `{"cameras": []}` with HTTP 200
    - **Validates: Requirements 15.4, 15.5**

- [ ] 9. Create `backend/app/api/bluetooth.py`
  - [ ] 9.1 Create the file with `APIRouter(prefix="/api/bluetooth", tags=["bluetooth"])` and implement `GET /devices` that queries the `bluetooth_devices` table and returns `List[BluetoothDeviceResponse]`; filter by authenticated user's device IDs
    - _Requirements: 11.4, Design §10_
  - [ ] 9.2 Implement `POST /scan` that runs `bleak.BleakScanner.discover(timeout=5.0)`, upserts discovered devices into `bluetooth_devices` (by address), and returns `List[BluetoothScanResult]`; on `BleakError` or any OS exception return HTTP 503 with a descriptive `detail`
    - _Requirements: 11.1, 11.5, Design §10_
  - [ ] 9.3 Implement `POST /connect` that accepts `BluetoothConnectRequest`, connects to the device via `bleak`, updates the `bluetooth_devices` record `status` to `"connected"`, and returns `BluetoothDeviceResponse`; on error return HTTP 503
    - _Requirements: 11.2, 11.5, Design §10_
  - [ ] 9.4 Implement `POST /disconnect` that accepts `BluetoothConnectRequest`, disconnects the device, updates `status` to `"disconnected"`, and returns HTTP 200; on error return HTTP 503
    - _Requirements: 11.3, 11.5, Design §10_
  - [ ] 9.5 Implement `POST /tts-test` that uses `pyttsx3` to synthesize `"OptiCore Bluetooth audio test"`; if a connected Bluetooth audio device exists in `bluetooth_devices`, attempt to route to it; return `TTSTestResponse`; on no BT audio device, route to system default and return `routed_to: "default"` with HTTP 200
    - _Requirements: 12.1–12.4, Design §10_

- [ ] 10. Create `backend/app/api/websocket.py` — WebSocket inference stream
  - [ ] 10.1 Create the file with an `APIRouter` and `@router.websocket("/ws/inference")` endpoint
    - Import `inference_state` from `app.inference`
    - When `inference_state.running` is `True`: emit JSON with all six required fields (`running`, `fps`, `latency`, `detection_count`, `confidence_threshold`, `iou_threshold`) at 1 Hz (`asyncio.sleep(1.0)`)
    - When `inference_state.running` is `False`: emit `{"running": false}` at 5 Hz keepalive (`asyncio.sleep(5.0)`)
    - Catch `WebSocketDisconnect` cleanly with no unhandled exception
    - _Requirements: 13.1–13.4, Design §11_
  - [ ]* 10.2 Write an integration test that connects to `/ws/inference`, waits 6 s, and asserts at least one `{"running": false}` keepalive was received
    - **Property 13: WebSocket Message Schema**
    - **Validates: Requirements 13.2, 13.3**

- [ ] 11. Add camera access authorization endpoint
  - [ ] 11.1 In `backend/app/api/devices.py` (or a new `backend/app/api/cameras.py` module), add `POST /api/cameras/{camera_source_id}/request-access`
    - Look up `CameraSource` by ID; set `access_state = "pending"`; commit
    - Attempt to relay `{ "type": "camera_access_request", "camera_source_id": id }` to the associated WiFi device's WebSocket connection if one exists
    - Return `{"status": "pending"}` with HTTP 200
    - When an incoming WebSocket message of `{ "type": "camera_access_response", "camera_source_id": ..., "approved": bool }` is received, update `access_state` to `"approved"` or `"denied"` and push `{ "type": "camera_access_update", ... }` to the frontend WebSocket channel
    - _Requirements: 16.1–16.6, Design §16_
  - [ ]* 11.2 Write a property test for the camera access state machine: given any (current_state, action) pair, assert only valid transitions `idle → pending → approved` and `idle → pending → denied` are applied
    - **Property 11: Camera Access State Machine**
    - **Validates: Requirements 16.1, 16.2, 16.4, 16.5**

- [ ] 12. Register new routers in `main.py`
  - [ ] 12.1 In `backend/app/main.py`, add imports for `bluetooth` and `websocket` from `app.api`; call `app.include_router(bluetooth.router)` and `app.include_router(websocket.router)`; remove the placeholder comments added in Task 1.1
    - Also add a `lifespan` startup event (or direct import at module level) that calls `inference.get_model()` once to warm-load the YOLO model before the first request
    - _Requirements: 3.2, Design §12, §13_

- [ ] 13. Checkpoint — backend phase complete
  - Run `python -m pytest backend/` (or equivalent) to confirm all existing tests still pass and no import errors exist. Ask the user if questions arise.

---

### PHASE 3 — Frontend Foundation

- [ ] 14. Fix `OpticoreLogo.tsx` — remove "VISION LAB" subtitle
  - [ ] 14.1 In `web/src/components/OpticoreLogo.tsx`, delete the `<span>` element whose text content is `"VISION LAB"` from the `text` block; keep the SVG mark and `"OPTICORE"` wordmark unchanged
    - _Requirements: 8.4 (no legacy product sub-names), Design §3_

- [ ] 15. Rewrite `GlassNav.tsx` — four-item navigation
  - [ ] 15.1 In `web/src/components/GlassNav.tsx`, replace `NavPage` type and `NAV_PAGES` array to `'DASHBOARD' | 'MODEL' | 'CONNECTIVITY' | 'SETTINGS'` and `['DASHBOARD', 'MODEL', 'CONNECTIVITY', 'SETTINGS']`
    - Remove `VisionIcon`, `CameraIcon`, `DevicesIcon`, `StatusIcon` components
    - Add `DashboardIcon` (grid/squares SVG, 13×13, stroke-only) and `ConnectivityIcon` (signal/wifi-waves SVG, 13×13, stroke-only)
    - Keep `ModelIcon` and `SettingsIcon` unchanged
    - Update `PAGE_ICONS` and `PAGE_LABELS` maps for the four new pages
    - Active item style: background `rgba(255,255,255,0.105)`, border `rgba(255,255,255,0.15)`, active dot indicator (already implemented — preserve it)
    - _Requirements: 1.1, 1.3, 1.4, Design §2_
  - [ ]* 15.2 Write a property test (fast-check + React Testing Library) confirming that for any `active` prop value in `['DASHBOARD', 'MODEL', 'CONNECTIVITY', 'SETTINGS']`, the nav renders exactly 4 buttons with labels `['Dashboard', 'Model', 'Connectivity', 'Settings']` and none of the legacy labels appear
    - **Property 1: Navigation Completeness**
    - **Property 2: Active Navigation Style**
    - **Validates: Requirements 1.1, 1.3, 1.4**

- [ ] 16. Fix `globals.css` — typography contrast and glass opacity
  - [ ] 16.1 In `web/src/app/globals.css`:
    - Change `--text-secondary` from `#A6ACB8` to `#C4CAD4`
    - Change `--text-muted` from `#707784` to `#9AA2AE`
    - Add `.text-shadow-contrast { text-shadow: 0 1px 4px rgba(0,0,0,0.5); }` utility class
    - Change `.glass` background from `rgba(255,255,255,0.055)` to `rgba(255,255,255,0.070)`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, Design §17_

- [ ] 17. Create `web/src/lib/api.ts` — typed API client
  - [ ] 17.1 Create the file exporting all TypeScript interfaces that match the backend Pydantic schemas exactly (field names, types, optional markers): `HealthResponse`, `SystemStatusResponse`, `CameraSourceResponse`, `BluetoothDeviceResponse`, `BluetoothScanResult`, `WiFiDeviceResponse`, `ModelResponse`, `ModelConfigResponse`, `TTSTestResponse`
    - _Requirements: 14.5, Design §7_
  - [ ] 17.2 Implement `apiClient` object with typed async functions: `getHealth`, `getSystemStatus`, `getCameras`, `getModel`, `getModelConfig`, `updateModelConfig`, `getBluetoothDevices`, `scanBluetooth`, `connectBluetooth`, `disconnectBluetooth`, `testTTS`, `getWifiDevices`, `requestCameraAccess`
    - All functions use `process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'` as base URL
    - No `fetch` calls in any component — all go through this module
    - _Requirements: 2.1–2.12, 3.1–3.8, 4.1–4.4, 5.1–5.9, 6.1–6.9, 7.1–7.5, Design §7_
  - [ ]* 17.3 Write a unit test asserting that every function in `apiClient` constructs request URLs matching the documented endpoint paths and that response shapes conform to their TypeScript interfaces
    - **Property 14: API Response Field Consistency**
    - **Validates: Requirements 14.5**

---

### PHASE 4 — Dashboard Page

- [ ] 18. Create `web/src/components/pages/DashboardPage.tsx`
  - [ ] 18.1 Implement the `DashboardPage` component accepting `SystemState` as props
    - Layout: 2-column glass card grid; left column — 9 `StatusCard` components; right column — `PerformanceCard` and build info
    - Define reusable `StatusCard` component accepting `title: string` and `items: StatusItem[]`; `StatusItem` shape: `{ label: string; value: string; state: 'online' | 'offline' | 'standby' | 'loading' }`
    - _Requirements: 2.1, 8.1, Design §4_
  - [ ] 18.2 Wire all nine status indicators to real `SystemState` fields (no hardcoding):
    - Backend: `backendOnline` → ONLINE / OFFLINE
    - Model: `modelLoaded` → LOADED / NOT LOADED
    - Inference: `inferenceRunning` → RUNNING / STOPPED
    - Camera: any camera with `status: "connected"` from last `getCameras()` call → CONNECTED / DISCONNECTED
    - Wi-Fi: `wifiConnected` → CONNECTED (show `wifiSsid` + `wifiIp`) / DISCONNECTED
    - Bluetooth: `bluetoothAdapterAvailable` → AVAILABLE / UNAVAILABLE
    - USB: `usbDeviceCount` → display count
    - Power: `batteryPercent` + `batteryPlugged` → display values
    - Performance: `fps`, `latency`, `cpu`, `ram`, `detectionCount` from `SystemState`
    - _Requirements: 2.2–2.10, Design §4_
  - [ ] 18.3 Implement null/undefined fallback rendering: any `SystemState` field that is `null` or `undefined` renders as `"UNAVAILABLE"`, `"OFFLINE"`, or `"NOT DETECTED"` (as contextually appropriate) — never a numeric zero, empty string, or demo value
    - _Requirements: 2.12, Design §4_
  - [ ]* 18.4 Write a property test (fast-check) confirming that for any `SystemState` with arbitrarily null/undefined fields, the rendered `DashboardPage` never shows a raw `0`, empty string, or any of the legacy labels, and always shows a fallback string for null fields
    - **Property 3: Dashboard Status Mapping**
    - **Property 4: Null Value Fallback**
    - **Validates: Requirements 2.1–2.12**
  - [ ]* 18.5 Write a property test confirming that for any WebSocket message `{ fps, latency, detection_count }`, the `DashboardPage` displays those exact values (number-to-string only, no transformation)
    - **Property 5: Performance Metrics Passthrough**
    - **Validates: Requirements 2.10**

---

### PHASE 5 — Model Page Rewrite

- [ ] 19. Rewrite `web/src/components/pages/ModelPage.tsx`
  - [ ] 19.1 Replace the current `ModelPage` implementation with a 2-column layout: left column renders the existing `CameraViewport` component unchanged; right column renders a collapsible control panel with camera source selector, model info, threshold sliders, and inference metrics
    - Remove all references to `CAMERA_SOURCES` constant — it must not exist in the new file
    - Accept the `modelLoadedRef: React.MutableRefObject<boolean>` prop from the shell; on mount, check the ref before requesting model load — if `modelLoadedRef.current === true`, skip the load
    - _Requirements: 3.1, 3.2, Design §5_
  - [ ] 19.2 Implement the camera source selector: on mount, call `apiClient.getCameras()` and populate the selector with the returned list; sources with `status !== "connected"` are shown as disabled with an "UNAVAILABLE" label; no hardcoded entries
    - On source selection, call `POST /api/cameras/{id}/activate` (or the request-access flow for Wi-Fi sources); update the viewport accordingly
    - If `getCameras()` returns an empty list, show empty state "NO CAMERA DETECTED"
    - _Requirements: 3.3, 3.4, Design §5_
  - [ ] 19.3 Populate model info from `apiClient.getModel()`: display file name, framework, task, class count, status; if `model_loaded: true` show LOADED indicator, otherwise NOT LOADED; use class count for the classes display
    - _Requirements: 3.7, 3.8, Design §5_
  - [ ] 19.4 Wire threshold sliders (confidence 0.10–0.95 step 0.05, IoU 0.10–0.95 step 0.05, image size 320–1280 step 32) with 400 ms debounce to `apiClient.updateModelConfig()`; on API failure, snap slider back to previous value and show an inline error chip
    - _Requirements: 3.6, Design §5_
  - [ ] 19.5 Display inference metrics (FPS, latency, detection count, confidence per detection) sourced from `SystemState` props passed from the shell WebSocket stream; never fabricate values
    - _Requirements: 3.5, Design §5_
  - [ ]* 19.6 Write a property test that simulates N (1–20) navigation visits to `ModelPage` and asserts the model load function is called exactly once
    - **Property 6: Model Load Idempotence**
    - **Validates: Requirements 3.2**
  - [ ]* 19.7 Write a property test that for any `GET /api/cameras` response, the camera selector renders exactly the returned sources and disables all with `status !== "connected"`
    - **Property 7: Camera Source Selector Accuracy**
    - **Property 8: Model Metadata Completeness**
    - **Validates: Requirements 3.4, 3.7, 15.1, 15.5**

- [ ] 20. Checkpoint — Model page functional
  - Confirm that navigating to MODEL does not trigger a second model load and that sliders update the backend config. Ask the user if questions arise.

---

### PHASE 6 — Connectivity Page

- [ ] 21. Create `web/src/components/pages/ConnectivityPage.tsx` — tab shell
  - [ ] 21.1 Create the file with `ConnectivityTab = 'WIFI' | 'BLUETOOTH' | 'USB'` and a tab bar rendering three segments: "WI-FI", "BLUETOOTH", "USB / LOCAL"; default active tab is `'WIFI'`
    - Apply `Glass_Panel` style (`background: rgba(255,255,255,0.06)`, `backdrop-filter: blur(24px)`, `border: 1px solid rgba(255,255,255,0.12)`) to all sub-section containers
    - Accept `onNavigateToModel?: (cameraSourceId?: string) => void` prop for [OPEN IN MODEL] and [USE IN MODEL] shortcuts
    - _Requirements: 4.1–4.4, Design §6_
  - [ ]* 21.2 Write a unit test asserting `ConnectivityPage` defaults to the WI-FI tab on first render and that clicking tabs switches content without navigating away
    - **Property 9: Connectivity Tab Structure**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 22. Implement Wi-Fi sub-section inside `ConnectivityPage.tsx`
  - [ ] 22.1 Display network state card by reading `SystemState` props (`wifiConnected`, `wifiSsid`, `wifiIp`, `wifiInterface`, `wifiSignalDbm`); render "NOT DETECTED" for each null field — never hardcode network data
    - _Requirements: 5.1, 5.2, Design §6a_
  - [ ] 22.2 Display OptiCore Wi-Fi devices list by calling `apiClient.getWifiDevices()` on tab mount; render only entries returned by the API (from the `wifi_devices` table); when the list is empty, show "No OptiCore devices registered on this network."
    - _Requirements: 5.3, 5.4, Design §6a_
  - [ ] 22.3 Implement the camera access flow state machine in the Wi-Fi section:
    - `idle` state: show [REQUEST CAMERA ACCESS] button; on click call `apiClient.requestCameraAccess(cameraSourceId)`
    - `pending` state: show animated "Awaiting approval…" indicator
    - On WebSocket message `{ type: "camera_access_update", access_state: "approved" }`: transition to `approved`, show [OPEN IN MODEL] button that calls `onNavigateToModel(cameraSourceId)`
    - On WebSocket message `{ type: "camera_access_update", access_state: "denied" }`: transition to `denied`, show "ACCESS DENIED" label
    - After 30 s in `pending` with no response, revert to `idle`
    - _Requirements: 5.5–5.9, 16.1–16.7, Design §6a_
  - [ ]* 22.4 Write a unit test for the Wi-Fi section's null-field display: when `SystemState` has all wifi fields null, every field renders "NOT DETECTED"
    - **Property 10: Wi-Fi Field Mapping**
    - **Validates: Requirements 5.1, 5.2**

- [ ] 23. Implement Bluetooth sub-section inside `ConnectivityPage.tsx`
  - [ ] 23.1 Display Bluetooth adapter status from `SystemState.bluetoothAdapterAvailable` and list `BluetoothDevice[]` from `apiClient.getBluetoothDevices()` on tab mount; each card shows name, address, device_type, status, signal_strength (RSSI); when list is empty, show "No Bluetooth devices detected."
    - _Requirements: 6.1–6.4, Design §6b_
  - [ ] 23.2 Implement [SCAN] button: call `apiClient.scanBluetooth()`, show loading state during scan, merge newly discovered devices into the list; on HTTP 503 show "Bluetooth scan failed — adapter may be unavailable"
    - _Requirements: 6.5, Design §6b_
  - [ ] 23.3 Implement [CONNECT] button for available devices: call `apiClient.connectBluetooth(address)`, update device status on success; [DISCONNECT] for connected devices: call `apiClient.disconnectBluetooth(address)`
    - _Requirements: 6.6, 6.7, Design §6b_
  - [ ] 23.4 Implement [TEST TTS] button: call `apiClient.testTTS()`, display `routed_to` field value in a status chip; if no BT audio device is connected, still show result (will be "default")
    - _Requirements: 6.8, 6.9, Design §6b_

- [ ] 24. Implement USB / Local sub-section inside `ConnectivityPage.tsx`
  - [ ] 24.1 Call `apiClient.getCameras()` on tab mount, filter entries to `type === "usb"`, and display each with name, type, status; when filtered list is empty, show "No USB devices detected by the system."
    - Each USB camera entry has a [USE IN MODEL] button that calls `onNavigateToModel(camera.id)` to navigate to Model page with that source pre-selected
    - Also show `SystemState.usbDeviceCount` as a count indicator at the top of the section
    - _Requirements: 7.1–7.5, Design §6c_

- [ ] 25. Checkpoint — Connectivity page functional
  - Confirm that switching tabs does not re-mount the full page, that all three sections fetch from the backend (not hardcoded), and that empty-state messages appear when no data is returned. Ask the user if questions arise.

---

### PHASE 7 — App Shell Rewire

- [ ] 26. Rewrite `web/src/app/page.tsx` — new routing and extended state
  - [ ] 26.1 Replace all six `NavPage` routing blocks with four: `DASHBOARD`, `MODEL`, `CONNECTIVITY`, `SETTINGS`; set `activePage` default to `'DASHBOARD'`; remove imports for `VisionPage`, `CameraPage`, `DevicesPage`, `StatusPage`; add imports for `DashboardPage` and `ConnectivityPage`
    - _Requirements: 1.1, 1.5, Design §1_
  - [ ] 26.2 Extend `SystemState` interface with the new fields: `wifiConnected: boolean`, `wifiSsid: string | null`, `wifiIp: string | null`, `wifiInterface: string | null`, `wifiSignalDbm: number | null`, `usbDeviceCount: number`, `bluetoothAdapterAvailable: boolean`, `batteryPercent: number | null`, `batteryPlugged: boolean | null`
    - Update `DEFAULT_STATE` with safe defaults for each new field
    - Update the `pollBackend()` callback to map new fields from the `/api/status` response into `SystemState`
    - _Requirements: 2.11, 10.1–10.4, Design §1_
  - [ ] 26.3 Add a `modelLoadedRef = useRef<boolean>(false)` at the shell level; pass it as a prop to `ModelPage` so `ModelPage` can check and set it without re-triggering model load on navigation
    - _Requirements: 3.2, Design §5_
  - [ ] 26.4 Remove the `StatusStrip` floating bar component and its render from the JSX; metrics now live on `DashboardPage`
    - _Requirements: Design §1_
  - [ ] 26.5 Pass a `onNavigateToModel` callback to `ConnectivityPage` that calls `setActivePage('MODEL')` (and optionally pre-selects the camera source via a separate state var); pass the navigation callback so [OPEN IN MODEL] and [USE IN MODEL] shortcuts work across pages
    - _Requirements: 5.7, 7.5, Design §6_

---

### PHASE 8 — Cleanup

- [ ] 27. Delete obsolete frontend page files
  - [ ] 27.1 Delete `web/src/components/pages/VisionPage.tsx`
    - _Requirements: 1.3, 17.3_
  - [ ] 27.2 Delete `web/src/components/pages/DevicesPage.tsx`
    - _Requirements: 1.3, 17.3_
  - [ ] 27.3 Delete `web/src/components/pages/StatusPage.tsx`
    - _Requirements: 1.3, 17.3_
  - [ ] 27.4 Delete `web/src/components/pages/CameraPage.tsx`
    - _Requirements: 1.3, 17.3_

- [ ] 28. Verify no dangling references to removed pages
  - [ ] 28.1 Search the entire `web/src/` directory for any remaining imports of `VisionPage`, `CameraPage`, `DevicesPage`, `StatusPage`; remove or replace any found references
    - Also confirm there are no remaining uses of `CAMERA_SOURCES` constant anywhere in `web/src/`
    - Confirm `GlassNav` no longer exports or references `'VISION' | 'CAMERA' | 'DEVICES' | 'STATUS'`
    - _Requirements: 1.3, 17.3_

- [ ] 29. Final checkpoint — full system integration
  - Ensure all TypeScript types compile without errors (`tsc --noEmit` in `web/`), all Python modules import cleanly (`python -c "from app.main import app"` in `backend/`), and the Alembic migration `002` applies and reverts cleanly. Ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they do not block subsequent tasks.
- Every task references the specific requirement(s) it satisfies for traceability.
- Checkpoints (tasks 13, 20, 25, 29) are integration verification gates — no new code is written, only verification.
- Property tests use **Hypothesis** (Python backend) and **fast-check** (TypeScript frontend).
- The `001_initial_migration.py` file must never be modified under any circumstances.
- All new backend files go under `backend/app/` and all new frontend files go under `web/src/`.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1", "4.1", "5.1", "6.1"] },
    { "id": 1, "tasks": ["3.1", "12.1", "14.1", "15.1", "16.1", "17.1"] },
    { "id": 2, "tasks": ["7.1", "7.2", "7.3", "8.1", "9.1", "10.1", "15.2", "17.2"] },
    { "id": 3, "tasks": ["7.4", "7.5", "8.2", "9.2", "9.3", "9.4", "9.5", "10.2", "11.1", "17.3"] },
    { "id": 4, "tasks": ["11.2", "18.1", "19.1", "21.1"] },
    { "id": 5, "tasks": ["18.2", "18.3", "19.2", "19.3", "19.4", "19.5", "22.1", "22.2", "22.3", "23.1", "23.2", "23.3", "23.4", "24.1"] },
    { "id": 6, "tasks": ["18.4", "18.5", "19.6", "19.7", "21.2", "22.4", "26.1", "26.2", "26.3", "26.4", "26.5"] },
    { "id": 7, "tasks": ["27.1", "27.2", "27.3", "27.4"] },
    { "id": 8, "tasks": ["28.1"] }
  ]
}
```
