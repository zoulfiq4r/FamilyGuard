import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const db = firestore();

export const collections = {
  users: db.collection('users'),
  children: db.collection('children'), // 🆕 ADD THIS LINE
  devices: db.collection('devices'),
  pairingCodes: db.collection('pairingCodes'),
  locations: db.collection('locations'),
  activityLogs: db.collection('activityLogs'),
  controls: db.collection('controls'),
  alerts: db.collection('alerts'),
  appUsageSessions: db.collection('appUsageSessions'),
  appUsageAggregates: db.collection('appUsageAggregates'),
};

export const generatePairingCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const testFirebaseConnection = async () => {
  try {
    console.log('🔥 Testing Firebase connection...');
    await db.collection('test').doc('connection').set({
      timestamp: firestore.FieldValue.serverTimestamp(),
      message: 'Firebase connected successfully from React Native!',
      device: 'Android'
    });
    console.log('✅ Firebase Firestore connected!');
    return true;
  } catch (error) {
    console.error('❌ Firebase connection failed:', error);
    return false;
  }
};

export { auth, firestore, db };
