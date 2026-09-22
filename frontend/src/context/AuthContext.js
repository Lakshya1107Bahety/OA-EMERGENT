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
    api
      .get("/auth/me")
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem("jc_token");
        setUser(false);
      });
  }, []);

  useEffect(() => {
    document.body.classList.toggle("elderly-mode", elderly);
    localStorage.setItem("jc_elderly", elderly ? "1" : "0");
  }, [elderly]);

  const login = (token, userObj) => {
    localStorage.setItem("jc_token", token);
    setUser(userObj);
  };

  const logout = () => {
    localStorage.removeItem("jc_token");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, elderly, setElderly }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
