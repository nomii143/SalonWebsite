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
  saleDate: string;
}

export interface Expense {
  id: string;
  category: "Food" | "Taxi" | "Maintenance" | "Utilities" | "Other";
  amount: number;
  staffName: string;
  staffPicture: string;
  description: string;
  date: string;
}

export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: "Admin" | "Staff" | "Manager";
  pictureUrl: string;
  joinDate: string;
  source?: string;
}
