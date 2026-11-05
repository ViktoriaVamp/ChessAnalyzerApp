import { useState } from 'react';
import styles from './Auth.module.css';
import { Link, useNavigate } from 'react-router-dom';
import api, { setAccessToken } from './api';


function SignUp({ setIsAuthenticated }) {
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));
  };
   const [isLoading, setIsLoading] = useState(false);
  
  const handleSubmit = async (e) => {
  e.preventDefault();
    
  if (isLoading) return; 

    
    
    if (formData.password !== formData.confirmPassword) {
      alert("Паролі не збігаються!");
      return;
    }

    setIsLoading(true);
   try {
    console.log("Надсилаємо дані на бекенд...", formData);

  
    const response = await api.post('/api/auth/signup', {
      Username: formData.nickname,
      Email: formData.email,
      Password: formData.password
    });
    if (response.status === 200 || response.status === 201) {
      const { message, token } = response.data;
        
       setAccessToken(token);

       if (setIsAuthenticated) {
          setIsAuthenticated(true);
        }


        navigate('/main-page');
    }

  } catch (error) {
   console.error("Помилка під час реєстрації:", error);

      const serverData = error.response?.data;
      const status = error.response?.status;

      if (error.response) {
        
        if (status === 400) {
          if (serverData && serverData.errors && typeof serverData.errors === 'object') {
            const firstFieldErrors = Object.values(serverData.errors)[0];
            if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
              alert(`${firstFieldErrors[0]}`);
              return;
            }
          }
            
          if (serverData && typeof serverData === 'object' && !serverData.message) {
            const firstFieldErrors = Object.values(serverData)[0];
            if (Array.isArray(firstFieldErrors) && firstFieldErrors.length > 0) {
              alert(`${firstFieldErrors[0]}`);
              return;
            }
          }
        }
           
        if (serverData && serverData.message) {
          alert(`${serverData.message}`);
          return;
        }
        
        alert(`${serverData?.message || "500 Server Error."}`);

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
        <h2 className={styles.authTitle}>Реєстрація</h2>
        
        <form onSubmit={handleSubmit} className={styles.authForm}>
          <div className={styles.inputGroup}>
            <label htmlFor="nickname">Нікнейм</label>
            <input
              type="text"
              id="nickname"
              name="nickname"
              value={formData.nickname}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email">Електронна пошта</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
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

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">Підтвердіть пароль</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={isLoading}
          >
            {isLoading ? 'Завантаження...' : 'Зареєструватися'}
          </button>
        </form>

        <p className={styles.switchText}>
          Вже маєте акаунт? <Link to="/login" className={styles.link}>Увійти</Link>
        </p>
      </div>
    </div>
  );
}

export default SignUp;