// Only visible to Academic HOD's to approve new students requests
import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    updateDoc,
    getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/themeContext";
import { Search, Inbox, UserCheck, UserX, GraduationCap, CheckCircle } from "lucide-react";

const ApproveRequests = () => {
    const { theme } = useTheme();
    const [requests, setRequests] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [filters, setFilters] = useState({
        year: "ALL",
        search: "",
    });
    const [loading, setLoading] = useState(true);
    const [myDept, setMyDept] = useState(null);
    const [rejectModal, setRejectModal] = useState({
        open: false,
        userId: null,
    });

    const [rejectReason, setRejectReason] = useState("");

    const [successModal, setSuccessModal] = useState({
        open: false,
        message: "",
    });
    const [processing, setProcessing] = useState(false);

    const navigate = useNavigate();
    const BRANCH_LABEL_MAP = {
        IT: "Information Technology",
        EE: "Electrical",
        ME: "Mechanical",
        CE: "Civil",
        ETC: "E&TC",
    };
    const YEAR_LABEL_MAP = {
        "1": "1st Year",
        "2": "2nd Year",
        "3": "3rd Year",
    };

    // Helper for dynamic year colors
    const getYearColor = (year) => {
        switch (String(year)) {
            case "1": return "#3b82f6"; 
            case "2": return "#8b5cf6"; 
            case "3": return "#f59e0b"; 
            default: return theme?.colors?.subText || "#64748b";
        }
    };

    // ROLE GUARD
    useEffect(() => {
        const checkRole = async () => {
            const user = auth.currentUser;
            if (!user) return;

            const snap = await getDoc(doc(db, "admins", user.uid));

            const data = snap.data();

            if (
                !snap.exists() ||
                data.role !== "HOD" ||
                data.department !== "Academic"
            ) {
                navigate("/dashboard");
                return;
            }

            
            if (!data.branchCode) {
                navigate("/dashboard");
                return;
            }

            setMyDept(data.branchCode);
        };

        checkRole();
    }, []);

    // FETCH PENDING USERS
    useEffect(() => {
        if (!myDept) return;

        const q = query(
            collection(db, "students"),
            where("status", "==", "pending"),
            where("branch", "==", myDept)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            
            data.sort((a, b) => {
                return new Date(b.createdAt) - new Date(a.createdAt);
            });

            setRequests(data);
            setFiltered(data);
            setLoading(false);
        });

        return () => unsub();
    }, [myDept]);

    // FILTER LOGIC
    useEffect(() => {
        let temp = [...requests];

        if (filters.year !== "ALL") {
            temp = temp.filter((r) => String(r.year) === filters.year);
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            temp = temp.filter(
                (r) =>
                    r.fullName?.toLowerCase().includes(searchLower) ||
                    r.email?.toLowerCase().includes(searchLower)
            );
        }

        setFiltered(temp);
    }, [filters, requests]);

    // APPROVE
    const handleApprove = async (user) => {
        if (processing) return; // prevent double click
        setProcessing(true);

        try {
            await updateDoc(doc(db, "students", user.id), {
                status: "approved",
            });

            setSuccessModal({
                open: true,
                message: `${user.fullName} has been approved.`,
            });

            setTimeout(() => {
                setSuccessModal({ open: false, message: "" });
            }, 2000);

        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    // REJECT
    const confirmReject = async () => {
        if (processing) return;
        if (!rejectReason.trim()) {
            alert("Please enter a rejection reason");
            return;
        }

        setProcessing(true);

        try {
            await updateDoc(doc(db, "students", rejectModal.userId), {
                status: "rejected",
                remarks: rejectReason,
            });

            setRejectModal({ open: false, userId: null });
            setRejectReason("");

            setSuccessModal({
                open: true,
                message: "Student request has been rejected.",
            });

            setTimeout(() => {
                setSuccessModal({ open: false, message: "" });
            }, 2000);

        } catch (err) {
            console.error(err);
        } finally {
            setProcessing(false);
        }
    };

    if (loading || !theme) {
        return (
            <div style={styles(theme).loading}>
                Loading requests...
            </div>
        );
    }

    return (
        <div style={styles(theme).pageContainer}>

            
            <div style={styles(theme).header}>
                <h2 style={styles(theme).title}>
                    Pending Registrations
                </h2>
                <p style={styles(theme).subTitle}>
                    Review and manage new student account requests
                </p>
            </div>

            <div style={styles(theme).toolbar}>
                <div style={styles(theme).searchBox}>
                    <Search size={16} color={theme.colors.subText} />
                    <input
                        type="text"
                        placeholder="Search name or email..."
                        value={filters.search}
                        onChange={(e) =>
                            setFilters({ ...filters, search: e.target.value })
                        }
                        style={styles(theme).searchInput}
                    />
                </div>

                <select
                    value={filters.year}
                    onChange={(e) =>
                        setFilters({ ...filters, year: e.target.value })
                    }
                    style={styles(theme).select}
                >
                    <option value="ALL">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                </select>
            </div>

            {/* LIST */}
            {filtered.length === 0 ? (
                <div style={styles(theme).emptyWrapper}>
                    <Inbox size={48} color={theme.colors.subText} style={{ opacity: 0.2, marginBottom: '16px' }} />
                    <h3 style={styles(theme).emptyTitle}>No Requests Pending</h3>
                    <p style={styles(theme).emptyText}>
                        All student registrations have been reviewed.
                    </p>
                </div>
            ) : (
                filtered.map((user) => {
                    const initials = user.fullName
                        ? user.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                        : "?";
                    const accentColor = getYearColor(user.year);

                    return (
                        <div key={user.id} style={styles(theme).requestCard(accentColor)}>
                            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                                {/* AVATAR */}
                                <div style={styles(theme).avatar(accentColor)}>
                                    {initials}
                                </div>

                                {/* USER INFO */}
                                <div>
                                    <h4 style={styles(theme).userName}>{user.fullName}</h4>
                                    <p style={styles(theme).userEmail}>{user.email}</p>
                                    
                                    {/* BADGES */}
                                    <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                                        <span style={styles(theme).badge(theme.isDark ? "#1e3a8a" : "#dbeafe", theme.isDark ? "#60a5fa" : "#1e40af")}>
                                            <GraduationCap size={12} style={{ marginRight: "4px" }} />
                                            {BRANCH_LABEL_MAP[user.branch] || user.branch}
                                        </span>
                                        <span style={styles(theme).badge(accentColor + "20", accentColor)}>
                                            {YEAR_LABEL_MAP[user.year] || user.year}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* ACTION BUTTONS */}
                            <div style={styles(theme).btnGroup}>
                                <button
                                    onClick={() => handleApprove(user)}
                                    disabled={processing}
                                    style={styles(theme).approveBtn(processing)}
                                >
                                    <UserCheck size={16} />
                                    Approve
                                </button>

                                <button
                                    onClick={() => setRejectModal({ open: true, userId: user.id })}
                                    disabled={processing}
                                    style={styles(theme).rejectBtn(processing)}
                                >
                                    <UserX size={16} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    );
                })
            )}
            
            {/* INLINE SUCCESS MODAL (Replaced external component) */}
            {successModal.open && (
                <div style={styles(theme).modalOverlay}>
                    <div style={styles(theme).successCard}>
                        <div style={styles(theme).successIconWrapper}>
                            <CheckCircle size={40} color="#10b981" />
                        </div>
                        <h3 style={styles(theme).successTitle}>Success</h3>
                        <p style={styles(theme).successMessage}>{successModal.message}</p>
                    </div>
                </div>
            )}
            
            {/* REJECT MODAL */}
            {rejectModal.open && (
                <div style={styles(theme).modalOverlay}>
                    <div style={styles(theme).modalCard}>
                        <h3 style={styles(theme).modalTitle}>Reject Request</h3>
                        <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: theme.colors.subText }}>
                            Please provide a reason for rejecting this student's registration.
                        </p>
                        <textarea
                            placeholder="Enter rejection reason..."
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            style={styles(theme).modalTextarea}
                        />

                        <div style={styles(theme).modalActions}>
                            <button 
                                onClick={() => setRejectModal({ open: false, userId: null })}
                                style={styles(theme).cancelBtn}
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmReject} 
                                disabled={processing}
                                style={styles(theme).confirmRejectBtn(processing)}
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const styles = (theme) => {
    if (!theme || !theme.colors) return {};
    return {
        pageContainer: {
            padding: "30px",
            maxWidth: "1400px",
            margin: "0 auto",
            fontFamily: "'Inter', sans-serif",
            color: theme.colors.text
        },
        header: {
            marginBottom: "30px"
        },
        title: {
            fontSize: "26px",
            fontWeight: "700",
            margin: 0,
            color: theme.colors.text
        },
        subTitle: {
            marginTop: "6px",
            color: theme.colors.subText,
            fontSize: "14px"
        },
        toolbar: {
            display: "flex",
            gap: "16px",
            marginBottom: "24px"
        },
        searchBox: {
            display: 'flex',
            alignItems: 'center',
            backgroundColor: theme.isDark ? "#1e293b" : theme.colors.card,
            border: `1px solid ${theme.colors.border}`,
            borderRadius: '12px',
            padding: '0 12px',
            flex: 1,
            maxWidth: '400px'
        },
        searchInput: {
            border: 'none',
            padding: '12px',
            width: '100%',
            outline: 'none',
            background: 'transparent',
            color: theme.colors.text
        },
        select: {
            padding: "0 16px",
            height: '46px',
            borderRadius: "12px",
            border: `1px solid ${theme.colors.border}`,
            backgroundColor: theme.isDark ? "#1e293b" : theme.colors.card,
            color: theme.colors.text,
            outline: "none"
        },
        requestCard: (accentColor) => ({
            background: theme.colors.card,
            border: `1px solid ${theme.colors.border}`,
            borderLeft: `4px solid ${accentColor}`,
            borderRadius: "16px",
            padding: "20px",
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
        }),
        avatar: (accentColor) => ({
            width: "48px",
            height: "48px",
            borderRadius: "50%",
            backgroundColor: `${accentColor}15`, // very light tint of the accent
            color: accentColor,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            fontSize: "16px",
            fontWeight: "700",
            border: `1px solid ${accentColor}40`,
            flexShrink: 0
        }),
        userName: {
            margin: 0,
            fontSize: "16px",
            fontWeight: "600",
            color: theme.colors.text
        },
        userEmail: {
            margin: "4px 0",
            color: theme.colors.subText,
            fontSize: "13px"
        },
        badge: (bg, color) => ({
            display: "inline-flex",
            alignItems: "center",
            backgroundColor: bg,
            color: color,
            padding: "4px 8px",
            borderRadius: "6px",
            fontSize: "11px",
            fontWeight: "700",
            letterSpacing: "0.5px",
        }),
        btnGroup: {
            display: "flex",
            gap: "10px"
        },
        approveBtn: (processing) => ({
            background: processing ? (theme.isDark ? "#374151" : "#f3f4f6") : "#10b98115",
            cursor: processing ? "not-allowed" : "pointer",
            color: processing ? theme.colors.subText : "#10b981",
            border: `1px solid ${processing ? "transparent" : "#10b98140"}`,
            padding: "8px 16px",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease"
        }),
        rejectBtn: (processing) => ({
            background: processing ? (theme.isDark ? "#374151" : "#f3f4f6") : "#ef444415",
            cursor: processing ? "not-allowed" : "pointer",
            color: processing ? theme.colors.subText : "#ef4444",
            border: `1px solid ${processing ? "transparent" : "#ef444440"}`,
            padding: "8px 16px",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease"
        }),
        emptyWrapper: {
            padding: "60px 20px",
            textAlign: "center",
            border: `1px solid ${theme.colors.border}`,
            borderRadius: "16px",
            background: theme.colors.card,
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
        },
        emptyTitle: {
            margin: '0 0 8px 0',
            fontSize: '18px',
            color: theme.colors.text
        },
        emptyText: {
            color: theme.colors.subText,
            margin: 0,
            fontSize: "14px"
        },
        modalOverlay: {
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 999
        },
        modalCard: {
            background: theme.colors.card,
            padding: "24px",
            borderRadius: "16px",
            width: "360px",
            border: `1px solid ${theme.colors.border}`,
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)"
        },
        successCard: {
            background: theme.colors.card,
            padding: "30px",
            borderRadius: "16px",
            width: "320px",
            textAlign: "center",
            border: `1px solid ${theme.colors.border}`,
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center"
        },
        successIconWrapper: {
            width: "64px",
            height: "64px",
            borderRadius: "50%",
            background: "#10b98115",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "16px"
        },
        successTitle: {
            margin: "0 0 8px 0",
            fontSize: "20px",
            fontWeight: "700",
            color: theme.colors.text
        },
        successMessage: {
            margin: 0,
            fontSize: "14px",
            color: theme.colors.subText
        },
        modalTitle: {
            margin: "0 0 8px 0",
            fontSize: "18px",
            fontWeight: "700",
            color: theme.colors.text
        },
        modalTextarea: {
            width: "100%",
            minHeight: "100px",
            padding: "12px",
            borderRadius: "12px",
            border: `1px solid ${theme.colors.border}`,
            background: theme.isDark ? "#1e293b" : "#f8fafc",
            color: theme.colors.text,
            outline: "none",
            resize: "vertical",
            fontFamily: "inherit",
            boxSizing: "border-box",
            fontSize: "14px"
        },
        modalActions: {
            marginTop: "20px",
            display: "flex",
            gap: "12px",
            justifyContent: "flex-end"
        },
        cancelBtn: {
            background: "transparent",
            border: `1px solid ${theme.colors.border}`,
            color: theme.colors.text,
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "13px"
        },
        confirmRejectBtn: (processing) => ({
            background: processing ? "#9ca3af" : "#ef4444",
            border: "none",
            color: "#fff",
            padding: "8px 16px",
            borderRadius: "8px",
            cursor: processing ? "not-allowed" : "pointer",
            fontWeight: "600",
            fontSize: "13px"
        }),
        loading: {
            padding: "50px",
            textAlign: "center",
            color: theme?.colors?.subText || "#64748b",
            fontSize: "16px",
            fontWeight: "500",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh"
        }
    };
};

export default ApproveRequests;