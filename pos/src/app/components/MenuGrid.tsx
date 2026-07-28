"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart, makeCartKey } from "../context/CartContext";
import { products } from "../data/products";
import type { Product } from "./Product";

const BUILTIN_CATEGORY_TILES = [
  { key: "Burger", label: "Burgers", emoji: "🍔", image: "burger.png" },
  { key: "Broast", label: "Broast", emoji: "🍗", image: "broast.png" },
  { key: "Rolls", label: "Rolls", emoji: "🌯", image: "roll.png" },
  { key: "Shawarma", label: "Shawarma", emoji: "🥙", image: "shawarma.png" },
  { key: "Fries", label: "Fries", emoji: "🍟", image: "fries.png" },
  { key: "Sandwich", label: "Sandwich", emoji: "🍔", image: "sandwich.png" },
  { key: "Pasta", label: "Pasta", emoji: "🍝", image: "pasta.png" },
  { key: "BarBQ", label: "BarBQ", emoji: "🧂", image: "bbq.png" },
  { key: "Drinks", label: "Drinks", emoji: "🍹", image: "drink.png" },
  { key: "Toping", label: "Toping", emoji: "🧂", image: "dip.png" },
  { key: "Deals", label: "Deals", emoji: "🧂", image: "deals.png" },
];

const baseProducts: Product[] = products.map((p) =>
  p.category === "Rolls" && p.image === "shawarma.png"
    ? { ...p, category: "Shawarma" }
    : p,
);

type CategoryTile = {
  key: string;
  label: string;
  emoji: string;
  image: string;
};

type Selection =
  | { mode: "none" }
  | { mode: "pizza"; productId: string }
  | { mode: "category"; category: string };

