import { getApp } from '@react-native-firebase/app';
import { getAuth } from '@react-native-firebase/auth';
import {
  collection,
  doc,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
  Timestamp,
} from '@react-native-firebase/firestore';

const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export const collections = {
  users: collection(db, 'users'),
  children: collection(db, 'children'),
  devices: collection(db, 'devices'),
  pairingCodes: collection(db, 'pairingCodes'),
  locations: collection(db, 'locations'),
  activityLogs: collection(db, 'activityLogs'),
  controls: collection(db, 'controls'),
  alerts: collection(db, 'alerts'),
  appUsageSessions: collection(db, 'appUsageSessions'),
  appUsageAggregates: collection(db, 'appUsageAggregates'),
};

export const generatePairingCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const testFirebaseConnection = async () => {
  try {
    console.log('🔥 Testing Firebase connection...');
    const testCollectionRef = collection(db, 'test');
    const connectionDoc = doc(testCollectionRef, 'connection');
    await setDoc(connectionDoc, {
      timestamp: serverTimestamp(),
      message: 'Firebase connected successfully from React Native!',
      device: 'Android',
    });
    console.log('✅ Firebase Firestore connected!');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return false;
  }
};

export { app, auth, db, increment, serverTimestamp, Timestamp };
