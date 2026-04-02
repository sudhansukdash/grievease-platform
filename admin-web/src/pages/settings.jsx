import React, { useState, useEffect } from "react";
import { useTheme } from "../context/themeContext";
import { auth, db } from "../firebase"; 
import { doc, getDoc } from "firebase/firestore"; 
import { 
  Moon, Sun, Bell, Save, RefreshCw, Monitor, AlertTriangle, Mail, Smartphone
} from "lucide-react";


const Switch = ({ checked, onChange, theme, disabled = false }) => (
  <div 
    onClick={disabled ? null : onChange}
    style={{
      width: "48px", height: "26px", borderRadius: "13px",
      backgroundColor: disabled ? (theme.isDark ? "#334155" : "#e2e8f0") : (checked ? "#6366f1" : theme.colors.border),
      position: "relative", cursor: disabled ? "not-allowed" : "pointer", transition: "background 0.3s ease",
      opacity: disabled ? 0.6 : 1
    }}
  >
    <div style={{
      width: "20px", height: "20px", borderRadius: "50%",
      backgroundColor: "white", position: "absolute", top: "3px",
      left: checked ? "25px" : "3px", transition: "left 0.3s ease",
      boxShadow: "0 2px 4px rgba(0,0,0,0.2)"
    }} />
  </div>
);

