import { createContext, useContext, ReactNode, useEffect, useMemo, useState } from "react";
import { Item, Sale, Expense, StaffUser } from "@/types/models";

// Seed data
const seedItems: Item[] = [
  { id: "1", name: "Shampoo (500ml)", quantity: 24, costPrice: 8, sellingPrice: 15, entryDate: "2026-02-01" },
  { id: "2", name: "Hair Gel", quantity: 18, costPrice: 5, sellingPrice: 12, entryDate: "2026-02-01" },
  { id: "3", name: "Beard Oil", quantity: 30, costPrice: 10, sellingPrice: 22, entryDate: "2026-02-02" },
  { id: "4", name: "Hair Clipper Blade", quantity: 10, costPrice: 15, sellingPrice: 30, entryDate: "2026-02-03" },
  { id: "5", name: "Conditioner", quantity: 20, costPrice: 7, sellingPrice: 14, entryDate: "2026-02-04" },
];

const seedSales: Sale[] = [
  { id: "1", buyerName: "James K.", itemId: "1", itemName: "Shampoo (500ml)", quantitySold: 2, totalAmount: 30, saleDate: "2026-02-05" },
  { id: "2", buyerName: "Mary A.", itemId: "3", itemName: "Beard Oil", quantitySold: 1, totalAmount: 22, saleDate: "2026-02-06" },
  { id: "3", buyerName: "John D.", itemId: "2", itemName: "Hair Gel", quantitySold: 3, totalAmount: 36, saleDate: "2026-02-07" },
  { id: "4", buyerName: "Sarah L.", itemId: "5", itemName: "Conditioner", quantitySold: 2, totalAmount: 28, saleDate: "2026-02-08" },
  { id: "5", buyerName: "Mike R.", itemId: "4", itemName: "Hair Clipper Blade", quantitySold: 1, totalAmount: 30, saleDate: "2026-02-09" },
];

const seedExpenses: Expense[] = [
  { id: "1", category: "Food", amount: 25, staffName: "David", staffPicture: "", description: "Lunch for staff", date: "2026-02-07" },
  { id: "2", category: "Taxi", amount: 15, staffName: "Grace", staffPicture: "", description: "Transport to supplier", date: "2026-02-08" },
  { id: "3", category: "Maintenance", amount: 80, staffName: "Admin", staffPicture: "", description: "AC repair", date: "2026-02-09" },
  { id: "4", category: "Utilities", amount: 120, staffName: "Admin", staffPicture: "", description: "Electricity bill", date: "2026-02-06" },
];

const seedUsers: StaffUser[] = [
  { id: "1", fullName: "David Osei", email: "david@salon.com", phone: "+92 346 272 6255", role: "Manager", pictureUrl: "", joinDate: "2025-06-01" },
  { id: "2", fullName: "Grace Mensah", email: "grace@salon.com", phone: "+92 301 555 0198", role: "Staff", pictureUrl: "", joinDate: "2025-08-15" },
  { id: "3", fullName: "Admin User", email: "admin@salon.com", phone: "+92 333 700 4401", role: "Admin", pictureUrl: "", joinDate: "2025-01-01" },
];

interface DataContextType {
  items: Item[];
  sales: Sale[];
  expenses: Expense[];
  users: StaffUser[];
  addItem: (item: Omit<Item, "id">) => Promise<void>;
  addSale: (sale: Omit<Sale, "id">) => Promise<void>;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  addUser: (user: Omit<StaffUser, "id">) => Promise<void>;
  updateItem: (id: string, item: Partial<Item>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
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
  const [expenses, setExpenses] = useState<Expense[]>(() =>
    isElectron ? [] : readStorage("salon_expenses", seedExpenses)
  );
  const [users, setUsers] = useState<StaffUser[]>(() =>
    isElectron ? [] : readStorage("salon_users", seedUsers)
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
    writeStorage("salon_expenses", expenses);
  }, [isElectron, expenses]);

