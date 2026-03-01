import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, PlusCircle, ShoppingCart, Receipt, Users, X, Scissors, FileText,
} from "lucide-react";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Stock In", url: "/add-stock", icon: PlusCircle },
  { title: "Stock Out", url: "/stockout", icon: ShoppingCart },
  { title: "Sales", url: "/sales", icon: PlusCircle },
  { title: "Staff Salaries", url: "/staffsalaries", icon: Users },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Reports", url: "/reports", icon: FileText },
];

export function AppMobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar border-r border-sidebar-border flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-primary" />
            <span className="font-display font-bold text-sidebar-accent-foreground">Geeroz Salon</span>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted">
            <X className="w-4 h-4" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive ? "" : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
                activeClassName="bg-primary/15 text-primary"
              >
                <item.icon className="w-4 h-4" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
