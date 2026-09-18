"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
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
  signInWithOAuth: (provider: "google" | "github") => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

function toSessionUser(u: User): SessionUser {
  return { name: (u.user_metadata?.name as string) ?? u.email ?? "JUGADOR" };
}

async function resolveSessionUser(
  supabase: SupabaseClient,
  u: User,
): Promise<SessionUser> {
  const base = toSessionUser(u);
  const { data } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", u.id)
    .single();
  return { ...base, avatarUrl: data?.avatar_url ?? null };
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
  if (message.toLowerCase().includes("rate limit"))
    return "Demasiados intentos. Esperá unos minutos y volvé a intentar.";
  return "Ocurrió un error. Intentá de nuevo.";
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) resolveSessionUser(supabase, data.user).then(setUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user)
        resolveSessionUser(supabase, session.user).then(setUser);
      else setUser(null);
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

  const signInWithOAuth = async (provider: "google" | "github") => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
  };

  const resetPasswordForEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?next=/actualizar-password`,
    });
    return { error: error ? translateAuthError(error.message) : null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    return { error: error ? translateAuthError(error.message) : null };
  };

  return (
    <SessionContext.Provider
      value={{
        user,
        signIn,
        signUp,
        logout,
        signInWithOAuth,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
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
