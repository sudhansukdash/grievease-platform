import React, { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet, StatusBar, Image, Dimensions } from "react-native";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import * as SplashScreen from "expo-splash-screen";
import * as LocalAuthentication from "expo-local-authentication";

// IMPORT ALL YOUR FONTS GLOBALLY
import { useFonts, Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";
import { Inter_400Regular } from "@expo-google-fonts/inter";
import { PlayfairDisplay_600SemiBold } from "@expo-google-fonts/playfair-display";

// DYNAMIC ICON SCALING
const { width } = Dimensions.get("window");
const ICON_SIZE = width * 0.42;

export default function IndexScreen() {
  const [authReady, setAuthReady] = useState(false);
  const [targetRoute, setTargetRoute] = useState(null);
  const [isUiReady, setIsUiReady] = useState(false);

  // START LOADING FONTS IN THE BACKGROUND
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Inter_400Regular,
    PlayfairDisplay_600SemiBold,
  });

  useEffect(() => {
    performSilentLogin();
  }, []);

  // GATEKEEPER
  useEffect(() => {
    if (isUiReady && authReady && fontsLoaded && targetRoute) {
      (async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        await SplashScreen.hideAsync();
        router.replace(targetRoute);
      })();
    }
  }, [isUiReady, authReady, fontsLoaded, targetRoute]);

  const performSilentLogin = async () => {
    try {
      if (auth.currentUser) {
        const biometricEnabled = await AsyncStorage.getItem("biometric_enabled");

        // APP LOCK
        if (biometricEnabled === "true") {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Unlock GrievEase",
            fallbackLabel: "Use Passcode",
            disableDeviceFallback: false,
          });

          if (!result.success) {
            // Routes to Option B (App Locked Screen)
            finalizeAuth("/app_locked");
            return;
          }
        }

        await checkSuspension(auth.currentUser);
        return;
      }

      const savedEmail = await AsyncStorage.getItem("griev_email");
      const savedPassword = await AsyncStorage.getItem("griev_password");

      if (savedEmail && savedPassword) {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, savedEmail, savedPassword);

          // Since they just logged in from storage, check biometrics before letting them in!
          const biometricEnabled = await AsyncStorage.getItem("biometric_enabled");
          if (biometricEnabled === "true") {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: "Unlock GrievEase",
              fallbackLabel: "Use Passcode",
              disableDeviceFallback: false,
            });

            if (!result.success) {
              finalizeAuth("/app_locked");
              return;
            }
          }

          await checkSuspension(userCredential.user);
        } catch (err) {
          console.log("Silent login failed:", err);
          finalizeAuth("/log_student");
        }
      } else {
        finalizeAuth("/log_student");
      }
    } catch (e) {
      finalizeAuth("/log_student");
    }
  };

  const checkSuspension = async (user) => {
    try {
      const userDoc = await getDoc(doc(db, "students", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Suspended
        if (userData.isSuspended) {
          await auth.signOut();
          finalizeAuth("/log_student");
          return;
        }

        // Pending
        if (userData.status === "pending") {
          await auth.signOut();
          finalizeAuth("/log_student");
          return;
        }

        // Rejected
        if (userData.status === "rejected") {
          await auth.signOut();
          finalizeAuth("/log_student");
          return;
        }

        // Unknown / Not approved
        if (userData.status !== "approved") {
          await auth.signOut();
          finalizeAuth("/log_student");
          return;
        }

        // Only approved
        finalizeAuth("/student_dash");
      } else {
        finalizeAuth("/log_student");
      }
    } catch (e) {
      finalizeAuth("/log_student");
    }
  };

  const finalizeAuth = (route) => {
    setTargetRoute(route);
    setAuthReady(true);
  };

  return (
    <View
      style={styles.background}
      onLayout={() => {
        requestAnimationFrame(() => {
          setIsUiReady(true);
        });
      }}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <Image
        source={require("../assets/images/icon.png")}
        style={styles.logoImage}
      />

      <ActivityIndicator
        size="large"
        color="#5A60F6"
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImage: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    resizeMode: "contain",
  },
  spinner: {
    position: "absolute",
    bottom: 100,
  }
});