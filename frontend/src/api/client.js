import axios from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

const TOKENS_KEY = 'forms_meta_tokens';

export function getTokens() {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens) {
  try {
    if (tokens) localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    // localStorage pode falhar (aba anônima, storage bloqueado) — a sessão
    // simplesmente não persiste entre reloads nesse caso.
  }
}

client.interceptors.request.use((config) => {
  const tokens = getTokens();
  if (tokens?.access) {
    config.headers.Authorization = `Bearer ${tokens.access}`;
  }
  return config;
});

let refreshing = null;

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const tokens = getTokens();

    if (error.response?.status !== 401 || original._retry || !tokens?.refresh) {
      return Promise.reject(error);
    }
    original._retry = true;

    try {
      refreshing = refreshing || axios
        .post(`${import.meta.env.VITE_API_URL}/api/auth/refresh/`, { refresh: tokens.refresh })
        .then((resp) => {
          setTokens({ ...tokens, access: resp.data.access });
          return resp.data.access;
        })
        .finally(() => {
          refreshing = null;
        });

      const novoAccess = await refreshing;
      original.headers.Authorization = `Bearer ${novoAccess}`;
      return client(original);
    } catch {
      setTokens(null);
      window.location.href = '/login';
      return Promise.reject(error);
    }
  }
);

export default client;
