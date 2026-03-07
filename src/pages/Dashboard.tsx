import React, { useEffect, useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { 
  ShoppingCart, 
  TrendingDown, 
  Package, 
  FileText,
  CreditCard 
} from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";

export default function Dashboard() {
  const { items, sales, stockouts, expenses, salaryPayments } = useData();
  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI);
  const [dashboardSummary, setDashboardSummary] = useState<ElectronDashboardSummary | null>(null);

  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long' });
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  // --- Logic Calculations ---
  const monthlySales = sales.reduce((sum, sale) => {
    const saleDate = new Date(sale.saleDate);
    if (saleDate.getMonth() === currentMonth && saleDate.getFullYear() === currentYear) {
      return sum + Number(sale.totalAmount || 0);
    }
    return sum;
  }, 0);

  const monthlyExpenses = expenses.reduce((sum, e) => {
    if (e.source === "vendor_payment") return sum;
    const expDate = new Date(e.date);
    if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);

  // Include salary payments in expenses
  console.log("[Dashboard] Total salary payments in system:", salaryPayments.length);
  console.log("[Dashboard] All salary payments:", salaryPayments);
  
  const monthlySalaryExpenses = salaryPayments.reduce((sum, p) => {
    const payDate = new Date(p.date);
    if (payDate.getMonth() === currentMonth && payDate.getFullYear() === currentYear) {
      console.log("[Dashboard] Including payment:", p.id, p.staffName, p.amount);
      return sum + Number(p.amount || 0);
    }
    return sum;
  }, 0);
  
  console.log("[Dashboard] Total monthly salary expenses:", monthlySalaryExpenses);

  // Total expenses includes both regular expenses and salary payments
  const totalMonthlyExpenses = monthlyExpenses + monthlySalaryExpenses;

  const vendorPayments = expenses.reduce((sum, e) => {
    if (e.source !== "vendor_payment") return sum;
    const expDate = new Date(e.date);
    if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
      return sum + Number(e.amount || 0);
    }
    return sum;
  }, 0);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  useEffect(() => {
    if (!isElectron) return;
    const loadSummary = async () => {
      try {
        const summary = await window.electronAPI.getDashboardSummary();
        setDashboardSummary(summary);
      } catch (error) {
        console.error("Failed to load SQL dashboard summary", error);
      }
    };
    loadSummary();
  }, [isElectron, sales.length, expenses.length, salaryPayments.length, items.length]);

  const summarySales = dashboardSummary?.monthlySales ?? monthlySales;
  const summaryExpenses = dashboardSummary?.totalMonthlyExpenses ?? totalMonthlyExpenses;
  const summaryVendorPayments = dashboardSummary?.monthlyVendorPayments ?? vendorPayments;
  const summaryTotalItems = dashboardSummary?.totalItems ?? totalItems;


  // Sales Graph filtered by Current Month
  const salesSequenceData = useMemo(() => {
    return [...sales]
      .filter(sale => {
        const d = new Date(sale.saleDate);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .sort((a, b) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
      .map((sale, index) => ({
        index: `Sale ${index + 1}`,
        amount: Number(sale.totalAmount || 0),
        date: new Date(sale.saleDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      }));
  }, [sales, currentMonth, currentYear]);

  // Stock-out Graph filtered by Current Month
  const barData = useMemo(() => {
    const outByItem = stockouts.reduce<Record<string, number>>((acc, s) => {
      const d = new Date(s.date);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        acc[s.itemName] = (acc[s.itemName] || 0) + (Number(s.quantity) || 1);
      }
      return acc;
    }, {});
    return Object.entries(outByItem).map(([name, quantity]) => ({
      name: name.length > 10 ? name.substring(0, 10) + "..." : name,
      quantity
    }));
  }, [stockouts, currentMonth, currentYear]);

  const processedPieData = useMemo(() => {
    const groups = expenses.reduce<Record<string, number>>((acc, e) => {
      if (e.source === "vendor_payment") return acc;
      const expDate = new Date(e.date);
      if (expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear) {
        acc[e.category] = (acc[e.category] || 0) + Number(e.amount || 0);
      }
      return acc;
    }, {});
    const sorted = Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (sorted.length > 6) {
      const top = sorted.slice(0, 5);
      const othersValue = sorted.slice(5).reduce((sum, item) => sum + item.value, 0);
      return [...top, { name: "Others", value: othersValue }];
    }
    return sorted;
  }, [expenses, currentMonth, currentYear]);

  const totalExpAmount = processedPieData.reduce((sum, item) => sum + item.value, 0);

  // --- Theme & Tooltip Styles ---
  const GOLD_COLOR = "hsl(38, 70%, 55%)";

  const customTooltipStyle: React.CSSProperties = {
    backgroundColor: "#ffffff",
    border: `1px solid ${GOLD_COLOR}`,
    borderRadius: "12px",
    padding: "12px",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
  };

  const customLabelStyle: React.CSSProperties = {
    color: "#1e293b",
    fontWeight: "700",
    fontSize: "12px",
    marginBottom: "4px",
    textTransform: "uppercase"
  };

  const customItemStyle: React.CSSProperties = {
    color: GOLD_COLOR,
    fontWeight: "bold",
    fontSize: "13px"
  };

  const CardTitle = ({ main, sub }: { main: string; sub: string }) => (
    <div className="flex flex-col">
      <span className="font-bold">{main}</span>
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {sub}
      </span>
    </div>
  );

  return (
    <div className="space-y-8 p-4 bg-background min-h-screen">
      {/* HEADER SECTION */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your salon performance</p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" className="hidden sm:flex border-primary/20 hover:bg-primary/5">
            <NavLink to="/reports">
              <FileText className="mr-2 h-4 w-4 text-primary" /> Reports
            </NavLink>
          </Button>
        </div>
      </div>

      {/* TOP STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title={<CardTitle main="Total Sales" sub={`${monthName} ${currentYear}`} />} 
          value={`Rs ${summarySales.toLocaleString()}`} 
          icon={<ShoppingCart className="w-4 h-4 text-primary" />} 
        />
        <StatCard 
          title={<CardTitle main="Total Expenses" sub={`${monthName} ${currentYear}`} />} 
          value={`Rs ${summaryExpenses.toLocaleString()}`} 
          icon={<TrendingDown className="w-4 h-4 text-destructive" />} 
        />
        <StatCard 
          title={<CardTitle main="Vendor Payments" sub={`${monthName} ${currentYear}`} />} 
          value={`Rs ${summaryVendorPayments.toLocaleString()}`} 
          icon={<CreditCard className="w-4 h-4 text-blue-500" />} 
        />
        <StatCard 
          title={<CardTitle main="Stock Items" sub="Current Inventory" />} 
          value={summaryTotalItems} 
          icon={<Package className="w-4 h-4 text-orange-500" />} 
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOTAL SALES AREA CHART */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          <div className="flex flex-col mb-6">
            <h3 className="font-display font-semibold text-foreground">Total Sales</h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{monthName} {currentYear}</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={salesSequenceData}>
              <defs>
                <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={GOLD_COLOR} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={GOLD_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `${val/1000}k`} />
              <Tooltip 
                contentStyle={customTooltipStyle} 
                itemStyle={customItemStyle} 
                labelStyle={customLabelStyle}
              />
              <Area type="monotone" dataKey="amount" stroke={GOLD_COLOR} fill="url(#goldGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Stock-out Items */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          <div className="flex flex-col mb-6">
            <h3 className="font-display font-semibold text-foreground">Stock-out Items</h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{monthName} {currentYear}</p>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={customTooltipStyle} 
                itemStyle={customItemStyle} 
                labelStyle={customLabelStyle}
                cursor={{ fill: 'rgba(212, 163, 74, 0.05)' }}
                formatter={(value: number) => [`${value} Units`, 'Quantity']}
              />
              <Bar dataKey="quantity" fill={GOLD_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Breakdown */}
        <div className="rounded-xl bg-card border border-border p-5 shadow-sm">
          <div className="flex flex-col mb-6">
            <h3 className="font-display font-semibold text-foreground">Total Daily Expenses Breakdown</h3>
            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{monthName} {currentYear}</p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative w-full max-w-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie 
                    data={processedPieData} 
                    cx="50%" cy="50%" 
                    innerRadius={64} outerRadius={80} 
                    paddingAngle={4} dataKey="value" stroke="none"
                  >
                    {processedPieData.map((_, i) => (
                      <Cell 
                        key={i} 
                        fill={["#2DD4BF", "#FB923C", "#818CF8", "#F472B6", "#A78BFA", "#94A3B8"][i % 6]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ ...customTooltipStyle, border: 'none' }} 
                    itemStyle={customItemStyle} 
                    labelStyle={customLabelStyle}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[9px] uppercase text-muted-foreground font-bold">Total</span>
                <span className="text-sm font-extrabold text-foreground">
                  Rs {totalExpAmount > 999 ? (totalExpAmount/1000).toFixed(1) + 'k' : totalExpAmount}
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-3.5">
              {processedPieData.length > 0 ? (
                processedPieData.map((entry, i) => (
                  <div key={entry.name} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-[4px] shrink-0" style={{ backgroundColor: ["#2DD4BF", "#FB923C", "#818CF8", "#F472B6", "#A78BFA", "#94A3B8"][i % 6] }} />
                      <span className="text-[13px] text-muted-foreground truncate max-w-[110px] group-hover:text-foreground font-medium transition-colors">
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[13px] font-bold text-foreground">Rs {entry.value.toLocaleString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground italic">No expenses recorded for {monthName}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stock Alerts */}
      {/* Stock Alerts - Item Names with Golden Background */}
<div className="rounded-xl bg-amber-50/50 border border-amber-200/50 p-5 shadow-sm transition-all duration-300">
  <h3 className="font-display font-semibold mb-4 text-foreground flex items-center gap-2">
    Stock Alerts <span className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full animate-pulse">Low!</span>
  </h3>
  <div className="space-y-3">
    {items.filter(i => i.quantity < 10).sort((a,b) => a.quantity - b.quantity).slice(0, 5).map(item => (
      <div 
        key={item.id} 
        className="flex items-center justify-between py-2 border-b border-amber-100/50 last:border-0 hover:bg-amber-100/40 px-3 rounded-lg transition-all duration-200 group"
      >
        {/* Item Name with Golden BG */}
        <span className="text-[13px] font-semibold bg-amber-100/80 text-amber-900 px-3 py-1 rounded-md group-hover:bg-amber-200 transition-colors duration-200 shadow-sm">
          {item.name}
        </span>

        <div className="flex items-center gap-2">
          <div className={`h-1.5 w-1.5 rounded-full ${item.quantity < 5 ? 'bg-destructive animate-pulse' : 'bg-amber-500'}`} />
          <span className={`text-sm font-bold ${item.quantity < 5 ? 'text-destructive' : 'text-amber-700'}`}>
            {item.quantity} left
          </span>
        </div>
      </div>
    ))}
    
    {items.filter(i => i.quantity < 10).length === 0 && (
      <div className="flex flex-col items-center justify-center py-8 bg-white/40 rounded-xl border border-dashed border-amber-200">
        <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
          <Package className="h-5 w-5 text-emerald-600" />
        </div>
        <p className="text-sm text-muted-foreground font-medium italic">All Okay</p>
      </div>
    )}
  </div>
</div>
      </div>
    </div>
  );
}