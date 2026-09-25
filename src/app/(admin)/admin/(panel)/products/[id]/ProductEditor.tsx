"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Trash2, Upload, X } from "lucide-react";
import clsx from "clsx";
import {
  createProduct,
  deleteProduct,
  getAdminProduct,
  updateProduct,
  type ProductPayload,
} from "@/lib/adminApi";
import type {
  Category,
  FabricCare,
  Locale,
  Product,
  SizeChart,
  Variant,
} from "@/lib/types";
import { prepareImageUploads } from "@/lib/imageUpload";
import { SIZE_OPTIONS, orderSizes } from "@/lib/product";

const inputCls =
  "w-full border-2 border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-brand transition-colors";
const labelCls =
  "mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-muted";

const MAX_IMAGES = 8;
const MAX_FILE_MB = 15;

// The URL slug is derived from the English name — admins never edit it.
const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// The editor groups variants by COLOR: one color carries a list of sizes,
// each with its own stock. On save this flattens back to the backend's
// per-(color, size) variant array.
interface SizeRow {
  id: string;
  size: string;
  stock: number;
  sku: string;
  priceOverride: number | null;
}
interface ColorGroup {
  hex: string;
  name: string;
  sizes: SizeRow[];
}

interface ProductFormState {
  name: Product["name"];
  description: Product["description"];
  categoryIds: string[];
  basePrice: number;
  salePrice: number | "";
  badges: Product["badges"];
  active: boolean;
}

const blankGroup = (): ColorGroup => ({ hex: "#201d50", name: "", sizes: [] });

// Build the color-grouped model from the backend's flat variant list.
const groupVariants = (variants: Variant[]): ColorGroup[] => {
  if (variants.length === 0) return [blankGroup()];
  const map = new Map<string, ColorGroup>();
  for (const v of variants) {
    const key = (v.color.hex || v.color.name.en || "default").toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        hex: v.color.hex || "#201d50",
        name: v.color.name.en,
        sizes: [],
      });
    }
    map.get(key)!.sizes.push({
      id: v.id,
      size: v.size,
      stock: v.stock,
      sku: v.sku,
      priceOverride: v.priceOverride ?? null,
    });
  }
  return [...map.values()];
};

