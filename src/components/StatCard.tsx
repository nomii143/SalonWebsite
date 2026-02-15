import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  trendUp?: boolean;
}

export function StatCard({ title, value, icon, trend, trendUp }: StatCardProps) {
  const trendClass =
    trendUp === undefined
      ? "text-muted-foreground"
      : trendUp
        ? "text-success"
        : "text-destructive";

  return (
    <div className="rounded-xl bg-card border border-border p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-muted-foreground font-medium">{title}</span>
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold font-display text-foreground">{value}</p>
      {trend && (
        <p className={`text-xs mt-1 font-medium ${trendClass}`}>
          {trend}
        </p>
      )}
    </div>
  );
}
