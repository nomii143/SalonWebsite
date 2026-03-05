import { useState, useMemo } from "react";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Download, Printer, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import logo from "@/assets/logo.png";
import { toast } from "sonner";

interface MonthlyStatement {
  staffId: string;
  staffName: string;
  monthlySalary: number;
  paymentType: "Full Early Payout" | "Salary with Debt Reduction" | "Advance Loan" | "No Payment";
  loanAdvanceTakenThisMonth: number;
  debtDeducted: number;
  totalCashHandover: number;
  remainingDebtBalance: number;
  paymentDate?: string;
  notes?: string;
}

export default function PayrollReport() {
  const navigate = useNavigate();
  const { users: staff, salaryPayments } = useData();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [isPrinting, setIsPrinting] = useState(false);

  const months = [
    { label: "January", value: "01" },
    { label: "February", value: "02" },
    { label: "March", value: "03" },
    { label: "April", value: "04" },
    { label: "May", value: "05" },
    { label: "June", value: "06" },
    { label: "July", value: "07" },
    { label: "August", value: "08" },
    { label: "September", value: "09" },
    { label: "October", value: "10" },
    { label: "November", value: "11" },
    { label: "December", value: "12" },
  ];

  const years = ["2024", "2025", "2026", "2027", "2028"];

  const getReferenceMonthKey = (payment: { salaryForMonth?: string; date: string }) => {
    if (payment.salaryForMonth && /^\d{4}-\d{2}$/.test(payment.salaryForMonth)) {
      return payment.salaryForMonth;
    }
    const d = new Date(payment.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  const generateMonthlyStatements = useMemo(() => {
    const getPaymentsForMonth = (staffId: string, year: number, month: number) => {
      const targetMonth = `${year}-${String(month).padStart(2, "0")}`;
      return salaryPayments.filter((payment) => {
        return payment.staffId === staffId && getReferenceMonthKey(payment) === targetMonth;
      });
    };

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

    const getTotalAdvanceAdjustments = (staffId: string, upTo: Date = new Date()) => {
      const upToTimestamp = upTo.getTime();
      return salaryPayments
        .filter((p) => p.staffId === staffId && p.paymentType === "full")
        .filter((p) => {
          const paymentDate = new Date(p.date);
          return !Number.isNaN(paymentDate.getTime()) && paymentDate.getTime() <= upToTimestamp;
        })
        .reduce((total, p) => {
          const notes = p.notes || "";
          const match = notes.match(/Loan\s*Deduction:\s*Rs\s*([\d,]+)/i);
          const adjustment = match ? Number(match[1].replace(/,/g, "")) : 0;
          return total + (Number.isFinite(adjustment) ? adjustment : 0);
        }, 0);
    };

    const getOutstandingAdvanceDue = (staffId: string, upTo: Date = new Date()) => {
      const totalAdvance = getTotalAdvanceTaken(staffId, upTo);
      const totalAdjusted = getTotalAdvanceAdjustments(staffId, upTo);
      return Math.max(0, totalAdvance - totalAdjusted);
    };

    const year = parseInt(selectedYear);
    const month = parseInt(selectedMonth);

    return staff.map((staffMember) => {
      const monthlySalary = staffMember.monthlySalary || 0;
      const monthPayments = getPaymentsForMonth(staffMember.id, year, month);

      const fullSalaryPayments = monthPayments.filter((p) => p.paymentType === "full");
      const advancePayments = monthPayments.filter((p) => p.paymentType === "advance");

      let paymentType: MonthlyStatement["paymentType"] = "No Payment";
      let loanAdvanceTakenThisMonth = 0;
      let debtDeducted = 0;
      let totalCashHandover = 0;
      let paymentDate = "";
      let notes = "";

      // If there are advance payments in this month
      if (advancePayments.length > 0) {
        loanAdvanceTakenThisMonth = advancePayments.reduce((sum, p) => sum + p.amount, 0);
        paymentType = "Advance Loan";
        totalCashHandover = loanAdvanceTakenThisMonth;
        paymentDate = advancePayments[0].date;
        notes = advancePayments[0].notes || "";
      }

      // If there are full salary payments for this month
      if (fullSalaryPayments.length > 0) {
        const paymentNotes = fullSalaryPayments[0].notes || "";

        if (paymentNotes.includes("Early Salary Payout")) {
          paymentType = "Full Early Payout";
          totalCashHandover = monthlySalary;
        } else if (paymentNotes.includes("Salary with Debt Reduction")) {
          paymentType = "Salary with Debt Reduction";
          // Extract deduction from notes
          const deductionMatch = paymentNotes.match(/Loan\s*Deduction:\s*Rs\s*([\d,]+)/i);
          if (deductionMatch) {
            debtDeducted = Number(deductionMatch[1].replace(/,/g, ""));
          }
          totalCashHandover = monthlySalary - debtDeducted;
        }
        paymentDate = fullSalaryPayments[0].date;
        notes = paymentNotes;
      }

      // Calculate remaining debt for this staff member at end of this month
      const monthEnd = new Date(year, month, 0); // Last day of the month
      const remainingDebtBalance = getOutstandingAdvanceDue(staffMember.id, monthEnd);

      return {
        staffId: staffMember.id,
        staffName: staffMember.fullName,
        monthlySalary,
        paymentType,
        loanAdvanceTakenThisMonth,
        debtDeducted,
        totalCashHandover,
        remainingDebtBalance,
        paymentDate,
        notes,
      } as MonthlyStatement;
    });
  }, [selectedYear, selectedMonth, staff, salaryPayments]);

  const handlePrintReport = async () => {
    setIsPrinting(true);
    try {
      const element = document.getElementById("payroll-report-content");
      if (!element) return;

      const canvas = await html2canvas(element, { scale: 2 });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");

      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= 297;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= 297;
      }

      const monthName = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString(
        "en-US",
        { month: "long", year: "numeric" }
      );
      pdf.save(`Payroll_Report_${monthName}.pdf`);
      toast.success("Report downloaded successfully");
    } catch (error) {
      console.error("Print error:", error);
      toast.error("Failed to generate PDF");
    } finally {
      setIsPrinting(false);
    }
  };

  const monthName = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" }
  );

  const totalMonthlyBudget = generateMonthlyStatements.reduce(
    (sum, stmt) => sum + stmt.monthlySalary,
    0
  );
  const totalPaidCash = generateMonthlyStatements.reduce(
    (sum, stmt) => sum + stmt.totalCashHandover,
    0
  );
  const totalRemainingDebt = generateMonthlyStatements.reduce(
    (sum, stmt) => sum + stmt.remainingDebtBalance,
    0
  );

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Payroll Report</h1>
              <p className="text-muted-foreground mt-1">Monthly Salary Statement & Debt Tracking</p>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" /> Select Month & Year
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-semibold text-muted-foreground mb-2 block">Month</label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-semibold text-muted-foreground mb-2 block">Year</label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px] flex items-end">
              <Button
                onClick={handlePrintReport}
                disabled={isPrinting}
                className="gradient-gold text-primary-foreground w-full"
              >
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-blue-900">Total Monthly Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-700">Rs {totalMonthlyBudget.toLocaleString()}</p>
              <p className="text-xs text-blue-600 mt-1">All staff salaries combined</p>
            </CardContent>
          </Card>

          <Card className="bg-green-50 border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-green-900">Total Cash Paid</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-700">Rs {totalPaidCash.toLocaleString()}</p>
              <p className="text-xs text-green-600 mt-1">Actual cash disbursed</p>
            </CardContent>
          </Card>

          <Card className="bg-amber-50 border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-amber-900">Total Pending Debt</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-700">Rs {totalRemainingDebt.toLocaleString()}</p>
              <p className="text-xs text-amber-600 mt-1">All staff loans combined</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Content */}
        <div id="payroll-report-content" className="bg-white rounded-xl shadow-lg p-8 space-y-8">
          {/* Report Header */}
          <div className="border-b-2 border-gray-300 pb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">GEEROZ SALON</h2>
                <p className="text-sm text-gray-600">Monthly Payroll Statement</p>
              </div>
              <div className="text-right text-sm text-gray-600">
                <p className="font-semibold">{monthName}</p>
                <p>Generated: {new Date().toLocaleDateString()}</p>
              </div>
            </div>
          </div>

          {/* Individual Staff Statements */}
          <div className="space-y-8">
            {generateMonthlyStatements.map((statement, idx) => (
              <div key={statement.staffId} className="border border-gray-200 rounded-lg p-6 bg-gray-50">
                {/* Staff Header */}
                <div className="mb-6 pb-4 border-b-2 border-gray-300">
                  <h3 className="text-xl font-bold text-gray-900">{statement.staffName}</h3>
                  <p className="text-sm text-gray-600">Staff ID: {statement.staffId}</p>
                </div>

                {/* Salary Details Table */}
                <div className="space-y-4">
                  <div className="bg-white rounded-lg p-4 space-y-3">
                    {/* Basic Salary */}
                    <div className="flex justify-between items-center border-b pb-3">
                      <span className="font-semibold text-gray-700">Basic Salary ({monthName})</span>
                      <span className="font-bold text-gray-900 text-lg">
                        Rs {statement.monthlySalary.toLocaleString()}
                      </span>
                    </div>

                    {/* Payment Status */}
                    <div className="flex justify-between items-center border-b pb-3">
                      <span className="font-semibold text-gray-700">Payment Status</span>
                      <span
                        className={`font-bold px-3 py-1 rounded-full text-sm ${
                          statement.paymentType === "Full Early Payout"
                            ? "bg-green-100 text-green-800"
                            : statement.paymentType === "Salary with Debt Reduction"
                            ? "bg-yellow-100 text-yellow-800"
                            : statement.paymentType === "Advance Loan"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {statement.paymentType}
                      </span>
                    </div>

                    {/* New Loan Taken */}
                    <div className="flex justify-between items-center border-b pb-3">
                      <span className="font-semibold text-gray-700">New Loan Taken (Advance)</span>
                      <span className="font-bold text-gray-900">
                        Rs {statement.loanAdvanceTakenThisMonth.toLocaleString()}
                      </span>
                    </div>

                    {/* Debt Deducted */}
                    <div className="flex justify-between items-center border-b pb-3">
                      <span className="font-semibold text-gray-700">Debt Deduction</span>
                      <span className="font-bold text-red-600">
                        - Rs {statement.debtDeducted.toLocaleString()}
                      </span>
                    </div>

                    {/* Total Cash Handover */}
                    <div className="flex justify-between items-center bg-blue-50 p-3 rounded-lg">
                      <span className="font-bold text-gray-900">Total Cash Handover</span>
                      <span className="font-bold text-blue-700 text-xl">
                        Rs {statement.totalCashHandover.toLocaleString()}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="border-t-2 border-dashed border-gray-300 my-3"></div>

                    {/* Remaining Debt Balance */}
                    <div className="flex justify-between items-center bg-amber-50 p-3 rounded-lg">
                      <span className="font-bold text-gray-900">Remaining Debt</span>
                      <span className="font-bold text-amber-700 text-xl">
                        Rs {statement.remainingDebtBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes if any */}
                {statement.notes && (
                  <div className="mt-4 p-3 bg-gray-100 rounded text-xs text-gray-600">
                    <strong>Notes:</strong> {statement.notes}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Report Footer */}
          <div className="border-t-2 border-gray-300 pt-6 text-center text-sm text-gray-600">
            <p>This is an official payroll statement generated by GEEROZ Salon Management System</p>
            <p className="mt-2">For any discrepancies, please contact the administration.</p>
          </div>
        </div>

        {/* Table View */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Summary Table View</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/10">
                    <TableHead className="font-bold">Staff Member</TableHead>
                    <TableHead className="text-right font-bold">Basic Salary</TableHead>
                    <TableHead className="font-bold">Payment Type</TableHead>
                    <TableHead className="text-right font-bold">New Loan</TableHead>
                    <TableHead className="text-right font-bold">Debt Deduction</TableHead>
                    <TableHead className="text-right font-bold">Cash Paid</TableHead>
                    <TableHead className="text-right font-bold">Remaining Debt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {generateMonthlyStatements.map((statement) => (
                    <TableRow key={statement.staffId} className="hover:bg-primary/5">
                      <TableCell className="font-semibold">{statement.staffName}</TableCell>
                      <TableCell className="text-right">Rs {statement.monthlySalary.toLocaleString()}</TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-bold px-2 py-1 rounded ${
                            statement.paymentType === "Full Early Payout"
                              ? "bg-green-100 text-green-800"
                              : statement.paymentType === "Salary with Debt Reduction"
                              ? "bg-yellow-100 text-yellow-800"
                              : statement.paymentType === "Advance Loan"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {statement.paymentType}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        Rs {statement.loanAdvanceTakenThisMonth.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-bold">
                        - Rs {statement.debtDeducted.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        Rs {statement.totalCashHandover.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-bold text-amber-700">
                        Rs {statement.remainingDebtBalance.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
