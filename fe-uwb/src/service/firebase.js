import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyBGT9Cpfhj551AB05Q-L94OCxL5ARDth_8",
    authDomain: "dauwb-58554.firebaseapp.com",
    databaseURL: "https://dauwb-58554-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "dauwb-58554",
    storageBucket: "dauwb-58554.firebasestorage.app",
    messagingSenderId: "1014353557520",
    appId: "1:1014353557520:web:bbfe59f7fd418bf529f295",
    measurementId: "G-5YJMD7W4E8"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
