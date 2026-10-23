import React, { useEffect, useRef, useState } from 'react';
import {
  View, TextInput, Text, TouchableOpacity,
  ActivityIndicator, StyleSheet, ImageBackground, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Image
} from 'react-native';
import * as Animatable from 'react-native-animatable';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/contexts/ThemeContext';

export default function LoginScreen() {
  const [empID, setEmpID] = useState('');
  const [password, setPassword] = useState('');
  const [secureText, setSecureText] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorAnim, setErrorAnim] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  const handleLogin = async () => {
    setLoading(true);
    setErrorAnim(false);
    console.log("Login attempt with Employee ID:", empID);
    console.log("Login attempt with Password:", password);
    try {
      const response = await fetch("https://gtiappsbackend.vercel.app/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          employeeId: empID,
          password: password
        })
      });

      const data = await response.json();

      if (response.ok && data.message === "Login Success") {



        const toStr = (val: unknown) => (val === null || val === undefined ? '' : String(val));
        const empId = toStr(data.data.EmployeeId || empID);
        const uName = toStr(data.data.Username);
        const uId = toStr(data.data.UserID);
        const dept = toStr(data.data.Department);
        const pos = toStr(data.data.Position);
        const sec = toStr(data.data.Section);
        const lType = toStr(data.data.logintype);

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



        console.log("Login successful, redirecting to profile...");
        console.log("Employee ID:", data.data.EmployeeId);
        console.log("Full Name:", data.data.Username);
        console.log("Department:", data.data.Department);
        console.log("Position:", data.data.Position);
        console.log("Section:", data.data.Section);
        console.log("Login Type:", data.data.logintype);

        router.replace('/Home');
        setLoading(false);
      } else {
        throw new Error(data.message || "Login Failed");
      }
    } catch (err) {
      setErrorAnim(true);
      setTimeout(() => setErrorAnim(false), 3000);
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('@/assets/images/track2.png')}
      style={styles.container}
      blurRadius={6}
    >
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
                style={[styles.loginButton, { backgroundColor: errorAnim ? colors.danger : colors.accent }]}
                onPress={handleLogin}
                disabled={loading}
                accessibilityRole="button"
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : errorAnim ? (
                  <Animatable.View animation="shake">
                    <Ionicons name="close-circle" size={22} color="#fff" />
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
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 5,
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
});
