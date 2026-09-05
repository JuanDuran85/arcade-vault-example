"use client";

import React, { createContext, useContext, useState } from "react";
import { SessionUser } from "./types";

interface SessionContextType {
  user: SessionUser | null;
  login: (user: SessionUser) => void;
  logout: () => void;
  saveScore: (entry: { game: string; score: number; name: string; at: number }) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(() => {
    try {
      const saved = localStorage.getItem("av_user");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to load session", e);
      return null;
    }
  });

  const login = (userData: SessionUser) => {
    try {
      localStorage.setItem("av_user", JSON.stringify(userData));
      setUser(userData);
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const logout = () => {
    try {
      localStorage.removeItem("av_user");
      setUser(null);
    } catch (e) {
      console.error("Failed to clear session", e);
    }
  };

  const saveScore = (entry: { game: string; score: number; name: string; at: number }) => {
    try {
      const saved = localStorage.getItem("av_scores");
      const scores = saved ? JSON.parse(saved) : [];
      scores.push(entry);
      localStorage.setItem("av_scores", JSON.stringify(scores));
    } catch (e) {
      console.error("Failed to save score", e);
    }
  };

  return (
    <SessionContext.Provider value={{ user, login, logout, saveScore }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
