[![codecov](https://codecov.io/gh/zoulfiq4r/FamilyGuardMobile/graph/badge.svg?token=WKJPNFXX9H)](https://codecov.io/gh/zoulfiq4r/FamilyGuardMobile)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![Platform](https://img.shields.io/badge/Platform-Android-green?logo=android)
![React Native](https://img.shields.io/badge/React_Native-20232A?logo=react&logoColor=61DAFB)
![Firebase](https://img.shields.io/badge/Firebase-039BE5?logo=firebase)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript)

# FamilyGuard Child

> Child-side mobile agent for FamilyGuard — pairing a kid's Android device with the FamilyGuard parent dashboard to stream live usage, enforce rules, and surface safety controls in real time.

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Folder Structure](#folder-structure)
- [API & Firebase Collections](#api--firebase-collections)
- [Firebase Services Used](#firebase-services-used)
- [Installation](#installation)
- [Running the Project](#running-the-project)
- [Environment Variables & Secrets](#environment-variables--secrets)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Future Improvements](#future-improvements)
- [Contributing](#contributing)
- [Contact / Author](#contact--author)

## Overview

FamilyGuard Child is a React Native 0.82 application meant to run on the child's phone. Once paired with a parent account, it collects foreground app usage, enforces remote app blocking rules, reports device location, and keeps Firebase Firestore in sync with the child's digital wellbeing data. The app boots into a splash screen, walks the user through pairing (6-digit code), then orchestrates permissions, telemetry, and parental controls via a service layer and custom native modules.


## Key Features

- **Pairing Workflow**: Validates 6-digit codes, registers devices in Firestore, and persists context locally.
- **Live Usage Dashboard**: Streams hourly aggregates, recent sessions, and currently active apps with pull-to-refresh.
- **Native Enforcement Bridge**: App usage tracking and blocking (via `AppUsageModule` & `AppBlockerModule`) honour parent-defined rules and remote commands.
- **Location Heartbeats**: Periodically captures GPS coordinates, syncs with Firestore, and surfaces last known details inside the UI.
- **Permissions Hub**: Centralized screen for location, usage access, accessibility service, overlay, and battery optimization prompts.
- **App Blocking Console**: Fetches child apps list, toggles block state, and reflects Firestore control documents instantly.
- **Resilient Storage**: Persists child context with AsyncStorage and auto-restores pairing state on app relaunch.
- **Comprehensive Test Suite**: Jest + Testing Library cover screens, services, and Firebase integrations.

## Tech Stack

- React Native 0.82 (React 19, JSX + TypeScript entry point)
- JavaScript/TypeScript hybrid codebase (TS config + `.js` modules)
- Firebase (App, Auth*, Firestore) via `@react-native-firebase/*`
- Native bridges: `AppUsageModule`, `AppBlockerModule`, `@react-native-community/geolocation`
- Background scheduling with `react-native-background-timer`
- Device telemetry via `react-native-device-info`
- Async storage for persistence
- Testing: Jest, React Test Renderer, @testing-library/react-native

\*Auth is bundled for future secure access checks although not yet invoked.

## Architecture

```text
┌──────────────────────────┐
│        UI Layer          │
│ Splash / Pairing / Home  │
│ Settings / Permissions   │
└─────────────┬────────────┘
              │ props, callbacks
┌─────────────▼────────────┐
│     App.tsx Orchestrator │
│ Screen router + context  │
└─────────────┬────────────┘
              │ invokes
┌─────────────▼──────────────────────────────────────────────┐
│ Service Layer                                              │
│ pairingService / appUsageService / appEnforcementService   │
│ locationService / storageService / appControlsService      │
│ - Talks to Firebase collections                            │
│ - Bridges Native Modules (usage, blocker, geolocation)     │
│ - Publishes local snapshots for UI                        │
└─────────────┬───────────────┬──────────────┬──────────────┘
        Firebase Firestore  AsyncStorage  Background timers
```

- **Data flow**: `App.tsx` reacts to pairing + permission state, starts/stops services, and passes derived data down to screens.
- **Realtime**: Services use Firestore listeners, background timers, and DeviceInfo IDs to keep the cloud in sync with on-device state.
- **Native modules**: Custom Android services enforce blocking, detect active apps, and open OS-level settings when permissions are missing.

## Folder Structure

```
.
├── App.tsx                     # Entry point, navigation + orchestration
├── src
│   ├── config/firebase.js      # Firebase helpers & collection builders
│   ├── screens/                # UI screens (Home, Pairing, Settings, etc.)
│   ├── services/               # Domain logic (usage, pairing, blocking, etc.)
│   └── __tests__/              # Screen + service unit/integration tests
├── __tests__/App.test.tsx      # Root smoke test for App.tsx
├── android / ios               # Native projects & Firebase configs
├── jest.config.js / jest.setup # Test tooling and mocks
├── metro.config.js             # Bundler config
├── package.json                # Scripts & dependency manifest
└── tsconfig.json               # Typescript support
```

Each service module isolates a concern (pairing, app usage analytics, enforcement) so screens stay declarative and presentation-focused.

## API & Firebase Collections

| Collection / Doc | Purpose | Key Fields |
| ---------------- | ------- | ---------- |
| `pairingCodes` | Parent dashboard issues temporary codes consumed by the child app | `code`, `parentId`, `childName`, `createdAt`, `isUsed`, `usedAt` |
| `children` | Child profile + nested subcollections (`apps`, `locations`) | `name`, `parentId`, `deviceId`, `lastPaired`, `currentLocation` |
| `children/{childId}/apps` | Remote app status + block metadata per package | `name`, `isBlocked`, `status.*`, `usageMinutes`, `updatedAt` |
| `children/{childId}/locations` | Append-only history of location updates | `latitude`, `longitude`, `accuracy`, `timestamp`, `deviceId` |
| `devices` | Registered devices and current foreground app info | `deviceId`, `childId`, `currentApp`, `lastSeen`, platform metadata |
| `appUsageSessions` | Immutable usage sessions synced from device | `childId`, `packageName`, `startTime`, `endTime`, `durationMs`, `dateKey` |
| `appUsageAggregates` | Daily rollups (totals, per-app, hourly buckets) | `childId`, `dateKey`, `totalDurationMs`, `apps`, `hours`, `lastUpdated` |
| `locations` | Global location stream for analytics | `childId`, `deviceId`, `latitude`, `longitude`, `accuracy`, `timestamp` |
| `activityLogs`, `controls`, `alerts` | Reserved for future auditing, rules, and alerting flows | varies |

Access to the collections is encapsulated in `src/services`, keeping low-level Firestore calls away from the UI.

## Firebase Services Used

- **Firebase App** (`@react-native-firebase/app`) – initializes SDK on device boot.
- **Firestore** – single source of truth for pairing codes, devices, children, controls, session telemetry, and locations.
- **Auth (planned)** – imported and configured for future secure operations (e.g., verifying parent-issued tokens).

## Installation

1. **Prerequisites**
   - Node.js ≥ 20 and npm (or yarn) installed.
   - JDK 17+, Android Studio + SDK/NDK for building native Android modules.
   - Xcode 15+ for iOS builds (if targeting iOS).
   - Firebase project with `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).
2. Clone the repository:
   ```bash
   git clone https://github.com/zoulfiq4r/FamilyGuardNew.git
   cd FamilyGuardNew
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Install iOS pods (macOS):
   ```bash
   npx pod-install
   ```
5. Drop your Firebase config into `android/app/google-services.json` and `ios/FamilyGuardNew/GoogleService-Info.plist`.

## Running the Project

```bash
# Start Metro bundler
npm start

# Launch on Android (emulator or device)
npm run android

# Launch on iOS simulator
npm run ios

# Run the comprehensive Jest suite
npm test
```

Useful extras:
- `npm run lint` – ESLint pass with React Native preset.
- Use `adb logcat` / Xcode logs to inspect native bridge output from `AppUsageModule` or `AppBlockerModule`.

## Environment Variables & Secrets

There is no `.env` file yet, but the app expects the following sensitive assets/configuration to be present:

| Name / File | Description |
| ----------- | ----------- |
| `android/app/google-services.json` | Firebase Android credentials. Generate from the Firebase console. |
| `ios/FamilyGuardNew/GoogleService-Info.plist` | Firebase iOS credentials. Required even if current build is Android-first. |
| `ANDROID_HOME`, `JAVA_HOME`, `XCODE_PATH` | Developer machine environment vars for native builds. |
| Firestore security rules | Ensure the project has rules that allow the child device to read/write the collections noted above securely (typically via authenticated context). |

If you later move secrets into environment variables (e.g., API hosts, feature flags), centralize them in a dedicated config module and document them here.

## Deployment

**Android**
1. Update app version and code in `android/app/build.gradle`.
2. Generate a keystore (if you do not already have one) and configure `gradle.properties`.
3. Build a release bundle:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
4. Upload `app/build/outputs/bundle/release/app-release.aab` to the Play Console or distribute internally.

**iOS**
1. Update versioning in `ios/FamilyGuardNew.xcodeproj`.
2. Archive via Xcode (`Product > Archive`) and distribute through TestFlight or enterprise distribution.

**Firebase**
- Keep `pairingCodes` TTL and Firestore indexes in sync with the release requirements.
- Consider enabling Firebase App Distribution for staged rollouts.

## Troubleshooting

- **Firebase connection fails**: Confirm `google-services.json` / `GoogleService-Info.plist` match the bundle ID and the device has network connectivity. Use `testFirebaseConnection()` logs.
- **Usage data not updating**: Ensure usage access, accessibility service, overlay, and battery optimization permissions are granted. Check logs from `AppUsageModule` and `AppBlockerModule`.
- **Location errors**: Android 10+ needs background location permission; watch for timeout (code 3) and re-request with lower accuracy fallback.
- **Metro bundler stuck**: Clear caches with `watchman watch-del-all && rm -rf node_modules && npm install && npm start -- --reset-cache`.
- **Tests failing due to native modules**: Review `jest.setup.js` mocks and add new mocks when additional native dependencies are introduced.

## Future Improvements

- Adopt a global state solution (Zustand, Redux, or React Context) for child context + permissions instead of prop drilling from `App.tsx`.
- Add offline queueing for telemetry to prevent data loss when the device is temporarily offline.
- Introduce TypeScript across services/screens for better type safety and shared models.
- Expand analytics (charts per week/month) directly inside `HomeScreen`.
- Harden security by integrating Firebase Auth tokens + custom claims into all Firestore writes.
- Automate documentation and release notes (e.g., generate docs into `docs/` and link from README).

## Contributing

1. Fork the repository and create a branch named `feature/<short-description>`.
2. Run `npm test` and ensure lint/tests pass before pushing.
3. Open a pull request with a clear description, screenshots (if UI changes), and testing notes.
4. For large changes (native modules, Firebase schema), please open an issue to discuss architecture beforehand.


## Contact / Author

- **Zoulfiqar** – [@zoulfiq4r](https://github.com/zoulfiq4r)
- Email: [zoulfiqar.kanso@gmail.com](mailto:zoulfiqar.kanso@gmail.com)

Feel free to connect for collaboration, code reviews, or recruiting inquiries.