import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from './src/screens/SplashScreen';
import PairingScreen from './src/screens/PairingScreen';
import HomeScreen from './src/screens/HomeScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import PermissionRequestScreen from './src/screens/PermissionRequestScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import AboutScreen from './src/screens/AboutScreen';
<<<<<<< HEAD
import BlockAppsScreen from './src/screens/BlockAppsScreen';
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
import { testFirebaseConnection } from './src/config/firebase';
import { startLocationTracking, stopLocationTracking } from './src/services/locationService';
import {
  startAppUsageTracking,
  stopAppUsageTracking,
  refreshForegroundApp,
} from './src/services/appUsageService';
import {
  startAppEnforcement,
  stopAppEnforcement,
  getBlockerPermissionsStatus,
  openAccessibilitySettings,
  requestOverlayPermission,
  requestIgnoreBatteryOptimizations,
} from './src/services/appEnforcementService';
<<<<<<< HEAD
import {
  clearStoredChildContext,
  loadStoredChildContext,
  persistChildContext,
} from './src/services/storageService';
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82

type Screen =
  | 'splash'
  | 'pairing'
  | 'home'
  | 'settings'
  | 'permissions'
  | 'profile'
<<<<<<< HEAD
  | 'about'
  | 'blockApps';
=======
  | 'about';
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82

type ChildContext = {
  childId: string;
  parentId?: string;
  childName?: string;
};

type PermissionState = {
  location: boolean;
  usage: boolean;
  accessibility: boolean;
  overlay: boolean;
  batteryOptimization: boolean;
};

<<<<<<< HEAD
const SPLASH_DELAY_MS = 2000;
const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('splash');
  const [childContext, setChildContext] = useState<ChildContext | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState>({
    location: false,
    usage: false,
    accessibility: false,
    overlay: false,
    batteryOptimization: false,
  });

  useEffect(() => {
    testFirebaseConnection();
  }, []);

<<<<<<< HEAD
  const refreshBlockerPermissions = useCallback(async () => {
    try {
      const status = await getBlockerPermissionsStatus();
      setPermissionState((prev) => ({
        ...prev,
        accessibility: Boolean(status?.accessibility),
        overlay: Boolean(status?.overlay),
        batteryOptimization: Boolean(status?.batteryOptimization),
      }));
      return status;
    } catch (error) {
      console.warn('Failed to refresh blocker permissions', error);
      return null;
    }
  }, []);

  const refreshUsageTracking = useCallback(async () => {
    if (!childContext) {
      return false;
    }
    const usageGranted = await startAppUsageTracking(childContext);
    setPermissionState((prev) => ({
      ...prev,
      usage: usageGranted,
    }));
    if (usageGranted) {
      refreshForegroundApp().catch(() => {});
    }
    return usageGranted;
  }, [childContext]);
