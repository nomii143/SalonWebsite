import { useMemo, useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";
import type { Stockout } from "@/test/types/models";
import { User, Scissors, Calendar, CheckCircle2, Sparkles, ChevronsUpDown, Eraser, MoreVertical, Filter, 
  History } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export default function Stockout() {
  const { items, stockouts, addStockout, updateStockout, deleteStockout } = useData();

  // 1. STATE MANAGEMENT
  const [staffName, setStaffName] = useState("");
  const [currentItem, setCurrentItem] = useState({ itemId: "", quantitySold: "1" });
  const [range, setRange] = useState<"today" | "weekly" | "monthly">("today");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Reset date to today on page load
  useEffect(() => {
    setSelectedDate(getTodayDateString());
    setRange("today");
  }, []); 
  const [itemPopoverOpen, setItemPopoverOpen] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<Stockout | null>(null);
  const [isEditingSale, setIsEditingSale] = useState(false);
  const [editingSale, setEditingSale] = useState<Stockout | null>(null);
  const [editSaleValues, setEditSaleValues] = useState({
    buyerName: "",
    itemId: "",
    quantitySold: "1",
    saleDate: ""
  });
  const [isDeletingSale, setIsDeletingSale] = useState(false);
  const [deletingSale, setDeletingSale] = useState<Stockout | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedItem = items.find((i) => i.id === currentItem.itemId);
  const staffNameSuggestions = useMemo(() => {
    const names = stockouts.map((sale) => sale.staffName).filter(Boolean);
    return Array.from(new Set(names));
  }, [stockouts]);

  const editSelectedItem = useMemo(
    () => items.find((i) => i.id === editSaleValues.itemId),
    [items, editSaleValues.itemId]
  );

  const editTotalAmount = useMemo(() => {
    const qty = Number(editSaleValues.quantitySold || 0);
    const price = editSelectedItem?.costPrice || 0;
    return qty * price;
  }, [editSaleValues.quantitySold, editSelectedItem]);

  // 2. CONFIRM ORDER ACTION
  const handleConfirmOrder = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!staffName.trim()) {
      toast.error("Please enter the Staff Member name");
      setIsSubmitting(false);
      return;
    }
    if (!currentItem.itemId) {
      toast.error("Please select a Service or Product");
      setIsSubmitting(false);
      return;
    }

    if (!selectedItem) {
      toast.error("Please select a Service or Product");
      setIsSubmitting(false);
      return;
    }

    const qty = Number(currentItem.quantitySold);
    if (qty <= 0) {
      toast.error("Invalid quantity");
      setIsSubmitting(false);
      return;
    }

    if (selectedItem.quantity < qty) {
      toast.error("Insufficient Stock");
      setIsSubmitting(false);
      return;
    }

    try {
      const delay = new Promise((resolve) => setTimeout(resolve, 3000));
      const saleData = {
        staffName,
        itemId: currentItem.itemId,
        itemName: selectedItem.name,
        quantity: qty,
        totalAmount: (selectedItem.costPrice || 0) * qty,
        date: getTodayDateString()
      };

      await addStockout(saleData);
      setLastSale(saleData);
      setShowSuccessModal(true);
      
      // CLEAR ALL INPUTS
      setStaffName("");
      setCurrentItem({ itemId: "", quantitySold: "1" });
      setSelectedDate(getTodayDateString()); // Reset to today after adding
      await delay;
    } catch (error) {
      console.error("Stock-out save failed", error);
      toast.error("Failed to record stock-out");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (sale: Stockout) => {
    setEditingSale(sale);
    setEditSaleValues({
      buyerName: sale.staffName,
      itemId: sale.itemId,
      quantitySold: String(sale.quantity),
      saleDate: sale.date
    });
    setIsEditingSale(true);
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    const buyerName = editSaleValues.buyerName.trim();
    if (!buyerName) {
      toast.error("Please enter the Staff Member name");
      return;
    }

    if (!editSaleValues.itemId) {
      toast.error("Please select a Service or Product");
      return;
    }

    const qty = Number(editSaleValues.quantitySold);
    if (qty <= 0) {
      toast.error("Invalid quantity");
      return;
    }

    const item = items.find((i) => i.id === editSaleValues.itemId);
    if (!item) {
      toast.error("Please select a Service or Product");
      return;
    }

    try {
      await updateStockout(editingSale.id, {
        staffName: buyerName,
        itemId: editSaleValues.itemId,
        itemName: item.name,
        quantity: qty,
        totalAmount: (item.costPrice || 0) * qty,
        date: editSaleValues.saleDate || editingSale.date
      });
      setIsEditingSale(false);
      setEditingSale(null);
      toast.success("Stock-out updated");
    } catch (error) {
      toast.error("Failed to update stock-out");
    }
  };

  const handleRequestDeleteSale = (sale: Stockout) => {
    setDeletingSale(sale);
    setIsDeletingSale(true);
  };

  const handleConfirmDeleteSale = async () => {
    if (!deletingSale) return;

    try {
      await deleteStockout(deletingSale.id);
      toast.success("Stock-out deleted");
    } catch (error) {
      toast.error("Failed to delete stock-out");
    } finally {
      setIsDeletingSale(false);
      setDeletingSale(null);
    }
  };

  // 3. FILTERING LOGIC (Today, Weekly, Monthly + Custom Date)
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayDateString();

    return stockouts.filter((sale) => {
      // Priority: If a custom date is selected via calendar
      if (selectedDate) {
        return sale.date === selectedDate;
      }

      const saleDate = new Date(sale.date);
      
      if (range === "today") {
        return sale.date === todayStr;
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
  }, [stockouts, range, selectedDate]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
            <Scissors className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold">Stock Out</h1>
            <p className="text-muted-foreground text-sm">Enter staff name and record stocks</p>
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
              placeholder="Type Name..."
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
              <Sparkles className="h-4 w-4 text-primary" />Product *
            </Label>
            <Popover open={itemPopoverOpen} onOpenChange={setItemPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between h-12 bg-background/50 font-normal">
                  {currentItem.itemId ? items.find(i => i.id === currentItem.itemId)?.name : "Select item..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
                <Command>
                  <CommandInput placeholder="Search items..." />
                  <CommandList>
                    <CommandEmpty>No item found.</CommandEmpty>
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
                            <span className="font-medium">{item.name} ({item.quantity} available)</span>
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
            disabled={isSubmitting}
            className="h-12 text-lg gradient-gold text-primary-foreground font-bold shadow-lg active:scale-[0.98] transition-all"
          >
            {isSubmitting ? "Processing..." : "Confirm Request"}
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
            <DialogTitle className="text-2xl font-bold tracking-tight">Stock-out Recorded!</DialogTitle>
          </div>
          <div className="p-8 space-y-4">
            <div className="flex justify-between text-sm border-b border-border/50 pb-3">
              <span className="text-muted-foreground">Staff Member:</span>
              <span className="font-bold">{lastSale?.staffName}</span>
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
    <Calendar className="h-5 w-5 text-primary" /> Stock-out History
  </h2>
  
  {/* CONTAINER: w-fit ensures it doesn't stretch to the edges */}
  <div className="flex flex-wrap items-center gap-3 w-fit">
    
    {/* DATE PICKER CONTAINER */}
    <div 
      onClick={(e) => {
        const input = e.currentTarget.querySelector('input');
        if (input) {
          try {
            // @ts-ignore
            input.showPicker();
          } catch (err) {
            input.focus();
          }
        }
      }}
      className="flex items-center bg-muted/50 rounded-lg px-3 border border-border hover:border-primary/50 focus-within:ring-1 focus-within:ring-primary/30 focus-within:border-primary transition-all cursor-pointer group h-10 shadow-sm"
    >
      <Calendar className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
      <Input
        type="date"
        className="h-full w-[130px] bg-transparent border-none text-xs font-bold focus-visible:ring-0 cursor-pointer [color-scheme:light] ml-1"
        value={selectedDate}
        onChange={(e) => {
          setSelectedDate(e.target.value);
          // Un-selects Today/Week/Month tabs visually
          setRange("custom" as any); 
        }}
      />
    </div>

    {/* TABS: Fixed width for each trigger makes it look professional */}
    <Tabs 
      value={range} 
      onValueChange={(v) => {
        setRange(v as any);
        setSelectedDate(""); // Clears calendar when clicking Today/Week/Month
      }}
      className="w-fit"
    >
      <TabsList className="bg-muted/50 h-10 p-1">
        <TabsTrigger value="today" className="px-4 text-xs font-semibold">Today</TabsTrigger>
        <TabsTrigger value="weekly" className="px-4 text-xs font-semibold">Week</TabsTrigger>
        <TabsTrigger value="monthly" className="px-4 text-xs font-semibold">Month</TabsTrigger>
      </TabsList>
    </Tabs>
  </div>
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length > 0 ? (
                filteredSales.slice().reverse().map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-bold">{s.staffName}</TableCell>
                    <TableCell>{s.itemName}</TableCell>
                    <TableCell>{s.quantity}</TableCell>
                    <TableCell className="text-primary font-bold">PKR {s.totalAmount}</TableCell>
                    <TableCell className="text-right text-muted-foreground text-xs">{s.date}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Open actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleStartEdit(s)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleRequestDeleteSale(s)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    No stock-out records found for this time.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* EDIT STOCK-OUT DIALOG */}
      <Dialog
        open={isEditingSale}
        onOpenChange={(open) => {
          setIsEditingSale(open);
          if (!open) setEditingSale(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Edit Stock-out</DialogTitle>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Input
                value={editSaleValues.buyerName}
                onChange={(e) => setEditSaleValues({ ...editSaleValues, buyerName: e.target.value })}
                list="sale-staff-names"
                placeholder="Type Name..."
              />
            </div>

            <div className="space-y-2">
              <Label>Product *</Label>
              <Select
                value={editSaleValues.itemId}
                onValueChange={(value) => setEditSaleValues({ ...editSaleValues, itemId: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input
                  type="number"
                  value={editSaleValues.quantitySold}
                  onChange={(e) => setEditSaleValues({ ...editSaleValues, quantitySold: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editSaleValues.saleDate}
                  onChange={(e) => setEditSaleValues({ ...editSaleValues, saleDate: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 px-4 py-3 text-sm">
              <span className="text-muted-foreground">Total Bill</span>
              <span className="font-bold text-primary">PKR {editTotalAmount}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditingSale(false)}>Cancel</Button>
            <Button onClick={handleUpdateSale}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE STOCK-OUT DIALOG */}
      <AlertDialog open={isDeletingSale} onOpenChange={setIsDeletingSale}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock-out?</AlertDialogTitle>
            <AlertDialogHeader>
            <AlertDialogDescription>
              This will permanently remove this stock-out record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingSale(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDeleteSale}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}