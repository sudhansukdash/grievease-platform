import { useState, useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useTheme } from "../context/themeContext";
import { LayoutDashboard, Users, BarChart3, Settings, LogOut, Menu, X, ShieldAlert } from "lucide-react";
import { auth, db } from "../firebase";
import { collection, query, where, onSnapshot, doc, getDoc } from "firebase/firestore";

const Layout = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [notifications, setNotifications] = useState([]);

  const [userRole, setUserRole] = useState(null);
  const [userBranchCode, setUserBranchCode] = useState(null);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const { theme, isDirty, setIsDirty } = useTheme();

  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Notifications
    const q = query(collection(db, "complaints"), where("status", "==", "OPEN"));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => d.data()));
    });

    const fetchRole = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const snap = await getDoc(doc(db, "admins", user.uid));
          if (snap.exists()) {
  const data = snap.data();
  setUserRole(data.role);
  setUserBranchCode(data.branchCode); 
}
        } catch (e) { console.error(e); }
      }
    };
    fetchRole();

    return () => unsub();
  }, []);

  const handleNavigation = (path) => {
    if (location.pathname === path) return;
    if (isDirty) {
      if (!window.confirm("You have unsaved changes in Settings. Leave anyway?")) return;
      setIsDirty(false);
    }
    navigate(path);
  };


  const handleLogoutClick = () => {

    if (isDirty) {
      if (!window.confirm("You have unsaved changes. Logout anyway?")) return;
      setIsDirty(false);
    }
    // Show custom modal
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    auth.signOut();
    navigate("/");
  };

  // RESTRICTED ACCOUNTS
  const menuItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Reports", path: "/reports", icon: BarChart3 },
    { name: "Members", path: "/manage-admins", icon: Users },
    { name: "Restricted Accounts", path: "/blocked-students", icon: ShieldAlert },
    { name: "Approve Requests", path: "/approve", icon: Users },
    { name: "Settings", path: "/settings", icon: Settings },
    
  ];

  return (
    <div style={{ display: "flex", height: "100vh", width: "100vw", backgroundColor: theme.colors.bg, overflow: "hidden" }}>

      {/* SIDEBAR */}
      <div style={{
        width: isOpen ? "260px" : "80px", height: "100%", backgroundColor: theme.colors.card,
        borderRight: `1px solid ${theme.colors.border}`, display: "flex", flexDirection: "column",
        transition: "width 0.3s ease", flexShrink: 0, zIndex: 20
      }}>
        <div style={{ display: "flex", alignItems: "center", padding: "20px 32px", gap: "15px", minHeight: "70px" }}>
          <button onClick={() => setIsOpen(!isOpen)} style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 0, background: "none", border: "none", color: theme.colors.text, cursor: "pointer" }}>
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          {isOpen && <h3 style={{ margin: 0, color: "#475569", fontSize: "18px", fontWeight: "600", lineHeight: 1, display: "flex", alignItems: "center" }}>Navigate</h3>}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "10px", padding: "0 20px", overflowY: "auto" }}>
          {menuItems.map((item) => {
            // Hide Members + Restricted Accounts if not Principal
            if ((item.name === "Members" || item.name === "Restricted Accounts") && userRole !== "PRINCIPAL") return null;

            // Hide Approve Requests if NOT HOD
            if (item.name === "Approve Requests" && (!userBranchCode || userRole !== "HOD")) return null;

            const isActive = location.pathname === item.path;
            return (
              <div key={item.path}
                onClick={() => handleNavigation(item.path)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: isOpen ? "flex-start" : "center", gap: isOpen ? "15px" : "0", padding: "12px", borderRadius: "8px", cursor: "pointer",
                  backgroundColor: isActive ? theme.colors.active : "transparent",
                  color: isActive ? "#fff" : theme.colors.text,
                  whiteSpace: "nowrap", flexShrink: 0
                }}
              >
                <item.icon size={20} style={{ flexShrink: 0 }} />
                {isOpen && <span>{item.name}</span>}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "20px" }}>
          <button onClick={handleLogoutClick} style={{ display: "flex", alignItems: "center", justifyContent: isOpen ? "flex-start" : "center", gap: isOpen ? "15px" : "0", padding: "12px", background: "none", border: "none", color: "#ef4444", cursor: "pointer", width: "100%" }}>
            <LogOut size={20} style={{ flexShrink: 0 }} />
            {isOpen && <span>Logout</span>}
          </button>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{ flex: 1, height: "100%", overflowY: "auto", position: "relative" }}>
        <div style={{ padding: "30px", minHeight: "100%" }}>
          <Outlet />
        </div>
      </div>

      {showLogoutModal && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 100,
          backdropFilter: "blur(3px)"
        }}>
          <div style={{
            backgroundColor: theme.colors.card, width: "320px", padding: "25px", borderRadius: "16px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)", border: `1px solid ${theme.colors.border}`,
            textAlign: "center"
          }}>
            <h3 style={{ margin: "0 0 10px 0", color: theme.colors.text }}>Sign Out</h3>
            <p style={{ margin: "0 0 25px 0", color: theme.colors.subText, fontSize: "14px" }}>
              Are you sure you want to end your session?
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1, padding: "10px", borderRadius: "8px", border: `1px solid ${theme.colors.border}`,
                  backgroundColor: "transparent", color: theme.colors.text, cursor: "pointer", fontWeight: "600"
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                style={{
                  flex: 1, padding: "10px", borderRadius: "8px", border: "none",
                  backgroundColor: "#ef4444", color: "white", cursor: "pointer", fontWeight: "600"
                }}
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Layout;