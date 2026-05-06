import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./context/themeContext"; 
import ProtectedRoute from "./components/protectedRoute"; 
import Layout from "./components/layout"; 
import Login from "./pages/login"; 
import Dashboard from "./pages/dashboard"; 
import Settings from "./pages/settings"; 
import Reports from "./pages/Reports";
import ManageAdmins from "./pages/ManageAdmins";
import ManageTicket from "./pages/ManageTicket"; 
import BlockedStudents from "./pages/BlockedStudents"; 
import ApproveRequests from "./pages/ApproveRequests";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
        
          <Route path="/" element={<Login />} />
          
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/manage-admins" element={<ManageAdmins />} />
            <Route path="/approve" element={<ApproveRequests />} />
            <Route path="/manage-ticket/:id" element={<ManageTicket />} />
            <Route path="/blocked-students" element={<BlockedStudents />} />
            
          </Route>

        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;