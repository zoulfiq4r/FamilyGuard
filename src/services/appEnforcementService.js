import { NativeModules, Platform } from 'react-native';
import { subscribeToAppControls } from './appControlsService';
import { subscribeToLocalUsageState, setUsageTimezone } from './appUsageService';

const { AppBlockerModule } = NativeModules;

const DEFAULT_MESSAGES = {
  blocked: 'Blocked by Parent',
  dailyLimit: 'Daily Limit Reached',
};

let enforcementContext = null;
let controlsUnsubscribe = null;
let usageUnsubscribe = null;
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
};

const hashPayload = (payload) => JSON.stringify(payload);

const evaluateBlocking = () => {
  if (!nativeModuleAvailable()) {
    return;
  }
  if (!enforcementContext?.childId) {
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

  let blockChanged = false;

  Object.entries(currentControls.apps || {}).forEach(([packageName, rule]) => {
    if (!packageName) {
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
    blockChanged = true;
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
    blockChanged = true;
  } else {
    payload.global = {
      active: false,
      reason: 'dailyLimit',
      message: DEFAULT_MESSAGES.dailyLimit,
    };
  }

  const payloadHash = hashPayload(payload);
  if (!blockChanged && !Object.keys(payload.apps).length) {
    payload.apps = {};
  }

  if (payloadHash === lastPayloadHash) {
    return;
  }

  lastPayloadHash = payloadHash;
  try {
    AppBlockerModule.updateBlockRules?.(payload);
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

  resetState();

  controlsUnsubscribe = subscribeToAppControls(
    enforcementContext.familyId,
    enforcementContext.childId,
    handleControlsUpdate,
  );

  usageUnsubscribe = subscribeToLocalUsageState(handleUsageUpdate);
};

export const stopAppEnforcement = () => {
  if (!nativeModuleAvailable()) {
    return;
  }
  controlsUnsubscribe?.();
  usageUnsubscribe?.();
  controlsUnsubscribe = null;
  usageUnsubscribe = null;
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
