import Geolocation from '@react-native-community/geolocation';
import BackgroundTimer from 'react-native-background-timer';
import DeviceInfo from 'react-native-device-info';
import { PermissionsAndroid, Platform, Alert } from 'react-native';

import { addDoc, collection, doc, setDoc } from '@react-native-firebase/firestore';
import { collections, serverTimestamp } from '../config/firebase';

let locationInterval = null;

const requestAndroidPermission = async (showExplanation) => {
  try {
    const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const hasFine = await PermissionsAndroid.check(finePermission);

    if (!hasFine) {
      if (showExplanation) {
        await new Promise((resolve) => {
          Alert.alert(
            'Location Permission Required',
            'FamilyGuard needs access to your location so your parent can keep you safe.',
            [{ text: 'Grant Permission', onPress: resolve }],
            { cancelable: false },
          );
        });
      }

      const result = await PermissionsAndroid.request(finePermission, {
        title: 'FamilyGuard Location Permission',
        message: 'FamilyGuard needs access to your location for safety monitoring.',
        buttonPositive: 'OK',
      });

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('❌ Location permission denied:', result);
        return false;
      }
    }

    if (Platform.Version >= 29) {
      const bgPermission = PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION;
      const hasBackground = await PermissionsAndroid.check(bgPermission);
      if (!hasBackground) {
        await PermissionsAndroid.request(bgPermission);
      }
    }

    return true;
  } catch (error) {
    console.error('Failed to request location permission', error);
    return false;
  }
};

export const requestLocationPermission = async (showExplanation = false) => {
  if (Platform.OS !== 'android') {
    return true;
  }
  return requestAndroidPermission(showExplanation);
};

const getLocationWithFallback = (options, attempt = 1) =>
  new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        if (error.code === 3 && options.enableHighAccuracy && attempt === 1) {
          getLocationWithFallback(
            {
              enableHighAccuracy: false,
              timeout: 15000,
              maximumAge: 10000,
            },
            attempt + 1,
          )
            .then(resolve)
            .catch(reject);
        } else {
          reject(error);
        }
      },
      options,
    );
  });

const detectMockLocation = (lat, lon) => {
  const known = [
    { lat: 37.421998, lon: -122.084 },
    { lat: 37.386001, lon: -122.085938 },
    { lat: 0, lon: 0 },
  ];
  return known.some(
    (mock) => Math.abs(lat - mock.lat) < 0.01 && Math.abs(lon - mock.lon) < 0.01,
  );
};

export const sendLocationUpdate = async (childId) => {
  if (!childId) {
    throw new Error('Missing child identifier for location update.');
  }

  try {
    const position = await getLocationWithFallback({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
      distanceFilter: 10,
    });

    const { latitude, longitude, accuracy, altitude = 0, speed = 0 } = position.coords;
    const timestamp = Date.now();
    const deviceId = await DeviceInfo.getUniqueId();
    const isMock = detectMockLocation(latitude, longitude);

    const locationPayload = {
      childId,
      deviceId,
      latitude,
      longitude,
      accuracy,
      altitude,
      speed,
      timestamp,
      isMockLocation: isMock,
    };

    await addDoc(collections.locations, locationPayload);

    const childDocRef = doc(collections.children, childId);
    await addDoc(
      collection(childDocRef, 'locations'),
      {
        latitude,
        longitude,
        accuracy,
        timestamp,
        deviceId,
      },
    );

    await setDoc(
      childDocRef,
      {
        currentLocation: {
          latitude,
          longitude,
          accuracy,
          timestamp,
          deviceId,
        },
        lastLocation: {
          latitude,
          longitude,
          accuracy,
          timestamp,
        },
        lastSeen: serverTimestamp(),
      },
      { merge: true },
      { merge: true },
    );

    return { latitude, longitude, accuracy };
  } catch (error) {
    console.error('❌ Location error:', error);
    let message = 'Failed to get location';
    if (error?.code === 1) {
      message = 'Location permission denied';
    } else if (error?.code === 2) {
      message = 'Location unavailable. Please check GPS settings.';
    } else if (error?.code === 3) {
      message = 'Location request timed out.';
    }
    throw new Error(message);
  }
};

export const startLocationTracking = async (childId, showPermissionExplanation = true) => {
  const hasPermission = await requestLocationPermission(showPermissionExplanation);
  if (!hasPermission) {
    return false;
  }

  try {
    await sendLocationUpdate(childId);
  } catch (error) {
    console.warn('Initial location update failed', error);
  }

  if (locationInterval) {
    BackgroundTimer.clearInterval(locationInterval);
  }
  locationInterval = BackgroundTimer.setInterval(() => {
    sendLocationUpdate(childId).catch((error) => {
      console.warn('Recurring location update failed', error);
    });
  }, 300000);

  return true;
};

export const stopLocationTracking = () => {
  if (locationInterval) {
    BackgroundTimer.clearInterval(locationInterval);
    locationInterval = null;
  }
};
