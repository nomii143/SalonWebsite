import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu, X } from "lucide-react";
import { AppMobileNav } from "@/components/AppMobileNav";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedTheme = window.localStorage.getItem("theme");
    const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
    const isDark = savedTheme ? savedTheme === "dark" : !prefersLight;
    const root = document.documentElement;
    root.classList.toggle("light", !isDark);
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <AppMobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border">
          <h1 className="font-display text-lg font-bold text-primary">Geroos Salon</h1>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-muted">
            <Menu className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 p-4 md:p-8 overflow-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
