import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import ProfileScreen from '../screens/ProfileScreen';

describe('ProfileScreen', () => {
  test('renders static device info and handles back presses', () => {
    const onBack = jest.fn();
    const { getByText, getByTestId } = render(<ProfileScreen onBack={onBack} />);

    expect(getByText("Child's Phone")).toBeTruthy();
    expect(getByText('Device ID')).toBeTruthy();

    fireEvent.press(getByTestId('profile-back-button'));
    expect(onBack).toHaveBeenCalled();
  });
});

