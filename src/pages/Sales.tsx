import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";
import { Sale } from "@/test/types/models";
import { 
  Calendar,
  ChevronLeft,
  ChevronRight, 
  CheckCircle2, 
  Banknote, 
  CreditCard, 
  History,
  Plus,
  MoreVertical,
  Filter
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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

export default function ManualSales() {
  const { sales, addSale, deleteSale } = useData();

  // ENTRY FORM STATE
  const [saleDate, setSaleDate] = useState(getTodayDateString());
  const [cashAmount, setCashAmount] = useState<string>("");
  const [cardAmount, setCardAmount] = useState<string>("");
  const [openDatePicker, setOpenDatePicker] = useState(false);
  
  // HISTORY FILTER STATE
  const [range, setRange] = useState<"today" | "weekly" | "monthly" | "all" | "custom">("today"); 
  const [filterDate, setFilterDate] = useState(getTodayDateString());
  const [openFilterDatePicker, setOpenFilterDatePicker] = useState(false);

  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalPayment = (Number(cashAmount) || 0) + (Number(cardAmount) || 0);

  // FILTER LOGIC
  const filteredSales = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayDateString();

    const result = sales.filter((sale) => {
      const isManualEntry = sale.buyerName === "Salon Sale" || sale.buyerName === "General Sale";
      if (!isManualEntry) return false;

      const sDateStr = sale.saleDate;
      const sDate = new Date(sDateStr);

      if (range === "all") return true; 
      if (range === "custom") return sDateStr === filterDate;
      if (range === "today") return sDateStr === todayStr;
      
      if (range === "weekly") {
        const lastWeek = new Date();
        lastWeek.setDate(now.getDate() - 7);
        return sDate >= lastWeek;
      }
      if (range === "monthly") {
        const lastMonth = new Date();
        lastMonth.setMonth(now.getMonth() - 1);
        return sDate >= lastMonth;
      }
      return true;
    });

    return result.sort((a, b) => {
        const dateCompare = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
        if (dateCompare !== 0) return dateCompare;
        return (Number(b.id) || 0) - (Number(a.id) || 0); 
    });
  }, [sales, range, filterDate]);

  const totalInView = useMemo(() => {
    return filteredSales.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);
  }, [filteredSales]);

  const handleConfirmSale = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    // Validate date is not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(saleDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      toast.error("Cannot select a future date", {
        description: "Please select today's date or a past date.",
        duration: 4000,
      });
      setIsSubmitting(false);
      return;
    }
    if (totalPayment <= 0) {
      toast.error("Please enter an amount in Cash or Card");
      setIsSubmitting(false);
      return;
    }

    // SECOND CHANGE: CHECK FOR EXISTING ENTRY ON SAME DATE
    const existingEntry = sales.find(s => s.saleDate === saleDate && (s.buyerName === "Salon Sale" || s.buyerName === "General Sale"));
    if (existingEntry) {
      toast.error(`Entry already available for ${saleDate}`, {
        description: "Please delete the existing entry first if you want to update it.",
        duration: 5000,
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const delay = new Promise((resolve) => setTimeout(resolve, 3000));
      let methodLabel = "Split";
      if (Number(cashAmount) > 0 && Number(cardAmount) === 0) methodLabel = "Cash";
      if (Number(cardAmount) > 0 && Number(cashAmount) === 0) methodLabel = "Card";

      const saleData = {
        buyerName: "Salon Sale", 
        itemId: "manual-entry",
        itemName: "Direct Revenue",
        quantitySold: 1,
        totalAmount: totalPayment,
        cashAmount: Number(cashAmount) || 0,
        cardAmount: Number(cardAmount) || 0,
        saleDate: saleDate,
        paymentMethod: methodLabel,
      };

      await addSale(saleData);
      setLastSale(saleData);
      setShowSuccessModal(true);
      setCashAmount(""); 
      setCardAmount("");
      await delay;
    } catch (error) {
      toast.error("Failed to record payment");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeleteSale = async () => {
    if (!deletingSale) return;
    try {
      await deleteSale(deletingSale.id);
      toast.success("Record deleted");
    } catch (error) {
      toast.error("Failed to delete");
    } finally {
      setIsDeletingSale(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto p-4 md:p-0">
      <style>{`
        input::-webkit-outer-spin-button,
        input::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>

      {/* HEADER SECTION */}
      <div className="flex items-center gap-4 border-b border-border/60 pb-6">
        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
          <Plus className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Sales Entry</h1>
          <p className="text-muted-foreground text-sm">Log direct revenue payments</p>
        </div>
      </div>

      {/* INPUT FORM CARD */}
      <div className="rounded-2xl bg-card border border-border p-8 shadow-xl space-y-8">
        <div className="space-y-3 max-w-xs">
          <Label className="text-sm font-bold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Entry Date
          </Label>
          <div onClick={(e) => e.currentTarget.querySelector('input')?.showPicker()} className="flex items-center gap-2 bg-background/50 p-2.5 rounded-xl border-2 border-border group focus-within:border-primary hover:border-primary/50 transition-all cursor-pointer select-none h-12">
            <Calendar className="h-4 w-4 ml-2 text-primary group-hover:text-primary transition-colors" />
            <Input type="date" value={saleDate} max={getTodayDateString()} onChange={(e) => { 
              const selectedDate = new Date(e.target.value);
              const today = new Date();
              selectedDate.setHours(0, 0, 0, 0);
              today.setHours(0, 0, 0, 0);
              
              if (selectedDate > today) {
                toast.error("Cannot select a future date");
                setSaleDate(getTodayDateString());
              } else {
                setSaleDate(e.target.value);
              }
            }} className="h-8 flex-1 bg-transparent border-none text-sm font-bold focus-visible:ring-0 cursor-pointer text-foreground [color-scheme:light]" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4 p-6 rounded-xl border border-border bg-background/30 hover:border-emerald-500/50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                <Banknote className="h-6 w-6 text-emerald-600" />
              </div>
              <Label className="text-lg font-bold">Cash Payment</Label>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">PKR</span>
              <Input 
                type="number"
                placeholder="0"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                className="h-14 pl-14 bg-background border-2 focus:ring-0 focus:border-emerald-500 text-xl font-bold tabular-nums appearance-none"
              />
            </div>
          </div>

          <div className="space-y-4 p-6 rounded-xl border border-border bg-background/30 hover:border-primary/50 transition-colors group">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <Label className="text-lg font-bold">Card Payment</Label>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">PKR</span>
              <Input 
                type="number"
                placeholder="0"
                value={cardAmount}
                onChange={(e) => setCardAmount(e.target.value)}
                className="h-14 pl-14 bg-background border-2 focus:ring-0 focus:border-primary text-xl font-bold tabular-nums appearance-none"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center pt-8 border-t border-dashed border-border gap-6">
          <div className="text-center">
            <p className="text-muted-foreground text-xs font-normal uppercase tracking-[0.2em] mb-1">Total Amount to Save</p>
            <h2 className="text-5xl font-bold text-primary font-sans tabular-nums tracking-normal">
              <span className="text-2xl mr-2 font-normal">PKR</span>
              {totalPayment.toLocaleString()}
            </h2>
          </div>
          <Button
            onClick={handleConfirmSale}
            disabled={isSubmitting}
            className="w-full md:w-80 h-16 text-xl font-bold gradient-gold text-primary-foreground shadow-2xl active:scale-[0.98] transition-all rounded-2xl"
          >
            {isSubmitting ? "Processing..." : "Confirm Payment"}
          </Button>
        </div>
      </div>

      {/* HISTORY TABLE SECTION */}
      <div className="space-y-4 pt-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="text-2xl font-bold flex items-center gap-2 text-foreground">
            <History className="h-5 w-5 text-primary" /> Sales History
          </h2>
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div onClick={(e) => e.currentTarget.querySelector('input')?.showPicker()} className="flex items-center gap-2 bg-muted/40 p-1.5 rounded-xl border border-border group focus-within:border-primary hover:border-primary/50 transition-all cursor-pointer select-none">
              <Filter className="h-3.5 w-3.5 ml-2 text-foreground/70 group-hover:text-primary transition-colors" />
              <Input type="date" value={filterDate} onChange={(e) => { setFilterDate(e.target.value); setRange("custom"); }} className="h-8 w-36 bg-transparent border-none text-xs font-bold focus-visible:ring-0 cursor-pointer text-foreground [color-scheme:light]" />
            </div>
            <Tabs value={range} onValueChange={(v) => { setRange(v as any); setFilterDate(""); }} className="w-full sm:w-auto">
              <TabsList className="bg-muted/50 grid grid-cols-4 w-full h-11">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="weekly">Week</TabsTrigger>
                <TabsTrigger value="monthly">Month</TabsTrigger>
                <TabsTrigger value="all">Full</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border">
                <TableHead className="font-bold">Date & Type</TableHead>
                <TableHead className="text-right font-bold">Cash</TableHead>
                <TableHead className="text-right font-bold">Card</TableHead>
                <TableHead className="text-right font-bold">Total Revenue</TableHead>
                <TableHead className="text-right font-bold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSales.length > 0 ? (
                <>
                  {filteredSales.map((s) => (
                    <TableRow key={s.id} className="border-border hover:bg-muted/20 transition-colors">
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground font-medium">
                            {new Date(s.saleDate).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                          <span className="font-bold text-foreground">Salon Sale</span>
                        </div>
                      </TableCell>
                      {/* FIRST CHANGE: ADDED CASH AND CARD AMOUNTS IN TABLE */}
                      <TableCell className="text-right text-emerald-600 font-semibold tabular-nums">
                        {s.cashAmount?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right text-blue-600 font-semibold tabular-nums">
                        {s.cardAmount?.toLocaleString() || 0}
                      </TableCell>
                      <TableCell className="text-right text-primary font-black text-lg tabular-nums">
                        PKR {s.totalAmount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="hover:bg-primary/10 hover:text-primary transition-colors">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-32">
                            <DropdownMenuItem className="text-destructive font-bold focus:bg-destructive/10 focus:text-destructive" onClick={() => {setDeletingSale(s); setIsDeletingSale(true);}}>
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-primary/5 hover:bg-primary/5 border-t-2 border-primary/20">
                    <TableCell className="font-bold text-primary">Filtered Total</TableCell>
                    <TableCell colSpan={2} />
                    <TableCell className="text-right text-primary font-black text-xl">
                      PKR {totalInView.toLocaleString()}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic font-medium">
                    {range === "custom" ? `No records found for ${filterDate}` : "No payment records found for this time."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODALS RENDERED HERE (Success and Delete) */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md border-none bg-card p-0 overflow-hidden shadow-2xl rounded-3xl">
          <div className="bg-primary/10 p-10 flex flex-col items-center justify-center text-center">
            <div className="h-20 w-20 bg-primary rounded-full flex items-center justify-center mb-4 shadow-lg">
              <CheckCircle2 className="h-12 w-12 text-white" />
            </div>
            <DialogTitle className="text-2xl font-bold tracking-tight">Payment Recorded!</DialogTitle>
          </div>
          <div className="p-8 space-y-4">
            <div className="flex justify-between items-center py-5 border-y border-dashed border-primary/30">
              <span className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Amount Received</span>
              <span className="text-3xl font-black text-primary tabular-nums">PKR {lastSale?.totalAmount?.toLocaleString()}</span>
            </div>
            <Button className="w-full h-14 mt-4 font-bold gradient-gold shadow-lg rounded-xl" onClick={() => setShowSuccessModal(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeletingSale} onOpenChange={setIsDeletingSale}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this record?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone. This revenue entry will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-white hover:bg-destructive/90 rounded-xl px-6" onClick={handleConfirmDeleteSale}>
              Delete Entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}