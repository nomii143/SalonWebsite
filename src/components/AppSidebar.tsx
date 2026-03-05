import { NavLink } from "@/components/NavLink";
import logo from "@/assets/logo.png";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Receipt,
  PackagePlus,
  FileText,
  ChevronDown,
  CreditCard,
  PlusCircle,
  Users,
  BarChart3
} from "lucide-react";

// Nav items - "Sales" is now its own independent manual entry page
const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, color: "text-primary" },
  { title: "Inventory", url: "/inventory", icon: Package, color: "text-blue-500" },
  { title: "Sales", url: "/sales", icon: PlusCircle, color: "text-emerald-500" }, //  Sales Page
  { title: "Staff Salaries", url: "/staffsalaries", icon: Users, color: "text-amber-500" },
  { title: "Expenses", url: "/expenses", icon: Receipt, color: "text-destructive" },
  { title: "Reports", url: "/reports", icon: FileText, color: "text-violet-500" },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Inventory section logic (Stock In/Out only)
  const isInventorySection = useMemo(
    () =>
      location.pathname.startsWith("/inventory") ||
      location.pathname.startsWith("/add-stock") ||
      location.pathname.startsWith("/stockout"),
    [location.pathname]
  );

  // Expenses section logic (Daily/Vendors)
  const isExpensesSection = useMemo(
    () =>
      location.pathname.startsWith("/expenses") ||
      location.pathname.startsWith("/vendors"),
    [location.pathname]
  );

  const [isInventoryOpen, setIsInventoryOpen] = useState(isInventorySection);
  const [isExpensesOpen, setIsExpensesOpen] = useState(isExpensesSection);

  useEffect(() => {
    if (isInventorySection) setIsInventoryOpen(true);
    if (isExpensesSection) setIsExpensesOpen(true);
  }, [isInventorySection, isExpensesSection]);

  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen h-screen sticky top-0 bg-sidebar border-r border-sidebar-border shadow-xl">
     {/* Brand Header */}
{/* Brand Header - Seamless White Background */}
<div className="flex items-center gap-4 px-6 py-8 border-b border-sidebar-border bg-white transition-colors duration-300">
  <div className="flex items-center justify-center bg-white">
    <img 
      src={logo} 
      alt="Geeroz Salon" 
      /* Removed all filters and shadows so it blends 
         perfectly with the white background 
      */
      className="w-14 h-14 object-contain" 
    />
  </div>
  
  <div className="flex flex-col">
    <h1 className="font-display text-xl font-extrabold text-slate-900 tracking-tight leading-none">
      Geeroz Salon
    </h1>
    <div className="flex items-center gap-1.5 mt-1.5">
      <span className="h-[1px] w-3 bg-slate-300"></span>
      <p className="text-[9px] uppercase tracking-[0.2em] text-slate-500 font-bold">
        Management
      </p>
    </div>
  </div>
</div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-2">
        {navItems.map((item) => {
          const isInventory = item.url === "/inventory";
          const isExpenses = item.url === "/expenses";
          
          // Logic: Highlight if path matches exactly, or if it's a child of Inventory/Expenses
          const isActive = isInventory 
            ? isInventorySection 
            : isExpenses 
              ? isExpensesSection 
              : location.pathname === item.url;

          return (
            <div key={item.url} className="space-y-1">
              <NavLink
                to={item.url}
                end={!isInventory && !isExpenses} // "Add Sales" will be exact match
                onClick={(event) => {
                  if (isInventory) {
                    event.preventDefault();
                    setIsInventoryOpen((prev) => !prev);
                    if (location.pathname !== "/inventory") navigate("/inventory");
                  }
                  if (isExpenses) {
                    event.preventDefault();
                    setIsExpensesOpen((prev) => !prev);
                    if (location.pathname !== "/expenses") navigate("/expenses");
                  }
                }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-sidebar-accent/50 shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                activeClassName="bg-sidebar-accent/80 ring-1 ring-white/5"
              >
                <item.icon className={`w-4 h-4 transition-colors ${isActive ? item.color : "text-muted-foreground opacity-80"}`} />
                <span className={isActive ? "font-bold" : ""}>{item.title}</span>
                
                {(isInventory || isExpenses) && (
                  <span className="ml-auto">
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-300 opacity-50 ${
                        (isInventory && isInventoryOpen) || (isExpenses && isExpensesOpen) 
                          ? "rotate-180" 
                          : ""
                      }`}
                    />
                  </span>
                )}
              </NavLink>

              {/* Inventory Sub-menu (Standalone Logic) */}
              {isInventory && (
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isInventoryOpen ? "max-h-40 opacity-100 mb-2" : "max-h-0 opacity-0"
                  } ml-6 border-l-2 border-blue-500/20 pl-2 space-y-1`}
                >
                  <NavLink
                    to="/add-stock"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:text-blue-400 transition-colors"
                    activeClassName="text-blue-500 bg-blue-500/5"
                  >
                    <PackagePlus className="w-3.5 h-3.5 text-blue-400" />
                    <span>Stock In</span>
                  </NavLink>
                  <NavLink
                    to="/stockout"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:text-blue-400 transition-colors"
                    activeClassName="text-blue-500 bg-blue-500/5"
                  >
                    <ShoppingCart className="w-3.5 h-3.5 text-blue-400" />
                    <span>Stock Out</span>
                  </NavLink>
                </div>
              )}

              {/* Expenses Sub-menu (Standalone Logic) */}
              {isExpenses && (
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${
                    isExpensesOpen ? "max-h-40 opacity-100 mb-2" : "max-h-0 opacity-0"
                  } ml-6 border-l-2 border-destructive/20 pl-2 space-y-1`}
                >
                  <NavLink
                    to="/expenses"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:text-destructive transition-colors"
                    activeClassName="text-destructive bg-destructive/5"
                  >
                    <Receipt className="w-3.5 h-3.5 text-destructive/80" />
                    <span>Daily Expenses</span>
                  </NavLink>
                  <NavLink
                    to="/vendors"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-sidebar-foreground hover:text-destructive transition-colors"
                    activeClassName="text-destructive bg-destructive/5"
                  >
                    <CreditCard className="w-3.5 h-3.5 text-destructive/80" />
                    <span>Vendor Payments</span>
                  </NavLink>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer Status */}
      <div className="px-6 py-4 border-t border-sidebar-border bg-sidebar-accent/10">
        <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">System Online</p>
        </div>
        <p className="text-[10px] text-muted-foreground/60 mt-1">v1.0.4 • Stable Build</p>
      </div>
    </aside>
  );
}