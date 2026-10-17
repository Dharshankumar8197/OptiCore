# Requirements Document

## Introduction

OptiCore is an AI-powered vision platform consisting of a Next.js web frontend, a FastAPI backend, a mobile app, and Raspberry Pi runtime. This feature is a full UI and connectivity restructure of the existing OptiCore application.

The restructure replaces the current multi-page navigation (Vision, Camera, Devices, Model, Status) with a consolidated four-section navigation: **Dashboard | Model | Connectivity | Settings**. All pages must consume real data from the existing backend APIs and database — no hardcoded, mocked, or fake device/sensor values are permitted anywhere in the UI.

The existing database schema (SQLAlchemy models, Alembic migrations, Pydantic schemas, API contracts) must remain fully intact and backward-compatible. Any genuinely missing backend capabilities must be added through the existing migration system and models — not through workarounds.

The visual language is premium glassmorphism: dark navy/charcoal background, frosted glass panels, subtle violet/blue ambient gradients, and strict typography contrast rules.

---

## Glossary

- **Frontend**: The Next.js web application in `web/`.
- **Backend**: The FastAPI Python application in `backend/`.
- **API**: The HTTP REST endpoints exposed by the Backend on port 8000.
- **WebSocket**: The persistent WebSocket connection from the Frontend to the Backend (`ws://host/ws/inference`).
- **Navigation**: The floating glassmorphism pill bar at the top of the Frontend shell.
- **Dashboard**: The new top-level page showing real system health and performance metrics.
- **Model_Page**: The new top-level page combining the current Vision and Model pages — live camera feed with YOLO inference plus model configuration.
- **Connectivity_Page**: The new top-level page with three sub-sections: Wi-Fi, Bluetooth, and USB/Local.
- **Settings_Page**: The existing settings placeholder, kept as a minimal page for future configuration.
- **Glass_Panel**: A UI element styled with `background: rgba(255,255,255,0.06)`, `backdrop-filter: blur(24px)`, and `border: 1px solid rgba(255,255,255,0.12)`.
- **Status_Indicator**: A colored dot (5×5 px) with an optional glow, paired with an uppercase label.
- **YOLO_Model**: The `best.pt` Ultralytics YOLO model file located at `backend/models/best.pt`, managed through the existing `models` and `model_configs` database tables.
- **Inference_Session**: A record in the `inference_sessions` table representing an active or completed YOLO inference run.
- **Detection_Event**: A single bounding-box result stored in the `detection_events` table.
- **Device**: A record in the `devices` table. A Device is a registered OptiCore-compatible hardware endpoint, not a generic network host.
- **Camera_Source**: A record in the `camera_sources` table linked to a Device.
- **Bluetooth_Device**: A record in the `bluetooth_devices` table representing a paired OS-level Bluetooth peripheral.
- **WiFi_Device**: A record in the `wifi_devices` table representing a discovered OptiCore-compatible Wi-Fi endpoint.
- **WebRTC**: The browser-native peer-to-peer video streaming protocol used for remote camera streams.
- **TTS**: Text-to-speech audio synthesis routed through the system's audio output.
- **Pi**: The Raspberry Pi runtime in `pi/`.

---

## Requirements

---

### Requirement 1: Navigation Restructure

**User Story:** As a user, I want a clean four-item navigation bar so that I can access all major features without cognitive clutter.

#### Acceptance Criteria

1. THE Frontend SHALL render a floating glass pill navigation bar containing exactly four items in the following order: DASHBOARD, MODEL, CONNECTIVITY, SETTINGS.
2. WHEN the user clicks a navigation item, THE Frontend SHALL transition to the corresponding page with a fade-and-slide animation of duration 280ms or less.
3. THE Navigation SHALL remove all references to the previous navigation items: VISION, CAMERA, DEVICES, STATUS.
4. THE Navigation SHALL apply the active-item style (background `rgba(255,255,255,0.105)`, border `rgba(255,255,255,0.15)`, active dot indicator) to the currently selected page.
5. WHILE the Frontend is loading the initial page, THE Navigation SHALL default the active item to DASHBOARD.

---

### Requirement 2: Dashboard — Real System Status

