import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Login.module.css";

import { loginUser } from "../../service/auth";
import { loginWithGoogle } from "../../service/auth";   // 🔥 Thêm dòng này

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email || !pw) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      await loginUser(email, pw);
      navigate("/dashboard");
    } catch (err) {
      setError("Wrong email or password!");
    }
  };

  // 🔥 Thêm Google Login nhưng không sửa giao diện
  const handleGoogle = async () => {
    try {
      await loginWithGoogle();
      navigate("/dashboard");
    } catch (err) {
      setError("Google login failed!");
    }
  };

  return (
      <div className={styles.pageWrapper}>
        <div className={styles.card}>
          <h2 className={styles.titleSmall}>Enter Workspace</h2>

          {error && <div className={styles.errorBox}>{error}</div>}

          <label className={styles.label}>Email</label>
          <input
              type="email"
              className={styles.input}
              placeholder="username@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
          />

          <label className={styles.label}>Password</label>
          <div className={styles.passwordWrapper}>
            <input
                type={showPw ? "text" : "password"}
                className={styles.input}
                placeholder="Password"
                value={pw}
                onChange={(e) => {
                  setPw(e.target.value);
                  if (e.target.value.length === 0) setShowPw(false);
                }}
            />

            {pw.length > 0 && (
                <i
                    className={`${styles.eyeIcon} ${
                        showPw ? "ri-eye-off-line" : "ri-eye-line"
                    }`}
                    onClick={() => setShowPw(!showPw)}
                ></i>
            )}
          </div>

          <button className={styles.signinBtn} onClick={handleLogin}>
            Sign in
          </button>

          <div className={styles.or}>Or Continue With</div>

          {/* 🔥 Chỉ thêm onClick, không đổi UI */}
          <button className={styles.googleBtn} onClick={handleGoogle}>
            <img
                src="https://www.svgrepo.com/show/355037/google.svg"
                className={styles.googleIcon}
            />
          </button>

          <div className={styles.registerText}>
            Don’t have an account yet?
            <Link to="/register" className={styles.registerLink}>
              {" "}
              Register for free
            </Link>
          </div>
        </div>
      </div>
  );
};

export default Login;
