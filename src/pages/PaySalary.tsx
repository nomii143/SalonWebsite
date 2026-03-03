import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wallet, Info, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";

export default function PaySalaryPage() {
  const navigate = useNavigate();
  const {
    users: staff,
    addSalaryPayment,
    salaryPayments,
    getStaffRunningBalance,
    getStaffTotalEarned,
    getStaffTotalPaid,
    getReferenceMonthPaidAmount,
    isReferenceMonthLocked
  } = useData();
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [payType, setPayType] = useState<"advance" | "full" | null>(null);
  const [amount, setAmount] = useState("");
  const [advanceAdjustmentAmount, setAdvanceAdjustmentAmount] = useState("");
  const [date, setDate] = useState(getTodayDateString());
  const [numberOfMonths, setNumberOfMonths] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

  const getReferenceMonthKey = (value: string) => {
    const refDate = new Date(value);
    if (Number.isNaN(refDate.getTime())) {
      const now = new Date();
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    return `${refDate.getFullYear()}-${String(refDate.getMonth() + 1).padStart(2, "0")}`;
  };

  const getDateFromReferenceMonth = (referenceMonth?: string, fallbackDate?: string) => {
    if (referenceMonth && /^\d{4}-\d{2}$/.test(referenceMonth)) {
      const [year, month] = referenceMonth.split("-").map(Number);
      return new Date(year, month - 1, 1);
    }
    return fallbackDate ? new Date(fallbackDate) : new Date();
  };

  const getPaymentReferenceDate = (payment: (typeof salaryPayments)[number]) =>
    getDateFromReferenceMonth(payment.salaryForMonth, payment.date);

  const getReferenceMonthsLabel = (startDate: Date, months: number) => {
    const labels: string[] = [];
    for (let i = 0; i < months; i++) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(monthDate.getMonth() + i);
      labels.push(monthDate.toLocaleDateString("en-US", { month: "long" }));
    }
    return labels.join(", ");
  };

    // ==== MONTH STATUS STATE ====
    const [monthlyBalance, setMonthlyBalance] = useState(0);
    const [isMonthFullyPaid, setIsMonthFullyPaid] = useState(false);
    const [monthLockReason, setMonthLockReason] = useState("");
    
    // ==== ADVANCE BLOCKING STATE ====
    const [hasExistingAdvance, setHasExistingAdvance] = useState(false);
    const [advanceBlockReason, setAdvanceBlockReason] = useState("");

    // ==== CHECK EXISTING ADVANCE ====
    // Checks if an advance payment already exists for the selected month
    const checkExistingAdvance = useCallback((staffId: string, checkDate: Date) => {
      setAdvanceBlockReason("");
      setHasExistingAdvance(false);
    }, []);

    // ==== CHECK STATUS FUNCTION ====
    // Called whenever date or staff selection changes
    const checkStatus = useCallback((staffId: string, checkDate: Date) => {
      if (!staffId) {
        setMonthlyBalance(0);
        setIsMonthFullyPaid(false);
        setMonthLockReason("");
        setHasExistingAdvance(false);
        setAdvanceBlockReason("");
        return;
      }

      const selectedStaff = staff.find(s => s.id === staffId);
      if (!selectedStaff) return;

      const referenceMonth = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}`;
      const monthIsLocked = isReferenceMonthLocked(staffId, referenceMonth);
      const paidAmount = getReferenceMonthPaidAmount(staffId, referenceMonth);
      const monthlySalary = selectedStaff.monthlySalary || 0;

      setMonthlyBalance(getStaffRunningBalance(staffId, checkDate));
      setIsMonthFullyPaid(monthIsLocked);
      if (monthIsLocked) {
        setMonthLockReason(`Fully paid (${paidAmount.toLocaleString()} / ${monthlySalary.toLocaleString()})`);
      } else {
        setMonthLockReason("");
      }
      
      checkExistingAdvance(staffId, checkDate);
    }, [staff, getStaffRunningBalance, isReferenceMonthLocked, getReferenceMonthPaidAmount, checkExistingAdvance]);

    // ==== SMART PERIOD LOCK DETECTION ====
  // Checks if a period is locked due to existing payments
  const isPeriodLocked = (staffId: string, startDate: Date, monthsToCheck: number = 1): { isLocked: boolean; reason: string } => {
    return { isLocked: false, reason: "" };
  };

  // Get ONLY advances paid in the current month (not future months from multi-month advances)
  const getAdvancesForCurrentMonth = (staffId: string, paymentDate: Date) => {
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    const advances = salaryPayments.filter(payment => {
      if (payment.staffId !== staffId || payment.paymentType !== "advance") return false;
      
      const existingDate = getPaymentReferenceDate(payment);
      const existingMonth = existingDate.getMonth();
      const existingYear = existingDate.getFullYear();
      
      // Only match if the advance starts in this month
      return existingMonth === paymentMonth && existingYear === paymentYear;
    });

    return advances.reduce((total, payment) => total + payment.amount, 0);
  };

  // SMART Calculate advances paid in the selected month for the selected staff
  // Factors in multi-month advances: if advance has numberOfMonths, check if it covers current month
  const getAdvancesPaidInMonth = (staffId: string, paymentDate: Date) => {
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    const advances = salaryPayments.filter(payment => {
      if (payment.staffId !== staffId || payment.paymentType !== "advance") return false;
      
      const existingDate = getPaymentReferenceDate(payment);
      const existingMonth = existingDate.getMonth();
      const existingYear = existingDate.getFullYear();
      
      // Only count advances that START in this month (not spread across months)
      return existingMonth === paymentMonth && existingYear === paymentYear;
    });

    // Count the FULL advance amount (don't divide by numberOfMonths)
    // This shows the complete remaining balance in the next month
    return advances.reduce((total, payment) => total + payment.amount, 0);
  };

  // Check if full salary has been paid in the selected month
  const getFullSalaryPaidInMonth = (staffId: string, paymentDate: Date) => {
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    return salaryPayments
      .filter(payment => {
        if (payment.staffId !== staffId || payment.paymentType === "advance") return false;
        const existingDate = getPaymentReferenceDate(payment);
        return existingDate.getMonth() === paymentMonth && existingDate.getFullYear() === paymentYear;
      })
      .reduce((total, payment) => total + payment.amount, 0);
  };

  const getTotalPaidInMonth = (staffId: string, paymentDate: Date) => {
    const advancesPaid = getAdvancesPaidInMonth(staffId, paymentDate);
    const fullPaid = getFullSalaryPaidInMonth(staffId, paymentDate);
    return advancesPaid + fullPaid;
  };

  const getPreviousDueBalance = (staffId: string, selectedDate: Date) => {
    const selectedStaff = staff.find(s => s.id === staffId);
    const monthlySalary = selectedStaff?.monthlySalary || 0;
    if (!monthlySalary) return 0;

    const staffPayments = salaryPayments.filter(payment => payment.staffId === staffId);
    if (staffPayments.length === 0) return 0;

    const sortedPayments = [...staffPayments].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const earliestDate = new Date(sortedPayments[0].date);

    const monthCursor = new Date(earliestDate.getFullYear(), earliestDate.getMonth(), 1);
    const selectedMonthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    let cumulativeDue = 0;

    while (monthCursor.getTime() < selectedMonthStart.getTime()) {
      const paidInMonth = getTotalPaidInMonth(staffId, monthCursor);
      cumulativeDue += monthlySalary - paidInMonth;
      // Don't clamp here - allow full overpayment to carry to next month
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    // Only return positive due (actual amount owed)
    return Math.max(0, cumulativeDue);
  };

  const isFullSalaryPaid = (staffId: string, paymentDate: Date) => {
    const selectedStaff = staff.find(s => s.id === staffId);
    const monthlySalary = selectedStaff?.monthlySalary || 0;
    if (!monthlySalary) return false;

    const totalPaidInMonth = getTotalPaidInMonth(staffId, paymentDate);
    return totalPaidInMonth >= monthlySalary;
  };

  // Get remaining salary after advances
  const getRemainingAmount = (staffId: string, fullSalary: number, paymentDate: Date) => {
    const advancesPaid = getAdvancesPaidInMonth(staffId, paymentDate);
    return Math.max(0, fullSalary - advancesPaid);
  };

  // Get list of months to be paid
  const getMonthsToPay = (startDate: Date, numMonths: number) => {
    const months = [];
    for (let i = 0; i < numMonths; i++) {
      const monthDate = new Date(startDate);
      monthDate.setMonth(monthDate.getMonth() + i);
      months.push(monthDate);
    }
    return months;
  };

  // Calculate total amount for multiple months
  // Full Salary Logic: (Current Month Balance) + (Monthly Salary * (Selected Months - 1))
  const calculateTotalAmount = () => {
    if (!selectedStaffId || payType !== "full") return 0;
    
    const selectedStaff = staff.find(s => s.id === selectedStaffId);
    if (!selectedStaff?.monthlySalary) return 0;

    const startDate = new Date(date);
    const monthlySalary = selectedStaff.monthlySalary;
    
    // Get current month balance (after deducting advances)
    const currentMonthBalance = getRemainingAmount(selectedStaffId, monthlySalary, startDate);
    
    // Calculate: Current Month Balance + (Monthly Salary * (Months - 1))
    const total = currentMonthBalance + (monthlySalary * (numberOfMonths - 1));
    
    return total;
  };

  const getAdvanceTotalWithPreviousDue = (staffId: string, paymentDate: Date, months: number) => {
    const selectedStaff = staff.find(s => s.id === staffId);
    const monthlySalary = selectedStaff?.monthlySalary || 0;
    const paidInSelectedMonth = getTotalPaidInMonth(staffId, paymentDate);
    const currentRemaining = Math.max(0, monthlySalary - paidInSelectedMonth);
    const previousDue = getPreviousDueBalance(staffId, paymentDate);
    const futureMonthsAmount = monthlySalary * Math.max(0, months - 1);
    return currentRemaining + previousDue + futureMonthsAmount;
  };

  const getTotalOutstandingForDate = (staffId: string, paymentDate: Date) => {
    const selectedStaff = staff.find(s => s.id === staffId);
    const monthlySalary = selectedStaff?.monthlySalary || 0;
    const paidInSelectedMonth = getTotalPaidInMonth(staffId, paymentDate);
    const currentRemaining = Math.max(0, monthlySalary - paidInSelectedMonth);
    const previousDue = getPreviousDueBalance(staffId, paymentDate);
    return currentRemaining + previousDue;
  };

  // Removed - use getAdvanceTotalWithPreviousDue directly instead
  // getAdvanceTotalWithPreviousDue already includes current + previous due + future months

  const handleNumberOfMonthsChange = (value: string) => {
    const numMonths = parseInt(value);
    setNumberOfMonths(numMonths);
    
    // For Advance: Auto-fill amount with total outstanding + future months
    if (payType === "advance" && selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(date);
        const suggestedAmount = getAdvanceTotalWithPreviousDue(selectedStaffId, paymentDate, numMonths);
        setAmount(String(suggestedAmount));
      }
    }
  };

  const handlePayTypeChange = (type: "advance" | "full") => {
    const referenceMonth = getReferenceMonthKey(date);
    const monthLocked = selectedStaffId ? isReferenceMonthLocked(selectedStaffId, referenceMonth) : false;

    if (type === "full" && monthLocked) {
      toast.error("This reference month is fully paid. Full salary is locked.");
      return;
    }

    setPayType(type);
    
    // Full Salary: manual settlement with suggested current net due
    if (type === "full" && selectedStaffId) {
      const suggestedAmount = Math.max(0, getStaffRunningBalance(selectedStaffId, new Date(date)));
      setAmount(String(suggestedAmount));
      setAdvanceAdjustmentAmount(String(suggestedAmount));
    } else if (type === "advance" && selectedStaffId) {
      // Advance: allow any amount with simple default monthly salary
      setNumberOfMonths(1);
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        setAmount(String(selectedStaff.monthlySalary));
      }
      setAdvanceAdjustmentAmount("");
    }
  };

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    
    const selectedStaff = staff.find(s => s.id === staffId);
    
     // Check status for the selected staff and current date
     const paymentDate = new Date(date);
     checkStatus(staffId, paymentDate);
   
    // If Full Salary is already selected, suggest current due (editable)
    if (payType === "full" && selectedStaff?.monthlySalary) {
      setAmount(String(Math.max(0, getStaffRunningBalance(staffId, new Date(date)))));
    } else if (payType === "advance" && selectedStaff?.monthlySalary) {
      setAmount(String(selectedStaff.monthlySalary));
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const paymentDate = new Date(newDate);
    checkStatus(selectedStaffId, paymentDate);
    
    // Recalculate suggested amount when date changes
    if (payType === "full" && selectedStaffId) {
      const suggestedAmount = Math.max(0, getStaffRunningBalance(selectedStaffId, paymentDate));
      setAmount(String(suggestedAmount));
      setAdvanceAdjustmentAmount(String(suggestedAmount));
    } else if (payType === "advance" && selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      setAmount(String(selectedStaff?.monthlySalary || 0));
      setAdvanceAdjustmentAmount("");
    }
  };

  useEffect(() => {
    if (!selectedStaffId) {
      setMonthlyBalance(0);
      setIsMonthFullyPaid(false);
      setMonthLockReason("");
      return;
    }

    checkStatus(selectedStaffId, new Date(date));
  }, [selectedStaffId, date, salaryPayments, checkStatus]);
  /**
   * Handle payment confirmation
   * - All payment details (staff, amount, type, date, months) are saved permanently to database
   * - Payment history shows last 30 days in UI
   * - Database retains all records permanently for reporting and auditing
   */
  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      if (!selectedStaffId || !payType || !amount) {
        setIsProcessing(false);
        return toast.error("Complete all details");
      }

      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (!selectedStaff) {
        setIsProcessing(false);
        return toast.error("Staff not found");
      }

      const paymentDate = new Date(date);
      const salaryForMonth = getReferenceMonthKey(date);
      const monthLocked = isReferenceMonthLocked(selectedStaffId, salaryForMonth);

    const paymentAmount = Number(amount);

    // Validation 0: Check if amount is valid
    if (paymentAmount <= 0) {
      setIsProcessing(false);
      return toast.error("Payment amount must be greater than zero");
    }

    if (payType === "full" && monthLocked) {
      setIsProcessing(false);
      return toast.error("This reference month is already fully paid. Salary transactions are locked.");
    }

    // Flexible ledger: allow any manual amount and unlimited advances
    await addSalaryPayment({
      staffId: selectedStaffId,
      staffName: selectedStaff.fullName,
      amount: paymentAmount,
      paymentType: payType === "full" ? "full" : "advance",
      date: new Date().toISOString(),
      salaryForMonth,
      numberOfMonths: payType === "advance" ? numberOfMonths : undefined,
      notes: payType === "full"
        ? `Salary settlement${advanceAdjustmentAmount ? ` | adjustment: Rs ${Number(advanceAdjustmentAmount || 0).toLocaleString()}` : ""}`
        : "Advance payment"
    });
    const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    toast.success(`Payment of Rs ${paymentAmount.toLocaleString()} recorded for ${monthName}`);
    
    // Delay to ensure state is fully updated and persisted before navigation
    setTimeout(() => {
      console.log("[PaySalary] Navigating to staff salaries page");
      setIsProcessing(false);
      navigate("/staffsalaries");
    }, 500);
    } catch (error) {
      console.error("Payment error:", error);
      console.error("Error details:", {
        selectedStaffId,
        payType,
        amount,
        date,
        error: error instanceof Error ? error.message : String(error)
      });
      setIsProcessing(false);
      toast.error(`Failed to process payment: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
      <div className="bg-card border p-8 rounded-2xl shadow-xl border-primary/10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Wallet className="text-primary"/> Pay Salary</h2>
        <div className="space-y-6">
          {/* Step 1: Choose Staff */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Step 1: Select Staff Member</Label>
            <Select value={selectedStaffId} onValueChange={handleStaffChange}>
              <SelectTrigger className="h-14 text-base"><SelectValue placeholder="Choose Staff Member" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => {
                  const paymentDate = new Date(date);
                  const isPaid = isFullSalaryPaid(s.id, paymentDate);
                  
                  // Check for advances paid in this month
                  const paymentMonth = paymentDate.getMonth();
                  const paymentYear = paymentDate.getFullYear();
                  
                  const advances = salaryPayments.filter(payment => {
                    if (payment.staffId !== s.id || payment.paymentType !== "advance") return false;
                    
                    const existingDate = getPaymentReferenceDate(payment);
                    const existingMonth = existingDate.getMonth();
                    const existingYear = existingDate.getFullYear();
                    
                    // For multi-month advances
                    if (payment.numberOfMonths && payment.numberOfMonths > 1) {
                      const endDate = new Date(existingDate);
                      endDate.setMonth(endDate.getMonth() + payment.numberOfMonths - 1);
                      const endMonth = endDate.getMonth();
                      const endYear = endDate.getFullYear();
                      
                      const paymentTimestamp = new Date(paymentYear, paymentMonth, 1).getTime();
                      const startTimestamp = new Date(existingYear, existingMonth, 1).getTime();
                      const endTimestamp = new Date(endYear, endMonth, 1).getTime();
                      
                      return paymentTimestamp >= startTimestamp && paymentTimestamp <= endTimestamp;
                    }
                    
                    return existingMonth === paymentMonth && existingYear === paymentYear;
                  });
                  
                  let statusText = '○ Unpaid';
                  let statusColor = 'text-orange-600';
                  
                  if (isPaid) {
                    statusText = '✓ Paid';
                    statusColor = 'text-green-600';
                  } else if (advances.length > 0) {
                    // Show advance information
                    const multiMonthAdvance = advances.find(a => a.numberOfMonths && a.numberOfMonths > 1);
                    if (multiMonthAdvance) {
                      statusText = `✓ Advance (${multiMonthAdvance.numberOfMonths} months)`;
                    } else {
                      statusText = '✓ Advance';
                    }
                    statusColor = 'text-blue-600';
                  }
                  
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center justify-between w-full gap-3">
                        <span>{s.fullName}</span>
                        <span className="flex items-center gap-2 text-xs">
                          {s.monthlySalary && (
                            <span className="text-muted-foreground">
                              Rs {s.monthlySalary.toLocaleString()}/month
                            </span>
                          )}
                          <span className={`font-semibold ${statusColor}`}>
                            {statusText}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {selectedStaffId && staff.find(s => s.id === selectedStaffId)?.monthlySalary && (
              <p className="text-sm text-muted-foreground">
                Monthly Salary: <span className="font-semibold text-primary">
                  Rs {staff.find(s => s.id === selectedStaffId)?.monthlySalary?.toLocaleString()}
                </span>
              </p>
            )}

              {/* Salary Reference Month & Year - label only, not transaction date */}
              {selectedStaffId && (
                <div className="space-y-3 pt-2">
                  <Label className="text-base font-semibold">Select Salary Reference Month & Year</Label>
                  <p className="text-xs text-muted-foreground">
                    This is a reference label only. The transaction is always saved with today&apos;s date.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Select
                        value={String(new Date(date).getMonth())}
                        onValueChange={(monthStr) => {
                          const newDate = new Date(date);
                          newDate.setMonth(parseInt(monthStr));
                          const year = newDate.getFullYear();
                          const month = String(newDate.getMonth() + 1).padStart(2, '0');
                          const day = String(newDate.getDate()).padStart(2, '0');
                          handleDateChange(`${year}-${month}-${day}`);
                        }}
                      >
                        <SelectTrigger className="h-12 text-base font-semibold bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-200">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => {
                            const year = new Date(date).getFullYear();
                            const monthKey = `${year}-${String(idx + 1).padStart(2, '0')}`;
                            const monthlySalary = staff.find((s) => s.id === selectedStaffId)?.monthlySalary || 0;
                            const paidForMonth = getReferenceMonthPaidAmount(selectedStaffId, monthKey);
                            const isLocked = isReferenceMonthLocked(selectedStaffId, monthKey);
                            return (
                            <SelectItem key={idx} value={String(idx)} disabled={isLocked}>
                              {month} {monthlySalary > 0 ? `(Paid: Rs ${paidForMonth.toLocaleString()} / Rs ${monthlySalary.toLocaleString()})` : ""}
                            </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Select
                        value={String(new Date(date).getFullYear())}
                        onValueChange={(yearStr) => {
                          const newDate = new Date(date);
                          newDate.setFullYear(parseInt(yearStr));
                          const year = newDate.getFullYear();
                          const month = String(newDate.getMonth() + 1).padStart(2, '0');
                          const day = String(newDate.getDate()).padStart(2, '0');
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
                </div>
              )}
            
            {/* Payment Status for Selected Month */}
            {selectedStaffId && (() => {
              const selectedStaff = staff.find(s => s.id === selectedStaffId);
              const paymentDate = new Date(date);
              
              // Show "Already Paid" warning only for fully settled month
              if (isMonthFullyPaid && monthLockReason) {
                return (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-red-700">
                          Already Paid for {paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          {selectedStaff?.fullName}: {monthLockReason}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              
              return null;
            })()}
          </div>

          {/* Step 2: Payment Type Selection - Large Toggle Buttons */}
          {selectedStaffId && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">Step 2: Choose Payment Type</Label>
              {(() => {
                const paymentDate = new Date(date);
                const selectedStaff = staff.find(s => s.id === selectedStaffId);
                const monthlySalary = selectedStaff?.monthlySalary || 0;
                const advancesForCurrentMonth = getAdvancesForCurrentMonth(selectedStaffId, paymentDate);
                const fullPaidCurrentMonth = getFullSalaryPaidInMonth(selectedStaffId, paymentDate);
                const remaining = Math.max(0, monthlySalary - (advancesForCurrentMonth + fullPaidCurrentMonth));
                const previousDue = getPreviousDueBalance(selectedStaffId, paymentDate);
                const totalOutstanding = remaining + previousDue;
                const selectedReferenceMonth = getReferenceMonthKey(date);
                const monthPaid = getReferenceMonthPaidAmount(selectedStaffId, selectedReferenceMonth);
                const monthLocked = isReferenceMonthLocked(selectedStaffId, selectedReferenceMonth);
                
                return (
                  <div>
                    
                   
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handlePayTypeChange("full")}
                        disabled={monthLocked}
                        className={`
                          p-6 rounded-xl border-3 transition-all duration-200 
                          ${payType === "full"
                            ? 'border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-300'
                            : 'border-gray-300 bg-white hover:border-emerald-400 hover:shadow-md'
                          }
                            ${monthLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="text-center">
                          <div className="font-bold text-lg mb-1">Full Salary</div>
                          <div className="text-xs text-muted-foreground">Pay complete monthly salary</div>
                          {monthLocked && (
                            <div className="text-xs text-emerald-700 font-semibold mt-1">Fully Paid</div>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePayTypeChange("advance")}
                        className={`
                          p-6 rounded-xl border-3 transition-all duration-200
                          ${payType === "advance"
                            ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-300'
                            : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                          }
                          cursor-pointer
                        `}
                      >
                        <div className="text-center">
                          <div className="font-bold text-lg mb-1">Advance Payment</div>
                          <div className="text-xs text-muted-foreground">Pay partial amount in advance</div>
                        </div>
                      </button>
                    </div>
                    <p className="text-xs text-emerald-700 mt-2 text-center">
                      Running balance: Rs {Math.abs(getStaffRunningBalance(selectedStaffId, paymentDate)).toLocaleString()} ({getStaffRunningBalance(selectedStaffId, paymentDate) >= 0 ? 'Salary pending' : 'Advance taken by staff'})
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Month progress: Paid Rs {monthPaid.toLocaleString()} / Rs {monthlySalary.toLocaleString()} {monthLocked ? '(Fully Paid)' : ''}
                    </p>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 3: Additional Inputs - Show ONLY after Payment Type selected */}
          {payType && selectedStaffId && (() => {
            const paymentDate = new Date(date);
            const selectedStaff = staff.find(s => s.id === selectedStaffId);
            const monthlySalary = selectedStaff?.monthlySalary || 0;
            const totalEarned = getStaffTotalEarned(selectedStaffId, paymentDate);
            const totalPaid = getStaffTotalPaid(selectedStaffId, paymentDate);
            const netBalance = getStaffRunningBalance(selectedStaffId, paymentDate);
            const isBalanceDue = netBalance >= 0;
            
            const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            // Show payment status for this month
            return (
              <>
                {/* Payment Status Card */}
                <div className={`rounded-xl p-5 border-2 ${
                  isBalanceDue 
                    ? 'bg-green-50 border-green-300' 
                    : totalPaid > totalEarned
                    ? 'bg-blue-50 border-blue-300'
                    : 'bg-gray-50 border-gray-300'
                }`}>
                  <div className="text-sm font-semibold mb-3">
                    Payment Status for {monthName}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Salary:</span>
                      <span className="font-semibold">Rs {monthlySalary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Salaries Earned:</span>
                      <span className="font-semibold">Rs {totalEarned.toLocaleString()}</span>
                    </div>
                    {totalPaid > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Advance Already Taken:</span>
                        <span className="font-semibold text-red-600">Rs {totalPaid.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className={`font-semibold ${!isBalanceDue ? 'text-red-700' : 'text-green-700'}`}>
                        {!isBalanceDue ? 'Total Advance Taken:' : 'Salary Pending:'}
                      </span>
                      <span className={`font-bold text-lg ${!isBalanceDue ? 'text-red-600' : 'text-green-600'}`}>
                        Rs {Math.abs(netBalance).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

              {/* Number of Months - ONLY for Advance */}
              {payType === "advance" && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Number of Months</Label>
                  <Select 
                    value={String(numberOfMonths)} 
                    onValueChange={handleNumberOfMonthsChange}
                  >
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Select months" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => (
                        <SelectItem key={num} value={String(num)}>
                          {num} Month{num > 1 ? 's' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {numberOfMonths > 1 && (
                    <p className="text-xs text-blue-600 font-medium">
                      This will be saved as one transaction today with a reference note for {numberOfMonths} months.
                    </p>
                  )}
                </div>
              )}



              {/* Amount Field */}
              {payType === "full" && (
                <div className="space-y-2">
                  <Label className="text-base font-semibold">Advance Adjustment</Label>
                  <Input
                    type="number"
                    min="0"
                    value={advanceAdjustmentAmount}
                    onChange={(e) => {
                      setAdvanceAdjustmentAmount(e.target.value);
                      setAmount(e.target.value);
                    }}
                    placeholder="How much of the total debt/advance do you want to adjust/pay now?"
                    className="h-12 text-base"
                  />
                  <p className="text-xs text-muted-foreground">
                    This amount will be recorded as the salary settlement for the selected reference month.
                  </p>
                  {(() => {
                    const monthlySalary = staff.find(s => s.id === selectedStaffId)?.monthlySalary || 0;
                    const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, new Date(date));
                    const previousDue = getPreviousDueBalance(selectedStaffId, new Date(date));
                    const adjustmentValue = Number(advanceAdjustmentAmount) || 0;
                    const extraAdvance = Math.max(0, adjustmentValue - monthlySalary);

                    return adjustmentValue > 0 ? (
                      <div className="space-y-1 text-xs font-medium">
                        <p className="text-amber-700">Old (Previous Due): Rs {previousDue.toLocaleString()}</p>
                        <p className="text-green-700">Full Salary Payment: Rs {monthlySalary.toLocaleString()}</p>
                        {extraAdvance > 0 && (
                          <p className="text-red-700">Advance Taken: Rs {extraAdvance.toLocaleString()}</p>
                        )}
                        <p className="text-blue-700 font-semibold">Total Payment: Rs {adjustmentValue.toLocaleString()}</p>
                      </div>
                    ) : null;
                  })()}
                </div>
              )}

              {payType === "advance" && (
              <div className="space-y-2">
                <Label className="text-base font-semibold">Advance Amount (Rs)</Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  placeholder="Auto-filled with suggested amount (editable)"
                  className="h-14 text-lg font-semibold"
                />
                <p className="text-xs text-blue-600 font-medium">
                  Suggested starting amount: Rs {(staff.find(s => s.id === selectedStaffId)?.monthlySalary || 0).toLocaleString()} for {numberOfMonths} month{numberOfMonths > 1 ? 's' : ''}. You can enter any amount.
                </p>
                {payType === "advance" && (() => {
                  const monthlySalary = staff.find(s => s.id === selectedStaffId)?.monthlySalary || 0;
                  const paymentDate = new Date(date);
                  const referenceMonth = getReferenceMonthKey(date);
                  
                  // Get advance already taken in THIS reference month
                  const advanceInCurrentMonth = getReferenceMonthPaidAmount(selectedStaffId, referenceMonth);
                  
                  // Get total advance taken so far (all payments up to now)
                  const totalPaidSoFar = getStaffTotalPaid(selectedStaffId, paymentDate);
                  
                  // Get total earned so far
                  const totalEarnedSoFar = getStaffTotalEarned(selectedStaffId, paymentDate);
                  
                  // Calculate net advance taken (if payments exceed earnings, that's advance)
                  const netAdvanceTaken = Math.max(0, totalPaidSoFar - totalEarnedSoFar);
                  
                  // New advance being given
                  const newAdvanceValue = Number(amount) || 0;
                  
                  // Total advance after this payment
                  const totalAfterNewAdvance = totalPaidSoFar + newAdvanceValue;

                  return (
                    <div className="space-y-1 text-xs font-medium">
                      <p className="text-red-700">Advance Already Taken (This Month): Rs {advanceInCurrentMonth.toLocaleString()}</p>
                      <p className="text-red-700">Total Advance Already Taken: Rs {netAdvanceTaken.toLocaleString()}</p>
                      {newAdvanceValue > 0 && (
                        <>
                          <p className="text-blue-700">New Advance Payment: Rs {newAdvanceValue.toLocaleString()}</p>
                          <p className="text-orange-700 font-semibold">Total After Payment: Rs {totalAfterNewAdvance.toLocaleString()}</p>
                        </>
                      )}
                    </div>
                  );
                })()}
              </div>
              )}

              {/* Confirm Payment Button - Smart Validation */}
              {(() => {
                const monthlySalary = staff.find(s => s.id === selectedStaffId)?.monthlySalary || 0;
                const canPayFull = payType === "full" && Number(amount) > 0;
                const canPayAdvance = payType === "advance" && Number(amount) > 0;
                
                const canProcess = (payType === "full" && canPayFull) || (payType === "advance" && canPayAdvance);
                const isDisabled = !amount || Number(amount) <= 0 || !canProcess || isProcessing;

                return (
                  <div className="space-y-3">
                    <Button 
                      onClick={handleConfirm} 
                      className={`w-full py-7 text-xl font-bold shadow-lg mt-4 transition-all gradient-gold`}
                      disabled={isDisabled}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing Payment...
                        </>
                      ) : payType === "full" ? (
                        `Confirm Full Salary Payment: Rs ${amount || 0}`
                      ) : (
                        `Confirm Advance Payment: Rs ${amount || 0}`
                      )}
                    </Button>
                  </div>
                );
              })()}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}