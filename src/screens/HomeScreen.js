import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import DeviceInfo from 'react-native-device-info';
import {
  subscribeToLocalUsageState,
  refreshForegroundApp,
} from '../services/appUsageService';
import {
  listenToDailyUsageAggregate,
  listenToRecentSessions,
  fetchUsageWindowSummary,
  listenToDeviceCurrentApp,
  toDateKey,
} from '../services/appUsageAnalytics';
import { sendLocationUpdate } from '../services/locationService';

const formatDuration = (ms) => {
  if (!ms || Number.isNaN(ms)) {
    return '0m';
  }
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours && minutes) {
    return `${hours}h ${minutes}m`;
  }
  if (hours) {
    return `${hours}h`;
  }
  if (minutes) {
    return `${minutes}m`;
  }
  return '<1m';
};

const formatTimeRange = (start, end) => {
  if (!start || !end) {
    return 'Unknown';
  }
  const startText = start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const endText = end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return `${startText} - ${endText}`;
};

const formatActiveDuration = (since) => {
  if (!since) {
    return 'Just now';
  }
  const durationMs = Date.now() - since;
  if (durationMs < 60_000) {
    return 'Just now';
  }
  const minutes = Math.floor(durationMs / 60_000);
  if (minutes < 60) {
    return `${minutes}m active`;
  }
  const hours = Math.floor(minutes / 60);
  const leftoverMinutes = minutes % 60;
  if (leftoverMinutes === 0) {
    return `${hours}h active`;
  }
  return `${hours}h ${leftoverMinutes}m active`;
};

const LiveIndicator = ({ label }) => (
  <View style={styles.liveIndicator}>
    <View style={styles.liveDot} />
    <Text style={styles.liveText}>{label}</Text>
  </View>
);

