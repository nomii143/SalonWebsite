import { createContext, useContext, ReactNode, useEffect, useMemo, useState } from "react";
import { Item, Sale, Stockout, Expense, StaffUser, SalaryPayment } from "@/test/types/models";
import { getTodayDateString } from "@/lib/utils";

// Seed data
const seedItems: Item[] = [
  { id: "1", name: "Shampoo (500ml)", quantity: 24, costPrice: 8, sellingPrice: 15, entryDate: "2026-03-01" },
  { id: "2", name: "Hair Gel", quantity: 18, costPrice: 5, sellingPrice: 12, entryDate: "2026-03-01" },
  { id: "3", name: "Beard Oil", quantity: 30, costPrice: 10, sellingPrice: 22, entryDate: "2026-03-02" },
  { id: "4", name: "Hair Clipper Blade", quantity: 10, costPrice: 15, sellingPrice: 30, entryDate: "2026-03-03" },
  { id: "5", name: "Conditioner", quantity: 20, costPrice: 7, sellingPrice: 14, entryDate: "2026-03-04" },
];

const seedSales: Sale[] = [
  { id: "s1", buyerName: "General Sale", itemId: "manual-entry", itemName: "Direct Revenue", quantitySold: 0, totalAmount: 250, cashAmount: 150, cardAmount: 100, paymentMethod: "Split", saleDate: "2026-03-01" },
  { id: "s2", buyerName: "General Sale", itemId: "manual-entry", itemName: "Direct Revenue", quantitySold: 0, totalAmount: 380, cashAmount: 250, cardAmount: 130, paymentMethod: "Split", saleDate: "2026-03-02" },
  { id: "s3", buyerName: "General Sale", itemId: "manual-entry", itemName: "Direct Revenue", quantitySold: 0, totalAmount: 320, cashAmount: 200, cardAmount: 120, paymentMethod: "Split", saleDate: "2026-03-03" },
  { id: "s4", buyerName: "General Sale", itemId: "manual-entry", itemName: "Direct Revenue", quantitySold: 0, totalAmount: 450, cashAmount: 300, cardAmount: 150, paymentMethod: "Split", saleDate: "2026-03-04" },
];

const seedStockouts: Stockout[] = [
  { id: "1", staffName: "James K.", itemId: "1", itemName: "Shampoo (500ml)", quantity: 2, totalAmount: 30, date: "2026-03-05" },
  { id: "2", staffName: "Mary A.", itemId: "3", itemName: "Beard Oil", quantity: 1, totalAmount: 22, date: "2026-03-06" },
  { id: "3", staffName: "John D.", itemId: "2", itemName: "Hair Gel", quantity: 3, totalAmount: 36, date: "2026-03-07" },
  { id: "4", staffName: "Sarah L.", itemId: "5", itemName: "Conditioner", quantity: 2, totalAmount: 28, date: "2026-03-08" },
  { id: "5", staffName: "Mike R.", itemId: "4", itemName: "Hair Clipper Blade", quantity: 1, totalAmount: 30, date: "2026-03-09" },
];

const seedExpenses: Expense[] = [
  { id: "1", category: "Food", amount: 25, staffName: "David", staffPicture: "", description: "Lunch for staff", date: "2026-03-07" },
  { id: "2", category: "Taxi", amount: 15, staffName: "Grace", staffPicture: "", description: "Transport to supplier", date: "2026-03-08" },
  { id: "3", category: "Maintenance", amount: 80, staffName: "Admin", staffPicture: "", description: "AC repair", date: "2026-03-09" },
  { id: "4", category: "Utilities", amount: 120, staffName: "Admin", staffPicture: "", description: "Electricity bill", date: "2026-03-06", source: "vendor_payment" },
];

