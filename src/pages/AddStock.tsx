import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PackagePlus, Calendar, Tag, Hash, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function AddStock() {
  const { addItem } = useData();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    quantity: "",
    costPrice: "",
    entryDate: new Date().toISOString().split("T")[0],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.quantity || !form.costPrice) {
      toast.error("Please fill all required fields");
      return;
    }
    try {
      await addItem({
        name: form.name,
        quantity: Number(form.quantity),
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.costPrice), // Defaulting to cost price since selling price is removed
        entryDate: form.entryDate,
      });
      toast.success("Item added to inventory successfully");
      navigate("/inventory");
    } catch (error) {
      toast.error("Failed to add item");
      console.error(error);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <PackagePlus className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Stock In</h1>
            <p className="text-muted-foreground text-sm">Log new inventory arrival</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-card border border-border p-8 shadow-xl space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Item Name / Title *
            </Label>
            <Input
              id="name"
              className="h-12 bg-background/50 focus-visible:ring-2 focus-visible:ring-primary/50"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Shampoo"
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="date" className="text-sm font-bold flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" /> Entry Date
            </Label>
            <Input
              id="date"
              type="date"
              className="h-12 bg-background/50"
              value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label htmlFor="qty" className="text-sm font-bold flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" /> Quantity *
            </Label>
            <Input
              id="qty"
              type="number"
              min={1}
              className="h-12 bg-background/50"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <Label htmlFor="cost" className="text-sm font-bold flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Cost Price *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-xs">
                PKR
              </span>
              <Input
                id="cost"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                className="h-12 pl-12 pr-20 bg-background/50"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-[10px] uppercase border-l border-border pl-2">
                per item
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div className="text-xs text-muted-foreground">
            Stock will be updated instantly across the dashboard.
          </div>
          <Button
            type="submit"
            className="h-12 text-lg gradient-gold text-primary-foreground font-bold shadow-lg active:scale-[0.98] transition-all"
          >
            Save to Inventory
          </Button>
        </div>
      </form>
    </div>
  );
}
