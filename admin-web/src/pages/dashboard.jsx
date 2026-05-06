// Dashboard based on RBAC, users view according to their roles
import React, { useEffect, useState, useMemo, useRef } from "react";
import { db, auth } from "../firebase";
import { collection, query, orderBy, doc, where, getDoc, onSnapshot } from "firebase/firestore";
import { format, differenceInDays } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/themeContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';
import {
  LayoutDashboard, AlertCircle, CheckCircle, Clock,
  Search, TrendingUp, Bell, ShieldAlert, User, ChevronRight, FileText, Ghost, Inbox, RefreshCw
} from 'lucide-react';

const APP_CATEGORIES = ["Academic", "Hostel", "Canteen", "Sports", "Parking", "Other"];

// --- HELPER COMPONENTS ---
const StatusBadge = ({ status }) => {
  const upperStatus = status ? status.toUpperCase() : "UNKNOWN";
  let bg = "#f1f5f9", color = "#475569";
  if (upperStatus === "RESOLVED") { bg = "#dcfce7"; color = "#166534"; }
  else if (upperStatus === "REJECTED") { bg = "#fee2e2"; color = "#991b1b"; }
  else if (["IN_PROGRESS", "ASSIGNED", "ACKNOWLEDGED"].includes(upperStatus)) { bg = "#dbeafe"; color = "#1e40af"; }
  else if (["PENDING", "OPEN", "ON_HOLD"].includes(upperStatus)) { bg = "#fef3c7"; color = "#b45309"; }

  return (
    <span style={{ backgroundColor: bg, color: color, padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', display: 'inline-block', minWidth: '85px', textAlign: 'center' }}>
      {upperStatus}
    </span>
  );
};

const KPICard = ({ title, value, icon: Icon, color, subtext, alert, onClick, theme, isActive }) => (
  <div
    onClick={onClick}
    style={{
      ...styles(theme).statCard,
      borderLeft: `4px solid ${color}`,
      cursor: onClick ? 'pointer' : 'default',
      border: isActive ? `2px solid ${color}` : `1px solid ${theme.colors.border}`,
      borderLeftWidth: '4px'
    }}
  >
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div>
        <p style={styles(theme).statLabel}>{title}</p>
        <h3 style={{ ...styles(theme).statNumber, color: theme.colors.text }}>{value}</h3>
      </div>
      <div style={{ ...styles(theme).iconBox, backgroundColor: `${color}20`, color: color }}>
        <Icon size={20} />
      </div>
    </div>

    {subtext && <p style={styles(theme).statSubtext}>{subtext}</p>}
    {alert && (
      <div style={{ ...styles(theme).statSubtext, color: color, opacity: 1, fontWeight: '600' }}>
        <AlertCircle size={12} /> {alert}
      </div>
    )}
  </div>
);

// --- MAIN DASHBOARD COMPONENT ---
const Dashboard = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [grievances, setGrievances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adminProfile, setAdminProfile] = useState(null);

  const escalationThreshold = Number(localStorage.getItem("escalationDays")) || 7;
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const notifRef = useRef(null);

  const [filters, setFilters] = useState({ date: "", category: "ALL", status: "ALL", search: "" });

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) setShowNotif(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


  useEffect(() => {
    let unsubscribeSnapshot = () => { };
    let unsubscribeProfile = () => { };

    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const adminRef = doc(db, "admins", user.uid);


          unsubscribeProfile = onSnapshot(adminRef, async (adminSnap) => {
            if (!adminSnap.exists() || adminSnap.data().isActive === false) {

              await auth.signOut();
              navigate("/");
              return;
            }

            setAdminProfile(adminSnap.data());

            const complaintsRef = collection(db, "complaints");
            // HODs must see tickets based on Routing (assignedTo/involved) 
            // NOT based on the Student's original Category.
            // Query by current routing, not original category
            let q;
            if (adminSnap.data().role === "PRINCIPAL") {
              q = query(complaintsRef, orderBy("createdAt", "desc"));
            } else {
              const myRoleTitle = adminSnap.data().roleTitle;

q = query(
  complaintsRef,
  where("assignedTo", "==", myRoleTitle), 
  orderBy("createdAt", "desc")
);
            }

            // Catch snapshot errors
            unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
              const data = snapshot.docs.map(doc => ({
                id: doc.id, ...doc.data(), createdDate: doc.data().createdAt?.toDate() || new Date()
              }));
              setGrievances(data);

              // Notifications should respect the role too! 
              const alerts = data.filter(g => {
                if (adminSnap.data().role === "PRINCIPAL") {
                  return ["Pending", "OPEN"].includes(g.status);
                }
                // Only alert if it is specifically assigned to their exact designation
                return g.assignedTo === adminSnap.data().roleTitle &&
                  !["RESOLVED", "REJECTED", "OPEN", "Pending"].includes(g.status);
              }).slice(0, 5);

              setNotifications(alerts);
              setLoading(false);
            }, (error) => {
              console.error("Firestore Snapshot Error (Check Indexes!):", error);
              setLoading(false);
            });

          });

        } catch (error) {
          console.error("Init error:", error);
          setLoading(false);
        }
      } else {
        // Not logged in
        navigate("/");
      }
    });

    return () => {
      unsubscribeSnapshot();
      unsubscribeProfile();
      unsubscribeAuth();
    };
  }, [navigate]);

  const dashboardData = useMemo(() => {

    if (!grievances || !adminProfile) {
      return {
        filtered: [],
        stats: { total: 0, pending: 0, resolved: 0, critical: 0, today: 0 },
        deptData: [],
        statusData: [],
        allActiveCategories: []
      };
    }

   const roleAllowedGrievances = grievances.filter(g => {
  if (adminProfile?.role === "PRINCIPAL") return true;

  // hide untriaged
  if (g.status === "OPEN" || g.status === "Pending") return false;

  
  return g.assignedTo === adminProfile?.roleTitle;
});

    const uniqueCategoriesInDB = [...new Set(roleAllowedGrievances.map(g => g.category))].filter(Boolean);
    const allActiveCategories = [...new Set([...APP_CATEGORIES, ...uniqueCategoriesInDB])];

    const filtered = roleAllowedGrievances.filter(g => {
      const matchDate = filters.date ? format(g.createdDate, 'yyyy-MM-dd') === filters.date : true;
      const matchCat = filters.category !== "ALL" ? (g.assignedDepartment || g.category) === filters.category : true;

      let matchStatus = true;
      if (filters.status === "PENDING_ACTION") matchStatus = !["RESOLVED", "REJECTED"].includes(g.status);
      else if (filters.status === "RESOLVED") matchStatus = ["RESOLVED", "REJECTED"].includes(g.status);
      else if (filters.status === "CRITICAL") matchStatus = !["RESOLVED", "REJECTED"].includes(g.status) && differenceInDays(new Date(), g.createdDate) > escalationThreshold;
      else if (filters.status !== "ALL") matchStatus = g.status === filters.status;

      const searchLower = filters.search.toLowerCase();

      const matchSearch = filters.search
        ? (
          g.title.toLowerCase().includes(searchLower) ||
          g.id.toLowerCase().includes(searchLower) ||
          (!g.isAnonymous && g.studentName && g.studentName.toLowerCase().includes(searchLower))
        )
        : true;

      // hodGuard is removed from here because we already filtered it at the very top!
      return matchDate && matchCat && matchStatus && matchSearch;
    });

    // Calculate stats using the allowed grievances, NOT the raw database snapshot
    const stats = {
      total: roleAllowedGrievances.length,
      pending: roleAllowedGrievances.filter(g => !["RESOLVED", "REJECTED"].includes(g.status)).length,
      resolved: roleAllowedGrievances.filter(g => ["RESOLVED", "REJECTED"].includes(g.status)).length,
      critical: roleAllowedGrievances.filter(g => !["RESOLVED", "REJECTED"].includes(g.status) && differenceInDays(new Date(), g.createdDate) > escalationThreshold).length,
      today: roleAllowedGrievances.filter(g => differenceInDays(new Date(), g.createdDate) === 0).length
    };

    const deptData = allActiveCategories.map(d => ({ name: d, count: roleAllowedGrievances.filter(g => (g.assignedDepartment || g.category) === d && !["RESOLVED", "REJECTED"].includes(g.status)).length })).filter(d => d.count > 0).sort((a, b) => b.count - a.count);
    const statusData = [{ name: 'Pending', value: stats.pending, color: '#f59e0b' }, { name: 'Resolved', value: stats.resolved, color: '#10b981' }, { name: 'Escalated', value: stats.critical, color: '#ef4444' }];

    return { filtered, stats, deptData, statusData, allActiveCategories };
  }, [grievances, filters, adminProfile, escalationThreshold]);

  const handleViewDetails = (ticket) => {
    setNotifications(prev => prev.filter(n => n.id !== ticket.id));
    navigate(`/manage-ticket/${ticket.id}`);
  };

  const clearFilters = () => setFilters({ date: "", category: "ALL", status: "ALL", search: "" });

  // The Data Loader (Waits for Firebase to connect)
  if (loading || !theme) {
    return (
      <div style={{ ...styles(theme).center, flexDirection: 'column', gap: '16px' }}>
        <RefreshCw size={32} color={theme?.colors?.primary || "#3b82f6"} className="spin-animation" />
        <div style={{ fontSize: "16px", fontWeight: "600", color: theme?.colors?.text }}>
          Syncing Database...
        </div>
      </div>
    );
  }

  if (!adminProfile) {
    return (
      <div style={styles(theme).center}>
        <div style={{ fontSize: "15px", fontWeight: "500", color: theme?.colors?.subText }}>
          Verifying Admin Credentials...
        </div>
      </div>
    );
  }

  return (
    <div style={styles(theme).pageContainer}>

      <div style={styles(theme).header}>
        <div>
          <h2 style={styles(theme).welcomeTitle}>
            Welcome back, {adminProfile?.name || adminProfile?.fullName || (adminProfile?.role === "PRINCIPAL" ? "Principal" : "Admin")}
          </h2>
          <p style={styles(theme).welcomeSub}>Here is the current overview of campus grievances and resolution performance.</p>
        </div>

        <div style={{ position: "relative" }} ref={notifRef}>
          <button onClick={() => setShowNotif(!showNotif)} style={styles(theme).iconBtn}>
            <Bell size={20} />
            {notifications.length > 0 && <span style={styles(theme).notifDot}></span>}
          </button>

          {showNotif && (
            <div style={styles(theme).notifDropdown}>
              <div style={styles(theme).notifHeader}>
                <h4 style={{ margin: 0, fontSize: "13px", fontWeight: '700', color: theme.colors.text }}>Notifications</h4>
                <span style={{ fontSize: '11px', color: theme.colors.subText }}>{notifications.length} Actionable</span>
              </div>
              {notifications.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center' }}>
                  <CheckCircle size={24} color="#10b981" style={{ marginBottom: '8px', opacity: 0.6 }} />
                  <p style={{ fontSize: "12px", color: theme.colors.subText, margin: 0 }}>You're all caught up!</p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <div key={i} onClick={() => { setShowNotif(false); handleViewDetails(n); }} style={styles(theme).notifItem}>
                    <div style={styles(theme).notifIcon}><FileText size={16} /></div>
                    <div style={{ flex: 1 }}>
                      <div style={styles(theme).notifTitle}>{n.title}</div>
                      <div style={styles(theme).notifMeta}>{n.isAnonymous ? "Identity Hidden" : n.studentName} • {n.category}</div>
                      <div style={styles(theme).notifTime}><Clock size={10} /> {format(n.createdDate, 'MMM dd')}</div>
                    </div>
                    <ChevronRight size={14} color={theme.colors.subText} style={{ opacity: 0.5, marginTop: '4px' }} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <div style={styles(theme).statsGrid}>
        <KPICard title="Total Grievances" value={dashboardData.stats.total} icon={LayoutDashboard} color="#3b82f6" subtext={`${dashboardData.stats.today} registered today`} onClick={() => setFilters({ ...filters, status: 'ALL' })} isActive={filters.status === 'ALL'} theme={theme} />
        <KPICard title="Action Required" value={dashboardData.stats.pending} icon={Clock} color="#f59e0b" subtext="Awaiting review" onClick={() => setFilters({ ...filters, status: 'PENDING_ACTION' })} isActive={filters.status === 'PENDING_ACTION'} theme={theme} />
        <KPICard title="Escalated Cases" value={dashboardData.stats.critical} icon={ShieldAlert} color="#ef4444" alert={dashboardData.stats.critical > 0 ? "Immediate action needed" : null} onClick={() => setFilters({ ...filters, status: 'CRITICAL' })} isActive={filters.status === 'CRITICAL'} theme={theme} />
        <KPICard title="Resolved Cases" value={dashboardData.stats.resolved} icon={CheckCircle} color="#10b981" onClick={() => setFilters({ ...filters, status: 'RESOLVED' })} isActive={filters.status === 'RESOLVED'} theme={theme} />
      </div>

      <div style={styles(theme).chartSection}>
        <div style={styles(theme).chartCard}>
          <h4 style={styles(theme).chartTitle}>Grievance Status Overview</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={dashboardData.statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                {dashboardData.statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
              </Pie>
              <RechartsTooltip contentStyle={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        {adminProfile?.role === "PRINCIPAL" && (
          <div style={styles(theme).chartCard}>
            <h4 style={styles(theme).chartTitle}>Pending Grievances by Department</h4>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dashboardData.deptData}>
                <XAxis dataKey="name" fontSize={10} interval={0} stroke={theme.colors.subText} />
                <YAxis
                  allowDecimals={false}
                  fontSize={10}
                  stroke={theme.colors.subText}
                  domain={[0, 'dataMax']}
                  ticks={[0, 1, 2, 3]}
                />
                <RechartsTooltip cursor={{ fill: theme.colors.hover }} contentStyle={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, color: theme.colors.text }} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div style={styles(theme).toolbar}>
        <div style={styles(theme).searchBox}>
          <Search size={16} color={theme.colors.subText} />
          <input type="text" placeholder="Search grievances by ID, title, or student name..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} style={styles(theme).searchInput} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {adminProfile?.role === "PRINCIPAL" && (
            <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })} style={styles(theme).select}>
              <option value="ALL">All Departments / Categories</option>
              {dashboardData.allActiveCategories.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
          <button onClick={clearFilters} style={styles(theme).resetBtn}>Clear Filters</button>
        </div>
      </div>

      <div style={styles(theme).tableContainer}>
        <div style={styles(theme).tableWrapper}>
          <table style={styles(theme).table}>
            <thead>
              <tr style={styles(theme).tableHeaderRow}>
                <th style={styles(theme).th}>Grievance Title</th>
                <th style={styles(theme).th}>Category</th>
                <th style={styles(theme).th}>Location / Area</th>
                <th style={styles(theme).th}>Date Logged</th>
                <th style={styles(theme).th}>Current Status</th>
                <th style={styles(theme).th}>Aging / Escalation</th>
                <th style={styles(theme).th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              
              {dashboardData.filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" style={styles(theme).emptyTd}>
                    <div style={styles(theme).emptyWrapper}>
                      <Inbox size={48} color={theme.colors.subText} style={{ opacity: 0.2, marginBottom: '16px' }} />
                      <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: theme.colors.text }}>No grievances found</h3>
                      <p style={{ margin: '0 0 20px 0', color: theme.colors.subText, fontSize: '14px' }}>
                        There are no grievance records matching your selected filters.
                      </p>
                      <button onClick={clearFilters} style={styles(theme).emptyResetBtn}>
                        Clear all filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                dashboardData.filtered.map(g => {
                  const daysOld = differenceInDays(new Date(), g.createdDate);
                  const isCritical = daysOld > escalationThreshold && !["RESOLVED", "REJECTED"].includes(g.status);

                  return (
                    <tr
                      key={g.id}
                      style={{
                        ...styles(theme).tableRow,
                        ...(isCritical ? styles(theme).escalatedRow : {})
                      }}
                    >
                      <td style={styles(theme).td}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{ fontWeight: '600', color: theme.colors.text }}>{g.title}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={styles(theme).idBadge}>#{g.id.slice(-6).toUpperCase()}</span>
                            {g.isAnonymous && <Ghost size={14} color={theme.colors.subText} />}
                          </div>
                        </div>
                      </td>
                      <td style={styles(theme).td}>{g.category}</td>
                      <td style={{ ...styles(theme).td, maxWidth: '150px', fontSize: '13px' }}>{g.departmentLocation || "-"}</td>
                      <td style={styles(theme).td}>{format(g.createdDate, 'MMM dd, yyyy')}</td>
                      <td style={styles(theme).td}><StatusBadge status={g.status} /></td>
                      <td style={{
                        ...styles(theme).td,
                        ...(isCritical ? styles(theme).escalationText : {})
                      }}>
                        {isCritical ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <TrendingUp size={12} /> {daysOld} days
                          </div>
                        ) : "-"}
                      </td>
                      <td style={styles(theme).td}>
                        <button onClick={() => handleViewDetails(g)} style={styles(theme).actionBtn}>Review Case</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const styles = (theme) => {
  if (!theme || !theme.colors) return {};
  return {
    pageContainer: { minHeight: "100%", backgroundColor: "transparent", fontFamily: "'Inter', sans-serif" },
    header: { marginBottom: "30px", display: "flex", justifyContent: "space-between", alignItems: "end", color: theme.colors.text },
    welcomeTitle: { fontSize: "26px", fontWeight: "700", color: theme.colors.text, margin: 0 },
    welcomeSub: { fontSize: "14px", color: theme.colors.subText, marginTop: "4px" },
    statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "24px", marginBottom: "32px" },

    statCard: {
      backgroundColor: theme.colors.card,
      padding: "20px",
      borderRadius: "16px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
      color: theme.colors.text,
      border: `1px solid ${theme.colors.border}`
    },
    statLabel: { margin: 0, color: theme.colors.subText, fontSize: "12px", fontWeight: "600", textTransform: 'uppercase' },
    statNumber: { fontSize: "32px", margin: "6px 0 0 0", fontWeight: "700", color: theme.colors.text },

    statSubtext: {
      fontSize: "11px",
      color: theme.colors.subText,
      marginTop: "6px",
      fontWeight: "400",
      opacity: 0.7,
      display: 'flex',
      alignItems: 'center',
      gap: '4px'
    },

    iconBox: { padding: '10px', borderRadius: '10px' },

    chartSection: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(400px, 1fr))", gap: "24px", marginBottom: "32px" },
    chartCard: {
      backgroundColor: theme.colors.card,
      padding: "24px",
      borderRadius: "16px",
      color: theme.colors.text,
      border: `1px solid ${theme.colors.border}`
    },
    chartTitle: { margin: "0 0 20px 0", fontSize: "16px", fontWeight: "600" },

    toolbar: { display: "flex", gap: "16px", marginBottom: "24px", justifyContent: 'space-between' },
    searchBox: {
      display: 'flex',
      alignItems: 'center',
      backgroundColor: theme.isDark ? "#1e293b" : theme.colors.card,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: '12px',
      padding: '0 12px',
      width: '320px'
    },
    searchInput: { border: 'none', padding: '12px', width: '100%', outline: 'none', background: 'transparent', color: theme.colors.text },
    select: {
      padding: "0 16px",
      height: '46px',
      borderRadius: "12px",
      border: `1px solid ${theme.colors.border}`,
      backgroundColor: theme.isDark ? "#1e293b" : theme.colors.card,
      color: theme.colors.text
    },

    tableContainer: { backgroundColor: theme.colors.card, borderRadius: "16px", border: `1px solid ${theme.colors.border}`, overflow: 'hidden' },
    tableWrapper: { overflowX: "auto" },
    table: { width: "100%", borderCollapse: "collapse" },
    tableRow: { borderBottom: `1px solid ${theme.colors.border}` },
    tableHeaderRow: { backgroundColor: theme.isDark ? '#1e293b' : '#f8fafc' },
    th: { padding: "16px 24px", textAlign: "left", fontSize: "11px", color: theme.colors.subText, textTransform: "uppercase", fontWeight: "700" },
    td: { padding: "16px 24px", fontSize: "14px", color: theme.colors.text },

    // EMPTY STATE
    emptyTd: { padding: '80px 0', textAlign: 'center' },
    emptyWrapper: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    emptyResetBtn: {
      background: 'none',
      border: 'none',
      color: theme.isDark ? '#60a5fa' : '#2563eb',
      fontSize: '14px',
      fontWeight: '600',
      cursor: 'pointer',
      marginTop: '10px',
      textDecoration: 'underline'
    },

    // ESCALATION STYLES
    escalatedRow: {
      backgroundColor: theme.isDark ? "rgba(220, 38, 38, 0.15)" : "#FEF2F2",
    },
    escalationText: {
      color: "#ef4444",
      fontWeight: "700"
    },
    escalationBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700' },

    idBadge: {
      fontSize: '11px',
      fontFamily: 'monospace',
      color: theme.isDark ? "#60a5fa" : theme.colors.subText,
      backgroundColor: theme.isDark ? "#0f172a" : theme.colors.bg,
      padding: '2px 6px',
      borderRadius: '4px',
      border: `1px solid ${theme.colors.border}`
    },

    actionBtn: {
      backgroundColor: theme.isDark ? "#1e293b" : theme.colors.bg,
      border: `1px solid ${theme.colors.border}`,
      color: theme.colors.text,
      padding: '8px 16px',
      borderRadius: '8px',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '600'
    },
    resetBtn: { padding: "10px 16px", borderRadius: "10px", border: `1px solid ${theme.colors.border}`, cursor: "pointer", backgroundColor: theme.colors.card, color: theme.colors.text },
    iconBtn: { background: theme.colors.card, border: `1px solid ${theme.colors.border}`, cursor: "pointer", padding: "10px", borderRadius: "12px", color: theme.colors.text, position: 'relative' },
    notifDot: { position: "absolute", top: 8, right: 10, width: "8px", height: "8px", backgroundColor: "#ef4444", borderRadius: "50%" },

    // RESERVED NOTIFICATION DROPDOWN
    notifDropdown: { position: "absolute", right: 0, top: "55px", width: "360px", backgroundColor: theme.colors.card, border: `1px solid ${theme.colors.border}`, borderRadius: "16px", boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)", zIndex: 100, overflow: 'hidden' },
    notifHeader: { padding: '16px', borderBottom: `1px solid ${theme.colors.border}`, backgroundColor: theme.isDark ? '#1e293b' : '#F8FAFC' },
    notifItem: { padding: "16px", borderBottom: `1px solid ${theme.colors.border}`, cursor: 'pointer', display: 'flex', gap: '12px', alignItems: 'start' },
    notifIcon: { width: '32px', height: '32px', borderRadius: '8px', backgroundColor: theme.isDark ? '#1e293b' : '#EFF6FF', color: '#3B82F6', display: 'flex', alignItems: 'center', justifyContent: 'center' },
    notifTitle: { fontWeight: '600', fontSize: '13px', color: theme.colors.text },
    notifMeta: { fontSize: '11px', color: theme.colors.subText },
    notifTime: { fontSize: '10px', color: theme.colors.subText, marginTop: '6px' },

    center: { display: "flex", justifyContent: "center", alignItems: "center", height: "100vh", color: theme.colors.subText }
  };
};

export default Dashboard;