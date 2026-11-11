import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

// Crédit obligatoire selon la licence DropX Admin (web/LICENSE) : ne pas retirer ni masquer
export function BrandCredit({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-muted-foreground", className)}>
      Designed &amp; developed by{" "}
      <a
        href={siteConfig.developer.url}
        target="_blank"
        rel="noopener"
        className="font-semibold text-brand transition-colors hover:text-brand/80 hover:underline"
      >
        {siteConfig.developer.name}
      </a>{" "}
      &bull; Distributed by{" "}
      <a
        href={siteConfig.distributor.url}
        target="_blank"
        rel="noopener"
        className="font-semibold text-brand transition-colors hover:text-brand/80 hover:underline"
      >
        {siteConfig.distributor.name}
      </a>
    </p>
  );
}

export function Footer() {
  return (
    <footer className="mt-8 flex flex-col gap-2 border-t border-border/80 pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
      <span>
        &copy; {new Date().getFullYear()} {siteConfig.name}
      </span>
      <BrandCredit />
    </footer>
  );
}
