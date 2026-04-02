// Handles the View All complaints and Grievance History and contain the sorting logic acc. to states
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  StatusBar,
  Dimensions,
  Platform
} from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { SafeAreaView } from "react-native-safe-area-context";

// Fonts
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_500Medium } from "@expo-google-fonts/poppins";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";

const { width } = Dimensions.get("window");

// COLOR PALETTE
const COLORS = {
  background: "#F8F9FE",
  cardBg: "#FFFFFF",
  textDark: "#1E293B",
  textLight: "#858C94",
  borderColor: "rgba(0,0,0,0.05)",

  green: "#10B981",
  red: "#F43F5E",
  blue: "#3B82F6",
  amber: "#F59E0B"
};

// DYNAMIC HEADER TEXT for Bento Cards in Dashboard
const getHeaderContent = (filter) => {
  const mode = filter ? filter.toLowerCase() : "default";

  if (mode === "pending") {
    return { title: "Pending Requests", subtitle: "Grievances waiting to be reviewed." };
  } else if (mode === "in progress") {
    return { title: "In Progress", subtitle: "Tickets currently being worked on." };
  } else if (mode === "closed") {
    return { title: "Closed Cases", subtitle: "History of resolved and rejected requests." };
  } else {
    return { title: "Grievance History", subtitle: "A complete timeline of your reports." };
  }
};

// HELPER: Map raw database status to Visual Labels
const getDisplayStatus = (status) => {
  const s = status ? status.toLowerCase().trim().replace(/[-_]/g, " ") : "";

  if (["resolved", "completed"].includes(s)) return "Resolved";
  if (["rejected", "closed"].includes(s)) return "Rejected";
  if (["assigned", "in progress", "inprogress", "on hold"].includes(s)) return "In Progress";
  if (["open", "pending", "new"].includes(s)) return "Pending";

  return "Pending";
};

// CONSISTENT STATUS STYLE
const getStatusStyle = (displayLabel) => {
  if (displayLabel === "Resolved") {
    return { bg: "#ECFDF5", dark: COLORS.green, icon: "checkmark-done-circle" };
  }
  if (displayLabel === "Rejected") {
    return { bg: "#FEF2F2", dark: COLORS.red, icon: "close-circle" };
  }
  if (displayLabel === "In Progress") {
    return { bg: "#EFF6FF", dark: COLORS.blue, icon: "briefcase" };
  }
  // Pending
  return { bg: "#FEFCE8", dark: COLORS.amber, icon: "hourglass" };
};

// DATE FORMATTER HELPER
const formatDate = (timestamp) => {
  if (!timestamp) return "Date N/A";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-GB'); // DD/MM/YYYY
};

