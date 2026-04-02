// reusable component that update the profile info in database, like if someone toggles opt-in/out of whatsapp updates this updates in db
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";

export async function updateStudentData(updates = {}) {
  const user = auth.currentUser;
  if (!user) {
    console.warn("No logged-in user found.");
    return;
  }

  const userRef = doc(db, "students", user.uid);
  const docSnap = await getDoc(userRef);
  const currentData = docSnap.exists() ? docSnap.data() : {};

  // verified updates only once, approved stays unchanged
  const verifiedStatus =
    currentData.verified === true ? true : user.emailVerified;

  const updatedData = {
    ...currentData,
    ...updates, // merge the new updates
    verified: verifiedStatus,
    approved: currentData.approved ?? false,
  };

  // Merge ensures nothing gets overwritten
  await setDoc(userRef, updatedData, { merge: true });

  console.log("Profile updated:", updatedData);
}
