import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import LiveTracking from "./pages/LiveTracking/LiveTracking";
import Sidebar from "./components/Sidebar/Sidebar";

function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* PUBLIC */}
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* DASHBOARD */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <Dashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/live"
                    element={
                        <ProtectedRoute>
                            <div
                                style={{
                                    display: "flex",
                                    height: "100vh",
                                    width: "100vw",
                                    overflow: "hidden",
                                }}
                            >
                                <Sidebar />
                                <div
                                    style={{
                                        flex: 1,
                                        height: "100vh",
                                        minWidth: 0,
                                        position: "relative",
                                        overflow: "hidden",
                                    }}
                                >
                                    <LiveTracking />
                                </div>
                            </div>
                        </ProtectedRoute>
                    }
                />

            </Routes>
        </BrowserRouter>
    );
}

export default App;