export default function AllComplaints() {
  const router = useRouter();
  const { filter } = useLocalSearchParams(); // Receives 'Pending', 'In Progress', or 'Closed'
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const { title, subtitle } = getHeaderContent(filter);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  useEffect(() => {
    const fetchHistory = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        const q = query(
          collection(db, "complaints"),
          where("studentId", "==", user.uid),
          orderBy("createdAt", "desc")
        );
        const querySnapshot = await getDocs(q);
        const fetched = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // FILTERING BASED EXACTLY ON DASHBOARD 3-STATE BUCKETS

        if (filter) {
          const mode = filter.toLowerCase();

          setComplaints(fetched.filter(item => {
            // Must add .replace(/[-_]/g, " ") here too so the filter understands the web data
            const st = item.status ? item.status.toLowerCase().trim().replace(/[-_]/g, " ") : "";

            if (mode === "pending") {
              return ["open", "pending", "new"].includes(st); // Use array to be safe
            }
            else if (mode === "in progress") {
              return ["assigned", "in progress", "inprogress", "on hold"].includes(st);
            }
            else if (mode === "closed") {
              return ["resolved", "rejected", "closed"].includes(st);
            }
            return true;
          }));
        } else {
          // No filter applied (Show All)
          setComplaints(fetched);
        }

      } catch (error) {
        console.error("Firestore Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistory();
  }, [filter]);

  if (!fontsLoaded) return null;

  const renderComplaintItem = ({ item }) => {
    // Determine the clean label
    const displayLabel = getDisplayStatus(item.status);
    const style = getStatusStyle(displayLabel);

    return (
      <TouchableOpacity
        style={[styles.card, { borderLeftColor: style.dark }]}
        activeOpacity={0.85}
        onPress={() => router.push({ pathname: "/grievance_details", params: { id: item.id } })}
      >
        <View style={styles.cardHeader}>
          {/* BADGE: Uses the clean display label */}
          <View style={[styles.badge, { backgroundColor: style.bg }]}>
            <Text style={[styles.badgeText, { color: style.dark }]}>
              {displayLabel}
            </Text>
          </View>
          {/* Updated to use createdAt (Submission Date) */}
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
        </View>

        <View style={styles.contentRow}>
          {/* MAIN ICON CIRCLE */}
          <View style={[styles.iconCircle, { backgroundColor: style.bg }]}>
            <Ionicons name={style.icon} size={24} color={style.dark} />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardCategory}>{item.category || "General Issue"}</Text>
          </View>

          <View style={styles.arrowCircle}>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="#5A60F6" />

      {/* HEADER */}
      <View style={styles.headerContainer}>
        <LinearGradient
          colors={["#5A60F6", "#6CAEE4"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <SafeAreaView style={styles.safeArea}>
            <View style={styles.navRow}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButtonSquircle}
                activeOpacity={0.8}
              >
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>{title}</Text>
              <Text style={styles.headerSubtitle}>{subtitle}</Text>
            </View>

          </SafeAreaView>
        </LinearGradient>
      </View>

      {/* LIST */}
      <View style={styles.listContainer}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#5A60F6" />
            <Text style={styles.loadingText}>Loading records...</Text>
          </View>
        ) : (
          <FlatList
            data={complaints}
            keyExtractor={(item) => item.id}
            renderItem={renderComplaintItem}
            contentContainerStyle={styles.listPadding}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyCard}>
                <View style={styles.emptyIconBg}>
                  <Ionicons name="file-tray-outline" size={42} color="#94A3B8" />
                </View>
                <Text style={styles.emptyTitle}>No records found</Text>
                <Text style={styles.emptySub}>
                  {filter
                    ? `No ${filter.toLowerCase()} grievances found.`
                    : "You haven't raised any grievances yet."}
                </Text>
              </View>
            }
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  headerContainer: { height: 260, zIndex: 1 },
  headerGradient: {
    flex: 1,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  safeArea: { paddingTop: Platform.OS === 'android' ? 10 : 0 },

  navRow: {
    marginTop: 10,
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  backButtonSquircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },

  headerTextContainer: {
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Poppins_600SemiBold",
    color: "#fff",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontFamily: "Manrope_500Medium",
    color: "rgba(255,255,255,0.9)",
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '85%',
  },

  listContainer: {
    flex: 1,
    marginTop: -55,
    zIndex: 2,
  },
  listPadding: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 50
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  loadingText: { marginTop: 12, color: COLORS.textLight, fontFamily: "Manrope_500Medium" },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 22,
    marginBottom: 18,
    padding: 18,
    borderLeftWidth: 5,
    shadowColor: "#1A1C24",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Poppins_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  dateText: { fontSize: 12, color: COLORS.textLight, fontFamily: "Manrope_500Medium" },
  contentRow: { flexDirection: "row", alignItems: "center" },

  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  textContainer: { flex: 1 },
  cardTitle: {
    fontSize: 16,
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.textDark,
    marginBottom: 3,
  },
  cardCategory: { fontSize: 13, color: COLORS.textLight, fontFamily: "Manrope_500Medium" },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center"
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 40,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    marginTop: 10
  },
  emptyIconBg: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Poppins_600SemiBold",
    color: COLORS.textDark,
    marginBottom: 6
  },
  emptySub: {
    fontSize: 14,
    color: COLORS.textLight,
    fontFamily: "Manrope_400Regular",
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 30
  }
});