**User Story:** As a user, I want a dashboard that shows the live state of every system component so that I can diagnose issues at a glance without consulting logs.

#### Acceptance Criteria

1. THE Dashboard SHALL display a Status_Indicator for each of the following system components: Backend, Model, Inference, Camera, Wi-Fi, Bluetooth, USB, Power, and Performance.
2. WHEN the Backend `/health` endpoint responds with HTTP 200, THE Dashboard SHALL show the Backend Status_Indicator as ONLINE; IF the request fails or times out after 3 seconds, THEN THE Dashboard SHALL show it as OFFLINE.
3. WHEN the Backend reports `model_loaded: true` in the `/health` response, THE Dashboard SHALL show the Model Status_Indicator as LOADED; otherwise THE Dashboard SHALL show NOT LOADED.
4. WHEN the WebSocket connection to `/ws/inference` is open and the Backend sends `running: true`, THE Dashboard SHALL show the Inference Status_Indicator as RUNNING; otherwise THE Dashboard SHALL show STOPPED.
5. WHEN the Backend reports an active Camera_Source, THE Dashboard SHALL show the Camera Status_Indicator as CONNECTED; otherwise THE Dashboard SHALL show DISCONNECTED.
6. WHEN the Backend `/api/status` endpoint returns Wi-Fi interface data with a valid IP address, THE Dashboard SHALL show the Wi-Fi Status_Indicator as CONNECTED with the SSID and IP address; IF no interface data is available, THEN THE Dashboard SHALL show DISCONNECTED.
7. WHEN the Backend returns at least one connected Bluetooth_Device, THE Dashboard SHALL show the Bluetooth Status_Indicator as AVAILABLE; otherwise THE Dashboard SHALL show UNAVAILABLE.
8. WHEN the Backend returns USB device count data, THE Dashboard SHALL show the USB indicator with the actual count; IF no USB data is available, THEN THE Dashboard SHALL show 0.
9. WHEN the Backend returns power/battery information, THE Dashboard SHALL display the actual battery percentage and source; IF power data is unavailable, THEN THE Dashboard SHALL show UNAVAILABLE.
10. THE Dashboard SHALL display real-time Performance metrics — FPS, latency (ms), CPU percentage, RAM percentage, and detected object count — sourced from the WebSocket stream or the `/api/status` endpoint.
11. THE Dashboard SHALL refresh all polled status values (non-WebSocket) every 5 seconds.
12. IF any status value is unavailable from the backend, THEN THE Dashboard SHALL display the literal string "UNAVAILABLE", "OFFLINE", or "NOT DETECTED" as appropriate — THE Dashboard SHALL NOT display placeholder numbers, demo values, or fabricated device names.

---

### Requirement 3: Model Page — Live Camera Inference

**User Story:** As a user, I want a single Model page that shows a live camera feed with real YOLO detections, model configuration controls, and inference metrics so that I can operate and tune the vision system.

#### Acceptance Criteria

1. THE Model_Page SHALL display a full-width camera viewport that renders the live video stream with YOLO bounding-box overlays.
2. THE Model_Page SHALL load the YOLO_Model exactly once per application session; WHEN the model is already loaded, THE Model_Page SHALL NOT reload it on navigation or re-render.
3. WHEN the user selects a Camera_Source from the camera source selector, THE Backend SHALL activate that source and begin streaming frames; THE Model_Page SHALL render the resulting detection bounding boxes on the live feed.
4. THE Model_Page SHALL provide a camera source selector offering the following source types: local camera, USB camera, and Wi-Fi camera; WHEN a source type is not physically present, THE Model_Page SHALL show it as UNAVAILABLE and disable its selector entry.
5. WHEN inference is active, THE Model_Page SHALL display real FPS, latency in milliseconds, detected object count, and confidence per detection — all sourced from the Backend; THE Model_Page SHALL NOT display fabricated metrics.
6. THE Model_Page SHALL provide sliders for confidence threshold (range 0.10–0.95, step 0.05), IoU threshold (range 0.10–0.95, step 0.05), and image size (range 320–1280, step 32); WHEN the user changes a slider value, THE Model_Page SHALL send an update to the Backend `PUT /api/model/config` endpoint.
7. THE Model_Page SHALL display model metadata read from the Backend `GET /api/model` endpoint: file name, framework, task, class count, and status.
8. WHEN the Backend `GET /api/model` returns `status: "available"` and `model_loaded: true`, THE Model_Page SHALL show a LOADED indicator; otherwise THE Model_Page SHALL show NOT LOADED.

