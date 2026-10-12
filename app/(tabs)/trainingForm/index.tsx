import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Animated, Easing, Alert, useWindowDimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import { useAppTheme } from '@/contexts/ThemeContext';

const FormScreen = () => {
  const { colors, theme } = useAppTheme();
  const { height } = useWindowDimensions();
  const [page, setPage] = useState(1);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);

  const [formData, setFormData] = useState({
    employeeName: '',
    employeeId: '',
    designation: '',
    section: '',
    department: '',
    trainingTopic: '',
    trainerName: '',
    modeOfTraining: '',
    trainingDuration: '',
    trainingDate: '',
    ratings: Array(10).fill(0)
  });

  const handleRating = (index: number, value: number) => {
    const updatedRatings = [...formData.ratings];
    updatedRatings[index] = value;
    setFormData({ ...formData, ratings: updatedRatings });
  };

  const animatePage = () => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true
    }).start();
  };

  React.useEffect(() => {
    animatePage();
  }, [page]);

  const showDatePicker = () => setDatePickerVisibility(true);
  const hideDatePicker = () => setDatePickerVisibility(false);

  const handleConfirm = (date: Date) => {
    const formattedDate = date.toISOString().split('T')[0];
    setFormData({ ...formData, trainingDate: formattedDate });
    hideDatePicker();
  };

  const validatePage = () => {
    if (page === 1) {
      return (
        formData.employeeName &&
        formData.employeeId &&
        formData.designation &&
        formData.section &&
        formData.department
      );
    } else if (page === 2) {
      return (
        formData.trainingTopic &&
        formData.trainerName &&
        formData.modeOfTraining &&
        formData.trainingDuration &&
        formData.trainingDate
      );
    }
    return true;
  };

  const questions = [
    'The training is as per my requirement',
    'The training has given required knowledge',
    'The training is relevant for my job',
    'The content was understandable and interested to follow',
    'This training programme is a value addition to me',
    'I understood the contents of the training',
    'Language, contents are understandable',
    'I expect similar program in future',
    'I will implement the gained knowledge at my work place',
    'Class participation and interaction were encouraged'
  ];

  const teluguQuestions = [
    'శిక్షణ అవసరాలకు అనుకూలంగా ఉంది',
    'శిక్షణ అవసరమైన పరిజ్ఞానాన్ని ఇచ్చింది',
    'శిక్షణ ఉద్యోగానికి సంబంధించింది',
    'శిక్షణ అర్ధం చేసుకునేందుకు అనుకూలంగా మరియు ఆసక్తికరంగా ఉంది',
    'ఈ శిక్షణ కార్యక్రమం నాకు ఒక విలువైన అదనంగా ఉంది',
    'నేను శిక్షణ విషయాలను అర్థం చేసుకున్నాను',
    'భాష, విషయాలు అర్థమయ్యేలా ఉన్నాయి',
    'ఇలాంటి శిక్షణ కార్యక్రమాలు మళ్లీ ఆశిస్తున్నాను',
    'నేను పొందిన జ్ఞానాన్ని నా పని ప్రదేశంలో అమలు చేస్తాను',
    'తరగతిలో పాల్గొనడం మరియు పరస్పర చర్యలు ప్రోత్సహించబడ్డాయి'
  ];

  return (
    <View style={{ flex: 1, padding: 18, paddingTop: 18, backgroundColor: colors.background }}>
      <Animated.View style={{ opacity: fadeAnim, transform: [{ scale: fadeAnim }] }}>
        <LinearGradient
          colors={[colors.surfaceSolid, colors.background]}
          style={{ borderRadius: 24, height: Math.max(300, Math.min(height - 168, 760)), justifyContent: 'space-between', paddingVertical: 12, borderWidth: 1, borderColor: colors.border }}
        >
          <View style={{ paddingHorizontal: 20 }}>
            {page === 1 && <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>Employee Details</Text>}
            {page === 2 && <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>Training Details</Text>}
            {page === 3 && (
              <>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.text, marginBottom: 6 }}>Rating Scale</Text>
                <Text style={{ color: colors.muted, marginBottom: 12 }}>1 - Poor, 2 - Average, 3 - Good, 4 - Very Good, 5 - Excellent</Text>
              </>
            )}
            {page === 4 && (
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: colors.text, marginBottom: 10 }}>
                Overview & Summary
              </Text>
            )}
          </View>

          <View style={{ flex: 1, marginHorizontal: 20, marginVertical: 8, borderRadius: 20, backgroundColor: colors.surfaceAlt, paddingHorizontal: 16, paddingTop: 10 }}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {(page === 1 || page === 2) && (
                <>
                  {page === 1 && renderInputField("Employee Name", formData.employeeName, (text) => setFormData({ ...formData, employeeName: text }))}
                  {page === 1 && renderInputField("Employee ID", formData.employeeId, (text) => setFormData({ ...formData, employeeId: text }))}
                  {page === 1 && renderInputField("Designation", formData.designation, (text) => setFormData({ ...formData, designation: text }))}
                  {page === 1 && renderInputField("Section", formData.section, (text) => setFormData({ ...formData, section: text }))}
                  {page === 1 && renderInputField("Department", formData.department, (text) => setFormData({ ...formData, department: text }))}
                  {page === 2 && renderInputField("Training Topic", formData.trainingTopic, (text) => setFormData({ ...formData, trainingTopic: text }))}
                  {page === 2 && renderInputField("Trainer Name", formData.trainerName, (text) => setFormData({ ...formData, trainerName: text }))}
                  {page === 2 && renderInputField("Mode of Training", formData.modeOfTraining, (text) => setFormData({ ...formData, modeOfTraining: text }))}
                  {page === 2 && renderInputField("Training Duration", formData.trainingDuration, (text) => setFormData({ ...formData, trainingDuration: text }))}
                  {page === 2 && (
                    <View style={{ marginBottom: 18 }}>
                      <Text style={{ color: colors.muted, marginBottom: 4 }}>Training Date</Text>
                      <TouchableOpacity onPress={showDatePicker} style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, backgroundColor: colors.surfaceSolid }}>
                        <Text style={{ color: colors.text }}>{formData.trainingDate || 'Select a date'}</Text>
                      </TouchableOpacity>
                      <DateTimePickerModal
                        isVisible={isDatePickerVisible}
                        mode="date"
                        onConfirm={handleConfirm}
                        onCancel={hideDatePicker}
                        themeVariant={theme}
                      />
                    </View>
                  )}
                </>
              )}
              {page === 3 && (
                <>
                  {questions.map((question, index) => (
                    <View key={index} style={{ marginBottom: 20 }}>
                      <Text style={{ fontWeight: 'bold', color: colors.text }}>{index + 1}. {question}</Text>
                      <Text style={{ fontSize: 12, color: colors.muted, marginBottom: 4 }}>{teluguQuestions[index]}</Text>
                      <View style={{ flexDirection: 'row', marginTop: 6 }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity key={star} onPress={() => handleRating(index, star)}>
                            <FontAwesome name="star" size={24} color={formData.ratings[index] >= star ? '#eab308' : colors.muted} style={{ marginHorizontal: 4 }} />
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ))}
                </>
              )}
              {page === 4 && (
                <View style={{ padding: 16, borderRadius: 20, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6 }}>
                  {Object.entries(formData).filter(([key]) => key !== 'ratings').map(([key, value]) => (
                    <Text key={key} style={{ marginBottom: 10, color: colors.text, fontSize: 16 }}>
                      <Text style={{ color: colors.accent, fontWeight: 'bold' }}>{key.replace(/([A-Z])/g, ' $1')}: </Text>{value}
                    </Text>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingBottom: 12 }}>
            {page > 1 && (
              <TouchableOpacity onPress={() => setPage(page - 1)}>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>Previous</Text>
              </TouchableOpacity>
            )}
            {page < 4 ? (
              <TouchableOpacity onPress={() => {
                if (!validatePage()) {
                  Alert.alert("Please fill all required fields");
                  return;
                }
                setPage(page + 1);
              }}>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>Next</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => console.log('Submitted:', formData)}>
                <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '700' }}>Submit</Text>
              </TouchableOpacity>
            )}
          </View>
        </LinearGradient>
      </Animated.View>
    </View>
  );

  function renderInputField(label: string, value: string, onChange: (text: string) => void) {
    return (
      <View style={{ marginBottom: 18 }}>
        <Text style={{ color: colors.muted, marginBottom: 4 }}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={label}
          placeholderTextColor={colors.muted}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surfaceSolid,
            borderRadius: 12,
            padding: 12,
            color: colors.text,
            fontSize: 15
          }}
        />
      </View>
    );
  }
};

export default FormScreen;
