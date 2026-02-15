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
import { Expense } from "@/types/models";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export default function Expenses() {
  const { expenses, users, addExpense, addUser } = useData();

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
  const [payerDate, setPayerDate] = useState(new Date().toISOString().split("T")[0]);
  const [currentExpense, setCurrentExpense] = useState({ category: "", amount: "", description: "" });
  
  // --- 3. UI STATES ---
  const [range, setRange] = useState<"daily" | "weekly" | "monthly" | "all">("daily");
  const [showBill, setShowBill] = useState(false);
  const [lastRecorded, setLastRecorded] = useState<any>(null);

  const expensePayers = useMemo(
    () => users.filter((user) => user.source === "expense"),
    [users]
  );

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
    const finalStaffName = payerName.trim();

    if (!finalStaffName) return toast.error("Please specify who paid");
    if (!currentExpense.category) return toast.error("Select a category");
    if (!currentExpense.amount || Number(currentExpense.amount) <= 0) return toast.error("Enter valid amount");

    try {
      const expenseData = {
        category: currentExpense.category as any, // Cast to any to avoid Type errors with dynamic strings
        amount: Number(currentExpense.amount),
        staffName: finalStaffName,
        staffPicture: "",
        description: currentExpense.description,
        date: payerDate,
      };

      const exists = expensePayers.some(
        (payer) => normalizeName(payer.fullName) === normalizeName(finalStaffName)
      );
      if (finalStaffName && !exists) {
        await addUser({
          fullName: finalStaffName,
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
    } catch (error) {
      toast.error("Failed to record expense");
    }
  };

  // Filter Logic
  const filteredExpenses = useMemo(() => {
    if (range === "all") return expenses;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const start = new Date(today);
    if (range === "weekly") start.setDate(start.getDate() - 6);
    else if (range === "monthly") start.setDate(start.getDate() - 29);

    return expenses.filter((expense) => {
      const [year, month, day] = expense.date.split("-").map(Number);
      const expenseDate = new Date(year, month - 1, day);
      if (range === "daily") return expenseDate.getTime() === today.getTime();
      return expenseDate >= start && expenseDate <= today;
    });
  }, [expenses, range]);

  return (
    <div className="space-y-8" onKeyDown={(e) => {
      // Only trigger record if user isn't in a modal or the staff dropdown
      if (e.key === 'Enter' && !isAddingCategory && !showBill) {
        handleRecordDirectly();
      }
    }}>
      <div>
        <h1 className="text-3xl font-display font-bold">Expenses</h1>
        <p className="text-muted-foreground mt-1">Manage categories and track spending</p>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        <div className="rounded-xl bg-card border border-border p-6 shadow-card space-y-5">
          <h2 className="text-lg font-semibold">Record New Expense</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Paid By *</Label>
              <Input
                list="expense-payers"
                placeholder="Type or select name"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
              />
              <datalist id="expense-payers">
                {expensePayers.map((payer) => (
                  <option key={payer.id} value={payer.fullName} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={payerDate} onChange={(e) => setPayerDate(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label>Category *</Label>
                <button onClick={() => setIsAddingCategory(true)} className="text-xs text-primary font-bold hover:underline">+ New</button>
              </div>
              <Select value={currentExpense.category} onValueChange={(v) => setCurrentExpense({ ...currentExpense, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select Category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <div key={c} className="flex items-center justify-between px-2 group">
                      <SelectItem value={c} className="flex-1">{c}</SelectItem>
                      <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteCategory(c); }} className="opacity-0 group-hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Amount (Rs) *</Label>
              <Input type="number" value={currentExpense.amount} onChange={(e) => setCurrentExpense({ ...currentExpense, amount: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={currentExpense.description} onChange={(e) => setCurrentExpense({ ...currentExpense, description: e.target.value })} placeholder="Details..." rows={2} />
          </div>

          <Button onClick={handleRecordDirectly} className="w-full gradient-gold text-primary-foreground font-bold h-12">
            Record Expense
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
              <TableHead>Paid By</TableHead>
              <TableHead>Date</TableHead>
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
                <TableCell>{e.staffName}</TableCell>
                <TableCell className="text-muted-foreground">{e.date}</TableCell>
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
            <Button onClick={() => setShowBill(false)} className="w-full mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}