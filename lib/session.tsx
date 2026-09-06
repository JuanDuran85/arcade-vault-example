"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { SessionUser } from "./types";
import { createClient } from "./supabase/client";

interface SessionContextType {
  user: SessionUser | null;
  signIn: (
    email: string,
    password: string,
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null }>;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function toSessionUser(u: User): SessionUser {
  return { name: (u.user_metadata?.name as string) ?? u.email ?? "JUGADOR" };
}

// Supabase error messages arrive in English; the login form only shows Spanish.
function translateAuthError(message: string): string {
  if (message.includes("Invalid login credentials"))
    return "Correo o contraseña incorrectos.";
  if (message.includes("User already registered"))
    return "Ya existe una cuenta con ese correo.";
  if (message.includes("Password should be at least"))
    return "La contraseña debe tener al menos 6 caracteres.";
  if (message.includes("Unable to validate email address"))
    return "El correo ingresado no es válido.";
  return "Ocurrió un error. Intentá de nuevo.";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(toSessionUser(data.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ? toSessionUser(session.user) : null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? translateAuthError(error.message) : null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { error: error ? translateAuthError(error.message) : null };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SessionContext.Provider value={{ user, signIn, signUp, logout }}>
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
