import { Stack, router } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// Firebase & Storage Imports
import { auth, db } from "../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Notifications
import * as Notifications from "expo-notifications";

// Prevent splash auto-hide
SplashScreen.preventAutoHideAsync();

// Notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function Layout() {

  // Register Push Token
  const registerForPushNotifications = async (user) => {
    try {
      const { status } = await Notifications.getPermissionsAsync();

      if (status !== "granted") {
        console.log("Notification permission not granted");
        return;
      }

      const token = (await Notifications.getExpoPushTokenAsync()).data;

      console.log("Push Token:", token);

      await updateDoc(doc(db, "students", user.uid), {
        expoPushToken: token,
      });

    } catch (error) {
      console.log("Push token error:", error);
    }
  };

  useEffect(() => {
    let unsubscribeSnapshot = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {

        // Register token when user logs in
        registerForPushNotifications(user);

        unsubscribeSnapshot = onSnapshot(doc(db, "students", user.uid), async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();

            if (data.isSuspended) {
              if (docSnap.metadata.fromCache) {
                return;
              }

              console.log("Account suspended. Initiating force logout...");

              await AsyncStorage.removeItem("griev_email");
              await AsyncStorage.removeItem("griev_password");

              await auth.signOut();

              router.replace({
                pathname: "/log_student",
                params: { suspended: "true", strikes: data.spamCount || 3 }
              });
            }
          }
        });

      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="log_student" />
        <Stack.Screen name="student_dash" />

        <Stack.Screen name="grievance_details" />
        <Stack.Screen name="all_complaints" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="new_complaint" />

        {/* Navigate to app_locked if biometrics is cancelled */}
        <Stack.Screen name="app_locked" options={{ animation: 'fade' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}