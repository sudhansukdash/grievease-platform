import React, { useEffect, useState } from "react";

const SuccessModal = ({ visible, title, message, buttonText, onPress, color = "#10b981" }) => {
  const [scale, setScale] = useState(0);

  useEffect(() => {
    if (visible) {
      // Small delay to ensure render before animating
      requestAnimationFrame(() => setScale(1));
    } else {
      setScale(0);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center",
      zIndex: 200, backdropFilter: "blur(3px)", transition: "opacity 0.3s"
    }}>
      <div style={{
        backgroundColor: "#fff", borderRadius: "24px", width: "90%", maxWidth: "340px",
        padding: "32px 24px", display: "flex", flexDirection: "column", alignItems: "center",
        boxShadow: "0 20px 40px rgba(0,0,0,0.2)", position: "relative"
      }}>

        <div style={{
          width: "72px", height: "72px", borderRadius: "50%",
          backgroundColor: color, display: "flex", justifyContent: "center", alignItems: "center",
          marginBottom: "24px",
          transform: `scale(${scale})`,
          transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)"
        }}>
          <span style={{ fontSize: "36px", color: "#fff", fontWeight: "bold" }}>✓</span>
        </div>

        <h3 style={{ margin: "0 0 8px 0", fontSize: "20px", color: "#111827", textAlign: "center", fontWeight: "700" }}>
          {title}
        </h3>
        
        <p style={{ margin: "0 0 24px 0", fontSize: "14px", color: "#6b7280", textAlign: "center", lineHeight: "1.5" }}>
          {message}
        </p>

        <button 
          onClick={onPress}
          style={{
            backgroundColor: color, color: "white", width: "100%", padding: "14px",
            borderRadius: "12px", border: "none", fontSize: "15px", fontWeight: "600",
            cursor: "pointer", transition: "transform 0.1s active", 
            boxShadow: `0 4px 12px ${color}40` // Subtle colored shadow
          }}
          onMouseDown={(e) => e.target.style.transform = "scale(0.96)"}
          onMouseUp={(e) => e.target.style.transform = "scale(1)"}
        >
          {buttonText || "Continue"}
        </button>
      </div>
    </div>
  );
};

export default SuccessModal;