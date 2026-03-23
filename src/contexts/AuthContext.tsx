import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, login as apiLogin, register as apiRegister, logout as apiLogout, getCurrentUser, setCurrentUser as saveCurrentUser, removeCurrentUser, getToken, setToken, removeToken, mergeCart } from '../lib/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session
    const token = getToken();
    const storedUser = getCurrentUser();
    if (token && storedUser) {
      setUser(storedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    setToken(response.token);
    saveCurrentUser(response.user);
    setUser(response.user);
    
    // Merge cart if session cart exists
    try {
      await mergeCart();
    } catch (e) {
      // Ignore cart merge errors
    }
  };

  const register = async (email: string, password: string, name: string) => {
    const response = await apiRegister(email, password, name);
    setToken(response.token);
    saveCurrentUser(response.user);
    setUser(response.user);
  };

  const logout = () => {
    apiLogout();
    removeToken();
    removeCurrentUser();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
