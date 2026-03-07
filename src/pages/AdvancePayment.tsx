import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Wallet, AlertCircle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { getTodayDateString } from "@/lib/utils";

export default function AdvancePaymentPage() {
  const navigate = useNavigate();
  const {
    users: staff,
    addSalaryPayment,
    salaryPayments,
  } = useData();
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const [amount, setAmount] = useState("0");
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

  const getTotalAdvanceTakenByStaff = (staffId: string) => {
    return salaryPayments
      .filter((p) => p.staffId === staffId && p.paymentType === "advance")
      .reduce((total, p) => total + p.amount, 0);
  };

  const getOutstandingAdvanceAmount = (staffId: string) => {
    const totalAdvanceTaken = salaryPayments
      .filter((payment) => payment.staffId === staffId && payment.paymentType === "advance")
      .reduce((sum, payment) => sum + payment.amount, 0);

    const totalAdvanceAdjusted = salaryPayments
      .filter((payment) => payment.staffId === staffId && payment.paymentType === "full")
      .reduce((sum, payment) => {
        // Use advanceDeducted field first, fallback to parsing notes for backward compatibility
        if (payment.advanceDeducted !== undefined && payment.advanceDeducted > 0) {
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

    return Math.max(0, totalAdvanceTaken - totalAdvanceAdjusted);
  };

  const handleNumberOfMonthsChange = (value: string) => {
    const numMonths = parseInt(value);
    setNumberOfMonths(numMonths);

    // Auto-fill amount with monthly salary * months
    if (selectedStaffId) {
      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (selectedStaff?.monthlySalary) {
        const suggestedAmount = (selectedStaff.monthlySalary || 0) * numMonths;
        setAmount(String(suggestedAmount));
      }
    }
  };

  const handleStaffChange = (staffId: string) => {
    setSelectedStaffId(staffId);
    setAmount("0");
  };

  const handleConfirm = async () => {
    try {
      setIsProcessing(true);
      if (!selectedStaffId || !amount) {
        setIsProcessing(false);
        return toast.error("Complete all details");
      }

      const selectedStaff = staff.find(s => s.id === selectedStaffId);
      if (!selectedStaff) {
        setIsProcessing(false);
        return toast.error("Staff not found");
      }

      const paymentAmount = Number(amount);

      if (paymentAmount <= 0) {
        setIsProcessing(false);
        return toast.error("Payment amount must be greater than zero");
      }

      const paymentDate = new Date();
      const salaryForMonth = getReferenceMonthKey(getTodayDateString());

      const paymentNotes = `Advance Loan (creates debt): Rs ${paymentAmount.toLocaleString()}${numberOfMonths > 1 ? ` for ${numberOfMonths} months` : ''}`;

      await addSalaryPayment({
        staffId: selectedStaffId,
        staffName: selectedStaff.fullName,
        amount: paymentAmount,
        paymentType: "advance",
        date: new Date().toISOString(),
        salaryForMonth,
        numberOfMonths,
        notes: paymentNotes,
        status: "Pending",
        amountPaid: 0,
        advanceDeducted: 0,
        totalSalaryGiven: 0,
        month: paymentDate.getMonth() + 1,
        year: paymentDate.getFullYear()
      });

      const monthName = paymentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      toast.success(`Advance of Rs ${paymentAmount.toLocaleString()} given to ${selectedStaff.fullName} for ${monthName}`);

      setTimeout(() => {
        console.log("[AdvancePayment] Navigating to staff salaries page");
        setIsProcessing(false);
        navigate("/staffsalaries");
      }, 500);
    } catch (error) {
      console.error("Advance payment error:", error);
      setIsProcessing(false);
      toast.error(`Failed to process advance: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
      <div className="bg-card border p-8 rounded-2xl shadow-xl border-primary/10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Clock className="text-primary"/> Advance Payment</h2>
        <div className="space-y-6">
          {/* Step 1: Choose Staff */}
          <div className="space-y-2">
            <Label className="text-base font-semibold">Step 1: Select Staff Member</Label>
            <Select value={selectedStaffId} onValueChange={handleStaffChange}>
              <SelectTrigger className="h-14 text-base"><SelectValue placeholder="Choose Staff Member" /></SelectTrigger>
              <SelectContent>
                {staff.map(s => {
                  const outstandingAdvance = getOutstandingAdvanceAmount(s.id);
                  return (
                    <SelectItem key={s.id} value={s.id} className="hover:bg-white">
                      <span className="flex items-center justify-between w-full gap-3 text-black group-hover:text-black data-[state=checked]:text-black data-[highlighted]:text-black">
                        <span>{s.fullName}</span>
                        {outstandingAdvance > 0 ? (
                          <span className="text-black text-xs">
                            Advance: Rs {outstandingAdvance.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-black text-xs">
                            No Advance
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
         
          </div>

          {/* Staff Financial Overview */}
          {selectedStaffId && (() => {
            const currentAdvance = getOutstandingAdvanceAmount(selectedStaffId);
            const selectedStaff = staff.find(s => s.id === selectedStaffId);
            const monthlySalary = selectedStaff?.monthlySalary || 0;

            return (
              <div className="p-4 bg-white border-2 border-slate-100 rounded-xl shadow-sm space-y-4">
               

                <div className="flex items-center justify-between px-3 py-2 bg-orange-50 rounded-lg border-2 border-orange-300">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <h4 className="text-xs font-bold text-orange-700 uppercase tracking-wider">
                      Total Advance Already Given
                    </h4>
                  </div>
                  <h4 className={`text-lg font-bold ${currentAdvance > 0 ? 'text-orange-700' : 'text-slate-400'}`}>
                    {currentAdvance > 0 ? `Rs ${currentAdvance.toLocaleString()}` : 'None'}
                  </h4>
                </div>
              </div>
            );
          })()}

          

          {/* Step 2: Advance Amount */}
          {selectedStaffId && (
            <div className="space-y-2">
              <Label className="text-base font-semibold">Step 2: Advance Payment Amount (Rs)</Label>
              <Input 
                type="number" 
                min="1" 
                value={amount} 
                onChange={(e) => setAmount(e.target.value)} 
                placeholder="Enter advance amount "
                className="h-14 text-lg font-semibold border-2 border-orange-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
             

            
            </div>
          )}

          {/* Confirm Button */}
          {selectedStaffId && (
            <div className="space-y-3">
              <Button 
                onClick={handleConfirm} 
                className={`w-full py-7 text-xl font-bold shadow-lg mt-4 gradient-gold`}
                disabled={!selectedStaffId || !amount || Number(amount) <= 0 || isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  `Confirm Advance: Rs ${amount}`
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
