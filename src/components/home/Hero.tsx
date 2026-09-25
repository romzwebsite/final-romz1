import { useLocale, useTranslations } from "next-intl";
import { DEFAULT_HERO_IMAGE, resolveMediaUrl } from "@/lib/storefrontSettings";
import type { HeroContent, LocalizedText, Locale } from "@/lib/types";
import HeroPhoto from "./HeroPhoto";

// Content comes from Admin → Hero Banner; every field the admin left empty
// falls back to the built-in copy and photo.
export default function Hero({ hero }: { hero?: HeroContent }) {
  const t = useTranslations("hero");
  const locale = useLocale() as Locale;

  const text = (value: LocalizedText | undefined, fallback: string) =>
    value?.[locale]?.trim() || fallback;
  const image = resolveMediaUrl(hero?.image.url ?? "") || DEFAULT_HERO_IMAGE;
  const mobileImage = resolveMediaUrl(hero?.mobileImage.url ?? "") || image;

  return (
    <HeroPhoto
      title={text(hero?.title, t("title"))}
      subtitle={text(hero?.subtitle, `${t("kicker")} ${t("subtitle")}`)}
      cta={text(hero?.ctaLabel, t("cta"))}
      ctaHref={hero?.ctaHref.trim() || "/#new-arrivals"}
      image={image}
      mobileImage={mobileImage}
    />
  );
}
