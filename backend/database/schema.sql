-- OptiCore Database Schema for Supabase
-- This file creates all required tables and indexes

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT email_valid CHECK (email ~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$')
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_is_active ON users(is_active);

-- Sessions table for JWT token tracking
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token_id ON sessions(token_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Devices table
CREATE TABLE IF NOT EXISTS devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id VARCHAR(255) UNIQUE NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    device_type VARCHAR(50) NOT NULL,  -- mobile, camera, pi, sensor, bluetooth
    connection_type VARCHAR(50) NOT NULL,  -- wifi, bluetooth, usb, local
    status VARCHAR(50) DEFAULT 'offline',  -- online, offline, error
    ip_address VARCHAR(45),
    mac_address VARCHAR(17),
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_devices_device_id ON devices(device_id);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_created_at ON devices(created_at);

-- Camera sources table
CREATE TABLE IF NOT EXISTS camera_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL,  -- local, usb, rtsp, http
    resolution VARCHAR(20),  -- e.g., 1920x1080
    fps INTEGER DEFAULT 30,
    status VARCHAR(50) DEFAULT 'disconnected',  -- connected, disconnected, error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_camera_sources_device_id ON camera_sources(device_id);
CREATE INDEX idx_camera_sources_status ON camera_sources(status);

-- AI Models table
CREATE TABLE IF NOT EXISTS models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    file_name VARCHAR(255) UNIQUE NOT NULL,
    framework VARCHAR(50) NOT NULL,  -- Ultralytics, TensorFlow, PyTorch, etc.
    task VARCHAR(50) NOT NULL,  -- object_detection, segmentation, etc.
    class_count INTEGER DEFAULT 80,
    status VARCHAR(50) DEFAULT 'available',  -- available, loading, error
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_models_file_name ON models(file_name);
CREATE INDEX idx_models_framework ON models(framework);

-- Model configuration table
CREATE TABLE IF NOT EXISTS model_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    confidence_threshold FLOAT DEFAULT 0.50,
    iou_threshold FLOAT DEFAULT 0.45,
    image_size INTEGER DEFAULT 640,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT confidence_valid CHECK (confidence_threshold >= 0 AND confidence_threshold <= 1),
    CONSTRAINT iou_valid CHECK (iou_threshold >= 0 AND iou_threshold <= 1)
);

CREATE INDEX idx_model_configs_model_id ON model_configs(model_id);

-- Inference sessions table
CREATE TABLE IF NOT EXISTS inference_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
    camera_source_id UUID REFERENCES camera_sources(id) ON DELETE SET NULL,
    model_id UUID NOT NULL REFERENCES models(id) ON DELETE CASCADE,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    average_fps FLOAT,
    average_latency_ms FLOAT,
    frames_processed INTEGER DEFAULT 0,
    frames_dropped INTEGER DEFAULT 0
);

CREATE INDEX idx_inference_sessions_user_id ON inference_sessions(user_id);
CREATE INDEX idx_inference_sessions_model_id ON inference_sessions(model_id);
CREATE INDEX idx_inference_sessions_device_id ON inference_sessions(device_id);
CREATE INDEX idx_inference_sessions_started_at ON inference_sessions(started_at);

-- Detection events table (stores detection metadata)
CREATE TABLE IF NOT EXISTS detection_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inference_session_id UUID NOT NULL REFERENCES inference_sessions(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL,
    class_name VARCHAR(255) NOT NULL,
    confidence FLOAT NOT NULL,
    x1 FLOAT NOT NULL,  -- Bounding box top-left x
    y1 FLOAT NOT NULL,  -- Bounding box top-left y
    x2 FLOAT NOT NULL,  -- Bounding box bottom-right x
    y2 FLOAT NOT NULL,  -- Bounding box bottom-right y
    tracking_id INTEGER,  -- Multi-object tracking ID
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT confidence_valid CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE INDEX idx_detection_events_inference_session_id ON detection_events(inference_session_id);
CREATE INDEX idx_detection_events_timestamp ON detection_events(timestamp);
CREATE INDEX idx_detection_events_class_id ON detection_events(class_id);

-- Device events table (connection/disconnection/error events)
CREATE TABLE IF NOT EXISTS device_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,  -- CONNECTED, DISCONNECTED, ERROR, OFFLINE, ONLINE
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_device_events_device_id ON device_events(device_id);
CREATE INDEX idx_device_events_event_type ON device_events(event_type);
CREATE INDEX idx_device_events_created_at ON device_events(created_at);

-- Bluetooth devices table
CREATE TABLE IF NOT EXISTS bluetooth_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(17) UNIQUE NOT NULL,  -- MAC address
    device_type VARCHAR(50) NOT NULL,  -- sensor, speaker, etc.
    status VARCHAR(50) DEFAULT 'disconnected',  -- connected, disconnected, error
    signal_strength INTEGER,  -- RSSI in dBm
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_bluetooth_devices_device_id ON bluetooth_devices(device_id);
CREATE INDEX idx_bluetooth_devices_address ON bluetooth_devices(address);
CREATE INDEX idx_bluetooth_devices_status ON bluetooth_devices(status);

-- Wi-Fi devices table
CREATE TABLE IF NOT EXISTS wifi_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) UNIQUE NOT NULL,
    port INTEGER DEFAULT 8000,
    device_type VARCHAR(50) NOT NULL,  -- pi, camera, etc.
    status VARCHAR(50) DEFAULT 'offline',  -- online, offline, error
    last_seen TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_wifi_devices_device_id ON wifi_devices(device_id);
CREATE INDEX idx_wifi_devices_ip_address ON wifi_devices(ip_address);
CREATE INDEX idx_wifi_devices_status ON wifi_devices(status);

-- Enable Row Level Security (optional - uncomment if using RLS)
-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE camera_sources ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inference_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE detection_events ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to update updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_camera_sources_updated_at BEFORE UPDATE ON camera_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_model_configs_updated_at BEFORE UPDATE ON model_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bluetooth_devices_updated_at BEFORE UPDATE ON bluetooth_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wifi_devices_updated_at BEFORE UPDATE ON wifi_devices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default model if it doesn't exist
INSERT INTO models (name, version, file_name, framework, task, class_count, status)
VALUES ('OptiCore YOLO', 'v1', 'best.pt', 'Ultralytics', 'object_detection', 80, 'available')
ON CONFLICT (file_name) DO NOTHING;

-- Insert default model config
INSERT INTO model_configs (model_id, confidence_threshold, iou_threshold, image_size)
SELECT id, 0.50, 0.45, 640 FROM models WHERE file_name = 'best.pt'
ON CONFLICT DO NOTHING;

-- Grant necessary permissions (if using a specific role)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;
