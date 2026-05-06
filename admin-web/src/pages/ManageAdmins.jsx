// For Super Admin (Principal) side to Manage HOD's or members
import React, { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { useTheme } from "../context/themeContext";
import { UserPlus, Ban, CheckCircle, X, ShieldCheck, Briefcase } from "lucide-react";
import { useNavigate } from "react-router-dom";
import SuccessModal from "../components/SuccessModal";

const DEPARTMENT_MAP = {
  "Academic": ["HOD - IT", "HOD - Electrical", "HOD - Mechanical", "HOD - Civil", "HOD - E&TC"],
  "Hostel": ["Superintendent (Boys Hostel)", "Superintendent (Girls Hostel)"],
  "Canteen": ["Canteen Manager"],
  "Sports": ["Physical Director"],
  "Parking": ["Security In-charge"],
  "Other": ["Librarian", "General Coordinator"]
};
const BRANCH_MAP = {
  "HOD - IT": "IT",
  "HOD - Electrical": "EE",
  "HOD - Mechanical": "ME",
  "HOD - Civil": "CE",
  "HOD - E&TC": "ETC",
};

const DEPARTMENTS = Object.keys(DEPARTMENT_MAP);

// --- HELPER COMPONENTS ---
const LoadingSpinner = () => (
  <div style={{
    width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.3)",
    borderTop: "2px solid #fff", borderRadius: "50%",
    animation: "spin 0.8s linear infinite"
  }} />
);

