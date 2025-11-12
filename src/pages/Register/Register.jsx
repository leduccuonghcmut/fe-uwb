import React from 'react';
import styles from './Register.module.css';
import { Link } from 'react-router-dom';

const Register = () => {
  return (
    <div className={styles.registerPage}>
      <div className={styles.registerContainer}>
        <h2 className={styles.title}>Register</h2>

        <form className={styles.registerForm}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="username@gmail.com"
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Password"
            />
            <span className={styles.eyeIcon}>👁️</span>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">Confirm password</label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Password"
            />
            <span className={styles.eyeIcon}>👁️</span>
          </div>

          <button type="submit" className={styles.signUpButton}>
            Sign up
          </button>
        </form>

        <p className={styles.orWith}>Or Continue With</p>

        <button className={styles.googleButton}>
          G
        </button>

        <p className={styles.loginLink}>
          Have an account yet? <Link to="/login">Log in now</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;