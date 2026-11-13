"use client";

import { api, SESSION_EXPIREE } from "@/lib/api";
import type { AssociationInfo, Utilisateur } from "@/types";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface AuthContext {
  // undefined = vérification en cours, null = non connecté
  user: Utilisateur | null | undefined;
  isAdmin: boolean; // président de son association
  isSuperAdmin: boolean; // administrateur de l'application
  association: AssociationInfo | null; // association de l'utilisateur (null pour le super-admin)
  connecter: (email: string, motDePasse: string) => Promise<Utilisateur>;
  deconnecter: () => Promise<void>;
  rafraichir: () => Promise<void>; // relit le profil (ex. après un changement de réglages)
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
    return u;
  }, []);

  const deconnecter = useCallback(async () => {
    await api("POST", "/auth/logout").catch(() => {});
    setUser(null);
    router.replace("/connexion");
  }, [router]);

  const rafraichir = useCallback(async () => {
    const u = await api<Utilisateur>("GET", "/auth/me").catch(() => null);
    setUser(u);
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        isAdmin: user?.role === "admin",
        isSuperAdmin: user?.role === "superadmin",
        association: user?.association ?? null,
        connecter,
        deconnecter,
        rafraichir,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return c;
}
