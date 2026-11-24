"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Search, Trash2, X } from "lucide-react";
import clsx from "clsx";
import {
  createCollection,
  deleteCollection,
  updateCollection,
} from "@/lib/adminApi";
import type { Category, Collection, Product } from "@/lib/types";

const inputCls =
  "w-full border-2 border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-brand transition-colors";
const labelCls =
  "mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-muted";

const price = (p: Product) => p.salePrice ?? p.basePrice;

interface FormState {
  id?: string;
  nameEn: string;
  nameAr: string;
  productIds: string[];
  bundlePrice: number;
  category: string;
}

const emptyForm: FormState = {
  nameEn: "",
  nameAr: "",
  productIds: [],
  bundlePrice: 0,
  category: "",
};

export default function CollectionsClient({
  collections,
  products,
  categories,
}: {
  collections: Collection[];
  products: Product[];
  categories: Category[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const selectedTotal = useMemo(
    () =>
      form.productIds.reduce((sum, id) => {
        const p = productById.get(id);
        return sum + (p ? price(p) : 0);
      }, 0),
    [form.productIds, productById]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.name.en.toLowerCase().includes(q));
  }, [products, search]);

  const toggleProduct = (id: string) =>
    setForm((f) => ({
      ...f,
      productIds: f.productIds.includes(id)
        ? f.productIds.filter((x) => x !== id)
        : [...f.productIds, id],
    }));

  const openNew = () => {
    setForm(emptyForm);
    setSearch("");
    setError(null);
    setCreating(true);
  };

  const openEdit = (c: Collection) => {
    setForm({
      id: c.id,
      nameEn: c.name.en,
      nameAr: c.name.ar,
      productIds: c.products.map((p) => p.id),
      bundlePrice: c.bundlePrice,
      category: c.category?.id ?? "",
    });
    setSearch("");
    setError(null);
    setCreating(true);
  };

  const submit = async () => {
    if (!form.nameEn.trim() || !form.nameAr.trim()) {
      setError("Collection name (EN and AR) is required.");
      return;
    }
    if (form.productIds.length < 1) {
      setError("Pick at least one product.");
      return;
    }
    if (form.bundlePrice <= 0) {
      setError("Bundle price must be above zero.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: { en: form.nameEn.trim(), ar: form.nameAr.trim() },
        products: form.productIds,
        bundlePrice: form.bundlePrice,
        category: form.category,
      };
      if (form.id) {
        await updateCollection(form.id, payload);
      } else {
        await createCollection({ ...payload, isActive: true });
      }
      setCreating(false);
      setForm(emptyForm);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (c: Collection) => {
    setBusy(true);
    try {
      await updateCollection(c.id, { isActive: !c.isActive });
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: Collection) => {
    if (!window.confirm(`Delete collection "${c.name.en}"?`)) return;
    setBusy(true);
    try {
      await deleteCollection(c.id);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display uppercase text-2xl text-navy">Collections</h1>
        <button
          onClick={() => (creating ? setCreating(false) : openNew())}
          className="skew-cta flex items-center gap-2 bg-brand px-5 py-2.5 text-sm font-display uppercase tracking-wider text-white hover:bg-brand-dark transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Plus size={16} /> New Collection
          </span>
        </button>
      </div>

      {creating && (
        <div className="mt-6 border-2 border-brand/30 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display uppercase text-lg text-navy">
              {form.id ? "Edit Collection" : "New Collection"}
            </h2>
            <button
              onClick={() => setCreating(false)}
              aria-label="Close form"
              className="text-muted hover:text-brand cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Name (English)</label>
              <input
                value={form.nameEn}
                onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
                placeholder="Summer Bundle"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>الاسم (عربي)</label>
              <input
                value={form.nameAr}
                onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
                placeholder="طقم الصيف"
                dir="rtl"
                className={inputCls}
              />
            </div>
          </div>

          <div className="mt-4 sm:max-w-xs">
            <label className={labelCls}>Category (optional)</label>
            <select
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className={inputCls}
            >
              <option value="">— None —</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name.en}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4">
            <label className={labelCls}>
              Products ({form.productIds.length} selected)
            </label>
            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products…"
                className={clsx(inputCls, "ps-9")}
              />
            </div>
            <div className="max-h-64 overflow-y-auto border-2 border-navy/10">
              {filtered.map((p) => {
                const checked = form.productIds.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className={clsx(
                      "flex cursor-pointer items-center gap-3 border-b border-navy/5 px-3 py-2 text-sm hover:bg-brand/5",
                      checked && "bg-brand/5"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleProduct(p.id)}
                      className="h-4 w-4 accent-brand"
                    />
                    {p.images[0]?.url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.images[0].url}
                        alt=""
                        className="h-9 w-9 shrink-0 object-cover"
                      />
                    )}
                    <span className="flex-1 font-bold text-navy">{p.name.en}</span>
                    <span className="font-extrabold text-navy">
                      {price(p).toLocaleString()} EGP
                    </span>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted">No products match.</p>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex flex-col justify-end">
              <span className={labelCls}>Original total</span>
              <span className="text-lg font-extrabold text-muted line-through">
                {selectedTotal.toLocaleString()} EGP
              </span>
            </div>
            <div>
              <label className={labelCls}>Bundle Price (EGP)</label>
              <input
                type="number"
                value={form.bundlePrice}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bundlePrice: +e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div className="flex flex-col justify-end">
              <span className={labelCls}>Customer saves</span>
              <span className="text-lg font-extrabold text-brand">
                {Math.max(0, selectedTotal - (form.bundlePrice || 0)).toLocaleString()} EGP
              </span>
            </div>
          </div>

          {error && <p className="mt-3 text-xs font-bold text-brand">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className={clsx(
              "skew-cta mt-4 bg-brand px-6 py-2.5 text-sm font-display uppercase tracking-wider text-white hover:bg-brand-dark transition-colors cursor-pointer",
              busy && "opacity-60"
            )}
          >
            <span>{busy ? "Saving…" : form.id ? "Save Collection" : "Create Collection"}</span>
          </button>
        </div>
      )}

      <div className="mt-6 overflow-x-auto bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b-2 border-navy text-[11px] font-extrabold uppercase tracking-wider text-muted">
              <th className="px-4 py-3 text-start">Collection</th>
              <th className="px-4 py-3 text-end">Products</th>
              <th className="px-4 py-3 text-end">Original</th>
              <th className="px-4 py-3 text-end">Bundle</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {collections.map((c) => (
              <tr key={c.id} className="border-b border-navy/5 hover:bg-brand/5">
                <td className="px-4 py-3 font-bold text-navy">{c.name.en}</td>
                <td className="px-4 py-3 text-end text-muted">{c.products.length}</td>
                <td className="px-4 py-3 text-end text-muted line-through">
                  {c.originalTotal.toLocaleString()} EGP
                </td>
                <td className="px-4 py-3 text-end font-extrabold text-navy">
                  {c.bundlePrice.toLocaleString()} EGP
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "px-2 py-1 text-[10px] font-extrabold uppercase",
                      c.isActive
                        ? "bg-success/10 text-success"
                        : "bg-surface text-muted"
                    )}
                  >
                    {c.isActive ? "Active" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      disabled={busy}
                      className="px-2 py-1 text-[11px] font-extrabold uppercase text-navy hover:text-brand transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(c)}
                      disabled={busy}
                      aria-label={c.isActive ? `Hide ${c.name.en}` : `Show ${c.name.en}`}
                      title={c.isActive ? "Hide" : "Show"}
                      className="p-2 text-muted hover:text-navy transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {c.isActive ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => remove(c)}
                      disabled={busy}
                      aria-label={`Delete ${c.name.en}`}
                      className="p-2 text-muted hover:text-brand transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {collections.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  No collections yet. Create one from your products.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
