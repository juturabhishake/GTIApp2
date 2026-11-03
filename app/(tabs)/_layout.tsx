import { Tabs, usePathname, useRouter, type Href } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, type ThemePreference } from '@/contexts/ThemeContext';

const navigationItems: { label: string; icon: keyof typeof Ionicons.glyphMap; path: Href }[] = [
  { label: 'Overview', icon: 'grid-outline', path: '/Home' },
  { label: 'Rejection Entry', icon: 'close-circle-outline', path: '/RejectionEntry' },
  { label: 'Transaction History', icon: 'time-outline', path: '/History' },
  { label: 'Guide', icon: 'compass-outline', path: '/explore' },
  { label: 'Settings', icon: 'options-outline', path: '/Settings' },
];

const themeChoices: { label: string; value: ThemePreference; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: 'System', value: 'system', icon: 'phone-portrait-outline' },
  { label: 'Light', value: 'light', icon: 'sunny-outline' },
  { label: 'Dark', value: 'dark', icon: 'moon-outline' },
];

export default function TabLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors, preference, setPreference, uiMode } = useAppTheme();
  const isLogin = pathname === '/';
  const isHome = pathname.toLowerCase().startsWith('/home');
  const isWide = width >= 768;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [credentialsReady, setCredentialsReady] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const routeHistory = useRef<string[]>([]);
  const previousUiMode = useRef(uiMode);
  const sidebarWidth = useRef(new Animated.Value(250)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.96)).current;
  const drawerSlide = useRef(new Animated.Value(-310)).current;
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;
  const closeProfileMenu = useCallback(() => {
    setProfileOpen(false);
    setSidebarProfileOpen(false);
    menuOpacity.setValue(0);
    menuScale.setValue(0.96);
  }, [menuOpacity, menuScale]);

  const toggleProfileOpen = useCallback(() => {
    setProfileOpen((prev) => {
      const next = !prev;
      if (!next) {
        menuOpacity.setValue(0);
        menuScale.setValue(0.96);
      }
      return next;
    });
  }, [menuOpacity, menuScale]);

  useEffect(() => {
    let active = true;
    Promise.all([
      SecureStore.getItemAsync('full_name'),
      SecureStore.getItemAsync('employee_id'),
    ]).then(([name, id]) => {
      if (!active) return;
      setFullName(name || '');
      setEmployeeId(id || '');
    }).catch((error) => {
      console.error('Unable to load saved account details:', error);
    }).finally(() => {
      if (active) setCredentialsReady(true);
    });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    Animated.timing(sidebarWidth, {
      toValue: collapsed ? 76 : 250,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: false,
    }).start();
  }, [collapsed, reduceMotion, sidebarWidth]);

  useEffect(() => {
    if (!profileOpen) {
      menuOpacity.setValue(0);
      menuScale.setValue(0.96);
      return;
    }
    menuOpacity.setValue(0);
    menuScale.setValue(0.96);
    Animated.parallel([
      Animated.timing(menuOpacity, {
        toValue: 1,
        duration: reduceMotion ? 0 : 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(menuScale, {
        toValue: 1,
        duration: reduceMotion ? 0 : 190,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [profileOpen, reduceMotion, menuOpacity, menuScale]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(drawerSlide, {
        toValue: drawerOpen ? 0 : -310,
        duration: reduceMotion ? 0 : drawerOpen ? 280 : 300,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdropOpacity, {
        toValue: drawerOpen ? 1 : 0,
        duration: reduceMotion ? 0 : drawerOpen ? 240 : 280,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerOpen, reduceMotion, drawerBackdropOpacity, drawerSlide]);

  useEffect(() => {
    if (isWide) setDrawerOpen(false);
  }, [isWide]);

  useEffect(() => {
    if (previousUiMode.current === uiMode) return;
    previousUiMode.current = uiMode;
    closeProfileMenu();
    if (uiMode === 'classic' && !isWide) {
      drawerSlide.setValue(-310);
      drawerBackdropOpacity.setValue(0);
      setDrawerOpen(true);
    } else {
      setDrawerOpen(false);
      drawerSlide.setValue(-310);
      drawerBackdropOpacity.setValue(0);
    }
  }, [closeProfileMenu, drawerBackdropOpacity, drawerSlide, isWide, uiMode]);

  useEffect(() => {
    const history = routeHistory.current;
    const previousPath = history[history.length - 1];
    if (previousPath === pathname) return;
    if (pathname === '/') {
      routeHistory.current = ['/'];
    } else if (previousPath === '/' && pathname.toLowerCase().startsWith('/home')) {
      history[history.length - 1] = pathname;
    } else {
      history.push(pathname);
    }
  }, [pathname]);

  useEffect(() => {
    closeProfileMenu();
  }, [pathname, closeProfileMenu]);

  const activeItem = useMemo(
    () => navigationItems.find((item) => pathname.toLowerCase().startsWith(String(item.path).toLowerCase())),
    [pathname],
  );

  const navigate = (path: Href) => {
    setDrawerOpen(false);
    closeProfileMenu();
    router.push(path);
  };

  const openProfileMenu = () => {
    closeProfileMenu();
    setSidebarProfileOpen((value) => !value);
  };

  const logout = async () => {
    closeProfileMenu();
    try {
      await Promise.all([
        SecureStore.deleteItemAsync('employee_id'),
        SecureStore.deleteItemAsync('full_name'),
        SecureStore.deleteItemAsync('password'),
        SecureStore.deleteItemAsync('user_id'),
        SecureStore.deleteItemAsync('department'),
        SecureStore.deleteItemAsync('position'),
        SecureStore.deleteItemAsync('section'),
        SecureStore.deleteItemAsync('logintype'),
        SecureStore.deleteItemAsync('tped'),
        SecureStore.deleteItemAsync('sop'),
        SecureStore.deleteItemAsync('ces'),
        SecureStore.deleteItemAsync('tl'),
      ]);
      setFullName('');
      setEmployeeId('');
      closeProfileMenu();
      router.replace('/');
    } catch (error) {
      console.error('Unable to clear saved credentials during logout:', error);
      Alert.alert('Unable to log out', 'Your saved sign-in details could not be cleared. Please try again.');
    }
  };

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (profileOpen) {
        closeProfileMenu();
        return true;
      }
      if (drawerOpen) {
        setDrawerOpen(false);
        return true;
      }
      if (isLogin) return false;
      if (isHome) {
        if (credentialsReady && (!fullName || !employeeId)) router.replace('/');
        return true;
      }
      const history = routeHistory.current;
      if (history.length > 1) {
        history.pop();
        const previousPath = history[history.length - 1];
        if (previousPath === '/' && fullName && employeeId) {
          history[0] = '/Home';
          router.replace('/Home');
        } else {
          router.replace(previousPath as Href);
        }
        return true;
      }
      if (fullName && employeeId) {
        router.replace('/Home');
        return true;
      }
      router.replace('/');
      return true;
    });
    return () => subscription.remove();
  }, [closeProfileMenu, credentialsReady, drawerOpen, employeeId, fullName, isHome, isLogin, profileOpen, router]);

  const renderNavigation = (compact: boolean, mobileDrawer = false) => (
    <View style={styles.navigationLayout}>
      <View style={[
        styles.brand,
        { borderBottomColor: colors.border },
        compact && styles.brandCompact,
        mobileDrawer && { paddingTop: insets.top, minHeight: 82 + insets.top },
      ]}>
        <View style={[styles.brandMark, { backgroundColor: colors.accentSoft }]}>
          <Image source={require('../../assets/images/gti_icon.png')} style={styles.brandLogo} resizeMode="contain" />
        </View>
        {!compact && (
          <View>
            <Text style={[styles.brandTitle, { color: colors.text }]}>GreenTech</Text>
            <Text style={[styles.brandCaption, { color: colors.muted }]}>INDUSTRIES</Text>
          </View>
        )}
        {mobileDrawer && (
          <Pressable
            onPress={() => setDrawerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
            style={({ pressed }) => [styles.closeButton, styles.drawerCloseButton, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={21} color={colors.muted} />
          </Pressable>
        )}
      </View>
      {!compact && <Text style={[styles.sectionLabel, { color: colors.muted }]}>WORKSPACE</Text>}
      <ScrollView
        style={styles.navigationScroll}
        contentContainerStyle={styles.navigationScrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.navList}>
          {navigationItems.map((item) => {
            const selected = activeItem?.path === item.path;
            return (
              <Pressable
                key={String(item.path)}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                accessibilityHint={compact ? `Open ${item.label}` : undefined}
                onPress={() => navigate(item.path)}
                style={({ pressed, hovered }) => [
                  styles.navItem,
                  compact && styles.navItemCompact,
                  selected && { backgroundColor: colors.accentSoft },
                  hovered && { backgroundColor: colors.accentSoft },
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons name={item.icon} size={20} color={selected ? colors.accent : colors.muted} />
                {!compact && (
                  <Text style={[styles.navLabel, { color: selected ? colors.accent : colors.text }]}>
                    {item.label}
                  </Text>
                )}
                {selected && !compact && <View style={[styles.activeMark, { backgroundColor: colors.accent }]} />}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      {!compact && (
        <View style={styles.sidebarFooterGroup}>
          {sidebarProfileOpen && (
            <View style={[styles.sidebarProfileMenu, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
              <View style={[styles.profileSummary, styles.sidebarProfileSummary, { borderBottomColor: colors.border }]}>
                <View style={[styles.avatarLarge, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="person" size={20} color={colors.accent} />
                </View>
                <View style={styles.profileCopy}>
                  <Text numberOfLines={1} style={[styles.profileName, { color: colors.text }]}>{fullName || 'Team member'}</Text>
                  {!!employeeId && <Text numberOfLines={1} style={[styles.profileMeta, { color: colors.muted }]}>Employee ID · {employeeId}</Text>}
                </View>
              </View>
              <Text style={[styles.profileSectionTitle, { color: colors.muted }]}>APPEARANCE</Text>
              <View style={[styles.themePicker, { backgroundColor: colors.surfaceAlt }]}>
                {themeChoices.map((choice) => {
                  const selected = preference === choice.value;
                  return (
                    <Pressable
                      key={choice.value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setPreference(choice.value).catch((error) => console.error('Unable to save theme preference:', error))}
                      style={[styles.themeOption, selected && { backgroundColor: colors.surfaceSolid }]}
                    >
                      <Ionicons name={choice.icon} size={15} color={selected ? colors.accent : colors.muted} />
                      <Text style={[styles.themeLabel, { color: selected ? colors.text : colors.muted }]}>{choice.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => { closeProfileMenu(); navigate('/profile'); }} style={[styles.profileAction, styles.sidebarProfileAction, { borderBottomColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={18} color={colors.muted} />
                <Text style={[styles.profileActionLabel, { color: colors.text }]}>My profile</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.muted} />
              </Pressable>
              <Pressable onPress={() => { closeProfileMenu(); void logout(); }} style={[styles.profileAction, styles.sidebarProfileAction, styles.profileActionLast]}>
                <Ionicons name="log-out-outline" size={18} color={colors.danger} />
                <Text style={[styles.profileActionLabel, { color: colors.danger }]}>Log out</Text>
              </Pressable>
            </View>
          )}
          <Pressable
            onPress={openProfileMenu}
            accessibilityRole="button"
            accessibilityLabel="Open profile and theme settings"
            style={({ pressed, hovered }) => [
              styles.sidebarFooter,
              {
                borderTopColor: colors.border,
                borderTopWidth: sidebarProfileOpen ? 0 : StyleSheet.hairlineWidth,
                backgroundColor: hovered ? colors.accentSoft : 'transparent',
              },
              pressed && styles.pressed,
            ]}
          >
            <View style={[styles.avatarSmall, { backgroundColor: colors.accentSoft }]}>
              <Ionicons name="person" size={16} color={colors.accent} />
            </View>
            <View style={styles.footerCopy}>
              <Text numberOfLines={1} style={[styles.footerName, { color: colors.text }]}>{fullName || 'Team member'}</Text>
              <Text style={[styles.footerRole, { color: colors.muted }]}>GTI workspace</Text>
            </View>
            <Ionicons name={sidebarProfileOpen ? 'chevron-down' : 'ellipsis-horizontal'} size={18} color={colors.muted} />
          </Pressable>
        </View>
      )}
    </View>
  );

  const renderProfileActions = (includeSettings = true) => (
    <>
      <View style={[styles.profileSummary, { borderBottomColor: colors.border }]}>
        <View style={[styles.avatarLarge, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="person" size={23} color={colors.accent} />
        </View>
        <View style={styles.profileCopy}>
          <Text numberOfLines={1} style={[styles.profileName, { color: colors.text }]}>{fullName || 'Team member'}</Text>
          {!!employeeId && <Text style={[styles.profileMeta, { color: colors.muted }]}>Employee ID · {employeeId}</Text>}
        </View>
      </View>
      <Text style={[styles.profileSectionTitle, { color: colors.muted }]}>{includeSettings ? 'THEME' : 'APPEARANCE'}</Text>
      <View style={[styles.themePicker, { backgroundColor: colors.surfaceAlt }]}>
        {themeChoices.map((choice) => {
          const selected = preference === choice.value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setPreference(choice.value).catch((error) => console.error('Unable to save theme preference:', error))}
              style={[styles.themeOption, selected && { backgroundColor: colors.surfaceSolid }]}
            >
              <Ionicons name={choice.icon} size={16} color={selected ? colors.accent : colors.muted} />
              <Text style={[styles.themeLabel, { color: selected ? colors.text : colors.muted }]}>{choice.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Pressable onPress={() => { closeProfileMenu(); navigate('/profile'); }} style={[styles.profileAction, { borderBottomColor: colors.border }]}>
        <Ionicons name="person-circle-outline" size={19} color={colors.muted} />
        <Text style={[styles.profileActionLabel, { color: colors.text }]}>My profile</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
      {includeSettings && (
        <Pressable onPress={() => { closeProfileMenu(); navigate('/Settings'); }} style={[styles.profileAction, { borderBottomColor: colors.border }]}>
          <Ionicons name="settings-outline" size={19} color={colors.muted} />
          <Text style={[styles.profileActionLabel, { color: colors.text }]}>Settings</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      )}
      <Pressable onPress={() => { closeProfileMenu(); void logout(); }} style={[styles.profileAction, styles.profileActionLast]}>
        <Ionicons name="log-out-outline" size={19} color={colors.danger} />
        <Text style={[styles.profileActionLabel, { color: colors.danger }]}>Log out</Text>
      </Pressable>
    </>
  );

  if (isLogin) {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="Home/index" />
        <Tabs.Screen name="RejectionEntry" />
        <Tabs.Screen name="Orders/index" />
        <Tabs.Screen name="History/index" />
        <Tabs.Screen name="Settings/index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="Scanner/index" />
        <Tabs.Screen name="trainingForm/index" />
      </Tabs>
    );
  }

  if (uiMode === 'modern') {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.screenArea}>
          <Tabs key={uiMode} screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="Home/index" />
            <Tabs.Screen name="RejectionEntry" />
            <Tabs.Screen name="Orders/index" />
            <Tabs.Screen name="History/index" />
            <Tabs.Screen name="Settings/index" />
            <Tabs.Screen name="explore" />
            <Tabs.Screen name="profile" />
            <Tabs.Screen name="Scanner/index" />
            <Tabs.Screen name="trainingForm/index" />
          </Tabs>
        </View>

        <View style={[styles.modernFooter, { backgroundColor: colors.surfaceSolid, borderTopColor: colors.border, paddingBottom: Math.max(8, insets.bottom) }]}>
          <View style={styles.modernFooterNavigation}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Home"
              accessibilityState={{ selected: pathname.toLowerCase().startsWith('/home') }}
              onPress={() => navigate('/Home')}
              style={({ pressed }) => [styles.modernFooterItem, pressed && styles.pressed]}
            >
              <View style={[styles.modernFooterItemContent, pathname.toLowerCase().startsWith('/home') && { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="home-outline" size={20} color={pathname.toLowerCase().startsWith('/home') ? colors.accent : colors.muted} />
                <Text style={[styles.modernFooterLabel, { color: pathname.toLowerCase().startsWith('/home') ? colors.accent : colors.muted }]}>Home</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Orders"
              accessibilityState={{ selected: pathname.toLowerCase().startsWith('/orders') }}
              onPress={() => navigate('/Orders')}
              style={({ pressed }) => [styles.modernFooterItem, pressed && styles.pressed]}
            >
              <View style={[styles.modernFooterItemContent, pathname.toLowerCase().startsWith('/orders') && { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="receipt-outline" size={20} color={pathname.toLowerCase().startsWith('/orders') ? colors.accent : colors.muted} />
                <Text style={[styles.modernFooterLabel, { color: pathname.toLowerCase().startsWith('/orders') ? colors.accent : colors.muted }]}>Orders</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start rejection entry"
              onPress={() => {
                setProfileOpen(false);
                navigate('/RejectionEntry');
              }}
              style={({ pressed }) => [styles.modernFooterItem, styles.modernFooterPrimaryItem, pressed && styles.pressed]}
            >
              <View style={[styles.modernFooterPrimaryAction, { backgroundColor: '#459CEB', borderColor: colors.surfaceSolid }]}>
                <Ionicons name="add" size={31} color={colors.surfaceSolid} />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="History"
              accessibilityState={{ selected: pathname.toLowerCase().startsWith('/history') }}
              onPress={() => navigate('/History')}
              style={({ pressed }) => [styles.modernFooterItem, pressed && styles.pressed]}
            >
              <View style={[styles.modernFooterItemContent, pathname.toLowerCase().startsWith('/history') && { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="time-outline" size={20} color={pathname.toLowerCase().startsWith('/history') ? colors.accent : colors.muted} />
                <Text style={[styles.modernFooterLabel, { color: pathname.toLowerCase().startsWith('/history') ? colors.accent : colors.muted }]}>History</Text>
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open profile, settings, theme, and logout"
              accessibilityState={{ expanded: profileOpen, selected: pathname.toLowerCase().startsWith('/profile') }}
              onPress={toggleProfileOpen}
              style={({ pressed }) => [styles.modernFooterItem, pressed && styles.pressed]}
            >
              <View style={[styles.modernFooterItemContent, (profileOpen || pathname.toLowerCase().startsWith('/profile')) && { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="person-outline" size={20} color={profileOpen || pathname.toLowerCase().startsWith('/profile') ? colors.accent : colors.muted} />
                <Text style={[styles.modernFooterLabel, { color: profileOpen || pathname.toLowerCase().startsWith('/profile') ? colors.accent : colors.muted }]}>Profile</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {profileOpen && (
          <View style={[StyleSheet.absoluteFill, styles.modernProfileLayer, { bottom: 72 + insets.bottom }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={closeProfileMenu}
              accessibilityLabel="Close profile menu"
            />
            <Animated.View style={[styles.profileMenu, styles.modernProfileMenu, {
              opacity: menuOpacity,
              backgroundColor: colors.surfaceSolid,
              borderColor: colors.border,
              transform: [{ scale: menuScale }],
            }]}>
              {renderProfileActions()}
            </Animated.View>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: insets.top, minHeight: 72 + insets.top }]}>
        <Pressable
          onPress={() => isWide ? setCollapsed((value) => !value) : setDrawerOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={isWide ? (collapsed ? 'Expand sidebar' : 'Collapse sidebar') : 'Open navigation'}
          style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.surface }, pressed && styles.pressed]}
        >
          <Ionicons name={isWide && !collapsed ? 'menu' : 'menu-outline'} size={21} color={colors.text} />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={[styles.headerEyebrow, { color: colors.muted }]}>GTI WORKSPACE</Text>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>{activeItem?.label || 'Workspace'}</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            onPress={toggleProfileOpen}
            accessibilityRole="button"
            accessibilityLabel="Open profile and theme settings"
            style={({ pressed }) => [styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
          >
            <Ionicons name="person-outline" size={19} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.body}>
        {isWide && (
          <Animated.View style={[styles.desktopSidebar, { width: sidebarWidth, backgroundColor: colors.surface, borderColor: colors.border }]}>
            {renderNavigation(collapsed)}
          </Animated.View>
        )}
        <View style={styles.screenArea}>
          <Tabs key={uiMode} screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="Home/index" />
            <Tabs.Screen name="RejectionEntry" />
            <Tabs.Screen name="Orders/index" />
            <Tabs.Screen name="History/index" />
            <Tabs.Screen name="Settings/index" />
            <Tabs.Screen name="explore" />
            <Tabs.Screen name="profile" />
            <Tabs.Screen name="Scanner/index" />
            <Tabs.Screen name="trainingForm/index" />
          </Tabs>
        </View>
      </View>

      {!isWide && (
        <View
          style={[StyleSheet.absoluteFill, { zIndex: 8 }]}
          pointerEvents={drawerOpen ? 'auto' : 'none'}
        >
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: drawerBackdropOpacity }]}>
            <Pressable onPress={() => setDrawerOpen(false)} style={StyleSheet.absoluteFill} accessibilityLabel="Close navigation drawer">
              <BlurView intensity={20} tint="dark" style={[StyleSheet.absoluteFill, styles.backdrop]} />
            </Pressable>
          </Animated.View>
          <Animated.View style={[styles.mobileSidebar, { backgroundColor: colors.surfaceSolid, borderColor: colors.border, paddingBottom: Math.max(10, insets.bottom), transform: [{ translateX: drawerSlide }] }]}>
            {renderNavigation(false, true)}
          </Animated.View>
        </View>
      )}

      {profileOpen && (
        <View style={[StyleSheet.absoluteFill, styles.profileLayer]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeProfileMenu}
            accessibilityLabel="Close profile menu"
          />
          <Animated.View style={[styles.profileMenu, {
            top: 62 + insets.top,
            opacity: menuOpacity,
            backgroundColor: colors.surfaceSolid,
            borderColor: colors.border,
            transform: [{ scale: menuScale }],
          }]}>
            {renderProfileActions(false)}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  modernHeader: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  header: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 2,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitleGroup: { flex: 1, gap: 2 },
  headerEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  profileButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  body: { flex: 1, flexDirection: 'row', minHeight: 0 },
  desktopSidebar: { margin: 14, marginRight: 0, borderRadius: 22, borderWidth: 1, overflow: 'hidden' },
  navigationLayout: { flex: 1, minHeight: 0 },
  screenArea: { flex: 1, minWidth: 0, overflow: 'hidden' },
  modernFooter: { minHeight: 72, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 7, justifyContent: 'center' },
  modernFooterNavigation: { width: '100%', maxWidth: 600, alignSelf: 'center', height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 },
  modernFooterItem: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'center' },
  modernFooterItemContent: { width: '84%', maxWidth: 76, minWidth: 60, height: 54, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', gap: 2, borderRadius: 22, overflow: 'hidden' },
  modernFooterLabel: { fontSize: 9, lineHeight: 12, fontWeight: '600', textAlign: 'center' },
  modernFooterPrimaryItem: { overflow: 'visible' },
  modernFooterPrimaryAction: { width: 70, height: 70, marginTop: -25, borderWidth: 6, borderRadius: 35, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 9 },
  brand: { minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  brandCompact: { justifyContent: 'center', paddingHorizontal: 0 },
  brandMark: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  brandLogo: { width: 30, height: 30 },
  brandTitle: { fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  brandCaption: { marginTop: 3, fontSize: 9, letterSpacing: 1.7, fontWeight: '600' },
  sectionLabel: { marginTop: 24, marginBottom: 10, marginHorizontal: 18, fontSize: 9, letterSpacing: 1.5, fontWeight: '700' },
  navList: { paddingHorizontal: 10, gap: 5 },
  navItem: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 12, borderRadius: 14 },
  navItemCompact: { justifyContent: 'center', paddingHorizontal: 0 },
  navLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
  activeMark: { width: 5, height: 5, borderRadius: 3 },
  navigationScroll: { flex: 1, minHeight: 0 },
  navigationScrollContent: { flexGrow: 1 },
  sidebarFooterGroup: { marginTop: 'auto' },
  sidebarFooter: { minHeight: 72, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, gap: 10 },
  avatarSmall: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  footerCopy: { flex: 1 },
  footerName: { fontSize: 12, fontWeight: '700' },
  footerRole: { fontSize: 10, marginTop: 3 },
  pressed: { opacity: 0.75 },
  backdrop: { backgroundColor: 'rgba(5,16,20,0.38)' },
  mobileSidebar: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 290, maxWidth: '84%', paddingBottom: 10, borderRightWidth: 1, borderTopRightRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  drawerCloseButton: { marginLeft: 'auto' },
  sidebarProfileMenu: { marginHorizontal: 10, marginBottom: 8, paddingHorizontal: 11, paddingTop: 12, paddingBottom: 5, borderRadius: 16, borderWidth: 1 },
  sidebarProfileSummary: { paddingBottom: 10, marginBottom: 10 },
  sidebarProfileAction: { minHeight: 39 },
  profileLayer: { zIndex: 10, alignItems: 'flex-end' },
  modernProfileLayer: { zIndex: 10, alignItems: 'flex-end' },
  profileMenu: { position: 'absolute', top: 62, right: 14, width: 310, maxWidth: '92%', borderRadius: 20, borderWidth: 1, padding: 16, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  modernProfileMenu: { top: undefined, bottom: 8, maxWidth: '100%' },
  profileSummary: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 15, marginBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  avatarLarge: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  profileCopy: { flex: 1 },
  profileName: { fontSize: 14, fontWeight: '700' },
  profileMeta: { fontSize: 10, marginTop: 4 },
  profileSectionTitle: { fontSize: 9, letterSpacing: 1.2, fontWeight: '700', marginBottom: 9 },
  themePicker: { flexDirection: 'row', padding: 4, borderRadius: 13, gap: 2, marginBottom: 12 },
  themeOption: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 9, borderRadius: 10 },
  themeLabel: { fontSize: 10, fontWeight: '600' },
  profileAction: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  profileActionLast: { borderBottomWidth: 0 },
  profileActionLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
});
