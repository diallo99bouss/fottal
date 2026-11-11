"use client";

import { api, SESSION_EXPIREE } from "@/lib/api";
import type { Utilisateur } from "@/types";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AuthContext {
  // undefined = vérification en cours, null = non connecté
  user: Utilisateur | null | undefined;
  isAdmin: boolean;
  connecter: (email: string, motDePasse: string) => Promise<void>;
  deconnecter: () => Promise<void>;
}

const Ctx = createContext<AuthContext | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Utilisateur | null | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    api<Utilisateur>("GET", "/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
    const expiree = () => setUser(null);
    window.addEventListener(SESSION_EXPIREE, expiree);
    return () => window.removeEventListener(SESSION_EXPIREE, expiree);
  }, []);

  const connecter = useCallback(async (email: string, motDePasse: string) => {
    const u = await api<Utilisateur>("POST", "/auth/login", { email, motDePasse });
    setUser(u);
  }, []);

  const deconnecter = useCallback(async () => {
    await api("POST", "/auth/logout").catch(() => {});
    setUser(null);
    router.replace("/connexion");
  }, [router]);

  return (
    <Ctx.Provider value={{ user, isAdmin: user?.role === "admin", connecter, deconnecter }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return c;
}
