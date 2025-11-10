import DeviceInfo from 'react-native-device-info';
import { collections, serverTimestamp } from '../config/firebase';

const PAIRING_EXPIRY_MS = 10 * 60 * 1000;

const normalizeTimestamp = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + Math.round((value.nanoseconds || 0) / 1_000_000);
  }
  if (typeof value === 'number') {
    return value;
  }
  return null;
};

const assertField = (value, label) => {
  if (!value) {
    throw new Error(`Invalid pairing code. Missing ${label}.`);
  }
};

export const validateAndPairDevice = async (pairingCode) => {
  try {
    if (!pairingCode) {
      throw new Error('Pairing code is required.');
    }

    console.log('🔍 Validating pairing code:', pairingCode);

    const pairingCodesSnapshot = await collections.pairingCodes
      .where('code', '==', pairingCode)
      .limit(1)
      .get();

    if (pairingCodesSnapshot.empty) {
      throw new Error('Invalid pairing code. Please check the code and try again.');
    }

    const pairingDoc = pairingCodesSnapshot.docs[0];
    const pairingData = pairingDoc.data() || {};
    const deviceId = await DeviceInfo.getUniqueId();

    const markDeviceHeartbeat = async (deviceDoc) => {
      await deviceDoc.ref.update({
        lastSeen: serverTimestamp(),
        isActive: true,
      });
    };

    if (pairingData.isUsed || pairingData.used) {
      const existingDeviceDoc = await collections.devices.doc(deviceId).get();
      if (existingDeviceDoc.exists) {
        const existingDevice = existingDeviceDoc.data() || {};
        if (existingDevice.childId) {
          const childSnapshot = await collections.children.doc(existingDevice.childId).get();
          const childData = childSnapshot.exists ? childSnapshot.data() : {};
          await markDeviceHeartbeat(existingDeviceDoc);
          return {
            success: true,
            childId: existingDevice.childId,
            childName: childData?.name || pairingData.childName,
            deviceId,
            parentId: existingDevice.parentId || pairingData.parentId,
          };
        }
      }
      throw new Error('This pairing code has already been used');
    }

    const createdAt =
      normalizeTimestamp(pairingData.createdAt) ?? normalizeTimestamp(pairingData.timestamp);
    const now = Date.now();
    if (!createdAt || now - createdAt > PAIRING_EXPIRY_MS) {
      throw new Error('Pairing code has expired. Please generate a new code.');
    }

    const parentId = pairingData.parentId;
    const childName = pairingData.childName;
    assertField(parentId, 'parentId');
    assertField(childName, 'childName');

    await pairingDoc.ref.update({
      isUsed: true,
      usedAt: serverTimestamp(),
    });

    const childRef = await collections.children.add({
      parentId,
      name: childName,
      createdAt: serverTimestamp(),
      isPaired: false,
    });
    const childId = childRef.id;

    const [deviceName, deviceModel, deviceBrand, systemName, systemVersion] = await Promise.all([
      DeviceInfo.getDeviceName(),
      DeviceInfo.getModel(),
      DeviceInfo.getBrand(),
      DeviceInfo.getSystemName(),
      DeviceInfo.getVersion(),
    ]);

    const deviceRef = collections.devices.doc(deviceId);
    await deviceRef.set(
      {
        deviceId,
        childId,
        parentId,
        deviceName,
        deviceModel,
        deviceBrand,
        platform: systemName,
        version: systemVersion,
        pairedAt: serverTimestamp(),
        lastSeen: serverTimestamp(),
        isActive: true,
      },
      { merge: true },
    );

    await collections.children.doc(childId).update({
      deviceId,
      deviceName,
      lastPaired: serverTimestamp(),
      isPaired: true,
    });

    console.log('✅ Device paired successfully:', {
      deviceId,
      childId,
      childName,
      parentId,
    });

    return {
      success: true,
      childId,
      childName,
      deviceId,
      parentId,
    };
  } catch (error) {
    console.error('❌ Pairing error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to pair device. Please try again.');
  }
};
