import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wallet, AlertTriangle, Info, Lock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";

export default function PaySalaryPage() {
  const navigate = useNavigate();
  const { users: staff, addSalaryPayment, salaryPayments } = useData();
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [payType, setPayType] = useState<"advance" | "full" | null>(null);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getTodayDateString());
  const [numberOfMonths, setNumberOfMonths] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);

    // ==== MONTH STATUS STATE ====
    const [monthlyBalance, setMonthlyBalance] = useState(0);
    const [isMonthFullyPaid, setIsMonthFullyPaid] = useState(false);
    const [monthLockReason, setMonthLockReason] = useState("");
    
    // ==== ADVANCE BLOCKING STATE ====
    const [hasExistingAdvance, setHasExistingAdvance] = useState(false);
    const [advanceBlockReason, setAdvanceBlockReason] = useState("");

    // ==== CHECK STATUS FUNCTION ====
    // Called whenever date or staff selection changes
    const checkStatus = (staffId: string, checkDate: Date) => {
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

      const monthlySalary = selectedStaff.monthlySalary || 0;
      const paidInSelectedMonth = getTotalPaidInMonth(staffId, checkDate);
      const remaining = Math.max(0, monthlySalary - paidInSelectedMonth);
      const previousDue = getPreviousDueBalance(staffId, checkDate);

      setMonthlyBalance(remaining + previousDue);
      setIsMonthFullyPaid(remaining <= 0);

      // Set lock reason if month is fully paid
      if (remaining <= 0) {
        const monthName = checkDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        setMonthLockReason(`Full salary for ${monthName} has already been paid. No further payments allowed.`);
      } else {
        setMonthLockReason("");
      }
      
      // Check if an advance already exists for this month
      checkExistingAdvance(staffId, checkDate);
    };
    
    // ==== CHECK EXISTING ADVANCE ====
    // Checks if an advance payment already exists for the selected month
    const checkExistingAdvance = (staffId: string, checkDate: Date) => {
      const checkMonth = checkDate.getMonth();
      const checkYear = checkDate.getFullYear();
      
      // Find if there's any advance that covers this month
      const existingAdvance = salaryPayments.find(payment => {
        if (payment.staffId !== staffId || payment.paymentType !== "advance") return false;
        
        const existingDate = new Date(payment.date);
        const existingMonth = existingDate.getMonth();
        const existingYear = existingDate.getFullYear();
        
        // For multi-month advances
        if (payment.numberOfMonths && payment.numberOfMonths > 1) {
          const endDate = new Date(existingDate);
          endDate.setMonth(endDate.getMonth() + payment.numberOfMonths - 1);
          const endMonth = endDate.getMonth();
          const endYear = endDate.getFullYear();
          
          const checkTimestamp = new Date(checkYear, checkMonth, 1).getTime();
          const startTimestamp = new Date(existingYear, existingMonth, 1).getTime();
          const endTimestamp = new Date(endYear, endMonth, 1).getTime();
          
          return checkTimestamp >= startTimestamp && checkTimestamp <= endTimestamp;
        }
        
        // For single-month advances
        return existingMonth === checkMonth && existingYear === checkYear;
      });
      
      if (existingAdvance) {
        const monthName = checkDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        if (existingAdvance.numberOfMonths && existingAdvance.numberOfMonths > 1) {
          const startDate = new Date(existingAdvance.date);
          const endDate = new Date(startDate);
          endDate.setMonth(endDate.getMonth() + existingAdvance.numberOfMonths - 1);
          const startMonth = startDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const endMonth = endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          setAdvanceBlockReason(`An advance has already been paid for ${monthName} (part of ${existingAdvance.numberOfMonths}-month advance from ${startMonth} to ${endMonth}). Only one advance is allowed per month.`);
        } else {
          setAdvanceBlockReason(`An advance has already been paid for ${monthName}. Only one advance is allowed per month.`);
        }
        setHasExistingAdvance(true);
      } else {
        setAdvanceBlockReason("");
        setHasExistingAdvance(false);
      }
    };

    // ==== SMART PERIOD LOCK DETECTION ====
  // Checks if a period is locked due to existing payments
  const isPeriodLocked = (staffId: string, startDate: Date, monthsToCheck: number = 1): { isLocked: boolean; reason: string } => {
    const periods = [];
    for (let i = 0; i < monthsToCheck; i++) {
      const checkDate = new Date(startDate);
      checkDate.setMonth(checkDate.getMonth() + i);
      periods.push(checkDate);
    }

    // Check each month in the period
    for (const checkDate of periods) {
      const checkMonth = checkDate.getMonth();
      const checkYear = checkDate.getFullYear();

      // Check 1: Is there a Full Salary paid in any of these months?
      const hasFullSalary = salaryPayments.some(payment => {
        if (payment.staffId !== staffId || payment.paymentType !== "full") return false;
        const existingDate = new Date(payment.date);
        return existingDate.getMonth() === checkMonth && existingDate.getFullYear() === checkYear;
      });

      if (hasFullSalary) {
        return {
          isLocked: true,
          reason: `Full Salary already paid for ${checkDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}. Period is closed.`
        };
      }

      // Check 2: Is there an overlapping Advance?
      const hasOverlappingAdvance = salaryPayments.some(payment => {
        if (payment.staffId !== staffId || payment.paymentType !== "advance") return false;
        
        const existingDate = new Date(payment.date);
        const existingMonth = existingDate.getMonth();
        const existingYear = existingDate.getFullYear();
        
        // Calculate the end month of the existing advance
        const endDate = new Date(existingDate);
        endDate.setMonth(endDate.getMonth() + (payment.numberOfMonths || 1) - 1);
        const endMonth = endDate.getMonth();
        const endYear = endDate.getFullYear();
        
        // Check if checkDate falls within [existingDate, endDate]
        const checkTimestamp = new Date(checkYear, checkMonth, 1).getTime();
        const startTimestamp = new Date(existingYear, existingMonth, 1).getTime();
        const endTimestamp = new Date(endYear, endMonth, 1).getTime();
        
        return checkTimestamp >= startTimestamp && checkTimestamp <= endTimestamp;
      });

      if (hasOverlappingAdvance) {
        const monthName = checkDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return {
          isLocked: true,
          reason: `An active advance already covers ${monthName}. Cannot create overlapping payments.`
        };
      }
    }

    return { isLocked: false, reason: "" };
  };

  // SMART Calculate advances paid in the selected month for the selected staff
  // Factors in multi-month advances: if advance has numberOfMonths, check if it covers current month
  const getAdvancesPaidInMonth = (staffId: string, paymentDate: Date) => {
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    const advances = salaryPayments.filter(payment => {
      if (payment.staffId !== staffId || payment.paymentType !== "advance") return false;
      
      const existingDate = new Date(payment.date);
      const existingMonth = existingDate.getMonth();
      const existingYear = existingDate.getFullYear();
      
      // For multi-month advances (numberOfMonths > 1)
      if (payment.numberOfMonths && payment.numberOfMonths > 1) {
        // Calculate the end month of this advance
        const endDate = new Date(existingDate);
        endDate.setMonth(endDate.getMonth() + payment.numberOfMonths - 1);
        const endMonth = endDate.getMonth();
        const endYear = endDate.getFullYear();
        
        // Check if paymentDate falls within the range [existingDate, endDate]
        const paymentTimestamp = new Date(paymentYear, paymentMonth, 1).getTime();
        const startTimestamp = new Date(existingYear, existingMonth, 1).getTime();
        const endTimestamp = new Date(endYear, endMonth, 1).getTime();
        
        return paymentTimestamp >= startTimestamp && paymentTimestamp <= endTimestamp;
      }
      
      // For single-month advances, check exact month match
      return existingMonth === paymentMonth && existingYear === paymentYear;
    });

    // For multi-month advances, divide the total amount by numberOfMonths to get monthly portion
    return advances.reduce((total, payment) => {
      if (payment.numberOfMonths && payment.numberOfMonths > 1) {
        return total + (payment.amount / payment.numberOfMonths);
      }
      return total + payment.amount;
    }, 0);
  };

  // Check if full salary has been paid in the selected month
  const getFullSalaryPaidInMonth = (staffId: string, paymentDate: Date) => {
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    return salaryPayments
      .filter(payment => {
        if (payment.staffId !== staffId || payment.paymentType !== "full") return false;
        const existingDate = new Date(payment.date);
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
      cumulativeDue = Math.max(0, cumulativeDue);
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }

    return cumulativeDue;
  };

  const isFullSalaryPaid = (staffId: string, paymentDate: Date) => {
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    return salaryPayments.some(payment => {
      if (payment.staffId !== staffId || payment.paymentType !== "full") return false;
      const existingDate = new Date(payment.date);
      return existingDate.getMonth() === paymentMonth && existingDate.getFullYear() === paymentYear;
    });
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

  const getAdvanceInputTotal = (staffId: string, paymentDate: Date, months: number) => {
    const outstanding = getTotalOutstandingForDate(staffId, paymentDate);
    const baseAdvance = getAdvanceTotalWithPreviousDue(staffId, paymentDate, months);
    return outstanding + baseAdvance;
  };

  const handleNumberOfMonthsChange = (value: string) => {
    const numMonths = parseInt(value);
    setNumberOfMonths(numMonths);
    
    // For Advance: Auto-fill amount with total (outstanding + extra advance)
    if (payType === "advance" && selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(date);
        const suggestedAmount = getAdvanceInputTotal(selectedStaffId, paymentDate, numMonths);
        setAmount(String(suggestedAmount));
      }
    }
  };

  const handlePayTypeChange = (type: "advance" | "full") => {
    // Prevent selecting advance if one already exists for this month
    if (type === "advance" && hasExistingAdvance) {
      toast.error(advanceBlockReason);
      return;
    }
    
    setPayType(type);
    
    // Full Salary: Lock to 1 month and auto-calculate
    if (type === "full" && selectedStaffId) {
      setNumberOfMonths(1); // Lock to 1 month
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(date);
        const monthlySalary = selectedStaff.monthlySalary;
        const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, paymentDate);
        const currentRemaining = Math.max(0, monthlySalary - paidInSelectedMonth);
        const previousDue = getPreviousDueBalance(selectedStaffId, paymentDate);
        setAmount(String(currentRemaining + previousDue));
      }
    } else if (type === "advance" && selectedStaffId) {
      // Advance: Reset to 1 month, auto-fill with total (outstanding + extra advance)
      setNumberOfMonths(1);
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(date);
        const suggestedAmount = getAdvanceInputTotal(selectedStaffId, paymentDate, 1);
        setAmount(String(suggestedAmount));
      }
    }
  };

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    
    const selectedStaff = staff.find(s => s.id === staffId);
    
     // Check status for the selected staff and current date
     const paymentDate = new Date(date);
     checkStatus(staffId, paymentDate);
   
    // If Full Salary is already selected, auto-fill the new staff's remaining salary
    if (payType === "full" && selectedStaff?.monthlySalary) {
      const paymentDate = new Date(date);
      const monthlySalary = selectedStaff.monthlySalary;
      const paidInSelectedMonth = getTotalPaidInMonth(staffId, paymentDate);
      const currentRemaining = Math.max(0, monthlySalary - paidInSelectedMonth);
      const previousDue = getPreviousDueBalance(staffId, paymentDate);
      setAmount(String(currentRemaining + previousDue));
    } else if (payType === "advance" && selectedStaff?.monthlySalary) {
      // If Advance is already selected, auto-fill with total (outstanding + extra advance)
      const suggestedAmount = getAdvanceInputTotal(staffId, paymentDate, numberOfMonths);
      setAmount(String(suggestedAmount));
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    const paymentDate = new Date(newDate);
    checkStatus(selectedStaffId, paymentDate);
    
    // If Advance is selected and the new date has an existing advance, reset payType
    if (payType === "advance") {
      // checkStatus will update hasExistingAdvance, but we need to check manually here
      const checkMonth = paymentDate.getMonth();
      const checkYear = paymentDate.getFullYear();
      
      const existingAdvance = salaryPayments.find(payment => {
        if (payment.staffId !== selectedStaffId || payment.paymentType !== "advance") return false;
        
        const existingDate = new Date(payment.date);
        const existingMonth = existingDate.getMonth();
        const existingYear = existingDate.getFullYear();
        
        if (payment.numberOfMonths && payment.numberOfMonths > 1) {
          const endDate = new Date(existingDate);
          endDate.setMonth(endDate.getMonth() + payment.numberOfMonths - 1);
          const endMonth = endDate.getMonth();
          const endYear = endDate.getFullYear();
          
          const checkTimestamp = new Date(checkYear, checkMonth, 1).getTime();
          const startTimestamp = new Date(existingYear, existingMonth, 1).getTime();
          const endTimestamp = new Date(endYear, endMonth, 1).getTime();
          
          return checkTimestamp >= startTimestamp && checkTimestamp <= endTimestamp;
        }
        
        return existingMonth === checkMonth && existingYear === checkYear;
      });
      
      if (existingAdvance) {
        // Reset payType if advance exists for this month
        setPayType(null);
        setAmount("");
      }
    }
    
    // Recalculate amount when date changes
    if (payType === "full" && selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const monthlySalary = selectedStaff.monthlySalary;
        const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, paymentDate);
        const currentRemaining = Math.max(0, monthlySalary - paidInSelectedMonth);
        const previousDue = getPreviousDueBalance(selectedStaffId, paymentDate);
        setAmount(String(currentRemaining + previousDue));
      }
    } else if (payType === "advance" && selectedStaffId) {
      const suggestedAmount = getAdvanceInputTotal(selectedStaffId, paymentDate, numberOfMonths);
      setAmount(String(suggestedAmount));
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
  }, [selectedStaffId, date, salaryPayments]);
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
      const monthsToCheck = payType === "advance" ? numberOfMonths : 1;

    const paymentAmount = Number(amount);

    // Validation 0: Check if amount is valid
    if (paymentAmount <= 0) {
      setIsProcessing(false);
      return toast.error("Payment amount must be greater than zero");
    }

    // Validation 0.5: For Advance Payments - Check max limit
    if (payType === "advance") {
      // FIRST: Check if an advance already exists for this specific month
      const checkMonth = paymentDate.getMonth();
      const checkYear = paymentDate.getFullYear();
      
      const hasExistingAdvanceForMonth = salaryPayments.some(payment => {
        if (payment.staffId !== selectedStaffId || payment.paymentType !== "advance") return false;
        
        const existingDate = new Date(payment.date);
        const existingMonth = existingDate.getMonth();
        const existingYear = existingDate.getFullYear();
        
        // For multi-month advances
        if (payment.numberOfMonths && payment.numberOfMonths > 1) {
          const endDate = new Date(existingDate);
          endDate.setMonth(endDate.getMonth() + payment.numberOfMonths - 1);
          const endMonth = endDate.getMonth();
          const endYear = endDate.getFullYear();
          
          const checkTimestamp = new Date(checkYear, checkMonth, 1).getTime();
          const startTimestamp = new Date(existingYear, existingMonth, 1).getTime();
          const endTimestamp = new Date(endYear, endMonth, 1).getTime();
          
          return checkTimestamp >= startTimestamp && checkTimestamp <= endTimestamp;
        }
        
        // For single-month advances
        return existingMonth === checkMonth && existingYear === checkYear;
      });
      
      if (hasExistingAdvanceForMonth) {
        setIsProcessing(false);
        const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return toast.error(`An advance has already been paid for ${monthName}. Only one advance is allowed per month.`);
      }
      
      const maxAdvanceAllowed = getAdvanceInputTotal(selectedStaffId, paymentDate, numberOfMonths);
      if (paymentAmount > maxAdvanceAllowed) {
        setIsProcessing(false);
        return toast.error(
          `Advance payment cannot exceed Rs ${maxAdvanceAllowed.toLocaleString()} for selected period and due balance ` +
          `(Monthly salary: Rs ${selectedStaff.monthlySalary?.toLocaleString()})`
        );
      }

      // Validate overlapping advance for multi-month scenarios
      const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, monthsToCheck);
      if (lockCheck.isLocked && lockCheck.reason.includes("advance")) {
        setIsProcessing(false);
        return toast.error(lockCheck.reason);
      }
    }

    // FULL SALARY - Always single month, locked to current month
    if (payType === "full") {
      // Check if already paid
      if (isFullSalaryPaid(selectedStaffId, paymentDate)) {
        setIsProcessing(false);
        const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return toast.error(`Full salary already paid for ${monthName}!`);
      }

      // Get total payable amount (selected month remaining + previous due)
      const monthlySalary = selectedStaff.monthlySalary || 0;
      const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, paymentDate);
      const currentRemaining = Math.max(0, monthlySalary - paidInSelectedMonth);
      const previousDue = getPreviousDueBalance(selectedStaffId, paymentDate);
      const finalAmount = currentRemaining + previousDue;

      if (finalAmount <= 0) {
        setIsProcessing(false);
        return toast.error("No remaining amount to pay. Full salary has been covered by advances.");
      }

      // Create single payment record
      await addSalaryPayment({
        staffId: selectedStaffId,
        staffName: selectedStaff.fullName,
        amount: finalAmount,
        paymentType: "full",
        date: date
      });

      const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  toast.success(`Full salary payment of Rs ${finalAmount.toLocaleString()} confirmed for ${monthName}${previousDue > 0 ? ` (includes Rs ${previousDue.toLocaleString()} previous due)` : ''}!`);
      
      // Small delay to ensure state is updated and persisted
      setTimeout(() => {
        setIsProcessing(false);
        navigate("/staffsalaries");
      }, 300);
      return;
    }

    // ADVANCE - Can be multi-month
    if (payType === "advance" && numberOfMonths > 1) {
      // CREATE SINGLE RECORD with numberOfMonths attribute (not multiple records)
      await addSalaryPayment({
        staffId: selectedStaffId,
        staffName: selectedStaff.fullName,
        amount: paymentAmount,
        paymentType: "advance",
        date: date,
        numberOfMonths: numberOfMonths
      });
      
      const endDate = new Date(date);
      endDate.setMonth(endDate.getMonth() + numberOfMonths - 1);
      const endMonth = endDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const startMonth = new Date(date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      
      toast.success(`Advance payment of Rs ${paymentAmount.toLocaleString()} confirmed for ${numberOfMonths} months (${startMonth} to ${endMonth})!`);
      
      // Small delay to ensure state is updated and persisted
      setTimeout(() => {
        setIsProcessing(false);
        navigate("/staffsalaries");
      }, 300);
      return;
    }

    // ADVANCE - Single month
    const paymentMonth = paymentDate.getMonth();
    const paymentYear = paymentDate.getFullYear();

    // Get advances already paid this month
    const advancesPaid = getAdvancesPaidInMonth(selectedStaffId, paymentDate);
    const totalPaymentThisMonth = advancesPaid + paymentAmount;

    // Validation 1: Check if total payment (advances + current) exceeds monthly salary
    if (selectedStaff.monthlySalary && totalPaymentThisMonth > selectedStaff.monthlySalary) {
      setIsProcessing(false);
      return toast.error(
        `Total payment (Rs ${totalPaymentThisMonth.toLocaleString()}) exceeds monthly salary of Rs ${selectedStaff.monthlySalary.toLocaleString()}. ` +
        `Already paid Rs ${advancesPaid.toLocaleString()} in advances.`
      );
    }

    // Validation 2: Check if full salary has already been paid this month
    const fullSalaryPaid = salaryPayments.some(payment => {
      if (payment.staffId !== selectedStaffId || payment.paymentType !== "full") return false;
      const existingDate = new Date(payment.date);
      return existingDate.getMonth() === paymentMonth && existingDate.getFullYear() === paymentYear;
    });

    if (fullSalaryPaid) {
      setIsProcessing(false);
      const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      return toast.error(`Full salary has already been paid to ${selectedStaff.fullName} in ${monthName}`);
    }

    // Create single-month advance payment record
    await addSalaryPayment({
      staffId: selectedStaffId,
      staffName: selectedStaff.fullName,
      amount: paymentAmount,
      paymentType: payType,
      date: date
    });
    
    toast.success("Payment confirmed successfully");
    
    // Small delay to ensure state is updated and persisted
    setTimeout(() => {
      setIsProcessing(false);
      navigate("/staffsalaries");
    }, 300);
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
                    
                    const existingDate = new Date(payment.date);
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

              {/* Payment Month & Year - visible right after staff selection */}
              {selectedStaffId && (
                <div className="space-y-3 pt-2">
                  <Label className="text-base font-semibold">Select Payment Month & Year</Label>
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
                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map((month, idx) => (
                            <SelectItem key={idx} value={String(idx)}>
                              {month}
                            </SelectItem>
                          ))}
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
                const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, paymentDate);
                const remaining = Math.max(0, monthlySalary - paidInSelectedMonth);
                const previousDue = getPreviousDueBalance(selectedStaffId, paymentDate);
                const totalOutstanding = remaining + previousDue;
                
                return (
                  <div>
                     {/* Lock Warning - Show if month is fully paid */}
                     {isMonthFullyPaid && monthLockReason && (
                       <div className="bg-red-50 border-2 border-red-400 rounded-xl p-4 flex items-start gap-3 mb-4">
                         <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                         <div>
                           <p className="text-sm font-semibold text-red-900">Full Salary Locked</p>
                           <p className="text-xs text-red-700 mt-1">{monthLockReason}</p>
                         </div>
                       </div>
                     )}
                     
                     {/* Advance Block Warning - Show if advance already exists */}
                     {hasExistingAdvance && advanceBlockReason && (
                       <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-4 flex items-start gap-3 mb-4">
                         <Lock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                         <div>
                           <p className="text-sm font-semibold text-orange-900">Advance Already Paid</p>
                           <p className="text-xs text-orange-700 mt-1">{advanceBlockReason}</p>
                         </div>
                       </div>
                     )}
                   
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handlePayTypeChange("full")}
                          disabled={isMonthFullyPaid}
                        className={`
                          p-6 rounded-xl border-3 transition-all duration-200 
                          ${payType === "full"
                            ? 'border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-300'
                            : 'border-gray-300 bg-white hover:border-emerald-400 hover:shadow-md'
                          }
                            ${isMonthFullyPaid ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="text-center">
                          <div className="font-bold text-lg mb-1">Full Salary</div>
                          <div className="text-xs text-muted-foreground">Pay complete monthly salary</div>
                            {isMonthFullyPaid && (
                            <div className="text-xs text-red-600 mt-2">Already Paid</div>
                          )}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePayTypeChange("advance")}
                        disabled={hasExistingAdvance}
                        className={`
                          p-6 rounded-xl border-3 transition-all duration-200
                          ${payType === "advance"
                            ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-300'
                            : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                          }
                          ${hasExistingAdvance ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="text-center">
                          <div className="font-bold text-lg mb-1">Advance Payment</div>
                          <div className="text-xs text-muted-foreground">Pay partial amount in advance</div>
                          {hasExistingAdvance && (
                            <div className="text-xs text-orange-600 mt-2">Already Paid</div>
                          )}
                        </div>
                      </button>
                    </div>
                    {!isMonthFullyPaid && (
                      <p className="text-xs text-emerald-700 mt-2 text-center">
                        Remaining balance for this month: Rs {remaining.toLocaleString()}
                      </p>
                    )}
                    {previousDue > 0 && (
                      <p className="text-xs text-amber-700 mt-1 text-center font-medium">
                        Monthly Salary + Remaining Previous Salary = Rs {(monthlySalary + previousDue).toLocaleString()}
                      </p>
                    )}
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
            const advancesPaid = getAdvancesPaidInMonth(selectedStaffId, paymentDate);
            const fullPaid = getFullSalaryPaidInMonth(selectedStaffId, paymentDate);
            const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, paymentDate);
            const isFullSalaryPaid = paidInSelectedMonth >= monthlySalary;
            const remaining = Math.max(0, monthlySalary - paidInSelectedMonth);
            const previousDue = getPreviousDueBalance(selectedStaffId, paymentDate);
            const totalOutstanding = remaining + previousDue;
            const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            // Show payment status for this month
            return (
              <>
                {/* Payment Status Card */}
                <div className={`rounded-xl p-5 border-2 ${
                  isFullSalaryPaid 
                    ? 'bg-green-50 border-green-300' 
                    : advancesPaid > 0
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
                    {advancesPaid > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Already Paid (Advances):</span>
                        <span className="font-semibold text-blue-600">Rs {advancesPaid.toLocaleString()}</span>
                      </div>
                    )}
                    {fullPaid > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Already Paid (Full):</span>
                        <span className="font-semibold text-emerald-600">Rs {fullPaid.toLocaleString()}</span>
                      </div>
                    )}
                    {previousDue > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Previous Due:</span>
                        <span className="font-semibold text-amber-700">Rs {previousDue.toLocaleString()}</span>
                      </div>
                    )}
                    {previousDue > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Monthly Salary + Previous Due:</span>
                        <span className="font-semibold text-amber-700">Rs {(monthlySalary + previousDue).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t">
                      <span className={`font-semibold ${isFullSalaryPaid ? 'text-green-700' : 'text-orange-700'}`}>
                        {isFullSalaryPaid ? '✓ Fully Paid' : 'Remaining to Pay:'}
                      </span>
                      <span className={`font-bold text-lg ${isFullSalaryPaid ? 'text-green-600' : 'text-orange-600'}`}>
                        {isFullSalaryPaid ? 'Rs 0' : `Rs ${totalOutstanding.toLocaleString()}`}
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
                      This advance will be recorded across {numberOfMonths} months with numberOfMonths tracking
                    </p>
                  )}
                </div>
              )}



              {/* Amount Field */}
              <div className="space-y-2">
                <Label className="text-base font-semibold">
                  {payType === "full" ? "Amount (Auto-Calculated)" : "Advance Amount (Rs)"}
                </Label>
                <Input 
                  type="number" 
                  min="1" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)} 
                  placeholder={
                    payType === "full" 
                      ? "Calculated automatically (Read-only)"
                      : "Auto-filled with suggested amount (editable)"
                  }
                  disabled={payType === "full"}
                  readOnly={payType === "full"}
                  className={`h-14 text-lg font-semibold ${payType === "full" ? "bg-gray-100 cursor-not-allowed text-emerald-700" : ""}`}
                />
                {payType === "advance" && (
                  <p className="text-xs text-blue-600 font-medium">
                    Suggested (Outstanding + Advance): Rs {getAdvanceInputTotal(selectedStaffId, new Date(date), numberOfMonths).toLocaleString()} for {numberOfMonths} month{numberOfMonths > 1 ? 's' : ''}. You can change this amount.
                  </p>
                )}
                {payType === "advance" && (() => {
                  const monthlySalary = staff.find(s => s.id === selectedStaffId)?.monthlySalary || 0;
                  const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, new Date(date));
                  const remaining = Math.max(0, monthlySalary - paidInSelectedMonth);
                  const previousDue = getPreviousDueBalance(selectedStaffId, new Date(date));
                  const totalOutstanding = remaining + previousDue;
                  const advanceValue = Number(amount) || 0;

                  return (
                    <div className="space-y-1 text-xs font-medium text-amber-700">
                      <p>Old (Previous Due): Rs {previousDue.toLocaleString()}</p>
                      <p>Total Outstanding (Current + Old): Rs {totalOutstanding.toLocaleString()}</p>
                      <p>Total with Advance: Rs {advanceValue.toLocaleString()}</p>
                    </div>
                  );
                })()}
              </div>

              {/* Confirm Payment Button - Smart Validation */}
              {(() => {
                const monthlySalary = staff.find(s => s.id === selectedStaffId)?.monthlySalary || 0;
                const paidInSelectedMonth = getTotalPaidInMonth(selectedStaffId, new Date(date));
                const remaining = Math.max(0, monthlySalary - paidInSelectedMonth);
                const previousDue = getPreviousDueBalance(selectedStaffId, new Date(date));
                const totalOutstanding = remaining + previousDue;
                
                // For Full Salary: Can only pay if remaining > 0
                const canPayFull = payType === "full" && totalOutstanding > 0;
                
                // For Advance: Can pay if amount is valid and doesn't exceed max
                const maxAdvance = getAdvanceInputTotal(selectedStaffId, new Date(date), numberOfMonths);
                const advanceAmountValid = payType === "advance" && 
                  Number(amount) > 0 && 
                  Number(amount) <= maxAdvance;
                const canPayAdvance = payType === "advance" && advanceAmountValid;
                
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