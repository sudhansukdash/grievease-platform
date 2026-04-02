// App locked screen: User lands here when biometrics is enabled and he cancels it during app opening...
import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../firebaseConfig";
import { useFonts, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Manrope_500Medium } from "@expo-google-fonts/manrope";

const COLORS = {
  primary: "#5A60F6",
  bg: "#F8F9FE",
  textMain: "#1E293B",
  textSub: "#64748B",
};

export default function AppLocked() {
  const router = useRouter();

  const [fontsLoaded] = useFonts({
    Poppins_600SemiBold,
    Poppins_700Bold,
    Manrope_500Medium,
  });

  // Automatically prompt them again when this screen mounts
  useEffect(() => {
    retryUnlock();
  }, []);

  const retryUnlock = async () => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock GrievEase",
      fallbackLabel: "Use Passcode",
      disableDeviceFallback: false,
    });

    if (result.success) {
      // Success! Send them back to the main layout logic, which will route them to dashboard
      router.replace("/student_dash");
    }
  };

  const handleForceLogout = async () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem("griev_email");
            await AsyncStorage.removeItem("griev_password");
            // Optionally disable biometrics on logout so the next user isn't stuck
            await AsyncStorage.removeItem("biometric_enabled");
            await auth.signOut();
            router.replace("/log_student");
          } catch (e) {
            console.error("Logout failed:", e);
          }
        }
      }
    ]);
  };

  if (!fontsLoaded) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed" size={80} color={COLORS.primary} />
      </View>

      <Text style={styles.title}>App Locked</Text>
      <Text style={styles.subtitle}>Unlock to access your dashboard</Text>

      <TouchableOpacity style={styles.unlockBtn} onPress={retryUnlock}>
        <Ionicons name="finger-print" size={20} color="#fff" style={{ marginRight: 8 }} />
        <Text style={styles.unlockBtnText}>Unlock</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleForceLogout}>
        <Text style={styles.logoutText}>Log Out Instead</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.primary + '15',
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontFamily: "Poppins_700Bold",
    color: COLORS.textMain,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Manrope_500Medium",
    color: COLORS.textSub,
    marginBottom: 40,
  },
  unlockBtn: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center'
  },
  unlockBtnText: {
    color: "#fff",
    fontFamily: "Poppins_600SemiBold",
    fontSize: 16,
  },
  logoutBtn: {
    paddingVertical: 12,
  },
  logoutText: {
    color: COLORS.textSub,
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
  },
});