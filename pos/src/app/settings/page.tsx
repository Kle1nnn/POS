"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Tab = "contacts" | "catalog" | "reports";

type Customer = {
  id: number;
  name: string;
  phone: string;
};

type CustomerDraft = {
  name: string;
  phone: string;
};

type CustomCategory = {
  id: number;
  name: string;
  label: string;
  emoji: string;
  image: string;
};

type CustomProduct = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  image: string;
  category: string;
};

type DailyRow = {
  saleDate: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

type MonthlyRow = {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

type ReportTotals = {
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

const BUILTIN_CATEGORIES = [
  "Pizza",
  "Burger",
  "Broast",
  "Rolls",
  "Shawarma",
  "Fries",
  "Sandwich",
  "Pasta",
  "BarBQ",
  "Drinks",
  "Toping",
  "Deals",
];

function draftsFromCustomers(customers: Customer[]): Record<number, CustomerDraft> {
  return Object.fromEntries(
    customers.map((c) => [c.id, { name: c.name, phone: c.phone }]),
  );
}

function money(n: number) {
  return `Rs ${Number(n || 0).toLocaleString()}`;
}

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
}

export default function SettingsPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("contacts");
  const [toast, setToast] = useState<string | null>(null);

  // Contacts
  const [savedCustomers, setSavedCustomers] = useState<Customer[]>([]);
  const [drafts, setDrafts] = useState<Record<number, CustomerDraft>>({});
  const [newContact, setNewContact] = useState<CustomerDraft>({ name: "", phone: "" });
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isBackingUpContacts, setIsBackingUpContacts] = useState(false);
  const [isRestoringContacts, setIsRestoringContacts] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const contactsRestoreInputRef = useRef<HTMLInputElement>(null);

  // Catalog
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const [customProducts, setCustomProducts] = useState<CustomProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("📦");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const [newItem, setNewItem] = useState({
    name: "",
    category: "Burger",
    basePrice: "",
    description: "",
  });
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Reports
  const now = useMemo(() => new Date(), []);
  const [reportMode, setReportMode] = useState<"daily" | "monthly">("daily");
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [reportTotals, setReportTotals] = useState<ReportTotals>({
    totalRevenue: 0,
    totalOrders: 0,
    totalItems: 0,
  });
  const [reportsLoading, setReportsLoading] = useState(false);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/customers?all=1");
      const data = await res.json();
      const customers: Customer[] = data.customers ?? [];
      setSavedCustomers(customers);
      setDrafts(draftsFromCustomers(customers));
    } catch (error) {
      console.error("Failed to load customers", error);
    } finally {
      setLoading(false);
    }
  };

  const loadCatalog = useCallback(async () => {
    setCatalogLoading(true);
    try {
      const [catRes, prodRes] = await Promise.all([
        fetch("/api/catalog/categories"),
        fetch("/api/catalog/products"),
      ]);
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      setCategories(catData.categories ?? []);
      setCustomProducts(prodData.products ?? []);
    } catch (error) {
      console.error("Failed to load catalog", error);
      showToast("Failed to load catalog");
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportMode,
        year: String(reportYear),
      });
      if (reportMode === "daily") params.set("month", String(reportMonth));

      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load reports");

      if (reportMode === "daily") {
        setDailyRows(data.rows ?? []);
      } else {
        setMonthlyRows(data.rows ?? []);
      }
      setReportTotals(
        data.totals ?? { totalRevenue: 0, totalOrders: 0, totalItems: 0 },
      );
    } catch (error) {
      console.error("Failed to load reports", error);
      showToast("Failed to load reports");
    } finally {
      setReportsLoading(false);
    }
  }, [reportMode, reportYear, reportMonth]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (tab === "catalog") void loadCatalog();
  }, [tab, loadCatalog]);

  useEffect(() => {
    if (tab === "reports") void loadReports();
  }, [tab, loadReports]);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedCustomers;
    return savedCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [savedCustomers, query]);

  const categoryOptions = useMemo(() => {
    const customNames = categories.map((c) => c.name);
    return Array.from(new Set([...BUILTIN_CATEGORIES, ...customNames]));
  }, [categories]);

  const updateDraft = (id: number, field: "name" | "phone", value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  };

  const isDirty = (customer: Customer) => {
    const draft = drafts[customer.id];
    if (!draft) return false;
    return (
      draft.name.trim() !== customer.name.trim() ||
      draft.phone.trim() !== customer.phone.trim()
    );
  };

  const saveCustomer = async (customer: Customer) => {
    const draft = drafts[customer.id];
    if (!draft?.name.trim()) {
      showToast("Name is required");
      return;
    }

    setSavingId(customer.id);
    try {
      const res = await fetch("/api/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: customer.id,
          name: draft.name.trim(),
          phone: draft.phone.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to update customer");
      }

      const data = await res.json();
      const updated: Customer = data.customer;
      setSavedCustomers((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c)),
      );
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: { name: updated.name, phone: updated.phone },
      }));
      showToast("Contact saved");
    } catch (error) {
      console.error("Failed to update customer", error);
      showToast("Save failed");
    } finally {
      setSavingId(null);
    }
  };

  const deleteCustomer = async (customer: Customer) => {
    if (
      !confirm(
        `Delete contact "${customer.name}"${customer.phone ? ` (${customer.phone})` : ""}?`,
      )
    ) {
      return;
    }

    setDeletingId(customer.id);
    try {
      const res = await fetch(`/api/customers?id=${customer.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to delete customer");
      }

      setSavedCustomers((prev) => prev.filter((c) => c.id !== customer.id));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[customer.id];
        return next;
      });
      showToast("Contact deleted");
    } catch (error) {
      console.error("Failed to delete customer", error);
      showToast("Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const backupAllData = async () => {
    setIsBackingUp(true);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Backup failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `pos-backup-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Backup downloaded");
    } catch (error) {
      console.error("Failed to backup data", error);
      showToast("Backup failed");
    } finally {
      setIsBackingUp(false);
    }
  };

  const backupContacts = async () => {
    setIsBackingUpContacts(true);
    try {
      const res = await fetch("/api/customers/backup");
      if (!res.ok) throw new Error("Contacts backup failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `pos-contacts-backup-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      showToast("Contacts backup downloaded");
    } catch (error) {
      console.error("Failed to backup contacts", error);
      showToast("Contacts backup failed");
    } finally {
      setIsBackingUpContacts(false);
    }
  };

  const restoreContactsFromBackup = async (file: File) => {
    if (
      !confirm(
        "Restore will replace ALL saved contacts with the backup file. Orders and sales data will not be changed. Continue?",
      )
    ) {
      return;
    }

    setIsRestoringContacts(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const res = await fetch("/api/customers/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Contacts restore failed");
      await loadCustomers();
      showToast("Contacts restored successfully");
    } catch (error) {
      console.error("Failed to restore contacts backup", error);
      showToast("Contacts restore failed");
    } finally {
      setIsRestoringContacts(false);
      if (contactsRestoreInputRef.current) contactsRestoreInputRef.current.value = "";
    }
  };

  const restoreFromBackup = async (file: File) => {
    if (
      !confirm(
        "Restore will replace ALL orders, contacts, and sales data with the backup file. Continue?",
      )
    ) {
      return;
    }

    setIsRestoring(true);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as unknown;
      const res = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Restore failed");
      await loadCustomers();
      showToast("Data restored successfully");
    } catch (error) {
      console.error("Failed to restore backup", error);
      showToast("Restore failed");
    } finally {
      setIsRestoring(false);
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  const addCustomer = async () => {
    if (!newContact.name.trim()) {
      showToast("Name is required");
      return;
    }

    setIsAdding(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContact.name.trim(),
          phone: newContact.phone.trim(),
        }),
      });

      if (!res.ok) {
        const errorData = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(errorData.error ?? "Failed to add customer");
      }

      const data = await res.json();
      const created: Customer = data.customer;
      setSavedCustomers((prev) => [created, ...prev]);
      setDrafts((prev) => ({
        ...prev,
        [created.id]: { name: created.name, phone: created.phone },
      }));
      setNewContact({ name: "", phone: "" });
      showToast("Contact added");
    } catch (error) {
      console.error("Failed to add customer", error);
      showToast("Add failed");
    } finally {
      setIsAdding(false);
    }
  };

  const addCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast("Category name is required");
      return;
    }

    setIsAddingCategory(true);
    try {
      const res = await fetch("/api/catalog/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          label: newCategoryName.trim(),
          emoji: newCategoryEmoji.trim() || "📦",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add category");

      setCategories((prev) => [data.category, ...prev]);
      setNewItem((prev) => ({ ...prev, category: data.category.name }));
      setNewCategoryName("");
      setNewCategoryEmoji("📦");
      showToast("Category added");
    } catch (error) {
      console.error("Failed to add category", error);
      showToast(error instanceof Error ? error.message : "Add category failed");
    } finally {
      setIsAddingCategory(false);
    }
  };

  const deleteCategory = async (category: CustomCategory) => {
    if (!confirm(`Delete category "${category.name}"?`)) return;
    setDeletingCategoryId(category.id);
    try {
      const res = await fetch(`/api/catalog/categories?id=${category.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete category");
      }
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      showToast("Category deleted");
    } catch (error) {
      console.error("Failed to delete category", error);
      showToast("Delete category failed");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const addItem = async () => {
    if (!newItem.name.trim()) {
      showToast("Item name is required");
      return;
    }
    if (!newItem.category.trim()) {
      showToast("Category is required");
      return;
    }
    const price = Number(newItem.basePrice);
    if (!Number.isFinite(price) || price < 0) {
      showToast("Valid price is required");
      return;
    }

    setIsAddingItem(true);
    try {
      const res = await fetch("/api/catalog/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newItem.name.trim(),
          category: newItem.category.trim(),
          basePrice: price,
          description: newItem.description.trim() || newItem.name.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add item");

      setCustomProducts((prev) => [data.product, ...prev]);
      setNewItem((prev) => ({
        ...prev,
        name: "",
        basePrice: "",
        description: "",
      }));
      showToast("Item added");
    } catch (error) {
      console.error("Failed to add item", error);
      showToast(error instanceof Error ? error.message : "Add item failed");
    } finally {
      setIsAddingItem(false);
    }
  };

  const deleteProduct = async (product: CustomProduct) => {
    if (!confirm(`Delete item "${product.name}"?`)) return;
    setDeletingProductId(product.id);
    try {
      const res = await fetch(
        `/api/catalog/products?id=${encodeURIComponent(product.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to delete item");
      }
      setCustomProducts((prev) => prev.filter((p) => p.id !== product.id));
      showToast("Item deleted");
    } catch (error) {
      console.error("Failed to delete item", error);
      showToast("Delete item failed");
    } finally {
      setDeletingProductId(null);
    }
  };

  const yearOptions = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2, y - 3];
  }, [now]);

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">⚙️ Settings</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 rounded-xl bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] transition-colors"
          >
            Menu
          </button>
          <button
            onClick={() => router.push("/Orders")}
            className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors"
          >
            Orders
          </button>
        </div>
      </div>

      <div className="px-6 pt-4">
        <div className="flex flex-wrap gap-2 mb-4">
          {(
            [
              { id: "contacts", label: "Contacts" },
              { id: "catalog", label: "Add Item / Category" },
              { id: "reports", label: "Reports" },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                tab === t.id
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 pt-0 max-w-4xl">
        {tab === "contacts" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Contacts backup &amp; restore
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Download or restore only your saved customer contacts. Orders and
                sales data are not included.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={backupContacts}
                  disabled={
                    isBackingUpContacts ||
                    isRestoringContacts ||
                    isBackingUp ||
                    isRestoring
                  }
                  className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  {isBackingUpContacts ? "Backing up..." : "Backup Contacts"}
                </button>
                <button
                  onClick={() => contactsRestoreInputRef.current?.click()}
                  disabled={
                    isBackingUpContacts ||
                    isRestoringContacts ||
                    isBackingUp ||
                    isRestoring
                  }
                  className="px-4 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors"
                >
                  {isRestoringContacts ? "Restoring..." : "Restore Contacts"}
                </button>
                <input
                  ref={contactsRestoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void restoreContactsFromBackup(file);
                  }}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Full data backup &amp; restore
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Download a full backup of orders, contacts, and sales data, or
                restore from a previously saved backup file.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={backupAllData}
                  disabled={
                    isBackingUp ||
                    isRestoring ||
                    isBackingUpContacts ||
                    isRestoringContacts
                  }
                  className="px-4 py-2 rounded-lg bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] disabled:opacity-50 transition-colors"
                >
                  {isBackingUp ? "Backing up..." : "Backup All Data"}
                </button>
                <button
                  onClick={() => restoreInputRef.current?.click()}
                  disabled={
                    isBackingUp ||
                    isRestoring ||
                    isBackingUpContacts ||
                    isRestoringContacts
                  }
                  className="px-4 py-2 rounded-lg bg-amber-50 text-amber-900 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 transition-colors"
                >
                  {isRestoring ? "Restoring..." : "Restore from Backup"}
                </button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void restoreFromBackup(file);
                  }}
                />
              </div>
            </div>

            <p className="text-sm text-gray-500 mb-4">
              Add, edit, or remove saved customer contacts. Changes are only saved
              when you click Save Contact.
            </p>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Add contact
              </p>
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-5">
                  <input
                    value={newContact.name}
                    onChange={(e) =>
                      setNewContact((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    value={newContact.phone}
                    onChange={(e) =>
                      setNewContact((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    placeholder="Phone"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-3 flex justify-end">
                  <button
                    onClick={addCustomer}
                    disabled={isAdding}
                    className="px-3 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-200 disabled:opacity-50 transition-colors"
                  >
                    {isAdding ? "Saving..." : "Save Contact"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or phone number..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {loading ? (
                <div className="p-8 text-sm text-gray-500">Loading customers...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">No customers found.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {filteredCustomers.map((customer) => {
                    const draft = drafts[customer.id] ?? {
                      name: customer.name,
                      phone: customer.phone,
                    };
                    const dirty = isDirty(customer);

                    return (
                      <div
                        key={customer.id}
                        className="p-4 grid grid-cols-12 gap-3 items-center"
                      >
                        <div className="col-span-5">
                          <input
                            value={draft.name}
                            onChange={(e) =>
                              updateDraft(customer.id, "name", e.target.value)
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div className="col-span-4">
                          <input
                            value={draft.phone}
                            onChange={(e) =>
                              updateDraft(customer.id, "phone", e.target.value)
                            }
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                        </div>
                        <div className="col-span-3 flex justify-end gap-2">
                          <button
                            onClick={() => saveCustomer(customer)}
                            disabled={
                              savingId === customer.id ||
                              deletingId === customer.id ||
                              !dirty
                            }
                            className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50 transition-colors"
                          >
                            {savingId === customer.id ? "Saving..." : "Update"}
                          </button>
                          <button
                            onClick={() => deleteCustomer(customer)}
                            disabled={
                              savingId === customer.id ||
                              deletingId === customer.id
                            }
                            className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            {deletingId === customer.id ? "..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "catalog" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Add category
              </p>
              <p className="text-sm text-gray-500 mb-3">
                New categories appear on the menu grid for adding items.
              </p>
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-2">
                  <input
                    value={newCategoryEmoji}
                    onChange={(e) => setNewCategoryEmoji(e.target.value)}
                    placeholder="Emoji"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-7">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name (e.g. Soup)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-3 flex justify-end">
                  <button
                    onClick={addCategory}
                    disabled={isAddingCategory}
                    className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-900 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {isAddingCategory ? "Saving..." : "Add Category"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Add item
              </p>
              <p className="text-sm text-gray-500 mb-3">
                Add a new menu item under an existing or custom category.
              </p>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-4">
                  <input
                    value={newItem.name}
                    onChange={(e) =>
                      setNewItem((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="Item name"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-3">
                  <select
                    value={newItem.category}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    {categoryOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={newItem.basePrice}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        basePrice: e.target.value,
                      }))
                    }
                    placeholder="Price"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-2 flex justify-end">
                  <button
                    onClick={addItem}
                    disabled={isAddingItem}
                    className="px-3 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    {isAddingItem ? "Saving..." : "Add Item"}
                  </button>
                </div>
                <div className="col-span-12">
                  <input
                    value={newItem.description}
                    onChange={(e) =>
                      setNewItem((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Description (optional)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Custom categories
                </p>
              </div>
              {catalogLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading...</div>
              ) : categories.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">
                  No custom categories yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className="px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg">{category.emoji}</span>
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {category.name}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteCategory(category)}
                        disabled={deletingCategoryId === category.id}
                        className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        {deletingCategoryId === category.id ? "..." : "Delete"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Custom items
                </p>
              </div>
              {catalogLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading...</div>
              ) : customProducts.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No custom items yet.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {customProducts.map((product) => (
                    <div
                      key={product.id}
                      className="px-4 py-3 grid grid-cols-12 gap-3 items-center"
                    >
                      <div className="col-span-5 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {product.description}
                        </p>
                      </div>
                      <div className="col-span-3 text-sm text-gray-600">
                        {product.category}
                      </div>
                      <div className="col-span-2 text-sm font-semibold text-gray-900">
                        {money(product.basePrice)}
                      </div>
                      <div className="col-span-2 flex justify-end">
                        <button
                          onClick={() => deleteProduct(product)}
                          disabled={deletingProductId === product.id}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingProductId === product.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {tab === "reports" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Sales reports
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setReportMode("daily")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    reportMode === "daily"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Day by Day
                </button>
                <button
                  onClick={() => setReportMode("monthly")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    reportMode === "monthly"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Monthly
                </button>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Year</label>
                  <select
                    value={reportYear}
                    onChange={(e) => setReportYear(Number(e.target.value))}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {yearOptions.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
                {reportMode === "daily" && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Month
                    </label>
                    <select
                      value={reportMonth}
                      onChange={(e) => setReportMonth(Number(e.target.value))}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>
                          {new Date(2000, m - 1, 1).toLocaleString(undefined, {
                            month: "long",
                          })}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={() => void loadReports()}
                  disabled={reportsLoading}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {reportsLoading ? "Loading..." : "Refresh"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Revenue</p>
                <p className="text-lg font-bold text-gray-900">
                  {money(reportTotals.totalRevenue)}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Orders</p>
                <p className="text-lg font-bold text-gray-900">
                  {reportTotals.totalOrders}
                </p>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-4">
                <p className="text-xs text-gray-500 mb-1">Items</p>
                <p className="text-lg font-bold text-gray-900">
                  {reportTotals.totalItems}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">
                  {reportMode === "daily"
                    ? `Day-by-day · ${monthLabel(reportYear, reportMonth)}`
                    : `Monthly · ${reportYear}`}
                </p>
              </div>
              {reportsLoading ? (
                <div className="p-8 text-sm text-gray-500">Loading report...</div>
              ) : reportMode === "daily" ? (
                dailyRows.length === 0 ? (
                  <div className="p-8 text-sm text-gray-500">
                    No daily sales for this month.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                      <div className="col-span-4">Date</div>
                      <div className="col-span-3 text-right">Revenue</div>
                      <div className="col-span-2 text-right">Orders</div>
                      <div className="col-span-3 text-right">Items</div>
                    </div>
                    {dailyRows.map((row) => (
                      <div
                        key={row.saleDate}
                        className="px-4 py-3 grid grid-cols-12 gap-2 text-sm"
                      >
                        <div className="col-span-4 font-medium text-gray-900">
                          {row.saleDate}
                        </div>
                        <div className="col-span-3 text-right font-semibold">
                          {money(row.totalRevenue)}
                        </div>
                        <div className="col-span-2 text-right text-gray-700">
                          {row.totalOrders}
                        </div>
                        <div className="col-span-3 text-right text-gray-700">
                          {row.totalItems}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : monthlyRows.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">
                  No monthly sales for this year.
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                    <div className="col-span-4">Month</div>
                    <div className="col-span-3 text-right">Revenue</div>
                    <div className="col-span-2 text-right">Orders</div>
                    <div className="col-span-3 text-right">Items</div>
                  </div>
                  {monthlyRows.map((row) => (
                    <div
                      key={row.period}
                      className="px-4 py-3 grid grid-cols-12 gap-2 text-sm"
                    >
                      <div className="col-span-4 font-medium text-gray-900">
                        {row.period}
                      </div>
                      <div className="col-span-3 text-right font-semibold">
                        {money(row.totalRevenue)}
                      </div>
                      <div className="col-span-2 text-right text-gray-700">
                        {row.totalOrders}
                      </div>
                      <div className="col-span-3 text-right text-gray-700">
                        {row.totalItems}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
