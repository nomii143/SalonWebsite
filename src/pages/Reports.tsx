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

  if (startY > 240) { doc.addPage(); startY = 20; }

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
      const fetchData = async (t: string) => {
        const fetchType = t === "Daily Expenses" ? "Expenses" : t;
        return await window.electronAPI.getReportData({
          type: fetchType,
          range: timeRange,
          startDate: finalStartISO,
          endDate: finalEndISO,
          category: null
        });
      };

      const generateStaffSalaryReport = () => {
        const groupedByMonth = new Map<string, any[]>();

        // Group payments by month
        salaryPayments.forEach(payment => {
          const paymentDate = new Date(payment.date);
          const monthKey = `${paymentDate.getFullYear()}-${String(paymentDate.getMonth() + 1).padStart(2, '0')}`;
          
          // Only include payments within the selected date range
          if (paymentDate >= new Date(finalStartISO) && paymentDate <= new Date(finalEndISO)) {
            if (!groupedByMonth.has(monthKey)) {
              groupedByMonth.set(monthKey, []);
            }
            groupedByMonth.get(monthKey)?.push(payment);
          }
        });

        // Generate report for each month in the range
        Array.from(groupedByMonth.entries()).sort().forEach(([monthKey, monthPayments]) => {
          const lastAuto = (doc as any).lastAutoTable;
          let startY = lastAuto && lastAuto.finalY ? lastAuto.finalY + 18 : 42;

          if (startY > 240) { doc.addPage(); startY = 20; }

          const [year, month] = monthKey.split('-');
          const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

          // Month heading
          doc.setFontSize(13);
          doc.setTextColor(0);
          doc.setFont("helvetica", "bold");
          doc.text(`Staff Salary - ${monthName}`, 14, startY);

          // Group by staff
          const staffPaymentMap = new Map<string, any[]>();
          monthPayments.forEach(p => {
            if (!staffPaymentMap.has(p.staffId)) {
              staffPaymentMap.set(p.staffId, []);
            }
            staffPaymentMap.get(p.staffId)?.push(p);
          });

          // Create table data
          const headers = ["Staff Name", "Payment Type", "Amount", "Details"];
          const tableBody: any[] = [];
          let monthTotal = 0;

          staffPaymentMap.forEach((payments, staffId) => {
            const staffName = payments[0].staffName;
            let isFirstRow = true;
            
            // Sort payments: full salary first, then advances
            const sortedPayments = payments.sort((a, b) => {
              if (a.paymentType === 'full' && b.paymentType !== 'full') return -1;
              if (a.paymentType !== 'full' && b.paymentType === 'full') return 1;
              return 0;
            });

            sortedPayments.forEach(payment => {
              const amount = payment.amount;
              monthTotal += amount;
              const details = payment.paymentType === 'full' 
                ? 'Full Salary (1 month)' 
                : `Advance (${payment.numberOfMonths || 1} months)`;

              if (isFirstRow) {
                tableBody.push([
                  staffName,
                  payment.paymentType === 'full' ? 'Full Salary' : 'Advance',
                  `Rs. ${amount.toLocaleString()}`,
                  details
                ]);
                isFirstRow = false;
              } else {
                tableBody.push([
                  '',
                  payment.paymentType === 'full' ? 'Full Salary' : 'Advance',
                  `Rs. ${amount.toLocaleString()}`,
                  details
                ]);
              }
            });
          });

          const totalStaffPaid = staffPaymentMap.size;
          
          autoTable(doc, {
            startY: startY + 5,
            head: [headers],
            body: tableBody,
            showFoot: 'lastPage',
            foot: [[`Total Staff Paid: ${totalStaffPaid}`, "", `Rs. ${monthTotal.toLocaleString()}`, "Total Amount"]],
            theme: 'striped',
            headStyles: { fillColor: [40, 80, 120], fontSize: 10, halign: 'left', valign: 'middle' },
            bodyStyles: { valign: 'middle' },
            didParseCell: (data) => {
              if (data.column.index === 2) {
                data.cell.styles.halign = 'right';
              }
            },
            footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', valign: 'middle' },
            styles: { fontSize: 9, cellPadding: 4, valign: 'middle' },
          });
        });

        if (groupedByMonth.size === 0) {
          const lastAuto = (doc as any).lastAutoTable;
          let startY = lastAuto && lastAuto.finalY ? lastAuto.finalY + 15 : 42;
          if (startY > 240) { doc.addPage(); startY = 20; }
          
          doc.setFontSize(12);
          doc.setTextColor(100);
          doc.text("No salary payments found for the selected period.", 14, startY);
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
        const data = await fetchData(reportType);
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