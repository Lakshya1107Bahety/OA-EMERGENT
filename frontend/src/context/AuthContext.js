import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // null = loading, false = logged out
  const [elderly, setElderly] = useState(localStorage.getItem("jc_elderly") === "1");

  useEffect(() => {
    const token = localStorage.getItem("jc_token");
    if (!token) {
      setUser(false);
      return;
    }

    // Always attempt to restore from cache immediately so the UI doesn't block
    const restoreCachedUser = () => {
      try {
        const cached = JSON.parse(localStorage.getItem("jc_user"));
        if (cached) { setUser(cached); return true; }
      } catch (e) {}
      return false;
    };

    // Demo / local tokens never need a network call
    if (token.startsWith("demo_token_") || token.startsWith("local_token_")) {
      if (!restoreCachedUser()) setUser(false);
      return;
    }

    // Real JWT token — try to refresh from backend with a short timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      // Fallback: restore from cache so the user isn't kicked out
      if (!restoreCachedUser()) setUser(false);
    }, 4000);

    api
      .get("/auth/me", { signal: controller.signal })
      .then((res) => {
        clearTimeout(timeout);
        setUser(res.data);
        localStorage.setItem("jc_user", JSON.stringify(res.data));
      })
      .catch((err) => {
        clearTimeout(timeout);
        if (err?.code === "ERR_CANCELED") return; // timeout already handled
        if (!restoreCachedUser()) {
          localStorage.removeItem("jc_token");
          setUser(false);
        }
      });

    return () => { clearTimeout(timeout); controller.abort(); };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("elderly-mode", elderly);
    localStorage.setItem("jc_elderly", elderly ? "1" : "0");
  }, [elderly]);

  const login = (token, userObj) => {
    localStorage.setItem("jc_token", token);
    localStorage.setItem("jc_user", JSON.stringify(userObj));
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem("jc_token");
    localStorage.removeItem("jc_user");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, elderly, setElderly }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
