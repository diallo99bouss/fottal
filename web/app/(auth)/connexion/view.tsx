"use client";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LogoMark } from "@/components/ui/logo";
import { siteConfig } from "@/config/site";
import { errMsg } from "@/lib/api";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export function ConnexionView() {
  const { user, connecter } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [loading, setLoading] = useState(false);

  // Déjà connecté : direction le tableau de bord
  useEffect(() => {
    if (user) router.replace("/");
  }, [user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErreur("");
    setLoading(true);
    try {
      await connecter(email, motDePasse);
    } catch (ex) {
      setErreur(errMsg(ex));
      setMotDePasse("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md shadow-dropdown animate-fade-in-up">
      <CardHeader className="text-center">
        <LogoMark className="mx-auto mb-3 w-fit" />
        <CardTitle className="text-2xl">{siteConfig.name}</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          Connectez-vous avec votre compte administrateur ou agent.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            placeholder="vous@exemple.fr"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
          {erreur && (
            <p
              role="alert"
              className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              {erreur}
            </p>
          )}
          <Button type="submit" className="w-full" isLoading={loading}>
            Se connecter
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
