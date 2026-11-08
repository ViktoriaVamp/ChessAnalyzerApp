import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './MainPage.module.css';
import api, { setAccessToken } from './api';
import ChessGameModal from "./ChessGameModal";

function MainPage({ setIsAuthenticated }) {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBot, setSelectedBot] = useState(null);

  const [showFriendRequests, setShowFriendRequests] = useState(false);
  const [friendRequests, setFriendRequests] = useState([]);


  const [searchQuery, setSearchQuery] = useState('');

  // Список шах-ботів
  const chessBots = [
    { id: 1, name: 'Бот Новачок (Ело ~400)', elo: 400, description: 'Спокійний гравець, який іноді робить прості тактичні помилки. Ідеально для розігріву.' },
    { id: 2, name: 'Бот Любитель (Ело ~800)',elo: 800, description: 'Агресивний бот, що шукає можливості для виграшу матеріалу та гострих атак.' },
    { id: 3, name: 'Бот Тактик (Ело ~1200)',elo: 1200, description: 'Безкомпромісний суперник із глибоким прорахунком ходів. Виклик для досвідчених гравців.' },
    { id: 4, name: 'Бот Експерт (Ело ~1600)', elo: 1600, description: 'Безкомпромісний суперник із глибоким прорахунком ходів. Виклик для досвідчених гравців.' },
    { id: 5, name: 'Бот Майстер (Ело ~2000)',elo: 2000, description: 'Безкомпромісний суперник із глибоким прорахунком ходів. Виклик для досвідчених гравців.' }
  ];

  useEffect(() => {
    const fetchUserData = async () => {
      try {
       
        const [profileResponse, requestsResponse] = await Promise.all([
          api.get('/api/user/profile'),
          api.get('/api/user/friend-requests') 
        ]);

        setUserInfo(profileResponse.data);
        setFriendRequests(requestsResponse.data);
      } catch (error) {
        console.error("Не вдалося завантажити дані сторінки:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, []);

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

 const handleAcceptFriend = async (id) => {
    try {
      await api.post(`/api/user/friends/${id}/accept`); 
      
      setFriendRequests(prev => prev.filter(req => req.id !== id));
      
      const profileResponse = await api.get('/api/user/profile');
      setUserInfo(profileResponse.data);
    } catch (error) {
      console.error("Помилка при прийнятті запиту:", error.response?.status, error.response?.data);
    }
  };

  const handleRejectFriend = async (id) => {
    try {
      await api.delete(`/api/friends/reject/{senderId}`); 
      
      setFriendRequests(prev => prev.filter(req => req.id !== id));
    } catch (error) {
      console.error("Помилка при відхиленні запиту в друзі:", error);
    }
  };

  const handleSearchKeyDown = (e) => {
  if (e.key === 'Enter' && searchQuery.trim()) {
  
    navigate(`/user/${searchQuery.trim()}`);
  }
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
      
     
      <header className={styles.header}>
        
      
        <div className={styles.searchWrapper}>
          <input 
            type="text" 
            placeholder="Пошук гравців чи партій..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className={styles.searchInput}
          />
        </div>

       <div className={styles.actionsWrapper}>
          
        
          <button 
            onClick={() => navigate('/saved-games')}
            className={styles.actionButton}
          >
            📁 Збережені партії
          </button>

        
          <button 
            onClick={() => navigate('/statistics')}
            className={styles.actionButton}
          >
            📊 Статистика
          </button>

         
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
            <p className={styles.profileInfoRow}>
              <strong>Приєднався(-лася):</strong> {userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleDateString() : '01.09.2026'}
            </p>
            <p className={styles.profileInfoRow}>
              <strong>Друзі:</strong> {userInfo?.friendsCount || 0}
            </p>
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
                    onClick={() => setSelectedBot(bot)}
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

      {/* --- Модальне вікно шахової партії --- */}
      {selectedBot && (
        <ChessGameModal
          bot={selectedBot}
          user={userInfo}
          onClose={() => setSelectedBot(null)}
        />
      )}

    </div>
  );
}

export default MainPage;