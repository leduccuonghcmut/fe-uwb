import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children }) {
    const { user } = useAuth();

    // Nếu không login → đưa về Home
    if (!user) {
        return <Navigate to="/" replace />;
    }

    // Nếu login → render đúng dashboard
    return children;
}
