import { useEffect, useState } from "react";

interface ItemInput {
  name: string;
  current_stock_amount: number;
  unit_price: number;
}

interface ItemRow extends ItemInput {
  id: number;
  entry_date: string;
}

const ItemSqliteSample = () => {
  const [items, setItems] = useState<ItemRow[]>([]);
  const [form, setForm] = useState<ItemInput>({
    name: "",
    current_stock_amount: 0,
    unit_price: 0
  });
  const isElectronReady = typeof window !== "undefined" && Boolean(window.electronAPI);

  const loadItems = async () => {
    if (!isElectronReady) return;
    const data = await window.electronAPI.getItems();
    setItems(data);
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleChange = (field: keyof ItemInput) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === "name" ? event.target.value : Number(event.target.value);
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isElectronReady) return;
    if (!form.name.trim()) {
      return;
    }

    await window.electronAPI.addItem({
      name: form.name.trim(),
      current_stock_amount: form.current_stock_amount,
      unit_price: form.unit_price
    });

    setForm({ name: "", current_stock_amount: 0, unit_price: 0 });
    loadItems();
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">SQLite Item Sample</h2>
        <p className="text-sm text-slate-500">Adds items locally and lists the latest entries.</p>
      </div>

      {!isElectronReady && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Electron database bridge is not available. Run the desktop app to enable SQLite.
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3">
        <label className="grid gap-2 text-sm text-slate-700">
          Name
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            value={form.name}
            onChange={handleChange("name")}
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700">
          Stock amount
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            type="number"
            value={form.current_stock_amount}
            onChange={handleChange("current_stock_amount")}
          />
        </label>
        <label className="grid gap-2 text-sm text-slate-700">
          Unit price
          <input
            className="rounded-md border border-slate-300 px-3 py-2"
            type="number"
            value={form.unit_price}
            onChange={handleChange("unit_price")}
          />
        </label>
        <button
          className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          type="submit"
          disabled={!isElectronReady}
        >
          Save item
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Latest items</h3>
        <ul className="space-y-2 text-sm text-slate-600">
          {items.map((item) => (
            <li key={item.id} className="rounded-md border border-slate-200 px-3 py-2">
              {item.name} - {item.current_stock_amount} units @ {item.unit_price}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default ItemSqliteSample;
