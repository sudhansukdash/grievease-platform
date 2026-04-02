// Unified Login Page for both Principal and HOD's
import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/themeContext";
import { Mail, Lock, AlertCircle, CheckCircle2 } from "lucide-react";
import customLogo from "../assets/logo.png";

const Login = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setResetMessage("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "admins", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // Check if the account has been revoked
        if (userData.isActive === false) {
          await auth.signOut(); // Force log them out immediately
          setError("Access Denied: Your account has been revoked by the Principal.");
          setLoading(false);
          return; // Stop execution here so they don't navigate
        }

        if (userData.role === "PRINCIPAL" || userData.role === "HOD") {
          navigate("/dashboard");
        } else {
          setError("Access Denied: Your account is not an Admin.");
          await auth.signOut();
        }
      } else {
        setError("Access Denied: No Admin record found.");
        await auth.signOut();
      }
    } catch (err) {
      console.error("Login Error:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (err.code === "auth/too-many-requests") {
        setError("Too many failed attempts. Try again later.");
      } else if (err.code === "permission-denied") {
        setError("Database Permission Error. Check Firestore Rules.");
      } else {
        setError("Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setResetMessage("");

    if (!email) {
      setError("Please enter your email address above to reset your password.");
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetMessage(`A password reset link has been sent to ${email}`);
    } catch (err) {
      console.error("Reset Error:", err);
      if (err.code === "auth/invalid-email") {
        setError("Please enter a valid email address.");
      } else {
        setError("Failed to send reset email. Ensure the email is correct.");
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={styles(theme).container}>


      <div style={styles(theme).ambientBlob1}></div>
      <div style={styles(theme).ambientBlob2}></div>

      <div style={styles(theme).card}>

        {/* Header Section */}
        <div style={styles(theme).header}>

          <div style={styles(theme).iconContainer}>
            <img
              src={customLogo}
              alt="GrievEase Logo"
              style={styles(theme).logoImage}
            />
          </div>

          <h1 style={styles(theme).title}>
            <span style={styles(theme).gradientText}>GrievEase</span>
            <span style={{ fontWeight: 300, color: theme.colors.subText, marginLeft: "6px" }}>Admin</span>
          </h1>
          <p style={styles(theme).subtitle}>Secure portal for campus administration</p>
        </div>

        {/* Alerts */}
        {error && (
          <div style={styles(theme).errorBox}>
            <AlertCircle size={16} /> {error}
          </div>
        )}
        {resetMessage && (
          <div style={styles(theme).successBox}>
            <CheckCircle2 size={16} /> {resetMessage}
          </div>
        )}

        {/* Form Section */}
        <form onSubmit={handleLogin} style={styles(theme).form}>
          <div style={styles(theme).inputGroup}>
            <label style={styles(theme).label}>Email Address</label>
            <div style={styles(theme).inputWrapper}>
              <Mail size={18} color={theme.colors.subText} style={styles(theme).inputIcon} />
              <input
                type="email"
                placeholder="principal@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles(theme).input}
              />
            </div>
          </div>

          <div style={styles(theme).inputGroup}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={styles(theme).label}>Password</label>
            </div>
            <div style={styles(theme).inputWrapper}>
              <Lock size={18} color={theme.colors.subText} style={styles(theme).inputIcon} />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={styles(theme).input}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={loading ? styles(theme).buttonDisabled : styles(theme).button}
          >
            {loading ? "Authenticating..." : "Access Dashboard"}
          </button>
        </form>

        {/* Footer Actions */}
        <div style={styles(theme).footer}>
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading}
            style={styles(theme).forgotBtn}
          >
            {resetLoading ? "Sending link..." : "Forgot your password?"}
          </button>
        </div>

      </div>
    </div>
  );
};


const styles = (theme) => ({
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "100vh",
    backgroundColor: theme.colors.bg,
    fontFamily: "'Inter', 'Segoe UI', sans-serif",
    position: "relative",
    overflow: "hidden",
  },

  ambientBlob1: {
    position: "absolute",
    top: "-5%",
    left: "-5%",
    width: "500px",
    height: "500px",
    // Changed to a solid color base with a heavy blur for a much stronger glow
    background: theme.isDark ? "rgba(99, 102, 241, 0.25)" : "rgba(99, 102, 241, 0.4)",
    borderRadius: "50%",
    zIndex: 0,
    filter: "blur(90px)", // Massive blur creates the "orb" effect
  },
  ambientBlob2: {
    position: "absolute",
    bottom: "-5%",
    right: "-5%",
    width: "450px",
    height: "450px",
    background: theme.isDark ? "rgba(56, 189, 248, 0.25)" : "rgba(56, 189, 248, 0.4)",
    borderRadius: "50%",
    zIndex: 0,
    filter: "blur(90px)",
  },

  card: {
    // Overriding the solid theme color to make it semi-transparent
    backgroundColor: theme.isDark ? "rgba(30, 41, 59, 0.85)" : "rgba(255, 255, 255, 0.85)",
    padding: "48px 40px",
    borderRadius: "24px",
    boxShadow: theme.isDark
      ? "0 25px 50px -12px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)"
      : "0 25px 50px -12px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.05)",
    width: "100%",
    maxWidth: "440px",
    position: "relative",
    zIndex: 10,
    // This blurs whatever is BEHIND the card, creating the frosted glass look
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)", // Safari support
  },
  header: {
    textAlign: "center",
    marginBottom: "36px",
  },
  iconContainer: {
    width: "85px",
    height: "85px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    margin: "0 auto 24px auto",
  },
  logoImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    filter: theme.isDark ? "drop-shadow(0 8px 16px rgba(56, 189, 248, 0.2))" : "drop-shadow(0 12px 20px rgba(56, 189, 248, 0.3))",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "28px",
    letterSpacing: "-0.5px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#475569",
  },
  gradientText: {
    fontWeight: "800",
    color: "#223450",
    background: "none",
    WebkitBackgroundClip: "unset",
    WebkitTextFillColor: "initial",
  },
  subtitle: {
    color: theme.colors.subText,
    fontSize: "15px",
    margin: 0,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "22px",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "700",
    color: theme.colors.subText,
    textTransform: "uppercase",
    letterSpacing: "0.8px",
  },
  inputWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "16px",
  },
  input: {
    width: "100%",
    padding: "16px 16px 16px 46px",
    borderRadius: "14px",
    border: `1px solid ${theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"}`,
    backgroundColor: theme.isDark ? "rgba(0,0,0,0.2)" : "#f8fafc",
    color: theme.colors.text,
    fontSize: "15px",
    outline: "none",
    boxSizing: "border-box",
    transition: "all 0.2s ease",
  },
  button: {
    background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
    color: "white",
    padding: "16px",
    borderRadius: "14px",
    border: "none",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    marginTop: "12px",
    transition: "transform 0.2s, box-shadow 0.2s",
    boxShadow: "0 8px 20px -6px rgba(99, 102, 241, 0.5)",
  },
  buttonDisabled: {
    backgroundColor: "#a5b4fc",
    color: "white",
    padding: "16px",
    borderRadius: "14px",
    border: "none",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "not-allowed",
    marginTop: "12px",
  },
  errorBox: {
    backgroundColor: theme.isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
    color: theme.isDark ? "#f87171" : "#ef4444",
    border: `1px solid ${theme.isDark ? "rgba(239, 68, 68, 0.3)" : "#fca5a5"}`,
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "20px",
    fontSize: "14px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  successBox: {
    backgroundColor: theme.isDark ? "rgba(16, 185, 129, 0.1)" : "#ecfdf5",
    color: theme.isDark ? "#34d399" : "#10b981",
    border: `1px solid ${theme.isDark ? "rgba(16, 185, 129, 0.3)" : "#6ee7b7"}`,
    padding: "14px",
    borderRadius: "12px",
    marginBottom: "20px",
    fontSize: "14px",
    fontWeight: "500",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  footer: {
    marginTop: "28px",
    textAlign: "center",
  },
  forgotBtn: {
    background: "none",
    border: "none",
    color: "#6366f1",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    padding: "5px",
    textDecoration: "underline",
    textUnderlineOffset: "4px",
  }
});

export default Login;