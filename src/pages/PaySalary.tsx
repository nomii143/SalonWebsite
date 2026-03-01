import { useState } from "react";
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

  const handleNumberOfMonthsChange = (value: string) => {
    const numMonths = parseInt(value);
    setNumberOfMonths(numMonths);
    
    // For Advance: Auto-fill amount with (monthly salary × months) as default suggestion
    if (payType === "advance" && selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(date);
        
        // Check if any of the months will be locked
        const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, numMonths);
        if (lockCheck.isLocked) {
          toast.error(lockCheck.reason);
          return;
        }
        
        const suggestedAmount = selectedStaff.monthlySalary * numMonths;
        setAmount(String(suggestedAmount));
      }
    }
  };

  const handlePayTypeChange = (type: "advance" | "full") => {
    setPayType(type);
    
    // Full Salary: Lock to 1 month and auto-calculate
    if (type === "full" && selectedStaffId) {
      setNumberOfMonths(1); // Lock to 1 month
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(date);
        
        // Check if period is locked
        const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, 1);
        if (lockCheck.isLocked) {
          toast.error(lockCheck.reason);
          setPayType(null);
          return;
        }
        
        const monthlySalary = selectedStaff.monthlySalary;
        const advancesPaid = getAdvancesPaidInMonth(selectedStaffId, paymentDate);
        const remaining = monthlySalary - advancesPaid;
        setAmount(String(remaining));
      }
    } else if (type === "advance" && selectedStaffId) {
      // Advance: Reset to 1 month, auto-fill with monthly salary as suggestion (changeable)
      setNumberOfMonths(1);
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(date);
        
        // Check if period is locked for advance
        const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, 1);
        if (lockCheck.isLocked) {
          toast.error(lockCheck.reason);
          setPayType(null);
          return;
        }
        
        const suggestedAmount = selectedStaff.monthlySalary * numberOfMonths;
        setAmount(String(suggestedAmount));
      }
    }
  };

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    
    const selectedStaff = staff.find(s => s.id === staffId);
    
    // If Full Salary is already selected, auto-fill the new staff's remaining salary
    if (payType === "full" && selectedStaff?.monthlySalary) {
      const paymentDate = new Date(date);
      const monthlySalary = selectedStaff.monthlySalary;
      const advancesPaid = getAdvancesPaidInMonth(staffId, paymentDate);
      const remaining = monthlySalary - advancesPaid;
      setAmount(String(remaining));
    } else if (payType === "advance" && selectedStaff?.monthlySalary) {
      // If Advance is already selected, auto-fill with suggested amount
      const suggestedAmount = selectedStaff.monthlySalary * numberOfMonths;
      setAmount(String(suggestedAmount));
    }
  };

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    
    // Recalculate remaining amount if Full Salary is selected
    if (payType === "full" && selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(newDate);
        
        // Check if new date period is locked
        const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, 1);
        if (lockCheck.isLocked) {
          toast.error(lockCheck.reason);
          return;
        }
        
        const monthlySalary = selectedStaff.monthlySalary;
        const advancesPaid = getAdvancesPaidInMonth(selectedStaffId, paymentDate);
        const remaining = monthlySalary - advancesPaid;
        setAmount(String(remaining));
      }
    } else if (payType === "advance" && selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const paymentDate = new Date(newDate);
        
        // Check if new date period is locked for advance
        const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, numberOfMonths);
        if (lockCheck.isLocked) {
          toast.error(lockCheck.reason);
          return;
        }
      }
    }
  };
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

    // === CRITICAL VALIDATION: Check if period is locked ===
    const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, monthsToCheck);
    if (lockCheck.isLocked) {
      setIsProcessing(false);
      return toast.error(lockCheck.reason);
    }

    const paymentAmount = Number(amount);

    // Validation 0: Check if amount is valid
    if (paymentAmount <= 0) {
      setIsProcessing(false);
      return toast.error("Payment amount must be greater than zero");
    }

    // Validation 0.5: For Advance Payments - Check max limit
    if (payType === "advance") {
      const maxAdvanceAllowed = (selectedStaff.monthlySalary || 0) * numberOfMonths;
      if (paymentAmount > maxAdvanceAllowed) {
        setIsProcessing(false);
        return toast.error(
          `Advance payment cannot exceed Rs ${maxAdvanceAllowed.toLocaleString()} for ${numberOfMonths} month${numberOfMonths > 1 ? 's' : ''} ` +
          `(Monthly salary: Rs ${selectedStaff.monthlySalary?.toLocaleString()})`
        );
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

      // Get the exact amount (monthly salary - advances)
      const monthlySalary = selectedStaff.monthlySalary || 0;
      const advancesPaid = getAdvancesPaidInMonth(selectedStaffId, paymentDate);
      const finalAmount = monthlySalary - advancesPaid;

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
      toast.success(`Full salary of Rs ${finalAmount.toLocaleString()} confirmed for ${monthName}!`);
      
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
            
            {/* Payment Status for Selected Month */}
            {selectedStaffId && (() => {
              const paymentDate = new Date(date);
              const isAlreadyPaid = isFullSalaryPaid(selectedStaffId, paymentDate);
              const advancesPaid = getAdvancesPaidInMonth(selectedStaffId, paymentDate);
              const selectedStaff = staff.find(s => s.id === selectedStaffId);
              const monthlySalary = selectedStaff?.monthlySalary || 0;
              const remaining = monthlySalary - advancesPaid;
              
              // Show full salary paid warning
              if (isAlreadyPaid) {
                return (
                  <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-red-700">
                          Already Paid for {paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-red-600 mt-1">
                          Full salary has already been paid to {selectedStaff?.fullName} for this month. You cannot make another payment for the same period.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Show advance payment info
              if (advancesPaid > 0) {
                return (
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                    <div className="flex items-center gap-3">
                      <Info className="w-6 h-6 text-blue-600 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-blue-700">
                          Advance Payment Status for {paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          Advance paid: Rs {advancesPaid.toLocaleString()} | Remaining: Rs {remaining.toLocaleString()}
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
                const lockCheck = isPeriodLocked(selectedStaffId, paymentDate, 1);
                
                return (
                  <div>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => handlePayTypeChange("full")}
                        disabled={lockCheck.isLocked || isFullSalaryPaid(selectedStaffId, paymentDate)}
                        className={`
                          p-6 rounded-xl border-3 transition-all duration-200 
                          ${payType === "full"
                            ? 'border-emerald-500 bg-emerald-50 shadow-lg ring-2 ring-emerald-300'
                            : 'border-gray-300 bg-white hover:border-emerald-400 hover:shadow-md'
                          }
                          ${(lockCheck.isLocked || isFullSalaryPaid(selectedStaffId, paymentDate)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="text-center">
                          <div className="font-bold text-lg mb-1">Full Salary</div>
                          <div className="text-xs text-muted-foreground">Pay complete monthly salary</div>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePayTypeChange("advance")}
                        disabled={lockCheck.isLocked || isFullSalaryPaid(selectedStaffId, paymentDate)}
                        className={`
                          p-6 rounded-xl border-3 transition-all duration-200
                          ${payType === "advance"
                            ? 'border-blue-500 bg-blue-50 shadow-lg ring-2 ring-blue-300'
                            : 'border-gray-300 bg-white hover:border-blue-400 hover:shadow-md'
                          }
                          ${(lockCheck.isLocked || isFullSalaryPaid(selectedStaffId, paymentDate)) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="text-center">
                          <div className="font-bold text-lg mb-1">Advance Payment</div>
                          <div className="text-xs text-muted-foreground">Pay partial amount in advance</div>
                        </div>
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Step 3: Additional Inputs - Show ONLY after Payment Type selected */}
          {payType && selectedStaffId && (() => {
            const paymentDate = new Date(date);
            const isMonthLocked = isFullSalaryPaid(selectedStaffId, paymentDate);
            const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

            // If month is locked (Full Salary already paid), show warning and HIDE all inputs
            if (isMonthLocked) {
              return (
                <div className="bg-gradient-to-br from-red-50 to-orange-50 border-3 border-red-400 rounded-2xl p-8 shadow-xl">
                  <div className="text-center">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Lock className="w-12 h-12 text-red-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-red-900 mb-2">Month Closed</h3>
                    <p className="text-lg font-semibold text-red-700 mb-4">
                      Full Salary for {monthName} has already been paid.
                    </p>
                    <p className="text-sm text-red-600">
                      No further payments are allowed for this month.
                    </p>
                    <div className="mt-6 p-4 bg-white/50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        Tip: Change the payment date to select a different month, or choose a different staff member.
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            // If month is NOT locked, show all normal inputs
            return (
              <>
                {/* Date Selector */}
                <div className="space-y-2">
                <Label className="text-base font-semibold">Payment Date</Label>
                <Input 
                  type="date" 
                  value={date} 
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="h-12 text-base"
                />
                <p className="text-xs text-muted-foreground">
                  {payType === "full" ? "Full salary is for current month only" : "Select starting month for advance payment"}
                </p>
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

              {/* Payment Breakdown - Real-time Calculation */}
              {(() => {
                const selectedStaff = staff.find(s => s.id === selectedStaffId);
                const paymentDate = new Date(date);
                const monthlySalary = selectedStaff?.monthlySalary || 0;
                const advancesPaid = getAdvancesPaidInMonth(selectedStaffId, paymentDate);
                const remaining = monthlySalary - advancesPaid;

                if (payType === "full") {
                  return (
                    <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300 rounded-xl p-5 shadow-md">
                      <p className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Payment Breakdown - Full Salary
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center bg-white/70 px-4 py-3 rounded-lg">
                          <span className="font-medium text-gray-700">Monthly Salary</span>
                          <span className="font-bold text-gray-900">Rs {monthlySalary.toLocaleString()}</span>
                        </div>
                        {advancesPaid > 0 && (
                          <div className="flex justify-between items-center bg-white/70 px-4 py-3 rounded-lg">
                            <span className="font-medium text-gray-700">Advances Already Paid</span>
                            <span className="font-bold text-red-600">- Rs {advancesPaid.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-400 font-bold bg-emerald-100 px-4 py-3 rounded-lg">
                          <span className="text-emerald-900 text-base">Total to Pay</span>
                          <span className="text-emerald-700 text-xl">Rs {remaining.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                }

                if (payType === "advance" && amount) {
                  const maxAdvance = monthlySalary * numberOfMonths;
                  const isValid = Number(amount) <= maxAdvance;
                  
                  return (
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-300 rounded-xl p-5 shadow-md">
                      <p className="text-sm font-bold text-blue-900 mb-3 flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Advance Payment Summary
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center bg-white/70 px-4 py-3 rounded-lg">
                          <span className="font-medium text-gray-700">Amount Being Paid</span>
                          <span className={`font-bold ${isValid ? 'text-blue-700' : 'text-red-600'}`}>
                            Rs {Number(amount).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center bg-white/70 px-4 py-3 rounded-lg">
                          <span className="font-medium text-gray-700">For Months</span>
                          <span className="font-bold text-gray-900">{numberOfMonths} month{numberOfMonths > 1 ? 's' : ''}</span>
                        </div>
                        <div className="flex justify-between items-center bg-white/70 px-4 py-3 rounded-lg">
                          <span className="font-medium text-gray-700">Maximum Allowed</span>
                          <span className="font-bold text-gray-500">Rs {maxAdvance.toLocaleString()}</span>
                        </div>
                        {!isValid && (
                          <p className="text-xs text-red-600 font-medium mt-2 bg-red-50 px-3 py-2 rounded">
                            Amount exceeds maximum allowed advance
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }

                return null;
              })()}

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
                    Suggested: Rs {(staff.find(s => s.id === selectedStaffId)?.monthlySalary || 0) * numberOfMonths} for {numberOfMonths} month{numberOfMonths > 1 ? 's' : ''} (Maximum allowed). You can change this amount.
                  </p>
                )}
              </div>

              {/* Confirm Payment Button - WITH LOCK STATE */}
              {(() => {
                const monthsToCheck = payType === "advance" ? numberOfMonths : 1;
                const lockCheck = isPeriodLocked(selectedStaffId, new Date(date), monthsToCheck);
                const isDisabled = !amount || Number(amount) <= 0 || lockCheck.isLocked || isProcessing;

                return (
                  <div className="space-y-3">
                    <Button 
                      onClick={handleConfirm} 
                      className={`w-full py-7 text-xl font-bold shadow-lg mt-4 transition-all ${
                        lockCheck.isLocked 
                          ? 'bg-gray-300 hover:bg-gray-300 cursor-not-allowed text-gray-700' 
                          : isProcessing
                          ? 'bg-blue-600 hover:bg-blue-600 cursor-wait text-white'
                          : 'gradient-gold'
                      }`}
                      disabled={isDisabled}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Processing Payment...
                        </>
                      ) : lockCheck.isLocked ? (
                        <>
                          <Lock className="w-5 h-5 mr-2" />
                          Payment Already Processed for this Period
                        </>
                      ) : payType === "full" ? (
                        `Confirm Full Salary Payment: Rs ${amount || 0}`
                      ) : (
                        `Confirm Advance Payment: Rs ${amount || 0}`
                      )}
                    </Button>
                    {lockCheck.isLocked && (
                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 text-center">
                        <p className="text-sm font-semibold text-red-700">{lockCheck.reason}</p>
                      </div>
                    )}
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