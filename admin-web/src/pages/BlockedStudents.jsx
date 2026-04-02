// This is the script for Restricted Accounts Section (i.e, students whose spamCount is => 3 will appear here)
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, query, where, getDoc } from "firebase/firestore";
import { useTheme } from "../context/themeContext";
import { Ban, Unlock, AlertTriangle, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

const BlockedStudents = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [blockedStudents, setBlockedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalConfig, setModalConfig] = useState({ visible: false, title: "", message: "", isConfirm: false, isError: false, onConfirm: null });

  useEffect(() => {
    const fetchBlockedAccounts = async () => {
      try {
        // 1. Verify Principal Access
        const user = auth.currentUser;
        if (!user) return;

        const adminSnap = await getDoc(doc(db, "admins", user.uid));
        if (!adminSnap.exists() || adminSnap.data().role !== "PRINCIPAL") {

          setModalConfig({
            visible: true,
            title: "Unauthorized Access",
            message: "Only the Principal can manage restricted accounts.",
            isConfirm: false,
            isError: true,
            onConfirm: () => navigate("/dashboard")
          });
          setLoading(false);
          return;
        }

        const q = query(collection(db, "students"), where("isSuspended", "==", true));
        const snap = await getDocs(q);

        const studentsData = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setBlockedStudents(studentsData);
      } catch (error) {
        console.error("Error fetching blocked students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchBlockedAccounts();
  }, [navigate]);

  const handleUnblockClick = (studentId, studentName) => {
    setModalConfig({
      visible: true,
      title: "Confirm Account Restoration?",
      message: `Are you sure you want to restore access for ${studentName}?`,
      isConfirm: true,
      isError: false,
      onConfirm: () => executeUnblock(studentId, studentName)
    });
  };

  const executeUnblock = async (studentId, studentName) => {
    try {
      await updateDoc(doc(db, "students", studentId), {
        isSuspended: false,
        spamCount: 0
      });

      setBlockedStudents(prev => prev.filter(student => student.id !== studentId));

      setModalConfig({
        visible: true,
        title: "Access Restored!",
        message: `${studentName}'s account has been successfully restored!`,
        isConfirm: false,
        isError: false,
        onConfirm: null
      });

    } catch (error) {
      console.error("Error unblocking student:", error);
      setModalConfig({
        visible: true,
        title: "Action Failed",
        message: "Failed to restore the account. Please try again.",
        isConfirm: false,
        isError: true,
        onConfirm: null
      });
    }
  };

  if (loading) return <div style={{ padding: "50px", textAlign: "center", color: theme.colors.subText }}>Loading restricted accounts...</div>;

  return (
    <div style={{ padding: "30px", maxWidth: "1400px", margin: "0 auto", color: theme.colors.text, fontFamily: "'Inter', sans-serif" }}>

      {/* Header */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '700' }}>
          Restricted Accounts
        </h2>
        <p style={{ color: theme.colors.subText, fontSize: "14px", marginTop: "6px", margin: "6px 0 0 0" }}>
          Manage students who have been suspended due to multiple spam violations.
        </p>
      </div>

      {/* Main Content Area */}
      <div style={{
        backgroundColor: theme.colors.card,
        borderRadius: "16px",
        border: `1px solid ${theme.colors.border}`,
        overflowX: "auto",
        boxShadow: theme.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)"
      }}>

        {blockedStudents.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ backgroundColor: theme.isDark ? "#1e293b" : "#fef2f2" }}>
              <tr style={{ borderBottom: `1px solid ${theme.colors.border}`, textAlign: "left" }}>
                <th style={thStyle(theme)}>Student Identity</th>
                <th style={thStyle(theme)}>Contact / Email</th>
                <th style={thStyle(theme)}>Violation Status</th>
                <th style={thStyle(theme)}>Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {blockedStudents.map(student => (
                <tr key={student.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                  <td style={tdStyle(theme)}>
                    <div style={{ fontWeight: "700", color: theme.colors.text, fontSize: "15px" }}>{student.fullName || "Unknown Student"}</div>

                    <div style={{
                      marginTop: "6px",
                      display: "inline-block",
                      backgroundColor: theme.isDark ? "#334155" : "#f1f5f9",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      border: `1px solid ${theme.colors.border}`
                    }}>
                      <span style={{ fontSize: "11px", color: theme.colors.subText, fontFamily: "monospace", letterSpacing: "0.5px" }}>
                        ID: {student.id}
                      </span>
                    </div>
                  </td>

                  <td style={tdStyle(theme)}>
                    <div style={{ fontSize: "14px", color: theme.colors.text }}>{student.email}</div>
                  </td>

                  <td style={tdStyle(theme)}>
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: "6px",
                      backgroundColor: theme.isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2",
                      color: theme.isDark ? "#f87171" : "#dc2626",
                      padding: "6px 14px", borderRadius: "8px",
                      fontSize: "12px", fontWeight: "700",
                      border: `1px solid ${theme.isDark ? "rgba(239, 68, 68, 0.3)" : "#fca5a5"}`
                    }}>
                      <AlertTriangle size={14} />
                      SPAM LIMIT ({student.spamCount || 3}/3)
                    </div>
                  </td>
                  <td style={tdStyle(theme)}>
                    <button
                      onClick={() => handleUnblockClick(student.id, student.fullName)}
                      style={unblockBtn(theme)}
                    >
                      <Unlock size={14} /> Restore Access
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          /* Empty State */
          <div style={{ padding: '80px 0', textAlign: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={48} color="#10b981" style={{ opacity: 0.8, marginBottom: '16px' }} />
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: theme.colors.text }}>System is Clean</h3>
              <p style={{ margin: 0, color: theme.colors.subText, fontSize: '14px' }}>
                There are currently no restricted student accounts.
              </p>
            </div>
          </div>
        )}
      </div>
      {/* THEMED ACTION MODAL */}
      {modalConfig.visible && (
        <div style={modalOverlay}>
          <div style={modalCard(theme)}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "700", color: modalConfig.isError ? "#ef4444" : theme.colors.text }}>
              {modalConfig.title}
            </h3>
            <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: theme.colors.text, lineHeight: "1.5", opacity: 0.9 }}>
              {modalConfig.message}
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              {modalConfig.isConfirm && (
                <button onClick={() => setModalConfig({ ...modalConfig, visible: false })} style={outlineBtn(theme)}>
                  Cancel
                </button>
              )}
              <button
                onClick={() => {
                  setModalConfig({ ...modalConfig, visible: false });
                  if (modalConfig.onConfirm) modalConfig.onConfirm();
                }}
                style={modalConfig.isError && modalConfig.isConfirm ? dangerBtn : primaryBtn}
              >
                {modalConfig.isConfirm ? "Confirm Restore" : "Acknowledge"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// --- STYLES ---
const thStyle = (theme) => ({
  padding: "16px 24px",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: 'uppercase',
  color: theme.isDark ? "#94a3b8" : "#991b1b",
  letterSpacing: '0.5px'
});

const tdStyle = (theme) => ({
  padding: "16px 24px"
});

const unblockBtn = (theme) => ({
  padding: "10px 18px",
  backgroundColor: theme.isDark ? "rgba(16, 185, 129, 0.15)" : "#ecfdf5",
  color: theme.isDark ? "#34d399" : "#10b981",
  border: theme.isDark ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid #6ee7b7",
  borderRadius: "10px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: "700",
  fontSize: "13px",
  transition: "all 0.2s ease"
});

const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" };
const modalCard = (theme) => ({ width: "90%", maxWidth: "420px", backgroundColor: theme.colors.card, borderRadius: "20px", padding: "32px", border: `1px solid ${theme.colors.border}`, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" });
const outlineBtn = (theme) => ({ padding: "10px 16px", backgroundColor: "transparent", border: `1px solid ${theme.colors.border}`, color: theme.colors.text, borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", transition: "all 0.2s" });
const primaryBtn = { padding: "10px 20px", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", boxShadow: "0 4px 12px rgba(16, 185, 129, 0.3)", transition: "all 0.2s" };
const dangerBtn = { padding: "10px 20px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)", transition: "all 0.2s" };

export default BlockedStudents;