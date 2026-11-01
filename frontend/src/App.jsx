
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom'; 
import api, { setAccessToken } from './api';

import SignUp from './SignUp';
import LogIn from './LogIn';
import MainPage from './MainPage';

import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import './App.css'

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
        } else if (err.response.status === 401) {
          
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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <p>Завантаження..</p>
      </div>
    );
  }

  return (
    <>
      {isServerDown && (
        <div style={{ background: '#201c26', color: '#fff', textAlign: 'center', padding: '8px' }}>
         Сервер тимчасово недоступний. Спробуйте пізніше.
        </div>
      )}
      <Routes>
        <Route path="/" element={<Navigate to="/sign-up" replace />} />

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
          } />
          <Route 
             path="/main-page" 
            element={
              isAuthenticated 
              ? <MainPage setIsAuthenticated={setIsAuthenticated} /> 
              : <Navigate to="/login" replace />
                    } 
  />
           </Routes>
    </>
        );}
export default App