export default function HomeScreen({ onNavigateToSettings, childContext, permissionState }) {
  const [appsRefreshing, setAppsRefreshing] = useState(false);
  const [locationRefreshing, setLocationRefreshing] = useState(false);
  const [dailyUsage, setDailyUsage] = useState({
    totalDurationMs: 0,
    apps: [],
    hours: [],
    updatedAt: null,
  });
  const [recentSessions, setRecentSessions] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState({
    totalDurationMs: 0,
    averagePerDayMs: 0,
  });
  const [monthlySummary, setMonthlySummary] = useState({
    totalDurationMs: 0,
    averagePerDayMs: 0,
  });
  const [currentApp, setCurrentApp] = useState(null);
  const [deviceId, setDeviceId] = useState(null);
  const [localSnapshot, setLocalSnapshot] = useState(null);
  const [lastLocationUpdate, setLastLocationUpdate] = useState(null);
  const [lastLocationError, setLastLocationError] = useState(null);

  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const childName = childContext?.childName || 'Child Device';
  const activeAppInfo = localSnapshot?.activeApp || currentApp;

  const fallbackTotalDuration = useMemo(() => {
    if (dailyUsage.totalDurationMs) {
      return dailyUsage.totalDurationMs;
    }
    if (localSnapshot?.totals?.length) {
      return localSnapshot.totals.reduce((sum, item) => sum + (item.durationMs || 0), 0);
    }
    return 0;
  }, [dailyUsage.totalDurationMs, localSnapshot]);

  const mostUsedApps = useMemo(() => {
    const base = dailyUsage.apps && dailyUsage.apps.length > 0
      ? dailyUsage.apps
      : localSnapshot?.totals || [];
    return base.slice(0, 5);
  }, [dailyUsage.apps, localSnapshot]);

  const recentActivity = useMemo(() => {
    if (recentSessions.length > 0) {
      return recentSessions;
    }
    if (localSnapshot?.recentSessions?.length) {
      return localSnapshot.recentSessions.map((session) => ({
        id: `${session.packageName}-${session.startTimeMs}`,
        packageName: session.packageName,
        appName: session.appName,
        durationMs: session.durationMs,
        startTime: session.startTimeMs ? new Date(session.startTimeMs) : null,
        endTime: session.endTimeMs ? new Date(session.endTimeMs) : null,
      }));
    }
    return [];
  }, [recentSessions, localSnapshot]);

  const loadUsageWindows = useCallback(
    async (childIdParam) => {
      const targetChildId = childIdParam || childContext?.childId;
      if (!targetChildId) {
        return;
      }
      try {
        const [weekly, monthly] = await Promise.all([
          fetchUsageWindowSummary(targetChildId, 7),
          fetchUsageWindowSummary(targetChildId, 30),
        ]);
        setWeeklySummary({
          totalDurationMs: weekly.totalDurationMs || 0,
          averagePerDayMs: weekly.averagePerDayMs || 0,
        });
        setMonthlySummary({
          totalDurationMs: monthly.totalDurationMs || 0,
          averagePerDayMs: monthly.averagePerDayMs || 0,
        });
      } catch (error) {
        console.error('Failed to load usage summary windows', error);
      }
    },
    [childContext?.childId],
  );

  useEffect(() => {
    DeviceInfo.getUniqueId().then(setDeviceId).catch(() => {});
  }, []);

  useEffect(() => {
    const unsubscribeLocal = subscribeToLocalUsageState(setLocalSnapshot);
    return unsubscribeLocal;
  }, []);

  useEffect(() => {
    if (!childContext?.childId) {
      setDailyUsage({
        totalDurationMs: 0,
        apps: [],
        hours: [],
        updatedAt: null,
      });
      setRecentSessions([]);
      return;
    }

    const aggregateUnsubscribe = listenToDailyUsageAggregate(
      childContext.childId,
      todayKey,
      (data) => {
        setDailyUsage(data);
      },
    );

    const sessionsUnsubscribe = listenToRecentSessions(
      childContext.childId,
      todayKey,
      30,
      (sessions) => {
        setRecentSessions(sessions);
      },
    );

    loadUsageWindows(childContext.childId);
    refreshForegroundApp().catch(() => {});

    return () => {
      aggregateUnsubscribe?.();
      sessionsUnsubscribe?.();
    };
  }, [childContext, todayKey, loadUsageWindows]);

  useEffect(() => {
    if (!deviceId) {
      return;
    }
    const unsubscribe = listenToDeviceCurrentApp(deviceId, setCurrentApp);
    return unsubscribe;
  }, [deviceId]);

  const handleRefresh = useCallback(async () => {
    if (!childContext?.childId) {
      return;
    }
    setAppsRefreshing(true);
    try {
      await Promise.all([refreshForegroundApp(), loadUsageWindows(childContext.childId)]);
    } catch (error) {
      console.error('Failed to refresh usage dashboard', error);
    } finally {
      setAppsRefreshing(false);
    }
  }, [childContext?.childId, loadUsageWindows]);

  const handleRefreshLocation = useCallback(async () => {
    if (!childContext?.childId) {
      return;
    }
    setLocationRefreshing(true);
    try {
      const result = await sendLocationUpdate(childContext.childId);
      if (
        result &&
        typeof result.latitude === 'number' &&
        typeof result.longitude === 'number'
      ) {
        setLastLocationUpdate({
          latitude: result.latitude,
          longitude: result.longitude,
          accuracy: typeof result.accuracy === 'number' ? result.accuracy : null,
          timestamp: Date.now(),
        });
        setLastLocationError(null);
      } else {
        setLastLocationError('Location data unavailable');
      }
    } catch (error) {
      console.error('Failed to refresh location dashboard', error);
      setLastLocationError(error?.message || 'Failed to refresh location');
    } finally {
      setLocationRefreshing(false);
    }
  }, [childContext?.childId]);

  const maxUsageDuration = useMemo(() => {
    if (mostUsedApps.length === 0) {
      return 0;
    }
    return mostUsedApps[0].durationMs || 0;
  }, [mostUsedApps]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F0F9FF" />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={appsRefreshing}
            onRefresh={handleRefresh}
            tintColor="#2563EB"
            colors={['#2563EB']}
          />
        }
      >
        <View style={styles.headerCard}>
          <View>
            <Text style={styles.headerTitle}>{childName}</Text>
            <Text style={styles.headerSubtitle}>Paired device usage overview</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={onNavigateToSettings}>
            <Text style={styles.settingsButtonText}>Settings</Text>
          </TouchableOpacity>
        </View>

        {!childContext?.childId ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Pair a device to get started</Text>
            <Text style={styles.emptyState}>
              Once the child device is paired and permissions are granted, live usage insights will
              appear here automatically.
            </Text>
            <TouchableOpacity style={styles.warningButton} onPress={onNavigateToSettings}>
              <Text style={styles.warningButtonText}>Open Settings</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {!permissionState?.usage && (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Usage access needed</Text>
                <Text style={styles.warningDescription}>
                  Grant usage access so we can monitor screen time in real-time.
                </Text>
                <TouchableOpacity style={styles.warningButton} onPress={handleRefresh}>
                  <Text style={styles.warningButtonText}>Check Permission</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.liveCard}>
              <View style={styles.liveHeader}>
                <Text style={styles.cardTitle}>Live App Activity</Text>
                <LiveIndicator label={activeAppInfo ? 'Live' : 'Idle'} />
              </View>
              {activeAppInfo ? (
                <View style={styles.liveContent}>
                  <Text style={styles.liveAppName}>{activeAppInfo.appName}</Text>
                  <Text style={styles.liveAppDetails}>{activeAppInfo.packageName}</Text>
                  <Text style={styles.liveAppSince}>
                    {formatActiveDuration(activeAppInfo.since)}
                  </Text>
                </View>
              ) : (
                <Text style={styles.liveIdleText}>No app is active right now.</Text>
              )}
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Today</Text>
                <Text style={styles.summaryValue}>{formatDuration(fallbackTotalDuration)}</Text>
                <Text style={styles.summaryCaption}>Total screen time</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Past 7 days</Text>
                <Text style={styles.summaryValue}>
                  {formatDuration(weeklySummary.totalDurationMs)}
                </Text>
                <Text style={styles.summaryCaption}>
                  Avg {formatDuration(weeklySummary.averagePerDayMs)} / day
                </Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Past 30 days</Text>
                <Text style={styles.summaryValue}>
                  {formatDuration(monthlySummary.totalDurationMs)}
                </Text>
                <Text style={styles.summaryCaption}>
                  Avg {formatDuration(monthlySummary.averagePerDayMs)} / day
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Most Used Apps Today</Text>
                  <Text style={styles.cardSubtitle}>
                    {formatDuration(fallbackTotalDuration)} total
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.refreshButton,
                    !childContext?.childId && styles.refreshButtonDisabled,
                    appsRefreshing && styles.refreshButtonDisabled,
                  ]}
                  onPress={handleRefresh}
                  disabled={appsRefreshing || !childContext?.childId}
                >
                  <Text style={styles.refreshButtonText}>
                    {appsRefreshing ? 'Refreshing...' : 'Refresh'}
                  </Text>
                </TouchableOpacity>
              </View>
              {mostUsedApps.length === 0 ? (
                <Text style={styles.emptyState}>No usage recorded yet.</Text>
              ) : (
                mostUsedApps.map((app, index) => {
                  const progress =
                    maxUsageDuration > 0 ? Math.max(6, (app.durationMs / maxUsageDuration) * 100) : 0;
                  return (
                    <View key={app.packageName} style={styles.appRow}>
                      <View style={styles.appInfo}>
                        <Text style={styles.appRank}>{index + 1}</Text>
                        <View>
                          <Text style={styles.appName}>{app.appName}</Text>
                          <Text style={styles.appPackage}>{app.packageName}</Text>
                        </View>
                      </View>
                      <View style={styles.appUsageDetails}>
                        <Text style={styles.appDuration}>{formatDuration(app.durationMs)}</Text>
                        <Text style={styles.appSessions}>{app.sessions || 0} sessions</Text>
                        <View style={styles.usageBar}>
                          <View style={[styles.usageBarFill, { width: `${progress}%` }]} />
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Hourly Usage</Text>
                <Text style={styles.cardSubtitle}>Today&apos;s breakdown</Text>
              </View>
              {dailyUsage.hours?.length ? (
                dailyUsage.hours.map((entry) => {
                  const progress = fallbackTotalDuration
                    ? Math.max(4, (entry.durationMs / fallbackTotalDuration) * 100)
                    : 0;
                  return (
                    <View key={entry.hour} style={styles.hourRow}>
                      <Text style={styles.hourLabel}>{entry.hour}</Text>
                      <View style={styles.hourBar}>
                        <View style={[styles.hourBarFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.hourDuration}>{formatDuration(entry.durationMs)}</Text>
                    </View>
                  );
                })
              ) : (
                <Text style={styles.emptyState}>
                  Usage by hour will appear once sessions are logged.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Recent Activity</Text>
                <Text style={styles.cardSubtitle}>{todayKey}</Text>
              </View>
              {recentActivity.length === 0 ? (
                <Text style={styles.emptyState}>No app activity recorded yet today.</Text>
              ) : (
                recentActivity.map((session) => (
                  <View key={session.id} style={styles.sessionRow}>
                    <View>
                      <Text style={styles.sessionAppName}>{session.appName}</Text>
                      <Text style={styles.sessionTime}>
                        {formatTimeRange(session.startTime, session.endTime)}
                      </Text>
                    </View>
                    <View style={styles.sessionDurationContainer}>
                      <Text style={styles.sessionDuration}>{formatDuration(session.durationMs)}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.cardTitle}>Monitoring Status</Text>
                  <Text style={styles.cardSubtitle}>Quick overview of safety services</Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.refreshButton,
                    styles.refreshButtonSecondary,
                    locationRefreshing && styles.refreshButtonDisabled,
                    !childContext?.childId && styles.refreshButtonDisabled,
                  ]}
                  onPress={handleRefreshLocation}
                  disabled={locationRefreshing || !childContext?.childId}
                >
                  <Text
                    style={[
                      styles.refreshButtonText,
                      styles.refreshButtonTextSecondary,
                    ]}
                  >
                    {locationRefreshing ? 'Refreshing...' : 'Refresh Location'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.statusGrid}>
                <View style={styles.statusPill}>
                  <Text style={styles.statusEmoji}>📍</Text>
                  <Text style={styles.statusLabel}>Location</Text>
                  <Text style={styles.statusValue}>
                    {permissionState?.location ? 'Active' : 'Needs attention'}
                  </Text>
                </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusEmoji}>📊</Text>
              <Text style={styles.statusLabel}>Usage</Text>
              <Text style={styles.statusValue}>
                {permissionState?.usage ? 'Tracking' : 'Waiting'}
              </Text>
            </View>
            <View style={styles.statusPill}>
              <Text style={styles.statusEmoji}>🚫</Text>
              <Text style={styles.statusLabel}>App Blocking</Text>
                  <Text style={styles.statusValue}>
                    {permissionState?.accessibility && permissionState?.overlay
                      ? 'Ready'
                      : 'Needs setup'}
                  </Text>
                </View>
              </View>
              {lastLocationError ? (
                <Text style={styles.statusError}>{lastLocationError}</Text>
              ) : lastLocationUpdate ? (
                <Text style={styles.statusInfo}>
                  Last updated{' '}
                  {new Date(lastLocationUpdate.timestamp).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {` - ${lastLocationUpdate.latitude.toFixed(4)}, ${lastLocationUpdate.longitude.toFixed(4)}`}
                  {Number.isFinite(lastLocationUpdate.accuracy)
                    ? ` (+/-${Math.round(lastLocationUpdate.accuracy)}m)`
                    : ''}
                </Text>
              ) : null}
            </View>
          </>
        )}

        <Text style={styles.footerNote}>
          Reports update in real time. Daily, weekly, and monthly insights help parents understand
          screen habits instantly.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    backgroundColor: '#1E3A8A',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#BFDBFE',
  },
  settingsButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  settingsButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 6,
  },
  warningDescription: {
    fontSize: 14,
    color: '#B45309',
    marginBottom: 12,
  },
  warningButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#F97316',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  warningButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  liveCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  liveHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  liveContent: {
    gap: 4,
  },
  liveAppName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  liveAppDetails: {
    fontSize: 13,
    color: '#64748B',
  },
  liveAppSince: {
    fontSize: 13,
    color: '#0EA5E9',
    fontWeight: '600',
  },
  liveIdleText: {
    fontSize: 14,
    color: '#64748B',
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  liveText: {
    color: '#B91C1C',
    fontWeight: '600',
    fontSize: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
    marginBottom: 6,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  summaryCaption: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyState: {
    fontSize: 14,
    color: '#94A3B8',
  },
  appRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  appInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  appRank: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2563EB',
    width: 24,
    textAlign: 'center',
  },
  appName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  appPackage: {
    fontSize: 12,
    color: '#94A3B8',
  },
  appUsageDetails: {
    flex: 1,
    alignItems: 'flex-end',
  },
  appDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  appSessions: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 6,
  },
  usageBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  usageBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  hourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  hourLabel: {
    width: 52,
    fontSize: 13,
    color: '#475569',
  },
  hourBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  hourBarFill: {
    height: '100%',
    backgroundColor: '#22D3EE',
  },
  hourDuration: {
    width: 60,
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  sessionAppName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
  },
  sessionTime: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  sessionDurationContainer: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  sessionDuration: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2563EB',
  },
  statusGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statusPill: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusEmoji: {
    fontSize: 18,
  },
  statusLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
  },
  footerNote: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 8,
  },
  refreshButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  refreshButtonSecondary: {
    backgroundColor: '#E0F2FE',
  },
  refreshButtonDisabled: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  refreshButtonTextSecondary: {
    color: '#1E3A8A',
  },
  statusInfo: {
    marginTop: 12,
    fontSize: 12,
    color: '#2563EB',
  },
  statusError: {
    marginTop: 12,
    fontSize: 12,
    color: '#DC2626',
  },
});
