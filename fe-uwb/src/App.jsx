// src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home/Home";
import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import Dashboard from "./pages/Dashboard/Dashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import LiveTracking from "./pages/LiveTracking/LiveTracking";
import Sidebar from "./components/Sidebar/Sidebar";
import SystemConfig from "./pages/SystemConfig/SystemConfig";
import LiveTracking2D from "./pages/LiveTracking/TwoDScene";

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

                {/* SYSTEM CONFIG */}
                <Route
                    path="/config"
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
                                <div style={{ flexShrink: 0 }}>
                                    <Sidebar />
                                </div>

                                <div
                                    style={{
                                        flex: 1,
                                        height: "100vh",
                                        overflowY: "auto",
                                        background: "#f7f8fa",
                                    }}
                                >
                                    <SystemConfig />
                                </div>
                            </div>
                        </ProtectedRoute>
                    }
                />

                {/* LIVE TRACKING 3D (giữ nguyên) */}
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
                                <div style={{ flexShrink: 0 }}>
                                    <Sidebar />
                                </div>
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

                {/* LIVE TRACKING 2D - BẢN ĐỒ SỐ HÓA (MỚI) */}
                <Route
                    path="/live-2d"
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
                                <div style={{ flexShrink: 0 }}>
                                    <Sidebar />
                                </div>
                                <div
                                    style={{
                                        flex: 1,
                                        height: "100vh",
                                        minWidth: 0,
                                        position: "relative",
                                        overflow: "hidden",
                                    }}
                                >
                                    <LiveTracking2D />
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