import { NavLink } from "@/components/NavLink";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  Scissors,
  PackagePlus,
  FileText,
  ChevronDown,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Reports", url: "/reports", icon: FileText },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine if the current path belongs to the Inventory section
  const isInventorySection = useMemo(
    () =>
      location.pathname.startsWith("/inventory") ||
      location.pathname.startsWith("/add-stock") ||
      location.pathname.startsWith("/sales"),
    [location.pathname]
  );

  const [isInventoryOpen, setIsInventoryOpen] = useState(isInventorySection);

  // Sync state if user navigates via browser buttons or direct URL
  useEffect(() => {
    if (isInventorySection) {
      setIsInventoryOpen(true);
    }
  }, [isInventorySection]);

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen h-screen sticky top-0 bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-sidebar-border">
        <div className="w-10 h-10 rounded-lg gradient-gold flex items-center justify-center">
          <Scissors className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="font-display text-lg font-bold text-sidebar-accent-foreground">
            Geroos Salon
          </h1>
          <p className="text-xs text-muted-foreground">Management System</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isInventory = item.url === "/inventory";
          const isActive = isInventory ? isInventorySection : location.pathname === item.url;

          return (
            <div key={item.url}>
              <NavLink
                to={item.url}
                end
                onClick={(event) => {
                  if (isInventory) {
                    event.preventDefault();
                    setIsInventoryOpen((prev) => !prev);
                    // Navigate to main inventory but keep toggle logic separate
                    if (location.pathname !== "/inventory") navigate("/inventory");
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? ""
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                activeClassName="bg-primary/15 text-primary shadow-gold"
              >
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
                {isInventory && (
                  <span className="ml-auto">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        isInventoryOpen ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                )}
              </NavLink>

              {/* Refactored Sub-menu with Smooth Transition */}
              {isInventory && (
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isInventoryOpen ? "max-h-40 opacity-100 mt-2" : "max-h-0 opacity-0"
                  } ml-3 border-l border-sidebar-border pl-3 space-y-1`}
                >
                  <NavLink
                    to="/add-stock"
                    // Removed: setIsInventoryOpen(false) - keeps menu open
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary"
                  >
                    <PackagePlus className="w-3.5 h-3.5" />
                    <span>Stock In</span>
                  </NavLink>
                  <NavLink
                    to="/sales"
                    // Removed: setIsInventoryOpen(false) - keeps menu open
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    activeClassName="bg-primary/10 text-primary"
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    <span>Stock Out</span>
                  </NavLink>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-sidebar-border">
        <p className="text-xs text-muted-foreground">Offline Ready • v1.0</p>
      </div>
    </aside>
  );
}