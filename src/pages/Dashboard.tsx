import React, { useEffect, useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  ShoppingCart, 
  TrendingDown, 
  Package, 
  Moon, 
  Sun, 
  FileText 
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

export default function Dashboard() {
  const [isDark, setIsDark] = useState(true);
  const { items, sales, expenses } = useData();

  // --- Logic Calculations ---
  const totalRevenue = sales.reduce((s, sale) => s + sale.totalAmount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  const normalizeDate = (value: string) => {
    const parsed = new Date(`${value}T00:00:00`);
    parsed.setHours(0, 0, 0, 0);
    return parsed;
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const getStartOfWeekMonday = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    start.setHours(0, 0, 0, 0);
    return start;
  };

  const startThisWeek = getStartOfWeekMonday(today);
  const revenueThisWeek = sales.reduce((sum, sale) => {
    const saleDate = normalizeDate(sale.saleDate);
    return saleDate >= startThisWeek && saleDate <= today ? sum + sale.totalAmount : sum;
  }, 0);

  // --- ENHANCED EXPENSE BREAKDOWN LOGIC ---
  const processedPieData = useMemo(() => {
    const groups = expenses.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {});

    const sorted = Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Grouping logic: Show top 5, rest as "Others"
    if (sorted.length > 6) {
      const top = sorted.slice(0, 5);
      const othersValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
      return [...top, { name: "Others", value: othersValue }];
    }
    return sorted;
  }, [expenses]);

  const totalExpAmount = processedPieData.reduce((sum, item) => sum + item.value, 0);

  // --- CHART DATA PREP ---
  const barData = useMemo(() => {
    const salesByItem = sales.reduce<Record<string, number>>((acc, s) => {
      acc[s.itemName] = (acc[s.itemName] || 0) + s.totalAmount;
      return acc;
    }, {});
    return Object.entries(salesByItem).map(([name, amount]) => ({ 
      name: name.length > 10 ? name.substring(0, 10) + "..." : name, 
      amount 
    }));
  }, [sales]);

  const areaData = useMemo(() => {
    const revenueByDate = sales.reduce<Record<string, number>>((acc, s) => {
      acc[s.saleDate] = (acc[s.saleDate] || 0) + s.totalAmount;
      return acc;
    }, {});
    return Object.entries(revenueByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date: date.slice(5), amount }));
  }, [sales]);

  const PIE_COLORS = ["hsl(38, 70%, 55%)", "hsl(15, 60%, 55%)", "hsl(145, 60%, 42%)", "hsl(200, 60%, 50%)", "hsl(280, 50%, 55%)", "hsl(220, 10%, 50%)"];

  // --- Theme Management ---
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    setIsDark(savedTheme ? savedTheme === "dark" : true);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  // --- Chart Styles ---
  const customTooltipStyle: React.CSSProperties = {
    background: "#000000",
    border: "1px solid hsl(38, 70%, 55%)",
    borderRadius: "8px",
    padding: "10px",
  };

  const customItemStyle: React.CSSProperties = {
    color: "hsl(38, 70%, 55%)",
    fontWeight: "bold",
  };

  return (
    <div className="space-y-8 p-4">
      {/* HEADER SECTION */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your salon performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" className="hidden sm:flex border-primary/20">
            <NavLink to="/reports"><FileText className="mr-2 h-4 w-4 text-primary" /> Reports</NavLink>
          </Button>
          <button onClick={() => setIsDark(!isDark)} className="h-10 w-10 rounded-full border border-border bg-card flex items-center justify-center">
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`Rs ${totalRevenue.toLocaleString()}`} icon={<DollarSign className="w-4 h-4" />} />
        <StatCard title="Total Sales" value={sales.length} icon={<ShoppingCart className="w-4 h-4" />} />
        <StatCard title="Total Expenses" value={`Rs ${totalExpenses.toLocaleString()}`} icon={<TrendingDown className="w-4 h-4" />} />
        <StatCard title="Stock Items" value={totalItems} icon={<Package className="w-4 h-4" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4 text-foreground">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={areaData}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(38, 70%, 55%)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(38, 70%, 55%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="date" stroke="hsl(220, 10%, 50%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} />
              <Tooltip contentStyle={customTooltipStyle} itemStyle={customItemStyle} />
              <Area type="monotone" dataKey="amount" stroke="hsl(38, 70%, 55%)" fill="url(#goldGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Sales by Item */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4 text-foreground">Sales by Item</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 18%)" />
              <XAxis dataKey="name" stroke="hsl(220, 10%, 50%)" fontSize={12} />
              <YAxis stroke="hsl(220, 10%, 50%)" fontSize={12} />
              <Tooltip contentStyle={customTooltipStyle} itemStyle={customItemStyle} cursor={false} />
              <Bar dataKey="amount" fill="hsl(38, 70%, 55%)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* REFACTORED EXPENSE BREAKDOWN */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-card">
          <h3 className="font-display font-semibold mb-6 text-foreground">Expense Breakdown</h3>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative w-full max-w-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie 
                    data={processedPieData} 
                    cx="50%" cy="50%" 
                    innerRadius={60} outerRadius={80} 
                    paddingAngle={5} dataKey="value" stroke="none"
                  >
                    {processedPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} itemStyle={customItemStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase text-muted-foreground">Total</span>
                <span className="text-sm font-bold">Rs {totalExpAmount > 999 ? (totalExpAmount/1000).toFixed(1) + 'k' : totalExpAmount}</span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3">
              {processedPieData.map((entry, i) => (
                <div key={entry.name} className="flex items-center justify-between group">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-sm text-muted-foreground truncate max-w-[100px] group-hover:text-foreground">
                      {entry.name}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-semibold">Rs {entry.value.toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground">{((entry.value / totalExpAmount) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-card">
          <h3 className="font-display font-semibold mb-4 text-foreground">Stock Alerts</h3>
          <div className="space-y-3">
            {items.filter(i => i.quantity < 10).sort((a,b) => a.quantity - b.quantity).slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <span className="text-sm font-medium">{item.name}</span>
                <span className="text-sm font-bold text-destructive">{item.quantity} left</span>
              </div>
            ))}
            {items.filter(i => i.quantity < 10).length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">All items well stocked!</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}