import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './Auth.module.css'; // Можете використати існуючі стилі або створити MainPage.module.css
import api, { setAccessToken } from './api';

function MainPage({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Приклад завантаження захищених даних з бекенду при монтуванні сторінки
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        // Замініть на свій реальний ендпоинт для отримання профілю (наприклад, /api/user/profile)
        const response = await api.get('/api/auth/me'); 
        setUserInfo(response.data);
      } catch (error) {
        console.error("Не вдалося завантажити дані користувача:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Логіка виходу з акаунта (логаут)
  const handleLogout = async () => {
    try {
      // Якщо на бекенді є ендпоинт для логауту (який, наприклад, очищує refresh cookie)
      await api.post('/api/auth/log-out').catch(() => {});
    } finally {
      // Очищуємо локальний access token
      setAccessToken(null);

      // Змінюємо стан автентифікації у головному App компоненті
      if (setIsAuthenticated) {
        setIsAuthenticated(false);
      }

      // Перенаправляємо на сторінку логіну
      navigate('/login');
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#111111', color: '#a9a9a9' }}>
        <p>Завантаження головної сторінки...</p>
      </div>
    );
  }

  return (
    <div className={styles.authContainer} style={{ flexDirection: 'column', gap: '20px' }}>
      <div className={styles.authCard} style={{ maxWidth: '600px', textAlign: 'center' }}>
        <h2 className={styles.authTitle}>Головна сторінка</h2>
        
        <p style={{ color: '#989898', marginBottom: '20px' }}>
          Вітаємо у вашому особистому кабінеті! Ви успішно авторизовані.
        </p>

        {userInfo && (
          <div style={{ backgroundColor: '#111111', padding: '15px', borderRadius: '6px', marginBottom: '20px', border: '1px solid #333333', textAlign: 'left' }}>
            <p style={{ color: '#a9a9a9', margin: '5px 0' }}><strong>Ім'я / Нікнейм:</strong> {userInfo.username || userInfo.nickname || 'Користувач'}</p>
            <p style={{ color: '#a9a9a9', margin: '5px 0' }}><strong>Email:</strong> {userInfo.email}</p>
          </div>
        )}

        <button 
          onClick={handleLogout}
          className={styles.submitButton}
          style={{ backgroundColor: '#460000' }}
        >
          Вийти з акаунта
        </button>
      </div>
    </div>
  );
}

export default MainPage;