"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SessionUser } from "./types";

interface SessionContextType {
  user: SessionUser | null;
  login: (name: string) => void;
  logout: () => void;
  saveScore: (entry: { game: string; score: number; name: string; at: number }) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("av_user");
      if (saved) setUser(JSON.parse(saved));
    } catch (e) {
      console.error("Failed to load session", e);
    }
  }, []);

  const login = (name: string) => {
    const newUser = { name };
    setUser(newUser);
    try {
      localStorage.setItem("av_user", JSON.stringify(newUser));
    } catch (e) {
      console.error("Failed to save session", e);
    }
  };

  const logout = () => {
    setUser(null);
    try {
      localStorage.removeItem("av_user");
    } catch (e) {
      console.error("Failed to remove session", e);
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
