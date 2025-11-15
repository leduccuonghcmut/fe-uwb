import React, { useState } from "react";
import styles from "./Register.module.css";
import { Link, useNavigate } from "react-router-dom";

const Register = () => {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !pw || !confirm) {
      setError("Please fill in all fields.");
      return;
    }

    if (pw !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    navigate("/dashboard");
  };

  return (
      <div className={styles.pageWrapper}>
        <div className={styles.card}>
          <h2 className={styles.titleSmall}>Create Account</h2>

          {/* ERROR BOX */}
          {error && <div className={styles.errorBox}>{error}</div>}

          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label}>Email</label>
            <input
                type="email"
                placeholder="username@gmail.com"
                className={styles.input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />

            <label className={styles.label}>Password</label>
            <input
                type="password"
                placeholder="Password"
                className={styles.input}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
            />

            <label className={styles.label}>Confirm Password</label>
            <input
                type="password"
                placeholder="Confirm Password"
                className={styles.input}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
            />

            <button type="submit" className={styles.primaryBtn}>
              Sign up
            </button>
          </form>

          <div className={styles.or}>Or Continue With</div>

          <button className={styles.googleBtn}>
            <img
                src="https://www.svgrepo.com/show/355037/google.svg"
                className={styles.googleIcon}
            />
          </button>

          <p className={styles.bottomText}>
            Already have an account?
            <Link to="/login" className={styles.registerLink}>
              {" "}
              Login now
            </Link>
          </p>
        </div>
      </div>
  );
};

export default Register;
