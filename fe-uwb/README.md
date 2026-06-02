# UWB Real-time Tracking System - Frontend

## Overview

Frontend for an **Ultra-Wideband (UWB) Real-time Tracking System** built with **React + Vite**.

Features:
- Firebase Authentication (Email/Password + Google OAuth)
- Real-time position tracking (3D/2D visualization)
- Geofence management (forbidden zones)
- Device configuration & status monitoring
- Live dashboard with analytics
- WebSocket communication via Socket.IO

## Structure

src/
├── main.jsx                 # React entry point
├── App.jsx                  # Routes & layout
├── index.css               # Global styles
├── components/             # Reusable UI components
│   ├── Header/
│   ├── Sidebar/
│   ├── OverviewCard/
│   └── ProtectedRoute.jsx
├── pages/                  # Page components (routes)
│   ├── Home/
│   ├── Login/
│   ├── Register/
│   ├── Dashboard/
│   ├── SystemConfig/       # Device & zone management
│   ├── LiveTracking/       # 3D/2D tracking visualization
│   ├── Export/
│   └── AdvancedFeature/
├── service/                # API & Firebase connections
│   ├── firebase.js         # Firebase initialization
│   ├── auth.js             # Authentication functions
│   ├── socket.js           # Socket.IO client
│   ├── deviceService.js    # Device CRUD operations
│   └── init-firebase.js    # Database structure setup
└── context/
    └── AuthContext.jsx     # Global authentication state
