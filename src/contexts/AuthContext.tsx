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

// Keep a single hardcoded backdoor admin for bootstrapping if DB is empty
const BOOTSTRAP_ADMIN = { email: 'admintest', password: 'demotest' };

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
      // Try server-side auth first
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const { user } = await res.json();
        setUser(user);
        setIsAuthenticated(true);
        setIsAdmin(user.role === 'admin');
        Cookies.set('user', JSON.stringify(user), { expires: 7, path: '/', sameSite: 'lax' });
        Cookies.set('isAuthenticated', 'true', { expires: 7, path: '/', sameSite: 'lax' });
        return;
      }

      // Fallback bootstrap admin
      if (email === BOOTSTRAP_ADMIN.email && password === BOOTSTRAP_ADMIN.password) {
        const bootstrapUser = { id: 'bootstrap-admin', name: 'Admin', email, role: 'admin' as const };
        setUser(bootstrapUser);
        setIsAuthenticated(true);
        setIsAdmin(true);
        Cookies.set('user', JSON.stringify(bootstrapUser), { expires: 7, path: '/', sameSite: 'lax' });
        Cookies.set('isAuthenticated', 'true', { expires: 7, path: '/', sameSite: 'lax' });
        return;
      }

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