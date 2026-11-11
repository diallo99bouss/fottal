import { BrandCredit } from "@/components/layout/footer";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 items-center justify-center p-4">{children}</div>
      <footer className="flex justify-center px-4 pb-4">
        <BrandCredit />
      </footer>
    </div>
  );
}