export default function MenuGrid({
  searchQuery = "",
}: {
  searchQuery?: string;
}) {
  const { addToCart } = useCart();
  const router = useRouter();
  const [selection, setSelection] = useState<Selection>({ mode: "none" });
  const [customProducts, setCustomProducts] = useState<Product[]>([]);
  const [customCategories, setCustomCategories] = useState<CategoryTile[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          fetch("/api/catalog/products"),
          fetch("/api/catalog/categories"),
        ]);
        if (!productsRes.ok || !categoriesRes.ok) return;
        const productsData = await productsRes.json();
        const categoriesData = await categoriesRes.json();
        if (cancelled) return;

        setCustomProducts(
          (productsData.products ?? []).map(
            (p: {
              id: string;
              name: string;
              description: string;
              basePrice: number;
              image: string;
              category: string;
            }) => ({
              id: p.id,
              name: p.name,
              description: p.description || p.name,
              basePrice: Number(p.basePrice),
              image: p.image || "deals.png",
              category: p.category,
            }),
          ),
        );
        setCustomCategories(
          (categoriesData.categories ?? []).map(
            (c: {
              name: string;
              label: string;
              emoji: string;
              image: string;
            }) => ({
              key: c.name,
              label: c.label || c.name,
              emoji: c.emoji || "📦",
              image: c.image || "deals.png",
            }),
          ),
        );
      } catch (error) {
        console.error("Failed to load custom catalog", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const allProducts = useMemo(
    () => [...baseProducts, ...customProducts],
    [customProducts],
  );

  const pizzaProducts = useMemo(
    () => allProducts.filter((p) => p.category === "Pizza"),
    [allProducts],
  );

  const categoryTiles = useMemo(() => {
    const builtinKeys = new Set(
      BUILTIN_CATEGORY_TILES.map((c) => c.key.toLowerCase()),
    );
    const extras = customCategories.filter(
      (c) => !builtinKeys.has(c.key.toLowerCase()),
    );
    return [...BUILTIN_CATEGORY_TILES, ...extras];
  }, [customCategories]);

  const togglePizza = (id: string) =>
    setSelection((p) =>
      p.mode === "pizza" && p.productId === id
        ? { mode: "none" }
        : { mode: "pizza", productId: id },
    );

  const toggleCategory = (cat: string) =>
    setSelection((p) =>
      p.mode === "category" && p.category === cat
        ? { mode: "none" }
        : { mode: "category", category: cat },
    );

  const addPizzaSize = (productId: string, size: string) => {
    const product = pizzaProducts.find((p) => p.id === productId);
    if (!product) return;
    addToCart({
      ...product,
      cartKey: makeCartKey(product.id, size),
      selectedSize: size,
      selectedTopping: "None",
      selectedSauce: "None",
      price: product.sizePrices?.[size] ?? product.basePrice,
    });
  };

  const addSimpleProduct = (id: string) => {
    const product = allProducts.find((p) => p.id === id);
    if (!product) return;
    addToCart({
      ...product,
      cartKey: makeCartKey(product.id),
      price: product.basePrice,
    });
  };

  const query = searchQuery.trim().toLowerCase();
  const isSearching = query.length > 0;
  const searchResults = isSearching
    ? allProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query),
      )
    : [];

  const selectedPizza =
    selection.mode === "pizza"
      ? pizzaProducts.find((p) => p.id === selection.productId)
      : null;
  const subItems =
    selection.mode === "category"
      ? allProducts.filter((p) => p.category === selection.category)
      : [];

  const navButtons = (
    <div className="flex justify-end gap-2 px-3 pb-3 pt-2">
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a3a5c] text-white text-sm font-semibold hover:bg-[#1565c0] active:scale-95 transition-all"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
        Menu
      </button>
      <button
        onClick={() => router.push("/Orders")}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#7a4a00] text-white text-sm font-semibold hover:bg-amber-700 active:scale-95 transition-all"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        Orders
      </button>
      <button
        onClick={() => router.push("/History")}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1a5c2a] text-white text-sm font-semibold hover:bg-green-700 active:scale-95 transition-all"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        History
      </button>
    </div>
  );

  const tileGrid = (
    <div className="flex flex-wrap gap-2 p-3 bg-[#1e3a5f] justify-center">
      {pizzaProducts.map((pizza) => {
        const isSelected =
          selection.mode === "pizza" && selection.productId === pizza.id;
        const shortName = pizza.name.replace(/ Pizza$/i, "");
        return (
          <Tile
            key={pizza.id}
            label={shortName}
            image="pizzaa.png"
            selected={isSelected}
            selectedColor="blue"
            onClick={() => togglePizza(pizza.id)}
          />
        );
      })}
      {categoryTiles.map((cat) => {
        const isSelected =
          selection.mode === "category" && selection.category === cat.key;
        return (
          <Tile
            key={cat.key}
            label={cat.label}
            image={cat.image}
            fallbackEmoji={cat.emoji}
            selected={isSelected}
            selectedColor="orange"
            onClick={() => toggleCategory(cat.key)}
          />
        );
      })}
    </div>
  );

  if (isSearching) {
    return (
      <div className="flex flex-col min-h-0">
        <div className="flex flex-wrap gap-2 p-3 bg-[#1e3a5f] justify-center">
          {searchResults.length === 0 ? (
            <div className="text-center py-16 text-white/60 w-full">
              No products found
            </div>
          ) : (
            searchResults.map((p) => {
              const isPizza = p.category === "Pizza";
              const isSelected =
                selection.mode === "pizza" && selection.productId === p.id;
              return (
                <Tile
                  key={p.id}
                  label={p.name}
                  image={p.image}
                  selected={isSelected}
                  selectedColor="blue"
                  onClick={() =>
                    isPizza ? togglePizza(p.id) : addSimpleProduct(p.id)
                  }
                />
              );
            })
          )}
        </div>
        {selectedPizza && (
          <SizePicker pizza={selectedPizza} onAdd={addPizzaSize} />
        )}
        {navButtons}
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0">
      {tileGrid}
      {selection.mode === "pizza" && selectedPizza && (
        <SizePicker pizza={selectedPizza} onAdd={addPizzaSize} />
      )}
      {selection.mode === "category" && subItems.length > 0 && (
        <SubItemPanel
          category={selection.category}
          items={subItems}
          onAdd={addSimpleProduct}
        />
      )}
      {navButtons}
    </div>
  );
}

