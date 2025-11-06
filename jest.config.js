module.exports = {
  preset: 'react-native',
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  transformIgnorePatterns: [
    'node_modules/(?!(@react-native|react-native|@react-navigation|react-native-vector-icons)/)',
  ],
  setupFilesAfterEnv: ['@testing-library/jest-native/extend-expect'],
};
