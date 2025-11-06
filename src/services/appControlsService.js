import { db } from '../config/firebase';

const defaultState = {
  meta: {
    globalDailyLimitMillis: null,
    graceMillis: 0,
    timezone: null,
  },
  apps: {},
};

const toNumberOrNull = (value) => {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildBasePath = (familyId, childId) =>
  `families/${familyId}/children/${childId}`;

export const subscribeToAppControls = (familyId, childId, callback) => {
  if (!familyId || !childId) {
    console.warn('subscribeToAppControls missing identifiers', { familyId, childId });
    return () => {};
  }

  const basePath = buildBasePath(familyId, childId);
  const appControlsCollectionRef = db.collection(`${basePath}/appControls`);

  let state = { ...defaultState };

  const emit = () => {
    callback?.(state);
  };

  const unsubscribe = appControlsCollectionRef.onSnapshot(
    (snapshot) => {
      const nextState = {
        ...defaultState,
        apps: {},
      };

      snapshot.forEach((doc) => {
        const data = doc.data() || {};
        if (doc.id === 'meta') {
          nextState.meta = {
            globalDailyLimitMillis: toNumberOrNull(data.globalDailyLimitMillis),
            graceMillis: toNumberOrNull(data.graceMillis) || 0,
            timezone: data.timezone || null,
          };
        } else {
          nextState.apps[doc.id] = {
            blocked: Boolean(data.blocked),
            dailyLimitMillis: toNumberOrNull(data.dailyLimitMillis),
          };
        }
      });

      state = nextState;
      emit();
    },
    (error) => {
      console.error('Failed to load app controls', error);
    },
  );

  return () => {
    unsubscribe?.();
  };
};

export const getAppControlsOnce = async (familyId, childId) => {
  const basePath = buildBasePath(familyId, childId);
  const collectionSnapshot = await db.collection(`${basePath}/appControls`).get();

  const state = {
    meta: { ...defaultState.meta },
    apps: {},
  };

  collectionSnapshot.forEach((doc) => {
    const data = doc.data() || {};
    if (doc.id === 'meta') {
      state.meta = {
        globalDailyLimitMillis: toNumberOrNull(data.globalDailyLimitMillis),
        graceMillis: toNumberOrNull(data.graceMillis) || 0,
        timezone: data.timezone || null,
      };
    } else {
      state.apps[doc.id] = {
        blocked: Boolean(data.blocked),
        dailyLimitMillis: toNumberOrNull(data.dailyLimitMillis),
      };
    }
  });

  return state;
};
