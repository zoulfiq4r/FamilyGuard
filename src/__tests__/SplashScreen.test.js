import React from 'react';
import { render } from '@testing-library/react-native';
import SplashScreen from '../screens/SplashScreen';

describe('SplashScreen', () => {
  test('renders branding text and icon', () => {
    const { getByText } = render(<SplashScreen />);

    expect(getByText('FamilyGuard Child')).toBeTruthy();
    expect(getByText('Stay safe, stay connected')).toBeTruthy();
    expect(getByText('🛡️')).toBeTruthy();
  });
});

