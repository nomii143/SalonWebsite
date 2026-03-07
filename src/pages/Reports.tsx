import React, { useMemo, useState } from "react";
import { useData } from "@/context/DataContext"; 
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PieChart, Calendar, FileDown } from "lucide-react";
import logo from "@/assets/logo.png";
import html2canvas from "html2canvas";
import { getTodayDateString } from "@/lib/utils";

const reportTypes = ["Stock In", "Stock Out", "Sales", "Daily Expenses", "Vendor Payments", "Staff Salary", "All Items"] as const;
const timeRanges = ["daily", "weekly", "monthly", "custom"] as const;

type ReportType = (typeof reportTypes)[number];
type TimeRange = (typeof timeRanges)[number];

const loadImageDataUrl = async (src: string) => {
  const response = await fetch(src);
  const blob = await response.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read logo image"));
    reader.readAsDataURL(blob);
  });
};

const Reports = () => {
  const [reportType, setReportType] = useState<ReportType | "">("");
  const [timeRange, setTimeRange] = useState<TimeRange | "">(""); 
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const { users: staff, salaryPayments } = useData();

  const isCustom = timeRange === "custom";
  const isValid = Boolean(reportType) && Boolean(timeRange) && (!isCustom || (startDate && endDate));

  const formatDate = (value: string) => value ? value.split("T")[0] : "N/A";

  const handleGenerate = async () => {
    if (!isValid) return;
    setIsGenerating(true);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalVendorPayments = 0;

    try {
      const doc = new jsPDF("p", "mm", "a4");
      const now = new Date();
      const generatedDate = getTodayDateString();

      let logoDataUrl = "";
      try {
        logoDataUrl = await loadImageDataUrl(logo);
      } catch (error) {
        console.warn("Report logo load failed", error);
      }

      const currentTimeISO = now.toISOString();
      let finalStartISO = new Date(now.getTime() - (24 * 60 * 60 * 1000)).toISOString();
      let finalEndISO = currentTimeISO;

      if (timeRange === "weekly") {
        finalStartISO = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();
      } else if (timeRange === "monthly") {
        finalStartISO = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000)).toISOString();
      } else if (timeRange === "custom" && startDate && endDate) {
        finalStartISO = new Date(startDate).toISOString();
        finalEndISO = new Date(endDate).toISOString();
      }

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 14, 12, 12, 12);
      }
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("GEEROZ SALON MANAGEMENT SYSTEM", 30, 20);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Official Business Report | Generated: ${generatedDate}`, 14, 27);
      doc.text(`Interval: ${timeRange.toUpperCase()} (${formatDate(finalStartISO)} to ${formatDate(finalEndISO)})`, 14, 32);
      doc.setDrawColor(200);
      doc.line(14, 35, 196, 35);

     const renderTable = (title: string, rows: any[] = [], type: "stock" | "expense" | "vendor" | "sale") => {
  const lastAuto = (doc as any).lastAutoTable;
  let startY = lastAuto && lastAuto.finalY ? lastAuto.finalY + 15 : 42;

  // Ensure heading and content stay together (need space for heading + table header + at least 1 row)
  const minimumSpaceNeeded = 25;
  if (startY > 240 || startY + minimumSpaceNeeded > 270) { 
    doc.addPage(); 
    startY = 20; 
  }

  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), 14, startY);

  let headers: string[] = [];
  const isStockOut = title.toLowerCase().includes("stock out");

  if (type === "stock") {
    // Specifically add "Staff Member" header for Stock Out
    headers = isStockOut 
      ? ["Date", "Item Name", "Quantity", "Staff Member"] 
      : ["Date", "Item Name", "Quantity"];
  } else if (type === "sale") {
    headers = ["Date", "Cash Amount", "Card Amount", "Total Amount"];
  } else {
    headers = ["Date", "Category", "Details", "Amount"];
  }

  const tableBody = rows.length > 0 ? rows.map((row) => {
    const date = formatDate(row.date || row.saleDate || row.created_at);
    const amount = Number(row.totalAmount || row.amount || 0);
    
    if (type === "stock") {
      const name = row.item_name || row.itemName || "N/A";
      const qty = Number(row.quantity || row.quantitySold || 0);
      
      if (isStockOut) {
        // Fetch staff name. Added multiple key checks to ensure it finds the data
        const staffName = row.staff_name || row.staffName || row.buyerName || row.staff || "N/A";
        return [date, name, qty, staffName];
      }
      return [date, name, qty];
    }

    if (type === "sale") {
      const cash = Number(row.cashAmount ?? row.cash_amount ?? 0);
      const card = Number(row.cardAmount ?? row.card_amount ?? 0);
      return [
        date, 
        `Rs. ${cash.toLocaleString()}`, 
        `Rs. ${card.toLocaleString()}`, 
        `Rs. ${amount.toLocaleString()}`
      ];
    }

    const category = row.category || "General";
    const desc = row.buyerName || row.description || row.item_name || "-";
    return [date, category, desc, `Rs. ${amount.toLocaleString()}`];
  }) : [["-", "-", "No records found", "-"]];

  const currentTotal = rows.reduce((sum, r) => sum + Number(r.amount || r.totalAmount || 0), 0);

  autoTable(doc, {
    startY: startY + 4,
    head: [headers],
    body: tableBody,
    showFoot: 'lastPage',
    foot: (type !== "stock") 
      ? [[
          "TOTAL", 
          "", 
          "", 
          `Rs. ${currentTotal.toLocaleString()}`
        ]] 
      : undefined,
    theme: 'striped',
    headStyles: { fillColor: [40, 40, 40], fontSize: 9, halign: 'left' },
    didParseCell: (data) => {
      if (data.section === 'head' || data.section === 'body' || data.section === 'foot') {
        if (type === "sale") {
          if (data.column.index >= 1) data.cell.styles.halign = 'right';
        } else {
          // Align the last column to the right if it's a price/amount
          if (data.column.index === headers.length - 1 && type !== "stock") {
            data.cell.styles.halign = 'right';
          }
        }
      }
    },
    footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 3 },
  });

  return currentTotal;
};
      type ReportQueryType =
        | "Stock In"
        | "Stock Out"
        | "Sales"
        | "Vendor Payments"
        | "All Items"
        | "Expenses"
        | "Inventory";

      const fetchData = async (t: ReportQueryType | "Daily Expenses") => {
        const fetchType: ReportQueryType = t === "Daily Expenses" ? "Expenses" : t;
        const selectedRange: TimeRange = timeRange || "daily";
        return await window.electronAPI.getReportData({
          type: fetchType,
          range: selectedRange,
          startDate: finalStartISO,
          endDate: finalEndISO,
          category: null
        });
      };

      const generateStaffSalaryReport = () => {
        const parseDeductionFromNotes = (notes?: string) => {
          if (!notes) return 0;
          const match = notes.match(/(Loan\s*Deduction|Advance\s*Adjustment):\s*Rs\s*([\d,]+)/i);
          if (!match) return 0;
          const value = Number(String(match[2]).replace(/,/g, ""));
          return Number.isFinite(value) ? value : 0;
        };

        const getReferenceMonth = (payment: { salaryForMonth?: string; date: string }) => {
          if (payment.salaryForMonth && /^\d{4}-\d{2}$/.test(payment.salaryForMonth)) {
            return payment.salaryForMonth;
          }
          const d = new Date(payment.date);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        };

        const rangeStart = new Date(finalStartISO);
        const rangeEnd = new Date(finalEndISO);
        const monthSet = new Set<string>();
        const cursor = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
        const endMonthStart = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);
        while (cursor.getTime() <= endMonthStart.getTime()) {
          monthSet.add(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
          cursor.setMonth(cursor.getMonth() + 1);
        }

        const paymentsInRange = salaryPayments.filter((payment) => {
          const refMonth = getReferenceMonth(payment);
          return monthSet.has(refMonth);
        });

        const groupedByMonth = new Map<string, typeof salaryPayments>();
        paymentsInRange.forEach((payment) => {
          const monthKey = getReferenceMonth(payment);
          if (!groupedByMonth.has(monthKey)) groupedByMonth.set(monthKey, [] as any);
          groupedByMonth.get(monthKey)?.push(payment);
        });

        const reportHeaderBaseY = (doc as any).lastAutoTable?.finalY
          ? (doc as any).lastAutoTable.finalY + 12
          : 42;
        // Keep section heading and first month title together on the same page.
        // If there is not enough room, move to a new page before drawing the heading.
        const minimumSpaceNeeded = 18;
        let reportHeaderY = reportHeaderBaseY;
        if (reportHeaderY > 242 || reportHeaderY + minimumSpaceNeeded > 270) {
          doc.addPage();
          reportHeaderY = 20;
        }

        doc.setFontSize(14);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("STAFF SALARIES REPORT", 14, reportHeaderY);

        let isFirstMonthBlock = true;

        const getOpeningDebt = (staffId: string, currentMonthKey: string) => {
          const prior = salaryPayments
            .filter((p) => p.staffId === staffId)
            .filter((p) => getReferenceMonth(p) < currentMonthKey);

          const totalAdvance = prior
            .filter((p) => p.paymentType === "advance")
            .reduce((sum, p) => sum + Number(p.amount || 0), 0);

          const totalDeducted = prior
            .filter((p) => p.paymentType === "full")
            .reduce((sum, p) => sum + parseDeductionFromNotes(p.notes), 0);

          return Math.max(0, totalAdvance - totalDeducted);
        };

        Array.from(groupedByMonth.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .forEach(([monthKey, monthPayments]) => {
            const lastAuto = (doc as any).lastAutoTable;
            let startY = isFirstMonthBlock
              ? reportHeaderY + 8
              : (lastAuto && lastAuto.finalY ? lastAuto.finalY + 10 : reportHeaderY + 8);
            
            // Ensure enough space for month heading + at least first staff section
            if (startY > 236) {
              doc.addPage();
              startY = 20;
            }

            const [y, m] = monthKey.split("-").map(Number);
            const monthName = new Date(y, m - 1).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            });

            doc.setFontSize(13);
            doc.setTextColor(0);
            doc.setFont("helvetica", "bold");
            doc.text(`Payroll Report - ${monthName}`, 14, startY);

            const byStaff = new Map<string, typeof salaryPayments>();
            monthPayments.forEach((payment) => {
              if (!byStaff.has(payment.staffId)) byStaff.set(payment.staffId, [] as any);
              byStaff.get(payment.staffId)?.push(payment);
            });

            byStaff.forEach((staffMonthPayments, staffId) => {
              const first = staffMonthPayments[0];
              const staffName = first?.staffName || "Unknown";
              const staffProfile = staff.find((s) => s.id === staffId);
              const monthlySalary = Number(staffProfile?.monthlySalary || 0);

              const openingBalance = getOpeningDebt(staffId, monthKey);
              const newAdvance = staffMonthPayments
                .filter((p) => p.paymentType === "advance")
                .reduce((sum, p) => sum + Number(p.amount || 0), 0);
              const deductedAmount = staffMonthPayments
                .filter((p) => p.paymentType === "full")
                .reduce((sum, p) => sum + parseDeductionFromNotes(p.notes), 0);

              const fullPayment = staffMonthPayments.find((p) => p.paymentType === "full");
              const hasEarlyPayout = Boolean(
                fullPayment && (fullPayment.notes || "").includes("Early Salary Payout")
              );
              const paymentStatus = fullPayment
                ? hasEarlyPayout
                  ? "Full Month Early Payout"
                  : "Salary with Debt Reduction"
                : "No Salary Payout";

              const cashHandover = Math.max(0, monthlySalary - deductedAmount);
              const closingBalance = Math.max(0, openingBalance + newAdvance - deductedAmount);

              const summaryRows = [
                ["Basic Salary", `Rs. ${monthlySalary.toLocaleString()}`],
                ["Payment Status", paymentStatus],
                ["Opening Debt Balance", `Rs. ${openingBalance.toLocaleString()}`],
                ["New Loan Taken", `Rs. ${newAdvance.toLocaleString()}`],
                ["Loan Deduction ", `Rs. ${deductedAmount.toLocaleString()}`],
                ["Total Cash Handover", `Rs. ${cashHandover.toLocaleString()}`],
                ["Remaining Loan", `Rs. ${closingBalance.toLocaleString()}`],
              ];

              const beforeSummary = (doc as any).lastAutoTable;
              const minimumStaffStartY = startY + 8;
              let staffStartY = beforeSummary && beforeSummary.finalY
                ? Math.max(beforeSummary.finalY + 8, minimumStaffStartY)
                : minimumStaffStartY;
              
              // Ensure enough space for staff heading + summary table (at least 30mm needed)
              if (staffStartY > 235) {
                doc.addPage();
                staffStartY = 20;
              }

              doc.setFontSize(11);
              doc.setFont("helvetica", "bold");
              doc.text(`Staff: ${staffName}`, 14, staffStartY);

              autoTable(doc, {
                startY: staffStartY + 4,
                head: [["Description", "Amount"]],
                body: summaryRows,
                theme: "striped",
                headStyles: { fillColor: [34, 88, 120], fontSize: 9 },
                styles: { fontSize: 8.5, cellPadding: 3 },
                didParseCell: (data) => {
                  if (data.column.index === 1 && data.section !== "head") {
                    data.cell.styles.halign = "right";
                  }
                },
              });

              const txRows = staffMonthPayments
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .map((p) => {
                  const isManualAdvanceAdjustment =
                    p.paymentType === "advance" &&
                    (p.notes || "").toLowerCase().includes("manual advance update");
                  const txType = p.paymentType === "advance"
                    ? isManualAdvanceAdjustment
                      ? "Advance Adj."
                      : "Advance"
                    : "Salary";
                  return [
                    formatDate(p.date),
                    `Rs. ${Number(p.amount || 0).toLocaleString()}`,
                    txType,
                  ];
                });

              autoTable(doc, {
                startY: (doc as any).lastAutoTable.finalY + 3,
                head: [["Date", "Amount", "Type"]],
                body: txRows.length > 0 ? txRows : [["-", "Rs. 0", "No Transactions"]],
                theme: "grid",
                headStyles: { fillColor: [80, 80, 80], fontSize: 8.5 },
                styles: { fontSize: 8, cellPadding: 2.5 },
                didParseCell: (data) => {
                  if (data.column.index === 1 && data.section !== "head") {
                    data.cell.styles.halign = "right";
                  }
                },
              });

              isFirstMonthBlock = false;
            });
          });

        if (groupedByMonth.size === 0) {
          const lastAuto = (doc as any).lastAutoTable;
          let startY = lastAuto && lastAuto.finalY ? lastAuto.finalY + 10 : reportHeaderY + 8;
          if (startY > 242) {
            doc.addPage();
            startY = 20;
          }
          doc.setFontSize(12);
          doc.setTextColor(100);
          doc.text("No payroll records found for the selected period.", 14, startY);
        }
      };

      if (reportType === "All Items") {
        const stockInData = await fetchData("Stock In");
        renderTable("Stock In Report", stockInData, "stock");

        const stockOutData = await fetchData("Stock Out");
        renderTable("Stock Out Report", stockOutData, "stock");

        const salesData = await fetchData("Sales");
        totalRevenue = renderTable("Sales Report", salesData, "sale");

        const expenseData = await fetchData("Daily Expenses");
        totalExpenses = renderTable("Daily Expenses Report", expenseData, "expense");

        const vendorData = await fetchData("Vendor Payments");
        totalVendorPayments = renderTable("Vendor Payments Report", vendorData, "vendor");

        // Add Staff Salary Report
        generateStaffSalaryReport();

        // Calculate and display financial summary at the very end
        const totalBalance = totalRevenue - totalVendorPayments - totalExpenses;
        
        const lastAuto = (doc as any).lastAutoTable;
        let finalY = lastAuto.finalY + 15;

        if (finalY > 245) { doc.addPage(); finalY = 20; }

        doc.setFillColor(248, 248, 248);
        doc.rect(14, finalY, 182, 30, "F");
        doc.setDrawColor(220);
        doc.rect(14, finalY, 182, 30, "D");

        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.setFont("helvetica", "bold");
        doc.text("FINANCIAL SUMMARY", 18, finalY + 8);
        
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`(+) Total Sales:`, 18, finalY + 15);
        doc.text(`Rs. ${totalRevenue.toLocaleString()}`, 65, finalY + 15);

        doc.text(`(-) Vendor Payments:`, 18, finalY + 20);
        doc.text(`Rs. ${totalVendorPayments.toLocaleString()}`, 65, finalY + 20);

        doc.text(`(-) Daily Expenses:`, 18, finalY + 25);
        doc.text(`Rs. ${totalExpenses.toLocaleString()}`, 65, finalY + 25);
        
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        const statusText = totalBalance >= 0 ? "Total Balance (Profit):" : "Total Balance (Loss):";
        
        if(totalBalance < 0) doc.setTextColor(200, 0, 0); 
        else doc.setTextColor(0, 120, 0);
        
        doc.text(`${statusText}`, 110, finalY + 15);
        doc.text(`Rs. ${totalBalance.toLocaleString()}`, 110, finalY + 22);

      } else if (reportType === "Staff Salary") {
        generateStaffSalaryReport();

      } else {
        const data = await fetchData(reportType as Exclude<ReportType, "Staff Salary">);
        const mode = (reportType === "Stock In" || reportType === "Stock Out") ? "stock" : (reportType === "Sales" ? "sale" : (reportType === "Vendor Payments" ? "vendor" : "expense"));
        renderTable(`${reportType} Report`, data, mode);
      }

      doc.save(`Geeroz_Report_${generatedDate}.pdf`);
      toast.success("Report Generated Successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-8 p-4 md:p-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-3 rounded-2xl">
            <PieChart className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports Center</h1>
            <p className="text-muted-foreground mt-1">Generate comprehensive business and inventory insights.</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-card border shadow-sm overflow-hidden transition-all hover:shadow-md">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Configuration
          </h2>
        </div>
        
        <div className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Report Type</label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger className="h-11 shadow-sm"><SelectValue placeholder="Choose report type" /></SelectTrigger>
                <SelectContent>
                  {reportTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Time Range</label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="h-11 shadow-sm"><SelectValue placeholder="Choose time range" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isCustom && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">From</label>
                  <Input type="date" className="h-11" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">To</label>
                  <Input type="date" className="h-11" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </div>
              </>
            )}
          </div>

          <div className="pt-6 border-t flex justify-center md:justify-start">
            <Button 
              onClick={handleGenerate} 
              disabled={!isValid || isGenerating} 
              className="w-full md:w-auto px-12 h-12 font-bold shadow-lg transition-transform active:scale-95 gradient-gold text-white"
            >
              {isGenerating ? (
                <span className="flex items-center gap-2">Generating...</span>
              ) : (
                <span className="flex items-center gap-2">
                  <FileDown className="h-5 w-5" /> Download PDF Report
                </span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;
//nk7