  useEffect(() => {
    if (isElectron) return;
    writeStorage("salon_users", users);
  }, [isElectron, users]);

  const normalizeDate = (value?: string | null) => {
    if (!value) return new Date().toISOString().split("T")[0];
    return value.split("T")[0];
  };

  const mapItemRow = (row: any): Item => ({
    id: String(row.id),
    name: row.name,
    quantity: Number(row.current_stock_amount || 0),
    costPrice: Number(row.cost_price ?? row.unit_price ?? 0),
    sellingPrice: Number(row.selling_price ?? row.unit_price ?? 0),
    entryDate: normalizeDate(row.entry_date)
  });

  const mapSaleRow = (row: any): Sale => ({
    id: String(row.id),
    buyerName: row.buyer_name,
    itemId: row.item_id ? String(row.item_id) : "",
    itemName: row.item_name,
    quantitySold: Number(row.quantity || 0),
    totalAmount: Number(row.total_amount || 0),
    saleDate: normalizeDate(row.date)
  });

  const mapExpenseRow = (row: any): Expense => ({
    id: String(row.id),
    category: row.category,
    amount: Number(row.amount || 0),
    staffName: row.staff_name,
    staffPicture: row.staff_pic_url || "",
    description: row.description || "",
    date: normalizeDate(row.date)
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

    const existingItems = await window.electronAPI.getItems();
    if (existingItems.length > 0) {
      markMigrationComplete();
      return;
    }

    const storedItems = readStorage<Item[]>("salon_items", []);
    const storedSales = readStorage<Sale[]>("salon_sales", []);
    const storedExpenses = readStorage<Expense[]>("salon_expenses", []);
    const storedUsers = readStorage<StaffUser[]>("salon_users", []);

    const itemNameToLocal = new Map(storedItems.map((item) => [item.name, item]));

    for (const item of storedItems) {
      await window.electronAPI.addItem({
        name: item.name,
        current_stock_amount: item.quantity,
        cost_price: item.costPrice,
        selling_price: item.sellingPrice,
        unit_price: item.sellingPrice,
        entry_date: item.entryDate
      });
    }

    const dbItems = await window.electronAPI.getItems();
    const itemNameToId = new Map(dbItems.map((row) => [row.name, row.id]));

    for (const sale of storedSales) {
      const localItem = itemNameToLocal.get(sale.itemName);
      const itemId = itemNameToId.get(sale.itemName) ?? null;
      await window.electronAPI.recordSale({
        buyer_name: sale.buyerName,
        item_name: sale.itemName,
        item_id: itemId,
        quantity: sale.quantitySold,
        unit_price: localItem?.sellingPrice ?? 0,
        total_amount: sale.totalAmount,
        date: sale.saleDate
      });
    }

    for (const expense of storedExpenses) {
      await window.electronAPI.addExpense({
        category: expense.category,
        amount: expense.amount,
        staff_name: expense.staffName,
        staff_pic_url: expense.staffPicture || null,
        description: expense.description || null,
        date: expense.date
      });
    }

    for (const user of storedUsers) {
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
      await Promise.all([refreshItems(), refreshSales(), refreshExpenses(), refreshUsers()]);
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
      setItems((prev) =>
        prev.map((i) =>
          i.id === sale.itemId
            ? { ...i, quantity: Math.max(0, i.quantity - sale.quantitySold) }
            : i
        )
      );
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
      date: sale.saleDate
    });
    await Promise.all([refreshSales(), refreshItems()]);
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
      date: expense.date
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
        joinDate: user.joinDate
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

  const deleteUser = async (id: string) => {
    if (!isElectron) {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      return;
    }

    await window.electronAPI.deleteUser(Number(id));
    await refreshUsers();
  };

  return (
    <DataContext.Provider
      value={{
        items,
        sales,
        expenses,
        users,
        addItem,
        addSale,
        addExpense,
        addUser,
        updateItem,
        deleteItem,
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
