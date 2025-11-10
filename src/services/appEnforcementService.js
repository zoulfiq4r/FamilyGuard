import { NativeModules, Platform } from 'react-native';
import { subscribeToAppControls } from './appControlsService';
import { subscribeToLocalUsageState, setUsageTimezone } from './appUsageService';
<<<<<<< HEAD
import { collections, serverTimestamp } from '../config/firebase';
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82

const { AppBlockerModule } = NativeModules;

const DEFAULT_MESSAGES = {
  blocked: 'Blocked by Parent',
  dailyLimit: 'Daily Limit Reached',
};

<<<<<<< HEAD
const REMOTE_BLOCK_REASON = 'remoteBlock';
const TELEMETRY_UNKNOWN_METHOD = 'unknown';

let enforcementContext = null;
let controlsUnsubscribe = null;
let usageUnsubscribe = null;
let appStatusUnsubscribe = null;
=======
let enforcementContext = null;
let controlsUnsubscribe = null;
let usageUnsubscribe = null;
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
let currentControls = {
  meta: {
    globalDailyLimitMillis: null,
    graceMillis: 0,
    timezone: null,
  },
  apps: {},
};
let latestUsageSnapshot = null;
let lastPayloadHash = null;
<<<<<<< HEAD
let remoteAppBlocks = new Map();
let remoteBlockConfirmations = new Map();
let lastEnforcementMethod = TELEMETRY_UNKNOWN_METHOD;
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82

const nativeModuleAvailable = () => !!AppBlockerModule && Platform.OS === 'android';

const sanitizeId = (value) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'undefined' || trimmed === 'null') {
    return null;
  }
  return trimmed;
};

const resetState = () => {
  currentControls = {
    meta: {
      globalDailyLimitMillis: null,
      graceMillis: 0,
      timezone: null,
    },
    apps: {},
  };
  latestUsageSnapshot = null;
  lastPayloadHash = null;
<<<<<<< HEAD
  remoteAppBlocks = new Map();
  remoteBlockConfirmations = new Map();
  lastEnforcementMethod = TELEMETRY_UNKNOWN_METHOD;
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
};

const hashPayload = (payload) => JSON.stringify(payload);

<<<<<<< HEAD
const normalizeTimestamp = (value) => {
  if (!value) return null;
  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value.toDate === 'function') {
    return value.toDate()?.getTime?.() || null;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const base = value.seconds * 1000;
    const nanos = Number(value.nanoseconds || value.nanosecond || 0) / 1_000_000;
    return base + nanos;
  }
  if (typeof value === 'number') {
    return value;
  }
  return null;
};

const buildStatusVersion = (status = {}, fallbackSeed = '') =>
  JSON.stringify({
    isBlocked: status.isBlocked ?? null,
    reason: status.reason || null,
    message: status.message || null,
    requestId: status.requestId || null,
    requestedBy: status.requestedBy || null,
    updatedAt: normalizeTimestamp(status.updatedAt),
    fallbackSeed,
  });

const extractRemoteBlock = (doc) => {
  const data = doc?.data?.() || {};
  const status = data.status || {};
  const fromStatus = typeof status.isBlocked === 'boolean' ? status.isBlocked : null;
  const isBlocked = fromStatus !== null ? fromStatus : Boolean(data.isBlocked);
  if (!isBlocked) {
    return null;
  }

  const packageName = doc.id;
  if (!packageName) {
    return null;
  }

  const message =
    status.message ||
    data.blockMessage ||
    data.message ||
    DEFAULT_MESSAGES.blocked;
  const reason = status.reason || data.blockReason || REMOTE_BLOCK_REASON;
  const statusVersion = buildStatusVersion(
    status,
    `${packageName}:${normalizeTimestamp(status.updatedAt || data.updatedAt) || ''}`,
  );

  return {
    packageName,
    message,
    reason,
    docRef: doc.ref,
    statusVersion,
  };
};

const subscribeToRemoteAppStatus = (childId) => {
  if (!childId) {
    return () => {};
  }

  try {
    const childDocRef = collections.children.doc(childId);
    const appsRef = childDocRef.collection('apps');

    return appsRef.onSnapshot(
      (snapshot) => {
        const next = new Map();
        snapshot.forEach((doc) => {
          const remoteBlock = extractRemoteBlock(doc);
          if (remoteBlock) {
            next.set(remoteBlock.packageName, remoteBlock);
          }
        });

        remoteAppBlocks = next;
        Array.from(remoteBlockConfirmations.keys()).forEach((packageName) => {
          if (!next.has(packageName)) {
            remoteBlockConfirmations.delete(packageName);
          }
        });
        evaluateBlocking();
      },
      (error) => {
        console.error('Failed to listen to child app status', error);
      },
    );
  } catch (error) {
    console.error('Unable to subscribe to child app status', error);
    return () => {};
  }
};

