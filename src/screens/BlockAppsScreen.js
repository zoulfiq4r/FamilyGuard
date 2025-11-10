import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { setAppBlocked, subscribeToAppControls } from '../services/appControlsService';
import { subscribeToChildApps, getAppsFromLocalUsage } from '../services/appListService';

export default function BlockAppsScreen({ onBack, childContext }) {
  const [apps, setApps] = useState([]);
  const [appControls, setAppControls] = useState({ apps: {} });
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [updatingApps, setUpdatingApps] = useState(new Set());
  const [showBlockedOnly, setShowBlockedOnly] = useState(false);

  const familyId = childContext?.parentId || childContext?.familyId;
  const childId = childContext?.childId;

  // Load apps and controls
  useEffect(() => {
    if (!childId) {
      setLoading(false);
      return;
    }

    let appsUnsubscribe = null;
    let controlsUnsubscribe = null;

    const loadApps = async () => {
      try {
        setLoading(true);

        // Try to get apps from child's apps collection first
        const childAppsUnsubscribe = subscribeToChildApps(childId, (childApps) => {
          if (childApps.length > 0) {
            setApps(childApps);
            setLoading(false);
          }
        });

        appsUnsubscribe = childAppsUnsubscribe;

        // Also get apps from local usage as fallback
        const localApps = await getAppsFromLocalUsage();
        if (localApps.length > 0 && apps.length === 0) {
          setApps(localApps);
          setLoading(false);
        }
      } catch (error) {
        console.error('Failed to load apps', error);
        setLoading(false);
      }
    };

    loadApps();

    // Subscribe to app controls
    if (familyId && childId) {
      controlsUnsubscribe = subscribeToAppControls(familyId, childId, (controls) => {
        setAppControls(controls);
      });
    }

    return () => {
      appsUnsubscribe?.();
      controlsUnsubscribe?.();
    };
  }, [childId, familyId]);

  const handleToggleBlock = useCallback(
    async (packageName, currentlyBlocked) => {
      if (!familyId || !childId) {
        Alert.alert('Error', 'Missing required information. Please ensure device is paired.');
        return;
      }

      setUpdatingApps((prev) => new Set(prev).add(packageName));

      try {
        const newBlockedState = !currentlyBlocked;
        await setAppBlocked(familyId, childId, packageName, newBlockedState);

        // Update local state immediately for better UX
        setAppControls((prev) => ({
          ...prev,
          apps: {
            ...prev.apps,
            [packageName]: {
              ...prev.apps[packageName],
              blocked: newBlockedState,
            },
          },
        }));
      } catch (error) {
        console.error('Failed to toggle app block status', error);
        Alert.alert(
          'Error',
          `Failed to ${currentlyBlocked ? 'unblock' : 'block'} app. Please try again.`,
        );
      } finally {
        setUpdatingApps((prev) => {
          const next = new Set(prev);
          next.delete(packageName);
          return next;
        });
      }
    },
    [familyId, childId],
  );

  const filteredApps = useMemo(() => {
    let filtered = apps;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(
        (app) =>
          app.appName.toLowerCase().includes(query) ||
          app.packageName.toLowerCase().includes(query),
      );
    }

    // Filter by blocked status
    if (showBlockedOnly) {
      filtered = filtered.filter((app) => {
        const control = appControls.apps[app.packageName];
        return control?.blocked === true;
      });
    }

    // Sort: blocked apps first, then alphabetically
    return filtered.sort((a, b) => {
      const aBlocked = appControls.apps[a.packageName]?.blocked || false;
      const bBlocked = appControls.apps[b.packageName]?.blocked || false;

      if (aBlocked && !bBlocked) return -1;
      if (!aBlocked && bBlocked) return 1;
      return a.appName.localeCompare(b.appName);
    });
  }, [apps, searchQuery, showBlockedOnly, appControls]);

  const blockedCount = useMemo(() => {
    return apps.filter((app) => appControls.apps[app.packageName]?.blocked).length;
  }, [apps, appControls]);

  if (!childId) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <View style={styles.backButtonInner}>
              <Text style={styles.backIcon}>←</Text>
            </View>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Block Apps</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Device must be paired to manage app blocking.</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={onBack}>
            <Text style={styles.emptyButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.backButtonInner}>
            <Text style={styles.backIcon}>←</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Block Apps</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>App Blocking</Text>
          <Text style={styles.infoText}>
            Block apps to prevent them from being opened. Blocked apps will show an overlay when
            attempted to open.
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{apps.length}</Text>
              <Text style={styles.statLabel}>Total Apps</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{blockedCount}</Text>
              <Text style={styles.statLabel}>Blocked</Text>
            </View>
          </View>
        </View>

        {/* Search and Filter */}
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search apps..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>Show blocked only</Text>
            <Switch
              value={showBlockedOnly}
              onValueChange={setShowBlockedOnly}
              trackColor={{ false: '#D1D5DB', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Apps List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading apps...</Text>
          </View>
        ) : filteredApps.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'No apps found matching your search.'
                : showBlockedOnly
                  ? 'No blocked apps.'
                  : 'No apps available. Apps will appear here once they are used.'}
            </Text>
          </View>
        ) : (
          <View style={styles.appsList}>
            {filteredApps.map((app) => {
              const control = appControls.apps[app.packageName] || {};
              const isBlocked = control.blocked === true;
              const isUpdating = updatingApps.has(app.packageName);

              return (
                <View key={app.packageName} style={styles.appItem}>
                  <View style={styles.appInfo}>
                    <Text style={styles.appName}>{app.appName}</Text>
                    <Text style={styles.appPackage} numberOfLines={1}>
                      {app.packageName}
                    </Text>
                    {(app.usageMinutes > 0 || (app.durationMs && app.durationMs > 0)) && (
                      <Text style={styles.appUsage}>
                        {app.usageMinutes
                          ? `${Math.round(app.usageMinutes)} min used`
                          : app.durationMs
                            ? `${Math.round(app.durationMs / 60000)} min used`
                            : ''}
                      </Text>
                    )}
                  </View>
                  <View style={styles.appActions}>
                    {isUpdating ? (
                      <ActivityIndicator size="small" color="#2563EB" />
                    ) : (
                      <Switch
                        value={isBlocked}
                        onValueChange={() => handleToggleBlock(app.packageName, isBlocked)}
                        trackColor={{ false: '#D1D5DB', true: '#EF4444' }}
                        thumbColor="#FFFFFF"
                      />
                    )}
                    {isBlocked && (
                      <View style={styles.blockedBadge}>
                        <Text style={styles.blockedBadgeText}>BLOCKED</Text>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Footer Note */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Note: App blocking requires accessibility and overlay permissions. Make sure these are
            enabled in Settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0F9FF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  backButtonInner: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  backIcon: {
    fontSize: 18,
    color: '#374151',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  placeholder: {
    width: 48,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  searchContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterLabel: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  appsList: {
    gap: 8,
  },
  appItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  appInfo: {
    flex: 1,
    marginRight: 12,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  appPackage: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  appUsage: {
    fontSize: 12,
    color: '#2563EB',
  },
  appActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  blockedBadge: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  blockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#DC2626',
  },
  footer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  footerText: {
    fontSize: 12,
    color: '#92400E',
    lineHeight: 18,
  },
});

