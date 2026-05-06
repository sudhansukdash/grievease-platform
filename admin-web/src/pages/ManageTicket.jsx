import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { useTheme } from "../context/themeContext";
import { Calendar, MapPin, Send, Tag, ShieldCheck, Clock, Ban, CheckCircle, ArrowRight } from "lucide-react";
import { format } from "date-fns";

const DEPARTMENT_MAP = {
  "Academic": ["HOD - IT", "HOD - Electrical", "HOD - Mechanical", "HOD - Civil", "HOD - E&TC"],
  "Hostel": ["Superintendent (Boys Hostel)", "Superintendent (Girls Hostel)"],
  "Canteen": ["Canteen Manager"],
  "Sports": ["Physical Director"],
  "Parking": ["Security In-charge"],
  "Other": ["Librarian", "General Coordinator"]
};

const STATUS_OPTIONS = ["IN_PROGRESS", "ON_HOLD", "RESOLVED", "REJECTED"];
const CATEGORIES = Object.keys(DEPARTMENT_MAP);

const getStudentState = (status) => {
  const s = status ? status.toLowerCase().trim().replace(/[-_]/g, " ") : "";
  if (["resolved", "completed"].includes(s)) return "Resolved";
  if (["rejected", "closed"].includes(s)) return "Rejected";
  if (["assigned", "in progress", "inprogress", "on hold"].includes(s)) return "In Progress";
  if (["open", "pending", "new"].includes(s)) return "Pending";
  return "Pending";
};

const sendPushNotification = async (expoPushToken, messageBody, ticketTitle, ticketId) => {
  if (!expoPushToken) {
    console.warn("⚠️ Push blocked: No Expo Push Token provided!");
    return;
  }

  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // Send the raw data to Vercel so it can build the message on the backend
      body: JSON.stringify({
        expoPushToken: expoPushToken,
        messageBody: messageBody,
        ticketTitle: ticketTitle,
        ticketId: ticketId
      }),
    });

    const responseData = await response.json();

    // Log the success or failure from Vercel
    if (!response.ok) {
      console.error("❌ Vercel API Error:", responseData);
    } else {
      console.log("✅ Push notification sent successfully via Vercel:", responseData);
    }
  } catch (error) {
    console.error("❌ Network error reaching Vercel API:", error);
  }
};

