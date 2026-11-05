import { useState } from 'react';
import styles from './Auth.module.css';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAccessToken } from './api';

const Login = ({ setIsAuthenticated }) => {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    login: '',
    password: ''
  });

  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return; 
    setIsLoading(true);

    try {
      const response = await api.post('/api/auth/login', {
        Login: formData.login,
        Password: formData.password
      });

      if (response.status === 200 || response.status === 201) {
        const { message, token } = response.data;
        
        setAccessToken(token);

        if (setIsAuthenticated) {
          setIsAuthenticated(true);
        }
        
        // Змініть на '/main-page' або той шлях, який ви використовуєте в App.jsx для головної сторінки
        navigate('/main-page');
      }

    } catch (error) {
      console.error("Помилка під час логіну:", error);

      if (error.response) {
        const serverData = error.response.data;
        const status = error.response.status;

        if (status === 400) {
          if (serverData && typeof serverData === 'object') {
            if (serverData.errors && typeof serverData.errors === 'object') {
              const errorValues = Object.values(serverData.errors);
              if (errorValues.length > 0) {
                const firstFieldErrors = errorValues[0];
                if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
                  alert(`${firstFieldErrors[0]}`);
                  return;
                }
              }
            }

            const allValues = Object.values(serverData);
            for (const value of allValues) {
              if (Array.isArray(value) && value.length > 0) {
                alert(`${value[0]}`);
                return;
              }
            }
            
            if (serverData.message) {
              alert(`${serverData.message}`);
              return;
            }
          }
        }

        if (status === 401) {
          if (serverData && serverData.message) {
            alert(`${serverData.message}`);
            return;
          }
        }

        alert(`${serverData?.message || serverData?.title || "500 Server Error."}`);

      } else if (error.request) {
        alert("503 Server Unavailable. Try later");
      } else {
        alert("Error");
      } 
    } finally {
      setIsLoading(false); 
    }
  }; 

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h2 className={styles.authTitle}>Вхід</h2>
        
        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.inputGroup}>
            <label htmlFor="login">Логін або Email</label>
            <input
              type="text"
              id="login"
              name="login"
              value={formData.login}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Пароль</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? 'Завантаження...' : 'Увійти'}
          </button>
        </form>

        <p className={styles.switchText}>
          Ще не маєте акаунта? <Link to="/sign-up" className={styles.link}>Зареєструватися</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;