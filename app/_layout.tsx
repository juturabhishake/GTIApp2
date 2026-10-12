import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { AppThemeProvider, useAppTheme } from '@/contexts/ThemeContext';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  return <AppThemeProvider><RootNavigator fontsLoaded={loaded} /></AppThemeProvider>;
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { theme, colors, ready } = useAppTheme();
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  if (!ready || !fontsLoaded) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <View style={[styles.loadingLogoFrame, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
          <Image source={require('../assets/images/gti_icon.png')} style={styles.loadingLogo} resizeMode="contain" />
        </View>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text style={[styles.loadingText, { color: colors.muted }]}>Preparing your workspace</Text>
      </View>
    );
  }

  return (
    <ThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: theme === 'dark' ? '#10191e' : '#f3f6f8' } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  loadingLogoFrame: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderRadius: 24 },
  loadingLogo: { width: 52, height: 52 },
  loadingText: { fontSize: 12, fontWeight: '600' },
});
