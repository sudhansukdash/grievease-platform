// Reusable component used across pages
import { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

/**
 * Reusable Success Modal
 * @param {boolean} visible - Controls modal visibility
 * @param {string} title - Main title of the modal
 * @param {string} message - Description text
 * @param {string} buttonText - Text for the action button
 * @param {function} onPress - Function when user presses the button
 * @param {string} [color] - Optional accent color (default = "#5A60F6")
 */
export default function SuccessModal({
  visible,
  title,
  message,
  buttonText,
  onPress,
  color = "#5A60F6",
}) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 5,
        tension: 120,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalContainer}>
        <View style={styles.modalBox}>
          <Animated.View
            style={[
              styles.tickCircle,
              { backgroundColor: color, transform: [{ scale: scaleAnim }] },
            ]}
          >
            <Text style={styles.tickIcon}>✓</Text>
          </Animated.View>

          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalText}>{message}</Text>

          <TouchableOpacity
            style={[styles.modalButton, { backgroundColor: color }]}
            onPress={onPress}
          >
            <Text style={styles.modalButtonText}>{buttonText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: "80%",
    padding: 25,
    alignItems: "center",
  },
  tickCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  tickIcon: {
    fontSize: 42,
    color: "#fff",
  },
  modalTitle: {
    fontSize: width * 0.055,
    fontFamily: "Manrope_600SemiBold",
    color: "#1a1a1a",
    marginBottom: 10,
    textAlign: "center",
  },
  modalText: {
    fontSize: width * 0.038,
    color: "#555",
    textAlign: "center",
    marginBottom: 20,
    fontFamily: "Manrope_500Medium",
  },
  modalButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 30,
  },
  modalButtonText: {
    color: "#fff",
    fontSize: width * 0.04,
    fontFamily: "Manrope_600SemiBold",
  },
});
