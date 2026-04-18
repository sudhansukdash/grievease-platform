// Settings Page
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
  StatusBar,
  Dimensions,
  Platform
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as LocalAuthentication from 'expo-local-authentication';
import * as Notifications from 'expo-notifications';
const { width } = Dimensions.get("window");

const COLORS = {
  primary: "#5A60F6",
  gradient: ["#5A60F6", "#6CAEE4"],
  bg: "#F8F9FE",
  card: "#FFFFFF",
  textMain: "#1E293B",
  textSub: "#64748B",
  red: "#EF4444",
  blue: "#3B82F6",
  green: "#10B981"
};

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({ pushNotifications: false, biometrics: false });

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const userDoc = await getDoc(doc(db, "students", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.settings) setPreferences(data.settings);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const toggleSwitch = async (key) => {
    const newValue = !preferences[key];
    setPreferences(prev => ({ ...prev, [key]: newValue }));
    try {
      const user = auth.currentUser;
      await updateDoc(doc(db, "students", user.uid), { [`settings.${key}`]: newValue });
    } catch (error) {
      Alert.alert("Sync Error", "Could not save.");
      setPreferences(prev => ({ ...prev, [key]: !newValue }));
    }
  };
  const handleNotificationToggle = async () => {
    if (preferences.pushNotifications) {

      toggleSwitch("pushNotifications");
      return;
    }


    const { status } = await Notifications.requestPermissionsAsync();

    if (status !== "granted") {
      Alert.alert("Permission Denied", "Notifications permission is required.");
      return;
    }

    toggleSwitch("pushNotifications");
  };
  const handleBiometricToggle = async () => {
    if (preferences.biometrics) {

      await AsyncStorage.removeItem("biometric_enabled");
      toggleSwitch("biometrics");
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) {
      Alert.alert("Biometric not available", "Please set up fingerprint or Face ID.");
      return;
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Enable Biometric Login",
    });

    if (result.success) {
      await AsyncStorage.setItem("biometric_enabled", "true");
      toggleSwitch("biometrics");
    } else {
      Alert.alert("Authentication failed");
    }
  };

  const handleLogout = async () => {
    Alert.alert("Log Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            await AsyncStorage.removeItem("griev_email");
            await AsyncStorage.removeItem("griev_password");
            await AsyncStorage.removeItem("biometric_enabled");
            await auth.signOut();
            router.replace("/log_student");
          } catch (e) {
            console.error("Logout failed:", e);
            router.replace("/log_student");
          }
        }
      }
    ]);
  };

  if (loading || !fontsLoaded) return <View style={styles.center}><ActivityIndicator color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.headerContainer}>
        <LinearGradient colors={COLORS.gradient} style={styles.headerGradient}>
          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <View style={styles.topRow}>
              <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.8}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </View>

      <View style={styles.contentContainer}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
          <View style={styles.card}>
            <SettingItem
              icon="notifications-outline" color="#F59E0B" title="Push Notifications" sub="Status updates & alerts"
              value={preferences.pushNotifications} onToggle={handleNotificationToggle}
            />
          </View>

          <Text style={styles.sectionHeader}>SECURITY</Text>
          <View style={styles.card}>
            <SettingItem
              icon="finger-print-outline" color={COLORS.blue} title="Biometric Login" sub="FaceID / Fingerprint"
              value={preferences.biometrics} onToggle={handleBiometricToggle}
            />
          </View>

          <Text style={styles.sectionHeader}>ABOUT PROJECT</Text>
          <View style={styles.card}>
            <InfoItem icon="code-slash-outline" title="Developer" value="sudhansukdash" />
            <View style={styles.divider} />
            <InfoItem icon="git-branch-outline" title="Version" value="v1.2.0" />
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL("https://github.com/sudhansukdash")}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#F1F5F9" }]}>
                  <Ionicons name="logo-github" size={20} color="#333" />
                </View>
                <Text style={styles.settingTitle}>View on GitHub</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>Team GrievEase © 2026</Text>
        </ScrollView>
      </View>
    </View>
  );
}

// Reusable Components
const SettingItem = ({ icon, color, title, sub, value, onToggle }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <View style={[styles.iconBox, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSub}>{sub}</Text>
      </View>
    </View>
    <Switch value={value} onValueChange={onToggle} trackColor={{ false: "#E2E8F0", true: COLORS.primary }} thumbColor={"#fff"} />
  </View>
);

const InfoItem = ({ icon, title, value }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <View style={[styles.iconBox, { backgroundColor: "#F1F5F9" }]}>
        <Ionicons name={icon} size={20} color={COLORS.textSub} />
      </View>
      <Text style={styles.settingTitle}>{title}</Text>
    </View>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },

  headerContainer: {
    height: 120,
    backgroundColor: COLORS.bg,
    zIndex: 1,
  },
  headerGradient: {
    flex: 1,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center'
  },

  topRow: {
    paddingHorizontal: 20,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center", alignItems: "center"
  },

  contentContainer: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },

  sectionHeader: {
    fontSize: 12, fontFamily: "Poppins_600SemiBold", color: COLORS.textSub,
    marginBottom: 10, marginTop: 10, letterSpacing: 1, marginLeft: 5
  },
  card: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 16, marginBottom: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 12 },
  rowLeft: { flexDirection: "row", alignItems: "center" },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: "center", alignItems: "center", marginRight: 14 },
  settingTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: COLORS.textMain },
  settingSub: { fontSize: 12, fontFamily: "Manrope_500Medium", color: COLORS.textSub },
  infoValue: { fontSize: 14, fontFamily: "Manrope_500Medium", color: COLORS.textSub },
  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 4, marginLeft: 54 },
  logoutBtn: {
    marginTop: 20, backgroundColor: "#FEF2F2", paddingVertical: 16, borderRadius: 16,
    alignItems: "center", borderWidth: 1, borderColor: "#FECACA"
  },
  logoutText: { color: "#DC2626", fontFamily: "Poppins_600SemiBold", fontSize: 15 },
  footerText: { textAlign: "center", marginTop: 20, color: "#CBD5E1", fontSize: 12, fontFamily: "Manrope_500Medium" }
});