---

### Requirement 4: Connectivity Page — Layout and Navigation

**User Story:** As a user, I want a single Connectivity page with three clearly labeled sub-sections so that I can manage all connection types from one location.

#### Acceptance Criteria

1. THE Connectivity_Page SHALL render three sub-section tabs or segments in the following order: WI-FI, BLUETOOTH, USB / LOCAL.
2. WHEN the user clicks a sub-section tab, THE Connectivity_Page SHALL display the selected sub-section content without navigating away from the Connectivity_Page.
3. THE Connectivity_Page SHALL default to the WI-FI sub-section on first render.
4. THE Connectivity_Page SHALL apply the same glassmorphism panel style (Glass_Panel) to all sub-section containers.

---

### Requirement 5: Connectivity — Wi-Fi Sub-Section

**User Story:** As a user, I want the Wi-Fi section to show my actual network state and any real OptiCore-compatible devices discovered on the network so that I can understand my connectivity and initiate remote camera access.

#### Acceptance Criteria

1. THE Connectivity_Page Wi-Fi section SHALL display the current Wi-Fi network state by querying the Backend; shown fields SHALL include: connection status, SSID, IP address, network interface name, and signal strength.
2. IF the Backend cannot determine Wi-Fi state, THEN THE Connectivity_Page Wi-Fi section SHALL show "NOT DETECTED" for each field it cannot populate.
3. THE Connectivity_Page Wi-Fi section SHALL display only OptiCore-compatible devices that are registered in the `wifi_devices` database table and returned by the Backend; THE Connectivity_Page SHALL NOT display generic network hosts, OS-level ARP entries, or fabricated device records.
4. WHEN no OptiCore-compatible Wi-Fi devices are registered, THE Connectivity_Page Wi-Fi section SHALL display an empty state message rather than placeholder device cards.
5. WHEN a registered WiFi_Device has an active Camera_Source, THE Connectivity_Page Wi-Fi section SHALL display a "CAMERA AVAILABLE" indicator and a [REQUEST CAMERA ACCESS] button for that device.
6. WHEN the user clicks [REQUEST CAMERA ACCESS], THE Frontend SHALL send a camera access request to the Backend; THE Backend SHALL relay the request to the remote device via WebSocket; THE Camera_Source SHALL remain in "pending" state until the remote device explicitly approves.
7. WHEN the remote device approves the camera access request, THE Backend SHALL notify the Frontend via WebSocket; THE Connectivity_Page SHALL update the Camera_Source status to "approved" and offer a [OPEN IN MODEL] navigation shortcut.
8. IF the remote device denies the camera access request, THEN THE Backend SHALL notify the Frontend via WebSocket; THEN THE Connectivity_Page SHALL display a "ACCESS DENIED" status for that Camera_Source.
9. THE Connectivity_Page Wi-Fi section SHALL NOT grant camera access based solely on Wi-Fi network connectivity; explicit remote device approval is required.

---

### Requirement 6: Connectivity — Bluetooth Sub-Section

**User Story:** As a user, I want the Bluetooth section to show real adapter status and paired/discovered devices so that I can connect audio peripherals and test TTS output.

#### Acceptance Criteria