const Settings = () => {
  const { isDarkMode, toggleTheme, theme, setIsDirty } = useTheme();
  
  // Initial Values
  const initialDays = localStorage.getItem("escalationDays") || 7;
  const initialEmail = localStorage.getItem("emailNotif") === "true";
  const initialApp = localStorage.getItem("inAppNotif") === "true";

  // State
  const [escalationDays, setEscalationDays] = useState(initialDays);
  const [emailNotif, setEmailNotif] = useState(initialEmail);
  const [inAppNotif, setInAppNotif] = useState(initialApp);
  
  const [isSaved, setIsSaved] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [userRole, setUserRole] = useState(null); 

  useEffect(() => {
    const fetchRole = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const snap = await getDoc(doc(db, "admins", user.uid));
          if (snap.exists()) setUserRole(snap.data().role);
        } catch (e) { console.error(e); }
      }
    };
    fetchRole();
  }, []);

  useEffect(() => {
    const changed = 
      escalationDays != initialDays || 
      emailNotif !== initialEmail || 
      inAppNotif !== initialApp;
    
    setHasChanges(changed);
    setIsDirty(changed); 
    
  }, [escalationDays, emailNotif, inAppNotif, initialDays, initialEmail, initialApp, setIsDirty]);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  const handleSave = () => {
    localStorage.setItem("escalationDays", escalationDays);
    localStorage.setItem("emailNotif", emailNotif);
    localStorage.setItem("inAppNotif", inAppNotif);
    
    setHasChanges(false);
    setIsDirty(false);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div style={{ padding: "30px", maxWidth: "1400px", margin: "0 auto", color: theme.colors.text, fontFamily: "'Inter', sans-serif", display: "flex", flexDirection: "column", minHeight: "100%" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: "30px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "26px", fontWeight: "700" }}>Settings</h2>
          <p style={{ margin: "6px 0 0 0", color: theme.colors.subText, fontSize: "14px" }}>System configuration & preferences</p>
        </div>
        
        <button 
          onClick={handleSave}
          disabled={!hasChanges} 
          style={{
            background: isSaved ? "#10b981" : (hasChanges ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)" : (theme.isDark ? "#1e293b" : "#f8fafc")),
            color: hasChanges || isSaved ? "white" : theme.colors.subText, 
            border: hasChanges || isSaved ? "none" : `1px solid ${theme.colors.border}`,
            padding: "12px 24px", borderRadius: "12px",
            cursor: hasChanges ? "pointer" : "not-allowed", 
            fontWeight: "700", display: "flex", alignItems: "center", gap: "8px", transition: "all 0.2s ease",
            boxShadow: hasChanges ? "0 8px 20px -6px rgba(99, 102, 241, 0.5)" : "none"
          }}
        >
          {isSaved ? <><RefreshCw size={18}/> Saved!</> : <><Save size={18}/> {hasChanges ? "Save Changes" : "No Changes"}</>}
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px", flex: 1 }}>

        {/* 1. APPEARANCE */}
        <div style={styles(theme).rowCard}>
          <div style={styles(theme).iconWrapper}>
            <Monitor size={22} color={theme.isDark ? "#60a5fa" : "#3b82f6"} />
          </div>
          <div style={{ flex: 1 }}>
            <h4 style={styles(theme).title}>Appearance</h4>
            <p style={styles(theme).sub}>Toggle between Dark and Light mode</p>
          </div>
          <button onClick={toggleTheme} style={styles(theme).toggleBtn}>
            {isDarkMode ? <><Moon size={16}/> Dark Mode</> : <><Sun size={16}/> Light Mode</>}
          </button>
        </div>

        {/* 2. ESCALATION MATRIX */}
        {userRole === "PRINCIPAL" && (
          <div style={styles(theme).rowCard}>
            <div style={styles(theme).iconWrapper}>
              <AlertTriangle size={22} color="#f59e0b" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={styles(theme).title}>Escalation Threshold</h4>
              <p style={styles(theme).sub}>Days before a pending ticket turns red in the Daily Report</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <input 
                type="number" 
                value={escalationDays} 
                onChange={(e) => setEscalationDays(e.target.value)}
                style={styles(theme).input}
              />
              <span style={{ fontSize: "14px", color: theme.colors.subText, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.5px" }}>days</span>
            </div>
          </div>
        )}

        {/* 3. REFINED NOTIFICATIONS */}
        <div style={{...styles(theme).rowCard, flexDirection: 'column', alignItems: 'stretch', gap: '0', padding: '0', overflow: 'hidden'}}>
          <div style={{ padding: "24px 32px", borderBottom: `1px solid ${theme.colors.border}`, display: 'flex', gap: '20px', alignItems: 'center', backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc" }}>
             <div style={{...styles(theme).iconWrapper, backgroundColor: theme.isDark ? "rgba(239, 68, 68, 0.15)" : "#fef2f2"}}>
                <Bell size={22} color="#ef4444" />
             </div>
             <div>
                <h4 style={styles(theme).title}>Alert Preferences</h4>
                <p style={styles(theme).sub}>Control how you receive grievance updates</p>
             </div>
          </div>

          <div style={{ padding: "24px 32px", display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${theme.colors.border}` }}>
             <div>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: "6px"}}>
                  <Smartphone size={18} color={theme.isDark ? "#60a5fa" : "#3b82f6"}/>
                  <span style={{fontSize: '15px', fontWeight: '700', color: theme.colors.text}}>Real-Time Dashboard Alerts</span>
                </div>
                <p style={{margin: 0, fontSize: "14px", color: theme.colors.subText, paddingLeft: "30px"}}>
                  Show a visual notification when a new ticket is assigned to you.
                </p>
             </div>
             <Switch checked={inAppNotif} onChange={() => setInAppNotif(!inAppNotif)} theme={theme} />
          </div>

          <div style={{ padding: "24px 32px", display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
             <div>
                <div style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: "6px"}}>
                  <Mail size={18} color={theme.colors.subText}/>
                  <span style={{fontSize: '15px', fontWeight: '700', color: theme.colors.text}}>Email Digest</span>
                  {/* COMING SOON BADGE */}
                  <span style={styles(theme).comingSoonBadge}>COMING SOON</span>
                </div>
                <p style={{margin: 0, fontSize: "14px", color: theme.colors.subText, paddingLeft: "30px"}}>
                  Receive a daily summary of unresolved issues to your official inbox.
                </p>
             </div>
             <Switch checked={false} onChange={() => {}} theme={theme} disabled={true} />
          </div>
        </div>

      </div>

      {/* FOOTER */}
      <div style={styles(theme).footerWrapper}>
        <div style={styles(theme).footerCard}>
          <span>System crafted by</span>
          <a 
            href="https://github.com/sudhansukdash" 
            target="_blank" 
            rel="noopener noreferrer"
            style={styles(theme).devLink}
          >
            sudhansukdash
          </a>
        </div>
      </div>
    </div>
  );
};

const styles = (theme) => ({
  rowCard: {
    display: "flex", alignItems: "center", gap: "24px",
    backgroundColor: theme.colors.card,
    padding: "32px",
    borderRadius: "16px",
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)"
  },
  iconWrapper: {
    width: "50px", height: "50px", borderRadius: "14px",
    backgroundColor: theme.isDark ? "#1e293b" : "#eef2ff",
    display: "flex", alignItems: "center", justifyContent: "center",
    flexShrink: 0
  },
  title: { margin: "0 0 6px 0", fontSize: "16px", fontWeight: "700", color: theme.colors.text },
  sub: { margin: 0, fontSize: "14px", color: theme.colors.subText },
  
  toggleBtn: {
    display: "flex", alignItems: "center", gap: "8px",
    padding: "12px 20px", borderRadius: "12px", border: `1px solid ${theme.colors.border}`, 
    cursor: "pointer", fontSize: "14px", fontWeight: "700",
    backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", color: theme.colors.text,
    transition: "all 0.2s ease"
  },
  input: {
    width: "75px", padding: "12px", borderRadius: "12px", 
    border: `1px solid ${theme.colors.border}`, 
    backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", color: theme.colors.text,
    textAlign: "center", fontSize: "16px", fontWeight: "700", outline: "none",
    transition: "all 0.2s ease"
  },
  comingSoonBadge: {
    backgroundColor: theme.isDark ? "rgba(99, 102, 241, 0.15)" : "#eef2ff",
    color: theme.isDark ? "#818cf8" : "#4f46e5",
    fontSize: "11px",
    padding: "4px 10px",
    borderRadius: "8px",
    fontWeight: "800",
    letterSpacing: "0.5px"
  },
  footerWrapper: {
    marginTop: "auto",
    paddingTop: "50px",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  footerCard: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: theme.colors.card,
    padding: "10px 24px",
    borderRadius: "100px",
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.isDark ? "0 4px 15px rgba(0,0,0,0.15)" : "0 4px 15px rgba(0,0,0,0.03)",
    fontSize: "13px",
    color: theme.colors.subText,
    fontWeight: "500",
  },
  devLink: {
    color: theme.isDark ? "#818cf8" : "#4f46e5",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
    fontWeight: "700",
    letterSpacing: "0.3px",
    transition: "opacity 0.2s ease"
  }
});

export default Settings;