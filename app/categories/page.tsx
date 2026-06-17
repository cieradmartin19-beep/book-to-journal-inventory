"use client";

import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { createCategory, deleteCategory, fetchCategories, updateCategory } from "@/lib/categories";
import type { Category } from "@/lib/types";

export default function ManageCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#7CC9A7");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadCategories() {
    setError("");
    try {
      setCategories(await fetchCategories());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Categories could not be loaded.");
    }
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  async function addCategory() {
    setError("");
    setMessage("");
    try {
      const created = await createCategory(name, color);
      setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setName("");
      setMessage(`${created.name} created.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Category could not be created.");
    }
  }

  async function saveCategory(category: Category) {
    setError("");
    setMessage("");
    try {
      const saved = await updateCategory(category.id, { name: category.name, color: category.color });
      setCategories((current) => current.map((item) => (item.id === saved.id ? saved : item)).sort((a, b) => a.name.localeCompare(b.name)));
      setMessage(`${saved.name} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Category could not be saved.");
    }
  }

  async function removeCategory(category: Category) {
    if (!window.confirm(`Delete ${category.name}? Books assigned to it will become Uncategorized.`)) return;
    setError("");
    setMessage("");
    try {
      await deleteCategory(category.id);
      setCategories((current) => current.filter((item) => item.id !== category.id));
      setMessage(`${category.name} deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Category could not be deleted.");
    }
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/" className="btn-secondary">
          <ArrowLeft size={20} aria-hidden />
          Library
        </Link>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="panel p-4 sm:p-5">
          <p className="text-sm font-black uppercase tracking-wide text-marigold">Manage Categories</p>
          <h1 className="mt-1 font-serif text-3xl font-black sm:text-4xl">Custom book categories</h1>
          <p className="mt-3 text-sm font-semibold text-ink/65">
            Categories are scoped to the current user, so each person can organize their inventory their own way.
          </p>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-2">
              <span className="label">New category name</span>
              <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="label">Color</span>
              <input className="h-12 w-full rounded-lg border-2 border-ink/15 bg-white p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
            <button className="btn-primary w-full" onClick={addCategory}>
              <Plus size={20} aria-hidden />
              Create Category
            </button>
          </div>

          {message ? <p className="mt-4 rounded-lg bg-mint/25 p-3 text-sm font-bold text-ink">{message}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
        </div>

        <div className="panel grid gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-marigold">Your categories</p>
            <p className="mt-1 text-sm font-semibold text-ink/65">Rename, recolor, or delete categories.</p>
          </div>

          {categories.length > 0 ? categories.map((category) => (
            <div className="grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_80px_auto_auto] sm:items-center" key={category.id}>
              <input
                className="field"
                value={category.name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setCategories((current) => current.map((item) => item.id === category.id ? { ...item, name: nextName } : item));
                }}
              />
              <input
                className="h-11 w-full rounded-lg border-2 border-ink/15 bg-white p-1"
                type="color"
                value={category.color}
                onChange={(event) => {
                  const nextColor = event.target.value;
                  setCategories((current) => current.map((item) => item.id === category.id ? { ...item, color: nextColor } : item));
                }}
              />
              <button className="btn-secondary" onClick={() => saveCategory(category)}>
                <Save size={18} aria-hidden />
                Save
              </button>
              <button className="btn-secondary" onClick={() => removeCategory(category)}>
                <Trash2 size={18} aria-hidden />
                Delete
              </button>
            </div>
          )) : (
            <p className="rounded-lg bg-honey/20 p-3 text-sm font-bold text-ink/65">No categories yet.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}
