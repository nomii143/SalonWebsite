import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const reportTypes = ["Sales", "Expenses", "All Items"] as const;
const timeRanges = ["daily", "weekly", "monthly", "custom"] as const;

type ReportType = (typeof reportTypes)[number];
type TimeRange = (typeof timeRanges)[number];

const Reports = () => {
  const [reportType, setReportType] = useState<ReportType | "">("");
  const [timeRange, setTimeRange] = useState<TimeRange | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const isElectron = useMemo(
    () => typeof window !== "undefined" && Boolean(window.electronAPI),
    []
  );

  const isCustom = timeRange === "custom";
  const isValid = Boolean(reportType) && Boolean(timeRange) && (!isCustom || (startDate && endDate));

  const formatDate = (value: string) => value.split("T")[0];

  const handleGenerate = async () => {
    if (!isValid) return;
    if (!isElectron) {
      toast.error("Run the desktop app to generate SQLite reports.");
      return;
    }

    setIsGenerating(true);
    try {
      const generatedDate = new Date().toISOString().split("T")[0];
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("The Salon Detail", 14, 18);
      doc.setFontSize(11);
      doc.text(`Report Type: ${reportType}`, 14, 26);
      doc.text(`Time Range: ${timeRange}`, 14, 32);
      if (isCustom) {
        doc.text(`From ${startDate} to ${endDate}`, 14, 38);
      }

      type ReportRow = { date: string; item_name: string; category: string; amount: number };
      const renderTable = (title: string, rows: ReportRow[]) => {
        const tableBody = rows.map((row) => [
          formatDate(row.date),
          row.item_name,
          row.category,
          Number(row.amount || 0).toFixed(2)
        ]);
        const grandTotal = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
        const startY = (doc as any).lastAutoTable?.finalY
          ? (doc as any).lastAutoTable.finalY + 12
          : isCustom
            ? 44
            : 38;

        doc.setFontSize(12);
        doc.text(title, 14, startY);

        autoTable(doc, {
          startY: startY + 4,
          head: [["Date", "Item Name", "Category", "Amount"]],
          body: tableBody,
          foot: [["", "", "Grand Total", grandTotal.toFixed(2)]],
          styles: { halign: "left" },
          footStyles: { fontStyle: "bold" }
        });
      };

      let salesRows: ReportRow[] = [];
      let expenseRows: ReportRow[] = [];

      if (reportType === "All Items") {
        [salesRows, expenseRows] = await Promise.all([
          window.electronAPI.getReportData({
            type: "Sales",
            range: timeRange as TimeRange,
            startDate: startDate || null,
            endDate: endDate || null
          }),
          window.electronAPI.getReportData({
            type: "Expenses",
            range: timeRange as TimeRange,
            startDate: startDate || null,
            endDate: endDate || null
          })
        ]);

        renderTable("Sales", salesRows);
        renderTable("Expenses", expenseRows);
      } else {
        salesRows = await window.electronAPI.getReportData({
          type: reportType as ReportType,
          range: timeRange as TimeRange,
          startDate: startDate || null,
          endDate: endDate || null
        });
        renderTable(reportType, salesRows);
      }

      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(10);
      doc.text(`Generated: ${generatedDate}`, 14, pageHeight - 10);

      doc.save(`Saloon_Report_${generatedDate}.pdf`);
      toast.success("Report saved successfully!");
    } catch (error) {
      console.error("Report generation failed", error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-display font-bold">Reports Center</h1>
        <p className="text-muted-foreground mt-1">Generate printable summaries from your SQLite data.</p>
      </div>

      <div className="rounded-xl bg-card border border-border p-6 shadow-card space-y-6 max-w-3xl">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Report Type</label>
            <Select value={reportType} onValueChange={(value) => setReportType(value as ReportType)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose report type" />
              </SelectTrigger>
              <SelectContent>
                {reportTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Time Range</label>
            <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="custom">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {isCustom && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Start Date</label>
              <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">End Date</label>
              <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button
            type="button"
            className="gradient-gold text-primary-foreground font-semibold"
            onClick={handleGenerate}
            disabled={!isValid || isGenerating}
          >
            {isGenerating ? "Generating..." : "Generate & Download"}
          </Button>
          {!isValid && (
            <span className="text-xs text-muted-foreground">
              Select a report type and time range to enable download.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;
