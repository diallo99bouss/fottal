import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";
import { Wallet } from "lucide-react";

interface LogoMarkProps {
  className?: string;
  showWordmark?: boolean;
}

export function LogoMark({ className, showWordmark = true }: LogoMarkProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-teal-500 text-white shadow-card">
        <Wallet className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      {showWordmark && (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-none text-foreground">
            {siteConfig.shortName}
          </p>
          <p className="mt-1 truncate text-2xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Association
          </p>
        </div>
      )}
    </div>
  );
}
