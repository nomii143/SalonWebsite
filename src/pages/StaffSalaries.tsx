import { useState } from "react";
import { useNavigate } from "react-router-dom"; 
import { useData } from "@/context/DataContext";
import { StaffUser } from "@/test/types/models";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Banknote, UserPlus, MoreVertical, User, History, Wallet, Users, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";

export default function StaffListPage() {
  const navigate = useNavigate();
  const { users: staff, deleteUser: deleteStaff, updateUser: updateStaff, salaryPayments, getStaffRunningBalance, clearAllSalaryPayments } = useData();
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);

  const handleClearHistory = async () => {
    try {
      await clearAllSalaryPayments();
      toast.success("Payment history cleared");
    } catch (error) {
      toast.error("Failed to clear payment history");
    }
  };

  console.log("[StaffSalaries] Page render - Total payments:", salaryPayments.length);
  console.log("[StaffSalaries] All payments:", salaryPayments);
  console.log("[StaffSalaries] Payment IDs:", salaryPayments.map(p => p.id));
  console.log("[StaffSalaries] Payment breakdown:", salaryPayments.map(p => ({
    id: p.id,
    staff: p.staffName,
    type: p.paymentType,
    amount: p.amount,
    date: p.date
  })));

  const handleUpdateStaff = () => {
    updateStaff(editingStaff.id, editingStaff);
    toast.success("Staff details updated");
    setEditingStaff(null);
  };

  const getReferenceDateFromPayment = (payment: (typeof salaryPayments)[number]) => {
    if (payment.salaryForMonth && /^\d{4}-\d{2}$/.test(payment.salaryForMonth)) {
      const [year, month] = payment.salaryForMonth.split('-').map(Number);
      return new Date(year, month - 1, 1);
    }
    return new Date(payment.date);
  };

  const getReferenceLabel = (payment: (typeof salaryPayments)[number]) => {
    const referenceStart = getReferenceDateFromPayment(payment);
    if (payment.paymentType === 'advance' && payment.numberOfMonths && payment.numberOfMonths > 1) {
      const months: string[] = [];
      for (let i = 0; i < payment.numberOfMonths; i++) {
        const monthDate = new Date(referenceStart);
        monthDate.setMonth(monthDate.getMonth() + i);
        months.push(monthDate.toLocaleDateString('en-US', { month: 'long' }));
      }
      return `Advance for ${months.join(', ')}`;
    }

    return `For ${referenceStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
  };

  // Filter to show only last 30 days on the UI (but all data is persisted in localStorage)
  const last30DaysPayments = salaryPayments.filter((payment) => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29); // Today counts as day 1, so -29 for 30 days total
    const paymentDate = new Date(payment.date);
    return paymentDate >= thirtyDaysAgo;
  }).sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate statistics
  const totalStaff = staff.length;
  const totalMonthlySalary = staff.reduce((sum, s) => sum + (s.monthlySalary || 0), 0);
  const totalPayments = salaryPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalStaffPaid = new Set(salaryPayments.map(p => p.staffId)).size;
  const currentBalances = new Map(staff.map((s) => [s.id, getStaffRunningBalance(s.id)]));

  return (
    <div className="space-y-8 p-4 bg-background min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Staff Salaries
            </h1>
            <p className="text-muted-foreground mt-1">Manage your team's salary payments</p>
          </div>
          <div className="flex gap-3">
            <Button 
              onClick={() => navigate("/pay-salary")}
              className="gradient-gold text-primary-foreground px-6 py-2 rounded-lg flex gap-2"
            >
              <Banknote className="w-4 h-4" /> Pay Salary
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
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Staff</p>
                <p className="text-2xl font-bold text-primary mt-1">{totalStaff}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <User className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monthly Budget</p>
                <p className="text-2xl font-bold text-primary mt-1">Rs {totalMonthlySalary.toLocaleString()}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-4 shadow-sm border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total Staff Paid</p>
                <p className="text-2xl font-bold text-primary mt-1">{totalStaffPaid}</p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
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
                  <TableHead className="font-semibold">Monthly Salary</TableHead>
                  <TableHead className="font-semibold">Balance Status</TableHead>
                  <TableHead className="text-right font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id} className="hover:bg-primary/5 transition-colors">
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
                        const balance = currentBalances.get(s.id) || 0;
                        const hasAdvance = balance < 0;
                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold ${hasAdvance ? "bg-red-100 text-red-700" : "bg-green-100 text-green-800"}`}>
                            {hasAdvance ? "Advance Taken" : "Salary Pending"}: Rs {Math.abs(balance).toLocaleString()}
                          </span>
                        );
                      })()}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="hover:bg-primary/10">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingStaff(s)} className="cursor-pointer">
                            Update Details
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive cursor-pointer" onClick={() => deleteStaff(s.id)}>
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
                  <h2 className="text-lg font-bold text-foreground">Payment History</h2>
                  <p className="text-xs text-muted-foreground mt-1">Showing last 30 days </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="bg-amber-100 backdrop-blur-sm px-3 py-1 rounded-full text-amber-700 text-xs font-semibold">
                  {last30DaysPayments.length} Recent
                </span>
               
              </div>
            </div>
          </div>
          
          <div className="p-4">
            {last30DaysPayments.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground font-medium">No recent payments (last 30 days)</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {salaryPayments.length > 0 
                    ? `${salaryPayments.length} payment(s) exist in history but are older than 30 days`
                    : 'Start by making salary payments to your staff'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {last30DaysPayments.map((payment) => {
                  const paymentDate = new Date(payment.date);
                  const runningBalance = getStaffRunningBalance(payment.staffId, paymentDate);

                  return (
                    <div
                      key={payment.id}
                      className="p-4 rounded-lg border border-amber-200 bg-white hover:bg-amber-50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className="flex-shrink-0 mt-0.5">
                            {payment.paymentType === 'advance' ? (
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
                              {payment.paymentType === 'advance' ? 'Advance Payment' : 'Salary Payment'}
                              {` • ${getReferenceLabel(payment)}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {paymentDate.toLocaleString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit'
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-sm text-amber-700">Rs {payment.amount.toLocaleString()}</p>
                          <p className="text-[11px] text-muted-foreground mt-1">
                            Balance: Rs {Math.abs(runningBalance).toLocaleString()} {runningBalance >= 0 ? '(Salary Pending)' : '(Advance Taken)'}
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
        <Dialog open={!!editingStaff} onOpenChange={(open) => !open && setEditingStaff(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold">Edit Staff Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-5 py-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Full Name</Label>
                <Input 
                  value={editingStaff?.fullName || ""} 
                  onChange={(e) => setEditingStaff({...editingStaff, fullName: e.target.value})} 
                  className="h-12"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Monthly Salary (Rs)</Label>
                <Input 
                  type="number" 
                  value={editingStaff?.monthlySalary || ""} 
                  onChange={(e) => setEditingStaff({...editingStaff!, monthlySalary: Number(e.target.value)})} 
                  className="h-12"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleUpdateStaff} className="gradient-gold w-full py-2 text-sm font-semibold">
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


      </div>
    </div>
  );
}