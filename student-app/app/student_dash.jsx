// Student Dashboard
import { Inter_400Regular } from "@expo-google-fonts/inter";
import { PlayfairDisplay_600SemiBold } from "@expo-google-fonts/playfair-display";
import { Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold, useFonts } from "@expo-google-fonts/poppins";
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold } from "@expo-google-fonts/manrope";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, useRouter } from "expo-router";

import React, { useState, useEffect } from "react";
import { ActivityIndicator, Dimensions, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View, Modal, Pressable, Alert, Platform } from "react-native";
import AsyncStorage from '@react-native-async-storage/async-storage';

import { auth, db } from "../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, orderBy, query, where, updateDoc } from "firebase/firestore";

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

const { width } = Dimensions.get("window");

const COLORS = {
  primary: "#5A60F6",
  headerGrad: ["#5A60F6", "#6CAEE4"],
  textMain: "#1E293B",
  textMuted: "#64748B",
  cardBg: "#FFFFFF",
  green: "#10B981",
  red: "#F43F5E",
  blue: "#3B82F6",
  amber: "#F59E0B"
};



Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const getDisplayStatus = (status) => {

  const s = status ? status.toLowerCase().trim().replace(/[-_]/g, " ") : "";

  if (["resolved", "completed"].includes(s)) return "Resolved";
  if (["rejected", "closed"].includes(s)) return "Rejected";


  if (["assigned", "in progress", "inprogress", "on hold"].includes(s)) return "In Progress";


  if (["open", "pending", "new"].includes(s)) return "Pending";

  // The fallback just in case
  return "Pending";
};
const getStatusTheme = (displayLabel) => {
  if (displayLabel === "Resolved") {
    return { bg: "#ECFDF5", dark: COLORS.green, icon: "checkmark-done-circle" };
  } else if (displayLabel === "Rejected") {
    return { bg: "#FEF2F2", dark: COLORS.red, icon: "close-circle" };
  } else if (displayLabel === "In Progress") {
    return { bg: "#EFF6FF", dark: COLORS.blue, icon: "briefcase" };
  }
  return { bg: "#FEFCE8", dark: COLORS.amber, icon: "hourglass" };
};


