"use client";
import { useState } from "react";
import Navbar from "./components/Navbar";
import ProductGrid from "./components/ProductGrid";
import Searchbar from "./components/Searchbar";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen font-sans">
      <Searchbar value={searchQuery} onChange={setSearchQuery} />
      <Navbar />
      <ProductGrid searchQuery={searchQuery} />
    </div>
  );
}
