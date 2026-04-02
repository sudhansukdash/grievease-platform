import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem("theme") === "dark");
  const [isDirty, setIsDirty] = useState(false); 

  useEffect(() => {
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    document.body.style.backgroundColor = isDarkMode ? "#0b1120" : "#f3f4f6";
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  // GLOBAL COLORS
  const theme = {
    isDark: isDarkMode,
    colors: isDarkMode ? {
      bg: "#0b1120",
      card: "#161e31",
      text: "#e2e8f0",
      subText: "#94a3b8",
      border: "#1e293b",
      hover: "#1e293b",    
      active: "#3b82f6",
      accent: "#60a5fa",
    } : {
      bg: "#f3f4f6",       
      card: "#ffffff",     
      text: "#0f172a",     
      subText: "#64748b",  
      border: "#e2e8f0",   
      hover: "#f1f5f9",    
      active: "#2563eb",   
      accent: "#3b82f6",
    }
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme, isDirty, setIsDirty }}>
      {children}
    </ThemeContext.Provider>
  );
};