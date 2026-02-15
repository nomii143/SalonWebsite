import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface SaloonItem {
  id: number;
  name: string;
  price: number;
  category: string | null;
}

const ItemsSqliteTable = () => {
  const [items, setItems] = useState<SaloonItem[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [priceValue, setPriceValue] = useState("0");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isElectron = useMemo(
    () => typeof window !== "undefined" && Boolean(window.saloonAPI),
    []
  );

  const loadItems = async () => {
    if (!isElectron) return;
    setIsLoading(true);
    setError("");
    try {
      const data = await window.saloonAPI.fetchAllItems();
      setItems(data);
    } catch (err) {
      setError("Failed to load items from SQLite");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const startEdit = (item: SaloonItem) => {
    setEditingId(item.id);
    setPriceValue(String(item.price ?? 0));
  };

  const handleSave = async () => {
    if (!editingId) return;
    try {
      await window.saloonAPI.updateItem({
        id: editingId,
        price: Number(priceValue || 0)
      });
      setEditingId(null);
      await loadItems();
    } catch (err) {
      setError("Failed to update item");
      console.error(err);
    }
  };

  if (!isElectron) {
    return (
      <div className="rounded-xl bg-card border border-border p-5 shadow-card">
        <h2 className="font-display font-semibold">SQLite Items</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Electron bridge is not available. Run the desktop app to load SQLite data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card border border-border p-5 shadow-card space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-semibold">SQLite Items</h2>
          <p className="text-sm text-muted-foreground">Edit prices and keep them synced with SQLite.</p>
        </div>
        <Button type="button" variant="outline" onClick={loadItems} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </Button>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} className="border-border">
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.category || "-"}</TableCell>
                <TableCell>
                  {editingId === item.id ? (
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={priceValue}
                      onChange={(event) => setPriceValue(event.target.value)}
                    />
                  ) : (
                    `Rs ${Number(item.price || 0).toFixed(2)}`
                  )}
                </TableCell>
                <TableCell className="text-right">
                  {editingId === item.id ? (
                    <div className="flex items-center justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button type="button" className="gradient-gold text-primary-foreground" onClick={handleSave}>
                        Save
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => startEdit(item)}>
                      Edit
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ItemsSqliteTable;