const confirmRemoteBlocks = async (method) => {
  if (!remoteAppBlocks.size || !enforcementContext?.childId) {
    return;
  }

  const tasks = [];
  remoteAppBlocks.forEach((block, packageName) => {
    if (!block?.docRef) {
      return;
    }
    const versionKey = block.statusVersion || packageName;
    if (remoteBlockConfirmations.get(packageName) === versionKey) {
      return;
    }
    const payload = {
      'status.enforced': true,
      'status.lastEnforcedAt': serverTimestamp(),
      'status.lastEnforcedMethod': method || lastEnforcementMethod || TELEMETRY_UNKNOWN_METHOD,
      'status.lastEnforcedChildId': enforcementContext.childId,
    };
    tasks.push(
      block.docRef
        .set(payload, { merge: true })
        .then(() => {
          remoteBlockConfirmations.set(packageName, versionKey);
        })
        .catch((error) => {
          console.error('Failed to record enforcement telemetry', {
            packageName,
            error,
          });
        }),
    );
  });

  await Promise.all(tasks);
};

const evaluateBlocking = async () => {
  if (!nativeModuleAvailable() || !enforcementContext?.childId) {
=======
const evaluateBlocking = () => {
  if (!nativeModuleAvailable()) {
    return;
  }
  if (!enforcementContext?.childId) {
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
    return;
  }

  const usageTotals = latestUsageSnapshot?.totals || [];
  const totalDurationMs = latestUsageSnapshot?.totalDurationMs || 0;
  const usageByPackage = new Map();
  usageTotals.forEach((item) => {
    if (item?.packageName) {
      usageByPackage.set(item.packageName, item.durationMs || 0);
    }
  });

  const graceMillis = Number(currentControls.meta?.graceMillis) || 0;
  const payload = {
    apps: {},
    global: {
      active: false,
      reason: 'dailyLimit',
      message: DEFAULT_MESSAGES.dailyLimit,
    },
  };

<<<<<<< HEAD
  let hasActiveBlock = false;

  remoteAppBlocks.forEach((block, packageName) => {
    if (!packageName) {
      return;
    }
    payload.apps[packageName] = {
      active: true,
      reason: block.reason || REMOTE_BLOCK_REASON,
      message: block.message || DEFAULT_MESSAGES.blocked,
    };
    hasActiveBlock = true;
  });

  Object.entries(currentControls.apps || {}).forEach(([packageName, rule]) => {
    if (!packageName || payload.apps[packageName]?.active) {
=======
  let blockChanged = false;

  Object.entries(currentControls.apps || {}).forEach(([packageName, rule]) => {
    if (!packageName) {
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
      return;
    }
    const usageMs = usageByPackage.get(packageName) || 0;
    const isBlocked = Boolean(rule?.blocked);
    const limit = rule?.dailyLimitMillis;
    const overLimit =
      typeof limit === 'number' && limit >= 0
        ? usageMs >= limit + graceMillis
        : false;

    const shouldBlock = isBlocked || overLimit;
    if (!shouldBlock) {
      return;
    }

    payload.apps[packageName] = {
      active: true,
      reason: isBlocked ? 'blocked' : 'dailyLimit',
      message: isBlocked ? DEFAULT_MESSAGES.blocked : DEFAULT_MESSAGES.dailyLimit,
    };
<<<<<<< HEAD
    hasActiveBlock = true;
=======
    blockChanged = true;
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  });

  const globalLimit = currentControls.meta?.globalDailyLimitMillis;
  if (
    typeof globalLimit === 'number' &&
    globalLimit >= 0 &&
    totalDurationMs >= globalLimit + graceMillis
  ) {
    payload.global = {
      active: true,
      reason: 'dailyLimit',
      message: DEFAULT_MESSAGES.dailyLimit,
    };
<<<<<<< HEAD
    hasActiveBlock = true;
=======
    blockChanged = true;
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  } else {
    payload.global = {
      active: false,
      reason: 'dailyLimit',
      message: DEFAULT_MESSAGES.dailyLimit,
    };
  }

  const payloadHash = hashPayload(payload);
<<<<<<< HEAD

  if (!hasActiveBlock) {
    if (lastPayloadHash !== null) {
      lastPayloadHash = null;
      try {
        if (AppBlockerModule?.updateBlockRules) {
          await AppBlockerModule.updateBlockRules({ apps: {}, global: { active: false } });
        }
      } catch (error) {
        console.error('Failed to reset native blocker rules', error);
      }
    }
    return;
=======
  if (!blockChanged && !Object.keys(payload.apps).length) {
    payload.apps = {};
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  }

  if (payloadHash === lastPayloadHash) {
    return;
  }

  lastPayloadHash = payloadHash;
  try {
<<<<<<< HEAD
    let method = lastEnforcementMethod;
    if (AppBlockerModule?.updateBlockRules) {
      const result = await AppBlockerModule.updateBlockRules(payload);
      if (typeof result === 'string' && result.trim()) {
        method = result;
        lastEnforcementMethod = result;
      }
    }
    await confirmRemoteBlocks(method);
=======
    AppBlockerModule.updateBlockRules?.(payload);
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  } catch (error) {
    console.error('Failed to update native blocker rules', error);
  }
};

const handleControlsUpdate = (controls) => {
  currentControls = controls;
  if (controls?.meta?.timezone) {
    setUsageTimezone(controls.meta.timezone);
  }
  evaluateBlocking();
};

const handleUsageUpdate = (snapshot) => {
  latestUsageSnapshot = snapshot;
  evaluateBlocking();
};

export const startAppEnforcement = (context) => {
  if (!nativeModuleAvailable()) {
    return;
  }
  enforcementContext = {
    childId: sanitizeId(context?.childId),
    familyId: sanitizeId(context?.familyId) || sanitizeId(context?.parentId),
  };

  if (!enforcementContext.childId || !enforcementContext.familyId) {
    console.warn('Missing identifiers for enforcement', enforcementContext);
    return;
  }

<<<<<<< HEAD
  controlsUnsubscribe?.();
  usageUnsubscribe?.();
  appStatusUnsubscribe?.();
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  resetState();

  controlsUnsubscribe = subscribeToAppControls(
    enforcementContext.familyId,
    enforcementContext.childId,
    handleControlsUpdate,
  );

  usageUnsubscribe = subscribeToLocalUsageState(handleUsageUpdate);
<<<<<<< HEAD
  appStatusUnsubscribe = subscribeToRemoteAppStatus(enforcementContext.childId);
=======
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
};

export const stopAppEnforcement = () => {
  if (!nativeModuleAvailable()) {
    return;
  }
  controlsUnsubscribe?.();
  usageUnsubscribe?.();
<<<<<<< HEAD
  appStatusUnsubscribe?.();
  controlsUnsubscribe = null;
  usageUnsubscribe = null;
  appStatusUnsubscribe = null;
=======
  controlsUnsubscribe = null;
  usageUnsubscribe = null;
>>>>>>> 7f95f45defbe90a36bc7cd4d1d2d2ea069505c82
  enforcementContext = null;
  if (nativeModuleAvailable()) {
    try {
      AppBlockerModule.clearBlockRules?.();
    } catch (error) {
      console.error('Failed to reset blocker rules', error);
    }
  }
  resetState();
};

export const getBlockerPermissionsStatus = async () => {
  if (!nativeModuleAvailable()) {
    return {
      accessibility: false,
      overlay: false,
      batteryOptimization: false,
    };
  }
  try {
    return await AppBlockerModule.getBlockerPermissionsStatus();
  } catch (error) {
    console.error('Failed to fetch blocker permissions', error);
    return {
      accessibility: false,
      overlay: false,
      batteryOptimization: false,
    };
  }
};

export const openAccessibilitySettings = () => {
  AppBlockerModule?.openAccessibilitySettings?.();
};

export const requestOverlayPermission = () => {
  AppBlockerModule?.requestOverlayPermission?.();
};

export const requestIgnoreBatteryOptimizations = () => {
  AppBlockerModule?.requestIgnoreBatteryOptimizations?.();
};

export const isAccessibilityServiceEnabled = async () => {
  if (!nativeModuleAvailable()) return false;
  try {
    return await AppBlockerModule.isAccessibilityServiceEnabled();
  } catch (error) {
    console.error('Failed to check accessibility service status', error);
    return false;
  }
};

export const canDrawOverlays = async () => {
  if (!nativeModuleAvailable()) return false;
  try {
    return await AppBlockerModule.canDrawOverlays();
  } catch (error) {
    console.error('Failed to check overlay permission', error);
    return false;
  }
};

export const isIgnoringBatteryOptimizations = async () => {
  if (!nativeModuleAvailable()) return false;
  try {
    return await AppBlockerModule.isIgnoringBatteryOptimizations();
  } catch (error) {
    console.error('Failed to check battery optimization status', error);
    return false;
  }
};
