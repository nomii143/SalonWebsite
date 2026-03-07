import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, UserPlus } from "lucide-react";
import { toast } from "sonner";

export default function AddStaffPage() {
  const navigate = useNavigate();
  const { addUser: addStaff } = useData();
  const [form, setForm] = useState({ fullName: "", monthlySalary: "", joinDate: "" });

  const handleSave = async () => {
    if (!form.fullName || !form.monthlySalary) return toast.error("Missing fields");
    
    const salary = Number(form.monthlySalary);
    if (salary <= 0) return toast.error("Monthly salary must be greater than zero");
    
    try {
      await addStaff({ 
        fullName: form.fullName, 
        monthlySalary: salary, 
        joinDate: form.joinDate,
        email: "",
        phone: "",
        role: "Staff",
        pictureUrl: ""
      });
      toast.success("Staff member added!");
      navigate("/staffsalaries");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save staff in SQLite DB");
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto w-full">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6"><ArrowLeft className="mr-2 h-4 w-4"/> Back</Button>
      <div className="bg-card border p-8 rounded-2xl shadow-xl border-primary/10">
        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><UserPlus className="text-primary"/> Add New Staff </h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input placeholder="Enter Name" onChange={(e) => setForm({...form, fullName: e.target.value})} />
          </div>
          <div className="space-y-2">
            <Label>Monthly Salary (Rs)</Label>
            <Input 
              type="number" 
              min="1" 
              placeholder="000" 
              onChange={(e) => setForm({...form, monthlySalary: e.target.value})} 
            />
          </div>
          <div className="space-y-2">
            <Label>Joining Date</Label>
            <Input
              type="date"
              onFocus={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
              onClick={(e) => (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()}
              onChange={(e) => setForm({...form, joinDate: e.target.value})}
            />
          </div>
          <Button onClick={handleSave} className="w-full gradient-gold py-6 text-lg font-bold">Confirm & Save</Button>
        </div>
      </div>
    </div>
  );
}