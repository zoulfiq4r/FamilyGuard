import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import BlockAppsScreen from '../screens/BlockAppsScreen';
import { subscribeToAppControls, setAppBlocked } from '../services/appControlsService';
import { subscribeToChildApps, getAppsFromLocalUsage } from '../services/appListService';

jest.mock('../services/appControlsService', () => ({
  subscribeToAppControls: jest.fn(),
  setAppBlocked: jest.fn(),
}));

jest.mock('../services/appListService', () => ({
  subscribeToChildApps: jest.fn(),
  getAppsFromLocalUsage: jest.fn(),
}));

describe('BlockAppsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('shows fallback state when device is not paired', () => {
    const onBack = jest.fn();
    const { getByText } = render(<BlockAppsScreen onBack={onBack} childContext={null} />);

    expect(getByText('Device must be paired to manage app blocking.')).toBeTruthy();
    fireEvent.press(getByText('Go Back'));
    expect(onBack).toHaveBeenCalled();
    expect(subscribeToChildApps).not.toHaveBeenCalled();
  });

  test('loads apps and toggles block state', async () => {
    const unsubscribeChildApps = jest.fn();
    subscribeToChildApps.mockImplementation((_childId, callback) => {
      callback([
        { appName: 'Study App', packageName: 'com.app.study', usageMinutes: 12 },
      ]);
      return unsubscribeChildApps;
    });

    getAppsFromLocalUsage.mockResolvedValue([]);

    const controlsUnsubscribe = jest.fn();
    subscribeToAppControls.mockImplementation((_familyId, _childId, callback) => {
      callback({
        meta: {},
        apps: {
          'com.app.study': { blocked: false },
        },
      });
      return controlsUnsubscribe;
    });

    setAppBlocked.mockResolvedValue(true);

    const onBack = jest.fn();
    const childContext = { childId: 'child-1', parentId: 'parent-1', childName: 'Alex' };
    const { getByText, getByTestId } = render(
      <BlockAppsScreen onBack={onBack} childContext={childContext} />,
    );

    await waitFor(() => expect(getByText('Study App')).toBeTruthy());

    const blockSwitch = getByTestId('block-switch-com.app.study');
    fireEvent(blockSwitch, 'valueChange', true);

    await waitFor(() =>
      expect(setAppBlocked).toHaveBeenCalledWith('parent-1', 'child-1', 'com.app.study', true),
    );

    await waitFor(() => expect(getByText('BLOCKED')).toBeTruthy());
  });
});
