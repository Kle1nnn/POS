import Navbar from "./components/Navbar";
import ProductGrid from "./components/ProductGrid";
import Searchbar from "./components/Searchbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 font-sans mr-72">
      <Searchbar />
      <Navbar />
      <ProductGrid />
    </div>
  );
}
