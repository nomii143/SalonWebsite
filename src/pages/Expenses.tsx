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
import { Expense } from "@/test/types/models";
import { MoreVertical, Receipt, Trash2 } from "lucide-react";
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

export default function Expenses() {
  const { expenses, users, addExpense, addUser, updateExpense, deleteExpense } = useData();

  // --- 1. CATEGORIES LOGIC (PERSISTENT) ---
  const [categories, setCategories] = useState<string[]>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("expense-categories") : null;
    return saved ? JSON.parse(saved) : ["Food", "Taxi", "Maintenance", "Utilities", "Other"];
  });

  useEffect(() => {
    localStorage.setItem("expense-categories", JSON.stringify(categories));
  }, [categories]);

  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);

  // --- 2. FORM STATE ---
  const [payerName, setPayerName] = useState("");
  const [payerDate, setPayerDate] = useState(getTodayDateString());
  const [currentExpense, setCurrentExpense] = useState({ category: "", amount: "", description: "" });
  
  // Reset date to today on page load
  useEffect(() => {
    setPayerDate(getTodayDateString());
  }, []);
  
  // --- 3. UI STATES ---
  const [range, setRange] = useState<"daily" | "weekly" | "monthly" | "all">("daily");
  const [showBill, setShowBill] = useState(false);
  const [lastRecorded, setLastRecorded] = useState<any>(null);
  const [isEditingExpense, setIsEditingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isDeletingExpense, setIsDeletingExpense] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editExpenseValues, setEditExpenseValues] = useState({
    category: "",
    amount: "",
    description: "",
    staffName: "",
    date: ""
  });

  const expensePayers = useMemo(
    () => users.filter((user) => user.source === "expense"),
    [users]
  );

  const editCategories = useMemo(() => {
    const unique = new Set(categories);
    if (editExpenseValues.category) unique.add(editExpenseValues.category);
    return Array.from(unique);
  }, [categories, editExpenseValues.category]);

  const normalizeName = (value: string) => value.trim().toLowerCase();

  // --- 4. ACTIONS ---
  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;
    if (categories.some(c => c.toLowerCase() === trimmed.toLowerCase())) {
      toast.error("Category already exists");
      return;
    }
    setCategories([...categories, trimmed]);
    setNewCategoryName("");
    setIsAddingCategory(false);
    toast.success("Category saved");
  };

  const deleteCategory = (cat: string) => {
    setCategories(categories.filter(c => c !== cat));
    toast.info("Category removed");
  };

  const handleRecordDirectly = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const finalStaffName = payerName.trim();

    const safeStaffName = finalStaffName || "";
    
    // Validate date is not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(payerDate);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      toast.error("Cannot select a future date", {
        description: "Please select today's date or a past date.",
        duration: 4000,
      });
      setIsSubmitting(false);
      return;
    }
    
    if (!currentExpense.category) {
      toast.error("Select a category");
      setIsSubmitting(false);
      return;
    }
    if (!currentExpense.amount || Number(currentExpense.amount) <= 0) {
      toast.error("Enter valid amount");
      setIsSubmitting(false);
      return;
    }

    try {
      const delay = new Promise((resolve) => setTimeout(resolve, 3000));
      const expenseData = {
        category: currentExpense.category as any, // Cast to any to avoid Type errors with dynamic strings
        amount: Number(currentExpense.amount),
        staffName: safeStaffName,
        staffPicture: "",
        description: currentExpense.description,
        date: payerDate,
        source: "expense"
      };

      const exists = safeStaffName
        ? expensePayers.some((payer) => normalizeName(payer.fullName) === normalizeName(safeStaffName))
        : false;
      if (safeStaffName && !exists) {
        await addUser({
          fullName: safeStaffName,
          email: "",
          phone: "",
          role: "Staff",
          pictureUrl: "",
          joinDate: new Date().toISOString(),
          source: "expense"
        });
      }

      await addExpense(expenseData);
      setLastRecorded(expenseData);
      setShowBill(true); 
      setCurrentExpense({ category: "", amount: "", description: "" });
      setPayerName("");
      setPayerDate(getTodayDateString()); // Reset to today after adding
      await delay;
    } catch (error) {
      toast.error("Failed to record expense");
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEdit = (expense: Expense) => {
    setEditingExpense(expense);
    setEditExpenseValues({
      category: expense.category,
      amount: String(expense.amount),
      description: expense.description || "",
      staffName: expense.staffName,
      date: expense.date
    });
    setIsEditingExpense(true);
  };

  const handleUpdateExpense = async () => {
    if (!editingExpense) return;
    const finalStaffName = editExpenseValues.staffName.trim();

    const safeStaffName = finalStaffName || "";
    
    // Validate date is not in the future
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(editExpenseValues.date || editingExpense.date);
    selectedDate.setHours(0, 0, 0, 0);
    
    if (selectedDate > today) {
      return toast.error("Cannot select a future date", {
        description: "Please select today's date or a past date.",
        duration: 4000,
      });
    }
    
    if (!editExpenseValues.category) return toast.error("Select a category");
    if (!editExpenseValues.amount || Number(editExpenseValues.amount) <= 0) {
      return toast.error("Enter valid amount");
    }

    try {
      if (!categories.some((c) => c.toLowerCase() === editExpenseValues.category.toLowerCase())) {
        setCategories((prev) => [...prev, editExpenseValues.category]);
      }

      const exists = safeStaffName
        ? expensePayers.some((payer) => normalizeName(payer.fullName) === normalizeName(safeStaffName))
        : false;
      if (safeStaffName && !exists) {
        await addUser({
          fullName: safeStaffName,
          email: "",
          phone: "",
          role: "Staff",
          pictureUrl: "",
          joinDate: new Date().toISOString(),
          source: "expense"
        });
      }

      await updateExpense(editingExpense.id, {
        category: editExpenseValues.category as any,
        amount: Number(editExpenseValues.amount),
        staffName: safeStaffName,
        staffPicture: editingExpense.staffPicture || "",
        description: editExpenseValues.description,
        date: editExpenseValues.date || editingExpense.date
      });

      setIsEditingExpense(false);
      setEditingExpense(null);
      toast.success("Expense updated");
    } catch (error) {
      toast.error("Failed to update expense");
    }
  };

  const handleRequestDeleteExpense = (expense: Expense) => {
    setDeletingExpense(expense);
    setIsDeletingExpense(true);
  };

  const handleConfirmDeleteExpense = async () => {
    if (!deletingExpense) return;

    try {
      await deleteExpense(deletingExpense.id);
      toast.success("Expense deleted");
    } catch (error) {
      toast.error("Failed to delete expense");
    } finally {
      setIsDeletingExpense(false);
      setDeletingExpense(null);
    }
  };

  // Filter Logic
  const filteredExpenses = useMemo(() => {
    const baseExpenses = expenses.filter((expense) => expense.source !== "vendor_payment");
    if (range === "all") return baseExpenses;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    if (range === "weekly") start.setDate(start.getDate() - 6);
    else if (range === "monthly") start.setDate(start.getDate() - 29);

    return baseExpenses.filter((expense) => {
      const [year, month, day] = expense.date.split("-").map(Number);
      const expenseDate = new Date(year, month - 1, day);
      if (range === "daily") return expenseDate.getTime() === today.getTime();
      return expenseDate >= start && expenseDate <= today;
    });
  }, [expenses, range]);

  return (
    <div className="space-y-8" onKeyDown={(e) => {
      // Only trigger record if user isn't in a modal or the staff dropdown
      if (e.key === 'Enter' && !isAddingCategory && !showBill && !isEditingExpense && !isDeletingExpense) {
        handleRecordDirectly();
      }
    }}>
      <div>
        <h1 className="text-3xl font-display font-bold">Daily Expenses</h1>
        <p className="text-muted-foreground mt-1">Manage categories and track spending</p>
      </div>

      <div className="space-y-6">
  <div className="rounded-xl bg-card border border-border p-6 shadow-sm space-y-4">
    <h2 className="text-lg font-bold tracking-tight text-foreground">Record New Expense</h2>

    {/* MAIN ROW: Date, Category, and Amount in one line */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
      
      {/* DATE */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-bold uppercase opacity-70">Date</Label>
        <Input 
          type="date" 
          value={payerDate} 
          max={getTodayDateString()}
          onChange={(e) => {
            const selectedDate = new Date(e.target.value);
            const today = new Date();
            selectedDate.setHours(0, 0, 0, 0);
            today.setHours(0, 0, 0, 0);
            
            if (selectedDate > today) {
              toast.error("Cannot select a future date");
              setPayerDate(getTodayDateString());
            } else {
              setPayerDate(e.target.value);
            }
          }}
          className="h-9 text-sm bg-background/50"
        />
      </div>

      {/* CATEGORY - Small and compact */}
      <div className="space-y-1.5">
        <div className="flex justify-between items-center px-0.5">
          <Label className="text-[11px] font-bold uppercase opacity-70">Category *</Label>
          <button 
            type="button"
            onClick={() => setIsAddingCategory(true)} 
            className="text-[10px] text-primary font-bold hover:underline"
          >
            + New
          </button>
        </div>
        <Select 
          value={currentExpense.category} 
          onValueChange={(v) => setCurrentExpense({ ...currentExpense, category: v })}
        >
          <SelectTrigger className="h-9 text-sm bg-background/50">
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <div key={c} className="flex items-center justify-between px-1 group">
                <SelectItem value={c} className="flex-1 text-sm">{c}</SelectItem>
                <button 
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteCategory(c); }} 
                  className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* AMOUNT */}
     <div className="space-y-1.5">
  <Label className="text-[11px] font-bold uppercase opacity-70">Amount (Rs) *</Label>
  <Input 
    type="number" 
    placeholder="0"
    value={currentExpense.amount} 
    onChange={(e) => setCurrentExpense({ ...currentExpense, amount: e.target.value })} 
    className="h-9 text-sm bg-background/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
  />
</div>
    </div>

    {/* NOTES - Small placeholder and height */}
    <div className="space-y-1.5">
      <Label className="text-[11px] font-bold uppercase opacity-70">Notes</Label>
      <Input 
        value={currentExpense.description} 
        onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })} 
        placeholder="Add note..." 
        className="h-9 text-sm bg-background/50"
      />
    </div>

    {/* SUBMIT BUTTON */}
    <Button 
      onClick={handleRecordDirectly} 
      disabled={isSubmitting}
      className="w-full gradient-gold text-primary-foreground font-bold h-10 text-sm shadow-md active:scale-[0.99] transition-all"
    >
      {isSubmitting ? "Processing..." : "Record Expense"}
    </Button>
  </div>
