import { createContext, useContext, useEffect, useState } from 'react';
import client, { getTokens, setTokens } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const tokens = getTokens();
    if (!tokens?.access) {
      setCarregando(false);
      return;
    }
    client
      .get('/api/auth/me/')
      .then((resp) => setUsuario(resp.data))
      .catch(() => setTokens(null))
      .finally(() => setCarregando(false));
  }, []);

  async function login(email, senha) {
    const resp = await client.post('/api/auth/login/', { email, password: senha });
    setTokens({ access: resp.data.access, refresh: resp.data.refresh });
    const me = await client.get('/api/auth/me/');
    setUsuario(me.data);
  }

  function logout() {
    setTokens(null);
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
