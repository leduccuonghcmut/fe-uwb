import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import styles from "./Login.module.css";

const Login = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!email || !pw) {
      setError("Please enter both email and password.");
      return;
    }

    // CHƯA CÓ DATABASE -> để trống login logic
    // TỰ CHUYỂN DASHBOARD
    navigate("/dashboard");
  };

  return (
      <div className={styles.pageWrapper}>
        <div className={styles.card}>
          {/* SMALL TITLE */}
          <h2 className={styles.titleSmall}>Enter Workspace</h2>

          {/* ERROR */}
          {error && <div className={styles.errorBox}>{error}</div>}

          {/* EMAIL */}
          <label className={styles.label}>Email</label>
          <input
              type="email"
              className={styles.input}
              placeholder="username@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
          />

          {/* PASSWORD */}
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

            {/* Show eye ONLY when pw has content */}
            {pw.length > 0 && (
                <i
                    className={`${styles.eyeIcon} ${
                        showPw ? "ri-eye-off-line" : "ri-eye-line"
                    }`}
                    onClick={() => setShowPw(!showPw)}
                ></i>
            )}
          </div>

          {/* SIGN IN BUTTON */}
          <button className={styles.signinBtn} onClick={handleLogin}>
            Sign in
          </button>

          <div className={styles.or}>Or Continue With</div>

          {/* GOOGLE BUTTON */}
          <button className={styles.googleBtn}>
            <img
                src="https://www.svgrepo.com/show/355037/google.svg"
                className={styles.googleIcon}
            />
          </button>

          {/* REGISTER LINK */}
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
