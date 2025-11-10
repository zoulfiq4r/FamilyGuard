import firebaseApp from '@react-native-firebase/app';
import authModule from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const app = firebaseApp();
const auth = authModule(app);
const db = firestore(app);

const buildCollection = (name) => db.collection(name);

export const collections = {
  users: buildCollection('users'),
  children: buildCollection('children'),
  devices: buildCollection('devices'),
  pairingCodes: buildCollection('pairingCodes'),
  locations: buildCollection('locations'),
  activityLogs: buildCollection('activityLogs'),
  controls: buildCollection('controls'),
  alerts: buildCollection('alerts'),
  appUsageSessions: buildCollection('appUsageSessions'),
  appUsageAggregates: buildCollection('appUsageAggregates'),
};

export const serverTimestamp = () => firestore.FieldValue.serverTimestamp();
export const increment = (value = 1) => firestore.FieldValue.increment(value);
export const Timestamp = firestore.Timestamp;

export const generatePairingCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

export const testFirebaseConnection = async () => {
  try {
    console.log('🔥 Testing Firebase connection...');
    await db.collection('test').doc('connection').set({
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

export { app, auth, db, firestore };
