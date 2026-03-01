import { useMemo, useState, useEffect } from "react";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";
import { MoreVertical, Truck, Trash2, CreditCard } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export default function VendorPayments() {
  // Assuming your context has these methods. If not, you might need to map them 
  // to a 'vendor_payments' table in your database via electronAPI.
  const { expenses, users, addExpense, addUser, updateExpense, deleteExpense } = useData();

  // --- 1. PAYMENT TYPES LOGIC (e.g., Raw Materials, Rent, Inventory) ---
  const [paymentTypes, setPaymentTypes] = useState<string[]>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("vendor-payment-types") : null;
    return saved ? JSON.parse(saved) : ["Inventory", "Raw Material", "Utility Bill", "Rent", "Equipment"];
  });

  useEffect(() => {
    localStorage.setItem("vendor-payment-types", JSON.stringify(paymentTypes));
  }, [paymentTypes]);

  const [newTypeName, setNewTypeName] = useState("");
  const [isAddingType, setIsAddingType] = useState(false);

  // --- 2. FORM STATE ---
  const [vendorName, setVendorName] = useState("");
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [currentPayment, setCurrentPayment] = useState({ type: "", amount: "", description: "" });
  
  // Reset date to today on page load
  useEffect(() => {
    setPaymentDate(getTodayDateString());
  }, []);
  
  // --- 3. UI STATES ---
  const [range, setRange] = useState<"daily" | "weekly" | "monthly" | "all">("daily");
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastRecorded, setLastRecorded] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editPaymentValues, setEditPaymentValues] = useState({
    vendorName: "",
    type: "",
    amount: "",
    description: "",
    date: ""
  });
  const [isDeleting, setIsDeleting] = useState(false);
  const [deletingItem, setDeletingItem] = useState<any>(null);

  const vendorList = useMemo(
    () => users.filter((user) => user.source === "vendor"),
    [users]
  );

  const normalizeName = (value: string) => value.trim().toLowerCase();

  // --- 4. ACTIONS ---
  const handleAddType = () => {
    const trimmed = newTypeName.trim();
    if (!trimmed) return;
    if (paymentTypes.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Type already exists");
      return;
    }
    setPaymentTypes([...paymentTypes, trimmed]);
    setNewTypeName("");
    setIsAddingType(false);
    toast.success("Payment type saved");
  };

  const handleRecordPayment = async () => {
    const finalVendorName = vendorName.trim();
    const safeVendorName = finalVendorName || "";
    if (!currentPayment.type) return toast.error("Select payment type");
    if (!currentPayment.amount || Number(currentPayment.amount) <= 0) return toast.error("Enter valid amount");

    try {
      const paymentData = {
        category: currentPayment.type, // Map 'type' to 'category' for database compatibility
        amount: Number(currentPayment.amount),
        staffName: safeVendorName, // Map 'vendor' to 'staffName' for compatibility
        staffPicture: "",
        description: currentPayment.description,
        date: paymentDate,
        source: "vendor_payment" // Flag to distinguish from regular expenses
      };

      // Auto-add Vendor to User list if they don't exist
      const exists = safeVendorName
        ? vendorList.some((v) => normalizeName(v.fullName) === normalizeName(safeVendorName))
        : false;
      if (safeVendorName && !exists) {
        await addUser({
          fullName: safeVendorName,
          email: "",
          phone: "",
          role: "Vendor",
          pictureUrl: "",
          joinDate: new Date().toISOString(),
          source: "vendor"
        });
      }

      await addExpense(paymentData); 
      setLastRecorded(paymentData);
      setShowReceipt(true);
      setCurrentPayment({ type: "", amount: "", description: "" });
      setVendorName("");
      setPaymentDate(getTodayDateString()); // Reset to today after adding
    } catch (error) {
      toast.error("Failed to record payment");
    }
  };

  const handleStartEdit = (payment: any) => {
    setEditingItem(payment);
    setEditPaymentValues({
      vendorName: payment.staffName || "",
      type: payment.category || "",
      amount: String(payment.amount ?? ""),
      description: payment.description || "",
      date: payment.date || ""
    });
    setIsEditing(true);
  };

  const handleUpdatePayment = async () => {
    if (!editingItem) return;
    const finalVendorName = editPaymentValues.vendorName.trim();
    const safeVendorName = finalVendorName || "";
    if (!editPaymentValues.type) return toast.error("Select payment type");
    if (!editPaymentValues.amount || Number(editPaymentValues.amount) <= 0) {
      return toast.error("Enter valid amount");
    }

    try {
      if (!paymentTypes.some((t) => t.toLowerCase() === editPaymentValues.type.toLowerCase())) {
        setPaymentTypes((prev) => [...prev, editPaymentValues.type]);
      }

      const exists = safeVendorName
        ? vendorList.some((v) => normalizeName(v.fullName) === normalizeName(safeVendorName))
        : false;
      if (safeVendorName && !exists) {
        await addUser({
          fullName: safeVendorName,
          email: "",
          phone: "",
          role: "Vendor",
          pictureUrl: "",
          joinDate: new Date().toISOString(),
          source: "vendor"
        });
      }

      await updateExpense(editingItem.id, {
        category: editPaymentValues.type,
        amount: Number(editPaymentValues.amount),
        staffName: safeVendorName,
        staffPicture: editingItem.staffPicture || "",
        description: editPaymentValues.description,
        date: editPaymentValues.date || editingItem.date,
        source: "vendor_payment"
      });

      setIsEditing(false);
      setEditingItem(null);
      toast.success("Payment updated");
    } catch (error) {
      toast.error("Failed to update payment");
    }
  };

  // Filter Logic (Filtering expenses that are marked as vendor_payments)
  const filteredPayments = useMemo(() => {
    const vendorOnly = expenses.filter((e) => e.source === "vendor_payment");
    
    if (range === "all") return vendorOnly;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    if (range === "weekly") start.setDate(start.getDate() - 6);
    else if (range === "monthly") start.setDate(start.getDate() - 29);

    return vendorOnly.filter((p) => {
      const [year, month, day] = p.date.split("-").map(Number);
      const pDate = new Date(year, month - 1, day);
      if (range === "daily") return pDate.getTime() === today.getTime();
      return pDate >= start && pDate <= today;
    });
  }, [expenses, range]);

  return (
    <div className="space-y-8" onKeyDown={(e) => {
      if (e.key === 'Enter' && !isAddingType && !showReceipt && !isEditing && !isDeleting) {
        handleRecordPayment();
      }
    }}>
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-3xl font-display font-bold">Vendor Payments</h1>
          <p className="text-muted-foreground mt-1">Settle accounts with your suppliers</p>
        </div>
      </div>

     <div className="space-y-6">
  <div className="rounded-xl bg-card border border-border p-6 shadow-sm space-y-4">
    <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
      <CreditCard className="h-5 w-5 text-primary" /> New Payment Entry
    </h2>

    {/* MAIN ROW: Date, Payment Type, and Amount in one line */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      
      {/* DATE */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold uppercase opacity-70">Date of Payment</Label>
        <Input 
          type="date" 
          value={paymentDate} 
          onChange={(e) => setPaymentDate(e.target.value)} 
          className="h-9 text-sm bg-background/50"
        />
      </div>

      {/* PAYMENT TYPE - Small and compact */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center px-0.5">
          <Label className="text-[11px] font-bold uppercase opacity-70">Category *</Label>
          <button 
            type="button"
            onClick={() => setIsAddingType(true)} 
            className="text-[10px] text-primary font-bold hover:underline"
          >
            + New Type
          </button>
        </div>
        <Select 
          value={currentPayment.type} 
          onValueChange={(v) => setCurrentPayment({ ...currentPayment, type: v })}
        >
          <SelectTrigger className="h-9 text-sm bg-background/50">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {paymentTypes.map((t) => (
              <div key={t} className="flex items-center justify-between px-1 group">
                <SelectItem value={t} className="flex-1 text-sm">{t}</SelectItem>
                <button 
                  type="button"
                  onClick={(e) => { 
                    e.preventDefault(); 
                    e.stopPropagation(); 
                    setPaymentTypes(paymentTypes.filter(x => x !== t)); 
                  }} 
                  className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* AMOUNT - Removed arrows/spinners */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold uppercase opacity-70">Amount Paid (Rs) *</Label>
        <Input 
          type="number" 
          placeholder="0"
          value={currentPayment.amount} 
          onChange={(e) => setCurrentPayment({ ...currentPayment, amount: e.target.value })} 
          className="h-9 text-sm bg-background/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
    </div>

    {/* NOTES - Small compact input like Expenses */}
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase opacity-70">Notes</Label>
      <Input 
        value={currentPayment.description} 
        onChange={(e) => setCurrentPayment({ ...currentPayment, description: e.target.value })} 
        placeholder="Add details..." 
        className="h-9 text-sm bg-background/50"
      />
    </div>

    {/* SUBMIT BUTTON */}
    <Button 
      onClick={handleRecordPayment} 
      className="w-full gradient-gold text-primary-foreground font-bold h-10 text-sm shadow-md active:scale-[0.99] transition-all"
    >
      Confirm Vendor Payment
    </Button>
  </div>
</div>

      {/* HISTORY TABLE */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Payment History</h2>
        <Tabs value={range} onValueChange={(v) => setRange(v as any)}>
          <TabsList>
            <TabsTrigger value="daily">Daily</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>Type</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPayments.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-10 text-muted-foreground">No vendor payments found for this time.</TableCell></TableRow>
            ) : (
              filteredPayments.sort((a,b) => b.date.localeCompare(a.date)).map((p) => (
                <TableRow key={p.id} className="border-border">
                  <TableCell><span className="px-2 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium">{p.category}</span></TableCell>
                  <TableCell className="font-bold text-primary">Rs {p.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{p.date}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted"><MoreVertical className="h-4 w-4" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleStartEdit(p)}>Edit Record</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => { setDeletingItem(p); setIsDeleting(true); }}>Delete Record</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* MODAL: ADD TYPE */}
      <Dialog open={isAddingType} onOpenChange={setIsAddingType}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Payment Type</DialogTitle></DialogHeader>
          <div className="py-4"><Label>Type Name</Label><Input autoFocus value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddType()} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingType(false)}>Cancel</Button>
            <Button onClick={handleAddType}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: EDIT PAYMENT */}
      <Dialog
        open={isEditing}
        onOpenChange={(open) => {
          setIsEditing(open);
          if (!open) setEditingItem(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Vendor Payment</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date of Payment</Label>
                <Input
                  type="date"
                  value={editPaymentValues.date}
                  onChange={(e) => setEditPaymentValues({ ...editPaymentValues, date: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Amount Paid (Rs) *</Label>
                <Input
                  type="number"
                  value={editPaymentValues.amount}
                  onChange={(e) => setEditPaymentValues({ ...editPaymentValues, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={editPaymentValues.type}
                onValueChange={(v) => setEditPaymentValues({ ...editPaymentValues, type: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editPaymentValues.description}
                onChange={(e) => setEditPaymentValues({ ...editPaymentValues, description: e.target.value })}
                placeholder="Details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={handleUpdatePayment}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: website color RECEIPT */}
      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden">
          <div className="bg-primary p-6 text-center text-primary-foreground">
            <Truck className="h-10 w-10 mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Payment Recorded</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between border-b pb-2"><span>Vendor</span><span className="font-bold">{lastRecorded?.staffName}</span></div>
            <div className="flex justify-between border-b pb-2"><span>Paid For</span><span className="font-bold">{lastRecorded?.category}</span></div>
            <div className="flex justify-between pt-2"><span className="text-lg font-bold">Amount</span><span className="text-xl font-bold text-primary">Rs {lastRecorded?.amount}</span></div>
            <Button onClick={() => setShowReceipt(false)} className="w-full mt-4 gradient-gold text-primary-foreground font-bold">Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* DELETE ALERT */}
      <AlertDialog open={isDeleting} onOpenChange={setIsDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete payment record?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingItem(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive" onClick={async () => { await deleteExpense(deletingItem.id); setIsDeleting(false); toast.success("Deleted"); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}