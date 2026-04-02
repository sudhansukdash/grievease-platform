// Generate report section, principal can generate campus-wide whereas HOD can generate their specific dept only
import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, getDocs, query, orderBy, getDoc, doc } from "firebase/firestore";
import { useTheme } from "../context/themeContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileText, Download, PieChart as PieIcon, RefreshCw, Calendar, Inbox } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const DEPARTMENTS = ["Academic", "Hostel", "Canteen", "Sports", "Parking", "Other"];

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "REJECTED"];

const Reports = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [adminProfile, setAdminProfile] = useState(null);
  const [reportData, setReportData] = useState([]);
  const [stats, setStats] = useState({ total: 0, deptCounts: {}, statusCounts: {} });
  const [hasGenerated, setHasGenerated] = useState(false);
  const [searchLocked, setSearchLocked] = useState(false);

  const todayStr = new Date().toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    department: "ALL",
    status: "ALL"
  });

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (user) {
        const snap = await getDoc(doc(db, "admins", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setAdminProfile(data);
          if (data.role !== "PRINCIPAL") {
            setFilters(prev => ({ ...prev, department: data.department }));
          }
        }
      }
    };
    fetchProfile();
  }, []);

  const generatePreview = async () => {
    setLoading(true);
    try {
      const ref = collection(db, "complaints");
      const q = query(ref, orderBy("createdAt", "desc"));
      const snap = await getDocs(q);

      const filtered = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(item => {
        const itemDate = item.createdAt?.toDate ? item.createdAt.toDate() : new Date();
        const start = filters.startDate ? new Date(filters.startDate) : null;
        const end = filters.endDate ? new Date(filters.endDate) : null;

        if (start && itemDate < start) return false;
        if (end) {
          const adjustedEnd = new Date(end);
          adjustedEnd.setHours(23, 59, 59, 999);
          if (itemDate > adjustedEnd) return false;
        }


        // HODs should see tickets if they were EVER involved
        if (filters.department !== "ALL") {
          const myRoleTitle = adminProfile?.roleTitle;

          const isOriginalDept = item.category === filters.department;
          const isAssignedDept = item.assignedDepartment === filters.department;
          const wasInvolved = item.involvedOfficials?.includes(myRoleTitle);

          // If I'm not the origin, not the current owner, AND not in the history... then hide it.
          if (!isOriginalDept && !isAssignedDept && !wasInvolved) return false;
        }
        if (filters.status !== "ALL" && item.status?.toUpperCase() !== filters.status.toUpperCase()) return false;

        // If they are an HOD, completely hide "OPEN" or "PENDING" tickets from the report
        if (adminProfile?.role !== "PRINCIPAL") {
          const currentStatus = item.status ? item.status.toUpperCase() : "OPEN";
          if (["OPEN", "PENDING"].includes(currentStatus)) {
            return false;
          }
        }

        return true;
      });

      const deptCounts = {};
      const statusCounts = {};
      filtered.forEach(item => {
        const dept = item.category || "Other";
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;

        let st = item.status ? item.status.toUpperCase() : "OPEN";
        statusCounts[st] = (statusCounts[st] || 0) + 1;
      });

      setStats({ total: filtered.length, deptCounts, statusCounts });
      setReportData(filtered);
      setHasGenerated(true);
      setSearchLocked(true);
    } catch (e) {
      console.error(e);
      alert("Failed to sync records.");
    } finally {
      setLoading(false);
    }
  };

  const resetSearch = () => {
    setHasGenerated(false);
    setSearchLocked(false);
    setReportData([]);
    setStats({ total: 0, deptCounts: {}, statusCounts: {} });
  };

  const getPieGradient = () => {
    if (stats.total === 0) return `conic-gradient(${theme.colors.border} 0% 100%)`;
    let currentDeg = 0;
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#64748b"];
    let gradientStr = "";
    Object.entries(stats.deptCounts).forEach(([dept, count], index) => {
      const deg = (count / stats.total) * 360;
      gradientStr += `${colors[index % colors.length]} ${currentDeg}deg ${currentDeg + deg}deg, `;
      currentDeg += deg;
    });
    return `conic-gradient(${gradientStr.slice(0, -2)})`;
  };

  const getStatusStyle = (status) => {
    const upperStatus = (status || "OPEN").toUpperCase();

    if (upperStatus === "RESOLVED") {
      return { bg: "#dcfce7", color: "#166534" };
    }
    else if (upperStatus === "REJECTED") {
      return { bg: "#fee2e2", color: "#991b1b" };
    }
    else if (["IN_PROGRESS", "ASSIGNED", "ACKNOWLEDGED"].includes(upperStatus)) {
      return { bg: "#dbeafe", color: "#1e40af" };
    }
    else if (["PENDING", "OPEN", "ON_HOLD"].includes(upperStatus)) {
      return { bg: "#fef3c7", color: "#b45309" };
    }
    else {
      // Fallback for any unknown status
      return { bg: "#f1f5f9", color: "#475569" };
    }
  };

  const exportDailySummary = () => {
    try {
      const doc = new jsPDF();

      doc.setFillColor(37, 99, 235);
      doc.rect(0, 0, 210, 40, "F");

      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255);

      // Dynamic Title Logic
      const reportTitle = adminProfile?.role === "PRINCIPAL"
        ? "Campus-Wide Briefing"
        : `${adminProfile?.department} Department Report`;

      doc.text(reportTitle, 14, 25);

      doc.setFontSize(10);
      doc.setTextColor(200, 220, 255);
      doc.text(`Generated: ${format(new Date(), "dd MMM yyyy, h:mm a")}`, 14, 32);
      doc.text(`By: ${adminProfile?.name || "Administrator"}`, 150, 32);

      // Count both Resolved and Rejected as "Closed/Handled" cases

      const resolvedCount = stats.statusCounts["RESOLVED"] || 0;
      const rejectedCount = stats.statusCounts["REJECTED"] || 0;
      const totalClosed = resolvedCount + rejectedCount;
      const pendingCount = stats.total - totalClosed;

      // Ensure rejected tickets aren't accidentally flagged as "Critical"
      const criticalCount = reportData.filter(
        (t) =>
          t.status !== "RESOLVED" &&
          t.status !== "REJECTED" &&
          differenceInDays(new Date(), t.createdAt?.toDate()) > 7
      ).length;

      autoTable(doc, {
        startY: 50,

        head: [["Total Reports", "Resolved Cases", "Pending Action", "Critical (>7 Days)"]],
        // Passed 'totalClosed' instead of the old 'resolvedCount'
        body: [[stats.total, totalClosed, pendingCount, criticalCount]],
        theme: "plain",
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [100, 116, 139],
          fontSize: 10,
          fontStyle: "bold",
          halign: "center",
        },
        bodyStyles: {
          textColor: [15, 23, 42],
          fontSize: 16,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          3: { textColor: [220, 38, 38] },
        },
      });

      let yPos = doc.lastAutoTable.finalY + 15;

      doc.setFontSize(14);
      doc.setTextColor(51, 65, 85);
      doc.text("Department Insights", 14, yPos);
      doc.setDrawColor(226, 232, 240);
      doc.line(14, yPos + 3, 196, yPos + 3);

      yPos += 15;
      const maxBarWidth = 110;

      Object.entries(stats.deptCounts).forEach(([dept, count]) => {
        if (yPos > 250) { doc.addPage(); yPos = 30; }

        const percentage = stats.total > 0 ? count / stats.total : 0;
        const barWidth = percentage * maxBarWidth;
        const percentText = `${Math.round(percentage * 100)}%`;

        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text(dept, 14, yPos);

        doc.setFillColor(241, 245, 249);
        doc.rect(50, yPos - 3, maxBarWidth, 5, "F");

        doc.setFillColor(59, 130, 246);
        if (barWidth > 0) doc.rect(50, yPos - 3, barWidth, 5, "F");

        doc.setFontSize(9);
        doc.setTextColor(100);
        doc.text(`${count} (${percentText})`, 50 + maxBarWidth + 5, yPos);

        yPos += 12;
      });

      yPos += 10;
      doc.setFontSize(14);
      doc.setTextColor(51, 65, 85);
      doc.text("Detailed Issue Log", 14, yPos);

      const sortedData = [...reportData].sort((a, b) => {
        const sA = (a.status || "OPEN").toUpperCase();
        const sB = (b.status || "OPEN").toUpperCase();
        if (sA < sB) return -1;
        if (sA > sB) return 1;

        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA;
      });

      const rows = sortedData.slice(0, 150).map((t) => [
        t.title ? t.title.substring(0, 40) : "No Title",
        t.category || "N/A",
        // Replaces underscores with spaces (e.g. IN_PROGRESS -> IN PROGRESS)
        (t.status || "OPEN").toUpperCase().replace(/_/g, " "),
        t.createdAt?.toDate ? format(t.createdAt.toDate(), "dd MMM yyyy") : "N/A",
      ]);

      autoTable(doc, {
        startY: yPos + 5,
        head: [["Issue Title", "Department", "Status", "Raised On"]],
        body: rows,
        theme: "striped",
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: "bold"
        },
        styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
      });

      const pageCount = doc.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `Page ${i} of ${pageCount}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
      }

      doc.save(`Campus_Report_${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } catch (error) {
      console.error("PDF Generation Error:", error);
      alert(`PDF Failed: ${error.message}`);
    }
  };

  const exportCSV = () => {
    const headers = ["Ticket ID", "Title", "Category", "Status", "Date", "Location", "Description"];
    const rows = reportData.map(row => {
      const cleanDesc = row.description
        ? row.description.replace(/(\r\n|\n|\r)/gm, " ").replace(/"/g, '""')
        : "N/A";

      return [
        row.id,
        `"${row.title}"`,
        row.category,
        row.status,
        row.createdAt?.toDate ? format(row.createdAt.toDate(), "yyyy-MM-dd") : "N/A",
        `"${row.departmentLocation || "General"}"`,
        `"${cleanDesc}"`
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `Grievance_Data_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ padding: "30px", maxWidth: "1400px", margin: "0 auto", color: theme.colors.text, fontFamily: "'Inter', sans-serif" }}>

      {/* HEADER */}
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ fontSize: "26px", fontWeight: "700", margin: 0 }}>Reports & Analytics</h2>
        <p style={{ fontSize: "14px", color: theme.colors.subText, marginTop: "6px", margin: "6px 0 0 0" }}>
          Generate professional documentation for campus administrative reviews.
        </p>
      </div>

      {/* FILTER PANEL */}
      <div style={{
        backgroundColor: theme.colors.card,
        padding: "32px",
        borderRadius: "16px",
        border: `1px solid ${theme.colors.border}`,
        marginBottom: "30px",
        display: "flex",
        gap: "24px",
        flexWrap: "wrap",
        alignItems: "end",
        boxShadow: theme.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)",
        opacity: searchLocked ? 0.8 : 1,
        pointerEvents: searchLocked ? "none" : "auto",
        transition: "opacity 0.2s"
      }}>
        <div style={filterGroup}>
          <label style={labelStyle(theme)}><Calendar size={12} /> Start Date</label>
          <input
            type="date"
            max={todayStr}
            disabled={searchLocked}
            style={inputStyle(theme, searchLocked)}
            onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
          />
        </div>
        <div style={filterGroup}>
          <label style={labelStyle(theme)}><Calendar size={12} /> End Date</label>
          <input
            type="date"
            max={todayStr}
            disabled={searchLocked}
            style={inputStyle(theme, searchLocked)}
            onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
          />
        </div>

        {adminProfile?.role === "PRINCIPAL" && (
          <div style={filterGroup}>
            <label style={labelStyle(theme)}>Department</label>
            <select disabled={searchLocked} style={inputStyle(theme, searchLocked)} value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })}>
              <option value="ALL">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        )}

        <div style={filterGroup}>
          <label style={labelStyle(theme)}>Status</label>
          <select disabled={searchLocked} style={inputStyle(theme, searchLocked)} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="ALL">All Statuses</option>
            {STATUS_OPTIONS
              // Hide the "OPEN" filter option from HODs so they don't do empty searches
              .filter(status => adminProfile?.role === "PRINCIPAL" || status !== "OPEN")
              .map(status => (
                <option key={status} value={status}>{status.replace("_", " ")}</option>
              ))}
          </select>
        </div>

        {!searchLocked && (
          <button onClick={generatePreview} disabled={loading} style={primaryBtn}>
            {loading ? "Scanning..." : "Fetch Reports"}
          </button>
        )}
      </div>

      {/* RESULTS AREA */}
      {hasGenerated && (
        <div style={{ display: 'flex', gap: '24px', flexDirection: 'column' }}>

          {searchLocked && (
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={resetSearch} style={{ ...outlineBtn(theme), pointerEvents: "auto", borderColor: theme.colors.active, color: theme.colors.active }}>
                <RefreshCw size={14} /> Start New Search
              </button>
            </div>
          )}

          {/* METRICS CARD */}
          <div style={{
            backgroundColor: theme.colors.card,
            padding: "32px",
            borderRadius: "16px",
            border: `1px solid ${theme.colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '24px',
            boxShadow: theme.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)"
          }}>
            <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
              <div style={{
                width: '85px', height: '85px', borderRadius: '50%',
                background: getPieGradient(),
                border: `4px solid ${theme.colors.card}`,
                boxShadow: '0 0 0 1px rgba(0,0,0,0.1)'
              }} />

              <div>
                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '800' }}>{stats.total} Records Found</h3>
                <p style={{ margin: 0, color: theme.colors.subText, fontSize: '14px', marginTop: '6px' }}>
                  {/* Now adds both RESOLVED and REJECTED counts together for the UI */}
                  {(stats.statusCounts["RESOLVED"] || 0) + (stats.statusCounts["REJECTED"] || 0)} Resolved &bull; {Object.keys(stats.deptCounts).length} Departments Active
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "16px", pointerEvents: "auto" }}>
              <button onClick={exportCSV} style={outlineBtn(theme)}><Download size={16} /> CSV Data</button>
              <button onClick={exportDailySummary} style={{ ...primaryBtn, backgroundColor: theme.isDark ? "#334155" : "#475569", boxShadow: 'none' }}>
                <PieIcon size={16} style={{ marginRight: '8px' }} /> Download PDF Report
              </button>
            </div>
          </div>

          {/* DATA TABLE */}
          <div style={{
            backgroundColor: theme.colors.card,
            padding: "32px",
            borderRadius: "16px",
            border: `1px solid ${theme.colors.border}`,
            boxShadow: theme.isDark ? "0 4px 20px rgba(0,0,0,0.2)" : "0 4px 20px rgba(0,0,0,0.03)"
          }}>
            <div style={{ maxHeight: "500px", overflowY: "auto", border: `1px solid ${theme.colors.border}`, borderRadius: "12px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                <thead style={{ position: "sticky", top: 0, backgroundColor: theme.isDark ? "#1e293b" : "#f8fafc", zIndex: 1 }}>
                  <tr style={{ textAlign: "left", borderBottom: `1px solid ${theme.colors.border}` }}>
                    <th style={thStyle(theme)}>Issue Title</th>
                    <th style={thStyle(theme)}>Department</th>
                    <th style={thStyle(theme)}>Status</th>
                    <th style={thStyle(theme)}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.map(row => {
                    const style = getStatusStyle(row.status);
                    return (
                      <tr key={row.id} style={{ borderBottom: `1px solid ${theme.colors.border}` }}>
                        <td style={tdStyle(theme)}>{row.title}</td>
                        <td style={tdStyle(theme)}>{row.category}</td>
                        <td style={tdStyle(theme)}>
                          <span style={{
                            fontSize: '11px', fontWeight: '800', padding: '6px 14px', borderRadius: '20px',
                            backgroundColor: style.bg,
                            color: style.color,
                            display: 'inline-block',
                            minWidth: '85px',
                            textAlign: 'center',
                            letterSpacing: '0.5px'
                          }}>
                            {row.status?.toUpperCase().replace("_", " ")}
                          </span>
                        </td>
                        <td style={{ ...tdStyle(theme), color: theme.colors.subText }}>
                          {format(row.createdAt?.toDate(), "MMM dd, yyyy")}
                        </td>
                      </tr>
                    );
                  })}
                  {reportData.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ padding: '80px 0', textAlign: 'center' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                          <Inbox size={48} color={theme.colors.subText} style={{ opacity: 0.2, marginBottom: '16px' }} />
                          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: theme.colors.text }}>No records found</h3>
                          <p style={{ margin: 0, color: theme.colors.subText, fontSize: '14px' }}>
                            Adjust your search filters to find grievance records.
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const filterGroup = { display: "flex", flexDirection: "column", gap: "8px" };

