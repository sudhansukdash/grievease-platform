// Forgot password page
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebaseConfig";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import { SafeAreaView } from "react-native-safe-area-context";

// Import reusable success modal
import SuccessModal from "../components/SuccessModal";

const { width, height } = Dimensions.get("window");

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [error, setError] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  if (!fontsLoaded) return null;

  const handlePasswordReset = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      setError("Please enter a valid email address!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await sendPasswordResetEmail(auth, email);
      setLoading(false);
      setModalVisible(true);
    } catch (error) {
      setLoading(false);
      setError("Email not found. Please check and try again.");
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" />

      <LinearGradient colors={["#5A60F6", "#6CAEE4"]} style={styles.background}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Animated.View
            style={{
              flex: 1,
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }}
          >

            <View style={styles.header}>
              <TouchableOpacity
                style={styles.backButtonCircle}
                onPress={() => router.back()}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </TouchableOpacity>
              <View style={styles.titleWrapper}>
                <Text style={styles.welcomeText}>Verification,</Text>
                <Text style={styles.appName}>Reset Password</Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.subtitle}>
                Enter your registered email to receive a password reset link.
              </Text>


              <View style={[styles.inputContainer, error ? styles.errorBorder : null]}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#999"
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.inputStyle}
                  placeholder="Email Address"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) setError("");
                  }}
                  autoCapitalize="none"
                />
              </View>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={handlePasswordReset}
                disabled={loading}
              >
                <LinearGradient
                  colors={["#5A60F6", "#6CAEE4"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.resetButton}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.resetText}>Send Reset Link</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>

          <SuccessModal
            visible={modalVisible}
            title="Email Sent!"
            message="Check your inbox for a link to reset your password."
            buttonText="Back to Login"
            onPress={() => {
              setModalVisible(false);
              router.push("/log_student");
            }}
          />
        </KeyboardAvoidingView>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#5A60F6" },
  background: { flex: 1 },
  header: {
    paddingHorizontal: width * 0.08,
    paddingTop: height * 0.02,
    paddingBottom: height * 0.04,
  },
  backButtonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
  },
  titleWrapper: { alignItems: "flex-start" },
  welcomeText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontFamily: "Poppins_400Regular",
  },
  appName: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Poppins_600SemiBold",
  },
  card: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: width * 0.06,
    borderRadius: 25,
    padding: 25,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Poppins_400Regular",
    color: "#666",
    textAlign: "left",
    marginBottom: 20,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 15,
    paddingHorizontal: 15,
    height: 55,
    marginBottom: 14,
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
  errorBorder: { borderColor: "#FF5252", backgroundColor: "#FFF5F5" },
  errorText: {
    color: "#FF5252",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 15,
    fontFamily: "Poppins_400Regular",
  },
  resetButton: {
    borderRadius: 15,
    height: 55,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 5,
  },
  resetText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
  },
});