</div>
      {/* HISTORY TABLE */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">History</h2>
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
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredExpenses
              .sort((a, b) => {
                const dateOrder = b.date.localeCompare(a.date);
                if (dateOrder !== 0) return dateOrder;
                return String(b.id).localeCompare(String(a.id));
              })
              .map((e) => (
              <TableRow key={e.id} className="border-border">
                <TableCell><span className="px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium">{e.category}</span></TableCell>
                <TableCell className="font-semibold">Rs {e.amount}</TableCell>
                <TableCell className="text-muted-foreground">{e.date}</TableCell>
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
                      <DropdownMenuItem onClick={() => handleStartEdit(e)}>Edit</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => handleRequestDeleteExpense(e)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* DIALOG: ADD CATEGORY */}
      <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add New Category</DialogTitle></DialogHeader>
          <div className="py-4">
            <Label>Category Name</Label>
            <Input 
              autoFocus
              value={newCategoryName} 
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddingCategory(false)}>Cancel</Button>
            <Button onClick={handleAddCategory}>Save Category</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: EDIT EXPENSE */}
      <Dialog
        open={isEditingExpense}
        onOpenChange={(open) => {
          setIsEditingExpense(open);
          if (!open) setEditingExpense(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={editExpenseValues.date}
                  max={getTodayDateString()}
                  onChange={(e) => {
                    const selectedDate = new Date(e.target.value);
                    const today = new Date();
                    selectedDate.setHours(0, 0, 0, 0);
                    today.setHours(0, 0, 0, 0);
                    
                    if (selectedDate > today) {
                      toast.error("Cannot select a future date");
                      setEditExpenseValues({ ...editExpenseValues, date: getTodayDateString() });
                    } else {
                      setEditExpenseValues({ ...editExpenseValues, date: e.target.value });
                    }
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label>Amount (Rs) *</Label>
                <Input
                  type="number"
                  value={editExpenseValues.amount}
                  onChange={(e) => setEditExpenseValues({ ...editExpenseValues, amount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category *</Label>
              <Select
                value={editExpenseValues.category}
                onValueChange={(v) => setEditExpenseValues({ ...editExpenseValues, category: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {editCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editExpenseValues.description}
                onChange={(e) => setEditExpenseValues({ ...editExpenseValues, description: e.target.value })}
                placeholder="Details..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditingExpense(false)}>Cancel</Button>
            <Button onClick={handleUpdateExpense}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: DELETE EXPENSE */}
      <AlertDialog open={isDeletingExpense} onOpenChange={setIsDeletingExpense}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete expense?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this expense record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingExpense(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleConfirmDeleteExpense}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG: BILL POPUP */}
      <Dialog open={showBill} onOpenChange={setShowBill}>
        <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border border-border bg-card">
          <div className="bg-primary p-6 text-center text-primary-foreground">
            <Receipt className="h-10 w-10 text-white mx-auto mb-4" />
            <h2 className="text-2xl font-bold">Success!</h2>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between border-b pb-2"><span>Payer</span><span className="font-bold">{lastRecorded?.staffName}</span></div>
            <div className="flex justify-between border-b pb-2"><span>Category</span><span className="font-bold">{lastRecorded?.category}</span></div>
            <div className="flex justify-between pt-2"><span className="text-lg font-bold">Amount</span><span className="text-xl font-bold text-primary">Rs {lastRecorded?.amount}</span></div>
            <Button onClick={() => setShowBill(false)} className="w-full mt-4">Done</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}