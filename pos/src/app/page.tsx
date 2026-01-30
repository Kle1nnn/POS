import Navbar from "./components/Navbar";
import Searchbar from "./components/Searchbar";

export default function Home() {
  return (
    <div className="flex-col min-h-screen bg-zinc-50 font-sans">
      <Searchbar />
      <Navbar />
    </div>
  );
}
