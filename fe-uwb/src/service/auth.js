import { auth } from "./firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";

/**
 * Register user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 */
export const registerUser = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);

/**
 * Login user with email and password
 * @param {string} email - User email
 * @param {string} password - User password
 */
export const loginUser = (email, password) =>
    signInWithEmailAndPassword(auth, email, password);

/**
 * Logout current user
 */
export const logoutUser = () => signOut(auth);

/**
 * Login with Google OAuth
 */
const provider = new GoogleAuthProvider();
export const loginWithGoogle = () =>
    signInWithPopup(auth, provider);
