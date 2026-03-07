import { createContext, useContext, ReactNode, useEffect, useMemo, useState } from "react";
import { Item, Sale, Stockout, Expense, StaffUser, SalaryPayment } from "@/test/types/models";
import { getTodayDateString } from "@/lib/utils";

interface DataContextType {
  items: Item[];
  sales: Sale[];
  stockouts: Stockout[];
  expenses: Expense[];
  users: StaffUser[];
  salaryPayments: SalaryPayment[];
  addItem: (item: Omit<Item, "id">) => Promise<void>;
  addSale: (sale: Omit<Sale, "id">) => Promise<void>;
  addStockout: (stockout: Omit<Stockout, "id">) => Promise<void>;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  addUser: (user: Omit<StaffUser, "id">) => Promise<void>;
  addSalaryPayment: (payment: Omit<SalaryPayment, "id">) => Promise<void>;
  getStaffRunningBalance: (staffId: string, upTo?: Date) => number;
  getStaffTotalEarned: (staffId: string, upTo?: Date) => number;
  getStaffTotalPaid: (staffId: string, upTo?: Date) => number;
  getReferenceMonthPaidAmount: (staffId: string, referenceMonth: string) => number;
  isReferenceMonthLocked: (staffId: string, referenceMonth: string) => boolean;
  getLoggedSalaryReferenceMonths: (staffId: string) => string[];
  refreshSalaryPayments: () => Promise<void>;
  deleteSalaryPayment: (id: string) => Promise<void>;
  clearAllSalaryPayments: () => Promise<any>;
  updateItem: (id: string, item: Partial<Item>) => Promise<void>;
  updateSale: (id: string, sale: Partial<Sale>) => Promise<void>;
  updateStockout: (id: string, stockout: Partial<Stockout>) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  updateUser: (id: string, user: Partial<StaffUser>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  deleteSale: (id: string) => Promise<void>;
  deleteStockout: (id: string) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: ReactNode }) {
  const isElectron = useMemo(
    () => typeof window !== "undefined" && Boolean(window.electronAPI),
    []
  );
  const [items, setItems] = useState<Item[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [stockouts, setStockouts] = useState<Stockout[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>([]);

  const normalizeDate = (value?: string | null) => {
    if (!value) return getTodayDateString();
    return value.split("T")[0];
  };

  const normalizeSalaryReferenceMonth = (value?: string | null, fallbackDate?: string) => {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
      return value;
    }

    const fallback = fallbackDate ? new Date(fallbackDate) : new Date();
    if (!Number.isNaN(fallback.getTime())) {
      const year = fallback.getFullYear();
      const month = String(fallback.getMonth() + 1).padStart(2, "0");
      return `${year}-${month}`;
    }

    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  };

  const mapItemRow = (row: any): Item => ({
    id: String(row.id),
    name: row.name,
    quantity: Number(row.current_stock_amount || 0),
    costPrice: Number(row.cost_price ?? row.unit_price ?? 0),
    sellingPrice: Number(row.selling_price ?? row.unit_price ?? 0),
    entryDate: normalizeDate(row.entry_date)
  });

  const mapSaleRow = (row: any): Sale => {
    const cashAmount = Number(row.cash_amount ?? row.cashAmount ?? 0);
    const cardAmount = Number(row.card_amount ?? row.cardAmount ?? 0);
    const paymentMethod =
      row.payment_method ??
      (cashAmount > 0 && cardAmount > 0
        ? "Split"
        : cardAmount > 0
          ? "Card"
          : "Cash");

    return {
      id: String(row.id),
      buyerName: row.buyer_name,
      itemId: row.item_id ? String(row.item_id) : "",
      itemName: row.item_name,
      quantitySold: Number(row.quantity || 0),
      totalAmount: Number(row.total_amount || 0),
      cashAmount,
      cardAmount,
      paymentMethod,
      saleDate: normalizeDate(row.date || row.created_at)
    };
  };

  const mapStockoutRow = (row: any): Stockout => ({
    id: String(row.id),
    staffName: row.staff_name || "",
    itemId: row.item_id ? String(row.item_id) : "",
    itemName: row.item_name,
    quantity: Number(row.quantity || 0),
    totalAmount: Number(row.total_amount || 0),
    date: normalizeDate(row.date || row.created_at)
  });

  const mapExpenseRow = (row: any): Expense => ({
    id: String(row.id),
    category: row.category,
    amount: Number(row.amount || 0),
    staffName: row.staff_name,
    staffPicture: row.staff_pic_url || "",
    description: row.description || "",
    date: normalizeDate(row.date),
    source: row.source || ""
  });

  const parseDetails = (value: string | null) => {
    if (!value) return {} as Record<string, string>;
    try {
      return JSON.parse(value) as Record<string, string>;
    } catch {
      return {} as Record<string, string>;
    }
  };

  const mapUserRow = (row: any): StaffUser => {
    const details = parseDetails(row.details ?? null);
    return {
      id: String(row.id),
      fullName: row.username || details.fullName || "",
      email: details.email || "",
      phone: details.phone || "",
      role: row.role || "Staff",
      pictureUrl: details.pictureUrl || "",
      joinDate: details.joinDate || "",
      monthlySalary: details.monthlySalary ? Number(details.monthlySalary) : undefined,
      openingBalance: details.openingBalance ? Number(details.openingBalance) : 0,
      source: details.source || ""
    };
  };

  const getMonthStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), 1);

  const getStaffLedgerStart = (staffMember?: StaffUser, upTo?: Date) => {
    const endDate = upTo ?? new Date();
    if (!staffMember) return getMonthStart(endDate);

    const joinDate = staffMember.joinDate ? new Date(staffMember.joinDate) : null;
    if (joinDate && !Number.isNaN(joinDate.getTime())) {
      return getMonthStart(joinDate);
    }

    const staffPaymentDates = salaryPayments
      .filter((payment) => payment.staffId === staffMember.id)
      .map((payment) => new Date(payment.date))
      .filter((d) => !Number.isNaN(d.getTime()));

    if (staffPaymentDates.length > 0) {
      const firstPayment = new Date(Math.min(...staffPaymentDates.map((d) => d.getTime())));
      return getMonthStart(firstPayment);
    }

    return getMonthStart(endDate);
  };

  const getMonthDiffInclusive = (fromDate: Date, toDate: Date) => {
    const yearDiff = toDate.getFullYear() - fromDate.getFullYear();
    const monthDiff = toDate.getMonth() - fromDate.getMonth();
    return yearDiff * 12 + monthDiff + 1;
  };

  const getStaffTotalEarned = (staffId: string, upTo: Date = new Date()) => {
    const staffMember = users.find((user) => user.id === staffId);
    const monthlySalary = staffMember?.monthlySalary || 0;
    if (!monthlySalary) return staffMember?.openingBalance || 0;

    const endMonth = getMonthStart(upTo);
    const startMonth = getStaffLedgerStart(staffMember, upTo);
    const monthsEarned = Math.max(0, getMonthDiffInclusive(startMonth, endMonth));
    return (staffMember?.openingBalance || 0) + monthsEarned * monthlySalary;
  };

  const getStaffTotalPaid = (staffId: string, upTo: Date = new Date()) => {
    const upToTimestamp = upTo.getTime();
    return salaryPayments
      .filter((payment) => payment.staffId === staffId)
      .filter((payment) => {
        const paymentDate = new Date(payment.date);
        return !Number.isNaN(paymentDate.getTime()) && paymentDate.getTime() <= upToTimestamp;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);
  };

  const getStaffRunningBalance = (staffId: string, upTo: Date = new Date()) => {
    const totalEarned = getStaffTotalEarned(staffId, upTo);
    const totalPaid = getStaffTotalPaid(staffId, upTo);
    return totalEarned - totalPaid;
  };

  const getReferenceMonthPaidAmount = (staffId: string, referenceMonth: string) => {
    const normalizedMonth = normalizeSalaryReferenceMonth(referenceMonth);
    return salaryPayments
      .filter((payment) => payment.staffId === staffId)
      .filter((payment) => normalizeSalaryReferenceMonth(payment.salaryForMonth, payment.date) === normalizedMonth)
      .reduce((sum, payment) => sum + payment.amount, 0);
  };

  const isReferenceMonthLocked = (staffId: string, referenceMonth: string) => {
    const staffMember = users.find((user) => user.id === staffId);
    const monthlySalary = staffMember?.monthlySalary || 0;
    if (!monthlySalary) return false;
    return getReferenceMonthPaidAmount(staffId, referenceMonth) >= monthlySalary;
  };

  const getLoggedSalaryReferenceMonths = (staffId: string) => {
    const logged = new Set(
      salaryPayments
        .filter((payment) => payment.staffId === staffId)
        .filter((payment) => payment.paymentType !== "advance")
        .map((payment) => normalizeSalaryReferenceMonth(payment.salaryForMonth, payment.date))
    );
    return Array.from(logged.values()).sort();
  };

  const refreshItems = async () => {
    if (!isElectron) return;
    const rows = await window.electronAPI.getItems();
    setItems(rows.map(mapItemRow));
  };

  const refreshSales = async () => {
    if (!isElectron) return;
    const rows = await window.electronAPI.getSales();
    setSales(rows.map(mapSaleRow));
  };

  const refreshStockouts = async () => {
    if (!isElectron) return;
    const rows = await window.electronAPI.getStockouts();
    setStockouts(rows.map(mapStockoutRow));
  };

  const refreshExpenses = async () => {
    if (!isElectron) return;
    const rows = await window.electronAPI.getExpenses();
    setExpenses(rows.map(mapExpenseRow));
  };

  const refreshUsers = async () => {
    if (!isElectron) return;
    const rows = await window.electronAPI.getUsers();
    setUsers(rows.map(mapUserRow));
  };

  useEffect(() => {
    const loadAll = async () => {
      if (!isElectron) return;
      await Promise.all([refreshItems(), refreshSales(), refreshStockouts(), refreshExpenses(), refreshUsers()]);
    };
    loadAll();
  }, [isElectron]);

  const addItem = async (item: Omit<Item, "id">) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.addItem({
      name: item.name,
      current_stock_amount: item.quantity,
      cost_price: item.costPrice,
      selling_price: item.sellingPrice,
      unit_price: item.sellingPrice,
      entry_date: item.entryDate
    });
    await refreshItems();
  };

  const addSale = async (sale: Omit<Sale, "id">) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    const item = items.find((i) => i.id === sale.itemId);
    await window.electronAPI.recordSale({
      buyer_name: sale.buyerName,
      item_name: sale.itemName,
      item_id: sale.itemId ? Number(sale.itemId) : null,
      quantity: sale.quantitySold,
      unit_price: item?.sellingPrice || 0,
      total_amount: sale.totalAmount,
      cash_amount: Number(sale.cashAmount || 0),
      card_amount: Number(sale.cardAmount || 0),
      date: sale.saleDate
    });
    await Promise.all([refreshSales(), refreshItems()]);
  };

  const addStockout = async (stockout: Omit<Stockout, "id">) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    const item = items.find((i) => i.id === stockout.itemId);
    await window.electronAPI.addStockout({
      staff_name: stockout.staffName,
      item_name: stockout.itemName,
      item_id: stockout.itemId ? Number(stockout.itemId) : null,
      quantity: stockout.quantity,
      unit_price: item?.sellingPrice || 0,
      total_amount: stockout.totalAmount,
      date: stockout.date
    });
    await Promise.all([refreshStockouts(), refreshItems()]);
  };

  const updateSale = async (id: string, updates: Partial<Sale>) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.updateSale({
      id: Number(id),
      buyer_name: updates.buyerName,
      item_name: updates.itemName,
      item_id: updates.itemId ? Number(updates.itemId) : updates.itemId === "" ? null : undefined,
      quantity: updates.quantitySold,
      unit_price: undefined,
      total_amount: updates.totalAmount,
      cash_amount: updates.cashAmount,
      card_amount: updates.cardAmount,
      date: updates.saleDate
    });
    await Promise.all([refreshSales(), refreshItems()]);
  };

  const updateStockout = async (id: string, updates: Partial<Stockout>) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.updateStockout({
      id: Number(id),
      staff_name: updates.staffName,
      item_name: updates.itemName,
      item_id: updates.itemId ? Number(updates.itemId) : updates.itemId === "" ? null : undefined,
      quantity: updates.quantity,
      unit_price: undefined,
      total_amount: updates.totalAmount,
      date: updates.date
    });
    await Promise.all([refreshStockouts(), refreshItems()]);
  };

  const addExpense = async (expense: Omit<Expense, "id">) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.addExpense({
      category: expense.category,
      amount: expense.amount,
      staff_name: expense.staffName,
      staff_pic_url: expense.staffPicture || null,
      description: expense.description || null,
      date: expense.date,
      source: expense.source || null
    });
    await refreshExpenses();
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.updateExpense({
      id: Number(id),
      category: updates.category,
      amount: updates.amount,
      staff_name: updates.staffName,
      staff_pic_url: updates.staffPicture,
      description: updates.description,
      date: updates.date,
      source: updates.source
    });
    await refreshExpenses();
  };

  const addUser = async (user: Omit<StaffUser, "id">) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.addUser({
      username: user.fullName,
      role: user.role,
      details: {
        email: user.email,
        phone: user.phone,
        pictureUrl: user.pictureUrl,
        joinDate: user.joinDate,
        monthlySalary: user.monthlySalary,
        openingBalance: user.openingBalance || 0
      }
    });
    await refreshUsers();
  };

  const updateItem = async (id: string, updates: Partial<Item>) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    const payload: ElectronItemUpdate = { id: Number(id) };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.quantity !== undefined) payload.current_stock_amount = updates.quantity;
    if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
    if (updates.sellingPrice !== undefined) {
      payload.selling_price = updates.sellingPrice;
      payload.unit_price = updates.sellingPrice;
    }
    if (updates.entryDate !== undefined) payload.entry_date = updates.entryDate;

    await window.electronAPI.updateItem(payload);
    await refreshItems();
  };

  const deleteItem = async (id: string) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.deleteItem(Number(id));
    await refreshItems();
  };

  const deleteSale = async (id: string) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.deleteSale(Number(id));
    await Promise.all([refreshSales(), refreshItems()]);
  };

  const deleteStockout = async (id: string) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.deleteStockout(Number(id));
    await Promise.all([refreshStockouts(), refreshItems()]);
  };

  const deleteExpense = async (id: string) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.deleteExpense(Number(id));
    await refreshExpenses();
  };

  const deleteUser = async (id: string) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.deleteUser(Number(id));
    await refreshUsers();
  };

  const deleteSalaryPayment = async (id: string) => {
    console.log("[deleteSalaryPayment] Deleting payment:", id);
    console.log("[deleteSalaryPayment] Current state before delete:", salaryPayments.length, "payments");
    
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    // Electron mode: Delete from database
    try {
      console.log("[deleteSalaryPayment] Deleting from database with ID:", Number(id));
      await window.electronAPI.deleteSalaryPayment(Number(id));
      console.log("[deleteSalaryPayment] Database deletion successful, refreshing...");
      await refreshSalaryPayments();
      console.log("[deleteSalaryPayment] Refresh complete");
    } catch (error) {
      console.error("[deleteSalaryPayment] Database error:", error);
      throw error;
    }
  };

  const clearAllSalaryPayments = async () => {
    console.log("[clearAllSalaryPayments] Clearing all salary payment records");
    
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    // Electron mode: Clear all from database
    try {
      console.log("[clearAllSalaryPayments] Clearing from database");
      const result = await window.electronAPI.clearAllSalaryPayments();
      console.log("[clearAllSalaryPayments] Database cleared:", result);
      await refreshSalaryPayments();
      return result;
    } catch (error) {
      console.error("[clearAllSalaryPayments] Database error:", error);
      throw error;
    }
  };

  const updateUser = async (id: string, updates: Partial<StaffUser>) => {
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    await window.electronAPI.updateUser({
      id: Number(id),
      username: updates.fullName,
      role: updates.role,
      details: {
        email: updates.email,
        phone: updates.phone,
        pictureUrl: updates.pictureUrl,
        joinDate: updates.joinDate,
        monthlySalary: updates.monthlySalary,
        openingBalance: updates.openingBalance
      }
    });
    await refreshUsers();
  };
  /**
   * Add salary payment record
    * - Saves all payment details to SQLite database permanently (Electron)
   * - Includes: staff ID, name, amount, payment type (full/advance), date, number of months
   * - Database retains all records for auditing and reporting
   * - UI displays last 30 days only (filtered on app load)
   */
  const addSalaryPayment = async (payment: Omit<SalaryPayment, "id">) => {
    const actualPaymentDate = new Date().toISOString();
    const salaryForMonth = normalizeSalaryReferenceMonth(payment.salaryForMonth, payment.date);

    // Generate unique ID using timestamp + random string to prevent collisions
    const uniqueId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const newPayment = {
      ...payment,
      id: uniqueId,
      date: actualPaymentDate,
      salaryForMonth
    };
    console.log("[addSalaryPayment] Adding new payment:", newPayment);
    console.log("[addSalaryPayment] Payment details:", {
      staffId: payment.staffId,
      staffName: payment.staffName,
      amount: payment.amount,
      paymentType: payment.paymentType,
      date: actualPaymentDate,
      salaryForMonth,
      id: uniqueId
    });
    
    if (!isElectron) {
      throw new Error("SQLite DB save is available only in Electron desktop app.");
    }

    // Electron mode: Save to database and update local state
    try {
      await window.electronAPI.addSalaryPayment({
        staffId: payment.staffId,
        staffName: payment.staffName,
        amount: payment.amount,
        paymentType: payment.paymentType,
        date: actualPaymentDate,
        salaryForMonth,
        numberOfMonths: payment.numberOfMonths,
        notes: payment.notes,
        status: payment.status,
        amountPaid: payment.amountPaid,
        advanceDeducted: payment.advanceDeducted,
        totalSalaryGiven: payment.totalSalaryGiven,
        month: payment.month,
        year: payment.year
      });
      console.log("Saved to database successfully");
      // Also update local state
      setSalaryPayments((prev) => {
        const updated = [...prev, newPayment];
        console.log("Updated payments (electron mode):", updated.length, "payments");
        return updated;
      });
    } catch (error) {
      console.error("Failed to save salary payment to database:", error);
      throw error;
    }
  };

  /**
   * Refresh salary payments from database
   * - Loads ALL payment records from database (no date filtering)
   * - Records are filtered to last 30 days in the useEffect below
   * - This ensures database keeps complete history while UI shows recent data
   */
  const refreshSalaryPayments = async () => {
    if (!isElectron) return;
    const rows = await window.electronAPI.listSalaryPayments();
    setSalaryPayments(
      rows.map((row: any) => ({
        id: String(row.id),
        staffId: String(row.staff_id),
        staffName: row.staff_name,
        amount: Number(row.amount),
        paymentType: row.payment_type as "advance" | "full" | "manual",
        date: row.created_at || row.date,
        salaryForMonth: normalizeSalaryReferenceMonth(row.salary_for_month, row.date || row.created_at),
        numberOfMonths: row.number_of_months ? Number(row.number_of_months) : undefined,
        notes: row.notes || undefined,
        status: (row.status as "Pending" | "Deducted" | "Completed") || "Pending",
        amountPaid: row.amount_paid ? Number(row.amount_paid) : undefined,
        advanceDeducted: row.advance_deducted ? Number(row.advance_deducted) : undefined,
        totalSalaryGiven: row.total_salary_given ? Number(row.total_salary_given) : undefined,
        month: row.month ? Number(row.month) : undefined,
        year: row.year ? Number(row.year) : undefined
      }))
    );
  };

  // Initialize salary payments from SQLite database in Electron mode
  useEffect(() => {
    const initPayments = async () => {
      if (isElectron) {
        await refreshSalaryPayments();
      }
    };

    initPayments();
  }, []); // Run once on mount

  return (
    <DataContext.Provider
      value={{
        items,
        sales,
        stockouts,
        expenses,
        users,
        salaryPayments,
        addItem,
        addSale,
        addStockout,
        addExpense,
        addUser,
        addSalaryPayment,
        getStaffRunningBalance,
        getStaffTotalEarned,
        getStaffTotalPaid,
        getReferenceMonthPaidAmount,
        isReferenceMonthLocked,
        getLoggedSalaryReferenceMonths,
        refreshSalaryPayments,
        deleteSalaryPayment,
        clearAllSalaryPayments,
        updateItem,
        updateSale,
        updateStockout,
        updateExpense,
        updateUser,
        deleteItem,
        deleteSale,
        deleteStockout,
        deleteExpense,
        deleteUser
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
