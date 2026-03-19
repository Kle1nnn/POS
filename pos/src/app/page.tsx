"use client";
import { useState } from "react";
import Searchbar from "./components/Searchbar";
import MenuGrid from "./components/MenuGrid";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen font-sans bg-[#f0f2f5]">
      <Searchbar value={searchQuery} onChange={setSearchQuery} />
      <MenuGrid searchQuery={searchQuery} />
    </div>
  );
}
