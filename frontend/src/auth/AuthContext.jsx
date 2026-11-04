import { createContext, useContext, useEffect, useState } from 'react';
import client, { getTokens, setTokens } from '../api/client';

const AuthContext = createContext(null);

// Logout por inatividade — independente da validade do access/refresh token
// (CLAUDE.md: refresh dura 7 dias, então sem isso o usuário ficaria "logado"
// indefinidamente mesmo parado, bastando o interceptor renovar o token na
// próxima requisição). Eventos cobrem mouse, teclado e toque (mobile).
const TEMPO_INATIVIDADE_MS = 5 * 60 * 1000;
const EVENTOS_ATIVIDADE = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];

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

  // Ação dos botões "Sair" — além de limpar a sessão, avisa que foi uma
  // saída voluntária (mensagem/estilo diferentes do logout por inatividade
  // abaixo, que usa ?sessao=expirada).
  function sair() {
    logout();
    window.location.href = '/?sessao=encerrada';
  }

  useEffect(() => {
    if (!usuario) return;

    let timer;
    function resetarTimer() {
      clearTimeout(timer);
      timer = setTimeout(() => {
        logout();
        window.location.href = '/?sessao=expirada';
      }, TEMPO_INATIVIDADE_MS);
    }

    EVENTOS_ATIVIDADE.forEach((evento) => window.addEventListener(evento, resetarTimer));
    resetarTimer();

    return () => {
      clearTimeout(timer);
      EVENTOS_ATIVIDADE.forEach((evento) => window.removeEventListener(evento, resetarTimer));
    };
  }, [usuario]);

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return ctx;
}
