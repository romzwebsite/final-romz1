"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Upload, X } from "lucide-react";
import { updateHero, uploadSettingsImage } from "@/lib/adminApi";
import { compressImageForUpload } from "@/lib/imageUpload";
import { DEFAULT_HERO_IMAGE, EMPTY_HERO, resolveMediaUrl } from "@/lib/storefrontSettings";
import type { HeroContent, Locale, LocalizedText } from "@/lib/types";
import enMessages from "@/messages/en.json";
import arMessages from "@/messages/ar.json";

const labelCls =
  "mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-muted";
const inputCls =
  "w-full border-2 border-navy/15 bg-white px-3 py-2 text-sm text-navy outline-none focus:border-brand transition-colors placeholder:text-navy/30";

// The built-in copy the storefront shows for any field left empty (shown here
// as placeholders so the admin sees what an empty field means).
const DEFAULT_TEXT: Record<Locale, { title: string; subtitle: string; cta: string }> = {
  en: {
    title: enMessages.hero.title,
    subtitle: `${enMessages.hero.kicker} ${enMessages.hero.subtitle}`,
    cta: enMessages.hero.cta,
  },
  ar: {
    title: arMessages.hero.title,
    subtitle: `${arMessages.hero.kicker} ${arMessages.hero.subtitle}`,
    cta: arMessages.hero.cta,
  },
};
const DEFAULT_LINK = "/#new-arrivals";

type TextField = "title" | "subtitle" | "ctaLabel";
type PhotoSlot = "image" | "mobileImage";

const cloneHero = (h: HeroContent): HeroContent => ({
  title: { ...h.title },
  subtitle: { ...h.subtitle },
  ctaLabel: { ...h.ctaLabel },
  ctaHref: h.ctaHref,
  image: { ...h.image },
  mobileImage: { ...h.mobileImage },
});

