'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Cookies from 'js-cookie';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Special admin credentials - in production, this should be in a secure database
const ADMIN_CREDENTIALS = {
  email: 'admintest',
  password: 'demotest',
  user: {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admintest',
    role: 'admin' as const,
  },
};

// Demo user credentials - in production, this should be in a secure database
const DEMO_USERS = [
  {
    email: 'user1',
    password: 'password1',
    user: {
      id: 'user-1',
      name: 'Demo User 1',
      email: 'user1',
      role: 'user' as const,
    },
  },
  {
    email: 'user2',
    password: 'password2',
    user: {
      id: 'user-2',
      name: 'Demo User 2',
      email: 'user2',
      role: 'user' as const,
    },
  },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // Check for stored user data on mount
    const checkAuth = () => {
      const storedUser = Cookies.get('user');
      const storedAuth = Cookies.get('isAuthenticated');
      
      if (storedUser && storedAuth === 'true') {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
          setIsAuthenticated(true);
          setIsAdmin(parsedUser.role === 'admin');
        } catch (error) {
          console.error('Error parsing user data:', error);
          // Clear invalid cookies
          Cookies.remove('user');
          Cookies.remove('isAuthenticated');
        }
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Check for admin credentials
      if (email === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
        setUser(ADMIN_CREDENTIALS.user);
        setIsAuthenticated(true);
        setIsAdmin(true);
        Cookies.set('user', JSON.stringify(ADMIN_CREDENTIALS.user), { expires: 7, path: '/', sameSite: 'lax' });
        Cookies.set('isAuthenticated', 'true', { expires: 7, path: '/', sameSite: 'lax' });
        return;
      }

      // Check for demo user credentials
      const demoUser = DEMO_USERS.find(u => u.email === email && u.password === password);
      if (demoUser) {
        setUser(demoUser.user);
        setIsAuthenticated(true);
        setIsAdmin(false);
        Cookies.set('user', JSON.stringify(demoUser.user), { expires: 7, path: '/', sameSite: 'lax' });
        Cookies.set('isAuthenticated', 'true', { expires: 7, path: '/', sameSite: 'lax' });
        return;
      }

      // If no matching credentials found
      throw new Error('Invalid credentials');
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    setIsAuthenticated(false);
    setIsAdmin(false);
    Cookies.remove('user');
    Cookies.remove('isAuthenticated');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, isAdmin, login, logout, isLoading }}>
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