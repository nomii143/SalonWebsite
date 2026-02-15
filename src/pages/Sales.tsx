import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { User, Scissors, Calendar, X, CheckCircle2, Sparkles, ChevronsUpDown, Eraser } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function Sales() {
  const { items, sales, addSale } = useData();

  // 1. STATE MANAGEMENT
  const [staffName, setStaffName] = useState("");
  const [currentItem, setCurrentItem] = useState({ itemId: "", quantitySold: "1" });
  const [range, setRange] = useState<"today" | "weekly" | "monthly">("today"); 
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const selectedItem = items.find((i) => i.id === currentItem.itemId);
  const staffNameSuggestions = useMemo(() => {
    const names = sales.map((sale) => sale.buyerName).filter(Boolean);
    return Array.from(new Set(names));
  }, [sales]);

  // 2. CONFIRM ORDER ACTION
  const handleConfirmOrder = async () => {
    if (!staffName.trim()) {
      toast.error("Please enter the Staff Member name");
      return;
    }
    if (!currentItem.itemId) {
      toast.error("Please select a Service or Product");
      return;
    }

    const qty = Number(currentItem.quantitySold);
    if (qty <= 0) {
      toast.error("Invalid quantity");
      return;
    }

    try {
      const saleData = {
        buyerName: staffName,
        itemId: currentItem.itemId,
        itemName: selectedItem?.name || "",
        quantitySold: qty,
        totalAmount: (selectedItem?.costPrice || 0) * qty,
        saleDate: new Date().toISOString().split("T")[0],
      };

      await addSale(saleData);
      setLastSale(saleData);
      setShowSuccessModal(true);
      setCurrentItem({ itemId: "", quantitySold: "1" });
    } catch (error) {
      toast.error("Failed to record saloon sale");
    }
  };

  // 3. FILTERING LOGIC (Today, Weekly, Monthly)
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return sales.filter((sale) => {
      const saleDate = new Date(sale.saleDate);
      
      if (range === "today") {
        return sale.saleDate === todayStr;
      }
      
      if (range === "weekly") {
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);
        return saleDate >= lastWeek;
      }
      
      if (range === "monthly") {
        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);
        return saleDate >= lastMonth;
      }

      return true;
    });
  }, [sales, range]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Scissors className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Stock Out</h1>
            <p className="text-muted-foreground text-sm">Enter staff name and record services</p>
          </div>
        </div>
      </div>

      {/* Main Entry Form */}
      <div className="rounded-2xl bg-card border border-border p-8 shadow-xl space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* STAFF NAME INPUT */}
          <div className="space-y-3">
            <Label className="text-sm font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Staff Member *
              </div>
              {staffName && (
                <button 
                  onClick={() => setStaffName("")}
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 uppercase tracking-tighter"
                >
                  <Eraser className="h-3 w-3" /> Clear
                </button>
              )}
            </Label>
            <Input
              className="h-12 bg-background/50"
              placeholder="Type Stylist Name..."
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              list="sale-staff-names"
            />
            <datalist id="sale-staff-names">
              {staffNameSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          {/* SERVICE SELECTION */}
          <div className="space-y-3">
            <Label className="text-sm font-bold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Service / Product *
            </Label>
            <Popover open={itemPopoverOpen} onOpenChange={setItemPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-12 bg-background/50 font-normal">
                  {currentItem.itemId ? items.find(i => i.id === currentItem.itemId)?.name : "Select Service"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search services..." />
                  <CommandList>
                    <CommandEmpty>No service found.</CommandEmpty>
                    <CommandGroup>
                      {items.map((item) => (
                        <CommandItem
                          key={item.id}
                          onSelect={() => {
                            setCurrentItem({ ...currentItem, itemId: item.id });
                            setItemPopoverOpen(false);
                          }}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-xs text-muted-foreground">Price: PKR {item.costPrice}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
          <div className="space-y-3">
            <Label className="text-sm font-bold">Quantity</Label>
            <Input 
              type="number" 
              className="h-12 bg-background/50"
              value={currentItem.quantitySold} 
              onChange={(e) => setCurrentItem({ ...currentItem, quantitySold: e.target.value })} 
            />
          </div>
          <Button 
            onClick={handleConfirmOrder} 
            className="h-12 text-lg gradient-gold text-primary-foreground font-bold shadow-lg active:scale-[0.98] transition-all"
          >
            Confirm Order
          </Button>
        </div>
      </div>

      {/* SUCCESS MODAL */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md border-none bg-card p-0 overflow-hidden shadow-2xl">
          <div className="bg-primary/10 p-10 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg animate-in zoom-in">
              <CheckCircle2 className="h-10 w-10 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Sale Recorded!</DialogTitle>
          </div>
          <div className="p-8 space-y-4">
            <div className="flex justify-between text-sm border-b border-border/50 pb-3">
              <span className="text-muted-foreground">Staff Member:</span>
              <span className="font-bold">{lastSale?.buyerName}</span>
            </div>
            <div className="flex justify-between text-xl font-bold pt-2">
              <span>Total Bill:</span>
              <span className="text-primary">PKR {lastSale?.totalAmount}</span>
            </div>
            <Button className="w-full h-12 mt-6 font-bold" onClick={() => setShowSuccessModal(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* FILTERED HISTORY TABLE */}
      <div className="space-y-4 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" /> Sales History
          </h2>
          <Tabs value={range} onValueChange={(v) => setRange(v as any)}>
            <TabsList className="bg-muted/50">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="weekly">This Week</TabsTrigger>
              <TabsTrigger value="monthly">This Month</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead>Staff</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total (PKR)</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length > 0 ? (
                filteredSales.slice().reverse().map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold">{s.buyerName}</TableCell>
                    <TableCell>{s.itemName}</TableCell>
                    <TableCell>{s.quantitySold}</TableCell>
                    <TableCell className="text-primary font-bold">PKR {s.totalAmount}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">{s.saleDate}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    No sales found for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}