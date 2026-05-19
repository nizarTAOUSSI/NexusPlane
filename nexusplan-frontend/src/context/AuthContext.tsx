import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';
import { store } from '../store';
import { resetDashboardLayout } from '../store/dashboardLayoutSlice';
import { clearNotes } from '../store/notesSlice';
import { clearImages } from '../store/imagesSlice';

export interface UserInfo {
  id: string;
  email: string;
  username: string;
  avatar?: string;
  role: string;
  has_password?: boolean;
  is_superuser?: boolean;
  is_active?: boolean;
}

interface AuthContextType {
  user: UserInfo | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (access: string, refresh: string, userInfo: UserInfo) => void;
  logout: () => void;
  updateUser: (updatedInfo: Partial<UserInfo>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const justLoggedIn = React.useRef(false);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    const storedUser = localStorage.getItem('user_info');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
        setIsAuthenticated(true);
      } catch (e) {
        console.error("Failed to parse user info");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const refreshProfile = async () => {
      if (!token) return;

      if (justLoggedIn.current) {
        justLoggedIn.current = false;
        return;
      }

      try {
        const res = await api.get('/auth/profile/');
        setUser(res.data);
        localStorage.setItem('user_info', JSON.stringify(res.data));
      } catch (e) {
        console.error('Failed to refresh profile', e);
      }
    };

    refreshProfile();
  }, [token]);

  const login = (access: string, refresh: string, userInfo: UserInfo) => {
    justLoggedIn.current = true;
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    localStorage.setItem('user_info', JSON.stringify(userInfo));
    setToken(access);
    setUser(userInfo);
    setIsAuthenticated(true);
  };

  const updateUser = (updatedInfo: Partial<UserInfo>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const newUser = { ...prev, ...updatedInfo };
      localStorage.setItem('user_info', JSON.stringify(newUser));
      return newUser;
    });
  };

  const logout = async () => {
    const access = localStorage.getItem('access_token');
    const refresh = localStorage.getItem('refresh_token');

    store.dispatch(resetDashboardLayout());
    store.dispatch(clearNotes());
    store.dispatch(clearImages());
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);

    if (refresh) {
      void fetch(`${import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'}/auth/logout/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(access ? { Authorization: `Bearer ${access}` } : {}),
        },
        body: JSON.stringify({ refresh }),
      }).catch(() => {
      });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