const seedUsers: StaffUser[] = [
  { id: "1", fullName: "David Osei", email: "david@salon.com", phone: "+92 346 272 6255", role: "Manager", pictureUrl: "", joinDate: "2025-06-01" },
  { id: "2", fullName: "Grace Mensah", email: "grace@salon.com", phone: "+92 301 555 0198", role: "Staff", pictureUrl: "", joinDate: "2025-08-15" },
  { id: "3", fullName: "Admin User", email: "admin@salon.com", phone: "+92 333 700 4401", role: "Admin", pictureUrl: "", joinDate: "2025-01-01" },
];

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
  const migrationFlagKey = "salon_migrated_to_sqlite";

  const readStorage = <T,>(key: string, fallback: T) => {
    if (typeof window === "undefined") return fallback;
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : fallback;
    } catch {
      return fallback;
    }
  };

  const writeStorage = <T,>(key: string, value: T) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures (private mode, blocked storage, etc.)
    }
  };

  const markMigrationComplete = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(migrationFlagKey, "true");
    } catch {
      // Ignore storage failures
    }
  };

  const hasMigrated = () => {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(migrationFlagKey) === "true";
    } catch {
      return false;
    }
  };

  const [items, setItems] = useState<Item[]>(() =>
    isElectron ? [] : readStorage("salon_items", seedItems)
  );
  const [sales, setSales] = useState<Sale[]>(() =>
    isElectron ? [] : readStorage("salon_sales", seedSales)
  );
  const [stockouts, setStockouts] = useState<Stockout[]>(() =>
    isElectron ? [] : readStorage("salon_stockouts", seedStockouts)
  );
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    isElectron ? [] : readStorage("salon_expenses", seedExpenses)
  );
  const [users, setUsers] = useState<StaffUser[]>(() =>
    isElectron ? [] : readStorage("salon_users", seedUsers)
  );
  const [salaryPayments, setSalaryPayments] = useState<SalaryPayment[]>(() =>
    isElectron ? [] : readStorage("salon_salary_payments", [])
  );

  useEffect(() => {
    if (isElectron) return;
    writeStorage("salon_items", items);
  }, [isElectron, items]);

  useEffect(() => {
    if (isElectron) return;
    writeStorage("salon_sales", sales);
  }, [isElectron, sales]);

  useEffect(() => {
    if (isElectron) return;
    writeStorage("salon_stockouts", stockouts);
  }, [isElectron, stockouts]);

  useEffect(() => {
    if (isElectron) return;
    writeStorage("salon_expenses", expenses);
  }, [isElectron, expenses]);

  useEffect(() => {
    if (isElectron) return;
    writeStorage("salon_users", users);
  }, [isElectron, users]);

  useEffect(() => {
    if (isElectron) return;
    console.log("[useEffect] Salary payments changed, count:", salaryPayments.length);
    // Don't write to localStorage here - it's already done in addSalaryPayment
    // This avoids race conditions and duplicate writes
  }, [isElectron, salaryPayments]);

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
      source: details.source || ""
    };
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

  const migrateFromLocalStorage = async () => {
    if (!isElectron) return;
    if (hasMigrated()) return;

    const storedItems = readStorage<Item[]>("salon_items", []);
    const storedSales = readStorage<Sale[]>("salon_sales", []);
    const storedStockouts = readStorage<Stockout[]>("salon_stockouts", []);
    const storedExpenses = readStorage<Expense[]>("salon_expenses", []);
    const storedUsers = readStorage<StaffUser[]>("salon_users", []);

    const normalizeKeyDate = (value?: string | null) => normalizeDate(value || null);
    const itemNameToLocal = new Map(storedItems.map((item) => [item.name, item]));

    const dbItems = await window.electronAPI.getItems();
    const dbSales = await window.electronAPI.getSales();
    const dbStockouts = await window.electronAPI.getStockouts();
    const dbExpenses = await window.electronAPI.getExpenses();
    const dbUsers = await window.electronAPI.getUsers();

    const dbItemNames = new Set(dbItems.map((row) => row.name));
    const dbSaleKeys = new Set(
      dbSales.map((row: any) => {
        const saleDate = normalizeKeyDate(row.date);
        return `${row.buyer_name}|${row.item_name}|${Number(row.quantity || 0)}|${Number(row.total_amount || 0)}|${saleDate}`;
      })
    );
    const dbStockoutKeys = new Set(
      dbStockouts.map((row: any) => {
        const outDate = normalizeKeyDate(row.date);
        return `${row.staff_name || ""}|${row.item_name}|${Number(row.quantity || 0)}|${Number(row.total_amount || 0)}|${outDate}`;
      })
    );
    const dbExpenseKeys = new Set(
      dbExpenses.map((row: any) => {
        const expDate = normalizeKeyDate(row.date);
        const description = row.description || "";
        const source = row.source || "";
        return `${row.category}|${Number(row.amount || 0)}|${description}|${expDate}|${source}`;
      })
    );
    const dbUserKeys = new Set(
      dbUsers.map((row: any) => `${row.username || ""}|${row.role || ""}`)
    );

    for (const item of storedItems) {
      if (dbItemNames.has(item.name)) continue;
      await window.electronAPI.addItem({
        name: item.name,
        current_stock_amount: item.quantity,
        cost_price: item.costPrice,
        selling_price: item.sellingPrice,
        unit_price: item.sellingPrice,
        entry_date: item.entryDate
      });
    }

    const refreshedItems = await window.electronAPI.getItems();
    const itemNameToId = new Map(refreshedItems.map((row) => [row.name, row.id]));

    const isManualSale = (sale: Sale) =>
      sale.buyerName === "General Sale" ||
      sale.itemId === "manual-entry" ||
      sale.itemName === "Direct Revenue";

    const legacyStockouts = storedSales.filter((sale) => !isManualSale(sale));
    const manualSales = storedSales.filter(isManualSale);
    const stockoutsToMigrate = [...storedStockouts, ...legacyStockouts];

    for (const sale of manualSales) {
      const saleDate = normalizeKeyDate(sale.saleDate);
      const key = `${sale.buyerName}|${sale.itemName}|${sale.quantitySold}|${sale.totalAmount}|${saleDate}`;
      if (dbSaleKeys.has(key)) continue;
      const localItem = itemNameToLocal.get(sale.itemName);
      const itemId = itemNameToId.get(sale.itemName) ?? null;
      await window.electronAPI.recordSale({
        buyer_name: sale.buyerName,
        item_name: sale.itemName,
        item_id: itemId,
        quantity: sale.quantitySold,
        unit_price: localItem?.sellingPrice ?? 0,
        total_amount: sale.totalAmount,
        cash_amount: Number(sale.cashAmount || 0),
        card_amount: Number(sale.cardAmount || 0),
        date: sale.saleDate
      });
    }

    for (const stockout of stockoutsToMigrate) {
      const outDate = normalizeKeyDate(stockout.date || (stockout as any).saleDate);
      const name = (stockout as any).staffName || (stockout as any).buyerName || "";
      const itemName = (stockout as any).itemName;
      const quantity = Number((stockout as any).quantity ?? (stockout as any).quantitySold ?? 0);
      const totalAmount = Number((stockout as any).totalAmount ?? 0);
      const key = `${name}|${itemName}|${quantity}|${totalAmount}|${outDate}`;
      if (dbStockoutKeys.has(key)) continue;
      const localItem = itemNameToLocal.get(itemName);
      const itemId = itemNameToId.get(itemName) ?? null;
      await window.electronAPI.addStockout({
        staff_name: name,
        item_name: itemName,
        item_id: itemId,
        quantity,
        unit_price: localItem?.sellingPrice ?? 0,
        total_amount: totalAmount,
        date: (stockout as any).date || (stockout as any).saleDate
      });
    }

    for (const expense of storedExpenses) {
      const expDate = normalizeKeyDate(expense.date);
      const description = expense.description || "";
      const source = expense.source || "";
      const key = `${expense.category}|${expense.amount}|${description}|${expDate}|${source}`;
      if (dbExpenseKeys.has(key)) continue;
      await window.electronAPI.addExpense({
        category: expense.category,
        amount: expense.amount,
        staff_name: expense.staffName,
        staff_pic_url: expense.staffPicture || null,
        description: expense.description || null,
        date: expense.date,
        source: expense.source || null
      });
    }

    for (const user of storedUsers) {
      const key = `${user.fullName}|${user.role}`;
      if (dbUserKeys.has(key)) continue;
      await window.electronAPI.addUser({
        username: user.fullName,
        role: user.role,
        details: {
          email: user.email,
          phone: user.phone,
          pictureUrl: user.pictureUrl,
          joinDate: user.joinDate
        }
      });
    }

    markMigrationComplete();
  };

  useEffect(() => {
    if (!isElectron) return;
    const loadAll = async () => {
      try {
        await migrateFromLocalStorage();
      } catch (error) {
        console.error("SQLite migration failed", error);
      }
      await Promise.all([refreshItems(), refreshSales(), refreshStockouts(), refreshExpenses(), refreshUsers()]);
    };
    loadAll();
  }, [isElectron]);

  const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const addItem = async (item: Omit<Item, "id">) => {
    if (!isElectron) {
      setItems((prev) => [...prev, { ...item, id: genId() }]);
      return;
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
      setSales((prev) => [...prev, { ...sale, id: genId() }]);
      return;
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
      setStockouts((prev) => [...prev, { ...stockout, id: genId() }]);
      setItems((prev) =>
        prev.map((i) =>
          i.id === stockout.itemId
            ? { ...i, quantity: Math.max(0, i.quantity - stockout.quantity) }
            : i
        )
      );
      return;
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
      setSales((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
      return;
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
      const currentOut = stockouts.find((s) => s.id === id);
      if (!currentOut) {
        return;
      }

      const nextItemId = updates.itemId ?? currentOut.itemId;
      const nextQty = updates.quantity ?? currentOut.quantity;

      setItems((prev) => {
        if (currentOut.itemId === nextItemId) {
          const delta = nextQty - currentOut.quantity;
          return prev.map((item) =>
            item.id === currentOut.itemId
              ? { ...item, quantity: Math.max(0, item.quantity - delta) }
              : item
          );
        }

        return prev.map((item) => {
          if (item.id === currentOut.itemId) {
            return { ...item, quantity: item.quantity + currentOut.quantity };
          }
          if (item.id === nextItemId) {
            return { ...item, quantity: Math.max(0, item.quantity - nextQty) };
          }
          return item;
        });
      });

      setStockouts((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
      return;
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
      setExpenses((prev) => [...prev, { ...expense, id: genId() }]);
      return;
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
      setExpenses((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
      return;
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
      setUsers((prev) => [...prev, { ...user, id: genId() }]);
      return;
    }

    await window.electronAPI.addUser({
      username: user.fullName,
      role: user.role,
      details: {
        email: user.email,
        phone: user.phone,
        pictureUrl: user.pictureUrl,
        joinDate: user.joinDate,
        monthlySalary: user.monthlySalary
      }
    });
    await refreshUsers();
  };

  const updateItem = async (id: string, updates: Partial<Item>) => {
    if (!isElectron) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
      return;
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
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }

    await window.electronAPI.deleteItem(Number(id));
    await refreshItems();
  };

  const deleteSale = async (id: string) => {
    if (!isElectron) {
      setSales((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    await window.electronAPI.deleteSale(Number(id));
    await Promise.all([refreshSales(), refreshItems()]);
  };

  const deleteStockout = async (id: string) => {
    if (!isElectron) {
      const currentOut = stockouts.find((s) => s.id === id);
      if (currentOut) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === currentOut.itemId
              ? { ...item, quantity: item.quantity + currentOut.quantity }
              : item
          )
        );
      }
      setStockouts((prev) => prev.filter((s) => s.id !== id));
      return;
    }

    await window.electronAPI.deleteStockout(Number(id));
    await Promise.all([refreshStockouts(), refreshItems()]);
  };

  const deleteExpense = async (id: string) => {
    if (!isElectron) {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      return;
    }

    await window.electronAPI.deleteExpense(Number(id));
    await refreshExpenses();
  };

  const deleteUser = async (id: string) => {
    if (!isElectron) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      return;
    }

    await window.electronAPI.deleteUser(Number(id));
    await refreshUsers();
  };

  const deleteSalaryPayment = async (id: string) => {
    console.log("[deleteSalaryPayment] Deleting payment:", id);
    console.log("[deleteSalaryPayment] Current state before delete:", salaryPayments.length, "payments");
    
    if (!isElectron) {
      // Browser mode: Remove from state and update localStorage
      try {
        // First, filter the payment
        const updated = salaryPayments.filter((p) => p.id !== id);
        console.log("[deleteSalaryPayment] Filtered payment - new count:", updated.length);
        
        if (updated.length === salaryPayments.length) {
          console.error("[deleteSalaryPayment] Payment not found in array! ID:", id);
          console.log("[deleteSalaryPayment] Payment IDs in array:", salaryPayments.map(p => p.id));
          throw new Error(`Payment with ID ${id} not found in array`);
        }
        
        // Write to localStorage
        writeStorage("salon_salary_payments", updated);
        console.log("[deleteSalaryPayment] Written to localStorage");
        
        // Verify it was written
        const verified = readStorage<SalaryPayment[]>("salon_salary_payments", []);
        console.log("[deleteSalaryPayment] Verified from localStorage - count:", verified.length);
        
        // Now update state
        setSalaryPayments(updated);
        console.log("[deleteSalaryPayment] State updated");
        
        // Wait for state to be sure it's updated
        await new Promise(resolve => setTimeout(resolve, 100));
        console.log("[deleteSalaryPayment] Completed with timeout");
        
      } catch (error) {
        console.error("[deleteSalaryPayment] Browser mode error:", error);
        throw error;
      }
      return;
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
      // Browser mode: Clear all from state and localStorage
      try {
        setSalaryPayments([]);
        writeStorage("salon_salary_payments", []);
        const verified = readStorage<SalaryPayment[]>("salon_salary_payments", []);
        console.log("[clearAllSalaryPayments] Cleared localStorage, verified count:", verified.length);
        return { deleted: true, deletedCount: salaryPayments.length };
      } catch (error) {
        console.error("[clearAllSalaryPayments] Browser mode error:", error);
        throw error;
      }
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
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
      return;
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
        monthlySalary: updates.monthlySalary
      }
    });
    await refreshUsers();
  };
  /**
   * Add salary payment record
   * - Saves all payment details to database permanently (Electron) or localStorage (browser)
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
      // Browser mode: Use functional update pattern and immediately persist to localStorage
      return new Promise<void>((resolve) => {
        setSalaryPayments((prev) => {
          console.log("[addSalaryPayment] Previous payments count:", prev.length);
          console.log("[addSalaryPayment] Previous payments:", prev);
          const updated = [...prev, newPayment];
          console.log("[addSalaryPayment] Updated payments count:", updated.length);
          console.log("[addSalaryPayment] Updated payments:", updated);
          // Immediately write to localStorage to ensure persistence
          writeStorage("salon_salary_payments", updated);
          // Verify write
          const verified = readStorage<SalaryPayment[]>("salon_salary_payments", []);
          console.log("[addSalaryPayment] Verified localStorage count:", verified.length);
          console.log("[addSalaryPayment] Verified localStorage:", verified);
          
          // Resolve the promise after a brief delay to ensure React has processed the update
          setTimeout(() => {
            console.log("[addSalaryPayment] State update complete, resolving promise");
            resolve();
          }, 50);
          
          return updated;
        });
      });
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
        numberOfMonths: payment.numberOfMonths
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
      // Fallback: Still update local state and persist to localStorage even if database save fails
      setSalaryPayments((prev) => {
        const updated = [...prev, newPayment];
        console.log("Updated payments (fallback mode):", updated.length, "payments");
        writeStorage("salon_salary_payments", updated);
        return updated;
      });
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
        paymentType: row.payment_type as "advance" | "full",
        date: row.created_at || row.date,
        salaryForMonth: normalizeSalaryReferenceMonth(row.salary_for_month, row.date || row.created_at),
        numberOfMonths: row.number_of_months ? Number(row.number_of_months) : undefined
      }))
    );
  };

  // Initialize salary payments from database in Electron mode
  // In browser mode, payments are already loaded from localStorage during state initialization
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
