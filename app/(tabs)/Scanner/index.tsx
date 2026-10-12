import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, Animated, Alert,
  type StyleProp, type ViewStyle,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Animatable from 'react-native-animatable';
import DropDownPicker from 'react-native-dropdown-picker';
import * as SecureStore from 'expo-secure-store';
import { useAppTheme } from '@/contexts/ThemeContext';

type RejectOption = {
  label: string;
  value: string;
};

type CustomButtonProps = {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

const ScannerScreen = () => {
  const { colors } = useAppTheme();
  const [step, setStep] = useState(1);
  const [partNumber, setPartNumber] = useState('');
  const [machineNumber, setMachineNumber] = useState('');
  const [scanning, setScanning] = useState(false);
  const [hasScanned, setHasScanned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPopupVisible, setPopupVisible] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [alertMessage, setAlertMessage] = useState('');
  const alertAnim = useRef(new Animated.Value(0)).current;

  const [open, setOpen] = useState(false);
  const [rejectOptions, setRejectOptions] = useState<RejectOption[]>([]);

  useEffect(() => {
    const fetchRejectOptions = async () => {
      try {
        const response = await fetch('https://gtiappsbackend.vercel.app/api/scanner/rejectOptions');
        const json = await response.json();
        if (response.ok && json?.data?.length > 0) {
          setRejectOptions(json.data);
          console.log('API Reject Options:', json.data);
          console.log('use state Reject Options:', rejectOptions);
        } else {
          console.warn('Failed to fetch reject options');
        }
      } catch (error) {
        console.error('Error fetching reject options:', error);
      }
    };
  
    fetchRejectOptions();
  }, []);
  

  useEffect(() => {
    if (!permission?.granted) requestPermission();
  }, [permission]);

  const showAlert = (msg: string) => {
    setAlertMessage(msg);
    Animated.timing(alertAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(alertAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }, 2500);
    });
  };

  const resetAll = () => {
    setStep(1);
    setPartNumber('');
    setMachineNumber('');
    setIsRejected(false);
    setRejectReason('');
    setPopupVisible(false);
    setScanning(false);
    setHasScanned(false);
  };

  const handleScanButton = () => {
    setScanning(true);
    setHasScanned(false);
  };

  const handlePartScan = (data: string) => {
    if (hasScanned) return;
    setHasScanned(true);

    if (!data.includes('_')) {
      alert('Wrong Part Number');
      setScanning(false);
      return;
    }

    setPartNumber(data);
    setStep(2);
    setScanning(false);
  };

  const handleMachineScan = (data: string) => {
    if (hasScanned) return;
    setHasScanned(true);

    if (!data.includes('_')) {
      alert('Wrong Machine Number');
      setScanning(false);
      return;
    }

    if (data === partNumber) {
      alert('Part number and Machine number cannot be the same');
      setScanning(false);
      return;
    }

    setMachineNumber(data);
    setStep(3);
    setPopupVisible(true);
    setScanning(false);
  };

  const handleSave = async () => {
    console.log('Part Number:', partNumber);
    console.log('Machine Number:', machineNumber);
    console.log('Reject Reason:', rejectReason);
    const cfull_name = await SecureStore.getItemAsync('full_name');
    console.log('Full Name:', cfull_name);
    if (partNumber === machineNumber) {
      alert('❌ Part Number and Machine Number cannot be the same.');
      return;
    }

    setLoading(true);

    try {
      const full_name = await SecureStore.getItemAsync('full_name');
      console.log('Get Full Name:', full_name);
      const rejectReasonValue = rejectReason ?? 'Not rejected';

      const response = await fetch('https://gtiappsbackend.vercel.app/api/scanner/insert_part_machine_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partNumber,
          machineNumber,
          rejectReason: rejectReasonValue,
          username:full_name,
          isreject:0,
        }),
      });

      const data = await response.json();
      console.log('Response:', data);
      if (response.ok && data.data[0].Result === "Success") {
        alert('✅ ' + data.data[0].Result + ' : ' + data.data[0].Reason);
      } else {
        alert('❌ ' + data.data[0].Result + ' : ' + data.data[0].Reason);
      }
    } catch (error) {
      alert('An error occurred while saving.');
    } finally {
      setLoading(false);
      resetAll();
    }
  };

  const handleReject = async () => {
    if (!rejectReason) {
      alert('Please select a reject reason');
      return;
    }

    setLoading(true);

    try {
      const full_name = await SecureStore.getItemAsync('full_name');
      console.log('Get Full Name:', full_name);    
      console.log('Reason:', rejectReason);     
      const response = await fetch('https://gtiappsbackend.vercel.app/api/scanner/insert_part_machine_data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partNumber,
          machineNumber,
          rejectReason: rejectReason,
          username:full_name,
          isreject:1,
        }),
      });

      const data = await response.json();

      if (response.ok && data.data[0].Result === "Success") {
        alert('✅ ' + data.data[0].Result + ' : ' + data.data[0].Reason);
      } else {
        alert('❌ ' + data.data[0].Result + ' : ' + data.data[0].Reason);
      }
    } catch (error) {
      alert('An error occurred while rejecting.');
    } finally {
      setLoading(false);
      resetAll();
    }
  };

  const CustomButton = ({ title, onPress, style, disabled = false }: CustomButtonProps) => (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.button, { backgroundColor: colors.accent }, disabled && styles.disabledButton, style]}
      disabled={disabled}
    >
      {loading && (title === 'Save' || title === 'Confirm Reject') ? (
        <ActivityIndicator size="small" color="#ffffff" />
      ) : (
        <Text style={[styles.buttonText, { color: '#ffffff' }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.alertBox, { opacity: alertAnim }]}>
        <Text style={styles.alertText}>{alertMessage}</Text>
      </Animated.View>

      {step === 1 && (
        <Animatable.View animation="zoomIn" duration={1000} style={styles.stepContainer}>
          <Text style={[styles.stepText, { color: colors.text }]}>Step 1: Scan Part</Text>
          <Text style={[styles.scanValue, { color: colors.muted }]}>{partNumber ? `Scanned: ${partNumber}` : ''}</Text>

          {scanning ? (
            <CameraView
              style={[styles.camera, { borderColor: colors.accent }]}
              onBarcodeScanned={({ data }) => handlePartScan(data)}
              facing="back"
            />
          ) : (
            <CustomButton title="Scan Part" onPress={handleScanButton} />
          )}
        </Animatable.View>
      )}

      {step === 2 && (
        <Animatable.View animation="zoomIn" duration={1000} style={styles.stepContainer}>
          <Text style={[styles.stepText, { color: colors.text }]}>Step 2: Scan Machine Number</Text>
          <Text style={[styles.scanValue, { color: colors.muted }]}>Part #: {partNumber}</Text>
          <Text style={[styles.scanValue, { color: colors.muted }]}>{machineNumber ? `Scanned: ${machineNumber}` : ''}</Text>

          {scanning ? (
            <CameraView
              style={[styles.camera, { borderColor: colors.accent }]}
              onBarcodeScanned={({ data }) => handleMachineScan(data)}
              facing="back"
            />
          ) : (
            <CustomButton title="Scan Machine Number" onPress={handleScanButton} />
          )}
          <CustomButton
            title="Cancel"
            onPress={() =>
              Alert.alert('Cancel', 'Are you sure you want to cancel?', [
                { text: 'No' },
                { text: 'Yes', onPress: resetAll },
              ])
            }
            style={{ backgroundColor: 'gray', marginTop: 10 }}
          />
        </Animatable.View>
      )}

      {step === 3 && (
        <Modal visible={isPopupVisible} transparent animationType="fade" onRequestClose={() => setPopupVisible(false)}>
          <View style={styles.popupOverlay}>
          <View style={[styles.popupContainer, { backgroundColor: colors.surfaceSolid, borderColor: colors.border }]}>
            <Text style={[styles.stepText, { color: colors.text }]}>Part #: {partNumber}</Text>
            <Text style={[styles.stepText, { color: colors.text }]}>Machine #: {machineNumber}</Text>

            {isRejected ? (
              <>
                <View style={{ zIndex: 9999, width: '100%' }}>
                  <DropDownPicker
                    open={open}
                    value={rejectReason}
                    items={rejectOptions}
                    setOpen={setOpen}
                    setValue={setRejectReason}
                    placeholder="Select Reject Reason"
                    searchable
                    style={{ marginBottom: open ? 150 : 10, backgroundColor: colors.surfaceSolid, borderColor: colors.border }}
                    dropDownContainerStyle={{ zIndex: 9999, backgroundColor: colors.surfaceSolid, borderColor: colors.border }}
                    textStyle={{ color: colors.text }}
                    labelStyle={{ color: colors.text }}
                    placeholderStyle={{ color: colors.muted }}
                  />
                </View>

                {rejectReason ? (
                  <Text style={{ color: colors.text, marginVertical: 10 }}>
                    Selected reason: {rejectReason}
                  </Text>
                ) : null}

                <CustomButton
                  title="Confirm Reject"
                  onPress={handleReject}
                  style={{ backgroundColor: colors.danger }}
                  disabled={loading}
                />
                <CustomButton
                  title="Cancel Reject"
                  onPress={() => {
                    setIsRejected(false);
                    setRejectReason('');
                  }}
                  style={{ backgroundColor: 'gray' }}
                />
              </>
            ) : (
              <>
                <CustomButton
                  title="Save"
                  onPress={handleSave}
                  disabled={loading}
                />
                <CustomButton
                  title="Reject"
                  onPress={() => setIsRejected(true)}
                  style={{ backgroundColor: colors.accent }}
                />
                <CustomButton
                  title="Cancel"
                  onPress={resetAll}
                  style={{ backgroundColor: 'gray' }}
                />
              </>
            )}
          </View>
          </View>
        </Modal>
      )}

      <Text style={[styles.sliderText, { color: colors.muted }]}>Step {step} / 3</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10191e',
    alignItems: 'center',
    padding: 20,
    justifyContent: 'center',
  },
  camera: {
    width: '90%',
    height: 300,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#167f70',
    marginTop: 20,
    marginBottom: 20,
  },
  stepContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  stepText: {
    fontSize: 22,
    color: '#172b36',
    fontWeight: '700',
    marginBottom: 10,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#167f70',
    padding: 15,
    marginTop: 10,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#888',
  },
  popupContainer: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    width: '92%',
    maxWidth: 520,
    alignItems: 'center',
    zIndex: 2000,
  },
  popupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5,16,20,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
  },
  alertBox: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -150 }, { translateY: -50 }],
    width: 300,
    padding: 15,
    backgroundColor: '#ff4444',
    zIndex: 1000,
    alignItems: 'center',
    borderRadius: 10,
  },
  alertText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  sliderText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    position: 'absolute',
    bottom: 30,
  },
  scanValue: {
    color: '#6d7e87',
    marginBottom: 10,
  },
});

export default ScannerScreen;
