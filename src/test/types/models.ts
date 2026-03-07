export interface Item {
  id: string;
  name: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  entryDate: string;
}

export interface Sale {
  id: string;
  buyerName: string;
  itemId: string;
  itemName: string;
  quantitySold: number;
  totalAmount: number;
  cashAmount?: number;
  cardAmount?: number;
  paymentMethod?: string;
  saleDate: string;
}

export interface Stockout {
  id: string;
  staffName: string;
  itemId: string;
  itemName: string;
  quantity: number;
  totalAmount: number;
  date: string;
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  staffName: string;
  staffPicture: string;
  description: string;
  date: string;
  source?: string;
}

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "Admin" | "Staff" | "Manager" | "Vendor";
  pictureUrl: string;
  joinDate: string;
  monthlySalary?: number;
  openingBalance?: number;
  source?: string;
}

export interface SalaryPayment {
  id: string;
  staffId: string;
  staffName: string;
  amount: number;
  paymentType: "advance" | "full" | "manual";
  date: string;
  salaryForMonth?: string;
  numberOfMonths?: number;
  notes?: string;
  status?: "Pending" | "Deducted" | "Completed";
  amountPaid?: number;
  advanceDeducted?: number;
  totalSalaryGiven?: number;
  month?: number;
  year?: number;
}
