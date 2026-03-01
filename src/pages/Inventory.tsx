import { useMemo, useState } from "react";
import { useData } from "@/context/DataContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Package, MoreVertical, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Inventory() {
  const { items, deleteItem, updateItem } = useData();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<(typeof items)[number] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [editForm, setEditForm] = useState({
    name: "",
    quantity: "",
    costPrice: "",
    entryDate: "",
  });

  // 1. FILTER & SORT: Newest items on top
  const displayItems = useMemo(() => {
    const filtered = items.filter((item) =>
      (item.name || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Sort by entryDate descending. If dates are equal, sort by ID (assuming higher ID is newer)
    return filtered.sort((a, b) => {
      const dateA = new Date(a.entryDate).getTime();
      const dateB = new Date(b.entryDate).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.id.localeCompare(a.id); // Fallback for items added on same day
    });
  }, [items, searchQuery]);

  const openEdit = (item: typeof items[number]) => {
    setEditingId(item.id);
    setEditForm({
      name: item.name,
      quantity: String(item.quantity),
      costPrice: String(item.costPrice),
      entryDate: item.entryDate,
    });
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editForm.name || !editForm.quantity || !editForm.costPrice || !editForm.entryDate) {
      toast.error("Please fill required fields");
      return;
    }
    try {
      await updateItem(editingId, {
        name: editForm.name,
        quantity: Number(editForm.quantity),
        costPrice: Number(editForm.costPrice),
        entryDate: editForm.entryDate,
      });
      setEditingId(null);
      toast.success("Item updated");
    } catch (error) {
      toast.error("Failed to update item");
      console.error(error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      await deleteItem(deleteTarget.id);
      toast.success("Item deleted");
    } catch (error) {
      toast.error("Failed to delete item");
      console.error(error);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Helper to check if item was added today
 const isNewItem = (dateStr: string) => {
  const itemDate = new Date(dateStr).getTime();
  const now = new Date().getTime();
  
  const twentyFourHours = 86400000;
  
  const diff = now - itemDate;

  return diff >= 0 && diff <= twentyFourHours;
};
  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold">Inventory</h1>
          <p className="text-muted-foreground mt-1">All available items and stock levels</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search items..."
              className="pl-9 bg-card"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-card border border-border shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/30">
              <TableHead>Item Name</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Cost Price</TableHead>
              <TableHead>Entry Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayItems.map((item) => (
              <TableRow key={item.id} className="border-border group">
                <TableCell className="font-medium text-foreground">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span>{item.name}</span>
                    {isNewItem(item.entryDate) && (
                       <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] h-5 px-1.5 animate-pulse">
                         <Sparkles className="w-3 h-3 mr-1" /> NEW
                       </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>Rs {item.costPrice}</TableCell>
                <TableCell className="text-muted-foreground">{item.entryDate}</TableCell>
                <TableCell>
                  {item.quantity < 10 ? (
                    <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                  ) : (
                    <Badge className="bg-success/20 text-success border-0 text-xs">In Stock</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(item)}>Update</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(item)}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {displayItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground italic">
                  No items found matching "{searchQuery}"
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Dialog */}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Item</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove
              {deleteTarget ? ` "${deleteTarget.name}"` : " this item"}
              {deleteTarget ? ` (Qty: ${deleteTarget.quantity})` : ""}.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={Boolean(editingId)} onOpenChange={(open) => !open && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Item</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input type="number" min={0} value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Entry Date *</Label>
                <Input type="date" value={editForm.entryDate} onChange={(e) => setEditForm({ ...editForm, entryDate: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cost Price *</Label>
              <Input type="number" min={0} step="0.01" value={editForm.costPrice} onChange={(e) => setEditForm({ ...editForm, costPrice: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
            <Button className="gradient-gold text-primary-foreground" onClick={handleUpdate}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}