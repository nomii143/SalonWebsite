import { useState } from "react";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PackagePlus, Calendar, Tag, Hash, Wallet } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";

export default function AddStock() {
  // Added 'items' to the destructuring to check for existing names
  const { addItem, items } = useData();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    quantity: "",
    costPrice: "",
    entryDate: getTodayDateString(),
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    // 1. Basic validation
    if (!form.name || !form.quantity || !form.costPrice) {
      toast.error("Please fill all required fields");
      setIsSubmitting(false);
      return;
    }
    
    // 2. Validate date is not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(form.entryDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      toast.error("Cannot select a future date", {
        description: "Please select today's date or a past date.",
        duration: 4000,
      });
      setIsSubmitting(false);
      return;
    }

    // 3. Duplicate Check Logic
    const isDuplicate = items.some(
      (item) => item.name.toLowerCase().trim() === form.name.toLowerCase().trim()
    );

    if (isDuplicate) {
      toast.error(`"${form.name}" already exists in inventory!`, {
        description: "Please update the existing item instead of adding a new one.",
        style: { border: '1px solid #ef4444' }
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const delay = new Promise((resolve) => setTimeout(resolve, 3000));
      await addItem({
        name: form.name.trim(),
        quantity: Number(form.quantity),
        costPrice: Number(form.costPrice),
        sellingPrice: Number(form.costPrice),
        entryDate: form.entryDate,
      });
      toast.success("Item added to inventory successfully");
      navigate("/inventory");
      await delay;
    } catch (error) {
      toast.error("Failed to add item");
      console.error(error);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-0">
      {/* HEADER SECTION */}
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
        {/* ROW 1: NAME & DATE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label htmlFor="name" className="text-sm font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> Item Name*
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
              max={getTodayDateString()}
              onChange={(e) => {
                const selectedDate = new Date(e.target.value);
                const today = new Date();
                selectedDate.setHours(0, 0, 0, 0);
                today.setHours(0, 0, 0, 0);
                
                if (selectedDate > today) {
                  toast.error("Cannot select a future date");
                  setForm({ ...form, entryDate: getTodayDateString() });
                } else {
                  setForm({ ...form, entryDate: e.target.value });
                }
              }}
            />
          </div>
        </div>

        {/* ROW 2: QUANTITY & COST PRICE */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <Label htmlFor="qty" className="text-sm font-bold flex items-center gap-2">
              <Hash className="h-4 w-4 text-primary" /> Quantity *
            </Label>
            <Input
              id="qty"
              type="number"
              min={1}
              placeholder="00"
              className="h-12 bg-background/50"
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-start gap-2">
              <Label htmlFor="cost" className="text-sm font-bold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" /> Cost Price *
              </Label>
              <span className="text-[10px] uppercase font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                per item
              </span>
            </div>
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
                className="h-12 pl-12 pr-4 bg-background/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* FOOTER SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div className="text-xs text-muted-foreground">
            Stock will be updated instantly across the dashboard.
          </div>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="h-12 text-lg gradient-gold text-primary-foreground font-bold shadow-lg active:scale-[0.98] transition-all"
          >
            {isSubmitting ? "Processing..." : "Save to Inventory"}
          </Button>
        </div>
      </form>
    </div>
  );
}