import { Tabs, usePathname, useRouter, type Href } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
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
  { label: 'Scanner', icon: 'scan-outline', path: '/Scanner' },
  { label: 'Training form', icon: 'document-text-outline', path: '/trainingForm' },
  { label: 'Guide', icon: 'compass-outline', path: '/explore' },
  { label: 'Settings', icon: 'options-outline', path: '/Settings' },
  { label: 'Profile', icon: 'person-outline', path: '/profile' },
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
  const { colors, preference, setPreference } = useAppTheme();
  const isLogin = pathname === '/';
  const isWide = width >= 900;
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [sidebarProfileOpen, setSidebarProfileOpen] = useState(false);
  const [fullName, setFullName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [reduceMotion, setReduceMotion] = useState(false);
  const sidebarWidth = useRef(new Animated.Value(250)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const menuScale = useRef(new Animated.Value(0.96)).current;
  const drawerSlide = useRef(new Animated.Value(-310)).current;
  const drawerBackdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    Promise.all([
      SecureStore.getItemAsync('full_name'),
      SecureStore.getItemAsync('employee_id'),
    ]).then(([name, id]) => {
      if (!active) return;
      setFullName(name || '');
      setEmployeeId(id || '');
    });
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(sidebarWidth, {
      toValue: collapsed ? 76 : 250,
      duration: reduceMotion ? 0 : 220,
      useNativeDriver: false,
    }).start();
  }, [collapsed, reduceMotion, sidebarWidth]);

  useEffect(() => {
    const opening = profileOpen;
    Animated.parallel([
      Animated.timing(menuOpacity, {
        toValue: opening ? 1 : 0,
        duration: reduceMotion ? 0 : opening ? 190 : 240,
        easing: opening ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(menuScale, {
        toValue: opening ? 1 : 0.96,
        duration: reduceMotion ? 0 : opening ? 190 : 240,
        easing: opening ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
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

  const activeItem = useMemo(
    () => navigationItems.find((item) => pathname.toLowerCase().startsWith(String(item.path).toLowerCase())),
    [pathname],
  );

  const navigate = (path: Href) => {
    setDrawerOpen(false);
    setProfileOpen(false);
    setSidebarProfileOpen(false);
    router.push(path);
  };

  const openProfileMenu = () => {
    setProfileOpen(false);
    setSidebarProfileOpen((value) => !value);
  };

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
              <Pressable onPress={() => navigate('/profile')} style={[styles.profileAction, styles.sidebarProfileAction, { borderBottomColor: colors.border }]}>
                <Ionicons name="person-circle-outline" size={18} color={colors.muted} />
                <Text style={[styles.profileActionLabel, { color: colors.text }]}>My profile</Text>
                <Ionicons name="chevron-forward" size={15} color={colors.muted} />
              </Pressable>
              <Pressable onPress={() => navigate('/')} style={[styles.profileAction, styles.sidebarProfileAction]}>
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

  if (isLogin) {
    return (
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="index" />
        <Tabs.Screen name="Home/index" />
        <Tabs.Screen name="Settings/index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="profile" />
        <Tabs.Screen name="Scanner/index" />
        <Tabs.Screen name="trainingForm/index" />
      </Tabs>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border, paddingTop: insets.top, minHeight: 72 + insets.top }]}>
        <Pressable
          onPress={() => isWide ? setCollapsed((value) => !value) : setDrawerOpen(true)}
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
            onPress={() => setProfileOpen((value) => !value)}
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
          <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
            <Tabs.Screen name="index" />
            <Tabs.Screen name="Home/index" />
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

      <View style={[StyleSheet.absoluteFill, styles.profileLayer]} pointerEvents={profileOpen ? 'auto' : 'none'}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setProfileOpen(false)}
            accessibilityLabel="Close profile menu"
            pointerEvents={profileOpen ? 'auto' : 'none'}
          />
          <Animated.View style={[styles.profileMenu, {
            top: 62 + insets.top,
            opacity: menuOpacity,
            backgroundColor: colors.surfaceSolid,
            borderColor: colors.border,
            transform: [{ scale: menuScale }],
          }]}>
            <View style={[styles.profileSummary, { borderBottomColor: colors.border }]}>
              <View style={[styles.avatarLarge, { backgroundColor: colors.accentSoft }]}>
                <Ionicons name="person" size={23} color={colors.accent} />
              </View>
              <View style={styles.profileCopy}>
                <Text numberOfLines={1} style={[styles.profileName, { color: colors.text }]}>{fullName || 'Team member'}</Text>
                {!!employeeId && <Text style={[styles.profileMeta, { color: colors.muted }]}>Employee ID · {employeeId}</Text>}
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
                    onPress={() => {
                      setPreference(choice.value).catch((error) => console.error('Unable to save theme preference:', error));
                    }}
                    style={[styles.themeOption, selected && { backgroundColor: colors.surfaceSolid }]}
                  >
                    <Ionicons name={choice.icon} size={16} color={selected ? colors.accent : colors.muted} />
                    <Text style={[styles.themeLabel, { color: selected ? colors.text : colors.muted }]}>{choice.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable onPress={() => navigate('/profile')} style={[styles.profileAction, { borderBottomColor: colors.border }]}>
              <Ionicons name="person-circle-outline" size={19} color={colors.muted} />
              <Text style={[styles.profileActionLabel, { color: colors.text }]}>My profile</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.muted} />
            </Pressable>
            <Pressable onPress={() => navigate('/')} style={styles.profileAction}>
              <Ionicons name="log-out-outline" size={19} color={colors.danger} />
              <Text style={[styles.profileActionLabel, { color: colors.danger }]}>Log out</Text>
            </Pressable>
          </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  profileMenu: { position: 'absolute', top: 62, right: 14, width: 310, maxWidth: '92%', borderRadius: 20, borderWidth: 1, padding: 16, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
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
  profileActionLabel: { flex: 1, fontSize: 13, fontWeight: '600' },
});
