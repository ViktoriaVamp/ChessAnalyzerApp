import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MainPage.module.css';
import api, { setAccessToken } from './api';

function MainPage({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Стан для дзвіночка (запити в друзі)
  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [friendRequests, setFriendRequests] = useState([
    { id: 1, username: 'Grandmaster_X' },
    { id: 2, username: 'PawnStormer' }
  ]);

  // Стан для пошуку
  const [searchQuery, setSearchQuery] = useState('');

  // Список шах-ботів
  const chessBots = [
    { id: 1, name: 'Бот Новачок (Ело ~400)', description: 'Спокійний гравець, який іноді робить прості тактичні помилки. Ідеально для розігріву.' },
    { id: 2, name: 'Бот Любитель (Ело ~800)', description: 'Агресивний бот, що шукає можливості для виграшу матеріалу та гострих атак.' },
    { id: 3, name: 'Бот Тактик (Ело ~1200)', description: 'Безкомпромісний суперник із глибоким прорахунком ходів. Виклик для досвідчених гравців.' },
    { id: 4, name: 'Бот Експерт (Ело ~1600)', description: 'Безкомпромісний суперник із глибоким прорахунком ходів. Виклик для досвідчених гравців.' },
    { id: 5, name: 'Бот Майстер (Ело ~2000)', description: 'Безкомпромісний суперник із глибоким прорахунком ходів. Виклик для досвідчених гравців.' }
  ];

  // Завантаження профілю користувача
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await api.get('/api/user/profile'); 
        setUserInfo(response.data);
      } catch (error) {
        console.error("Не вдалося завантажити дані користувача:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

  // Логіка виходу з акаунта
  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout').catch(() => {});
    } finally {
      setAccessToken(null);
      if (setIsAuthenticated) {
        setIsAuthenticated(false);
      }
      navigate('/login');
    }
  };

  // Обробка заявок у друзі
  const handleAcceptFriend = (id) => {
    setFriendRequests(prev => prev.filter(req => req.id !== id));
  };

  const handleRejectFriend = (id) => {
    setFriendRequests(prev => prev.filter(req => req.id !== id));
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Завантаження особистого кабінету...</p>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      
      {/* --- Верхня панель ( Header ) --- */}
      <header className={styles.header}>
        
        {/* Поле пошуку */}
        <div className={styles.searchWrapper}>
          <input 
            type="text" 
            placeholder="Пошук гравців чи партій..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        {/* Навігаційні кнопки та дзвіночок */}
        <div className={styles.actionsWrapper}>
          
          {/* Збережені партії */}
          <button 
            onClick={() => navigate('/saved-games')}
            className={styles.actionButton}
          >
            📁 Збережені партії
          </button>

          {/* Загальна статистика */}
          <button 
            onClick={() => navigate('/statistics')}
            className={styles.actionButton}
          >
            📊 Статистика
          </button>

          {/* Дзвіночок (Запити в друзі) */}
          <div className={styles.bellContainer}>
            <button 
              onClick={() => setShowFriendRequests(!showFriendRequests)}
              className={styles.bellButton}
            >
              🔔
              {friendRequests.length > 0 && (
                <span className={styles.badge}>
                  {friendRequests.length}
                </span>
              )}
            </button>

            {/* Випадаючий список заявок */}
            {showFriendRequests && (
              <div className={styles.dropdownMenu}>
                <h4 className={styles.dropdownTitle}>Запити в друзі</h4>
                {friendRequests.length === 0 ? (
                  <p className={styles.noRequestsText}>Нових запитів немає</p>
                ) : (
                  <div className={styles.requestList}>
                    {friendRequests.map(req => (
                      <div key={req.id} className={styles.requestItem}>
                        <span className={styles.requestUsername}>{req.username}</span>
                        <div className={styles.requestActions}>
                          <button onClick={() => handleAcceptFriend(req.id)} className={styles.acceptBtn}>✓</button>
                          <button onClick={() => handleRejectFriend(req.id)} className={styles.rejectBtn}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Вихід */}
          <button 
            onClick={handleLogout}
            className={styles.logoutButton}
          >
            Вийти
          </button>
        </div>
      </header>

      {/* --- Основний контент --- */}
      <div className={styles.contentGrid}>
        
        {/* Колонка профілю */}
        <div className={styles.profileCard}>
          
          {/* Круг для аватарки */}
          <div className={styles.avatarCircle}>
            {userInfo?.avatarUrl ? (
              <img src={userInfo.avatarUrl} alt="Avatar" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarFallback}>
                {(userInfo?.username || userInfo?.nickname || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <h3 className={styles.profileName}>{userInfo?.username || userInfo?.nickname || 'Користувач'}</h3>
            <p className={styles.profileEmail}>{userInfo?.email}</p>
          </div>

          <div className={styles.profileInfoDetails}>
            <p className={styles.profileInfoRow}><strong>Приєднався(-лася):</strong> {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : '01.09.2026'}</p>
            <p className={styles.profileInfoRow}><strong>Друзі:</strong> {userInfo?.friendsCount || 0}</p>
          </div>
        </div>

        {/* Колонка контенту: Список шах-ботів */}
        <div className={styles.botsSectionContainer}>
          <div className={styles.botsCard}>
            <h2 className={styles.botsTitle}>Гра з шах-ботами</h2>
            
            <div className={styles.botsList}>
              {chessBots.map(bot => (
                <div key={bot.id} className={styles.botItem}>
                  <div className={styles.botInfo}>
                    <h4 className={styles.botName}>{bot.name}</h4>
                    <p className={styles.botDesc}>{bot.description}</p>
                  </div>
                  <button 
                    onClick={() => navigate(`/game/bot/${bot.id}`)}
                    className={styles.playBotBtn}
                  >
                    Почати гру
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

export default MainPage;