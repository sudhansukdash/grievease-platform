// Signup Page
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, Stack } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Easing,
  ActivityIndicator,
} from "react-native";
import DropDownPicker from "react-native-dropdown-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  useFonts,
} from "@expo-google-fonts/poppins";
import { Inter_400Regular } from "@expo-google-fonts/inter";
import { auth, db } from "../firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import SuccessModal from "../components/SuccessModal";


const { width, height } = Dimensions.get("window");

const formatName = (str) => {
  return str.trim().toLowerCase().split(/\s+/).map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
};

export default function Signup() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Inter_400Regular,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [branch, setBranch] = useState(null);
  const [year, setYear] = useState(null);
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [openBranch, setOpenBranch] = useState(false);
  const [openYear, setOpenYear] = useState(false);
  const [errorFields, setErrorFields] = useState([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const scrollRef = useRef(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 800, easing: Easing.out(Easing.back(1)), useNativeDriver: true }),
    ]).start();
  }, []);

  const handleCreateAccount = async () => {
    const missing = [];
    if (!name) missing.push("name");
    if (!email) missing.push("email");
    if (!branch) missing.push("branch");
    if (!year) missing.push("year");
    if (!password) missing.push("password");

    // EMAIL VALIDATION
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (email && !emailRegex.test(email)) {
      setErrorMessage("Enter a valid email address!");
      setErrorFields(["email"]);
      return;
    }
    if (phone && phone.length !== 10) {
      setErrorMessage("Enter valid 10-digit phone number");
      setErrorFields(["phone"]);
      return;
    }

    setErrorFields(missing);
    if (missing.length > 0) {
      setErrorMessage("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);
      const formattedName = formatName(name);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      try {
        await updateProfile(user, { displayName: formattedName });

        await setDoc(doc(db, "students", user.uid), {
          fullName: formattedName,
          email,
          branch,
          year,
          phone: phone || null,
          status: "pending",
          createdAt: new Date().toISOString(),
        });

      } catch (err) {
        // rollback if Firestore fails
        await user.delete();
        throw err;
      }

      await signOut(auth);
      setLoading(false);
      setModalVisible(true);
    } catch (error) {
      setLoading(false);


      if (error.code === 'auth/email-already-in-use') {
        setErrorMessage("This email is already registered! Please log in.");
      } else if (error.code === 'auth/invalid-email') {
        setErrorMessage("The email address is improperly formatted.");
      } else if (error.code === 'auth/weak-password') {
        setErrorMessage("Your password must be at least 6 characters long.");
      } else {
        // Fallback for any other weird Firebase errors
        setErrorMessage("Registration failed. Please try again.");
        console.error("Signup Error:", error);
      }
    }
  };

  if (!fontsLoaded) return null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false, animation: "none" }} />
      <LinearGradient colors={["#5A60F6", "#7CCBEA"]} style={styles.background}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

            <View style={styles.header}>
              <TouchableOpacity style={styles.backButtonCircle} onPress={() => router.push("/log_student")}>
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.titleWrapper}>
                <Text style={styles.welcomeText}>Join Us,</Text>
                <Text style={styles.appName}>Create Account</Text>
                <View style={styles.taglineBadge}>
                  <Text style={styles.tagline}>Redressal with ease • Fast & Secure</Text>
                </View>
              </View>
            </View>

            <ScrollView
              ref={scrollRef}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.card}>
                <View style={[styles.inputContainer, errorFields.includes("name") && styles.errorInput]}>
                  <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Full Name"
                    placeholderTextColor="#999"
                    style={styles.inputStyle}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                <View style={[styles.inputContainer, errorFields.includes("email") && styles.errorInput]}>
                  <Ionicons name="mail-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Email Address"
                    placeholderTextColor="#999"
                    style={styles.inputStyle}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={{ zIndex: 2000 }}>
                  <DropDownPicker
                    open={openBranch}
                    value={branch}
                    items={[
                      { label: "Information Technology", value: "IT" },
                      { label: "Electrical", value: "EE" },
                      { label: "Mechanical", value: "ME" },
                      { label: "Civil", value: "CE" },
                      { label: "E&TC", value: "ETC" },
                    ]}
                    setOpen={setOpenBranch}
                    setValue={setBranch}
                    placeholder="Select Branch"
                    style={[styles.dropdown, errorFields.includes("branch") && styles.errorInput]}
                    dropDownContainerStyle={styles.dropdownContainer}
                    textStyle={styles.dropdownText}
                    placeholderStyle={styles.dropdownPlaceholder}
                    onOpen={() => setOpenYear(false)}
                  />
                </View>

                <View style={{ zIndex: 1000 }}>
                  <DropDownPicker
                    open={openYear}
                    value={year}
                    items={[
                      { label: "First Year", value: "1" },
                      { label: "Second Year", value: "2" },
                      { label: "Third Year", value: "3" },
                    ]}
                    setOpen={setOpenYear}
                    setValue={setYear}
                    placeholder="Select Year"
                    style={[styles.dropdown, errorFields.includes("year") && styles.errorInput]}
                    dropDownContainerStyle={styles.dropdownContainer}
                    textStyle={styles.dropdownText}
                    placeholderStyle={styles.dropdownPlaceholder}
                    onOpen={() => setOpenBranch(false)}
                  />
                </View>

                <View style={[styles.inputContainer, errorFields.includes("password") && styles.errorInput]}>
                  <Ionicons name="lock-closed-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#999"
                    style={styles.inputStyle}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color="#999" />
                  </TouchableOpacity>
                </View>

                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={20} color="#999" style={styles.inputIcon} />
                  <TextInput
                    placeholder="Phone Number (Optional)"
                    placeholderTextColor="#999"
                    style={styles.inputStyle}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    maxLength={10}
                  />
                </View>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    disabled={loading}
                    onPressIn={() => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start()}
                    onPressOut={() => {
                      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
                      handleCreateAccount();
                    }}
                  >
                    <LinearGradient colors={["#5A60F6", "#6CAEE4"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.signUpButton}>
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.signUpText}>Create Account</Text>}
                    </LinearGradient>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            </ScrollView>
          </Animated.View>
        </KeyboardAvoidingView>
      </LinearGradient>

      <SuccessModal
        visible={modalVisible}
        title="Welcome Aboard!"
        message="Your account request has been submitted. You will be able to log in once it is approved by your HOD."
        buttonText="Go to Login"
        onPress={() => { setModalVisible(false); router.push("/log_student"); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#5A60F6" },
  background: { flex: 1 },
  header: {
    paddingHorizontal: width * 0.08,
    paddingTop: height * 0.03,
    paddingBottom: height * 0.02,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  titleWrapper: { alignItems: "flex-start" },
  welcomeText: { color: "rgba(255,255,255,0.85)", fontSize: 18, fontFamily: "Poppins_400Regular" },
  appName: { color: "#fff", fontSize: 32, fontFamily: "Poppins_600SemiBold", letterSpacing: -0.5 },
  taglineBadge: {
    backgroundColor: "rgba(0,0,0,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 30,
    marginTop: 10,
  },
  tagline: { color: "#fff", fontSize: 11, fontFamily: "Inter_400Regular", letterSpacing: 0.3 },
  scrollContent: { paddingBottom: 50 },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: width * 0.06,
    borderRadius: 30,
    padding: 25,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#F1F3F5",
  },
  inputIcon: { marginRight: 10 },
  inputStyle: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Poppins_400Regular",
    color: "#333",
  },
  errorInput: { borderColor: "#FF5252", backgroundColor: "#FFF5F5" },
  dropdown: {
    backgroundColor: "#F8F9FA",
    borderColor: "#F1F3F5",
    borderRadius: 15,
    height: 55,
    paddingHorizontal: 15,
    marginBottom: 16,
  },
  dropdownText: { fontFamily: "Poppins_400Regular", fontSize: 15, color: "#333" },
  dropdownPlaceholder: { color: "#999", fontFamily: "Poppins_400Regular", fontSize: 15 },
  dropdownContainer: { borderVertical: 0, borderColor: "#F1F3F5", borderRadius: 15, elevation: 5 },
  signUpButton: { borderRadius: 18, height: 58, justifyContent: "center", alignItems: "center", marginTop: 10 },
  signUpText: { color: "#fff", fontSize: 16, fontFamily: "Poppins_600SemiBold" },
  errorText: { color: "#FF5252", fontSize: 12, textAlign: "center", marginBottom: 10, fontFamily: "Poppins_400Regular" },
});