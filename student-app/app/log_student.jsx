// Main login page
import {
  useFonts,
  Poppins_400Regular,
  Poppins_600SemiBold,
} from "@expo-google-fonts/poppins";
import { Inter_400Regular } from "@expo-google-fonts/inter";
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
} from "@expo-google-fonts/manrope";
import { PlayfairDisplay_600SemiBold } from "@expo-google-fonts/playfair-display";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Checkbox from "expo-checkbox";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Animated,
  Dimensions,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
} from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { updateStudentData } from "../utils/updateStudentData";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";



const { width, height } = Dimensions.get("window");

export default function StudentLogin() {
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [errorFields, setErrorFields] = useState({
    email: false,
    password: false,
  });
  const [isSuspended, setIsSuspended] = useState(false);
  const [strikeCount, setStrikeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);

  // Controls the initial splash/loading state
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);
  const isMounted = useRef(true);

  // Animation Values
  const slideAnim = useRef(new Animated.Value(height * 0.15)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [iconLoaded, setIconLoaded] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Inter_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    PlayfairDisplay_600SemiBold,
  });


  const params = useLocalSearchParams();

  useEffect(() => {
    if (params?.suspended === "true") {
      setIsSuspended(true);
      setStrikeCount(Number(params.strikes) || 3);
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedEmail = await AsyncStorage.getItem("griev_email");
        const savedPassword = await AsyncStorage.getItem("griev_password");

        if (savedEmail && savedPassword && isMounted.current) {
          setEmail(savedEmail);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      } catch (err) {
        console.warn("AsyncStorage read failed:", err);
      } finally {
        if (isMounted.current) {
          setTimeout(() => {
            if (isMounted.current) {
              setIsCheckingAuth(false);
            }
          }, 100);
        }
      }
    };

    loadCredentials();

    return () => { isMounted.current = false; };
  }, []);


  useFocusEffect(
    useCallback(() => {
      if (!isCheckingAuth) {
        slideAnim.setValue(height * 0.15);
        opacityAnim.setValue(0);

        Animated.parallel([
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }, [isCheckingAuth])
  );


  useEffect(() => {
    if (iconLoaded) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [iconLoaded]);

  const handleLogin = async () => {
    if (locked) {
      setError("Too many failed attempts. Please try again later.");
      return;
    }
    setError("");
    setErrorFields({ email: false, password: false });

    if (!email || !password) {
      setError("Please enter both email and password");
      setErrorFields({ email: !email, password: !password });
      return;
    }

    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (!isMounted.current) return;

      const user = userCredential.user;
      await user.reload();

      // AUTOMATED SUSPENSION CHECK
      const userDoc = await getDoc(doc(db, "students", user.uid));
      if (userDoc.exists() && userDoc.data().isSuspended === true) {
        setIsSuspended(true);
        setStrikeCount(userDoc.data().spamStrikes || 3);
        await auth.signOut(); // Force logout
        setLoading(false);
        return;
      }
      if (userDoc.exists() && userDoc.data().settings?.biometrics === true) {
        await AsyncStorage.setItem("biometric_enabled", "true");
      } else {
        await AsyncStorage.removeItem("biometric_enabled");
      }

      if (!user.emailVerified) {
        setError("Please verify your email before logging in.");
        setErrorFields({ email: true, password: false });
        await auth.signOut();
        setLoading(false);
        return;
      }

      await updateStudentData().catch(e => console.error(e));

      if (rememberMe) {
        await AsyncStorage.setItem("griev_email", email);
        await AsyncStorage.setItem("griev_password", password);
      } else {
        await AsyncStorage.removeItem("griev_email");
        await AsyncStorage.removeItem("griev_password");
      }

      router.replace("/student_dash");

    } catch (error) {
      console.error("Login error:", error.message);
      if (isMounted.current) {
        setLoading(false);
        const attempts = loginAttempts + 1;
        setLoginAttempts(attempts);
        setError("Invalid email or password");
        setErrorFields({ email: true, password: true });

        if (attempts >= 5) {
          setLocked(true);
          setError("Too many failed attempts. Login disabled for 1 minute.");
          setTimeout(() => {
            if (isMounted.current) {
              setLoginAttempts(0);
              setLocked(false);
              setError("");
            }
          }, 60000);
        }
      }
    }
  };

  // CLEAN, STANDARD LOADING SCREEN
  if (!fontsLoaded || isCheckingAuth) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#5A60F6' }}>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <ActivityIndicator size="large" color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#5A60F6" }}>
      <LinearGradient
        colors={["#5A60F6", "#6CAEE4"]}
        style={styles.background}
      >
        <StatusBar barStyle="light-content" backgroundColor="#5A60F6" />

        <KeyboardAwareScrollView
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: 100,
            paddingTop: height * 0.01,
            justifyContent: "center",
          }}
          enableOnAndroid={true}
          extraScrollHeight={100}
          keyboardOpeningTime={0}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topRight}>
            <Text style={styles.topRightText}>Don't have an account?</Text>
            <TouchableOpacity
              style={styles.getStartedBox}
              onPress={() => router.push("/signup")}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <Animated.Image
                source={require("../assets/images/app_icon.png")}
                style={[styles.logoImage, { opacity: fadeAnim }]}
                resizeMode="contain"
                onLoadEnd={() => setIconLoaded(true)}
              />
            </View>
            <Text style={styles.appName}>GrievEase</Text>
            <Text style={styles.tagline}>Your concern, resolved with ease.</Text>
          </View>

          <Animated.View
            style={[
              styles.card,
              {
                transform: [{ translateY: slideAnim }],
                opacity: opacityAnim,
              },
            ]}
          >
            <Text style={styles.welcomeText}>Welcome Back!</Text>
            <Text style={styles.subtitle}>Login as a Student</Text>

            <TextInput
              style={[
                styles.input,
                errorFields.email && { borderColor: "red", borderWidth: 1.5 },
              ]}
              placeholder="Email"
              placeholderTextColor="#888"
              keyboardType="email-address"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError("");
                if (errorFields.email || errorFields.password)
                  setErrorFields({ email: false, password: false });
              }}
              autoCapitalize="none"
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  { flex: 1, marginBottom: 0, paddingRight: 50 },
                  errorFields.password && {
                    borderColor: "red",
                    borderWidth: 1.5,
                  },
                ]}
                placeholder="Password"
                secureTextEntry={!passwordVisible}
                placeholderTextColor="#888"
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  if (error) setError("");
                  if (errorFields.email || errorFields.password)
                    setErrorFields({ email: false, password: false });
                }}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setPasswordVisible(!passwordVisible)}
                style={styles.eyeIcon}
              >
                <Ionicons
                  name={passwordVisible ? "eye" : "eye-off"}
                  size={22}
                  color="#666"
                />
              </TouchableOpacity>
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              style={styles.rememberLeft}
              activeOpacity={0.8}
              onPress={() => setRememberMe(!rememberMe)}
            >
              <Checkbox
                value={rememberMe}
                onValueChange={setRememberMe}
                color={rememberMe ? "#5A60F6" : undefined}
                style={styles.checkbox}
              />
              <Text style={styles.rememberText}>Remember Me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.forgotContainer}
              onPress={() => router.push("/forgot")}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.signInButton, locked && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={locked || loading}
            >
              <LinearGradient
                colors={["#6EC1E4", "#5A60F6"]}
                style={styles.gradientButton}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.signInText}>Sign In</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </KeyboardAwareScrollView>

        {/* AUTOMATED SUSPENSION MODAL */}
        <Modal visible={isSuspended} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.warningBox}>
              <Ionicons name="lock-closed" size={60} color="#EF4444" />
              <Text style={styles.warningTitle}>Access Denied</Text>

              <Text style={styles.warningText}>
                This account has been automatically suspended due to reaching the maximum limit of {strikeCount} spam strikes.
              </Text>

              <View style={styles.warningHighlight}>
                <Text style={styles.warningTextBold}>
                  To restore access, please visit the Administrative Office for a review with the Principal.
                </Text>
              </View>

              <TouchableOpacity
                style={styles.returnBtn}
                onPress={() => {
                  setIsSuspended(false);
                  // Wipes the URL parameters clean so the modal doesn't get stuck in a loop!
                  router.setParams({ suspended: "", strikes: "" });
                }}
              >
                <Text style={styles.returnBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

      </LinearGradient>
    </View>
  );

}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    minHeight: height,
    paddingTop: StatusBar.currentHeight ? StatusBar.currentHeight + 8 : 44,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 20,
    marginBottom: height * 0.02,
  },
  topRightText: {
    color: "#fff",
    fontFamily: "Manrope_500Medium",
    fontSize: width * 0.032,
    marginRight: 8,
  },
  getStartedBox: {
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
    elevation: 4,
  },
  getStartedText: {
    color: "#5A60F6",
    fontFamily: "Manrope_600SemiBold",
    fontSize: width * 0.034,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: height * 0.08,
    marginBottom: height * 0.04,
  },
  logoPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  logoImage: {
    width: 60,
    height: 60,
    resizeMode: "contain"
  },
  appName: {
    color: "#fff",
    fontSize: 28,
    fontFamily: "Manrope_600SemiBold",
    marginBottom: 4,
  },
  tagline: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontFamily: "Manrope_500Medium",
    marginBottom: height * 0.01,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.98)",
    marginHorizontal: width * 0.06,
    borderRadius: 25,
    paddingVertical: height * 0.04,
    paddingHorizontal: width * 0.07,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 12,
    marginTop: -height * 0.04,
  },
  welcomeText: {
    fontSize: width * 0.07,
    color: "#1a1a1a",
    fontFamily: "Manrope_600SemiBold",
    textAlign: "center",
  },
  subtitle: {
    fontSize: width * 0.037,
    color: "#444",
    textAlign: "center",
    marginBottom: 24,
    fontFamily: "Manrope_500Medium",
  },
  input: {
    backgroundColor: "#f3f3f3",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: width * 0.04,
    marginBottom: 16,
    fontFamily: "Poppins_400Regular",
    color: "#000"
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  eyeIcon: { position: "absolute", right: 18 },
  rememberLeft: { flexDirection: "row", alignItems: "center" },
  checkbox: { width: 20, height: 20, borderRadius: 5 },
  rememberText: {
    marginLeft: 10,
    fontSize: width * 0.037,
    color: "#333",
    fontFamily: "Poppins_400Regular",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30
  },
  warningBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 30,
    width: '100%',
    alignItems: 'center',
    elevation: 20
  },
  warningTitle: {
    fontSize: 22,
    fontFamily: "Poppins_600SemiBold",
    color: '#1E293B',
    marginTop: 15
  },
  warningText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 10,
    fontFamily: "Manrope_500Medium",
    lineHeight: 20
  },
  warningHighlight: {
    backgroundColor: '#FEF2F2',
    padding: 15,
    borderRadius: 12,
    marginVertical: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  warningTextBold: {
    color: '#991B1B',
    fontFamily: "Poppins_600SemiBold",
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18
  },
  returnBtn: {
    marginTop: 10,
    backgroundColor: '#F1F5F9',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 10
  },
  returnBtnText: {
    color: '#64748B',
    fontFamily: "Poppins_600SemiBold"
  },
  forgotContainer: { alignItems: "flex-end", marginBottom: 24 },
  forgotText: {
    color: "#5A60F6",
    fontSize: width * 0.035,
    fontFamily: "Manrope_500Medium",
    textDecorationLine: "underline",
  },
  signInButton: { borderRadius: 14, overflow: "hidden" },
  gradientButton: { paddingVertical: 14, alignItems: "center" },
  signInText: {
    color: "#fff",
    fontSize: width * 0.045,
    fontFamily: "Manrope_600SemiBold",
  },
  errorText: {
    color: "red",
    fontSize: width * 0.035,
    fontFamily: "Poppins_400Regular",
    textAlign: "center",
    marginBottom: 12,
  },
});