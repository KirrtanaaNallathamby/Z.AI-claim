import { createContext, useContext, useState, useEffect } from 'react';
import { setSupabaseSession, clearSupabaseSession } from '../api/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('insurance_auth');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUser(parsed.user);
        setToken(parsed.access_token);
        setSupabaseSession(parsed.access_token, parsed.refresh_token);
      } catch {
        localStorage.removeItem('insurance_auth');
      }
    }
    setLoading(false);
  }, []);

  const saveAuth = (data) => {
    const authData = {
      user: data.user,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    };
    localStorage.setItem('insurance_auth', JSON.stringify(authData));
    setUser(data.user);
    setToken(data.access_token);
    setSupabaseSession(data.access_token, data.refresh_token);
  };

  const logout = () => {
    localStorage.removeItem('insurance_auth');
    setUser(null);
    setToken(null);
    clearSupabaseSession();
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, saveAuth, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
