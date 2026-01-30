"use client";

export default function Searchbar() {
  return (
    <div className="flex h-8 top-0 items-center justify-between w-full px-5">
      <div className="font-bold text-xl ml-3 py-4">Search</div>
      <input
        type="text"
        placeholder="Search Menu"
        className="bg-white shadow-2xl rounded-md px-3 py-1 w-1/2"
      />
    </div>
  );
}
