import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { AppScreen, GlassPanel } from '@/components/AppScreen';
import { useAppTheme } from '@/contexts/ThemeContext';
import { verifyLocationForScreen } from '@/utils/locationVerifier';

export default function ProfileScreen() {
  const [profile, setProfile] = useState({
    name: '',
    empid: '',
    department: '',
    position: '',
    accessType: '',
    location: '',
  });
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { colors } = useAppTheme();

  const fetchData = useCallback(async () => {
    try {
      await verifyLocationForScreen('/profile').catch(() => null);
      const [name, empid, dept1, dept2, pos1, pos2, logintype1, logintype2, location] = await Promise.all([
        SecureStore.getItemAsync('full_name'),
        SecureStore.getItemAsync('employee_id'),
        SecureStore.getItemAsync('department'),
        SecureStore.getItemAsync('tped'),
        SecureStore.getItemAsync('position'),
        SecureStore.getItemAsync('sop'),
        SecureStore.getItemAsync('logintype'),
        SecureStore.getItemAsync('tl'),
        SecureStore.getItemAsync('currentgeocord'),
      ]);

      setProfile({
        name: name || '',
        empid: empid || '',
        department: dept1 || dept2 || '',
        position: pos1 || pos2 || '',
        accessType: logintype1 || logintype2 || '',
        location: location || '',
      });
    } catch (err) {
      console.error('Failed to load profile data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      alert('All fields required');
      return;
    }

    try {
      const employeeId = await SecureStore.getItemAsync('employee_id');
      const response = await fetch('https://gtiappsbackend.vercel.app/api/profile/changePassword', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId, currentPassword, newPassword, confirmPassword }),
      });
      const result = await response.json();

      if (result.success) {
        alert(result.message);
        setModalVisible(false);
        await Promise.all([
          SecureStore.deleteItemAsync('employee_id'),
          SecureStore.deleteItemAsync('full_name'),
          SecureStore.deleteItemAsync('password'),
          SecureStore.deleteItemAsync('currentgeocord'),
        ]);
        router.replace('/');
      } else {
        alert(result.message);
      }
    } catch (error) {
      alert('Something went wrong');
    }
  };

  const inputStyle = [styles.input, { backgroundColor: colors.surfaceAlt, borderColor: colors.border, color: colors.text }];

  if (loading) {
    return (
      <AppScreen title="My profile" subtitle="Your account details and security settings.">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.muted }]}>Loading profile...</Text>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      title="My profile"
      subtitle="Your account details and security settings."
      onRefresh={fetchData}
      refreshing={loading}
    >
      <GlassPanel style={styles.profileCard}>
        <View style={[styles.avatar, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="person" size={32} color={colors.accent} />
        </View>
        <View style={styles.profileInfo}>
          <Text style={[styles.profileName, { color: colors.text }]}>{profile.name || 'Team member'}</Text>
          <Text style={[styles.profileCaption, { color: colors.muted }]}>Greentech Industries</Text>
        </View>
        <View style={[styles.detailRows, { borderTopColor: colors.border }]}>
          <View style={styles.detailRow}>
            <Ionicons name="person-outline" size={18} color={colors.muted} />
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Full name</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{profile.name || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="card-outline" size={18} color={colors.muted} />
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Employee ID</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{profile.empid || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="business-outline" size={18} color={colors.muted} />
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Department</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{profile.department || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="briefcase-outline" size={18} color={colors.muted} />
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Position</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{profile.position || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.muted} />
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Access Type</Text>
            <Text style={[styles.detailValue, { color: colors.accent, fontWeight: '700', textTransform: 'uppercase' }]}>{profile.accessType || '—'}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="location-outline" size={18} color={colors.muted} />
            <Text style={[styles.detailLabel, { color: colors.muted }]}>Current Location</Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>{profile.location || '—'}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => setModalVisible(true)}
          style={({ pressed }) => [styles.changePasswordButton, { backgroundColor: colors.accent }, pressed && styles.pressed]}
        >
          <Ionicons name="lock-closed-outline" size={17} color="#ffffff" />
          <Text style={styles.changePasswordText}>Change password</Text>
        </Pressable>
      </GlassPanel>

      <Modal transparent animationType="fade" visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setModalVisible(false)} />
          <ScrollView contentContainerStyle={styles.modalScroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.modalBox, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIcon, { backgroundColor: colors.accentSoft }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.accent} />
                </View>
                <View style={styles.modalHeadingCopy}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Change password</Text>
                  <Text style={[styles.modalSubtitle, { color: colors.muted }]}>Enter your current and new password.</Text>
                </View>
                <Pressable onPress={() => setModalVisible(false)} accessibilityLabel="Close dialog" style={styles.closeButton}>
                  <Ionicons name="close" size={21} color={colors.muted} />
                </Pressable>
              </View>
              <TextInput placeholder="Current password" secureTextEntry value={currentPassword} onChangeText={setCurrentPassword} style={inputStyle} placeholderTextColor={colors.muted} autoCapitalize="none" />
              <TextInput placeholder="New password" secureTextEntry value={newPassword} onChangeText={setNewPassword} style={inputStyle} placeholderTextColor={colors.muted} autoCapitalize="none" />
              <TextInput placeholder="Confirm password" secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} style={inputStyle} placeholderTextColor={colors.muted} autoCapitalize="none" />
              <View style={styles.modalButtons}>
                <Pressable onPress={() => setModalVisible(false)} style={[styles.modalButton, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleChangePassword} style={[styles.modalButton, { backgroundColor: colors.accent }]}>
                  <Text style={styles.submitText}>Submit</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontWeight: '500' },
  profileCard: { alignItems: 'center', paddingHorizontal: 22, paddingVertical: 28 },
  avatar: { width: 76, height: 76, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  profileInfo: { alignItems: 'center', gap: 5 },
  profileName: { fontSize: 19, fontWeight: '700' },
  profileCaption: { fontSize: 12 },
  detailRows: { width: '100%', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 24, paddingTop: 12, gap: 4 },
  detailRow: { minHeight: 47, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  detailLabel: { flex: 1, fontSize: 12 },
  detailValue: { fontSize: 12, fontWeight: '600', maxWidth: '60%', textAlign: 'right' },
  changePasswordButton: { alignSelf: 'stretch', minHeight: 48, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, marginTop: 20 },
  changePasswordText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(5,16,20,0.48)', padding: 18 },
  modalScroll: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '100%', maxWidth: 440, borderRadius: 22, borderWidth: 1, padding: 20, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 16 },
  modalIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  modalHeadingCopy: { flex: 1, gap: 4 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalSubtitle: { fontSize: 11 },
  closeButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 48, borderRadius: 13, borderWidth: 1, paddingHorizontal: 13, marginTop: 10, fontSize: 13 },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalButton: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  cancelText: { fontSize: 13, fontWeight: '600' },
  submitText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
