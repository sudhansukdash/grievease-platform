// Raise Grievance
import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, StatusBar, Animated, Dimensions,
  KeyboardAvoidingView, Platform, Switch, Alert, Modal
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, Stack } from "expo-router";
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

// Firebase & Fonts
import { auth, db } from "../firebaseConfig";
import { collection, addDoc, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Inter_400Regular } from "@expo-google-fonts/inter";
import { PlayfairDisplay_600SemiBold } from "@expo-google-fonts/playfair-display";

// IMPORT SUCCESS MODAL
import SuccessModal from "../components/SuccessModal";

const { width } = Dimensions.get("window");

// CAMPUS LOCATIONS
const dropdownData = {
  'Academic': ['Information Technology', 'Electrical', 'Mechanical', 'Civil', 'E&TC'],
  'Hostel': ['Boys Hostel', 'Girls Hostel', 'Hostel Mess', 'Hostel Administration'],
  'Canteen': ['College Canteen'],
  'Sports': ['Main Ground', 'Gym', 'Badminton Court'],
  'Parking': ['Main Parking Area'],
  'Other': ['Administrative Office', 'Library', 'Reading Room', 'Engineering Drawing Room', 'Workshop', 'Common Washrooms']
};

const categories = [
  { label: 'Academic', icon: 'school-outline', color: '#5A60F6' },
  { label: 'Hostel', icon: 'home-outline', color: '#7C3AED' },
  { label: 'Canteen', icon: 'fast-food-outline', color: '#EA580C' },
  { label: 'Sports', icon: 'football-outline', color: '#10B981' },
  { label: 'Parking', icon: 'car-outline', color: '#0891B2' },
  { label: 'Other', icon: 'grid-outline', color: '#64748B' },
];

