import React, { useState } from 'react'; // BƯỚC 1: Import thêm useState
import styles from './Login.module.css';
import { Link, useNavigate } from 'react-router-dom'; // BƯỚC 2: Import thêm useNavigate

const Login = () => {
  // BƯỚC 3: Tạo state để lưu trữ email, password và lỗi
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(''); // State cho thông báo lỗi

  // BƯỚC 4: Khởi tạo hook useNavigate để chuyển trang
  const navigate = useNavigate();

  // BƯỚC 5: Hàm xử lý khi bấm nút "Sign in"
  const handleSubmit = (e) => {
    e.preventDefault(); // Ngăn form gửi đi (tránh reload trang)

    // BƯỚC 6: Logic đăng nhập bạn yêu cầu
    if (email === 'cuong@gmail.com' && password === '1') {
      // Nếu đúng, reset lỗi và chuyển trang
      setError('');
      navigate('/dashboard');
    } else {
      // Nếu sai, hiển thị thông báo lỗi
      setError('Email hoặc mật khẩu không đúng!');
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.loginContainer}>
        <h2 className={styles.title}>Enter Workspace</h2>

        {/* BƯỚC 7: Gán hàm handleSubmit cho sự kiện onSubmit của form */}
        <form className={styles.loginForm} onSubmit={handleSubmit}>
          
          {/* Hiển thị lỗi nếu có */}
          {error && <p className={styles.errorText}>{error}</p>}

          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              placeholder="username@gmail.com"
              value={email} // BƯỚC 8: Gán value cho state
              onChange={(e) => setEmail(e.target.value)} // Cập nhật state khi gõ
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              placeholder="Password"
              value={password} // BƯỚC 9: Gán value cho state
              onChange={(e) => setPassword(e.target.value)} // Cập nhật state khi gõ
            />
            <span className={styles.eyeIcon}>👁️</span> 
          </div>

          <a href="#" className={styles.forgotPassword}>
            Forgot Password?
          </a>

          {/* BƯỚC 10: Nút này giờ là type="submit" để kích hoạt form */}
          <button type="submit" className={styles.signInButton}>
            Sign in
          </button>
          
        </form>

        <p className={styles.orWith}>Or Continue With</p>

        <button type="button" className={styles.googleButton}>
          G
        </button>

        <p className={styles.registerLink}>
          Don't have an account yet?{' '}
          <Link to="/register">Register for free</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;