// Notification Bell
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Dimensions
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
// Imported onSnapshot for real-time updates
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

// Fonts
import { useFonts, Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold } from "@expo-google-fonts/poppins";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";

const { width } = Dimensions.get("window");

const COLORS = {
  primary: "#5A60F6",
  gradient: ["#5A60F6", "#6CAEE4"],
  bg: "#F8F9FE",
  card: "#FFFFFF",
  textMain: "#1E293B",
  textSub: "#64748B",
  green: "#10B981",
  blue: "#3B82F6",
  red: "#EF4444"
};

export default function Notifications() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_600SemiBold, Poppins_700Bold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;


    const q = query(
      collection(db, "complaints"),
      where("studentId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    // Real-time Listener
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const updates = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        // Show if Resolved/Rejected OR if Pending but has admin remarks
        if (data.status !== "Pending" || data.adminRemarks) {
          updates.push({
            id: doc.id,
            ...data,
          });
        }
      });

      setNotifications(updates);
      setLoading(false);
    }, (error) => {
      console.error("Notification Error:", error);
      setLoading(false);
    });

    // Cleanup when leaving screen
    return () => unsubscribe();
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return "Just now";
    try {
      // Handle Firebase Timestamp
      if (timestamp.toDate) {
        return timestamp.toDate().toLocaleDateString(undefined, {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
      }
      // Handle Standard Date String
      return new Date(timestamp).toLocaleDateString();
    } catch (e) {
      return "Recent";
    }
  };

  if (!fontsLoaded) return null;

  const renderNotification = ({ item }) => {
    const isResolved = item.status === "Resolved";
    const isRejected = item.status === "Rejected";

    let iconName = "chatbubble-ellipses";
    let themeColor = COLORS.blue;
    let bgColor = "#EFF6FF";

    if (isResolved) {
      iconName = "checkmark-done";
      themeColor = COLORS.green;
      bgColor = "#ECFDF5";
    } else if (isRejected) {
      iconName = "close-circle";
      themeColor = COLORS.red;
      bgColor = "#FEF2F2";
    }

    return (
      <TouchableOpacity
        style={styles.notifCard}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: "/grievance_details", params: { id: item.id } })}
      >
        <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
          <Ionicons name={iconName} size={24} color={themeColor} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.notifTitle}>
            {isResolved ? "Complaint Resolved" : isRejected ? "Complaint Closed" : "Admin Update"}
          </Text>

          <Text style={styles.notifBody} numberOfLines={2}>
            {item.adminRemarks
              ? `Admin: "${item.adminRemarks}"`
              : `Your grievance regarding "${item.category}" has been marked as ${item.status}.`}
          </Text>

          <Text style={styles.notifTime}>
            {formatDate(item.createdAt)}
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* BACKGROUND GRADIENT */}
      <LinearGradient colors={COLORS.gradient} style={styles.absoluteHeader} />

      <SafeAreaView style={styles.safeArea}>

        {/* CUSTOM HEADER */}
        <View style={styles.headerContainer}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
        </View>

        {/* CONTENT */}
        <View style={styles.contentContainer}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderNotification}
              contentContainerStyle={styles.listPadding}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconBox}>
                    <Ionicons name="notifications-off-outline" size={40} color="#94A3B8" />
                  </View>
                  <Text style={styles.emptyText}>No new updates</Text>
                  <Text style={styles.emptySub}>We'll notify you when there is an update on your grievances.</Text>
                </View>
              }
            />
          )}
        </View>

      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  safeArea: { flex: 1 },

  absoluteHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    width: width,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  headerContainer: {
    paddingHorizontal: 20,
    marginTop: 10,
    height: 120,
    justifyContent: 'space-between',
    paddingBottom: 10,
    zIndex: 10
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: "Poppins_700Bold",
    color: "#fff",
    letterSpacing: 0.5,
    marginTop: 10
  },

  contentContainer: { flex: 1 },
  listPadding: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40
  },

  notifCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  textContainer: { flex: 1, marginRight: 10 },

  notifTitle: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 14,
    color: COLORS.textMain,
    marginBottom: 4
  },
  notifBody: {
    fontFamily: "Manrope_500Medium",
    fontSize: 12,
    color: COLORS.textSub,
    lineHeight: 18,
    marginBottom: 6
  },
  notifTime: {
    fontFamily: "Manrope_600SemiBold",
    fontSize: 10,
    color: COLORS.primary,
    opacity: 0.8
  },

  emptyContainer: { alignItems: "center", marginTop: 60, paddingHorizontal: 40 },
  emptyIconBox: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#F1F5F9",
    justifyContent: 'center', alignItems: 'center', marginBottom: 15
  },
  emptyText: {
    fontFamily: "Poppins_600SemiBold",
    fontSize: 18,
    color: COLORS.textMain,
  },
  emptySub: {
    fontFamily: "Manrope_500Medium",
    fontSize: 13,
    color: COLORS.textSub,
    textAlign: "center",
    marginTop: 5,
    lineHeight: 20
  },
});