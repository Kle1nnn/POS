"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: number;
  name: string;
  phone: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/customers?all=1");
        const data = await res.json();
        setCustomers(data.customers ?? []);
      } catch (error) {
        console.error("Failed to load customers", error);
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, query]);

  const updateDraft = (id: number, field: "name" | "phone", value: string) => {
    setCustomers((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  const saveCustomer = async (customer: Customer) => {
    if (!customer.name.trim()) {
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
          name: customer.name.trim(),
          phone: customer.phone.trim(),
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
      setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast("Customer updated");
    } catch (error) {
      console.error("Failed to update customer", error);
      showToast("Update failed");
    } finally {
      setSavingId(null);
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
        <p className="text-sm text-gray-500 mb-4">
          Edit previously saved customer names and phone numbers.
        </p>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or phone..."
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
              {filteredCustomers.map((customer) => (
                <div key={customer.id} className="p-4 grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-5">
                    <input
                      value={customer.name}
                      onChange={(e) =>
                        updateDraft(customer.id, "name", e.target.value)
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="col-span-4">
                    <input
                      value={customer.phone}
                      onChange={(e) =>
                        updateDraft(customer.id, "phone", e.target.value)
                      }
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <div className="col-span-3 flex justify-end">
                    <button
                      onClick={() => saveCustomer(customer)}
                      disabled={savingId === customer.id}
                      className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-semibold hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      {savingId === customer.id ? "Saving..." : "✏️ Update"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
