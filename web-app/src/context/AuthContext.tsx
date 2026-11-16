'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, UserRole } from '@/types';

interface AuthContextType {
  user: User | null;
  users: User[];
  isLoading: boolean;
  login: (username: string, password?: string) => Promise<boolean>;
  loginWithFace: (userId?: string) => Promise<boolean>;
  switchRole: (identifier: string) => void;
  logout: () => void;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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
      
      // Try to load saved user from localStorage
      const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('sgp_user_id') : null;
      if (savedUserId && allUsers.length > 0) {
        const found = allUsers.find((u: User) => u.id === savedUserId);
        if (found) {
          setUser(found);
          setIsLoading(false);
          return;
        }
      }

      // Default user is student นายอัครชา เปมะวิภาต (หัวหน้าผู้จัดทำ)
      const defaultUser = allUsers.find((u: User) => u.username === '6731901001') || allUsers[0];
      if (defaultUser) {
        setUser(defaultUser);
        localStorage.setItem('sgp_user_id', defaultUser.id);
      }
      setIsLoading(false);
    }

    initAuth();
  }, []);

  const login = async (username: string, password = ''): Promise<boolean> => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        setUser(data.user);
        localStorage.setItem('sgp_user_id', data.user.id);
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  const loginWithFace = async (userId?: string): Promise<boolean> => {
    const targetUser = userId 
      ? users.find((u) => u.id === userId)
      : users.find((u) => u.role === 'student');
      
    if (targetUser) {
      setUser(targetUser);
      localStorage.setItem('sgp_user_id', targetUser.id);
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
      localStorage.setItem('sgp_user_id', found.id);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('sgp_user_id');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        users,
        isLoading,
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
