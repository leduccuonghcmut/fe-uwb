import { auth } from "./firebase";
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
} from "firebase/auth";

export const registerUser = (email, password) =>
    createUserWithEmailAndPassword(auth, email, password);

export const loginUser = (email, password) =>
    signInWithEmailAndPassword(auth, password);

export const logoutUser = () => signOut(auth);

const provider = new GoogleAuthProvider();

export const loginWithGoogle = () =>
    signInWithPopup(auth, provider);
