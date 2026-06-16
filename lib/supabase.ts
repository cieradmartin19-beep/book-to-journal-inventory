import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const authStorageKey = "book-to-journal-supabase-auth";
const cookieChunkSize = 3000;
let browserClient: SupabaseClient<any, "public", any> | null = null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

function getProjectRef() {
  if (!supabaseUrl) return "";

  try {
    return new URL(supabaseUrl).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

function getCookie(name: string) {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${encodeURIComponent(name)}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

function setCookie(name: string, value: string, maxAge = 60 * 60 * 24 * 365) {
  if (typeof document === "undefined") return;

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

function removeCookie(name: string) {
  setCookie(name, "", 0);
}

function getChunkedCookie(key: string) {
  const chunks = Number(getCookie(`${key}.chunks`) || 0);
  if (!chunks) return getCookie(key);

  let value = "";
  for (let index = 0; index < chunks; index += 1) {
    value += getCookie(`${key}.${index}`) ?? "";
  }
  return value || null;
}

function setChunkedCookie(key: string, value: string) {
  const oldChunks = Number(getCookie(`${key}.chunks`) || 0);
  removeCookie(key);
  for (let index = 0; index < oldChunks; index += 1) {
    removeCookie(`${key}.${index}`);
  }

  const chunks = Math.ceil(value.length / cookieChunkSize);
  setCookie(`${key}.chunks`, String(chunks));
  for (let index = 0; index < chunks; index += 1) {
    setCookie(`${key}.${index}`, value.slice(index * cookieChunkSize, (index + 1) * cookieChunkSize));
  }
}

function removeChunkedCookie(key: string) {
  const chunks = Number(getCookie(`${key}.chunks`) || 0);
  removeCookie(key);
  removeCookie(`${key}.chunks`);
  for (let index = 0; index < chunks; index += 1) {
    removeCookie(`${key}.${index}`);
  }
}

function createSharedAuthStorage() {
  const legacyKey = `sb-${getProjectRef()}-auth-token`;

  return {
    getItem(key: string) {
      if (typeof window === "undefined") return null;

      const cookieValue = getChunkedCookie(key);
      if (cookieValue) return cookieValue;

      const localValue = window.localStorage.getItem(key) || window.localStorage.getItem(legacyKey);
      if (localValue) setChunkedCookie(key, localValue);
      return localValue;
    },
    setItem(key: string, value: string) {
      if (typeof window === "undefined") return;

      window.localStorage.setItem(key, value);
      setChunkedCookie(key, value);
    },
    removeItem(key: string) {
      if (typeof window === "undefined") return;

      window.localStorage.removeItem(key);
      if (legacyKey !== key) window.localStorage.removeItem(legacyKey);
      removeChunkedCookie(key);
    }
  };
}

export function getSupabaseBrowserClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!browserClient) {
    browserClient = createClient<any, "public", any>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: authStorageKey,
        storage: createSharedAuthStorage()
      }
    });
  }

  return browserClient;
}
