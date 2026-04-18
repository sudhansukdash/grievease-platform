// Greivance Details page
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Platform,
  TouchableOpacity,
  Modal
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

// Fonts
import { useFonts, Poppins_400Regular, Poppins_600SemiBold } from "@expo-google-fonts/poppins";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";

const { height, width } = Dimensions.get("window");


const getDisplayStatus = (status) => {
  // The .replace(/[-_]/g, " ") part strips the underscores from "IN_PROGRESS" and "ON_HOLD" and converts them to "in progress" and "on hold".

  const s = status ? status.toLowerCase().trim().replace(/[-_]/g, " ") : "";

  if (["resolved", "completed"].includes(s)) return "Resolved";
  if (["rejected", "closed"].includes(s)) return "Rejected";


  if (["assigned", "in progress", "inprogress", "on hold"].includes(s)) return "In Progress";


  if (["open", "pending", "new"].includes(s)) return "Pending";

  // Fallback just in case
  return "Pending";
};

// COLOR PALETTE FOR THE 4 CARD STATES
const getStatusTheme = (displayLabel) => {
  if (displayLabel === "Resolved") {
    return {
      gradient: ["#6EE7B7", "#10B981"],
      bg: "#ECFDF5", text: "#047857", icon: "checkmark-circle", label: "Resolved"
    };
  } else if (displayLabel === "Rejected") {
    return {
      gradient: ["#EF4444", "#B91C1C"],
      bg: "#FEF2F2", text: "#991B1B", icon: "close-circle", label: "Rejected"
    };
  } else if (displayLabel === "In Progress") {
    return {
      gradient: ["#60A5FA", "#3B82F6"],
      bg: "#EFF6FF", text: "#1D4ED8", icon: "briefcase", label: "In Progress"
    };
  }
  return {
    gradient: ["#FBBF24", "#D97706"],
    bg: "#FFFBEB", text: "#92400E", icon: "hourglass", label: "Pending"
  };
};

// Date Formatter Helper
const formatDate = (timestamp) => {
  if (!timestamp) return "Just Now";
  if (timestamp.toDate) {
    return timestamp.toDate().toLocaleDateString('en-GB');
  }
  return new Date(timestamp).toLocaleDateString('en-GB');
};

