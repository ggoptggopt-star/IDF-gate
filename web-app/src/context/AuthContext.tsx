'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  users: User[];
  isLoading: boolean;
  rememberDevice: boolean;
  setRememberDevice: (val: boolean) => void;
  login: (username: string, password?: string, remember?: boolean) => Promise<boolean>;
  loginWithFace: (userId?: string, remember?: boolean) => Promise<boolean>;
  switchRole: (identifier: string) => void;
  logout: () => void;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [rememberDevice, setRememberDevice] = useState<boolean>(true);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/auth/users');
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
        return data.users;
      }
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
    return [];
  };

  useEffect(() => {
    async function initAuth() {
      setIsLoading(true);
      const allUsers = await fetchUsers();

      // Check if user has explicitly logged out on this device
      const isLoggedOut = typeof window !== 'undefined' ? localStorage.getItem('sgp_logged_out') === 'true' : false;
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('sgp_user_id') : null;

      // 1. If user previously logged in and has saved ID (Remember Device):
      if (!isLoggedOut && savedUserId && allUsers.length > 0) {
        const found = allUsers.find((u: User) => u.id === savedUserId);
        if (found) {
          setUser(found);
          setIsLoading(false);
          return;
        }
      }

      // 2. If user is explicitly logged out or has no saved session:
      // Stay logged out (user = null) so user can see login screen!
      setUser(null);
      setIsLoading(false);
    }

    initAuth();
  }, []);

  const login = async (username: string, password = '', remember = true): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        if (typeof window !== 'undefined') {
          if (remember) {
            localStorage.setItem('sgp_user_id', data.user.id);
            localStorage.setItem('sgp_remember_device', 'true');
          } else {
            sessionStorage.setItem('sgp_user_id', data.user.id);
            localStorage.removeItem('sgp_user_id');
          }
          localStorage.removeItem('sgp_logged_out');
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const loginWithFace = async (userId?: string, remember = true): Promise<boolean> => {
    const targetUser = userId
      ? users.find((u) => u.id === userId)
      : users.find((u) => u.role === 'student');

    if (targetUser) {
      setUser(targetUser);
      if (typeof window !== 'undefined') {
        if (remember) {
          localStorage.setItem('sgp_user_id', targetUser.id);
          localStorage.setItem('sgp_remember_device', 'true');
        } else {
          sessionStorage.setItem('sgp_user_id', targetUser.id);
          localStorage.removeItem('sgp_user_id');
        }
        localStorage.removeItem('sgp_logged_out');
      }
      return true;
    }
    return false;
  };

  const switchRole = (identifier: string) => {
    // identifier can be role name or user ID
    let found = users.find((u) => u.id === identifier);
    if (!found) {
      found = users.find((u) => u.role === identifier);
    }
    if (found) {
      setUser(found);
      if (typeof window !== 'undefined') {
        localStorage.setItem('sgp_user_id', found.id);
        localStorage.removeItem('sgp_logged_out');
        localStorage.setItem('sgp_remember_device', 'true');
      }
    }
  };

  const logout = () => {
    setUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sgp_user_id');
      sessionStorage.removeItem('sgp_user_id');
      localStorage.setItem('sgp_logged_out', 'true');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        isLoading,
        rememberDevice,
        setRememberDevice,
        login,
        loginWithFace,
        switchRole,
        logout,
        refreshUsers: async () => {
          await fetchUsers();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
