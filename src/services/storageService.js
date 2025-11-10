import AsyncStorage from '@react-native-async-storage/async-storage';

const CHILD_CONTEXT_KEY = 'familyGuard.childContext';

export const loadStoredChildContext = async () => {
  try {
    const rawValue = await AsyncStorage.getItem(CHILD_CONTEXT_KEY);
    if (!rawValue) {
      return null;
    }
    const parsedValue = JSON.parse(rawValue);
    if (parsedValue?.childId) {
      return parsedValue;
    }
    return null;
  } catch (error) {
    console.warn('Failed to load child context from storage', error);
    return null;
  }
};

export const persistChildContext = async (context) => {
  try {
    await AsyncStorage.setItem(CHILD_CONTEXT_KEY, JSON.stringify(context));
  } catch (error) {
    console.warn('Failed to persist child context', error);
  }
};

export const clearStoredChildContext = async () => {
  try {
    await AsyncStorage.removeItem(CHILD_CONTEXT_KEY);
  } catch (error) {
    console.warn('Failed to clear child context from storage', error);
  }
};
