import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, ScrollView, SafeAreaView } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Home, Camera as CameraIcon, HardDrive, Cpu, Bluetooth, Eye, Map, User, Settings, MoreHorizontal, Mic } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

const { width, height } = Dimensions.get('window');

// --- THEME ---
const theme = {
  bg: '#F6F8FB',
  primary: '#2563EB',
  primaryLight: '#3B82F6',
  textDark: '#172033',
  textSecondary: '#64748B',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

// --- DIAL NAVIGATION ---
const navItems = [
  { name: 'Dashboard', icon: Home, route: 'Dashboard' },
  { name: 'Live', icon: CameraIcon, route: 'Live' },
  { name: 'Devices', icon: HardDrive, route: 'Devices' },
  { name: 'IrisAI', icon: Cpu, route: 'IrisAI' },
  { name: 'Bluetooth', icon: Bluetooth, route: 'Bluetooth' },
  { name: 'OCR', icon: Eye, route: 'OCR' },
  { name: 'Navigation', icon: Map, route: 'Navigation' },
  { name: 'Profile', icon: User, route: 'Profile' },
  { name: 'Settings', icon: Settings, route: 'Settings' },
  { name: 'Other', icon: MoreHorizontal, route: 'Other' },
];

const DialNavigation = ({ navigation, currentRoute }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  // Dial logic for mobile (tap to expand/collapse)
  
  if (!isOpen) {
    return (
      <TouchableOpacity 
        style={styles.dialClosed} 
        onPress={() => setIsOpen(true)}
      >
        <Text style={styles.dialLogo}>OPTI</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.dialOpenOverlay}>
      <TouchableOpacity style={styles.dialOpenBg} onPress={() => setIsOpen(false)} activeOpacity={1} />
      <View style={styles.dialOpenContainer}>
        <TouchableOpacity style={styles.dialCenterOpen} onPress={() => setIsOpen(false)}>
           <Text style={styles.dialLogo}>OPTI</Text>
        </TouchableOpacity>
        
        {navItems.map((item, index) => {
          const angle = (index / navItems.length) * 2 * Math.PI;
          const radius = 120;
          const top = -radius * Math.cos(angle);
          const left = radius * Math.sin(angle);
          const isActive = currentRoute === item.route;

          return (
            <TouchableOpacity
              key={item.name}
              style={[
                styles.dialItem,
                { transform: [{ translateY: top }, { translateX: left }] },
                isActive && styles.dialItemActive
              ]}
              onPress={() => {
                setIsOpen(false);
                navigation.navigate(item.route);
              }}
            >
              <item.icon size={24} color={isActive ? '#fff' : theme.textSecondary} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

// --- SCREENS ---
const DashboardScreen = () => (
  <ScrollView style={styles.container}>
    <Text style={styles.pageTitle}>Dashboard</Text>
    <Text style={styles.pageSubtitle}>Welcome to OptiCore</Text>
    
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Active Devices</Text>
      <Text style={[styles.cardValue, { color: theme.textDark }]}>1 Online</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Recent Detections</Text>
      <Text style={[styles.cardValue, { color: theme.textDark }]}>45 Today</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.cardTitle}>System Status</Text>
      <Text style={[styles.cardValue, { color: theme.success }]}>Healthy</Text>
    </View>
  </ScrollView>
);

const DevicesScreen = () => {
  const [meshEndpoints, setMeshEndpoints] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchEndpoints = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://10.0.2.2:8000/api/connectivity/scan');
      if (res.ok) {
        const data = await res.json();
        setMeshEndpoints(data.endpoints || []);
      }
    } catch {
      // Network offline, keep genuine state
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEndpoints();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <View>
          <Text style={styles.pageTitle}>Optical Mesh</Text>
          <Text style={styles.pageSubtitle}>Sonar Endpoints (Wi-Fi · BT · USB)</Text>
        </View>
        <TouchableOpacity style={styles.btnPrimary} onPress={fetchEndpoints} disabled={loading}>
          <Text style={styles.btnPrimaryText}>{loading ? 'Scanning…' : 'Ping Sonar'}</Text>
        </TouchableOpacity>
      </View>

      {meshEndpoints.length === 0 ? (
        <View style={[styles.card, { alignItems: 'center', paddingVertical: 36 }]}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textDark, marginBottom: 6 }}>
            No Endpoints Detected
          </Text>
          <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center' }}>
            Tap "Ping Sonar" to discover active optical devices, Bluetooth sinks, or live App Users.
          </Text>
        </View>
      ) : (
        meshEndpoints.map(d => (
          <View key={d.id} style={styles.card}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.textDark }}>{d.name}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                <View style={[styles.statusIndicator, d.status === 'online' || d.status === 'connected' ? { backgroundColor: theme.success } : { backgroundColor: theme.warning }]} />
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.textDark, textTransform: 'uppercase' }}>
                  {d.connection_mode || d.mode}
                </Text>
              </View>
            </View>
            <Text style={{ marginTop: 8, color: theme.textSecondary, fontSize: 13 }}>
              {d.address || d.camera_label || (d.is_tts_sink ? 'TTS Audio Sink' : 'Optical Endpoint')}
            </Text>
            <View style={{ flexDirection: 'row', marginTop: 14, gap: 10 }}>
              {d.capabilities?.includes('camera') || d.endpoint_category === 'camera' || d.is_app_user ? (
                <TouchableOpacity style={[styles.btnPrimary, { flex: 1, backgroundColor: theme.primary }]}>
                  <Text style={[styles.btnPrimaryText, { textAlign: 'center' }]}>View Camera</Text>
                </TouchableOpacity>
              ) : d.is_tts_sink || d.endpoint_category === 'earbuds' ? (
                <TouchableOpacity style={[styles.btnPrimary, { flex: 1, backgroundColor: '#60A5FA' }]}>
                  <Text style={[styles.btnPrimaryText, { textAlign: 'center' }]}>🔊 TTS Active</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.btnSecondary, { flex: 1 }]}>
                  <Text style={styles.btnSecondaryText}>Connect Node</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
};

const LiveScreen = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const [isStreaming, setIsStreaming] = useState(false);
  const [isPublicMeshShared, setIsPublicMeshShared] = useState(false);

  if (!permission) {
    return <View />;
  }
  if (!permission.granted) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ textAlign: 'center', marginBottom: 16 }}>We need camera permission to share optical feed</Text>
        <TouchableOpacity style={styles.btnPrimary} onPress={requestPermission}>
          <Text style={styles.btnPrimaryText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 24, paddingBottom: 0 }}>
        <Text style={styles.pageTitle}>Android Camera Endpoint</Text>
        <Text style={styles.pageSubtitle}>Stream as Optical Device on OptiCore Mesh</Text>
      </View>

      <View style={{ flex: 1, margin: 24, borderRadius: 16, overflow: 'hidden', backgroundColor: '#000', position: 'relative' }}>
        {isStreaming ? (
          <CameraView style={{ flex: 1 }} facing="back">
            <View style={{ position: 'absolute', top: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.65)', padding: 8, borderRadius: 8 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                {isPublicMeshShared ? 'MESH: PUBLIC OPTICAL ENDPOINT' : 'LOCAL PREVIEW'}
              </Text>
            </View>
          </CameraView>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
            <Text style={{ color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 8 }}>
              Camera is currently offline
            </Text>
            <Text style={{ color: '#666', fontSize: 12, textAlign: 'center' }}>
              Start your camera to enable publishing as an Optical Endpoint for remote AI Vision inference.
            </Text>
          </View>
        )}
      </View>

      <View style={{ padding: 24, paddingTop: 0, gap: 10 }}>
        <TouchableOpacity 
          style={[styles.btnPrimary, isStreaming ? { backgroundColor: theme.error } : { backgroundColor: theme.primary }]}
          onPress={() => setIsStreaming(!isStreaming)}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>
            {isStreaming ? 'Stop Camera' : 'Start Camera Feed'}
          </Text>
        </TouchableOpacity>

        {isStreaming && (
          <TouchableOpacity 
            style={[styles.btnSecondary, { borderColor: isPublicMeshShared ? theme.success : theme.border }]}
            onPress={() => setIsPublicMeshShared(!isPublicMeshShared)}
          >
            <Text style={{ color: isPublicMeshShared ? theme.success : theme.textDark, textAlign: 'center', fontWeight: '600' }}>
              {isPublicMeshShared ? '✓ Public Optical Access Active (Auto-Approve)' : '📡 Make Camera Public on Sonar Mesh'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const IrisAIScreen = () => {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hello, I am IrisAI. How can I help you today?' }
  ]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 24, paddingBottom: 0 }}>
        <Text style={styles.pageTitle}>IrisAI</Text>
        <Text style={styles.pageSubtitle}>Your Contextual Assistant</Text>
      </View>
      <ScrollView style={{ flex: 1, padding: 24 }}>
        {messages.map((msg, idx) => (
          <View key={idx} style={{ 
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            backgroundColor: msg.role === 'user' ? theme.primary : theme.surface,
            padding: 16,
            borderRadius: 16,
            marginBottom: 12,
            maxWidth: '80%',
            borderWidth: msg.role === 'user' ? 0 : 1,
            borderColor: theme.border
          }}>
            <Text style={{ color: msg.role === 'user' ? '#fff' : theme.textDark }}>
              {msg.text}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={{ padding: 24, paddingTop: 12, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <TouchableOpacity 
          style={[styles.btnPrimary, { flex: 1, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border }]}
          onPress={() => setMessages([...messages, { role: 'user', text: 'Simulated text input.' }])}
        >
          <Text style={{ color: theme.textSecondary, textAlign: 'left', fontWeight: 'normal' }}>
            Type a message...
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: isListening ? theme.error : theme.primary, justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setIsListening(!isListening)}
        >
          <Mic color="#fff" size={24} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const UnderConstructionScreen = ({ route }: any) => (
  <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
    <Text style={styles.pageTitle}>{route.name}</Text>
    <Text style={[styles.pageSubtitle, { marginTop: 16 }]}>🚧 UNDER CONSTRUCTION</Text>
    <Text style={{ marginTop: 8, color: theme.textSecondary }}>This feature is currently being developed.</Text>
  </View>
);

const Stack = createNativeStackNavigator();

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('Dashboard');

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <NavigationContainer onStateChange={(state) => {
        if (state) {
          const routeName = state.routes[state.index].name;
          setCurrentRoute(routeName);
        }
      }}>
        <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="Live" component={LiveScreen} />
          <Stack.Screen name="Devices" component={DevicesScreen} />
          <Stack.Screen name="IrisAI" component={IrisAIScreen} />
          <Stack.Screen name="Bluetooth" component={UnderConstructionScreen} />
          <Stack.Screen name="OCR" component={UnderConstructionScreen} />
          <Stack.Screen name="Navigation" component={UnderConstructionScreen} />
          <Stack.Screen name="Profile" component={UnderConstructionScreen} />
          <Stack.Screen name="Settings" component={UnderConstructionScreen} />
          <Stack.Screen name="Other" component={UnderConstructionScreen} />
        </Stack.Navigator>
        
        {/* Render Nav inside NavigationContainer so it can use navigation prop.
            We use a hack by wrapping it in a custom component that hooks into the navigation context. */}
        <NavWrapper currentRoute={currentRoute} />
      </NavigationContainer>
    </SafeAreaView>
  );
}

import { useNavigation } from '@react-navigation/native';
const NavWrapper = ({ currentRoute }: any) => {
  const navigation = useNavigation();
  return <DialNavigation navigation={navigation} currentRoute={currentRoute} />;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textDark,
  },
  pageSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 4,
    marginBottom: 24,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textSecondary,
  },
  cardValue: {
    fontSize: 24,
    fontWeight: '600',
    marginTop: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  btnPrimary: {
    backgroundColor: theme.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: theme.textDark,
    fontWeight: '500',
    fontSize: 14,
  },
  dialClosed: {
    position: 'absolute',
    bottom: 30,
    left: '50%',
    transform: [{ translateX: -35 }],
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 50,
  },
  dialLogo: {
    color: theme.primary,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: -0.5,
  },
  dialOpenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  dialOpenBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  dialOpenContainer: {
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dialCenterOpen: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    zIndex: 10,
  },
  dialItem: {
    position: 'absolute',
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dialItemActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
    transform: [{ scale: 1.1 }]
  }
});