const ManageTicket = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const [ticket, setTicket] = useState(null);
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  const [currentAdminName, setCurrentAdminName] = useState("");
  const [currentAdminRole, setCurrentAdminRole] = useState("");
  const [currentAdminRoleTitle, setCurrentAdminRoleTitle] = useState(""); // Tracks specific HOD

  const [assignedDepartment, setAssignedDepartment] = useState(""); // Replaces 'category'
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("");
const [remarks, setRemarks] = useState("");
const [spamReason, setSpamReason] = useState(""); // NEW SPAM STATE
const [modalConfig, setModalConfig] = useState({ 
  visible: false, title: "", message: "", isConfirm: false, isError: false, isSpamPrompt: false, onConfirm: null 
});  const displayId = `#${id?.slice(-6).toUpperCase()}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          const adminSnap = await getDoc(doc(db, "admins", user.uid));
          if (adminSnap.exists()) {
            const adminData = adminSnap.data();
            setCurrentAdminName(adminData.name || "Principal");
            setCurrentAdminRole(adminData.role || "HOD");
            setCurrentAdminRoleTitle(adminData.roleTitle || "PRINCIPAL");
          }
        }

        const ticketSnap = await getDoc(doc(db, "complaints", id));
        if (ticketSnap.exists()) {
          const data = ticketSnap.data();
          setTicket(data);
          setAssignedDepartment(data.assignedDepartment || data.category || "Other"); // Fallback for old tickets
          setAssignedTo(data.assignedTo || "");
          setStatus(data.status || "OPEN");

          // Fetch student data for background penalties, regardless of anonymity
          if (data.studentId) {
            const studentSnap = await getDoc(doc(db, "students", data.studentId));
            if (studentSnap.exists()) setStudent(studentSnap.data());
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  const getStatusTheme = (currentStatus) => {
    const upperStatus = (currentStatus || "").toUpperCase();
    if (upperStatus === "RESOLVED") return { bg: "#dcfce7", color: "#166534" };
    if (upperStatus === "REJECTED") return { bg: "#fee2e2", color: "#991b1b" };
    if (["IN_PROGRESS", "ASSIGNED", "ACKNOWLEDGED"].includes(upperStatus)) return { bg: "#dbeafe", color: "#1e40af" };
    return { bg: "#fef3c7", color: "#b45309" };
  };

  const handleForward = async () => {
    if (!assignedTo) {
      setModalConfig({
        visible: true,
        title: "Select Assignee",
        message: "Please select a person before forwarding.",
        isConfirm: false,
        isError: true,
      });
      return;
    }
    let finalStatus = status;
    if (finalStatus === "OPEN") finalStatus = "IN_PROGRESS";

    let actionText = "";
    if (assignedTo && assignedTo !== ticket.assignedTo) {
      actionText = `Forwarded to ${assignedTo} & Status set to ${finalStatus.replace(/_/g, " ")}`;
    } else if (assignedTo && assignedTo === ticket.assignedTo) {
      actionText = `Status updated to ${finalStatus.replace(/_/g, " ")} (Assigned to: ${assignedTo})`;
    } else {
      actionText = `Status updated to ${finalStatus.replace(/_/g, " ")}`;
    }

    // SPAM AUTO-REVERSAL LOGIC
    let isSpamReversed = false;
    if (ticket.isSpam) {
      isSpamReversed = true;
      actionText = `Spam Status Revoked, ${actionText}`; // Update the log text to show the reversal

      // Quietly remove the strike from the student's record
      if (ticket.studentId) {
        const studentRef = doc(db, "students", ticket.studentId);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists()) {
          const currentSpamCount = studentSnap.data().spamCount || 0;
          // Use Math.max to ensure the spam count never goes below 0
          const newSpamCount = Math.max(0, currentSpamCount - 1);

          await updateDoc(studentRef, {
            spamCount: newSpamCount,
            isSuspended: newSpamCount >= 3 // If they drop below 3, this automatically un-suspends them!
          });
        }
      }
    }

    const officialsToLog = [currentAdminRoleTitle];
    if (assignedTo) officialsToLog.push(assignedTo);

    try {
      // 1. Build the base update object
      const updateData = {
        assignedDepartment: assignedDepartment,
        assignedTo: assignedTo,
        status: finalStatus,
        isSpam: false,
        visibilityTag: assignedTo || ticket.visibilityTag || "General",
        involvedOfficials: arrayUnion(...officialsToLog),
        logs: arrayUnion({
          action: actionText,
          note: isSpamReversed ? (remarks || "Mistakenly marked as spam; strike removed.") : (remarks || ""),
          user: currentAdminName,
          timestamp: new Date()
        })
      };

      // 2. ENFORCE FINAL RESOLUTION MESSAGE
      if (["RESOLVED", "REJECTED"].includes(finalStatus)) {
          if (!remarks.trim()) {
              setModalConfig({ visible: true, title: "Message Required", message: "Please provide a final message explaining the resolution.", isConfirm: false, isError: true });
              return; // Stop execution
          }
          updateData.resolutionRemark = remarks.trim();
          updateData.resolvedAt = new Date(); 
      }

      await updateDoc(doc(db, "complaints", id), updateData);

      // MINIMAL PUSH NOTIFICATIONS
      if (student && student.expoPushToken && student.settings?.pushNotifications === true) {
        const studentState = getStudentState(finalStatus);
        
        // Default minimal text
        let notifTitle = "Grievance Update";
        let pushMessage = `There is new activity on your "${ticket.title}" ticket.`;

        // Contextual minimal text
        if (isSpamReversed) {
          notifTitle = "Strike Removed 🔄";
          pushMessage = `Your ticket "${ticket.title}" has been restored.`;
        } else if (studentState === "In Progress") {
          notifTitle = "Moving Forward ⏳";
          pushMessage = `The authorities are reviewing "${ticket.title}".`;
        } else if (studentState === "Resolved") {
          notifTitle = "Issue Resolved ✅";
          pushMessage = `Action has been taken on "${ticket.title}".`;
        } else if (studentState === "Rejected") {
          notifTitle = "Ticket Closed 🔒";
          pushMessage = `"${ticket.title}" was closed by the administration.`;
        }

        await sendPushNotification(student.expoPushToken, pushMessage, notifTitle, id);
      } else {
        console.warn("⚠️ Push skipped...");
      }

      setModalConfig({
        visible: true,
        title: isSpamReversed ? "Ticket Restored & Forwarded!" : "Update Successful!",
        message: isSpamReversed
          ? "The spam designation was removed, the student's strike was reversed, and the ticket has been updated."
          : "Ticket status and activity log have been updated.",
        isConfirm: false,
        isError: false,
        onConfirm: () => navigate("/dashboard")
      });

    } catch (error) { 
      console.error(error);
      setModalConfig({ visible: true, title: "Action Failed", message: "Failed to update the ticket. Please try again.", isConfirm: false, isError: true, onConfirm: null });
    }
  };

  const handleMarkAsSpamClick = () => {
    setSpamReason(""); // Clear previous input
    setModalConfig({
      visible: true,
      title: "Confirm Spam & Apply Strike",
      message: "Please provide a reason for marking this grievance as SPAM. This will be visible to the student.",
      isConfirm: true,
      isError: true,
      isSpamPrompt: true, // Show the textbox
      onConfirm: executeMarkAsSpam
    });
  };

  const executeMarkAsSpam = async () => {
    if (!spamReason.trim()) {
      alert("You must provide a reason before marking this as spam.");
      return;
    }

    try {
      await updateDoc(doc(db, "complaints", id), {
        status: "REJECTED",
        isSpam: true,
        resolutionRemark: spamReason.trim(), 
        involvedOfficials: arrayUnion(currentAdminRoleTitle),
        logs: arrayUnion({
          action: "Marked as SPAM & Rejected",
          note: `Reason given: ${spamReason.trim()}`, 
          user: currentAdminName,
          timestamp: new Date()
        })
      });


      if (student && student.expoPushToken && student.settings?.pushNotifications === true) {
        const notifTitle = "Action Required ⚠️";
        const pushMessage = "A spam strike has been applied to your account. Open the app to review the official remarks.";
        await sendPushNotification(student.expoPushToken, pushMessage, notifTitle, id);
      }


      if (ticket.studentId) {
        const studentRef = doc(db, "students", ticket.studentId);
        const studentSnap = await getDoc(studentRef);
        if (studentSnap.exists()) {
          const newSpamCount = (studentSnap.data().spamCount || 0) + 1;
          await updateDoc(studentRef, { spamCount: newSpamCount, isSuspended: newSpamCount >= 3 });
        }
      }

      setModalConfig({
        visible: true,
        title: "Spam Logged Successfully!",
        message: "This ticket has been marked as spam and a strike has been applied.",
        isConfirm: false,
        isError: false,
        isSpamPrompt: false,
        onConfirm: () => navigate("/dashboard")
      });

    } catch (error) {
      console.error("Spam Action Error:", error);
      setModalConfig({ visible: true, title: "Action Failed", message: "Failed to mark as spam.", isConfirm: false, isError: true, onConfirm: null });
    }
  };

  if (loading) return <div style={{ padding: "50px", textAlign: "center", color: theme.colors.text }}>Synchronizing...</div>;

  const currentStatusTheme = getStatusTheme(status);

  return (
    <div style={styles(theme).container}>
      <div style={styles(theme).headerContainer}>
        <div>
          <h2 style={styles(theme).dashboardHeading}>
            Review Case <span style={styles(theme).headerId}>{displayId}</span>
          </h2>
          <p style={styles(theme).dashboardSub}>Manage details, update status, and log activities for this grievance.</p>
        </div>
      </div>

      <div style={styles(theme).grid}>
        <div style={styles(theme).card}>

          <div style={styles(theme).topInfoRow}>
            <div style={styles(theme).infoPill}><Tag size={12} /> {ticket.category}</div>
            <div style={styles(theme).infoPill}><MapPin size={12} /> {ticket.departmentLocation || "General"}</div>
            <div style={styles(theme).infoPill}><Calendar size={12} /> {new Date(ticket.createdAt?.seconds * 1000).toLocaleDateString()}</div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '24px' }}>
            <h1 style={styles(theme).title}>{ticket.title}</h1>
            <div style={{ ...styles(theme).statusTag, ...currentStatusTheme }}>
              {status.replace(/_/g, " ")}
            </div>
          </div>

          <p style={styles(theme).description}>{ticket.description}</p>

          {ticket.imageUrl && (
            <div style={styles(theme).imageContainer}>
              <img src={ticket.imageUrl} alt="Evidence" style={styles(theme).image} />
            </div>
          )}

          {/* ENTIRELY REDESIGNED MINIMAL ACTIVITY LOG TIMELINE */}
          <div style={styles(theme).logSection}>
            <h3 style={styles(theme).logTitle}>Activity Log</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {ticket.logs && ticket.logs.length > 0 ? (
                ticket.logs
                  .sort((a, b) => {
                    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
                    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
                    return dateB - dateA;
                  })
                  .map((log, index) => {
                    const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                    return (
                      <div key={index} style={styles(theme).logItem}>
                        <div style={styles(theme).logIcon(theme, log.action)}>
                          {log.action.includes("Forwarded") ? <ArrowRight size={14} /> :
                            log.action.includes("SPAM") || log.action.includes("Rejected") ? <Ban size={14} color="#ef4444" /> :
                              log.action.includes("Resolved") ? <CheckCircle size={14} color="#10b981" /> :
                                <Clock size={14} />}
                        </div>

                        <div style={styles(theme).logContentWrapper}>
                          {/* Softened Title */}
                          <p style={styles(theme).logAction}>{log.action}</p>

                          {/* Minimal Quote Note */}
                          {log.note && <div style={styles(theme).logNote}>"{log.note}"</div>}

                          {/* Clean Meta Text */}
                          <div style={styles(theme).logMeta}>
                            <span style={styles(theme).logUser}>{log.user}</span>
                            <span style={styles(theme).logBullet}>•</span>
                            <span>{format(logDate, "MMM dd, yyyy 'at' hh:mm a")}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div style={styles(theme).emptyLog}>No activity logged yet. Updates will appear here.</div>
              )}
            </div>
          </div>
        </div>

        {/* FORWARDING / ACTION PANEL */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={styles(theme).card}>
            <div style={styles(theme).studentHeader}>
              <div style={styles(theme).avatar}><ShieldCheck size={18} color="#6366f1" /></div>
              <div>
                <div style={styles(theme).studentTitle}>{ticket.isAnonymous ? "Identity Hidden" : student?.fullName}</div>
                <div style={styles(theme).studentSub}>{ticket.isAnonymous ? "Anonymous Submission" : "Verified Student"}</div>
              </div>
            </div>

            <hr style={styles(theme).divider} />

            <div style={styles(theme).formField}>
              <label style={styles(theme).label}>Route to Department</label>
              <select style={styles(theme).select} value={assignedDepartment} onChange={(e) => { setAssignedDepartment(e.target.value); setAssignedTo(""); }}>
                {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            <div style={styles(theme).formField}>
              <label style={styles(theme).label}>Assign To</label>
              <select style={styles(theme).select} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
                <option value="" disabled>Select an Assignee...</option>
                {DEPARTMENT_MAP[assignedDepartment]?.map(person => (
                  <option key={person} value={person}>{person}</option>
                ))}
              </select>
            </div>

            <div style={styles(theme).formField}>
              <label style={styles(theme).label}>Update Status</label>
              <select style={styles(theme).select} value={status} onChange={(e) => setStatus(e.target.value)}>
                {status === "OPEN" && <option value="OPEN" disabled>OPEN (Current)</option>}
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>

            <div style={styles(theme).formField}>
              <label style={styles(theme).label}>
                {["RESOLVED", "REJECTED"].includes(status) 
                  ? "Final Resolution Message (Visible to Student) *" 
                  : "Log Remark (Optional)"}
              </label>
              <textarea
                style={styles(theme).textarea}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={["RESOLVED", "REJECTED"].includes(status) 
                  ? "Explain exactly how this issue was fixed for the student..." 
                  : "Add an internal note to the activity log..."}
              />
            </div>

            <button onClick={handleForward} style={styles(theme).forwardBtn}>
              <Send size={16} /> Update & Log Activity
            </button>

            {currentAdminRole === "PRINCIPAL" && !ticket.isSpam && (
              <button onClick={handleMarkAsSpamClick} style={styles(theme).spamBtn}>
                <Ban size={16} /> Mark as Spam
              </button>
            )}

            {/* Show a disabled state/message so they know why the button is gone */}
            {currentAdminRole === "PRINCIPAL" && ticket.isSpam && (
              <div style={{ textAlign: "center", color: "#ef4444", fontSize: "13px", fontWeight: "700", marginTop: "16px", padding: "10px", backgroundColor: theme.isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2", borderRadius: "8px", border: `1px solid ${theme.isDark ? "rgba(239, 68, 68, 0.3)" : "#fca5a5"}` }}>
                Ticket is already marked as SPAM!
              </div>
            )}

            {modalConfig.visible && (
              <div style={styles(theme).modalOverlay}>
                <div style={styles(theme).modalCard}>
                  <h3 style={{ margin: "0 0 12px 0", fontSize: "20px", fontWeight: "700", color: modalConfig.isError ? "#ef4444" : theme.colors.text }}>
                    {modalConfig.title}
                  </h3>
                  <p style={{ margin: "0 0 24px 0", fontSize: "15px", color: theme.colors.text, lineHeight: "1.5", opacity: 0.9 }}>
                    {modalConfig.message}
                  </p>

                  {modalConfig.isSpamPrompt && (
                    <textarea
                      placeholder="Enter the reason for marking as spam... (Required)"
                      value={spamReason}
                      onChange={(e) => setSpamReason(e.target.value)}
                      style={{ ...styles(theme).textarea, marginBottom: "20px", minHeight: "80px", border: modalConfig.isError ? "1px solid #fca5a5" : undefined }}
                    />
                  )}

                  <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                    {modalConfig.isConfirm && (
                      <button onClick={() => setModalConfig({ ...modalConfig, visible: false, isSpamPrompt: false })} style={styles(theme).outlineBtn}>
                        Cancel
                      </button>
                    )}
                    <button
                      onClick={() => {
                        // If it's the spam prompt, call the live function directly to avoid stale state!
                        if (modalConfig.isSpamPrompt) {
                          executeMarkAsSpam();
                        } else {
                          // Standard modal behavior
                          setModalConfig({ ...modalConfig, visible: false });
                          if (modalConfig.onConfirm) modalConfig.onConfirm();
                        }
                      }}
                      style={modalConfig.isError && modalConfig.isConfirm ? styles(theme).dangerBtn : styles(theme).primaryBtn}
                    >
                      {modalConfig.isConfirm ? "Confirm Action" : "Acknowledge"}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};


const styles = (theme) => ({
  container: { padding: "30px", maxWidth: "1400px", margin: "0 auto", fontFamily: "'Inter', sans-serif" },

  headerContainer: { marginBottom: '30px', display: "flex", justifyContent: "space-between", alignItems: "end" },
  dashboardHeading: { fontSize: "26px", fontWeight: "700", color: theme.colors.text, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' },
  dashboardSub: { fontSize: "14px", color: theme.colors.subText, marginTop: "6px", margin: 0 },
  headerId: { color: theme.isDark ? "#60a5fa" : "#3b82f6", fontSize: '20px', fontWeight: '800', fontFamily: 'monospace' },

  grid: { display: "grid", gridTemplateColumns: "1fr 380px", gap: "24px" },
  card: {
    backgroundColor: theme.colors.card,
    padding: "32px",
    borderRadius: "16px",
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)"
  },

  topInfoRow: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  infoPill: {
    display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600',
    color: theme.colors.text, backgroundColor: theme.isDark ? "#1e293b" : "#f1f5f9",
    padding: '6px 14px', borderRadius: '10px', border: `1px solid ${theme.colors.border}`
  },

  statusTag: { padding: '6px 16px', borderRadius: '20px', fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' },
  title: { fontSize: "24px", fontWeight: "800", color: theme.colors.text, margin: 0, lineHeight: '1.3' },
  description: { fontSize: "15px", color: theme.colors.text, lineHeight: "1.7", opacity: 0.85, marginTop: '20px' },

  imageContainer: { marginTop: '24px', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${theme.colors.border}` },
  image: { width: '100%', display: 'block' },

  logSection: { marginTop: "40px", paddingTop: "30px", borderTop: `1px solid ${theme.colors.border}` },
  logTitle: { fontSize: "16px", fontWeight: "700", color: theme.colors.text, margin: "0 0 24px 0" },

  logItem: { display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "28px" },

  logIcon: (theme, action) => ({
    marginTop: "2px", padding: "8px", borderRadius: "50%", flexShrink: 0,
    backgroundColor: action.includes("SPAM") ? "rgba(239, 68, 68, 0.1)" : theme.isDark ? "#1e293b" : "#eff6ff",
    color: action.includes("SPAM") ? "#ef4444" : theme.colors.active
  }),

  logContentWrapper: { flex: 1, display: "flex", flexDirection: "column", gap: "6px" },

  logAction: { margin: 0, fontSize: "14.5px", fontWeight: "500", color: theme.colors.text, lineHeight: "1.4" },

  logNote: {
    margin: "2px 0 0 0", fontSize: "13.5px", color: theme.colors.subText, fontStyle: "italic",
    paddingLeft: "12px", borderLeft: `2px solid ${theme.colors.border}`, backgroundColor: "transparent"
  },

  logMeta: { display: "flex", gap: "8px", marginTop: "2px", fontSize: "12px", color: theme.colors.subText, alignItems: "center" },
  logUser: { fontWeight: "600", color: theme.colors.text, textTransform: "capitalize" },
  logBullet: { opacity: 0.3, fontSize: "10px" },
  emptyLog: { fontSize: "14px", color: theme.colors.subText, fontStyle: "italic" },

  studentHeader: { display: 'flex', alignItems: 'center', gap: '14px' },
  avatar: { width: '42px', height: '42px', borderRadius: '12px', backgroundColor: theme.isDark ? "rgba(99, 102, 241, 0.15)" : "#eef2ff", display: 'flex', justifyContent: 'center', alignItems: 'center' },
  studentTitle: { fontSize: '15px', fontWeight: '700', color: theme.colors.text },
  studentSub: { fontSize: '12px', color: theme.colors.subText, marginTop: '2px' },

  divider: { border: "none", borderTop: `1px solid ${theme.colors.border}`, margin: "24px 0" },

  formField: { marginBottom: "20px" },
  label: { display: "block", fontSize: "12px", fontWeight: "700", color: theme.colors.subText, marginBottom: "10px", textTransform: 'uppercase', letterSpacing: "0.5px" },
  select: { 
    width: "100%", 
    padding: "14px", 
    borderRadius: "12px", 
    border: `1px solid ${theme.colors.border}`, 
    backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", 
    color: theme.colors.text, 
    fontSize: '14px', 
    outline: 'none', 
    transition: "all 0.2s",
    boxSizing: "border-box", // <-- Fixes width overflow
    fontFamily: "inherit"    // <-- Matches app font
  },
  textarea: { 
    width: "100%", 
    padding: "14px", 
    borderRadius: "12px", 
    border: `1px solid ${theme.colors.border}`, 
    backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", 
    color: theme.colors.text, 
    fontSize: '14px', 
    minHeight: "100px", 
    outline: 'none', 
    resize: 'vertical',      // <-- Allows vertical resizing only, stops horizontal breaking
    transition: "all 0.2s",
    boxSizing: "border-box", // <-- Fixes width overflow
    fontFamily: "inherit"    // <-- Matches app font
  },

  forwardBtn: {
    width: "100%", padding: "16px", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff",
    border: "none", borderRadius: "12px", fontWeight: "700", fontSize: '15px',
    cursor: "pointer", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px",
    boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.5)', transition: 'transform 0.2s, box-shadow 0.2s'
  },
  spamBtn: {
    width: "100%",
    padding: "16px",
    marginTop: "12px",
    backgroundColor: theme.isDark ? "rgba(239, 68, 68, 0.1)" : "#fef2f2",
    color: theme.isDark ? "#f87171" : "#ef4444",
    border: `1px solid ${theme.isDark ? "rgba(239, 68, 68, 0.3)" : "#fca5a5"}`,
    borderRadius: "12px",
    fontWeight: "700",
    fontSize: '15px',
    cursor: "pointer",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "10px",
    transition: 'all 0.2s'
  },

  modalOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, backdropFilter: "blur(4px)" },
  modalCard: { width: "90%", maxWidth: "420px", backgroundColor: theme.colors.card, borderRadius: "20px", padding: "32px", border: `1px solid ${theme.colors.border}`, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" },
  outlineBtn: { padding: "10px 16px", backgroundColor: "transparent", border: `1px solid ${theme.colors.border}`, color: theme.colors.text, borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", transition: "all 0.2s" },
  primaryBtn: { padding: "10px 20px", background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)", transition: "all 0.2s" },
  dangerBtn: { padding: "10px 20px", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", fontSize: "14px", boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)", transition: "all 0.2s" }
});

export default ManageTicket;