=======
  useEffect(() => {
    if (currentScreen === 'splash') {
      const timer = setTimeout(() => {
        setCurrentScreen('pairing');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [currentScreen]);
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82

  useEffect(() => {
    if (currentScreen === 'permissions') {
      refreshBlockerPermissions();
    }
  }, [currentScreen, refreshBlockerPermissions]);

  useEffect(() => {
    return () => {
      stopLocationTracking();
      stopAppUsageTracking();
      stopAppEnforcement();
    };
  }, []);

  useEffect(() => {
    if (!childContext?.childId) {
      stopAppEnforcement();
      return undefined;
    }
    startAppEnforcement({
      childId: childContext.childId,
      parentId: childContext.parentId,
      familyId: childContext.parentId,
    });
    refreshBlockerPermissions();
    return () => {
      stopAppEnforcement();
    };
  }, [childContext, refreshBlockerPermissions]);

<<<<<<< HEAD
=======
  const refreshUsageTracking = useCallback(async () => {
    if (!childContext) {
      return false;
    }
    const usageGranted = await startAppUsageTracking(childContext);
    setPermissionState((prev) => ({
      ...prev,
      usage: usageGranted,
    }));
    if (usageGranted) {
      refreshForegroundApp().catch(() => {});
    }
    return usageGranted;
  }, [childContext]);

  const refreshBlockerPermissions = useCallback(async () => {
    try {
      const status = await getBlockerPermissionsStatus();
      setPermissionState((prev) => ({
        ...prev,
        accessibility: Boolean(status?.accessibility),
        overlay: Boolean(status?.overlay),
        batteryOptimization: Boolean(status?.batteryOptimization),
      }));
      return status;
    } catch (error) {
      console.warn('Failed to refresh blocker permissions', error);
      return null;
    }
  }, []);

>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  const handlePaired = useCallback(
    async (result: {
      success: boolean;
      childId?: string;
      parentId?: string;
      childName?: string;
    }) => {
      if (result.success && result.childId) {
        const context: ChildContext = {
          childId: result.childId,
          parentId: result.parentId,
          childName: result.childName,
        };
        setChildContext(context);
<<<<<<< HEAD
        await persistChildContext(context);
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
        try {
          console.log('🚀 Starting location tracking for child:', result.childId);
          const locationGranted = await startLocationTracking(result.childId);
          const usageGranted = await startAppUsageTracking(context);
          setPermissionState((prev) => ({
            ...prev,
            location: locationGranted,
            usage: usageGranted,
          }));
          refreshBlockerPermissions();
          if (usageGranted) {
            refreshForegroundApp().catch(() => {});
          }
          if (!locationGranted) {
            console.log('⚠️ Location permission missing, showing permissions screen');
            setCurrentScreen('permissions');
          } else {
            if (!usageGranted) {
              console.log('⚠️ Usage access missing, continuing to home but prompting user');
            }
            setCurrentScreen('home');
          }
        } catch (error) {
          console.error('Failed to start tracking:', error);
          setPermissionState((prev) => ({
            ...prev,
            location: false,
            usage: false,
          }));
          refreshBlockerPermissions();
          setCurrentScreen('permissions');
        }
      } else {
        setCurrentScreen('home');
      }
    },
    [refreshBlockerPermissions],
  );

<<<<<<< HEAD
  useEffect(() => {
    let isActive = true;

    const restorePairingState = async () => {
      // Keep splash visible for a moment before loading persisted state.
      await delay(SPLASH_DELAY_MS);

      if (!isActive) {
        return;
      }

      try {
        const storedContext = await loadStoredChildContext();
        if (!isActive) {
          return;
        }
        if (storedContext?.childId) {
          await handlePaired({
            success: true,
            childId: storedContext.childId,
            parentId: storedContext.parentId,
            childName: storedContext.childName,
          });
        } else {
          setCurrentScreen('pairing');
        }
      } catch (error) {
        console.warn('Failed to restore pairing data', error);
        if (isActive) {
          setCurrentScreen('pairing');
        }
      }
    };

    restorePairingState();

    return () => {
      isActive = false;
    };
  }, [handlePaired]);

=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  const handleNavigateToSettings = useCallback(() => {
    setCurrentScreen('settings');
  }, []);

  const handleNavigateToPermissions = useCallback(() => {
    setCurrentScreen('permissions');
  }, []);

  const handleBack = useCallback(() => {
<<<<<<< HEAD
    // Handle navigation based on current screen
    if (currentScreen === 'blockApps' || currentScreen === 'profile' || currentScreen === 'about') {
      setCurrentScreen('settings');
      return;
    }
    if (currentScreen === 'permissions') {
      if (
        permissionState.location &&
        permissionState.usage &&
        permissionState.accessibility &&
        permissionState.overlay
      ) {
        setCurrentScreen('home');
        return;
      }
      setCurrentScreen(childContext ? 'home' : 'pairing');
      return;
    }
    if (currentScreen === 'settings') {
=======
    if (
      permissionState.location &&
      permissionState.usage &&
      permissionState.accessibility &&
      permissionState.overlay
    ) {
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
      setCurrentScreen('home');
      return;
    }
    setCurrentScreen(childContext ? 'home' : 'pairing');
  }, [
<<<<<<< HEAD
    currentScreen,
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
    childContext,
    permissionState.accessibility,
    permissionState.location,
    permissionState.overlay,
    permissionState.usage,
  ]);

  const handleLogout = useCallback(() => {
    stopLocationTracking();
    stopAppUsageTracking();
    stopAppEnforcement();
<<<<<<< HEAD
    clearStoredChildContext();
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
    setChildContext(null);
    setPermissionState({
      location: false,
      usage: false,
      accessibility: false,
      overlay: false,
      batteryOptimization: false,
    });
    setCurrentScreen('pairing');
  }, []);

  const handlePermissionsCheck = useCallback(async () => {
    let locationGranted = permissionState.location;
    if (childContext?.childId && !permissionState.location) {
      try {
        locationGranted = await startLocationTracking(childContext.childId);
      } catch (error) {
        console.error('Failed to refresh location tracking', error);
      }
    }
    const usageGranted = await refreshUsageTracking();
    const blockerStatus = await refreshBlockerPermissions();
    const mergedPermissions = {
      location: locationGranted,
      usage: Boolean(usageGranted),
      accessibility:
        blockerStatus?.accessibility ?? permissionState.accessibility ?? false,
      overlay: blockerStatus?.overlay ?? permissionState.overlay ?? false,
      batteryOptimization:
        blockerStatus?.batteryOptimization ??
        permissionState.batteryOptimization ??
        false,
    };
    setPermissionState((prev) => ({
      ...prev,
      ...mergedPermissions,
    }));
    if (
      mergedPermissions.location &&
      mergedPermissions.usage &&
      mergedPermissions.accessibility &&
      mergedPermissions.overlay
    ) {
      setCurrentScreen('home');
    }
  }, [
    childContext,
    permissionState.accessibility,
    permissionState.batteryOptimization,
    permissionState.location,
    permissionState.overlay,
    refreshBlockerPermissions,
    refreshUsageTracking,
  ]);

  const handleRequestUsageAccess = useCallback(() => {
<<<<<<< HEAD
    if (!childContext?.childId) {
      console.log('Pairing required before requesting usage access permission.');
      return;
    }
    refreshUsageTracking();
  }, [childContext, refreshUsageTracking]);
=======
    refreshUsageTracking();
  }, [refreshUsageTracking]);
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82

  const handleRequestAccessibility = useCallback(() => {
    openAccessibilitySettings();
  }, []);

  const handleRequestOverlayPermission = useCallback(() => {
    requestOverlayPermission();
  }, []);

  const handleRequestBatteryOptimization = useCallback(() => {
    requestIgnoreBatteryOptimizations();
  }, []);

  const handleRequestLocationPermission = useCallback(async () => {
    if (!childContext?.childId) {
      return;
    }
    try {
      const granted = await startLocationTracking(childContext.childId);
      setPermissionState((prev) => ({
        ...prev,
        location: granted,
      }));
    } catch (error) {
      console.error('Failed to request location permission', error);
    }
  }, [childContext]);

  return (
    <SafeAreaProvider>
      {currentScreen === 'splash' && <SplashScreen />}
      {currentScreen === 'pairing' && <PairingScreen onPaired={handlePaired} />}
      {currentScreen === 'home' && (
        <HomeScreen
          onNavigateToSettings={handleNavigateToSettings}
          childContext={childContext}
          permissionState={permissionState}
        />
      )}
      {currentScreen === 'settings' && (
        <SettingsScreen
          onBack={handleBack}
          onNavigateToPermissions={handleNavigateToPermissions}
          onNavigateToProfile={() => setCurrentScreen('profile')}
          onNavigateToAbout={() => setCurrentScreen('about')}
<<<<<<< HEAD
          onNavigateToBlockApps={() => setCurrentScreen('blockApps')}
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
          onLogout={handleLogout}
        />
      )}
      {currentScreen === 'permissions' && (
        <PermissionRequestScreen
          onBack={handleBack}
          onResolvePermissions={handlePermissionsCheck}
          permissionState={permissionState}
          onRequestUsageAccess={handleRequestUsageAccess}
          onRequestAccessibility={handleRequestAccessibility}
          onRequestOverlay={handleRequestOverlayPermission}
          onRequestBatteryOptimization={handleRequestBatteryOptimization}
          onRequestLocation={handleRequestLocationPermission}
        />
      )}
      {currentScreen === 'profile' && <ProfileScreen onBack={handleBack} />}
      {currentScreen === 'about' && <AboutScreen onBack={handleBack} />}
<<<<<<< HEAD
      {currentScreen === 'blockApps' && (
        <BlockAppsScreen onBack={handleBack} childContext={childContext} />
      )}
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
    </SafeAreaProvider>
  );
}

export default App;