1. THE Connectivity_Page Bluetooth section SHALL display the Bluetooth adapter status (available or unavailable) sourced from the Backend.
2. THE Connectivity_Page Bluetooth section SHALL list connected Bluetooth_Devices and available (discovered but not connected) Bluetooth_Devices from the `bluetooth_devices` table via the Backend.
3. THE Connectivity_Page Bluetooth section SHALL display the following fields per Bluetooth_Device: device name, address, device type, connection status, and signal strength (RSSI in dBm) when available.
4. THE Connectivity_Page Bluetooth section SHALL NOT display fabricated or placeholder Bluetooth devices; WHEN no devices are present, it SHALL display an empty state.
5. THE Connectivity_Page Bluetooth section SHALL provide a [SCAN] button; WHEN clicked, THE Backend SHALL initiate a Bluetooth device scan via `POST /api/bluetooth/scan` and return newly discovered devices.
6. WHEN a Bluetooth_Device is in the available state, THE Connectivity_Page Bluetooth section SHALL provide a [CONNECT] button for that device; WHEN clicked, THE Backend SHALL attempt to connect the device.
7. WHEN a Bluetooth_Device is in the connected state, THE Connectivity_Page Bluetooth section SHALL provide a [DISCONNECT] button; WHEN clicked, THE Backend SHALL disconnect the device.
8. THE Connectivity_Page Bluetooth section SHALL provide a [TEST TTS] button; WHEN clicked, THE Backend SHALL synthesize a short spoken phrase and route the audio to the connected Bluetooth audio output device.
9. IF no Bluetooth audio device is connected when [TEST TTS] is clicked, THEN THE Backend SHALL route the TTS audio to the system's default audio output and SHALL notify the Frontend with a status message.

---

### Requirement 7: Connectivity — USB / Local Sub-Section

**User Story:** As a user, I want the USB/Local section to show only real USB-connected devices detected by the operating system so that I know what hardware is available.

#### Acceptance Criteria

1. THE Connectivity_Page USB/Local section SHALL list USB-connected devices (cameras, microphones, audio interfaces) detected by the Backend from actual OS hardware enumeration.
2. THE Connectivity_Page USB/Local section SHALL NOT display placeholder, demo, or fabricated USB devices.
3. WHEN no supported USB devices are detected, THE Connectivity_Page USB/Local section SHALL display an empty state message.
4. THE Connectivity_Page USB/Local section SHALL display the following fields per detected device: device name, device type, and connection status.
5. WHEN a detected USB device is a camera, THE Connectivity_Page USB/Local section SHALL display a [USE IN MODEL] shortcut that navigates to Model_Page with that camera source pre-selected.

---

### Requirement 8: Visual Design — Glassmorphism System

**User Story:** As a user, I want a visually consistent premium glass interface so that the application feels cohesive and professional.

#### Acceptance Criteria

1. THE Frontend SHALL apply the following CSS values to all Glass_Panel elements: `background: rgba(255,255,255,0.06)`, `backdrop-filter: blur(24px)`, `border: 1px solid rgba(255,255,255,0.12)`.
2. THE Frontend SHALL use a dark navy/charcoal base background color of `#080A10` on the root body element.
3. THE Frontend SHALL render animated ambient gradient blobs in the background layer using the existing AtmosphericBackground component; these blobs SHALL NOT obscure or reduce the contrast of foreground text or UI elements.
4. THE Frontend SHALL NOT use neon, cyberpunk, sci-fi HUD, or generic admin dashboard visual styles.
5. THE Frontend SHALL NOT render the radial dial navigation component anywhere in the application.

---

### Requirement 9: Typography Contrast

**User Story:** As a user, I want all text to be legible against the glassmorphism background so that I can read information without strain.

#### Acceptance Criteria

1. THE Frontend SHALL apply the following color tokens to all text elements: primary text `#F5F7FA`, secondary text `#C4CAD4`, muted text `#9AA2AE`.
2. THE Frontend SHALL NOT render important status values, metric numbers, or device names using opacity values below 0.60 relative to white.
3. WHEN a text element is placed on a Glass_Panel, THE Frontend SHALL ensure the Glass_Panel has sufficient background opacity or a solid gradient backing so that text contrast ratio meets WCAG AA (4.5:1 minimum for normal text).
4. THE Frontend SHALL apply `text-shadow: 0 1px 4px rgba(0,0,0,0.5)` to text elements where the underlying background gradient or blur layer reduces contrast below the WCAG AA threshold.
5. THE Frontend SHALL NOT place gray-colored text (`#9AA2AE` or lower) directly on a gray glass surface without a contrasting backing element.

---