const labelStyle = (theme) => ({
  fontSize: "12px",
  fontWeight: "700",
  textTransform: "uppercase",
  color: theme.colors.subText,
  letterSpacing: "0.5px",
  display: 'flex',
  alignItems: 'center',
  gap: '6px'
});

const inputStyle = (theme, locked) => ({
  padding: "14px",
  borderRadius: "12px",
  border: `1px solid ${theme.colors.border}`,
  backgroundColor: locked ? `${theme.colors.border}20` : theme.isDark ? "#1e293b" : "#f8fafc",
  color: locked ? theme.colors.subText : theme.colors.text,
  outline: "none",
  minWidth: "180px",
  fontSize: '14px',
  cursor: locked ? "not-allowed" : "pointer",
  transition: "all 0.2s ease"
});

const primaryBtn = {
  padding: "14px 28px",
  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
  color: "#fff",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
  fontWeight: "700",
  fontSize: '15px',
  display: 'flex',
  alignItems: 'center',
  boxShadow: '0 8px 20px -6px rgba(99, 102, 241, 0.5)',
  transition: 'transform 0.2s, box-shadow 0.2s'
};

const outlineBtn = (theme) => ({
  padding: "14px 20px",
  backgroundColor: "transparent",
  border: `1px solid ${theme.colors.border}`,
  color: theme.colors.text,
  borderRadius: "12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: "600",
  fontSize: "14px",
  transition: "all 0.2s ease"
});

const thStyle = (theme) => ({
  padding: "16px 24px",
  fontSize: "11px",
  fontWeight: "700",
  textTransform: 'uppercase',
  color: theme.colors.subText,
  letterSpacing: "0.5px"
});

const tdStyle = (theme) => ({
  padding: "16px 24px",
  color: theme.colors.text,
  fontSize: "14px"
});

export default Reports;