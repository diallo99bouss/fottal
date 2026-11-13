import { cn } from "@/lib/utils";
import Image from "next/image";

interface LogoMarkProps {
  className?: string;
  showWordmark?: boolean;
  size?: "md" | "lg";
}

// Emblème FOTTAL + nom. Le nom est du texte (et non l'image) pour rester lisible en mode sombre.
export function LogoMark({ className, showWordmark = true, size = "md" }: LogoMarkProps) {
  const lg = size === "lg";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Image
        src="/brand/fottal-embleme.png"
        alt={showWordmark ? "" : "Fottal"}
        width={lg ? 56 : 40}
        height={lg ? 56 : 40}
        priority
        className={cn("shrink-0", lg ? "h-14 w-14" : "h-10 w-10")}
      />
      {showWordmark && (
        <p
          className={cn(
            "min-w-0 truncate font-extrabold leading-none tracking-[0.12em] text-[#1A7F52] dark:text-[#4CC38A]",
            lg ? "text-2xl" : "text-xl",
          )}
        >
          FOTTAL
        </p>
      )}
    </div>
  );
}

// Logo complet (emblème au-dessus du nom), pour la page de connexion.
// En mode sombre, le vert foncé du nom manque de contraste : on affiche alors LogoMark.
export function LogoComplet({ className }: { className?: string }) {
  return (
    <div className={cn("flex justify-center", className)}>
      <Image
        src="/brand/fottal-logo.png"
        alt="Fottal"
        width={560}
        height={481}
        priority
        className="h-auto w-40 dark:hidden"
      />
      <LogoMark size="lg" className="hidden dark:flex" />
    </div>
  );
}
