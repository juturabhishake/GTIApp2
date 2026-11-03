import React, { useEffect, useRef, useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  ActivityIndicator, StyleSheet, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Image, Modal, Pressable
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import * as SecureStore from 'expo-secure-store';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function LoginScreen() {
  const [empID, setEmpID] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorAnim, setErrorAnim] = useState(false);
  const [loginStep, setLoginStep] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'error'>('idle');
  const [statusText, setStatusText] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalLocations, setModalLocations] = useState<string[]>([]);
  const scrollViewRef = useRef<React.ElementRef<typeof ScrollView>>(null);

  const router = useRouter();
  const { colors, theme } = useAppTheme();

  useEffect(() => {
    const subscription = Keyboard.addListener('keyboardDidShow', () => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      SecureStore.getItemAsync('employee_id'),
      SecureStore.getItemAsync('full_name'),
    ]).then(([employeeId, fullName]) => {
      if (active && employeeId && fullName) router.replace('/Home');
    }).catch((error) => {
      console.error('Unable to check saved sign-in details:', error);
    });
    return () => {
      active = false;
    };
  }, [router]);

  const closeModal = () => {
    setModalVisible(false);
    setLoading(false);
    setLoginStep('idle');
    setStatusText('');
    setErrorAnim(false);
  };

  const handleLogin = async () => {
    if (!empID.trim() || !password.trim()) {
      setLoginStep('error');
      setStatusText('Enter credentials');
      setModalTitle('Credentials Required');
      setModalMessage('Please enter both your Employee ID and Password to sign in.');
      setModalLocations([]);
      setModalVisible(true);
      setErrorAnim(true);
      return;
    }

    setLoading(true);
    setErrorAnim(false);
    setLoginStep('locating');
    setStatusText('Checking location...');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoginStep('error');
        setStatusText('Permission required');
        setErrorAnim(true);
        setModalTitle('Location Permission Required');
        setModalMessage('Please allow location permission in your device settings to verify your workplace and sign in.');
        setModalLocations([]);
        setModalVisible(true);
        return;
      }

      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        setLoginStep('error');
        setStatusText('GPS disabled');
        setErrorAnim(true);
        setModalTitle('GPS / Location Disabled');
        setModalMessage('Please enable GPS / Location services on your device to sign in.');
        setModalLocations([]);
        setModalVisible(true);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const latitude = location.coords.latitude;
      const longitude = location.coords.longitude;
      setLoginStep('verifying');
      setStatusText('Verifying workplace...');
      console.log(`Attempting login for Employee ID: ${empID} at coordinates: (${latitude}, ${longitude})`);
      const response = await fetch("https://gtiappsbackend.vercel.app/api/geologin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: empID,
          password: password,
          latitude,
          longitude,
        })
      });

      const data = await response.json();

      if (response.status === 403 || data.message === 'Location Restricted') {
        const rawLocations = typeof data.allowedLocations === 'string' ? data.allowedLocations : '';
        const list = rawLocations.split('\n').map((item: string) => item.trim()).filter(Boolean);
        setLoginStep('error');
        setStatusText('Location Restricted');
        setErrorAnim(true);
        setModalTitle('Location Restricted');
        setModalMessage('You are not in location. Please reach below location to login:');
        setModalLocations(list.length ? list : ['Allowed Workplace Area']);
        setModalVisible(true);
        return;
      }

      if (response.status === 400 && data.message === 'Location Required') {
        setLoginStep('error');
        setStatusText('Location Required');
        setErrorAnim(true);
        setModalTitle('Location Required');
        setModalMessage(data.details || 'Location coordinates are required to verify your workplace.');
        setModalLocations([]);
        setModalVisible(true);
        return;
      }

      if (response.status === 401 || data.message === 'Invalid Credentials') {
        setLoginStep('error');
        setStatusText('Invalid Credentials');
        setErrorAnim(true);
        setModalTitle('Invalid Credentials');
        setModalMessage('The Employee ID or Password you entered is incorrect. Please check and try again.');
        setModalLocations([]);
        setModalVisible(true);
        return;
      }

      if (response.ok && data.message === "Login Success") {
        setLoginStep('success');
        setStatusText('Login Success!');

        const toStr = (val: unknown) => (val === null || val === undefined ? '' : String(val));
        const empId = toStr(data.data.EmployeeId || empID);
        const uName = toStr(data.data.Username);
        const uId = toStr(data.data.UserID);
        const dept = toStr(data.data.Department);
        const pos = toStr(data.data.Position);
        const sec = toStr(data.data.Section);
        const lType = toStr(data.data.logintype);
        const geoAddr = toStr(data.data.currentgeocord || data.data.GeoAddress || data.data.Address || data.data.MatchedAddress);

        await SecureStore.setItemAsync("employee_id", empId);
        await SecureStore.setItemAsync("full_name", uName);
        await SecureStore.setItemAsync("password", password);

        await SecureStore.setItemAsync("user_id", uId);
        await SecureStore.setItemAsync("department", dept);
        await SecureStore.setItemAsync("position", pos);
        await SecureStore.setItemAsync("section", sec);
        await SecureStore.setItemAsync("logintype", lType);
        await SecureStore.setItemAsync("tped", dept);
        await SecureStore.setItemAsync("sop", pos);
        await SecureStore.setItemAsync("ces", sec);
        await SecureStore.setItemAsync("tl", lType);
        await SecureStore.setItemAsync("currentgeocord", geoAddr);

        router.replace('/Home');
        return;
      }

      throw new Error(data.message || "Login Failed");
    } catch (err) {
      setLoginStep('error');
      setStatusText('Login Failed');
      setErrorAnim(true);
      setModalTitle('Sign In Failed');
      setModalMessage(err instanceof Error ? err.message : 'Unable to connect to login server. Please try again.');
      setModalLocations([]);
      setModalVisible(true);
    }
  };

  return (
    <View style={styles.container}>
      <Image
        source={require('@/assets/images/track2.png')}
        style={[StyleSheet.absoluteFill, styles.bgImage]}
        resizeMode="cover"
        blurRadius={6}
      />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: theme === 'dark' ? 'rgba(7,17,22,0.76)' : 'rgba(15,36,38,0.44)' }]} />
      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            <Animatable.View animation="fadeInDown" style={styles.titleContainer}>
              <View style={[styles.brandIcon, { backgroundColor: colors.accentSoft }]}>
                <Image source={require('@/assets/images/gti_icon.png')} style={styles.loginLogo} resizeMode="contain" />
              </View>
              <Text style={styles.eyebrow}>GREENTECH INDUSTRIES</Text>
              <Text style={[styles.title, { color: '#ffffff' }]}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to continue to your workspace.</Text>
            </Animatable.View>

            <Animatable.View
              animation="fadeInUp"
              delay={250}
              style={[styles.formContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={[styles.formTitle, { color: colors.text }]}>Sign in</Text>
              <Text style={[styles.label, { color: colors.muted }]}>Employee ID</Text>
              <TextInput
                placeholder="Enter your employee ID"
                placeholderTextColor={colors.muted}
                style={[styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }]}
                value={empID}
                onChangeText={setEmpID}
              />
              <Text style={[styles.label, { color: colors.muted }]}>Password</Text>
              <View style={[styles.passwordContainer, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
          <TextInput
            placeholder="Enter your password"
            placeholderTextColor={colors.muted}
            secureTextEntry={secureText}
            style={[styles.passwordInput, { color: colors.text }]}
            value={password}
            onChangeText={setPassword}
          />
                <TouchableOpacity onPress={() => setSecureText(!secureText)} accessibilityLabel={secureText ? 'Show password' : 'Hide password'} style={styles.visibilityButton}>
                  <Ionicons name={secureText ? 'eye-off' : 'eye'} size={21} color={colors.muted} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: loginStep === 'error' ? colors.danger : loginStep === 'success' ? '#10b981' : colors.accent }]}
                onPress={handleLogin}
                disabled={loading || loginStep === 'success'}
                accessibilityRole="button"
              >
                {loginStep === 'locating' || loginStep === 'verifying' ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.loginText}>{statusText}</Text>
                  </>
                ) : loginStep === 'success' ? (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.loginText}>{statusText}</Text>
                  </>
                ) : loginStep === 'error' ? (
                  <Animatable.View animation="shake" style={styles.statusRow}>
                    <Ionicons name="close-circle" size={20} color="#fff" />
                    <Text style={styles.loginText}>{statusText}</Text>
                  </Animatable.View>
                ) : (
                  <>
                    <Text style={styles.loginText}>Continue</Text>
                    <Ionicons name="arrow-forward" size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>
              <Text style={[styles.secureNote, { color: colors.muted }]}>
                <Ionicons name="shield-checkmark-outline" size={13} color={colors.accent} /> Secure employee access
              </Text>
            </Animatable.View>
            <Text style={styles.footerText}>GREENTECH INDUSTRIES · EMPLOYEE PORTAL</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
            <View style={[styles.modalIconWrap, { backgroundColor: `${colors.danger}15` }]}>
              <Ionicons
                name={modalLocations.length > 0 ? "location-outline" : "alert-circle-outline"}
                size={32}
                color={colors.danger}
              />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{modalTitle || 'Alert'}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.muted }]}>
              {modalMessage}
            </Text>
            {modalLocations.length > 0 && (
              <View style={[styles.locationsBox, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                {modalLocations.map((loc, idx) => (
                  <View key={idx} style={styles.locationRow}>
                    <Ionicons name="navigate-circle-outline" size={17} color={colors.accent} style={styles.locationRowIcon} />
                    <Text style={[styles.locationRowText, { color: colors.text }]}>{loc}</Text>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.modalCloseButton, { backgroundColor: colors.accent }]}
              onPress={closeModal}
              accessibilityRole="button"
            >
              <Text style={styles.modalCloseButtonText}>Understood</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 5,
  },
  bgImage: {
    width: '100%',
    height: '100%',
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  content: {
    width: '100%',
    maxWidth: 470,
    alignSelf: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  brandIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  loginLogo: {
    width: 40,
    height: 40,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 9,
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 19,
  },
  formContainer: {
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 21,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 7,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    paddingHorizontal: 14,
    borderRadius: 13,
    marginBottom: 17,
    fontSize: 13,
  },
  passwordContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 13,
    alignItems: 'center',
    paddingLeft: 14,
    paddingRight: 6,
    minHeight: 50,
    marginBottom: 22,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 13,
  },
  visibilityButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButton: {
    minHeight: 50,
    paddingHorizontal: 16,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  secureNote: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 18,
  },
  footerText: {
    textAlign: 'center',
    color: 'rgba(255,255,255,0.58)',
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1.3,
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 22,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 18,
  },
  locationsBox: {
    width: '100%',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  locationRowIcon: {
    marginTop: 2,
  },
  locationRowText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  modalCloseButton: {
    width: '100%',
    minHeight: 48,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