### Requirement 10: Backend — System Status Endpoint Enhancement

**User Story:** As a developer, I want the backend `/api/status` endpoint to return Wi-Fi, USB, Bluetooth adapter, and power data so that the Dashboard and Connectivity pages can display real system state.

#### Acceptance Criteria

1. THE Backend `/api/status` endpoint SHALL return the following Wi-Fi fields in its response: `wifi_ssid` (string or null), `wifi_ip` (string or null), `wifi_interface` (string or null), `wifi_signal_dbm` (integer or null), `wifi_connected` (boolean).
2. THE Backend `/api/status` endpoint SHALL return `usb_device_count` (integer) reflecting the number of USB devices currently enumerated by the OS.
3. THE Backend `/api/status` endpoint SHALL return `bluetooth_adapter_available` (boolean) indicating whether the OS Bluetooth adapter is present and powered on.
4. THE Backend `/api/status` endpoint SHALL return the following power fields: `battery_percent` (float or null), `battery_plugged` (boolean or null); IF the host has no battery, THEN both fields SHALL be null.
5. IF the Backend cannot read a system metric (e.g., Wi-Fi interface absent, unsupported platform), THEN THE Backend SHALL return the corresponding field as null rather than raising an HTTP error.

---

### Requirement 11: Backend — Bluetooth Scan and Connect Endpoints

**User Story:** As a developer, I want real Bluetooth scan and connect endpoints so that the Connectivity page can control Bluetooth peripherals.

#### Acceptance Criteria

1. THE Backend `POST /api/bluetooth/scan` endpoint SHALL initiate an OS-level Bluetooth discovery scan and return a list of discovered devices including: `address`, `name`, `device_type`, `rssi`, and `status`.
2. THE Backend `POST /api/bluetooth/connect` endpoint SHALL accept a `address` parameter and attempt to pair and connect the specified Bluetooth device; WHEN successful, THE Backend SHALL create or update the corresponding `bluetooth_devices` record.
3. THE Backend `POST /api/bluetooth/disconnect` endpoint SHALL accept an `address` parameter and disconnect the specified Bluetooth device; WHEN successful, THE Backend SHALL update the `bluetooth_devices` record status to "disconnected".
4. THE Backend `GET /api/bluetooth/devices` endpoint SHALL return only `bluetooth_devices` records associated with the authenticated user's registered devices.
5. IF a Bluetooth operation fails due to an OS-level error, THEN THE Backend SHALL return HTTP 503 with a descriptive error message.

---

### Requirement 12: Backend — TTS Endpoint

**User Story:** As a developer, I want a TTS test endpoint so that the Connectivity page can verify Bluetooth audio output.

#### Acceptance Criteria

1. THE Backend `POST /api/bluetooth/tts-test` endpoint SHALL synthesize a short spoken phrase (e.g., "OptiCore Bluetooth audio test") using an OS-available TTS engine.
2. WHEN a connected Bluetooth audio device is present, THE Backend SHALL route the TTS audio to that device.
3. WHEN no Bluetooth audio device is connected, THE Backend SHALL route TTS audio to the system default output and SHALL return `{"routed_to": "default"}` in the response body.
4. THE Backend `POST /api/bluetooth/tts-test` endpoint SHALL return HTTP 200 on success with `{"status": "ok", "routed_to": "<device_name_or_default>"}`.

---

### Requirement 13: Backend — WebSocket Inference Stream

**User Story:** As a developer, I want the WebSocket endpoint to emit structured inference status messages so that the Dashboard and Model page can display real-time metrics.

#### Acceptance Criteria

1. THE Backend `/ws/inference` WebSocket endpoint SHALL emit JSON messages at a minimum rate of 1 message per second while inference is active.
2. WHEN inference is active, each WebSocket message SHALL include the following fields: `running` (boolean), `fps` (float), `latency` (float in ms), `detection_count` (integer), `confidence_threshold` (float), `iou_threshold` (float).
3. WHEN inference is inactive, THE Backend SHALL emit a message containing `{"running": false}` at a minimum rate of 1 message every 5 seconds to confirm the connection is alive.
4. THE Frontend SHALL reconnect to the WebSocket automatically after a disconnection, with a 5-second retry delay and no maximum retry limit.

