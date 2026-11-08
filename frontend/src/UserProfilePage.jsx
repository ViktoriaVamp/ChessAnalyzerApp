import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './MainPage.module.css'; 
import api from './api';

function UserProfilePage() {
  const { username } = useParams(); 
  const navigate = useNavigate();
  
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false); 

  
  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const response = await api.get(`/api/user/profile/${username}`);
        setProfile(response.data);
      } catch (error) {
        console.error("Користувача не знайдено:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserProfile();
  }, [username]);

  const handleAddFriend = async () => {
    try {
      await api.post(`/api/user/friends/request`, { friendId: profile.id });
      alert("Запит у друзі надіслано!");
    } catch (error) {
      console.error("Помилка надсилання запиту:", error);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <p>Завантаження профілю гравця...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.loadingContainer}>
        <p>Користувача з нікнеймом <strong>{username}</strong> не знайдено.</p>
        <button onClick={() => navigate('/')} className={styles.playBotBtn} style={{ marginTop: '20px' }}>
          На головну
        </button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      
     
      <header className={styles.header}>
        <div className={styles.searchWrapper}>
          <button onClick={() => navigate('/')} className={styles.actionButton}>
            ⬅ На головну
          </button>
        </div>
      </header>

  
      <div className={styles.contentGrid}>
        
        
        <div className={styles.profileCard}>
          <div className={styles.avatarCircle}>
            {profile?.avatarUrl ? (
              <img src={profile.avatarUrl} alt="Avatar" className={styles.avatarImg} />
            ) : (
              <span className={styles.avatarFallback}>
                {(profile?.username || 'U').charAt(0).toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <h3 className={styles.profileName}>{profile.username}</h3>
            <p className={styles.profileEmail}>{profile.email}</p>
          </div>

          <div className={styles.profileInfoDetails}>
            <p className={styles.profileInfoRow}>
              <strong>Приєднався(-лася):</strong> {new Date(profile.createdAt).toLocaleDateString()}
            </p>
            <p className={styles.profileInfoRow}>
              <strong>Друзі:</strong> {profile.friendsCount || 0}
            </p>
          </div>

    
          <button 
            onClick={handleAddFriend} 
            className={styles.playBotBtn}
            style={{ width: '100%', marginTop: '15px' }}
          >
            ➕ Додати в друзі
          </button>
        </div>

        {/* Колонка контенту (справа) — ТУТ ЗАМІСТЬ БОТІВ ІНФОРМАЦІЯ ПРО КОРИСТУВАЧА */}
        <div className={styles.botsSectionContainer}>
          <div className={styles.botsCard}>
            <h2 className={styles.botsTitle}>Профіль гравця: {profile.username}</h2>
            <p style={{ color: '#aaa', lineHeight: '1.6' }}>
              Тут ви можете переглянути статистику гравця, його останні партії або надіслати йому виклик на шаховий бій.
            </p>
            {/* Тут можна додати список ігор цього користувача чи його досягнення */}
          </div>
        </div>

      </div>
    </div>
  );
}
export default UserProfilePage;