const formatDate = (timestamp) => {
  if (!timestamp) return "Just Now";

  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0'); // Months are 0-indexed
  const year = date.getFullYear();

  return `${day}/${month}/${year}`; // Returns DD/MM/YYYY
};
export default function StudentDashboard() {
  const router = useRouter();

  const [menuVisible, setMenuVisible] = useState(false);
  const [firstName, setFirstName] = useState("Student");
  const [fullName, setFullName] = useState("");
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({ pending: 0, inProgress: 0, closed: 0 });
  const [unreadCount, setUnreadCount] = useState(0);
  const [closedIds, setClosedIds] = useState([]);

  const [fontsLoaded] = useFonts({
    Poppins_400Regular, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold,
    Inter_400Regular, PlayfairDisplay_600SemiBold,
    Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold,
  });

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        router.replace("/log_student");
        return;
      }

      // Push Notifications Registration
      async function registerForPushNotificationsAsync() {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default', importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250], lightColor: COLORS.primary,
          });
        }
        if (Device.isDevice) {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
          }
          if (finalStatus === 'granted') {
            try {
              const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
              const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
              const userDoc = await getDoc(doc(db, "students", user.uid));
              const userData = userDoc.data();

              if (userData?.settings?.pushNotifications === false) return;
              await updateDoc(doc(db, "students", user.uid), { expoPushToken: tokenData.data });
            } catch (error) { console.log("Push token error:", error); }
          }
        }
      }
      registerForPushNotificationsAsync();

      // Fetch User Data
      getDoc(doc(db, "students", user.uid)).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.isSuspended) {
            router.replace("/suspended");
            return;
          }
          setFullName(data.fullName);
          setFirstName(data.fullName.split(" ")[0]);
        }
      });

      // Fetch Complaints
      const q = query(
        collection(db, "complaints"),
        where("studentId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      unsubscribeSnapshot = onSnapshot(q, async (snapshot) => {
        const fetched = [];
        let pendingCount = 0; let inProgressCount = 0; let closedCount = 0;
        const currentClosedIds = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          fetched.push({ id: doc.id, ...data });
          const displayLabel = getDisplayStatus(data.status);
          if (displayLabel === "Pending") pendingCount++;
          else if (displayLabel === "In Progress") inProgressCount++;
          else if (displayLabel === "Resolved" || displayLabel === "Rejected") {
            closedCount++;
            currentClosedIds.push(doc.id);
          }
        });

        setComplaints(fetched);
        setStats({ pending: pendingCount, inProgress: inProgressCount, closed: closedCount });
        setClosedIds(currentClosedIds);

        try {
          const seenString = await AsyncStorage.getItem("seenClosedIds");
          const seenIds = seenString ? JSON.parse(seenString) : [];
          setUnreadCount(currentClosedIds.filter(id => !seenIds.includes(id)).length);
        } catch (e) { console.error("Storage Error", e); }

        setLoading(false); // Data loaded, hide spinner
      }, (err) => {
        console.error("Snapshot error:", err);
        setLoading(false);
      });
    });

    const failsafe = setTimeout(() => setLoading(false), 6000);

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
      clearTimeout(failsafe);
    };
  }, []);

  const handleNotificationPress = async () => {
    try {
      await AsyncStorage.setItem("seenClosedIds", JSON.stringify(closedIds));
      setUnreadCount(0);
      router.push("/notifications");
    } catch (e) {
      console.error("Failed to save seen status", e);
      router.push("/notifications");
    }
  };


  const handleLogout = () => {
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out", style: "destructive", onPress: async () => {
          try {
            // 1. CLEAR STORAGE FIRST
            await AsyncStorage.removeItem("griev_email");
            await AsyncStorage.removeItem("griev_password");
            await AsyncStorage.removeItem("biometric_enabled");

            // 2. SIGN OUT FIREBASE
            await auth.signOut();

            // 3. NAVIGATE
            router.replace("/log_student");
          } catch (e) {
            console.error("Logout failed:", e);
            // Fallback: force navigate even if storage fails
            router.replace("/log_student");
          }
        }
      }
    ]);
  };
  // CLEAN LOADING LOGIC
  if (!fontsLoaded || loading) {
    return (
      <View style={styles.loading}>
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const recentComplaints = complaints.slice(0, 3);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      {/* SIDEBAR MODAL */}
      <Modal animationType="fade" transparent={true} visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <View style={styles.modalWrapper}>
          <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)} />
          <View style={styles.sidebarContainer}>
            <TouchableOpacity style={styles.closeSideBtn} onPress={() => setMenuVisible(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={COLORS.textMuted} />
            </TouchableOpacity>

            <View style={styles.sidebarHeader}>
              <LinearGradient colors={COLORS.headerGrad} style={styles.sidebarAvatar}>
                <Text style={styles.avatarLetter}>{firstName[0]}</Text>
              </LinearGradient>
              <Text style={styles.sidebarName}>{fullName || "Student"}</Text>
              <Text style={styles.sidebarRole}>Verified Account</Text>
            </View>

            <View style={styles.sidebarMenu}>
              <SidebarItem icon="person-outline" label="My Profile" onPress={() => { setMenuVisible(false); router.push("/profile") }} />
              <SidebarItem icon="chatbox-ellipses-outline" label="My Grievances" onPress={() => { setMenuVisible(false); router.push("/all_complaints") }} />
              <SidebarItem icon="shield-checkmark-outline" label="Settings" onPress={() => { setMenuVisible(false); router.push("/settings") }} />
            </View>

            <TouchableOpacity style={styles.sidebarLogout} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* HEADER */}
      <LinearGradient colors={COLORS.headerGrad} style={styles.header}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setMenuVisible(true)} activeOpacity={0.8}>
            <Ionicons name="grid-outline" size={22} color="white" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.iconButton} onPress={handleNotificationPress} activeOpacity={0.8}>
            <Ionicons name="notifications-outline" size={22} color="white" />

            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.badgeTextCount}>{unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
        <View style={styles.headerTextWrapper}>
          <Text style={styles.welcomeMsg}>Welcome back,</Text>
          <Text style={styles.greeting}>{firstName}</Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Pending"
            val={stats.pending}
            color={COLORS.amber}
            icon="time-outline"
            onPress={() => router.push({ pathname: "/all_complaints", params: { filter: "Pending" } })}
          />
          <StatCard
            label="In Progress"
            val={stats.inProgress}
            color={COLORS.blue}
            icon="construct-outline"
            onPress={() => router.push({ pathname: "/all_complaints", params: { filter: "In Progress" } })}
          />
          <StatCard
            label="Closed"
            val={stats.closed}
            color={COLORS.green}
            icon="checkmark-circle-outline"
            onPress={() => router.push({ pathname: "/all_complaints", params: { filter: "Closed" } })}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Activities</Text>
          <TouchableOpacity onPress={() => router.push("/all_complaints")} activeOpacity={0.7}>
            <Text style={styles.viewAllBtn}>View All</Text>
          </TouchableOpacity>
        </View>

        {/* COMPLAINTS LIST */}
        {recentComplaints.length > 0 ? (
          <View style={styles.complaintsList}>
            {recentComplaints.map((item) => {
              const displayLabel = getDisplayStatus(item.status);
              const theme = getStatusTheme(displayLabel);

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.card, { borderLeftColor: theme.dark }]}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: "/grievance_details", params: { id: item.id } })}
                >
                  <View style={styles.cardHeader}>
                    <View style={[styles.badge, { backgroundColor: theme.bg }]}>
                      <Text style={[styles.badgeText, { color: theme.dark }]}>
                        {displayLabel}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
                  </View>

                  <View style={styles.contentRow}>
                    <View style={[styles.iconCircle, { backgroundColor: theme.bg }]}>
                      <Ionicons name={theme.icon} size={22} color={theme.dark} />
                    </View>
                    <View style={styles.textContainer}>
                      <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.cardCategory}>{item.category || "General Issue"}</Text>
                    </View>
                    <View style={styles.arrowCircle}>
                      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="coffee-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Active Issues</Text>
            <Text style={styles.emptySubtitle}>Your record is clean. Relax!</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fabContainer} onPress={() => router.push("/new_complaint")} activeOpacity={0.9}>
        <LinearGradient colors={COLORS.headerGrad} style={styles.fabGradient}>
          <Ionicons name="add" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const StatCard = ({ label, val, color, icon, onPress }) => (
  <TouchableOpacity style={styles.statCard} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.statHeader}>
      <Text style={[styles.statVal, { color }]}>{val < 10 ? `0${val}` : val}</Text>
      <Ionicons name={icon} size={18} color={color} style={{ opacity: 0.6 }} />
    </View>
    <Text style={styles.statLab}>{label}</Text>
  </TouchableOpacity>
);

const SidebarItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.sidebarItem} onPress={onPress} activeOpacity={0.7}>
    <View style={styles.sideIconBox}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
    </View>
    <Text style={styles.sidebarLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { height: 249, paddingHorizontal: 25, paddingTop: 60, borderBottomLeftRadius: 35, borderBottomRightRadius: 35 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  iconButton: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  notificationBadge: { position: 'absolute', top: -5, right: -5, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2 },
  badgeTextCount: { color: '#fff', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
  headerTextWrapper: { marginTop: 20, paddingLeft: 4 },
  welcomeMsg: { color: 'rgba(255,255,255,0.9)', fontSize: 16, fontFamily: "Manrope_400Regular", marginBottom: 0, letterSpacing: 0.3 },
  greeting: { color: 'white', fontSize: 32, fontFamily: "Poppins_600SemiBold", lineHeight: 40, letterSpacing: 0.4 },
  content: { paddingHorizontal: 25, marginTop: -30 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statCard: { width: '31%', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 20, elevation: 4, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, justifyContent: 'space-between', height: 100 },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statVal: { fontSize: 26, fontFamily: "Poppins_700Bold", lineHeight: 30 },
  statLab: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Manrope_600SemiBold", textTransform: 'uppercase', marginTop: 8 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: COLORS.textMain },
  viewAllBtn: { color: COLORS.primary, fontSize: 14, fontFamily: "Poppins_500Medium" },
  card: { backgroundColor: COLORS.cardBg, borderRadius: 22, marginBottom: 16, padding: 18, borderLeftWidth: 5, shadowColor: "#1E293B", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 3 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  badge: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  badgeText: { fontSize: 11, fontFamily: "Poppins_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  dateText: { fontSize: 11, color: COLORS.textMuted, fontFamily: "Manrope_500Medium" },
  contentRow: { flexDirection: "row", alignItems: "center" },
  iconCircle: { width: 44, height: 44, borderRadius: 16, justifyContent: "center", alignItems: "center", marginRight: 14 },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 15, fontFamily: "Poppins_600SemiBold", color: COLORS.textMain, marginBottom: 2 },
  cardCategory: { fontSize: 12, color: COLORS.textMuted, fontFamily: "Manrope_500Medium" },
  arrowCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#F8FAFC", justifyContent: "center", alignItems: "center" },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  emptyTitle: { fontSize: 20, fontFamily: "Poppins_600SemiBold", color: COLORS.textMain, marginTop: 15 },
  emptySubtitle: { fontSize: 14, color: COLORS.textMuted, textAlign: 'center', marginTop: 5, fontFamily: "Inter_400Regular" },
  fabContainer: { position: 'absolute', bottom: 30, right: 25 },
  fabGradient: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  modalWrapper: { flex: 1, flexDirection: 'row' },
  modalOverlay: { position: 'absolute', width: '100%', height: '100%', backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sidebarContainer: { width: '80%', height: '100%', backgroundColor: 'white', padding: 25, paddingTop: 50 },
  closeSideBtn: { alignSelf: 'flex-end', padding: 5 },
  sidebarHeader: { alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', marginBottom: 20 },
  sidebarAvatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: 'white', fontSize: 28, fontFamily: "Poppins_700Bold" },
  sidebarName: { fontSize: 18, fontFamily: "Poppins_600SemiBold", color: COLORS.textMain, marginTop: 12 },
  sidebarRole: { fontSize: 12, color: COLORS.green, fontFamily: "Poppins_600SemiBold", letterSpacing: 0.5 },
  sidebarMenu: { flex: 1 },
  sidebarItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  sideIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#EEF2FF', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  sidebarLabel: { fontSize: 15, fontFamily: "Poppins_500Medium", color: '#334155' },
  sidebarLogout: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  logoutText: { marginLeft: 15, fontSize: 15, color: '#EF4444', fontFamily: "Poppins_600SemiBold" }
});