// ── Tile ──────────────────────────────────────────────────────────────────
function Tile({
  label,
  image,
  fallbackEmoji,
  selected,
  selectedColor,
  onClick,
}: {
  label: string;
  image: string;
  fallbackEmoji?: string;
  selected: boolean;
  selectedColor: "blue" | "orange";
  onClick: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const ring = selected
    ? selectedColor === "blue"
      ? "border-[#64b5f6] bg-[#bbdefb]"
      : "border-[#ffb74d] bg-[#ffe0b2]"
    : "border-[#4a7aa8] bg-[#dce8f5] hover:border-[#90caf9] hover:bg-[#cfe2f7]";

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-start border-2 rounded-xl active:scale-95 transition-all overflow-hidden ${ring}`}
      style={{ width: 90, minHeight: 90 }}
    >
      <div
        className="w-full flex items-center justify-center bg-[#c8daea]"
        style={{ height: 58 }}
      >
        {image && !imgError ? (
          <img
            src={`/${image}`}
            alt={label}
            onError={() => setImgError(true)}
            className="object-contain"
            style={{ width: 50, height: 50 }}
          />
        ) : (
          <span className="text-2xl">{fallbackEmoji ?? "🍽️"}</span>
        )}
      </div>
      <div className="w-full px-1 py-1 text-center">
        <span className="text-[0.72rem] font-bold text-[#1a3a5c] leading-tight line-clamp-2 block">
          {label}
        </span>
      </div>
    </button>
  );
}

// ── Size picker ───────────────────────────────────────────────────────────
function SizePicker({
  pizza,
  onAdd,
}: {
  pizza: {
    id: string;
    name: string;
    sizePrices?: Record<string, number>;
    sizes?: string[];
  };
  onAdd: (id: string, size: string) => void;
}) {
  const sizes = pizza.sizes ?? ["S", "M", "L"];
  return (
    <div className="border-t-2 border-[#1565c0] bg-white">
      <div className="flex items-center bg-[#1565c0] px-4 py-2">
        <span className="text-white text-sm font-bold flex-1 text-center">
          {pizza.name}
        </span>
      </div>
      <div className="flex gap-3 p-4 bg-[#e8eef5] justify-center">
        {sizes.map((size) => {
          const price = pizza.sizePrices?.[size];
          return (
            <button
              key={size}
              onClick={() => onAdd(pizza.id, size)}
              className="flex flex-col items-center border-2 border-[#b0c4de] rounded-xl bg-white hover:border-[#1565c0] active:scale-95 transition-all overflow-hidden"
              style={{ width: 110 }}
            >
              <div
                className="w-full flex items-center justify-center bg-[#dce8f5]"
                style={{ height: 70 }}
              >
                <img
                  src="/pizzaa.png"
                  alt={size}
                  className="object-contain"
                  style={{ width: 60, height: 60 }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="px-2 py-1 text-center">
                <p className="text-[0.7rem] text-gray-700 font-semibold">
                  {pizza.name.replace(/ Pizza$/i, "")} {size}
                </p>
              </div>
              <div className="w-full bg-[#2e7d32] text-white text-sm font-bold text-center py-1.5">
                Rs : {price ?? "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Sub-item panel ────────────────────────────────────────────────────────
function SubItemPanel({
  category,
  items,
  onAdd,
}: {
  category: string;
  items: { id: string; name: string; basePrice: number; image: string }[];
  onAdd: (id: string) => void;
}) {
  const [added, setAdded] = useState<string | null>(null);
  const handleAdd = (id: string) => {
    onAdd(id);
    setAdded(id);
    setTimeout(() => setAdded(null), 800);
  };
  return (
    <div className="border-t-2 border-[#b84c00] bg-white">
      <div className="flex items-center bg-[#b84c00] px-4 py-2">
        <span className="text-white text-sm font-bold flex-1 text-center">
          {category}
        </span>
      </div>
      <div className="flex flex-wrap gap-3 p-4 bg-[#e8eef5] justify-center">
        {items.map((item) => {
          const isAdded = added === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleAdd(item.id)}
              className={`flex flex-col items-center border-2 rounded-xl bg-white active:scale-95 transition-all overflow-hidden ${isAdded ? "border-green-500" : "border-[#b0c4de] hover:border-[#b84c00]"}`}
              style={{ width: 110 }}
            >
              <div
                className="w-full flex items-center justify-center bg-[#dce8f5]"
                style={{ height: 70 }}
              >
                {item.image ? (
                  <img
                    src={`/${item.image}`}
                    alt={item.name}
                    className="object-contain"
                    style={{ width: 60, height: 60 }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-3xl">🍽️</span>
                )}
              </div>
              <div className="px-2 py-1 text-center flex-1 flex items-center">
                <p className="text-[0.7rem] text-gray-700 font-semibold leading-tight">
                  {item.name}
                </p>
              </div>
              <div
                className={`w-full text-white text-sm font-bold text-center py-1.5 ${isAdded ? "bg-green-600" : "bg-[#2e7d32]"}`}
              >
                {isAdded ? "✓ Added" : `Rs : ${item.basePrice}`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
