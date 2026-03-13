"use client";
import { useCart } from "../context/CartContext";
import { useOrders } from "../context/OrdersContext";
import { useState } from "react";

export default function Billing() {
  const { cartItems, removeFromCart, clearCart, updateQuantity, totalPrice } =
    useCart();
  const { saveOrder, checkoutOrder } = useOrders();
  const [open, setOpen] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const handleSaveOrder = async () => {
    if (cartItems.length === 0) return;
    const orderId = saveOrder([...cartItems], totalPrice, notes);
    try {
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: orderId,
          items: cartItems.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            selectedSize: item.selectedSize,
            selectedTopping: item.selectedTopping,
            selectedSauce: item.selectedSauce,
            price: item.price,
            quantity: item.quantity,
          })),
          total: totalPrice,
          notes,
        }),
      });
    } catch (error) {
      console.error("Failed to persist saved order to database", error);
    }
    clearCart();
    setNotes("");
    showToast("Order saved!");
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) return;
    const orderId = saveOrder([...cartItems], totalPrice, notes);
    try {
      // 1) Insert as saved
      await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderCode: orderId,
          items: cartItems.map((item) => ({
            id: item.id,
            name: item.name,
            category: item.category,
            selectedSize: item.selectedSize,
            selectedTopping: item.selectedTopping,
            selectedSauce: item.selectedSauce,
            price: item.price,
            quantity: item.quantity,
          })),
          total: totalPrice,
          notes,
        }),
      });
      // 2) Flip to checkedout so trigger fires
      await fetch("/api/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: orderId }),
      });
    } catch (error) {
      console.error("Failed to persist checkout to database", error);
    }
    checkoutOrder(orderId);
    clearCart();
    setNotes("");
    showToast("Order checked out!");
  };

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 right-4 z-50 bg-amber-900 text-white px-3 py-2 rounded-lg md:hidden shadow-lg"
      >
        🧾
      </button>

      <aside
        className={`fixed top-0 right-0 h-screen bg-white text-black w-72 shadow-xl z-40 flex flex-col
          transform transition-transform duration-300 ease-in-out
          ${open ? "translate-x-0" : "translate-x-full"} md:translate-x-0`}
      >
        <div className="px-4 py-3 text-sm text-center font-semibold tracking-wide border-b border-gray-100 bg-amber-900 text-white">
          Billing
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#f5efe7]">
          {cartItems.length === 0 ? (
            <div className="text-center text-gray-400 py-16 flex flex-col items-center gap-2">
              <span className="text-4xl">🛒</span>
              <p className="text-sm">No items added yet</p>
            </div>
          ) : (
            cartItems.map((item) => (
              <div
                key={item.cartKey}
                className="bg-white rounded-2xl p-3 border border-[#f1e5d8] shadow-sm"
              >
                <div className="flex gap-3">
                  {/* Thumbnail placeholder */}
                  <div className="w-10 h-14 rounded-xl bg-gradient-to-b from-[#e0d2c4] to-[#c9b39a]" />

                  <div className="flex-1">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-sm text-gray-900 leading-tight">
                          {item.name}
                          {item.selectedSize &&
                            item.selectedSize !== "N/A" && (
                              <span className="text-gray-500 font-normal">
                                {" "}
                                · {item.selectedSize}
                              </span>
                            )}
                        </h3>

                        {((item.selectedTopping &&
                          item.selectedTopping !== "None") ||
                          (item.selectedSauce &&
                            item.selectedSauce !== "None")) && (
                          <div className="flex gap-1 flex-wrap mt-1">
                            {item.selectedTopping &&
                              item.selectedTopping !== "None" && (
                                <span className="text-[0.65rem] bg-orange-50 text-orange-700 px-1.5 py-0.5 rounded-full">
                                  {item.selectedTopping}
                                </span>
                              )}
                            {item.selectedSauce &&
                              item.selectedSauce !== "None" && (
                                <span className="text-[0.65rem] bg-yellow-50 text-yellow-700 px-1.5 py-0.5 rounded-full">
                                  {item.selectedSauce}
                                </span>
                              )}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => removeFromCart(item.cartKey)}
                        className="text-gray-300 hover:text-red-500 transition-colors text-lg leading-none flex-shrink-0"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span>x{item.quantity}</span>
                        {notes && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-[#fce9db] text-[0.65rem] text-[#8b5a3c]">
                            Notes ✏
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateQuantity(item.cartKey, item.quantity - 1)
                          }
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold flex items-center justify-center transition-colors"
                        >
                          −
                        </button>
                        <span className="text-sm font-semibold w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(item.cartKey, item.quantity + 1)
                          }
                          className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 text-xs font-bold flex items-center justify-center transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end justify-between text-right">
                    <span className="font-semibold text-sm text-gray-900">
                      Rs. {(item.price * item.quantity).toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-100 px-4 py-3 bg-white">
          <div className="flex justify-between text-base font-semibold mb-2 text-gray-900">
            <span>Total</span>
            <span>Rs. {totalPrice.toFixed(0)}</span>
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add order notes (optional)..."
            rows={2}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 mb-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-900/20"
          />

          <div className="space-y-1.5">
            <button
              onClick={handleSaveOrder}
              disabled={cartItems.length === 0}
              className="w-full bg-gray-900 text-white py-2 rounded-lg hover:bg-gray-800 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              💾 Save Order
            </button>
            <button
              onClick={handleCheckout}
              disabled={cartItems.length === 0}
              className="w-full bg-amber-900 text-white py-2 rounded-lg hover:bg-amber-800 text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✅ Checkout
            </button>
            <button
              onClick={clearCart}
              className="w-full bg-gray-200 text-gray-700 py-1.5 rounded-lg hover:bg-gray-300 transition-colors text-[0.7rem]"
            >
              Clear Cart
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
