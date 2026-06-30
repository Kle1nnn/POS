"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: number;
  name: string;
  phone: string;
};

type CustomerDraft = {
  name: string;
  phone: string;
};

function draftsFromCustomers(customers: Customer[]): Record<number, CustomerDraft> {
  return Object.fromEntries(
    customers.map((c) => [c.id, { name: c.name, phone: c.phone }]),
  );
}

export default function SettingsPage() {
  const router = useRouter();
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
  const [toast, setToast] = useState<string | null>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return savedCustomers;
    return savedCustomers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [savedCustomers, query]);

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

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
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
      if (!res.ok) {
        throw new Error("Backup failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      anchor.href = url;
      anchor.download = `pos-backup-${stamp}.json`;
      anchor.click();
      URL.revokeObjectURL(url);

      // #region agent log
      fetch("http://127.0.0.1:7480/ingest/9a20f3ee-1884-4721-a3e7-1497e20d6670", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "507331",
        },
        body: JSON.stringify({
          sessionId: "507331",
          location: "settings/page.tsx:backupAllData",
          message: "Backup download triggered",
          data: { size: blob.size },
          timestamp: Date.now(),
          hypothesisId: "backup-ui",
        }),
      }).catch(() => {});
      // #endregion

      showToast("Backup downloaded");
    } catch (error) {
      console.error("Failed to backup data", error);
      showToast("Backup failed");
    } finally {
      setIsBackingUp(false);
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

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        restored?: { orders: number; customers: number; orderItems: number };
      };

      if (!res.ok) {
        throw new Error(data.error ?? "Restore failed");
      }

      // #region agent log
      fetch("http://127.0.0.1:7480/ingest/9a20f3ee-1884-4721-a3e7-1497e20d6670", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "507331",
        },
        body: JSON.stringify({
          sessionId: "507331",
          location: "settings/page.tsx:restoreFromBackup",
          message: "Restore completed",
          data: data.restored ?? {},
          timestamp: Date.now(),
          hypothesisId: "restore-ui",
        }),
      }).catch(() => {});
      // #endregion

      await loadCustomers();
      showToast("Data restored successfully");
    } catch (error) {
      console.error("Failed to restore backup", error);
      showToast("Restore failed");
    } finally {
      setIsRestoring(false);
      if (restoreInputRef.current) {
        restoreInputRef.current.value = "";
      }
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

  return (
    <div className="min-h-screen bg-[#f0f2f5]">
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">⚙️ Customer Names</h1>
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

      <div className="p-6 max-w-4xl">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Data backup &amp; restore
          </p>
          <p className="text-sm text-gray-500 mb-3">
            Download a full backup of orders, contacts, and sales data, or restore
            from a previously saved backup file.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={backupAllData}
              disabled={isBackingUp || isRestoring}
              className="px-4 py-2 rounded-lg bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] disabled:opacity-50 transition-colors"
            >
              {isBackingUp ? "Backing up..." : "Backup All Data"}
            </button>
            <button
              onClick={() => restoreInputRef.current?.click()}
              disabled={isBackingUp || isRestoring}
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
          Add, edit, or remove saved customer contacts. Changes are only saved when
          you click Save Contact.
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
                  setNewContact((prev) => ({ ...prev, phone: e.target.value }))
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
            placeholder="Search by saved name or phone..."
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
                          savingId === customer.id || deletingId === customer.id
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
      </div>
    </div>
  );
}