---

### Requirement 14: Database Compatibility

**User Story:** As a developer, I want all new backend capabilities to use the existing database schema so that no existing data is lost or corrupted.

#### Acceptance Criteria

1. THE Backend SHALL NOT create new database tables that duplicate the functionality of existing tables (`devices`, `camera_sources`, `bluetooth_devices`, `wifi_devices`, `inference_sessions`, `detection_events`).
2. THE Backend SHALL NOT rename or remove existing columns in the database schema.
3. WHEN a new column is genuinely required, THE Backend SHALL add it through a new Alembic migration file in `backend/alembic/versions/`; THE Backend SHALL NOT modify `001_initial_migration.py`.
4. THE Backend SHALL NOT bypass the Alembic migration system by using `Base.metadata.create_all()` for new schema changes.
5. THE Frontend SHALL construct all API request payloads using field names that match the existing Pydantic schema definitions in `backend/app/schemas/`.

---

### Requirement 15: Backend — Real Camera Enumeration Endpoint

**User Story:** As a developer, I want the `/api/cameras` endpoint to return real OS-enumerated cameras so that the Model page and Connectivity page can show only hardware that is physically present.

#### Acceptance Criteria

1. THE Backend `GET /api/cameras` endpoint SHALL return a list of camera devices enumerated from the OS at the time of the request, not a hardcoded list.
2. THE Backend SHALL enumerate camera sources using OS-level device APIs (e.g., Video4Linux, DirectShow, AVFoundation, or equivalent for the host platform).
3. EACH camera entry in the response SHALL include: `id` (string), `name` (string), `type` (one of: `local`, `usb`, `rtsp`, `http`), and `status` (one of: `connected`, `disconnected`, `error`).
4. WHEN no cameras are detected by the OS, THE Backend SHALL return an empty list (`{"cameras": []}`).
5. THE Backend `GET /api/cameras` endpoint SHALL NOT return hardcoded camera entries under any condition.

---

### Requirement 16: Wi-Fi Camera Access Authorization Flow

**User Story:** As a user, I want camera access from a remote Wi-Fi device to require explicit approval from that device so that my cameras cannot be accessed without consent.

#### Acceptance Criteria

1. THE Backend SHALL maintain a camera access request state per Camera_Source with the following states: `idle`, `pending`, `approved`, `denied`.
2. WHEN the Frontend sends a camera access request for a Camera_Source, THE Backend SHALL set the Camera_Source access state to `pending` and relay the request to the remote WiFi_Device via an existing WebSocket connection.
3. WHILE a Camera_Source access state is `pending`, THE Frontend SHALL display a visual indicator communicating that approval is awaiting the remote device.
4. WHEN the remote device sends an approval response, THE Backend SHALL set the Camera_Source access state to `approved` and notify the Frontend via the `/ws/inference` WebSocket channel.
5. WHEN the remote device sends a denial response, THE Backend SHALL set the Camera_Source access state to `denied` and notify the Frontend via the `/ws/inference` WebSocket channel.
6. THE Backend SHALL NOT expose the camera stream URL to the Frontend until the Camera_Source access state is `approved`.
7. THE Frontend SHALL offer the [OPEN IN MODEL] shortcut only WHEN the Camera_Source access state is `approved`.

---

### Requirement 17: Project Structure Preservation

**User Story:** As a developer, I want the project directory structure to remain clean so that existing tooling and CI pipelines continue to work.

#### Acceptance Criteria

1. THE restructure SHALL keep the top-level project structure as exactly four directories: `web/`, `mobile/`, `backend/`, `pi/`.
2. THE restructure SHALL NOT create new top-level directories such as `frontend/`, `legacy_v1/`, `server/`, `api/`, `supabase/`, `old-web/`, or `old-backend/`.
3. THE restructure SHALL NOT delete or rename any existing files outside of the `web/src/` and `backend/app/` directories without explicit user confirmation.
4. ALL new frontend source files SHALL be placed under `web/src/`.
5. ALL new backend source files SHALL be placed under `backend/app/`.