export default function ProductEditor({
  product,
  categories,
  mode,
}: {
  product: Product;
  categories: Category[];
  mode: "create" | "edit";
}) {
  const router = useRouter();
  const [lang, setLang] = useState<Locale>("en");

  // Flatten categories into a hierarchical, selectable list: each top-level
  // category followed by its subcategories (indented). Any category can be the
  // product's category.
  const categoryOptions = useMemo(() => {
    const tops = categories.filter((c) => !c.parentId);
    const orphans = categories.filter(
      (c) => c.parentId && !categories.some((t) => t.id === c.parentId)
    );
    const out: { id: string; label: string }[] = [];
    const push = (list: Category[]) => {
      for (const top of list) {
        out.push({ id: top.id, label: top.name.en });
        for (const child of categories.filter((c) => c.parentId === top.id)) {
          out.push({ id: child.id, label: `— ${child.name.en}` });
        }
      }
    };
    push(tops);
    // Categories whose parent isn't in the list still need to be selectable.
    orphans.forEach((c) => out.push({ id: c.id, label: c.name.en }));
    return out;
  }, [categories]);
  const [form, setForm] = useState<ProductFormState>(() => ({
    name: { ...product.name },
    description: { ...product.description },
    // The Product carries category SLUGS; the backend wants their ids.
    categoryIds: (() => {
      const slugs = product.categories?.length
        ? product.categories
        : product.category
          ? [product.category]
          : [];
      const ids = slugs
        .map((s) => categories.find((c) => c.slug === s)?.id)
        .filter((x): x is string => Boolean(x));
      return ids.length ? ids : categories[0]?.id ? [categories[0].id] : [];
    })(),
    basePrice: product.basePrice,
    salePrice: product.salePrice ?? "",
    badges: [...product.badges],
    active: true,
  }));
  // Images carry their category tags as slugs; the editor works with ids.
  const slugsToIds = (slugs: string[] | undefined) =>
    (slugs ?? [])
      .map((s) => categories.find((c) => c.slug === s)?.id)
      .filter((x): x is string => Boolean(x));
  const withCategoryIds = (imgs: Product["images"]) =>
    imgs.map((image) => ({
      ...image,
      categoryIds: slugsToIds(image.categories),
      mainForIds: slugsToIds(image.mainFor),
    }));
  const [images, setImages] = useState(() => withCategoryIds(product.images));
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  // Color hex chosen for each new device file (aligned to imageFiles order).
  const [imageFileColors, setImageFileColors] = useState<(string | undefined)[]>([]);
  // Category ids chosen for each new device file (aligned to imageFiles order).
  const [imageFileCategoryIds, setImageFileCategoryIds] = useState<string[][]>([]);
  // Categories each new device file is the main image of (aligned to imageFiles).
  const [imageFileMainForIds, setImageFileMainForIds] = useState<string[][]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object-URL previews for device files, revoked when the list changes.
  const filePreviews = useMemo(
    () => imageFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [imageFiles]
  );
  useEffect(
    () => () => filePreviews.forEach((p) => URL.revokeObjectURL(p.url)),
    [filePreviews]
  );

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const room = MAX_IMAGES - images.length - imageFiles.length;
    if (room <= 0) {
      setMessage({ kind: "error", text: `Up to ${MAX_IMAGES} images per product.` });
      return;
    }
    const valid: File[] = [];
    for (const file of Array.from(list)) {
      if (!file.type.startsWith("image/")) {
        setMessage({ kind: "error", text: `${file.name} is not an image.` });
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        setMessage({ kind: "error", text: `${file.name} is over ${MAX_FILE_MB}MB.` });
        continue;
      }
      valid.push(file);
    }
    const added = valid.slice(0, room);
    setImageFiles((fs) => [...fs, ...added]);
    setImageFileColors((cs) => [...cs, ...added.map(() => undefined)]);
    setImageFileCategoryIds((cs) => [...cs, ...added.map(() => [])]);
    setImageFileMainForIds((cs) => [...cs, ...added.map(() => [])]);
    if (valid.length > room) {
      setMessage({ kind: "error", text: `Only ${MAX_IMAGES} images allowed; extras were skipped.` });
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };
  const [colorGroups, setColorGroups] = useState<ColorGroup[]>(() =>
    groupVariants(product.variants)
  );

  // Size chart + fabric/care. Deep-cloned so edits don't mutate the prop.
  const cloneSizeChart = (sc: SizeChart): SizeChart => ({
    columns: sc.columns.map((c) => ({ ...c })),
    rows: sc.rows.map((r) => [...r]),
    note: { ...sc.note },
  });
  const cloneFabricCare = (fc: FabricCare): FabricCare => ({
    fabric: { ...fc.fabric },
    care: { ...fc.care },
  });
  const [sizeChart, setSizeChart] = useState<SizeChart>(() =>
    cloneSizeChart(product.sizeChart)
  );
  const [fabricCare, setFabricCare] = useState<FabricCare>(() =>
    cloneFabricCare(product.fabricCare)
  );

  const addColumn = () =>
    setSizeChart((sc) => ({
      ...sc,
      columns: [...sc.columns, { en: "", ar: "" }],
      rows: sc.rows.map((r) => [...r, ""]),
    }));
  const removeColumn = (ci: number) =>
    setSizeChart((sc) => ({
      ...sc,
      columns: sc.columns.filter((_, i) => i !== ci),
      rows: sc.rows.map((r) => r.filter((_, i) => i !== ci)),
    }));
  const setColumnHeader = (ci: number, value: string) =>
    setSizeChart((sc) => ({
      ...sc,
      columns: sc.columns.map((c, i) =>
        i === ci ? { ...c, [lang]: value } : c
      ),
    }));
  const addRow = () =>
    setSizeChart((sc) => ({
      ...sc,
      rows: [...sc.rows, sc.columns.map(() => "")],
    }));
  const removeRow = (ri: number) =>
    setSizeChart((sc) => ({ ...sc, rows: sc.rows.filter((_, i) => i !== ri) }));
  const setCell = (ri: number, ci: number, value: string) =>
    setSizeChart((sc) => ({
      ...sc,
      rows: sc.rows.map((r, i) =>
        i === ri ? r.map((cell, j) => (j === ci ? value : cell)) : r
      ),
    }));
  const setNote = (value: string) =>
    setSizeChart((sc) => ({ ...sc, note: { ...sc.note, [lang]: value } }));

  // Distinct colors defined across the groups — images are tagged with one of
  // these so the storefront can switch the image when a color is picked.
  const variantColors = useMemo(() => {
    const map = new Map<string, { hex: string; name: string }>();
    for (const g of colorGroups) {
      const hex = g.hex?.trim();
      if (hex && !map.has(hex)) {
        map.set(hex, { hex, name: g.name.trim() || hex });
      }
    }
    return [...map.values()];
  }, [colorGroups]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<
    { kind: "ok" | "error"; text: string } | null
  >(null);

  const setImageColor = (index: number, color: string) =>
    setImages((imgs) =>
      imgs.map((im, j) => (j === index ? { ...im, color: color || undefined } : im))
    );

  const setFileColor = (index: number, color: string) =>
    setImageFileColors((cs) =>
      cs.map((c, j) => (j === index ? color || undefined : c))
    );

  const removeImageFile = (index: number) => {
    setImageFiles((fs) => fs.filter((_, j) => j !== index));
    setImageFileColors((cs) => cs.filter((_, j) => j !== index));
    setImageFileCategoryIds((cs) => cs.filter((_, j) => j !== index));
    setImageFileMainForIds((cs) => cs.filter((_, j) => j !== index));
  };

  const toggleId = (ids: string[] | undefined, id: string) =>
    ids?.includes(id) ? ids.filter((x) => x !== id) : [...(ids ?? []), id];
  const without = (ids: string[] | undefined, id: string) =>
    (ids ?? []).filter((x) => x !== id);

  // Un-tagging a category also drops the image as that category's main image.
  const toggleImageCategory = (index: number, id: string) =>
    setImages((imgs) =>
      imgs.map((im, j) => {
        if (j !== index) return im;
        const removing = im.categoryIds?.includes(id);
        return {
          ...im,
          categoryIds: toggleId(im.categoryIds, id),
          mainForIds: removing ? without(im.mainForIds, id) : im.mainForIds,
        };
      })
    );

  const toggleFileCategory = (index: number, id: string) => {
    const removing = imageFileCategoryIds[index]?.includes(id);
    setImageFileCategoryIds((cs) =>
      cs.map((ids, j) => (j === index ? toggleId(ids, id) : ids))
    );
    if (removing) {
      setImageFileMainForIds((cs) =>
        cs.map((ids, j) => (j === index ? without(ids, id) : ids))
      );
    }
  };

  // ★ Main image per category: one image per category across saved + new
  // images. Picking a new one clears the previous; picking it again unsets it.
  // A main image is also shown in that category if it has category tags.
  const setMainImage = (target: { file: boolean; index: number }, id: string) => {
    const isTarget = (file: boolean, index: number) =>
      target.file === file && target.index === index;
    const alreadyMain = target.file
      ? imageFileMainForIds[target.index]?.includes(id)
      : images[target.index]?.mainForIds?.includes(id);
    const addShowIn = (ids: string[] | undefined) =>
      ids?.length && !ids.includes(id) ? [...ids, id] : ids ?? [];

    setImages((imgs) =>
      imgs.map((im, j) =>
        isTarget(false, j)
          ? {
              ...im,
              mainForIds: alreadyMain ? without(im.mainForIds, id) : [...without(im.mainForIds, id), id],
              categoryIds: alreadyMain ? im.categoryIds : addShowIn(im.categoryIds),
            }
          : { ...im, mainForIds: without(im.mainForIds, id) }
      )
    );
    setImageFileMainForIds((cs) =>
      cs.map((ids, j) =>
        isTarget(true, j) && !alreadyMain ? [...without(ids, id), id] : without(ids, id)
      )
    );
    if (target.file && !alreadyMain) {
      setImageFileCategoryIds((cs) =>
        cs.map((ids, j) => (j === target.index ? addShowIn(ids) : ids))
      );
    }
  };

  // The product's own categories — the only ones an image can be tagged with.
  const productCategoryOptions = categoryOptions
    .filter((c) => form.categoryIds.includes(c.id))
    .map((c) => ({ id: c.id, label: c.label.replace(/^— /, "") }));

  // Per-image "show in" chips plus a ★ to make it that category's main image;
  // only relevant once the product is in 2+ categories.
  const renderCategoryPicker = (
    value: string[] | undefined,
    mainFor: string[] | undefined,
    onToggle: (id: string) => void,
    onMain: (id: string) => void
  ) => {
    if (productCategoryOptions.length < 2) return null;
    const selected = (value ?? []).filter((id) =>
      productCategoryOptions.some((c) => c.id === id)
    );
    return (
      <div className="mt-1.5">
        <p className="text-[9px] font-bold uppercase leading-tight text-muted">
          {selected.length ? "Show in" : "Show in: all categories"} · ★ = main
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {productCategoryOptions.map((c) => {
            const isMain = mainFor?.includes(c.id);
            return (
              <div key={c.id} className="flex">
                <button
                  type="button"
                  onClick={() => onToggle(c.id)}
                  className={clsx(
                    "border px-1.5 py-0.5 text-[9px] font-extrabold uppercase cursor-pointer",
                    selected.includes(c.id)
                      ? "border-brand bg-brand text-white"
                      : "border-navy/20 text-navy hover:border-navy"
                  )}
                >
                  {c.label}
                </button>
                <button
                  type="button"
                  onClick={() => onMain(c.id)}
                  title={isMain ? `Main image in ${c.label}` : `Make main image in ${c.label}`}
                  aria-label={`Main image in ${c.label}`}
                  aria-pressed={isMain}
                  className={clsx(
                    "flex items-center border border-s-0 px-1 cursor-pointer",
                    isMain
                      ? "border-amber bg-amber text-navy"
                      : "border-navy/20 text-navy/40 hover:text-navy"
                  )}
                >
                  <Star size={10} fill={isMain ? "currentColor" : "none"} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Swatch row for tagging an image with one of the variant colors (or none).
  const renderColorPicker = (
    value: string | undefined,
    onChange: (hex: string) => void
  ) =>
    variantColors.length === 0 ? (
      <p className="mt-1.5 text-[9px] leading-tight text-muted">
        Add a variant color to tag this image
      </p>
    ) : (
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onChange("")}
          title="No specific color"
          className={clsx(
            "flex h-5 w-5 items-center justify-center rounded-full border-2 text-[9px] cursor-pointer",
            !value ? "border-brand text-brand" : "border-navy/20 text-muted"
          )}
        >
          ∅
        </button>
        {variantColors.map((c) => (
          <button
            key={c.hex}
            type="button"
            onClick={() => onChange(c.hex)}
            title={c.name}
            aria-label={c.name}
            className={clsx(
              "h-5 w-5 rounded-full border-2 p-0.5 cursor-pointer",
              value === c.hex ? "border-brand" : "border-navy/20"
            )}
          >
            <span
              className="block h-full w-full rounded-full"
              style={{ backgroundColor: c.hex }}
            />
          </button>
        ))}
      </div>
    );

  const toggleBadge = (badge: Product["badges"][number]) =>
    setForm((f) => ({
      ...f,
      badges: f.badges.includes(badge)
        ? f.badges.filter((b) => b !== badge)
        : [...f.badges, badge],
    }));

  const toggleCategory = (id: string) =>
    setForm((f) => ({
      ...f,
      categoryIds: f.categoryIds.includes(id)
        ? f.categoryIds.filter((c) => c !== id)
        : [...f.categoryIds, id],
    }));

  const patchGroup = (index: number, patch: Partial<ColorGroup>) =>
    setColorGroups((gs) =>
      gs.map((g, i) => (i === index ? { ...g, ...patch } : g))
    );

  const changeGroupHex = (index: number, nextHex: string) => {
    const previousHex = colorGroups[index]?.hex;
    patchGroup(index, { hex: nextHex });
    if (!previousHex || previousHex === nextHex) return;

    setImages((imgs) =>
      imgs.map((image) =>
        image.color === previousHex ? { ...image, color: nextHex } : image
      )
    );
    setImageFileColors((colors) =>
      colors.map((color) => (color === previousHex ? nextHex : color))
    );
  };

  const removeColorGroup = (index: number) =>
    setColorGroups((gs) => gs.filter((_, i) => i !== index));

  // Auto SKU for a (color, size) pair — admins don't manage SKUs here.
  const genSku = (group: ColorGroup, size: string) => {
    const base = slugify(form.name.en) || "prod";
    const colorKey =
      (group.name || group.hex.replace("#", ""))
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 6) || "clr";
    return `${base}-${colorKey}-${size}`.toUpperCase();
  };

  // Toggle a size on/off within a color group (adds a stock-0 row / removes it).
  const toggleSize = (index: number, size: string) =>
    setColorGroups((gs) =>
      gs.map((g, i) => {
        if (i !== index) return g;
        const exists = g.sizes.some((s) => s.size === size);
        return {
          ...g,
          sizes: exists
            ? g.sizes.filter((s) => s.size !== size)
            : [
                ...g.sizes,
                {
                  id: "",
                  size,
                  stock: 0,
                  sku: genSku(g, size),
                  priceOverride: null,
                },
              ],
        };
      })
    );

  const setSizeStock = (index: number, size: string, stock: number) =>
    setColorGroups((gs) =>
      gs.map((g, i) =>
        i === index
          ? {
              ...g,
              sizes: g.sizes.map((s) =>
                s.size === size ? { ...s, stock } : s
              ),
            }
          : g
      )
    );

  const setSizePriceOverride = (
    index: number,
    size: string,
    priceOverride: number | null
  ) =>
    setColorGroups((groups) =>
      groups.map((group, groupIndex) =>
        groupIndex === index
          ? {
              ...group,
              sizes: group.sizes.map((row) =>
                row.size === size ? { ...row, priceOverride } : row
              ),
            }
          : group
      )
    );

  // Flatten the color-grouped model back to the backend's per-variant array.
  const flattenVariants = (): Variant[] =>
    colorGroups.flatMap((g) =>
      g.sizes.map((s) => ({
        id: s.id,
        sku: s.sku.trim() || genSku(g, s.size),
        size: s.size,
        color: { name: { en: g.name.trim(), ar: g.name.trim() }, hex: g.hex },
        stock: s.stock,
        priceOverride: s.priceOverride,
      }))
    );

  const payload = (preparedImageFiles = imageFiles): ProductPayload => ({
    name: form.name,
    description: form.description,
    // Auto-derived from the English name; the backend also regenerates it.
    slug: slugify(form.name.en),
    // Legacy fallback for backends that still require a single category.
    category: form.categoryIds[0] ?? "",
    categories: form.categoryIds,
    basePrice: form.basePrice,
    salePrice: form.salePrice === "" ? null : form.salePrice,
    badges: form.badges,
    images,
    imageFiles: preparedImageFiles,
    imageFileColors,
    imageFileCategoryIds,
    imageFileMainForIds,
    variants: flattenVariants(),
    isActive: form.active,
    sizeChart,
    fabricCare,
  });

  const validate = (): string | null => {
    // These mirror the backend's required fields so the admin gets a clear
    // message instead of a generic "Validation failed" from the API.
    if (!form.name.en.trim()) return "English product name is required.";
    if (!form.name.ar.trim())
      return "Arabic product name is required (العربية tab).";
    if (!form.description.en.trim()) return "English description is required.";
    if (!form.description.ar.trim())
      return "Arabic description is required (العربية tab).";
    if (form.categoryIds.length === 0) return "Pick at least one category.";
    if (form.basePrice < 0) return "Base price cannot be below zero.";
    if (form.salePrice !== "" && form.salePrice < 0)
      return "Sale price cannot be below zero.";
    const named = colorGroups.filter((g) => g.name.trim());
    if (named.length === 0) return "Add at least one color with a name.";
    if (colorGroups.some((g) => g.sizes.length > 0 && !g.name.trim()))
      return "Each color needs a name.";
    const withSizes = named.filter((g) => g.sizes.length > 0);
    if (withSizes.length === 0)
      return "Add at least one size (with stock) to a color.";
    const flat = flattenVariants();
    const skus = flat.map((v) => v.sku);
    if (new Set(skus).size !== skus.length)
      return "Two colors produce the same SKU — give each color a distinct name.";
    return null;
  };

  const save = async () => {
    const problem = validate();
    if (problem) {
      setMessage({ kind: "error", text: problem });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const preparedImageFiles = await prepareImageUploads(imageFiles, {
        maxFiles: MAX_IMAGES,
      });
      const savePayload = payload(preparedImageFiles);

      if (mode === "create") {
        const created = await createProduct(savePayload);
        await getAdminProduct(created._id);
        router.replace(`/admin/products/${created._id}`);
        router.refresh();
      } else {
        await updateProduct(product.id, savePayload);
        const refreshed = await getAdminProduct(product.id);
        setImages(withCategoryIds(refreshed.images));
        setImageFiles([]);
        setImageFileColors([]);
        setImageFileCategoryIds([]);
        setImageFileMainForIds([]);
        setColorGroups(groupVariants(refreshed.variants));
        setSizeChart(cloneSizeChart(refreshed.sizeChart));
        setFabricCare(cloneFabricCare(refreshed.fabricCare));
        setMessage({ kind: "ok", text: "Saved" });
        router.refresh();
      }
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Save failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete "${product.name.en}"? It will disappear from the store.`)) return;
    setBusy(true);
    try {
      await deleteProduct(product.id);
      router.push("/admin/products");
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Delete failed.",
      });
      setBusy(false);
    }
  };

  return (
    <div className="pb-24">
      {/* Topbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-brand/20 bg-white px-6 py-4">
        <h1 className="font-display uppercase text-2xl text-brand">
          {mode === "create" ? "New Product" : "Product Editor"}
        </h1>
        {mode === "edit" && (
          <button
            onClick={remove}
            disabled={busy}
            className="flex items-center gap-2 border-2 border-brand/40 px-4 py-2 text-xs font-extrabold uppercase tracking-wider text-brand hover:bg-brand hover:text-white transition-colors cursor-pointer"
          >
            <Trash2 size={14} /> Delete Product
          </button>
        )}
      </div>

      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_360px]">
        {/* ── Left column ── */}
        <div className="space-y-6">
          <div className="bg-white p-6 shadow-sm">
            {/* Language tabs */}
            <div className="flex gap-1 border-b-2 border-navy/10">
              {(["en", "ar"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  className={clsx(
                    "-mb-0.5 border-b-2 px-4 py-2 text-sm font-extrabold uppercase tracking-wider transition-colors cursor-pointer",
                    lang === l
                      ? "border-brand text-brand"
                      : "border-transparent text-muted hover:text-navy"
                  )}
                >
                  {l === "en" ? "English" : "العربية"}
                </button>
              ))}
            </div>

            <div className="mt-6 space-y-5" dir={lang === "ar" ? "rtl" : "ltr"}>
              <div>
                <label className={labelCls}>Product Name</label>
                <input
                  value={form.name[lang]}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: { ...f.name, [lang]: e.target.value },
                    }))
                  }
                  className={inputCls}
                />
              </div>

              <div dir="ltr">
                <label className={labelCls}>Categories</label>
                <div className="max-h-56 overflow-y-auto border-2 border-navy/15 bg-white p-1">
                  {categoryOptions.map((c) => {
                    const checked = form.categoryIds.includes(c.id);
                    const isChild = c.label.startsWith("—");
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface"
                      >
                        <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCategory(c.id)}
                            className="h-4 w-4 accent-brand"
                          />
                          <span className={clsx(isChild ? "text-muted" : "text-navy")}>
                            {c.label}
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1 text-[10px] leading-tight text-muted">
                  Select every category this product should appear in.
                </p>
                {form.name.en.trim() && (
                  <p className="mt-1.5 font-mono text-[11px] text-muted">
                    URL: /{slugify(form.name.en)}
                  </p>
                )}
              </div>

              <div>
                <label className={labelCls}>Description</label>
                <textarea
                  rows={4}
                  value={form.description[lang]}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      description: { ...f.description, [lang]: e.target.value },
                    }))
                  }
                  className={inputCls}
                />
              </div>

              <div className="flex flex-wrap gap-5" dir="ltr">
                {(
                  [
                    ["new", "New Arrival"],
                    ["best-seller", "Best Seller"],
                    ["sale", "Sale"],
                  ] as const
                ).map(([badge, label]) => (
                  <label
                    key={badge}
                    className="flex cursor-pointer items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-navy"
                  >
                    <input
                      type="checkbox"
                      checked={form.badges.includes(badge)}
                      onChange={() => toggleBadge(badge)}
                      className="h-4 w-4 accent-brand"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Media */}
          <div className="bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b-2 border-navy pb-2">
              <h2 className="font-display uppercase text-xl text-navy">
                Product Media
              </h2>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Max {MAX_IMAGES} · compressed to JPEG under 400 KB each
              </span>
            </div>

            {/* Hidden native file input, opened by the upload tile/button. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="hidden"
            />

            <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {images.map((img, i) => (
                <div
                  key={`${img.url}-${i}`}
                  className="relative border border-navy/10 bg-surface p-2"
                >
                  {i === 0 && (
                    <span className="absolute top-2 start-2 z-10 bg-brand px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">
                      Main Image
                    </span>
                  )}
                  <button
                    onClick={() =>
                      setImages((imgs) => imgs.filter((_, j) => j !== i))
                    }
                    aria-label="Remove image"
                    className="absolute top-2 end-2 z-10 bg-navy p-1 text-white hover:bg-brand transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  {renderColorPicker(img.color, (hex) => setImageColor(i, hex))}
                  {renderCategoryPicker(
                    img.categoryIds,
                    img.mainForIds,
                    (id) => toggleImageCategory(i, id),
                    (id) => setMainImage({ file: false, index: i }, id)
                  )}
                </div>
              ))}

              {/* New device uploads (not yet saved). */}
              {filePreviews.map((p, i) => (
                <div
                  key={p.url}
                  className="relative border border-brand/30 bg-surface p-2"
                >
                  {images.length === 0 && i === 0 && (
                    <span className="absolute top-2 start-2 z-10 bg-brand px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">
                      Main Image
                    </span>
                  )}
                  <span className="absolute bottom-2 start-2 z-10 bg-navy/80 px-1.5 py-0.5 text-[8px] font-extrabold uppercase text-white">
                    New
                  </span>
                  <button
                    onClick={() => removeImageFile(i)}
                    aria-label="Remove image"
                    className="absolute top-2 end-2 z-10 bg-navy p-1 text-white hover:bg-brand transition-colors cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  {renderColorPicker(imageFileColors[i], (hex) =>
                    setFileColor(i, hex)
                  )}
                  {renderCategoryPicker(
                    imageFileCategoryIds[i],
                    imageFileMainForIds[i],
                    (id) => toggleFileCategory(i, id),
                    (id) => setMainImage({ file: true, index: i }, id)
                  )}
                </div>
              ))}

              {images.length + imageFiles.length < MAX_IMAGES && (
                <div className="flex aspect-square flex-col items-center justify-center gap-2 border-2 border-dashed border-navy/20 p-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center gap-1 text-brand hover:text-brand-dark cursor-pointer"
                  >
                    <Upload size={20} />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">
                      Upload
                    </span>
                  </button>
                  <p className="text-center text-[9px] leading-tight text-muted">
                    JPG, PNG, WebP, or another image file
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Size Chart */}
          <div className="bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b-2 border-navy pb-2">
              <h2 className="font-display uppercase text-xl text-navy">
                Size Chart
              </h2>
              <button
                type="button"
                onClick={addColumn}
                className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-brand hover:text-brand-dark cursor-pointer"
              >
                <Plus size={13} /> Add Column
              </button>
            </div>
            <p className="mt-1 text-[10px] leading-tight text-muted">
              Headers are localized (editing{" "}
              {lang === "ar" ? "العربية" : "English"} — switch the tab above for
              the other language). Measurement cells are shared. Use ranges like
              &quot;90-94&quot;.
            </p>

            {sizeChart.columns.length === 0 ? (
              <p className="mt-4 text-xs text-muted">
                No columns yet. Add a column (e.g. Size, Chest, Length) to start
                the chart.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr>
                      {sizeChart.columns.map((c, ci) => (
                        <th key={ci} className="p-1 align-top">
                          <input
                            value={c[lang]}
                            onChange={(e) => setColumnHeader(ci, e.target.value)}
                            placeholder={`Header ${ci + 1}`}
                            dir={lang === "ar" ? "rtl" : "ltr"}
                            className={clsx(inputCls, "text-xs")}
                          />
                          <button
                            type="button"
                            onClick={() => removeColumn(ci)}
                            className="mt-1 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-brand cursor-pointer"
                          >
                            Remove
                          </button>
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {sizeChart.rows.map((row, ri) => (
                      <tr key={ri}>
                        {sizeChart.columns.map((_, ci) => (
                          <td key={ci} className="p-1">
                            <input
                              value={row[ci] ?? ""}
                              onChange={(e) => setCell(ri, ci, e.target.value)}
                              dir="ltr"
                              className={clsx(inputCls, "text-xs")}
                            />
                          </td>
                        ))}
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(ri)}
                            aria-label="Remove row"
                            className="p-1 text-muted hover:text-brand cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  type="button"
                  onClick={addRow}
                  className="mt-3 flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-brand hover:text-brand-dark cursor-pointer"
                >
                  <Plus size={13} /> Add Row
                </button>
                <div className="mt-4" dir={lang === "ar" ? "rtl" : "ltr"}>
                  <label className={labelCls}>Note (optional caption)</label>
                  <input
                    value={sizeChart.note[lang]}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. Measurements in cm"
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Fabric & Care */}
          <div className="bg-white p-6 shadow-sm">
            <h2 className="border-b-2 border-navy pb-2 font-display uppercase text-xl text-navy">
              Fabric &amp; Care
            </h2>
            <p className="mt-1 text-[10px] leading-tight text-muted">
              Localized — editing {lang === "ar" ? "العربية" : "English"}. Switch
              the tab above for the other language.
            </p>
            <div className="mt-4 space-y-4" dir={lang === "ar" ? "rtl" : "ltr"}>
              <div>
                <label className={labelCls}>Fabric (composition)</label>
                <textarea
                  rows={2}
                  value={fabricCare.fabric[lang]}
                  onChange={(e) =>
                    setFabricCare((fc) => ({
                      ...fc,
                      fabric: { ...fc.fabric, [lang]: e.target.value },
                    }))
                  }
                  placeholder={lang === "ar" ? "مثال: 100% قطن" : "e.g. 100% Cotton"}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Care instructions</label>
                <textarea
                  rows={2}
                  value={fabricCare.care[lang]}
                  onChange={(e) =>
                    setFabricCare((fc) => ({
                      ...fc,
                      care: { ...fc.care, [lang]: e.target.value },
                    }))
                  }
                  placeholder={
                    lang === "ar" ? "مثال: غسيل بارد" : "e.g. Machine wash cold"
                  }
                  className={inputCls}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">
          <div className="border-t-4 border-navy bg-white p-6 shadow-sm">
            <h2 className="font-display uppercase text-xl text-navy">
              Pricing <span className="text-brand">EGP</span>
            </h2>
            <div className="mt-5 space-y-4">
              <div>
                <label className={labelCls}>Base Price</label>
                <input
                  type="number"
                  min={0}
                  value={form.basePrice}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, basePrice: +e.target.value }))
                  }
                  className={clsx(inputCls, "font-display text-lg")}
                />
              </div>
              <div>
                <label className={labelCls}>
                  Sale Price (leave empty for no sale)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.salePrice}
                  onChange={(e) => {
                    const value = e.target.value;
                    setForm((f) => ({
                      ...f,
                      salePrice: value === "" ? "" : Number(value),
                    }));
                  }}
                  className={clsx(
                    inputCls,
                    "font-display text-lg",
                    form.salePrice !== "" && "border-brand/40 text-brand"
                  )}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-display uppercase text-xl text-navy">
                Variants
              </h2>
              <button
                onClick={() => setColorGroups((gs) => [...gs, blankGroup()])}
                className="flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-brand hover:text-brand-dark cursor-pointer"
              >
                <Plus size={13} /> Add Color
              </button>
            </div>
            <p className="mt-1 text-[10px] text-muted">
              One color per block — pick which sizes it comes in and set the
              stock for each size.
            </p>
            <div className="mt-4 space-y-4">
              {colorGroups.map((g, i) => (
                <div key={i} className="space-y-3 border-2 border-navy/10 p-3">
                  {/* Color */}
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={g.hex || "#201d50"}
                      onChange={(e) => changeGroupHex(i, e.target.value)}
                      aria-label="Variant color"
                      className="h-9 w-10 shrink-0 cursor-pointer border-2 border-navy/15 bg-white p-0.5"
                    />
                    <input
                      value={g.name}
                      onChange={(e) => patchGroup(i, { name: e.target.value })}
                      placeholder="Color name (e.g. Deep Navy)"
                      className={clsx(inputCls, "text-xs")}
                    />
                    <button
                      onClick={() => removeColorGroup(i)}
                      aria-label="Remove color"
                      className="shrink-0 p-2 text-muted hover:text-brand cursor-pointer"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Sizes this color comes in */}
                  <div>
                    <label className={labelCls}>Sizes</label>
                    <div className="flex flex-wrap gap-1.5">
                      {SIZE_OPTIONS.map((sz) => {
                        const on = g.sizes.some((s) => s.size === sz);
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => toggleSize(i, sz)}
                            className={clsx(
                              "h-8 w-10 border-2 text-xs font-extrabold uppercase transition-colors cursor-pointer",
                              on
                                ? "border-brand bg-brand text-white"
                                : "border-navy/20 text-navy hover:border-navy"
                            )}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Stock and optional effective price per selected size */}
                  {g.sizes.length > 0 && (
                    <div className="space-y-1.5">
                      <label className={labelCls}>Stock / variant price</label>
                      {orderSizes(g.sizes.map((s) => s.size)).map((sz) => {
                        const row = g.sizes.find((s) => s.size === sz)!;
                        return (
                          <div key={sz} className="flex items-center gap-2">
                            <span className="w-12 text-xs font-extrabold uppercase text-navy">
                              {sz}
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={row.stock}
                              onChange={(e) =>
                                setSizeStock(i, sz, Math.max(0, +e.target.value))
                              }
                              placeholder="Stock"
                              className={clsx(
                                inputCls,
                                "flex-1 text-end text-xs font-bold",
                                row.stock <= 5 &&
                                  "border-brand/50 bg-brand/5 text-brand"
                              )}
                            />
                            <input
                              type="number"
                              min={0}
                              value={row.priceOverride ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSizePriceOverride(
                                  i,
                                  sz,
                                  value === ""
                                    ? null
                                    : Math.max(0, Number(value))
                                );
                              }}
                              placeholder="Price override"
                              title="Leave empty to use the product sale/base price"
                              className={clsx(
                                inputCls,
                                "flex-1 text-end text-xs font-bold",
                                row.priceOverride !== null &&
                                  "border-brand/40 text-brand"
                              )}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 end-0 start-56 z-30 flex items-center justify-between gap-4 border-t-2 border-brand/20 bg-white/95 px-6 py-3 backdrop-blur max-md:start-16">
        <label className="flex cursor-pointer items-center gap-3">
          <button
            onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
            className={clsx(
              "relative h-6 w-11 rounded-full transition-colors cursor-pointer",
              form.active ? "bg-navy" : "bg-navy/20"
            )}
          >
            <span
              className={clsx(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all",
                form.active ? "start-5.5" : "start-0.5"
              )}
            />
          </button>
          <span className="text-xs font-extrabold uppercase tracking-wider">
            <span className="text-muted">Product Status</span>{" "}
            <span className={form.active ? "text-brand" : "text-muted"}>
              {form.active ? "Active" : "Draft"}
            </span>
          </span>
        </label>

        <div className="flex items-center gap-3">
          {message && (
            <span
              className={clsx(
                "max-w-xs truncate text-xs font-extrabold uppercase",
                message.kind === "ok" ? "text-success" : "text-brand"
              )}
              title={message.text}
            >
              {message.kind === "ok" ? "Saved ✓" : message.text}
            </span>
          )}
          <button
            onClick={save}
            disabled={busy}
            className={clsx(
              "skew-cta bg-brand px-8 py-3 font-display uppercase tracking-wider text-white hover:bg-brand-dark transition-colors cursor-pointer",
              busy && "opacity-60"
            )}
          >
            <span>
              {busy ? "Saving…" : mode === "create" ? "Create Product" : "Save Product"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
