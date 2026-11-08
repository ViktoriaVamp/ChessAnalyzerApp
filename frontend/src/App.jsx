import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; 
import api, { setAccessToken } from './api';

import SignUp from './SignUp';
import LogIn from './LogIn';
import MainPage from './MainPage';
import UserProfilePage from './UserProfilePage';

import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isServerDown, setIsServerDown] = useState(false);

  useEffect(() => {
    const initSession = async () => {
      try {
        const response = await api.post('/api/auth/refresh');
        
        if (response.data?.token) {
          setAccessToken(response.data.token);
          setIsAuthenticated(true);
          setIsServerDown(false);
        }
      } catch (err) {
        if (!err.response) {
          console.warn("Server unavailable. Session is saved.");
          setIsServerDown(true);
        } else {
          setIsAuthenticated(false);
          setAccessToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initSession();

    const handleUnauthorized = () => {
      setIsAuthenticated(false);
      setAccessToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'var(--bg, #111111)', color: 'var(--text, #a9a9a9)' }}>
        <p>Завантаження...</p>
      </div>
    );
  }

  return (
    <>
      {isServerDown && (
        <div style={{ background: 'var(--red-dd, #2a0000)', borderBottom: '1px solid var(--red-l, #610000)', color: 'var(--text, #a9a9a9)', textAlign: 'center', padding: '8px' }}>
          Сервер тимчасово недоступний. Спробуйте пізніше.
        </div>
      )}
      <Routes>
        <Route 
          path="/" 
          element={<Navigate to={isAuthenticated ? "/main-page" : "/login"} replace />} 
        />

        <Route 
          path="/login" 
          element={
            isAuthenticated 
              ? <Navigate to="/main-page" replace /> 
              : <LogIn setIsAuthenticated={setIsAuthenticated} />
          } 
        />

        <Route 
          path="/sign-up" 
          element={
            isAuthenticated 
              ? <Navigate to="/main-page" replace /> 
              : <SignUp setIsAuthenticated={setIsAuthenticated} />
          } 
        />

        <Route 
          path="/main-page" 
          element={
            isAuthenticated 
              ? <MainPage setIsAuthenticated={setIsAuthenticated} /> 
              : <Navigate to="/login" replace />
          } 
        />

        {/* Перехоплення невідомих маршрутів */}
        <Route 
          path="*" 
          element={<Navigate to={isAuthenticated ? "/main-page" : "/login"} replace />} 
        />

        <Route
         path="/user/:username" 
         element={<UserProfilePage />}
         />
      </Routes>
    </>
  );
}

export default App;