const ManageAdmins = () => {
  const { theme } = useTheme();
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [newAdmin, setNewAdmin] = useState({
    name: "",
    email: "",
    password: "",
    department: "Academic",
    roleTitle: DEPARTMENT_MAP["Academic"][0]
  });

  useEffect(() => {
    if (!document.getElementById("spin-style")) {
      const style = document.createElement("style");
      style.id = "spin-style";
      style.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    const fetchAdmins = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const myProfile = await getDoc(doc(db, "admins", user.uid));
      if (!myProfile.exists() || myProfile.data().role !== "PRINCIPAL") {
        alert("Unauthorized Area");
        navigate("/dashboard");
        return;
      }

      const snap = await getDocs(collection(db, "admins"));
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Sort: Principal always first
      data.sort((a, b) => {
        if (a.role === "PRINCIPAL") return -1;
        if (b.role === "PRINCIPAL") return 1;
        return a.name?.localeCompare(b.name);
      });

      setAdmins(data);
      setLoading(false);
    };
    fetchAdmins();
  }, [navigate]);

  const handleDeptChange = (dept) => {
    setNewAdmin({
      ...newAdmin,
      department: dept,
      roleTitle: DEPARTMENT_MAP[dept][0]
    });
  };

  const handleToggleAccess = async (id, currentStatus) => {
    if (!window.confirm("Change access status?")) return;
    try {
      await updateDoc(doc(db, "admins", id), { isActive: !currentStatus });
      setAdmins(prev => prev.map(a => a.id === id ? { ...a, isActive: !currentStatus } : a));
    } catch (e) {
      alert("Error: " + e.message);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    setModalError("");
    setModalLoading(true);

    let secondaryApp = null;
    let secondaryAuth = null;
    let newUid = null;

    try {

      const snap = await getDocs(collection(db, "admins"));
      const latestAdmins = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // CHECK DUPLICATE EMAIL (with trim + lowercase)
      const emailExists = latestAdmins.some(
        (admin) =>
          admin.role !== "PRINCIPAL" &&
          (admin.email || "").toLowerCase().trim() ===
          newAdmin.email.toLowerCase().trim()
      );

      if (emailExists) {
        setModalError("This email is already assigned to another official."); 
        setModalLoading(false);
        return;
      }

      // CHECK DUPLICATE DESIGNATION (normalized + active only)
      const roleExists = latestAdmins.some(
        (admin) =>
          admin.role !== "PRINCIPAL" &&
          admin.department === newAdmin.department &&
          (admin.roleTitle || "").trim() === newAdmin.roleTitle.trim() &&
          admin.isActive !== false
      );

      if (roleExists) {
        setModalError(`${newAdmin.roleTitle} already exists in ${newAdmin.department}.`);
        setModalLoading(false);
        return;
      }
      const config = auth.app.options;
      secondaryApp = initializeApp(config, "SecondaryApp");
      secondaryAuth = getAuth(secondaryApp);

      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, newAdmin.email, newAdmin.password);
      newUid = userCredential.user.uid;

      const newMemberData = {
        name: newAdmin.name,
        email: newAdmin.email,
        role: "HOD",
        department: newAdmin.department,
        roleTitle: newAdmin.roleTitle,
        ...(BRANCH_MAP[newAdmin.roleTitle] && {
          branchCode: BRANCH_MAP[newAdmin.roleTitle]
        }),
        isActive: true,
        createdAt: new Date()
      };

      await setDoc(doc(db, "admins", newUid), newMemberData);

      await signOut(secondaryAuth);
      await deleteApp(secondaryApp);

      setAdmins(prev => [...prev, { id: newUid, ...newMemberData }]);
      setShowModal(false);
      setShowSuccess(true);

    } catch (error) {
      console.error("Creation Error:", error);
      if (newUid && secondaryAuth) {
        try {
          const userToDelete = secondaryAuth.currentUser;
          if (userToDelete) await userToDelete.delete();
        } catch (cleanupError) { console.error("Rollback failed:", cleanupError); }
      }
      if (secondaryApp) await deleteApp(secondaryApp);

      if (error.code === 'auth/email-already-in-use') {
        setModalError("This email already exists and is registered to another account.");
      } else {
        setModalError(error.message || "Failed to create account. Please try again.");
      }
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) return <div style={{ padding: "50px", textAlign: "center", color: theme.colors.subText }}>Loading System Admins...</div>;

  return (
    <div style={{ padding: "30px", maxWidth: "1400px", margin: "0 auto", color: theme.colors.text, fontFamily: "'Inter', sans-serif" }}>

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: "30px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ fontSize: "26px", fontWeight: "700", margin: 0 }}>System Management</h2>
          <p style={{ fontSize: "14px", color: theme.colors.subText, marginTop: "6px", margin: "6px 0 0 0" }}>
            Manage official designations and access controls.
          </p>
        </div>
        <button onClick={() => setShowModal(true)} style={primaryBtn}>
          <UserPlus size={18} /> Add Campus Official
        </button>
      </div>

      {/* TABLE DATA */}
      <div style={{
        backgroundColor: theme.colors.card,
        borderRadius: "16px",
        border: `1px solid ${theme.colors.border}`,
        overflowX: "auto",
        boxShadow: theme.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead style={{ backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc" }}>
            <tr style={{ borderBottom: `1px solid ${theme.colors.border}`, textAlign: "left" }}>
              <th style={thStyle(theme)}>OFFICIAL NAME</th>
              <th style={thStyle(theme)}>DESIGNATION</th>
              <th style={thStyle(theme)}>DEPT / DOMAIN</th>
              <th style={thStyle(theme)}>STATUS</th>
              <th style={thStyle(theme)}>ACTION</th>
            </tr>
          </thead>
          <tbody>
            {admins.map(admin => (
              <tr key={admin.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                <td style={tdStyle(theme)}>
                  <div style={{ fontWeight: "700", color: theme.colors.text, fontSize: "15px" }}>{admin.name || "System Admin"}</div>
                  <div style={{ fontSize: "13px", color: theme.colors.subText, marginTop: "2px" }}>{admin.email}</div>
                </td>
                <td style={tdStyle(theme)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: "500" }}>
                    <ShieldCheck size={16} color={admin.role === "PRINCIPAL" ? "#6366f1" : theme.colors.subText} />
                    {admin.roleTitle || admin.role}
                  </div>
                </td>
                <td style={tdStyle(theme)}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px" }}>
                    <Briefcase size={16} color={theme.colors.subText} />
                    {admin.department || "Global"}
                  </div>
                </td>
                <td style={tdStyle(theme)}>
                  {admin.isActive !== false ?
                    <span style={{
                      backgroundColor: "#dcfce7", color: "#166534",
                      padding: "6px 14px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", letterSpacing: "0.5px",
                      display: "inline-flex", alignItems: "center", gap: "6px"
                    }}>
                      <CheckCircle size={12} /> ACTIVE
                    </span> :
                    <span style={{
                      backgroundColor: "#fee2e2", color: "#991b1b",
                      padding: "6px 14px", borderRadius: "20px", fontSize: "11px", fontWeight: "800", letterSpacing: "0.5px",
                      display: "inline-flex", alignItems: "center", gap: "6px"
                    }}>
                      <Ban size={12} /> REVOKED
                    </span>
                  }
                </td>
                <td style={tdStyle(theme)}>
                  {admin.role !== "PRINCIPAL" && (
                    <button
                      onClick={() => handleToggleAccess(admin.id, admin.isActive !== false)}
                      style={outlineBtn(theme)}
                    >
                      {admin.isActive !== false ? "Revoke Access" : "Restore Access"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ADD MEMBER MODAL */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalCard, backgroundColor: theme.colors.card, border: `1px solid ${theme.colors.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h3 style={{ margin: 0, fontSize: "20px", fontWeight: "700" }}>Create Campus Account</h3>
              <button onClick={() => { setShowModal(false); setModalError(""); }} style={{ background: "none", border: "none", cursor: "pointer", color: theme.colors.subText }}>
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div>
                <label style={labelStyle(theme)}>Full Name</label>
                <input type="text" required placeholder="e.g. Prof. Rajesh Dash" value={newAdmin.name} onChange={e => setNewAdmin({ ...newAdmin, name: e.target.value })} style={inputStyle(theme)} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={labelStyle(theme)}>Email</label>
                  <input type="email" required placeholder="name@college.edu" value={newAdmin.email} onChange={e => setNewAdmin({ ...newAdmin, email: e.target.value })} style={inputStyle(theme)} />
                </div>
                <div>
                  <label style={labelStyle(theme)}>Password</label>
                  <input type="password" required placeholder="••••••••" value={newAdmin.password} onChange={e => setNewAdmin({ ...newAdmin, password: e.target.value })} style={inputStyle(theme)} />
                </div>
              </div>

              <div>
                <label style={labelStyle(theme)}>Main Domain</label>
                <select value={newAdmin.department} onChange={e => handleDeptChange(e.target.value)} style={inputStyle(theme)}>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div>
                <label style={labelStyle(theme)}>Specific Designation</label>
                <select value={newAdmin.roleTitle} onChange={e => setNewAdmin({ ...newAdmin, roleTitle: e.target.value })} style={inputStyle(theme)}>
                  {DEPARTMENT_MAP[newAdmin.department].map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>

              {modalError && (
                <div style={{ color: "#ef4444", fontSize: "13px", fontWeight: "500", textAlign: "center", marginTop: "10px", marginBottom: "5px" }}>
                  {modalError}
                </div>
              )}

              <button type="submit" disabled={modalLoading} style={submitBtn}>
                {modalLoading ? <LoadingSpinner /> : "Generate Official Credentials"}
              </button>
            </form>
          </div>
        </div>
      )}

      <SuccessModal
        visible={showSuccess}
        title="Access Granted"
        message={`${newAdmin.name} has been appointed as ${newAdmin.roleTitle}. Account is now active.`}
        buttonText="Return to Directory"
        onPress={() => {
          setShowSuccess(false);
          setNewAdmin({ name: "", email: "", password: "", department: "Academic", roleTitle: DEPARTMENT_MAP["Academic"][0] });
        }}
        color="#10b981"
      />
    </div>
  );
};

const modalOverlay = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100, backdropFilter: "blur(4px)" };
const modalCard = { width: "450px", borderRadius: "20px", padding: "32px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" };

const labelStyle = (theme) => ({ display: "block", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px", color: theme.colors.subText });
const inputStyle = (theme) => ({ width: "100%", padding: "14px", borderRadius: "12px", border: `1px solid ${theme.colors.border}`, backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", color: theme.colors.text, fontSize: "14px", outline: "none", boxSizing: "border-box", transition: "all 0.2s ease" });

const primaryBtn = { padding: "14px 24px", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "12px", cursor: "pointer", fontWeight: "700", fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.5)', transition: 'transform 0.2s, box-shadow 0.2s' };
const submitBtn = { width: "100%", padding: "16px", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "white", border: "none", borderRadius: "12px", fontWeight: "700", fontSize: "15px", cursor: "pointer", marginTop: "10px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", boxShadow: "0 8px 20px -6px rgba(99, 102, 241, 0.5)", transition: "transform 0.2s, box-shadow 0.2s" };
const outlineBtn = (theme) => ({ padding: "8px 16px", backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", border: `1px solid ${theme.colors.border}`, color: theme.colors.text, borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "600", fontSize: "13px", transition: "all 0.2s ease" });

const thStyle = (theme) => ({ padding: "16px 24px", fontSize: "11px", fontWeight: "700", textTransform: 'uppercase', color: theme.colors.subText, letterSpacing: "0.5px" });
const tdStyle = (theme) => ({ padding: "16px 24px", color: theme.colors.text, fontSize: "14px" });

export default ManageAdmins;