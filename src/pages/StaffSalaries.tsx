import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { StaffUser } from "@/test/types/models";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Banknote,
  UserPlus,
  MoreVertical,
  User,
  History,
  Wallet,
  Users,
  CheckCircle2,
  Clock,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";

export default function StaffListPage() {
  const navigate = useNavigate();
  const {
    users: staff,
    deleteUser: deleteStaff,
    updateUser: updateStaff,
    salaryPayments,
    clearAllSalaryPayments,
  } = useData();
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  const getReferenceMonthDate = (payment: (typeof salaryPayments)[number]) => {
    if (payment.salaryForMonth && /^\d{4}-\d{2}$/.test(payment.salaryForMonth)) {
      const [year, month] = payment.salaryForMonth.split("-").map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date(payment.date);
  };

  const getOutstandingAdvanceAmount = (staffId: string) => {
    const totalAdvanceTaken = salaryPayments
      .filter((payment) => payment.staffId === staffId && payment.paymentType === "advance")
      .reduce((sum, payment) => sum + payment.amount, 0);

    const totalAdvanceDeducted = salaryPayments
      .filter((payment) => payment.staffId === staffId && payment.paymentType === "full")
      .reduce((sum, payment) => {
        // Use new field if available
        if (payment.advanceDeducted !== undefined) {
          return sum + payment.advanceDeducted;
        }
        // Fallback: Parse from notes for old records
        const notes = payment.notes || "";
        const loanDeductionMatch = notes.match(/Loan\s*Deduction:\s*Rs\s*([\d,]+)/i);
        const legacyAdvanceAdjustmentMatch = notes.match(/Advance\s*Adjustment:\s*Rs\s*([\d,]+)/i);
        const rawValue = loanDeductionMatch?.[1] || legacyAdvanceAdjustmentMatch?.[1];
        const adjustedAmount = rawValue ? Number(rawValue.replace(/,/g, "")) : 0;
        return sum + (Number.isFinite(adjustedAmount) ? adjustedAmount : 0);
      }, 0);

    return Math.max(0, totalAdvanceTaken - totalAdvanceDeducted);
  };

  const getLatestEarlySalaryMonthLabel = (staffId: string) => {
    const earlySalaryPayouts = salaryPayments
      .filter((payment) => payment.staffId === staffId && payment.paymentType === "full")
      .filter((payment) => (payment.notes || "").toLowerCase().includes("early salary payout"))
      .sort((a, b) => getReferenceMonthDate(b).getTime() - getReferenceMonthDate(a).getTime());

    const latestPayout = earlySalaryPayouts[0];
    if (!latestPayout) return null;

    const monthDate = getReferenceMonthDate(latestPayout);
    return monthDate.toLocaleDateString("en-US", { month: "long" });
  };

  const handleClearHistory = async () => {
    try {
      await clearAllSalaryPayments();
      toast.success("Payment history cleared");
    } catch (error) {
      toast.error("Failed to clear payment history");
    }
  };

  console.log(
    "[StaffSalaries] Page render - Total payments:",
    salaryPayments.length,
  );
  console.log("[StaffSalaries] All payments:", salaryPayments);
  console.log(
    "[StaffSalaries] Payment IDs:",
    salaryPayments.map((p) => p.id),
  );
  console.log(
    "[StaffSalaries] Payment breakdown:",
    salaryPayments.map((p) => ({
      id: p.id,
      staff: p.staffName,
      type: p.paymentType,
      amount: p.amount,
      date: p.date,
    })),
  );

  const handleUpdateStaff = () => {
    updateStaff(editingStaff.id, editingStaff);
    toast.success("Staff details updated");
    setEditingStaff(null);
  };

  const getReferenceDateFromPayment = (
    payment: (typeof salaryPayments)[number],
  ) => {
    if (
      payment.salaryForMonth &&
      /^\d{4}-\d{2}$/.test(payment.salaryForMonth)
    ) {
      const [year, month] = payment.salaryForMonth.split("-").map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date(payment.date);
  };

  const getReferenceLabel = (payment: (typeof salaryPayments)[number]) => {
    const referenceStart = getReferenceDateFromPayment(payment);
    if (
      payment.paymentType === "advance" &&
      payment.numberOfMonths &&
      payment.numberOfMonths > 1
    ) {
      const months: string[] = [];
      for (let i = 0; i < payment.numberOfMonths; i++) {
        const monthDate = new Date(referenceStart);
        monthDate.setMonth(monthDate.getMonth() + i);
        months.push(monthDate.toLocaleDateString("en-US", { month: "long" }));
      }
      return `Advance for ${months.join(", ")}`;
    }

    return `For ${referenceStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
  };

  // ===== HELPER FUNCTIONS FOR STATISTICS =====

  // Extract net payout amount staff actually received from payment notes
  const getNetPayoutFromNotes = (notes: string): number => {
    const match = notes.match(/Staff Receives:\s*Rs\s*([\d,]+)/i);
    if (match) {
      const amount = Number(match[1].replace(/,/g, ""));
      return Number.isFinite(amount) ? amount : 0;
    }
    return 0;
  };

  // Extract loan deduction amount from payment notes
  const getLoanDeductionFromNotes = (notes: string): number => {
    const match = notes.match(/Loan\s*Deduction:\s*Rs\s*([\d,]+)/i);
    if (match) {
      const amount = Number(match[1].replace(/,/g, ""));
      return Number.isFinite(amount) ? amount : 0;
    }
    return 0;
  };

  // Filter to show only last 30 days on the UI (full records remain in SQLite)
  const last30DaysPayments = salaryPayments
    .filter((payment) => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Today counts as day 1, so -29 for 30 days total
      const paymentDate = new Date(payment.date);
      return paymentDate >= thirtyDaysAgo;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate statistics
  const totalStaff = staff.length;
  const totalMonthlySalary = staff.reduce(
    (sum, s) => sum + (s.monthlySalary || 0),
    0,
  );
  const totalStaffPaid = new Set(salaryPayments.map((p) => p.staffId)).size;

  const getCurrentMonthPayments = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    
    return salaryPayments.filter((payment) => {
      const paymentDate = new Date(payment.date);
      return paymentDate.getFullYear() === currentYear && paymentDate.getMonth() === currentMonth;
    });
  };

  const currentMonthPayments = getCurrentMonthPayments();

  // PAID SALARIES (This Month): Sum of (amount_paid + advance_deducted) for current month
  // This includes both the net amount staff received AND the advance that was deducted
  const paidSalariesCurrentMonth = currentMonthPayments
    .filter((payment) => payment.paymentType === "full")
    .reduce((sum, payment) => {
      // Use new fields if available
      if (payment.amountPaid !== undefined || payment.advanceDeducted !== undefined) {
        const amountPaid = payment.amountPaid || 0;
        const advanceDeducted = payment.advanceDeducted || 0;
        return sum + amountPaid + advanceDeducted;
      }
      // Fallback: Parse from notes for old records
      const netPayout = getNetPayoutFromNotes(payment.notes || "");
      const loanDeduction = getLoanDeductionFromNotes(payment.notes || "");
      return sum + netPayout + loanDeduction;
    }, 0);

  // UNPAID SALARIES (This Month): Sum of monthly salaries for staff who haven't been paid yet
  const staffPaidThisMonth = new Set(
    currentMonthPayments
      .filter((payment) => payment.paymentType === "full")
      .map((payment) => payment.staffId)
  );
  const unpaidSalariesCurrentMonth = staff
    .filter((s) => !staffPaidThisMonth.has(s.id))
    .reduce((sum, s) => sum + (s.monthlySalary || 0), 0);

  // OUTSTANDING ADVANCE DEBT: Total advances - total advance deducted
  const totalAdvances = salaryPayments
    .filter((payment) => payment.paymentType === "advance")
    .reduce((sum, payment) => sum + payment.amount, 0);

  const totalAdvanceDeducted = salaryPayments
    .filter((payment) => payment.paymentType === "full")
    .reduce((sum, payment) => {
      // Use new field if available
      if (payment.advanceDeducted !== undefined) {
        return sum + payment.advanceDeducted;
      }
      // Fallback: Parse from notes for old records
      return sum + getLoanDeductionFromNotes(payment.notes || "");
    }, 0);

  const totalAdvancePayments = Math.max(0, totalAdvances - totalAdvanceDeducted);

  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="space-y-8 p-4 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Staff Salaries - {currentMonth}
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage your team's salary payments
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate("/pay-salary")}
              className="gradient-gold text-primary-foreground px-6 py-2 rounded-lg flex gap-2"
            >
              <Banknote className="w-4 h-4" /> Pay Salary
            </Button>
            <Button
              onClick={() => navigate("/advance-payment")}
              className="gradient-gold text-primary-foreground px-6 py-2 rounded-lg flex gap-2"
            >
              <Clock className="w-4 h-4" /> Advance Payment
            </Button>
            <Button
              onClick={() => navigate("/add-staff")}
              className="gradient-gold text-primary-foreground px-6 py-2 rounded-lg flex gap-2"
            >
              <UserPlus className="w-4 h-4" /> Add Staff
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Paid Salaries
                </p>
                <p className="text-2xl font-bold text-primary mt-1">
                  Rs {paidSalariesCurrentMonth.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Unpaid Salaries 
                </p>
                <p className="text-2xl font-bold text-primary mt-1">
                  Rs {unpaidSalariesCurrentMonth.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Clock className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  Total Advance Payments
                </p>
                <p className="text-2xl font-bold text-primary mt-1">
                  Rs {totalAdvancePayments.toLocaleString()}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        </div>

        {/* Staff List */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="bg-primary/5 p-4 border-b border-border">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Staff Members
            </h2>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Staff Member</TableHead>
                  <TableHead className="font-semibold">
                    Monthly Salary
                  </TableHead>
                  <TableHead className="font-semibold">
                    Monthly Status
                  </TableHead>
                  <TableHead className="font-semibold">
                    Advance
                  </TableHead>
                  <TableHead className="text-right font-semibold">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow
                    key={s.id}
                    className="hover:bg-primary/5 transition-colors"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold shadow-sm">
                          {s.fullName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-foreground">{s.fullName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-primary text-lg">
                        Rs {(s.monthlySalary || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const thisMonthlySalaryPayment = currentMonthPayments.find(
                          (payment) => payment.staffId === s.id && payment.paymentType === "full"
                        );
                        const isPaid = !!thisMonthlySalaryPayment;
                        
                        return isPaid ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                            Unpaid
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const outstandingAdvance = getOutstandingAdvanceAmount(s.id);
                        
                        if (outstandingAdvance > 0) {
                          return (
                            <span className="font-semibold text-red-700">
                              Rs {outstandingAdvance.toLocaleString()}
                            </span>
                          );
                        }

                        return (
                          <span className="text-muted-foreground">
                            N/A
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="hover:bg-primary/10"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setEditingStaff(s)}
                            className="cursor-pointer"
                          >
                            Update Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive cursor-pointer"
                            onClick={() => deleteStaff(s.id)}
                          >
                            Delete Staff
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Payment History Section - Always Visible */}
        <div className="bg-card rounded-xl shadow-sm border border-border overflow-hidden">
          <div className="bg-primary/5 p-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <History className="w-5 h-5 text-primary" />
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Payment History
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Showing last 30 days{" "}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 backdrop-blur-sm px-3 py-1 rounded-full text-amber-700 text-xs font-semibold">
                  {last30DaysPayments.length} Recent
                </span>
                {/* <Button
                  onClick={handleClearHistory}
                  variant="destructive"
                  size="sm"
                >
                  Clear All
                </Button> */}
              </div>
            </div>
          </div>

          <div className="p-4">
            {last30DaysPayments.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">
                  No recent payments (last 30 days)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {salaryPayments.length > 0
                    ? `${salaryPayments.length} payment(s) exist in history but are older than 30 days`
                    : "Start by making salary payments to your staff"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {last30DaysPayments.map((payment) => {
                  const paymentDate = new Date(payment.date);
                  const outstandingAdvance = getOutstandingAdvanceAmount(
                    payment.staffId,
                  );
                  const latestEarlySalaryMonth = getLatestEarlySalaryMonthLabel(
                    payment.staffId,
                  );

                  return (
                    <div
                      key={payment.id}
                      className="p-4 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
  {/* Left Section: Icon and Details */}
  <div className="flex items-start gap-3 flex-1 min-w-0">
    <div className="flex-shrink-0 mt-0.5">
      {payment.paymentType === "advance" ? (
        <Clock className="w-5 h-5 text-blue-600" />
      ) : (
        <CheckCircle2 className="w-5 h-5 text-emerald-600" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="font-semibold text-sm text-foreground">
        {payment.staffName}
      </p>
      <p className="text-xs text-foreground/70 mt-0.5">
        {payment.paymentType === "advance"
          ? "Advance Payment"
          : "Salary Payment"}
        {` • ${getReferenceLabel(payment)}`}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {paymentDate.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </p>
    </div>
  </div>

  {/* Right Section: Amount (Now Centered Vertically) */}
  <div className="text-right flex-shrink-0 self-center">
    <p className="font-bold text-sm text-amber-700">
      Rs {payment.amount.toLocaleString()}
    </p>
  </div>
</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Edit Dialog */}
        <Dialog
          open={!!editingStaff}
          onOpenChange={(open) => !open && setEditingStaff(null)}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">
                Edit Staff Details
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Full Name</Label>
                <Input
                  value={editingStaff?.fullName || ""}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff,
                      fullName: e.target.value,
                    })
                  }
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Monthly Salary (Rs)
                </Label>
                <Input
                  type="number"
                  value={editingStaff?.monthlySalary || ""}
                  onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff!,
                      monthlySalary: Number(e.target.value),
                    })
                  }
                  className="h-12"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleUpdateStaff}
                className="gradient-gold w-full py-2 text-sm font-semibold"
              >
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
