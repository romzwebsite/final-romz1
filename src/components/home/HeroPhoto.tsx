"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from "motion/react";
import { Link } from "@/i18n/navigation";
import { btn } from "@/components/ui/Button";

// Drop the brand hero photo here. Until it exists the navy-deep backdrop shows,
// so a missing file never breaks the page.
const HERO_IMAGE = "/hero/romz-hero.jpg";

export default function HeroPhoto({
  kicker,
  title,
  subtitle,
  cta,
  ctaHref,
}: {
  kicker: string;
  title: string;
  subtitle: string;
  cta: string;
  ctaHref: string;
}) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLElement>(null);

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const sx = useSpring(px, { stiffness: 45, damping: 15, mass: 0.5 });
  const sy = useSpring(py, { stiffness: 45, damping: 15, mass: 0.5 });

  // Subtle depth on the photo (kept gentle so it reads like the static design).
  const bgX = useTransform(sx, [-0.5, 0.5], [18, -18]);
  const bgY = useTransform(sy, [-0.5, 0.5], [12, -12]);

  function handleMove(e: React.MouseEvent) {
    if (reduced || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width - 0.5);
    py.set((e.clientY - r.top) / r.height - 0.5);
  }
  function reset() {
    px.set(0);
    py.set(0);
  }

  const bgStyle = reduced
    ? { backgroundImage: `url(${HERO_IMAGE})` }
    : { backgroundImage: `url(${HERO_IMAGE})`, x: bgX, y: bgY };

  return (
    <section
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={reset}
      className="relative min-h-[74vh] overflow-hidden bg-navy-deep md:min-h-[760px]"
    >
      {/* Full-bleed photo (cover, like the design) */}
      <motion.div
        aria-hidden
        style={bgStyle}
        className="absolute -inset-[6%] bg-cover bg-center will-change-transform"
      />

      {/* Brand red wash from the start edge + darken for legibility */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-brand/85 via-brand/20 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-navy-deep/70 via-transparent to-navy-deep/15" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 start-0 w-[55%] bg-brand/45"
        style={{ clipPath: "polygon(0 0, 72% 0, 50% 100%, 0 100%)" }}
      />

      {/* Content — left aligned, upright display, as in the design */}
      <div className="relative mx-auto flex min-h-[74vh] max-w-[1440px] flex-col justify-center px-8 py-20 md:min-h-[760px] md:py-32">
        <div className="max-w-2xl">
          <motion.h1
            initial={{ y: 28, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="font-display uppercase leading-[0.86] text-white text-6xl sm:text-7xl md:text-8xl lg:text-[8.5rem]"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-5 max-w-md border-s-4 border-white ps-4 text-sm font-extrabold uppercase text-white/90 md:text-base"
          >
            {kicker} {subtitle}
          </motion.p>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Link href={ctaHref} className={btn("primary", "lg", "mt-8")}>
              <span>{cta}</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
