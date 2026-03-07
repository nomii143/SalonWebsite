import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wallet, Loader2, AlertTriangle, DollarSign, AlertCircle, Wrench, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";

export default function PaySalaryPage() {
  const navigate = useNavigate();
  const {
    users: staff,
    addSalaryPayment,
    salaryPayments,
    getReferenceMonthPaidAmount,
    isReferenceMonthLocked
  } = useData();

  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [amount, setAmount] = useState("");
  const [debtAdjustmentAmount, setDebtAdjustmentAmount] = useState("0");
  const [date, setDate] = useState(getTodayDateString());
  const [isProcessing, setIsProcessing] = useState(false);

  // ===== HELPER FUNCTIONS =====

  const getReferenceMonthKey = (dateString: string) => {
    const refDate = new Date(dateString);
    if (Number.isNaN(refDate.getTime())) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
  };

  const getPaymentReferenceDate = (payment: (typeof salaryPayments)[number]) => {
    if (payment.salaryForMonth && /^\d{4}-\d{2}$/.test(payment.salaryForMonth)) {
      const [year, month] = payment.salaryForMonth.split("-").map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date(payment.date);
  };

  // Get TOTAL advance taken - shows FULL amount never subtracted
  const getTotalAdvanceTaken = (staffId: string, upTo: Date = new Date()) => {
    const upToTimestamp = upTo.getTime();
    return salaryPayments
      .filter((p) => p.staffId === staffId && p.paymentType === "advance")
      .filter((p) => {
        const paymentDate = new Date(p.date);
        return !Number.isNaN(paymentDate.getTime()) && paymentDate.getTime() <= upToTimestamp;
      })
      .reduce((total, p) => total + p.amount, 0);
  };

  // Get total deductions from advance based on salary payments with deductions
  const getTotalAdvanceDeductions = (staffId: string, upTo: Date = new Date()) => {
    const upToTimestamp = upTo.getTime();
    return salaryPayments
      .filter((p) => p.staffId === staffId && p.paymentType === "full")
      .filter((p) => {
        const paymentDate = new Date(p.date);
        return !Number.isNaN(paymentDate.getTime()) && paymentDate.getTime() <= upToTimestamp;
      })
      .reduce((total, p) => {
        // Use advanceDeducted field first, fallback to parsing notes for backward compatibility
        if (p.advanceDeducted !== undefined && p.advanceDeducted > 0) {
          return total + p.advanceDeducted;
        }
        // Fallback: Parse from notes for old records
        const notes = p.notes || "";
        const match = notes.match(/Loan\s*Deduction:\s*Rs\s*([\d,]+)/i);
        const deduction = match ? Number(match[1].replace(/,/g, "")) : 0;
        return total + (Number.isFinite(deduction) ? deduction : 0);
      }, 0);
  };

  // Outstanding debt = Total advance - Total deductions
  const getOutstandingAdvanceDue = (staffId: string, upTo: Date = new Date()) => {
    const totalAdvance = getTotalAdvanceTaken(staffId, upTo);
    const totalDeducted = getTotalAdvanceDeductions(staffId, upTo);
    return Math.max(0, totalAdvance - totalDeducted);
  };

  // ===== EVENT HANDLERS =====

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    const selectedStaff = staff.find(s => s.id === staffId);
    if (selectedStaff?.monthlySalary) {
      setAmount(String(selectedStaff.monthlySalary));
      setDebtAdjustmentAmount("0");
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        setAmount(String(selectedStaff.monthlySalary));
        setDebtAdjustmentAmount("0");
      }
    }
  };

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);

      if (!selectedStaffId || !amount) {
        setIsProcessing(false);
        return toast.error("Please select staff and enter amount");
      }

      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (!selectedStaff) {
        setIsProcessing(false);
        return toast.error("Staff not found");
      }

      const paymentDate = new Date(date);
      const salaryForMonth = getReferenceMonthKey(date);
      const monthLocked = isReferenceMonthLocked(selectedStaffId, salaryForMonth);

      if (monthLocked) {
        setIsProcessing(false);
        return toast.error("This reference month is already fully paid. Salary transactions are locked.");
      }

      const paymentAmount = Number(amount);
      if (paymentAmount <= 0) {
        setIsProcessing(false);
        return toast.error("Payment amount must be greater than zero");
      }

      const currentMonthlySalary = selectedStaff.monthlySalary || 0;
      const debtAdjustment = Number(debtAdjustmentAmount) || 0;
      const totalDebt = getOutstandingAdvanceDue(selectedStaffId, paymentDate);
      const maxDeductionAllowed = Math.min(totalDebt, currentMonthlySalary);

     // Validation: Loan Adjustment cannot exceed monthly salary
 if (debtAdjustment > currentMonthlySalary) {
   setIsProcessing(false);
   return toast.error(
     `Loan Adjustment (Rs ${debtAdjustment.toLocaleString()}) cannot exceed monthly salary (Rs ${currentMonthlySalary.toLocaleString()})`
   );
 }
      // Validation: Deduction cannot exceed payment amount
      if (debtAdjustment > paymentAmount) {
        setIsProcessing(false);
        return toast.error(
          `Deduction (Rs ${debtAdjustment.toLocaleString()}) cannot exceed payment amount (Rs ${paymentAmount.toLocaleString()})`
        );
      }

      // Validation: Deduction cannot exceed outstanding debt
      if (debtAdjustment > totalDebt) {
        setIsProcessing(false);
        return toast.error(
          `Deduction (Rs ${debtAdjustment.toLocaleString()}) cannot exceed outstanding loan debt (Rs ${totalDebt.toLocaleString()})`
        );
      }

      const netPayout = Math.max(0, paymentAmount - debtAdjustment);

      // Build payment notes
      let paymentNotes = "";
      if (debtAdjustment === 0) {
        paymentNotes = `Full Salary Payout: Rs ${paymentAmount.toLocaleString()} | Staff Receives: Rs ${netPayout.toLocaleString()}`;
      } else {
        paymentNotes = `Salary with Loan Deduction: Rs ${paymentAmount.toLocaleString()} | Loan Deduction: Rs ${debtAdjustment.toLocaleString()} | Staff Receives: Rs ${netPayout.toLocaleString()}`;
      }

      // Record payment with new fields
      await addSalaryPayment({
        staffId: selectedStaffId,
        staffName: selectedStaff.fullName,
        amount: paymentAmount,
        paymentType: "full",
        date: new Date().toISOString(),
        salaryForMonth,
        notes: paymentNotes,
        status: "Completed",
        amountPaid: netPayout,
        advanceDeducted: debtAdjustment,
        totalSalaryGiven: paymentAmount,
        month: paymentDate.getMonth() + 1,
        year: paymentDate.getFullYear()
      });

      const monthName = paymentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      toast.success(`Salary of Rs ${netPayout.toLocaleString()} recorded for ${monthName}`);

      setTimeout(() => {
        setIsProcessing(false);
        navigate("/staffsalaries");
      }, 500);
    } catch (error) {
      console.error("Payment error:", error);
      setIsProcessing(false);
      toast.error(`Failed to process payment: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // ===== COMPUTED VALUES =====

  const referenceMonth = getReferenceMonthKey(date);
  const monthLocked = selectedStaffId ? isReferenceMonthLocked(selectedStaffId, referenceMonth) : false;
  const selectedStaff = staff.find(s => s.id === selectedStaffId);
  const monthlySalary = selectedStaff?.monthlySalary || 0;
  const paymentDate = new Date(date);
  const totalDebts = selectedStaffId ? getOutstandingAdvanceDue(selectedStaffId, paymentDate) : 0;
  const debtAdjustment = Number(debtAdjustmentAmount) || 0;
  const netPayout = Math.max(0, Number(amount || 0) - debtAdjustment);
  const maxDeductionAllowed = Math.min(totalDebts, monthlySalary);

  const canConfirm = selectedStaffId && Number(amount) > 0 && !monthLocked && !isProcessing;

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back
      </Button>

      <div className="bg-card border p-8 rounded-2xl shadow-xl border-primary/10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Wallet className="text-primary" /> Pay Staff Salary
        </h2>

        <div className="space-y-6">
          {/* Step 1: Select Staff Member */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Select Staff Member</Label>
            <Select value={selectedStaffId} onValueChange={handleStaffChange}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Choose Staff Member" />
              </SelectTrigger>
              <SelectContent>
                {staff.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-black data-[highlighted]:text-black data-[state=checked]:text-black">
                    <div className="flex items-center gap-3">
                      <span>{s.fullName}</span>
                      {s.monthlySalary && (
                        <span className="text-xs text-black/80 data-[highlighted]:text-black data-[state=checked]:text-black">
                          Rs {s.monthlySalary.toLocaleString()}/month
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Step 2: Select Month & Year */}
          {selectedStaffId && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Select Salary Month & Year</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Month Selector */}
                <Select
                  value={String(new Date(date).getMonth())}
                  onValueChange={(monthStr) => {
                    const newDate = new Date(date);
                    newDate.setMonth(parseInt(monthStr));
                    const year = newDate.getFullYear();
                    const month = String(newDate.getMonth() + 1).padStart(2, "0");
                    const day = String(newDate.getDate()).padStart(2, "0");
                    handleDateChange(`${year}-${month}-${day}`);
                  }}
                >
                  <SelectTrigger className="h-12 text-base font-semibold bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map(
                      (month, idx) => {
                        const year = new Date(date).getFullYear();
                        const monthKey = `${year}-${String(idx + 1).padStart(2, "0")}`;
                        const paidForMonth = getReferenceMonthPaidAmount(selectedStaffId, monthKey);
                        const isLocked = isReferenceMonthLocked(selectedStaffId, monthKey);
                        return (
                          <SelectItem key={idx} value={String(idx)} disabled={isLocked}>
                            {month} {monthlySalary > 0 ? `(Paid: Rs ${paidForMonth.toLocaleString()} / Rs ${monthlySalary.toLocaleString()})` : ""}
                          </SelectItem>
                        );
                      }
                    )}
                  </SelectContent>
                </Select>

                {/* Year Selector */}
                <Select
                  value={String(new Date(date).getFullYear())}
                  onValueChange={(yearStr) => {
                    const newDate = new Date(date);
                    newDate.setFullYear(parseInt(yearStr));
                    const year = newDate.getFullYear();
                    const month = String(newDate.getMonth() + 1).padStart(2, "0");
                    const day = String(newDate.getDate()).padStart(2, "0");
                    handleDateChange(`${year}-${month}-${day}`);
                  }}
                >
                  <SelectTrigger className="h-12 text-base font-semibold bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026, 2027, 2028].map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* CONDITION: Month Already Paid Alert */}
          {selectedStaffId && monthLocked && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-red-700">
                    Already Fully Paid for {paymentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    Salary transactions for this month are locked. No further payments can be recorded.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Salary Payment Form - Only show if month NOT locked */}
          {selectedStaffId && !monthLocked && (
            <div className="space-y-6">
              {/* Monthly Salary Display */}
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="text-sm font-semibold text-blue-800">Monthly Salary Amount</div>
                <div className="text-3xl font-bold text-blue-700 mt-2">
                  Rs {monthlySalary.toLocaleString()}
                </div>
              </div>

              {/* Salary Payout Input */}
             

              {/* Outstanding Loan Debt Display - Show only if > 0 */}
              {totalDebts > 0 && (
                <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-red-800 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5" /> Total Advance Loan:
                    </span>
                    <span className="text-3xl font-bold text-red-700">
                      Rs {totalDebts.toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Deduction from Existing Loan - ONLY SHOWN IF DEBT EXISTS */}
              {totalDebts > 0 && (
              <div className="space-y-2">
                <Label className="text-base font-semibold text-blue-800 flex items-center gap-2">
                  <Wrench className="w-4 h-4" /> Adjust Existing Loan (Rs)
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={debtAdjustmentAmount}
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    if (nextValue === "") {
                      setDebtAdjustmentAmount("0");
                      return;
                    }
                    const parsed = Number(nextValue);
                    if (!Number.isFinite(parsed) || parsed < 0) {
                      return;
                    }
                    setDebtAdjustmentAmount(nextValue);
                  }}
                  placeholder="Leave at 0 - Staff gets full salary"
                  className="h-14 text-lg font-semibold border-2 border-blue-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              )}

              
              {/* Confirm Button */}
              <Button
                onClick={handleConfirm}
                className="w-full py-7 text-xl font-bold shadow-lg mt-4 transition-all gradient-gold"
                disabled={!canConfirm}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing Payment...
                  </>
                ) : (
                  `Confirm Salary: Rs ${netPayout.toLocaleString()}`
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
