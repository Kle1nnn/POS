"use client";

import React from "react";

export default function Navbar() {
  const Menu = ["ALL", "Pizza", "Burger", "Rolls", "Fries", "Drinks"];

  return (
    <div className="flex justify-between px-4 py-8 h-25 w-full">
      {Menu.map((item, index) => (
        <div
          key={index}
          className="shrink h-20 w-18 shadow-2xs bg-white rounded-2xl flex items-center justify-center cursor-pointer hover:bg-lightpink hover:border border-brown transition ease-in-out duration-300"
        >
          {item}
        </div>
      ))}
    </div>
  );
}
