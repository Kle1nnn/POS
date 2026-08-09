"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PrintModal from "../components/PrintModal";
import { CartItem } from "../context/CartContext";
import {
  clearReceiptSettingsCache,
  type ReceiptSettings,
} from "../lib/receipt";
import { DEFAULT_RECEIPT_SETTINGS } from "../../lib/receipt-settings-shared";

type Tab = "contacts" | "catalog" | "reports" | "receipt" | "backup";

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

type CatalogProduct = {
  id: string;
  name: string;
  description: string;
  basePrice: number;
  image: string;
  category: string;
  source?: "builtin" | "custom";
  sizePrices?: Record<string, number> | null;
  sizes?: string[] | null;
  hasExtraToppings?: boolean | null;
  hasSauceOptions?: boolean | null;
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

type DateOrderRow = {
  orderCode: string;
  total: number;
  notes?: string;
  instructions?: string;
  customerName: string;
  customerPhone?: string;
  orderType: string;
  tableNumber: number | null;
  soldAt: string;
  itemCount: number;
  items?: Array<{
    id?: string;
    name: string;
    category?: string;
    selectedSize?: string;
    selectedTopping?: string;
    selectedSauce?: string;
    price: number;
    quantity: number;
    cartKey?: string;
  }>;
};

type ReportTotals = {
  totalRevenue: number;
  totalOrders: number;
  totalItems: number;
};

const DEFAULT_IMAGE = "deals.png";

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

function imageUrl(image: string) {
  if (!image) return `/${DEFAULT_IMAGE}`;
  if (image.startsWith("http") || image.startsWith("/")) return image;
  return `/${image}`;
}

function isUploadedImage(image: string) {
  return image.startsWith("uploads/");
}

async function deleteUploadedImage(image: string) {
  if (!isUploadedImage(image)) return;
  try {
    await fetch(`/api/catalog/upload?image=${encodeURIComponent(image)}`, {
      method: "DELETE",
    });
  } catch {
    // ignore cleanup failures
  }
}

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
  const [catalogProducts, setCatalogProducts] = useState<CatalogProduct[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryEmoji, setNewCategoryEmoji] = useState("📦");
  const [newCategoryImage, setNewCategoryImage] = useState(DEFAULT_IMAGE);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [originalCategoryImage, setOriginalCategoryImage] = useState<string | null>(
    null,
  );
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [isUploadingCategoryImage, setIsUploadingCategoryImage] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<number | null>(null);
  const categoryImageInputRef = useRef<HTMLInputElement>(null);
  const emptyItemForm = {
    name: "",
    category: "Burger",
    basePrice: "",
    description: "",
    image: DEFAULT_IMAGE,
  };
  const [newItem, setNewItem] = useState(emptyItemForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [originalEditImage, setOriginalEditImage] = useState<string | null>(null);
  const [isSavingItem, setIsSavingItem] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);
  const itemImageInputRef = useRef<HTMLInputElement>(null);

  // Reports
  const now = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => {
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [now]);
  const [reportMode, setReportMode] = useState<"date" | "daily" | "monthly">(
    "date",
  );
  const [reportDate, setReportDate] = useState(todayStr);
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);
  const [monthlyRows, setMonthlyRows] = useState<MonthlyRow[]>([]);
  const [dateOrders, setDateOrders] = useState<DateOrderRow[]>([]);
  const [reportTotals, setReportTotals] = useState<ReportTotals>({
    totalRevenue: 0,
    totalOrders: 0,
    totalItems: 0,
  });
  const [reportsLoading, setReportsLoading] = useState(false);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printOrder, setPrintOrder] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    notes: string;
    instructions: string;
    customer?: { name: string; phone: string };
    orderType?: string;
    tableNumber?: number | null;
  } | null>(null);

  // Receipt settings
  const [receiptSettings, setReceiptSettings] = useState<ReceiptSettings>({
    ...DEFAULT_RECEIPT_SETTINGS,
  });
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [isSavingReceipt, setIsSavingReceipt] = useState(false);
  const [isUploadingReceiptLogo, setIsUploadingReceiptLogo] = useState(false);
  const [isUploadingPaymentImage, setIsUploadingPaymentImage] = useState(false);
  const receiptLogoInputRef = useRef<HTMLInputElement>(null);
  const paymentImageInputRef = useRef<HTMLInputElement>(null);

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
        fetch("/api/catalog/products?all=1"),
      ]);
      const catData = await catRes.json();
      const prodData = await prodRes.json();
      setCategories(catData.categories ?? []);
      setCatalogProducts(prodData.products ?? []);
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
      const params = new URLSearchParams({ type: reportMode });
      if (reportMode === "date") {
        params.set("date", reportDate);
      } else {
        params.set("year", String(reportYear));
        if (reportMode === "daily") params.set("month", String(reportMonth));
      }

      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load reports");

      if (reportMode === "date") {
        setDailyRows(data.rows ?? []);
        setDateOrders(data.orders ?? []);
        setMonthlyRows([]);
      } else if (reportMode === "daily") {
        setDailyRows(data.rows ?? []);
        setDateOrders([]);
        setMonthlyRows([]);
      } else {
        setMonthlyRows(data.rows ?? []);
        setDailyRows([]);
        setDateOrders([]);
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
  }, [reportMode, reportYear, reportMonth, reportDate]);

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    if (tab === "catalog") void loadCatalog();
  }, [tab, loadCatalog]);

  useEffect(() => {
    if (tab === "reports") void loadReports();
  }, [tab, loadReports]);

  const loadReceiptSettings = useCallback(async () => {
    setReceiptLoading(true);
    try {
      const res = await fetch("/api/receipt-settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load receipt settings");
      setReceiptSettings(data.settings ?? { ...DEFAULT_RECEIPT_SETTINGS });
    } catch (error) {
      console.error("Failed to load receipt settings", error);
      showToast("Failed to load receipt settings");
    } finally {
      setReceiptLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "receipt") void loadReceiptSettings();
  }, [tab, loadReceiptSettings]);

  const openReportPrint = (order: DateOrderRow) => {
    const items: CartItem[] = (order.items || []).map((item) => ({
      id: String(item.id ?? item.name),
      name: item.name,
      description: item.name,
      basePrice: Number(item.price ?? 0),
      image: "deals.png",
      category: item.category ?? "",
      selectedSize: item.selectedSize,
      selectedTopping: item.selectedTopping,
      selectedSauce: item.selectedSauce,
      cartKey:
        item.cartKey ??
        `${item.name}-${item.selectedSize ?? ""}-${item.selectedTopping ?? ""}-${item.selectedSauce ?? ""}`,
      quantity: item.quantity ?? 1,
      price: Number(item.price ?? 0),
    }));

    setPrintOrder({
      id: order.orderCode,
      items,
      total: Number(order.total),
      notes: order.notes ?? "",
      instructions: order.instructions ?? "",
      customer: {
        name: order.customerName,
        phone: order.customerPhone ?? "",
      },
      orderType: order.orderType,
      tableNumber: order.tableNumber,
    });
    setPrintModalOpen(true);
  };

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
    const fromProducts = catalogProducts.map((p) => p.category);
    return Array.from(
      new Set([...BUILTIN_CATEGORIES, ...customNames, ...fromProducts]),
    ).sort((a, b) => a.localeCompare(b));
  }, [categories, catalogProducts]);

  const filteredCatalogProducts = useMemo(() => {
    const q = itemQuery.trim().toLowerCase();
    if (!q) return catalogProducts;
    return catalogProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        (p.description || "").toLowerCase().includes(q),
    );
  }, [catalogProducts, itemQuery]);

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

  const resetCategoryForm = () => {
    setNewCategoryName("");
    setNewCategoryEmoji("📦");
    setNewCategoryImage(DEFAULT_IMAGE);
    setEditingCategoryId(null);
    setOriginalCategoryImage(null);
    if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
  };

  const startEditCategory = (category: CustomCategory) => {
    setEditingCategoryId(category.id);
    setNewCategoryName(category.name);
    setNewCategoryEmoji(category.emoji || "📦");
    setNewCategoryImage(category.image || DEFAULT_IMAGE);
    setOriginalCategoryImage(category.image || DEFAULT_IMAGE);
    if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
  };

  const uploadCategoryImage = async (file: File) => {
    setIsUploadingCategoryImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/catalog/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const previous = newCategoryImage;
      setNewCategoryImage(data.image as string);

      if (
        isUploadedImage(previous) &&
        previous !== originalCategoryImage &&
        previous !== data.image
      ) {
        await deleteUploadedImage(previous);
      }

      showToast("Category picture uploaded");
    } catch (error) {
      console.error("Failed to upload category image", error);
      showToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingCategoryImage(false);
      if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
    }
  };

  const removeCategoryPicture = async () => {
    const current = newCategoryImage;
    setNewCategoryImage(DEFAULT_IMAGE);
    if (
      isUploadedImage(current) &&
      current !== originalCategoryImage
    ) {
      await deleteUploadedImage(current);
    }
    if (categoryImageInputRef.current) categoryImageInputRef.current.value = "";
  };

  const saveCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast("Category name is required");
      return;
    }

    if (editingCategoryId) {
      setIsSavingCategory(true);
      try {
        const res = await fetch("/api/catalog/categories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCategoryId,
            name: newCategoryName.trim(),
            label: newCategoryName.trim(),
            emoji: newCategoryEmoji.trim() || "📦",
            image: newCategoryImage.trim() || DEFAULT_IMAGE,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Failed to update category");

        setCategories((prev) =>
          prev.map((c) => (c.id === editingCategoryId ? data.category : c)),
        );
        if (
          originalCategoryImage &&
          isUploadedImage(originalCategoryImage) &&
          originalCategoryImage !== data.category.image
        ) {
          await deleteUploadedImage(originalCategoryImage);
        }
        // Refresh products in case category was renamed
        void loadCatalog();
        resetCategoryForm();
        showToast("Category updated");
      } catch (error) {
        console.error("Failed to update category", error);
        showToast(
          error instanceof Error ? error.message : "Update category failed",
        );
      } finally {
        setIsSavingCategory(false);
      }
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
          image: newCategoryImage.trim() || DEFAULT_IMAGE,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to add category");

      setCategories((prev) => [data.category, ...prev]);
      setNewItem((prev) => ({ ...prev, category: data.category.name }));
      resetCategoryForm();
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete category");
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
      if (isUploadedImage(data.image || category.image)) {
        await deleteUploadedImage(data.image || category.image);
      }
      if (editingCategoryId === category.id) resetCategoryForm();
      showToast("Category deleted");
    } catch (error) {
      console.error("Failed to delete category", error);
      showToast("Delete category failed");
    } finally {
      setDeletingCategoryId(null);
    }
  };

  const saveReceiptSettings = async () => {
    setIsSavingReceipt(true);
    try {
      const res = await fetch("/api/receipt-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(receiptSettings),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save receipt settings");
      setReceiptSettings(data.settings ?? receiptSettings);
      clearReceiptSettingsCache();
      showToast("Receipt settings saved");
    } catch (error) {
      console.error("Failed to save receipt settings", error);
      showToast(
        error instanceof Error ? error.message : "Save receipt settings failed",
      );
    } finally {
      setIsSavingReceipt(false);
    }
  };

  const uploadReceiptImage = async (
    file: File,
    field: "logoImage" | "paymentImage",
  ) => {
    const setUploading =
      field === "logoImage"
        ? setIsUploadingReceiptLogo
        : setIsUploadingPaymentImage;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/catalog/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const previous = receiptSettings[field];
      setReceiptSettings((prev) => ({
        ...prev,
        [field]: data.image as string,
      }));
      if (isUploadedImage(previous) && previous !== data.image) {
        await deleteUploadedImage(previous);
      }
      showToast(field === "logoImage" ? "Logo uploaded" : "Payment image uploaded");
    } catch (error) {
      console.error("Failed to upload receipt image", error);
      showToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const resetItemForm = () => {
    setNewItem(emptyItemForm);
    setEditingProductId(null);
    setOriginalEditImage(null);
    if (itemImageInputRef.current) itemImageInputRef.current.value = "";
  };

  const uploadItemImage = async (file: File) => {
    setIsUploadingImage(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/catalog/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const previous = newItem.image;
      setNewItem((prev) => ({ ...prev, image: data.image as string }));

      // Clean up previous uploaded image that is not the original being edited
      if (
        isUploadedImage(previous) &&
        previous !== originalEditImage &&
        previous !== data.image
      ) {
        await deleteUploadedImage(previous);
      }

      showToast("Picture uploaded");
    } catch (error) {
      console.error("Failed to upload image", error);
      showToast(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setIsUploadingImage(false);
      if (itemImageInputRef.current) itemImageInputRef.current.value = "";
    }
  };

  const removeItemPicture = async () => {
    const current = newItem.image;
    if (current === DEFAULT_IMAGE) return;

    setNewItem((prev) => ({ ...prev, image: DEFAULT_IMAGE }));

    if (isUploadedImage(current) && current !== originalEditImage) {
      await deleteUploadedImage(current);
    }
    showToast("Picture removed");
  };

  const startEditProduct = (product: CatalogProduct) => {
    setEditingProductId(product.id);
    setOriginalEditImage(product.image || DEFAULT_IMAGE);
    setNewItem({
      name: product.name,
      category: product.category,
      basePrice: String(product.basePrice),
      description: product.description || "",
      image: product.image || DEFAULT_IMAGE,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveItem = async () => {
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

    setIsSavingItem(true);
    try {
      const existing = editingProductId
        ? catalogProducts.find((p) => p.id === editingProductId)
        : null;

      const payload = {
        name: newItem.name.trim(),
        category: newItem.category.trim(),
        basePrice: price,
        description: newItem.description.trim() || newItem.name.trim(),
        image: newItem.image.trim() || DEFAULT_IMAGE,
        sizePrices: existing?.sizePrices ?? null,
        sizes: existing?.sizes ?? null,
        hasExtraToppings: existing?.hasExtraToppings ?? null,
        hasSauceOptions: existing?.hasSauceOptions ?? null,
      };

      const res = await fetch("/api/catalog/products", {
        method: editingProductId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingProductId ? { id: editingProductId, ...payload } : payload,
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save item");

      if (editingProductId) {
        setCatalogProducts((prev) =>
          prev.map((p) =>
            p.id === editingProductId
              ? { ...data.product, source: data.product.source ?? p.source }
              : p,
          ),
        );
        if (
          originalEditImage &&
          isUploadedImage(originalEditImage) &&
          originalEditImage !== data.product.image
        ) {
          await deleteUploadedImage(originalEditImage);
        }
        showToast("Item updated");
      } else {
        setCatalogProducts((prev) => [
          { ...data.product, source: "custom" },
          ...prev,
        ]);
        showToast("Item added");
      }
      resetItemForm();
    } catch (error) {
      console.error("Failed to save item", error);
      showToast(error instanceof Error ? error.message : "Save item failed");
    } finally {
      setIsSavingItem(false);
    }
  };

  const deleteProduct = async (product: CatalogProduct) => {
    const label =
      product.source === "builtin"
        ? `Remove "${product.name}" from the menu?`
        : `Delete item "${product.name}"?`;
    if (!confirm(label)) return;
    setDeletingProductId(product.id);
    try {
      const res = await fetch(
        `/api/catalog/products?id=${encodeURIComponent(product.id)}`,
        { method: "DELETE" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to delete item");

      setCatalogProducts((prev) => prev.filter((p) => p.id !== product.id));
      if (
        product.source === "custom" &&
        isUploadedImage(data.image || product.image)
      ) {
        await deleteUploadedImage(data.image || product.image);
      }
      if (editingProductId === product.id) resetItemForm();
      showToast(product.source === "builtin" ? "Item removed from menu" : "Item deleted");
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

      {printOrder && (
        <PrintModal
          isOpen={printModalOpen}
          onClose={() => {
            setPrintModalOpen(false);
            setPrintOrder(null);
          }}
          cartItems={printOrder.items}
          totalPrice={printOrder.total}
          notes={printOrder.notes}
          instructions={printOrder.instructions}
          orderId={printOrder.id}
          isPaid={true}
          customer={printOrder.customer}
          orderType={printOrder.orderType}
          tableNumber={printOrder.tableNumber}
        />
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
              { id: "receipt", label: "Receipt Settings" },
              { id: "backup", label: "Full Backup" },
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
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  All contacts
                </p>
                <p className="text-xs text-gray-500">
                  Total contacts:{" "}
                  <span className="font-semibold text-gray-900">
                    {savedCustomers.length}
                  </span>
                  {query.trim()
                    ? ` · Showing ${filteredCustomers.length}`
                    : ""}
                </p>
              </div>
              {loading ? (
                <div className="p-8 text-sm text-gray-500">Loading customers...</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">No customers found.</div>
              ) : (
                <div className="divide-y divide-gray-100">
                  <div className="px-4 py-2 grid grid-cols-12 gap-3 text-xs font-semibold text-gray-500 uppercase">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Name</div>
                    <div className="col-span-4">Phone</div>
                    <div className="col-span-3 text-right">Actions</div>
                  </div>
                  {filteredCustomers.map((customer, index) => {
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
                        <div className="col-span-1 text-sm font-semibold text-gray-500">
                          {index + 1}
                        </div>
                        <div className="col-span-4">
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
                {editingCategoryId ? "Edit category" : "Add category"}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {editingCategoryId
                  ? "Update category name, emoji, or picture."
                  : "New categories appear on the menu grid for adding items."}
              </p>
              <div className="grid grid-cols-12 gap-3 items-center">
                <div className="col-span-12 flex flex-wrap items-center gap-3 mb-1">
                  <img
                    src={imageUrl(newCategoryImage)}
                    alt="Category"
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 bg-gray-50"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => categoryImageInputRef.current?.click()}
                      disabled={
                        isUploadingCategoryImage ||
                        isAddingCategory ||
                        isSavingCategory
                      }
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingCategoryImage
                        ? "Uploading..."
                        : newCategoryImage === DEFAULT_IMAGE
                          ? "Add Picture"
                          : "Change Picture"}
                    </button>
                    {newCategoryImage !== DEFAULT_IMAGE && (
                      <button
                        type="button"
                        onClick={() => void removeCategoryPicture()}
                        disabled={
                          isUploadingCategoryImage ||
                          isAddingCategory ||
                          isSavingCategory
                        }
                        className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete Picture
                      </button>
                    )}
                  </div>
                  <input
                    ref={categoryImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadCategoryImage(file);
                    }}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    value={newCategoryEmoji}
                    onChange={(e) => setNewCategoryEmoji(e.target.value)}
                    placeholder="Emoji"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-6">
                  <input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Category name (e.g. Soup)"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="col-span-4 flex justify-end gap-2">
                  {editingCategoryId && (
                    <button
                      onClick={resetCategoryForm}
                      disabled={isSavingCategory}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={() => void saveCategory()}
                    disabled={
                      isAddingCategory ||
                      isSavingCategory ||
                      isUploadingCategoryImage
                    }
                    className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-900 text-sm font-semibold hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {isAddingCategory || isSavingCategory
                      ? "Saving..."
                      : editingCategoryId
                        ? "Update Category"
                        : "Add Category"}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {editingProductId ? "Edit item" : "Add item"}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {editingProductId
                  ? "Update item details, price, category, or picture."
                  : "Add a new menu item under an existing or custom category."}
              </p>
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 flex flex-wrap items-center gap-3 mb-1">
                  <img
                    src={imageUrl(newItem.image)}
                    alt="Item"
                    className="w-16 h-16 rounded-xl object-cover border border-gray-200 bg-gray-50"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => itemImageInputRef.current?.click()}
                      disabled={isUploadingImage || isSavingItem}
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingImage
                        ? "Uploading..."
                        : newItem.image === DEFAULT_IMAGE
                          ? "Add Picture"
                          : "Change Picture"}
                    </button>
                    {newItem.image !== DEFAULT_IMAGE && (
                      <button
                        type="button"
                        onClick={() => void removeItemPicture()}
                        disabled={isUploadingImage || isSavingItem}
                        className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete Picture
                      </button>
                    )}
                  </div>
                  <input
                    ref={itemImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadItemImage(file);
                    }}
                  />
                </div>
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
                <div className="col-span-2 flex justify-end gap-2">
                  {editingProductId && (
                    <button
                      onClick={resetItemForm}
                      disabled={isSavingItem}
                      className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={saveItem}
                    disabled={isSavingItem || isUploadingImage}
                    className="px-3 py-2 rounded-lg bg-green-50 text-green-900 text-sm font-semibold hover:bg-green-100 disabled:opacity-50 transition-colors"
                  >
                    {isSavingItem
                      ? "Saving..."
                      : editingProductId
                        ? "Update"
                        : "Add Item"}
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
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={imageUrl(category.image)}
                          alt={category.name}
                          className="w-10 h-10 rounded-lg object-cover border border-gray-200 bg-gray-50 shrink-0"
                        />
                        <span className="text-lg">{category.emoji}</span>
                        <span className="text-sm font-semibold text-gray-900 truncate">
                          {category.name}
                        </span>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => startEditCategory(category)}
                          disabled={deletingCategoryId === category.id}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteCategory(category)}
                          disabled={deletingCategoryId === category.id}
                          className="px-3 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                        >
                          {deletingCategoryId === category.id ? "..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    All menu items
                  </p>
                  <p className="text-xs text-gray-400">
                    {filteredCatalogProducts.length} / {catalogProducts.length}
                  </p>
                </div>
                <input
                  value={itemQuery}
                  onChange={(e) => setItemQuery(e.target.value)}
                  placeholder="Search all items by name or category..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              {catalogLoading ? (
                <div className="p-6 text-sm text-gray-500">Loading...</div>
              ) : filteredCatalogProducts.length === 0 ? (
                <div className="p-6 text-sm text-gray-500">No items found.</div>
              ) : (
                <div className="divide-y divide-gray-100 max-h-[520px] overflow-y-auto">
                  {filteredCatalogProducts.map((product) => (
                    <div
                      key={product.id}
                      className="px-4 py-3 grid grid-cols-12 gap-3 items-center"
                    >
                      <div className="col-span-1">
                        <img
                          src={imageUrl(product.image)}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover border border-gray-200 bg-gray-50"
                        />
                      </div>
                      <div className="col-span-4 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {product.description}
                        </p>
                      </div>
                      <div className="col-span-2 text-sm text-gray-600">
                        <div>{product.category}</div>
                        <div className="text-[10px] uppercase tracking-wide text-gray-400">
                          {product.source === "custom" ? "Custom" : "Menu"}
                        </div>
                      </div>
                      <div className="col-span-2 text-sm font-semibold text-gray-900">
                        {product.sizePrices
                          ? "Sizes"
                          : money(product.basePrice)}
                      </div>
                      <div className="col-span-3 flex justify-end gap-2">
                        <button
                          onClick={() => startEditProduct(product)}
                          disabled={deletingProductId === product.id}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                        >
                          Edit
                        </button>
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

        {tab === "backup" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Full data backup &amp; restore
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Download a full backup of orders, contacts, and sales data, or
              restore from a previously saved backup file. This is separate from
              contacts-only backup.
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
        )}

        {tab === "receipt" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Receipt settings
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Store name, address, phones, logo, and payment details printed on
              customer receipts.
            </p>
            {receiptLoading ? (
              <div className="text-sm text-gray-500">Loading...</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={imageUrl(receiptSettings.logoImage)}
                    alt="Logo"
                    className="w-20 h-20 rounded-xl object-contain border border-gray-200 bg-gray-50"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => receiptLogoInputRef.current?.click()}
                      disabled={isUploadingReceiptLogo || isSavingReceipt}
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingReceiptLogo ? "Uploading..." : "Change Logo"}
                    </button>
                    {receiptSettings.logoImage !==
                      DEFAULT_RECEIPT_SETTINGS.logoImage && (
                      <button
                        type="button"
                        onClick={() => {
                          const prev = receiptSettings.logoImage;
                          setReceiptSettings((s) => ({
                            ...s,
                            logoImage: DEFAULT_RECEIPT_SETTINGS.logoImage,
                          }));
                          if (isUploadedImage(prev)) void deleteUploadedImage(prev);
                        }}
                        disabled={isUploadingReceiptLogo || isSavingReceipt}
                        className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete Logo
                      </button>
                    )}
                  </div>
                  <input
                    ref={receiptLogoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadReceiptImage(file, "logoImage");
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Store name
                    </label>
                    <input
                      value={receiptSettings.storeName}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          storeName: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Address
                    </label>
                    <input
                      value={receiptSettings.storeAddress}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          storeAddress: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs text-gray-500 mb-1">
                      Phones
                    </label>
                    <input
                      value={receiptSettings.storePhones}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          storePhones: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Payment title
                    </label>
                    <input
                      value={receiptSettings.paymentTitle}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          paymentTitle: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Payment line
                    </label>
                    <input
                      value={receiptSettings.paymentLine}
                      onChange={(e) =>
                        setReceiptSettings((s) => ({
                          ...s,
                          paymentLine: e.target.value,
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <img
                    src={imageUrl(receiptSettings.paymentImage)}
                    alt="Payment"
                    className="w-16 h-16 rounded-xl object-contain border border-gray-200 bg-gray-50"
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => paymentImageInputRef.current?.click()}
                      disabled={isUploadingPaymentImage || isSavingReceipt}
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50"
                    >
                      {isUploadingPaymentImage
                        ? "Uploading..."
                        : "Change Payment Image"}
                    </button>
                    {receiptSettings.paymentImage !==
                      DEFAULT_RECEIPT_SETTINGS.paymentImage && (
                      <button
                        type="button"
                        onClick={() => {
                          const prev = receiptSettings.paymentImage;
                          setReceiptSettings((s) => ({
                            ...s,
                            paymentImage: DEFAULT_RECEIPT_SETTINGS.paymentImage,
                          }));
                          if (isUploadedImage(prev)) void deleteUploadedImage(prev);
                        }}
                        disabled={isUploadingPaymentImage || isSavingReceipt}
                        className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        Delete Payment Image
                      </button>
                    )}
                  </div>
                  <input
                    ref={paymentImageInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadReceiptImage(file, "paymentImage");
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => void saveReceiptSettings()}
                    disabled={
                      isSavingReceipt ||
                      isUploadingReceiptLogo ||
                      isUploadingPaymentImage
                    }
                    className="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
                  >
                    {isSavingReceipt ? "Saving..." : "Save Receipt Settings"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "reports" && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                Sales reports
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setReportMode("date")}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                    reportMode === "date"
                      ? "bg-[#1a3a5c] text-white"
                      : "bg-gray-50 text-gray-700 border border-gray-200"
                  }`}
                >
                  Select Date
                </button>
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
                {reportMode === "date" ? (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={reportDate}
                      onChange={(e) => setReportDate(e.target.value)}
                      className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Year
                      </label>
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
                          onChange={(e) =>
                            setReportMonth(Number(e.target.value))
                          }
                          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (m) => (
                              <option key={m} value={m}>
                                {new Date(2000, m - 1, 1).toLocaleString(
                                  undefined,
                                  { month: "long" },
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </div>
                    )}
                  </>
                )}
                <button
                  onClick={() => void loadReports()}
                  disabled={reportsLoading}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50"
                >
                  {reportsLoading ? "Loading..." : "View Report"}
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

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">
                  {reportMode === "date"
                    ? `Report for ${reportDate}`
                    : reportMode === "daily"
                      ? `Day-by-day · ${monthLabel(reportYear, reportMonth)}`
                      : `Monthly · ${reportYear}`}
                </p>
              </div>
              {reportsLoading ? (
                <div className="p-8 text-sm text-gray-500">Loading report...</div>
              ) : reportMode === "monthly" ? (
                monthlyRows.length === 0 ? (
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
                )
              ) : dailyRows.length === 0 ? (
                <div className="p-8 text-sm text-gray-500">
                  {reportMode === "date"
                    ? "No sales for this date."
                    : "No daily sales for this month."}
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
              )}
            </div>

            {reportMode === "date" && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-sm font-semibold text-gray-900">
                    Orders on {reportDate}
                  </p>
                </div>
                {reportsLoading ? (
                  <div className="p-8 text-sm text-gray-500">Loading orders...</div>
                ) : dateOrders.length === 0 ? (
                  <div className="p-8 text-sm text-gray-500">
                    No checked-out orders for this date.
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    <div className="px-4 py-2 grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase">
                      <div className="col-span-3">Order</div>
                      <div className="col-span-3">Customer</div>
                      <div className="col-span-2">Type</div>
                      <div className="col-span-1 text-right">Items</div>
                      <div className="col-span-2 text-right">Total</div>
                      <div className="col-span-1 text-right">Print</div>
                    </div>
                    {dateOrders.map((order) => (
                      <div
                        key={order.orderCode}
                        className="px-4 py-3 grid grid-cols-12 gap-2 text-sm items-center"
                      >
                        <div className="col-span-3 font-medium text-gray-900">
                          {order.orderCode}
                        </div>
                        <div className="col-span-3 text-gray-700 truncate">
                          {order.customerName}
                        </div>
                        <div className="col-span-2 text-gray-700">
                          {order.orderType}
                          {order.tableNumber != null
                            ? ` #${order.tableNumber}`
                            : ""}
                        </div>
                        <div className="col-span-1 text-right text-gray-700">
                          {order.itemCount}
                        </div>
                        <div className="col-span-2 text-right font-semibold">
                          {money(order.total)}
                        </div>
                        <div className="col-span-1 flex justify-end">
                          <button
                            type="button"
                            onClick={() => openReportPrint(order)}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                          >
                            Print
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
