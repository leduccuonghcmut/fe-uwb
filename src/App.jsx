import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import Dashboard from "./pages/Dashboard/Dashboard";

import { useAuth } from "./context/AuthContext";

// Protected Route: user chưa login → chuyển về /login
function ProtectedRoute({ children }) {
    const { user } = useAuth();
    if (!user) return <Navigate to="/login" replace />;
    return children;
}

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Home page */}
                <Route path="/" element={<Home />} />

                {/* Auth pages */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Dashboard chỉ vào được khi đã login */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Nếu path sai → chuyển về Home */}
                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
