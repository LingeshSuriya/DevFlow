import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import ProtectedLayout from "./components/ProtectedLayout";
import Dashboard from "./components/Dashboard";
import Board from "./components/Board";
import Chat from "./components/Chat";
import OrgSettings from "./components/OrgSettings";
import BugTracker from "./components/BugTracker";
import BugDetail from "./components/BugDetail";
import Reviews from "./components/Reviews";
import ReviewDetail from "./components/ReviewDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/board" element={<Board />} />
        <Route path="/bugs" element={<BugTracker />} />
        <Route path="/bugs/:id" element={<BugDetail />} />
        <Route path="/reviews" element={<Reviews />} />
        <Route path="/reviews/:id" element={<ReviewDetail />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/org" element={<OrgSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
