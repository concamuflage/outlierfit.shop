

"use client";

import React from "react";

type FilterSidebarProps = {
  title?: string;
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
};

export default function FilterSidebar({
  title = "Categories",
  categories,
  selectedCategory,
  onSelectCategory,
}: FilterSidebarProps) {
  return (
    <aside className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        <button
          type="button"
          className="text-xs text-zinc-600 hover:underline"
          onClick={() => onSelectCategory(null)}
          disabled={selectedCategory === null}
        >
          Clear
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          className={`flex items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
            selectedCategory === null
              ? "bg-zinc-900 text-white"
              : "hover:bg-zinc-50"
          }`}
          onClick={() => onSelectCategory(null)}
        >
          <span>All</span>
        </button>

        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              className={`flex items-center justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
                active ? "bg-zinc-900 text-white" : "hover:bg-zinc-50"
              }`}
              onClick={() => onSelectCategory(cat)}
            >
              <span>{cat}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-xs text-zinc-600">
        Tip: start with your height range and preferred fit. You can refine filters later.
      </div>
    </aside>
  );
}