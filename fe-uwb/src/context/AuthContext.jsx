import { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../service/firebase";
import { onAuthStateChanged } from "firebase/auth";

const AuthContext = createContext();

/**
 * Hook to access authentication context
 * @returns {Object} { user: currentUser }
 */
export const useAuth = () => useContext(AuthContext);

/**
 * Auth Provider Component - Wrap your app with this
 * @param {Object} props - { children: React components }
 */
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });
        return unsub;
    }, []);

    return (
        <AuthContext.Provider value={{ user }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