export default function HeroEditor({ hero }: { hero: HeroContent }) {
  const router = useRouter();
  const [form, setForm] = useState<HeroContent>(() => cloneHero(hero));
  // Photos picked on this device, uploaded when the admin saves.
  const [files, setFiles] = useState<Record<PhotoSlot, File | null>>({
    image: null,
    mobileImage: null,
  });
  const [previewLang, setPreviewLang] = useState<Locale>("en");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(
    null
  );

  const fileUrls = useMemo(
    () => ({
      image: files.image ? URL.createObjectURL(files.image) : "",
      mobileImage: files.mobileImage ? URL.createObjectURL(files.mobileImage) : "",
    }),
    [files]
  );
  useEffect(
    () => () => {
      if (fileUrls.image) URL.revokeObjectURL(fileUrls.image);
      if (fileUrls.mobileImage) URL.revokeObjectURL(fileUrls.mobileImage);
    },
    [fileUrls]
  );

  // What the storefront would show for each photo right now.
  const desktopSrc = fileUrls.image || resolveMediaUrl(form.image.url) || DEFAULT_HERO_IMAGE;
  const mobileSrc = fileUrls.mobileImage || resolveMediaUrl(form.mobileImage.url) || desktopSrc;

  const setText = (field: TextField, lang: Locale, value: string) =>
    setForm((f) => ({ ...f, [field]: { ...f[field], [lang]: value } }));

  const pickFile = (slot: PhotoSlot, list: FileList | null) => {
    const file = list?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage({ kind: "error", text: `${file.name} is not an image.` });
      return;
    }
    setFiles((fs) => ({ ...fs, [slot]: file }));
    setMessage(null);
  };

  // Desktop goes back to the default photo; phone goes back to the desktop one.
  const removePhoto = (slot: PhotoSlot) => {
    setFiles((fs) => ({ ...fs, [slot]: null }));
    setForm((f) => ({ ...f, [slot]: { url: "", publicId: "" } }));
  };

  const resetToDefaults = () => {
    setForm(cloneHero(EMPTY_HERO));
    setFiles({ image: null, mobileImage: null });
    setMessage({ kind: "ok", text: "Cleared — save to put the default hero back on the site." });
  };

  const save = async () => {
    const href = form.ctaHref.trim();
    if (href && !href.startsWith("/") && !/^https?:\/\//i.test(href)) {
      setMessage({
        kind: "error",
        text: "The button link must start with / (like /category/men) or https://",
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // Upload new photos first; the save then stores their URLs.
      const image = files.image
        ? await uploadSettingsImage(await compressImageForUpload(files.image))
        : form.image;
      const mobileImage = files.mobileImage
        ? await uploadSettingsImage(await compressImageForUpload(files.mobileImage))
        : form.mobileImage;
      const saved = await updateHero({ ...form, ctaHref: href, image, mobileImage });
      setForm(cloneHero(saved));
      setFiles({ image: null, mobileImage: null });
      setMessage({ kind: "ok", text: "Hero saved — it's live on the home page." });
      router.refresh();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "Save failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  const renderTextField = (field: TextField, label: string, lang: Locale, multiline = false) => {
    const d = DEFAULT_TEXT[lang];
    const placeholder = field === "title" ? d.title : field === "subtitle" ? d.subtitle : d.cta;
    const props = {
      value: form[field][lang],
      placeholder,
      dir: lang === "ar" ? "rtl" : "ltr",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setText(field, lang, e.target.value),
      className: inputCls,
    } as const;
    return (
      <div>
        <label className={labelCls}>
          {label} ({lang === "en" ? "English" : "Arabic"})
        </label>
        {multiline ? <textarea rows={2} {...props} /> : <input {...props} />}
      </div>
    );
  };

  const renderPhotoSlot = (slot: PhotoSlot, title: string, hint: string, fallback: string) => {
    const src = slot === "image" ? desktopSrc : mobileSrc;
    const isCustom = Boolean(files[slot] || form[slot].url);
    const inputId = `hero-${slot}-input`;
    return (
      <div className="border-2 border-navy/10 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-navy">{title}</p>
          {files[slot] ? (
            <span className="text-[9px] font-extrabold uppercase text-brand">
              New — save to publish
            </span>
          ) : (
            !isCustom && (
              <span className="text-[9px] font-bold uppercase text-muted">{fallback}</span>
            )
          )}
        </div>
        <p className="mt-0.5 text-[10px] leading-tight text-muted">{hint}</p>
        <div
          role="img"
          aria-label={title}
          className={clsx(
            "mt-2 bg-surface bg-cover bg-top",
            slot === "image" ? "aspect-[19/10]" : "aspect-[375/520]"
          )}
          style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
        />
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            pickFile(slot, e.target.files);
            e.target.value = "";
          }}
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center gap-1.5 bg-navy px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white hover:bg-brand transition-colors"
          >
            <Upload size={12} /> {isCustom ? "Replace" : "Upload"}
          </label>
          {isCustom && (
            <button
              type="button"
              onClick={() => removePhoto(slot)}
              className="inline-flex items-center gap-1.5 border-2 border-navy/20 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-navy hover:border-brand hover:text-brand transition-colors cursor-pointer"
            >
              <X size={12} /> Remove
            </button>
          )}
        </div>
      </div>
    );
  };

  // Scaled-down copy of the storefront hero (same overlays and text layout).
  const renderPreview = (kind: "desktop" | "mobile") => {
    const d = DEFAULT_TEXT[previewLang];
    const pick = (v: LocalizedText, fallback: string) => v[previewLang]?.trim() || fallback;
    const desktop = kind === "desktop";
    return (
      <div
        className={clsx(
          "relative overflow-hidden bg-navy-deep",
          desktop ? "aspect-[19/10]" : "aspect-[375/520]"
        )}
      >
        <div
          className="absolute inset-0 bg-cover bg-top"
          style={{ backgroundImage: `url(${JSON.stringify(desktop ? desktopSrc : mobileSrc)})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-brand/85 via-brand/20 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-transparent to-navy-deep/15" />
        <div
          className="absolute inset-y-0 start-0 w-[55%] bg-brand/45"
          style={{ clipPath: "polygon(0 0, 72% 0, 50% 100%, 0 100%)" }}
        />
        <div
          dir={previewLang === "ar" ? "rtl" : "ltr"}
          className={clsx(
            "relative flex h-full flex-col px-[7%]",
            desktop ? "justify-center" : "justify-end pb-[8%]"
          )}
        >
          <p
            className={clsx(
              "font-display uppercase leading-[0.86] text-white",
              desktop ? "text-4xl" : "text-2xl"
            )}
          >
            {pick(form.title, d.title)}
          </p>
          <p
            className={clsx(
              "mt-2 border-s-2 border-white ps-2 font-extrabold uppercase leading-tight text-white/90",
              desktop ? "max-w-[45%] text-[8px]" : "max-w-[85%] text-[7px]"
            )}
          >
            {pick(form.subtitle, d.subtitle)}
          </p>
          <span className="mt-2.5 w-fit bg-brand px-2.5 py-1 font-display text-[9px] uppercase tracking-wider text-white">
            {pick(form.ctaLabel, d.cta)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <div className="bg-white p-6 shadow-sm">
          <h2 className="border-b-2 border-navy pb-2 font-display uppercase text-xl text-navy">
            Text
          </h2>
          <p className="mt-3 text-xs text-muted">
            Leave a field empty to keep the default text (shown in grey).
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {renderTextField("title", "Headline", "en")}
            {renderTextField("title", "Headline", "ar")}
            {renderTextField("subtitle", "Line under the headline", "en", true)}
            {renderTextField("subtitle", "Line under the headline", "ar", true)}
            {renderTextField("ctaLabel", "Button text", "en")}
            {renderTextField("ctaLabel", "Button text", "ar")}
            <div className="sm:col-span-2">
              <label className={labelCls}>Button link</label>
              <input
                value={form.ctaHref}
                dir="ltr"
                placeholder={DEFAULT_LINK}
                onChange={(e) => setForm((f) => ({ ...f, ctaHref: e.target.value }))}
                className={inputCls}
              />
              <p className="mt-1 text-[10px] text-muted">
                A page on the site, like /category/men or /#new-arrivals.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 shadow-sm">
          <h2 className="border-b-2 border-navy pb-2 font-display uppercase text-xl text-navy">
            Photos
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
            {renderPhotoSlot(
              "image",
              "Desktop & tablet",
              "Landscape photo, at least 1920px wide. Keep faces in the upper part.",
              "Default photo"
            )}
            {renderPhotoSlot(
              "mobileImage",
              "Phone (optional)",
              "Portrait photo works best. Empty = the desktop photo.",
              "Using desktop photo"
            )}
          </div>
        </div>

        {message && (
          <p
            className={clsx(
              "text-xs font-bold",
              message.kind === "ok" ? "text-success" : "text-brand"
            )}
          >
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={clsx(
              "skew-cta bg-brand px-6 py-2.5 text-sm font-display uppercase tracking-wider text-white hover:bg-brand-dark transition-colors cursor-pointer",
              busy && "opacity-60"
            )}
          >
            <span>{busy ? "Saving..." : "Save Hero"}</span>
          </button>
          <button
            type="button"
            onClick={resetToDefaults}
            disabled={busy}
            className={clsx(
              "border-2 border-navy px-6 py-2.5 text-sm font-display uppercase tracking-wider text-navy hover:bg-navy hover:text-white transition-colors cursor-pointer",
              busy && "opacity-60"
            )}
          >
            Use defaults
          </button>
        </div>
      </div>

      <div className="bg-white p-6 shadow-sm lg:sticky lg:top-6">
        <div className="flex items-center justify-between border-b-2 border-navy pb-2">
          <h2 className="font-display uppercase text-xl text-navy">Preview</h2>
          <div className="flex border-2 border-navy/15 text-[10px] font-extrabold uppercase">
            {(["en", "ar"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setPreviewLang(lang)}
                className={clsx(
                  "px-2.5 py-1 cursor-pointer",
                  previewLang === lang ? "bg-navy text-white" : "text-navy"
                )}
              >
                {lang === "en" ? "English" : "العربية"}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Desktop</p>
        <div className="mt-1.5">{renderPreview("desktop")}</div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-muted">Phone</p>
        <div className="mx-auto mt-1.5 w-[190px]">{renderPreview("mobile")}</div>
      </div>
    </div>
  );
}
