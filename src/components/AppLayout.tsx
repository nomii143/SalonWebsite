import { ReactNode, useEffect, useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { Menu, X } from "lucide-react";
import { AppMobileNav } from "@/components/AppMobileNav";
import logo from "@/assets/logo.png";

export function AppLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const applyTheme = async () => {
      const root = document.documentElement;
      const isElectron = Boolean(window.electronAPI);

      if (!isElectron) {
        root.classList.add("light");
        return;
      }

      const setting = await window.electronAPI.getSetting("theme");
      const savedTheme = setting?.value === "dark" ? "dark" : "light";

      if (!setting) {
        await window.electronAPI.setSetting("theme", "light");
      }

      root.classList.toggle("light", savedTheme !== "dark");
    };

    applyTheme().catch((error) => {
      console.error("Failed to load theme from SQLite", error);
      document.documentElement.classList.add("light");
    });
  }, []);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <AppMobileNav open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <img src={logo} alt="Geeroz Salon" className="w-6 h-6 object-contain" />
            <h1 className="font-display text-lg font-bold text-primary">Geeroz Salon</h1>
          </div>
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
