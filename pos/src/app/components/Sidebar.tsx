"use client";

import { useState } from "react";
import Link from "next/link";
import { Clock, House, Settings, ShoppingCart } from "lucide-react";
export default function Sidebar() {
  const [open, setOpen] = useState(true);

  const navItems = [
    { icon: <House color="black" />, label: "Menu", href: "/" },
    { icon: <ShoppingCart color="black" />, label: "Orders", href: "/orders" },
    { icon: <Clock color="black" />, label: "History", href: "/history" },
    { icon: <Settings color="black" />, label: "Settings", href: "/settings" },
  ];

  return (
    <div>
      {/* Toggle Button (Mobile Only) */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed top-4 left-4 z-50 bg-black text-white px-3 py-2 rounded md:hidden"
      >
        ☰
      </button>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 mt-0 ml-0 rounded-xl h-screen bg-white text-black w-28 shadow-2xs
        transform transition-transform duration-300 ease-in-out
        ${open ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Header */}
        <div className="p-6 text-xl text-center font-bold  border-gray-300">
          POS
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-4">
          {navItems.map((item, index) => (
            <Link
              key={index}
              href={item.href}
              className="flex flex-col items-center justify-center w-18 aspect-square bg-white rounded-lg border border-white hover:bg-brown hover:text-white hover:scale-105 hover:shadow-lg transition-all duration-300 ease-in-out cursor-pointer text-sm font-medium"
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
    </div>
  );
}