export default function NewComplaint() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [currentStep, setCurrentStep] = useState(1);
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, Inter_400Regular, PlayfairDisplay_600SemiBold });

  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateFormatted, setDateFormatted] = useState("Select Date");
  const [department, setDepartment] = useState("");
  const [image, setImage] = useState(null);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);

  const [errorFields, setErrorFields] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");

  // WARNING MODAL TIMER STATES
  const [isConfirmModalVisible, setConfirmModalVisible] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // SUCCESS MODAL STATES
  const [isSuccessModalVisible, setSuccessModalVisible] = useState(false);
  const [successCountdown, setSuccessCountdown] = useState(5);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Warning Modal Countdown Logic
  useEffect(() => {
    let timer;
    if (isConfirmModalVisible && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isConfirmModalVisible, countdown]);

  // Success Modal Countdown Logic
  useEffect(() => {
    let timer;
    if (isSuccessModalVisible && successCountdown > 0) {
      timer = setInterval(() => {
        setSuccessCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isSuccessModalVisible && successCountdown === 0) {
      handleSuccessRedirect();
    }
    return () => clearInterval(timer);
  }, [isSuccessModalVisible, successCountdown]);

  useEffect(() => {
    setDepartment("");
  }, [category]);

  useEffect(() => {
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    setErrorFields([]);
    setErrorMessage("");
  }, [currentStep]);

  const resetForm = () => {
    setCategory("");
    setTitle("");
    setDescription("");
    setDate(new Date());
    setDateFormatted("Select Date");
    setDepartment("");
    setImage(null);
    setIsAnonymous(false);
    setCurrentStep(1);
    setErrorFields([]);
    setErrorMessage("");
  };

  const uploadToImgBB = async (uri) => {
    if (!uri) return null;
    try {
      const formData = new FormData();
      formData.append('image', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        type: 'image/jpeg',
        name: `grievance_${Date.now()}.jpg`,
      });


      const API_KEY = process.env.EXPO_PUBLIC_IMGBB_API_KEY;

      const response = await fetch(`https://api.imgbb.com/1/upload?key=${API_KEY}`, {
        method: 'POST', body: formData, headers: { 'Accept': 'application/json', 'Content-Type': 'multipart/form-data' },
      });
      const result = await response.json();
      return result.success ? result.data.url : null;
    } catch (error) {
      return null;
    }
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
    let fDate = currentDate.getDate() + '/' + (currentDate.getMonth() + 1) + '/' + currentDate.getFullYear();
    setDateFormatted(fDate);
    if (errorFields.includes("date")) setErrorFields(prev => prev.filter(f => f !== "date"));
  };

  const handleNext = () => {
    const missing = [];
    if (!category) missing.push("category");
    if (!title.trim()) missing.push("title");
    if (dateFormatted === "Select Date") missing.push("date");
    if (!description.trim()) missing.push("description");

    if (missing.length > 0) {
      setErrorFields(missing);
      setErrorMessage("Please fill all required fields.");
      return;
    }

    setErrorFields([]);
    setErrorMessage("");
    setCurrentStep(2);
  };

  const handleImagePick = () => {
    Alert.alert(
      "Upload Evidence", "Choose an option to attach an image",
      [
        {
          text: "Take a Photo",
          onPress: async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') return;
            let result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7 });
            if (!result.canceled) setImage(result.assets[0].uri);
          }
        },
        {
          text: "Choose from Gallery",
          onPress: async () => {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.7 });
            if (!result.canceled) setImage(result.assets[0].uri);
          }
        },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const openConfirmModal = () => {
    const missing = [];
    if (!department) missing.push("department");

    if (missing.length > 0) {
      setErrorFields(missing);
      setErrorMessage("Please select the specific department or area.");
      return;
    }

    setErrorFields([]);
    setErrorMessage("");
    setCountdown(5);
    setConfirmModalVisible(true);
  };


  const executeSubmit = async () => {
    setConfirmModalVisible(false);
    setLoading(true);

    try {
      const publicUrl = await uploadToImgBB(image);
      const user = auth.currentUser;
      const studentSnap = await getDoc(doc(db, "students", user.uid));
      const studentData = studentSnap.exists() ? studentSnap.data() : {};

      await addDoc(collection(db, "complaints"), {
        studentId: user.uid,
        studentName: studentData.fullName || "Student",
        studentBranch: studentData.branch || "N/A",
        title: title.trim(),
        category,
        description: description.trim(),
        incidentDate: dateFormatted,
        departmentLocation: department,
        imageUrl: publicUrl,

        // Initialize tracking data for the admin dashboards
        assignedDepartment: category, // Defaults to the category they selected
        assignedTo: "",               // Blank until Principal assigns an official
        involvedOfficials: [],        // Empty array ready to track history

        status: "OPEN",

        isAnonymous: isAnonymous,
        createdAt: serverTimestamp(),
      });

      // SUCCESS MODAL TRIGGER
      setSuccessCountdown(5);
      setSuccessModalVisible(true);

    } catch (error) {
      setErrorMessage("Could not submit your grievance. Please try again.");
    } finally {
      setLoading(false);
    }
  };


  const handleSuccessRedirect = () => {
    setSuccessModalVisible(false);
    resetForm();
    router.replace("/student_dash");
  };

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#5A60F6" translucent={true} />

      <LinearGradient colors={["#5A60F6", "#6CAEE4"]} style={styles.background}>

        <View style={[styles.heroHeader, { paddingTop: insets.top + 20 }]}>
          <TouchableOpacity
            style={styles.backButtonGlass}
            onPress={() => {
              if (currentStep === 1) {
                resetForm();
                router.back();
              } else {
                setCurrentStep(1);
              }
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.heroTitle}>Raise Grievance</Text>
          <Text style={styles.heroSub}>
            {currentStep === 1 ? "Basic Details" : "Additional Info"}
          </Text>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <View style={styles.card}>

                {currentStep === 1 ? (
                  <View>
                    <Text style={[styles.label, errorFields.includes("category") && styles.errorText]}>Select Category</Text>
                    <View style={styles.catGrid}>
                      {categories.map((item) => (
                        <TouchableOpacity
                          key={item.label}
                          style={[
                            styles.catCard,
                            category === item.label && { borderColor: item.color, backgroundColor: item.color + '15' }
                          ]}
                          onPress={() => {
                            setCategory(item.label);
                            if (errorFields.includes("category")) setErrorFields(prev => prev.filter(f => f !== "category"));
                          }}
                        >
                          <Ionicons name={item.icon} size={22} color={category === item.label ? item.color : '#999'} />
                          <Text style={[styles.catLabel, category === item.label && { color: item.color }]}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.label, errorFields.includes("title") && styles.errorText]}>Grievance Title</Text>
                    <TextInput
                      placeholder="e.g. Broken Lab Equipment"
                      placeholderTextColor="#999"
                      style={[styles.input, errorFields.includes("title") && styles.errorBorder]}
                      value={title}
                      onChangeText={(val) => {
                        setTitle(val);
                        if (errorFields.includes("title")) setErrorFields(prev => prev.filter(f => f !== "title"));
                      }}
                    />

                    <Text style={[styles.label, errorFields.includes("date") && styles.errorText]}>Date of Incident</Text>
                    <TouchableOpacity
                      style={[styles.calendarSelector, errorFields.includes("date") && styles.errorBorder]}
                      onPress={() => setShowDatePicker(true)}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#5A60F6" />
                      <Text style={[styles.dateValue, dateFormatted === "Select Date" && { color: '#999' }]}>{dateFormatted}</Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                      <DateTimePicker
                        value={date} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={onDateChange} maximumDate={new Date()}
                      />
                    )}

                    <Text style={[styles.label, errorFields.includes("description") && styles.errorText]}>Description</Text>
                    <TextInput
                      placeholder="Tell us what happened..." placeholderTextColor="#999" multiline
                      style={[styles.input, styles.textArea, errorFields.includes("description") && styles.errorBorder]}
                      value={description}
                      onChangeText={(val) => {
                        setDescription(val);
                        if (errorFields.includes("description")) setErrorFields(prev => prev.filter(f => f !== "description"));
                      }}
                    />

                    {errorMessage ? <Text style={styles.bottomErrorMsg}>{errorMessage}</Text> : null}

                    <TouchableOpacity style={styles.mainBtn} onPress={handleNext}>
                      <Text style={styles.mainBtnText}>Next</Text>
                      <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <Text style={[styles.label, errorFields.includes("department") && styles.errorText]}>Related Department/Area</Text>
                    <View style={[styles.dropdownContainer, errorFields.includes("department") && { padding: 5, borderColor: '#FF5252', borderWidth: 1, borderRadius: 15 }]}>
                      {category && dropdownData[category]?.map((dept) => (
                        <TouchableOpacity
                          key={dept}
                          style={[styles.dropItem, department === dept && styles.dropItemActive]}
                          onPress={() => {
                            setDepartment(dept);
                            if (errorFields.includes("department")) setErrorFields(prev => prev.filter(f => f !== "department"));
                          }}
                        >
                          <Text style={[styles.dropText, department === dept && styles.dropTextActive]}>{dept}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={styles.label}>Attachments (Optional)</Text>
                    <TouchableOpacity style={styles.imagePicker} onPress={handleImagePick}>
                      {image ? (
                        <View style={styles.imageWrapper}>
                          <Image source={{ uri: image }} style={styles.preview} />
                          <View style={styles.changeImageOverlay}>
                            <Ionicons name="camera-reverse" size={20} color="#fff" />
                          </View>
                        </View>
                      ) : (
                        <View style={styles.placeholderBox}>
                          <Ionicons name="camera-outline" size={28} color="#ccc" />
                          <Text style={styles.placeholderTxt}>Upload Evidence</Text>
                        </View>
                      )}
                    </TouchableOpacity>

                    <View style={styles.switchRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.switchLabel}>Anonymous Mode</Text>
                        <Text style={styles.switchSub}>Hide your identity from administration</Text>
                      </View>
                      <Switch
                        value={isAnonymous}
                        onValueChange={setIsAnonymous}
                        trackColor={{ false: "#E2E8F0", true: "#C7D2FE" }}
                        thumbColor={isAnonymous ? "#5A60F6" : "#F8FAFC"}
                        ios_backgroundColor="#E2E8F0"
                      />
                    </View>

                    {errorMessage ? <Text style={styles.bottomErrorMsg}>{errorMessage}</Text> : null}

                    <TouchableOpacity style={[styles.mainBtn, loading && { opacity: 0.7 }]} onPress={openConfirmModal} disabled={loading}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.mainBtnText}>Submit Grievance</Text>}
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.dotContainer}>
                  <View style={[styles.dot, currentStep === 1 ? styles.activeDot : styles.inactiveDot]} />
                  <View style={[styles.dot, currentStep === 2 ? styles.activeDot : styles.inactiveDot]} />
                </View>

              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </LinearGradient>

      {/* WARNING MODAL */}
      <Modal visible={isConfirmModalVisible} transparent={true} animationType="fade" onRequestClose={() => setConfirmModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.warningBox}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning" size={30} color="#EF4444" />
              <Text style={styles.warningTitle}>OFFICIAL WARNING</Text>
            </View>

            <Text style={styles.warningText}>
              You are about to submit an official grievance to the administration.
            </Text>

            <View style={styles.warningHighlight}>
              <Text style={styles.warningTextBold}>
                Falsely raising a grievance, providing misleading information or spamming the system will lead to the PERMANENT SUSPENSION of your college account.
              </Text>
            </View>

            <Text style={styles.warningText}>
              Do you confirm that all provided details are 100% accurate?
            </Text>

            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmBtn, countdown > 0 && styles.confirmBtnDisabled]}
                disabled={countdown > 0}
                onPress={executeSubmit}
              >
                <Text style={styles.confirmBtnText}>
                  {countdown > 0 ? `Wait (${countdown}s)` : "I Confirm & Submit"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* SUCCESS MODAL INTEGRATION */}
      <SuccessModal
        visible={isSuccessModalVisible}
        title="Grievance Submitted!"
        message={`Your grievance has been successfully logged and sent to the administration.\n\nRedirecting to dashboard in ${successCountdown}...`}
        buttonText="Go to Dashboard"
        onPress={handleSuccessRedirect}
        color="#5A60F6"
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#5A60F6" },
  background: { flex: 1 },
  heroHeader: { paddingHorizontal: 25, paddingBottom: 10 },
  heroTitle: { color: '#fff', fontSize: 32, fontFamily: "PlayfairDisplay_600SemiBold" },
  heroSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontFamily: "Inter_400Regular", marginTop: 2 },

  backButtonGlass: { marginBottom: 15, width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" },

  scrollContent: { paddingBottom: 60, marginTop: 15 },
  card: { backgroundColor: "#fff", marginHorizontal: 20, borderRadius: 30, padding: 24, elevation: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },

  label: { fontSize: 11, fontFamily: "Poppins_600SemiBold", color: "#5A60F6", marginBottom: 8, marginTop: 18, textTransform: 'uppercase', letterSpacing: 0.5 },
  catGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  catCard: { width: '48%', paddingVertical: 14, borderRadius: 15, backgroundColor: '#f9f9f9', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  catLabel: { fontSize: 11, fontFamily: "Poppins_400Regular", marginTop: 4 },

  input: { backgroundColor: "#f9f9f9", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Poppins_400Regular", borderWidth: 1, borderColor: '#eee' },
  calendarSelector: { backgroundColor: "#f9f9f9", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#eee', flexDirection: 'row', alignItems: 'center' },
  dateValue: { marginLeft: 10, fontSize: 14, fontFamily: "Poppins_400Regular", color: '#333' },
  textArea: { height: 100, textAlignVertical: 'top' },

  dropdownContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dropItem: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f2f2f2' },
  dropItemActive: { backgroundColor: "#5A60F6" },
  dropText: { fontSize: 12, color: '#666', fontFamily: "Poppins_400Regular" },
  dropTextActive: { color: '#fff', fontFamily: "Poppins_600SemiBold" },

  imagePicker: { height: 110, backgroundColor: '#f9f9f9', borderRadius: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  imageWrapper: { width: '100%', height: '100%', position: 'relative' },
  placeholderBox: { alignItems: 'center' },
  placeholderTxt: { fontSize: 11, color: '#999', marginTop: 4 },
  preview: { width: '100%', height: '100%' },
  changeImageOverlay: { position: 'absolute', bottom: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 8, borderRadius: 20 },

  switchRow: { flexDirection: 'row', alignItems: 'center', marginTop: 25, borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 20, marginBottom: 10 },
  switchLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: '#333' },
  switchSub: { fontSize: 11, color: '#999', marginTop: 2 },

  mainBtn: { backgroundColor: '#5A60F6', paddingVertical: 16, borderRadius: 15, alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center' },
  mainBtnText: { color: '#fff', fontSize: 16, fontFamily: "Poppins_600SemiBold" },

  dotContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 25 },
  dot: { width: 8, height: 8, borderRadius: 4, marginHorizontal: 5 },
  activeDot: { backgroundColor: '#5A60F6', width: 20 },
  inactiveDot: { backgroundColor: '#E2E8F0' },

  errorBorder: { borderColor: '#FF5252', borderWidth: 1.5 },
  errorText: { color: '#FF5252' },
  bottomErrorMsg: { color: '#FF5252', fontFamily: "Poppins_500Medium", fontSize: 12, textAlign: 'center', marginTop: 15, marginBottom: -5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  warningBox: { backgroundColor: '#fff', borderRadius: 24, padding: 25, width: '100%', elevation: 15 },
  warningHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 15 },
  warningTitle: { fontSize: 18, fontFamily: "Poppins_700Bold", color: '#EF4444', marginLeft: 10, letterSpacing: 0.5 },
  warningText: { fontSize: 14, fontFamily: "Manrope_500Medium", color: '#475569', lineHeight: 22, marginBottom: 10 },
  warningHighlight: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', marginBottom: 15 },
  warningTextBold: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: '#991B1B', lineHeight: 20, textAlign: 'center' },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', marginRight: 10 },
  cancelBtnText: { color: '#64748B', fontFamily: "Poppins_600SemiBold", fontSize: 14 },
  confirmBtn: { flex: 1.5, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', marginLeft: 10 },
  confirmBtnDisabled: { backgroundColor: '#FCA5A5' },
  confirmBtnText: { color: '#fff', fontFamily: "Poppins_600SemiBold", fontSize: 14 },
});