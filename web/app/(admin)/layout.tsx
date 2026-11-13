"use client";

import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { useAuth } from "@/components/providers/auth-provider";
import { Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

// Toutes les pages exigent d'être connecté. Chacun reste dans son espace :
//   super-admin -> /super (administration) ; comptes d'association -> leur caisse
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isSuperAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const espaceSuper = pathname === "/super" || pathname.startsWith("/super/");
  const mauvaisEspace = !!user && isSuperAdmin !== espaceSuper;

  useEffect(() => {
    if (user === null) router.replace("/connexion");
    else if (mauvaisEspace) router.replace(isSuperAdmin ? "/super" : "/");
  }, [user, mauvaisEspace, isSuperAdmin, router]);

  if (!user || mauvaisEspace) {
    return (
      <div role="status" className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Chargement…</span>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
          <Footer />
        </main>
      </div>
    </div>
  );
}
