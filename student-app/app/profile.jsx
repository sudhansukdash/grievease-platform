// User Profile
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Platform,
  Dimensions,
  Alert,
  KeyboardAvoidingView
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { auth, db } from "../firebaseConfig";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

// Fonts
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";

import SuccessModal from "../components/SuccessModal";

const { width, height } = Dimensions.get("window");

const COLORS = {
  primary: "#5A60F6",
  gradient: ["#5A60F6", "#6CAEE4"],
  textDark: "#1E293B",
  textMuted: "#64748B",
  cardBg: "#FFFFFF",
  bg: "#F8F9FE",
  inputBg: "#F1F5F9",
  border: "#E2E8F0"
};
const BRANCH_LABEL_MAP = {
  IT: "Information Technology",
  EE: "Electrical",
  ME: "Mechanical",
  CE: "Civil",
  ETC: "E&TC",
};
const YEAR_LABEL_MAP = {
  "1": "1st Year",
  "2": "2nd Year",
  "3": "3rd Year",
};
export default function Profile() {
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Modal State
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const docRef = doc(db, "students", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);
          setPhone(data.phone || "");
        }
      } catch (error) {
        console.error("Profile Fetch Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleUpdate = async () => {
    if (phone.length < 10) {
      Alert.alert("Invalid Input", "Please enter a valid phone number.");
      return;
    }
    setUpdating(true);
    try {
      await updateDoc(doc(db, "students", auth.currentUser.uid), { phone });
      setShowSuccessModal(true);
    } catch (error) {
      Alert.alert("Error", "Could not update profile.");
    } finally {
      setUpdating(false);
    }
  };

  if (loading || !fontsLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <Stack.Screen options={{ headerShown: false }} />


      <LinearGradient colors={COLORS.gradient} style={styles.absoluteHeader} />

      <SafeAreaView style={styles.safeArea}>


        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.contentContainer}>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
          >
            <ScrollView
              style={styles.scrollContainer}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >

              <View style={styles.profileCard}>


                <View style={styles.avatarWrapper}>
                  <LinearGradient colors={COLORS.gradient} style={styles.avatarGradient}>
                    <Text style={styles.avatarText}>{userData?.fullName?.charAt(0)}</Text>
                  </LinearGradient>
                </View>

                <View style={styles.nameSection}>
                  <Text style={styles.nameText}>{userData?.fullName}</Text>
                  <Text style={styles.roleText}>
                    Student • {BRANCH_LABEL_MAP[userData?.branch] || userData?.branch}
                  </Text>
                </View>

                <View style={styles.divider} />


                <View style={styles.gridContainer}>
                  <InfoBox
                    label="Academic Year"
                    value={YEAR_LABEL_MAP[userData?.year] || userData?.year || "N/A"}
                    icon="calendar-outline"
                  />

                  <View style={styles.infoBox}>
                    <View style={styles.iconCircle}>
                      <Ionicons name="mail-outline" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.infoLabel}>Email Address</Text>
                      <Text style={styles.infoValue}>{auth.currentUser?.email}</Text>
                    </View>
                  </View>
                </View>

              </View>

              <View style={styles.sectionHeaderContainer}>
                <Text style={styles.sectionHeader}>CONTACT DETAILS</Text>
              </View>

              <View style={styles.actionCard}>
                <Text style={styles.inputLabel}>Mobile Number</Text>

                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    placeholder="Enter phone number"
                    placeholderTextColor="#94A3B8"
                  />
                  <Ionicons name="pencil" size={16} color={COLORS.textMuted} />
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, updating && { opacity: 0.7 }]}
                  onPress={handleUpdate}
                  disabled={updating}
                >
                  {updating ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveBtnText}>Update Profile</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ height: 100 }} />

            </ScrollView>
          </KeyboardAvoidingView>
        </View>

      </SafeAreaView>

      {/* SUCCESS MODAL */}
      <SuccessModal
        visible={showSuccessModal}
        title="Profile Updated!"
        message="Your contact details have been successfully saved."
        buttonText="Back to Home"
        onPress={() => {
          setShowSuccessModal(false);
          router.replace("/student_dash");
        }}
        color={COLORS.primary}
      />
    </View>
  );
}

// Helper Component
const InfoBox = ({ label, value, icon }) => (
  <View style={styles.infoBox}>
    <View style={styles.iconCircle}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={1}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },


  absoluteHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 320,
    width: width,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  safeArea: { flex: 1 },

  navBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    zIndex: 10, // ✅ Ensures Back Button is always clickable
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },


  contentContainer: {
    flex: 1,
    overflow: 'hidden',
  },

  scrollContainer: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 40
  },

  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 5,
  },

  avatarWrapper: {
    marginTop: -50,
    padding: 6,
    backgroundColor: "#fff",
    borderRadius: 60,
    elevation: 4,
  },
  avatarGradient: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 36,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
  },

  nameSection: { alignItems: "center", marginTop: 12 },
  nameText: { fontSize: 22, fontFamily: "Poppins_700Bold", color: COLORS.textDark, textAlign: "center" },
  roleText: { fontSize: 14, fontFamily: "Manrope_500Medium", color: COLORS.textMuted, marginTop: 2 },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 20,
  },

  gridContainer: {
    width: '100%',
    gap: 12
  },

  infoBox: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.inputBg,
    padding: 16,
    borderRadius: 12,
  },
  iconCircle: {
    width: 38,
    height: 38,
    backgroundColor: "#fff",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 4,
  },
  infoLabel: { fontSize: 11, fontFamily: "Manrope_500Medium", color: COLORS.textMuted },
  infoValue: { fontSize: 13, fontFamily: "Poppins_600SemiBold", color: COLORS.textDark, marginTop: 2 },

  sectionHeaderContainer: { marginTop: 25, marginBottom: 10, marginLeft: 5 },
  sectionHeader: {
    fontSize: 13,
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.textMuted,
    letterSpacing: 1,
  },
  actionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  inputLabel: { fontSize: 14, fontFamily: "Poppins_600SemiBold", color: COLORS.textDark, marginBottom: 8 },

  inputWrapper: {
    backgroundColor: COLORS.inputBg,
    borderRadius: 12,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: "transparent",
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 15,
    fontFamily: "Manrope_500Medium",
    color: COLORS.textDark,
  },

  saveBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
  },
});