export default function GrievanceDetails() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isImageModalVisible, setImageModalVisible] = useState(false);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "complaints", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setComplaint(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  if (!fontsLoaded || loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5A60F6" />
      </View>
    );
  }

  if (!complaint) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Grievance not found.</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // INITIALIZE THE THEME USING THE UNIVERSAL LABEL
  const displayLabel = getDisplayStatus(complaint.status);
  const theme = getStatusTheme(displayLabel);

  // Helper function to render correct status message
  const renderStatusMessage = () => {
    if (displayLabel === "Resolved") {
      return "Your grievance has been successfully resolved and closed.";
    } else if (displayLabel === "Rejected") {
      return "This request has been closed. Please contact the authorities if it was rejected by mistake.";
    } else if (displayLabel === "In Progress") {
      return "Your grievance has been assigned and is currently being worked on.";
    } else {
      return "Your grievance has been submitted and is waiting for review by the authorities.";
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />


      <LinearGradient
        colors={theme.gradient}
        style={styles.fullBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <SafeAreaView style={styles.safeArea}>

          <View style={styles.navBar}>
            <TouchableOpacity
              onPress={() => router.back()}
              style={styles.backButtonGlass}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </View>


          <View style={styles.statusLabelContainer}>
            <Text style={styles.statusLabelLarge}>{theme.label}</Text>
            <Text style={styles.dateLabel}>
              Raised on {formatDate(complaint.createdAt)}
            </Text>
          </View>
        </SafeAreaView>
      </LinearGradient>


      <View style={styles.sheetContainer}>


        <View style={styles.scrollGuard}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >

            <View style={{ marginTop: 65 }}>


              <View style={styles.metaHeader}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{complaint.category || "General"}</Text>
                </View>

                <View style={styles.locationRow}>
                  <Ionicons name="location-sharp" size={16} color="#94A3B8" />
                  <Text style={styles.locationText}>{complaint.departmentLocation || "Campus"}</Text>
                </View>
              </View>

              <Text style={styles.titleText}>{complaint.title}</Text>
              <View style={styles.divider} />

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>DESCRIPTION</Text>
                <Text style={styles.bodyText}>{complaint.description}</Text>
              </View>

              {complaint.imageUrl && (
                <View style={styles.section}>
                  <Text style={styles.sectionLabel}>ATTACHMENT</Text>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setImageModalVisible(true)}
                  >
                    <Image
                      source={{ uri: complaint.imageUrl }}
                      style={styles.attachmentImage}
                      resizeMode="cover"
                    />
                    <View style={styles.expandOverlay}>
                      <Ionicons name="expand" size={20} color="#fff" />
                    </View>
                  </TouchableOpacity>
                </View>
              )}


              <View style={styles.footerSection}>
                <Text style={styles.sectionLabel}>OFFICIAL REMARKS</Text>

                {(displayLabel === "Resolved" || displayLabel === "Rejected") && (complaint.resolutionRemark || complaint.adminRemarks) ? (
                  <View style={[styles.statusBox, { backgroundColor: theme.bg }]}>

                    <Text style={[styles.statusBoxBody, { color: theme.text, fontFamily: "Manrope_600SemiBold" }]}>
                      {displayLabel === "Resolved" ? "Action Taken: " : ""}
                      {displayLabel === "Rejected" ? "Reason for Rejection: " : ""}
                      {complaint.resolutionRemark || complaint.adminRemarks}
                    </Text>

                  </View>
                ) : (
                  <View style={[styles.statusBox, { backgroundColor: theme.bg }]}>
                    <View style={styles.statusBoxHeader}>
                      <Ionicons name="time" size={18} color={theme.text} />
                      <Text style={[styles.statusBoxTitle, { color: theme.text }]}>Live Status</Text>
                    </View>
                    <Text style={[styles.statusBoxBody, { color: theme.text }]}>
                      {renderStatusMessage()}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>


        <View style={styles.floatingIconContainer}>
          <View style={styles.iconCircle}>
            <Ionicons name={theme.icon} size={38} color={theme.gradient[1]} />
          </View>
        </View>
      </View>

      {/* MODAL */}
      <Modal
        visible={isImageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setImageModalVisible(false)}
            >
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.modalImageContainer}>
            <Image
              source={{ uri: complaint.imageUrl }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontFamily: "Poppins_600SemiBold", color: "#64748B", marginBottom: 20 },


  fullBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.45,
  },
  safeArea: { paddingTop: Platform.OS === 'android' ? 10 : 0 },
  navBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 10,
  },
  backButtonGlass: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },

  statusLabelContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  statusLabelLarge: {
    fontSize: 28,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
    letterSpacing: 0.5,
  },
  dateLabel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
    fontFamily: "Manrope_500Medium",
    marginTop: 4,
  },


  sheetContainer: {
    position: 'absolute',
    top: height * 0.33,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 20,
  },


  scrollGuard: {
    flex: 1,
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    overflow: 'hidden',
  },

  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 50,
  },


  floatingIconContainer: {
    position: 'absolute',
    top: -35,
    alignSelf: 'center',
    zIndex: 100,
    elevation: 25,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },


  metaHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  categoryBadge: {
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  categoryText: {
    color: "#475569",
    fontSize: 12,
    fontFamily: "Poppins_600SemiBold",
    textTransform: "uppercase",
  },
  locationRow: { flexDirection: "row", alignItems: "center" },
  locationText: { color: "#64748B", fontSize: 13, fontFamily: "Manrope_500Medium", marginLeft: 4 },

  titleText: {
    fontSize: 22,
    fontFamily: "Poppins_600SemiBold",
    color: "#1E293B",
    lineHeight: 30,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 24,
  },
  section: { marginBottom: 28 },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Manrope_600SemiBold",
    color: "#94A3B8",
    marginBottom: 10,
    letterSpacing: 1.2,
  },
  bodyText: {
    fontSize: 15,
    fontFamily: "Manrope_400Regular",
    color: "#334155",
    lineHeight: 26,
  },

  attachmentImage: {
    width: "100%",
    height: 200,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },
  expandOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center'
  },

  footerSection: { marginTop: 10 },
  statusBox: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "transparent",
  },
  statusBoxHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  statusBoxTitle: {
    fontSize: 15,
    fontFamily: "Poppins_600SemiBold",
    marginLeft: 8,
  },
  statusBoxBody: {
    fontSize: 14,
    fontFamily: "Manrope_400Regular",
    lineHeight: 22,
  },


  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: 'center',
  },
  modalSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    marginLeft: 20,
    marginTop: Platform.OS === 'android' ? 20 : 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalImageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: height * 0.8,
  },

  backButton: {
    marginTop: 20,
    backgroundColor: "#5A60F6",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backButtonText: { color: "#fff", fontFamily: "Poppins_600SemiBold" },
});