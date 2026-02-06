"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

type DreamscapeLayoutProps = {
  title: string;
  subtitle: string;
  kicker: string;
  children: ReactNode;
  quote?: string;
  hideHero?: boolean;
};

const nearStars = Array.from({ length: 80 }, (_, index) => ({
  id: `near-${index}`,
  left: `${(index * 13) % 100}%`,
  top: `${(index * 29) % 100}%`,
  size: 1 + (index % 3),
  duration: 3 + (index % 6) * 0.6,
  delay: (index % 8) * 0.28,
}));

const farStars = Array.from({ length: 70 }, (_, index) => ({
  id: `far-${index}`,
  left: `${(index * 17 + 11) % 100}%`,
  top: `${(index * 23 + 7) % 100}%`,
  duration: 6 + (index % 5) * 1.1,
  delay: (index % 10) * 0.37,
}));

export default function DreamscapeLayout({
  title,
  subtitle,
  kicker,
  children,
  quote,
  hideHero = false,
}: DreamscapeLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_20%_15%,#1e2b52_0%,#090d1a_38%,#020306_85%)] text-[#e8eeff] selection:bg-violet-300/30">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          className="absolute -left-24 top-10 h-80 w-80 rounded-full bg-purple-500/30 blur-[120px]"
          animate={{
            x: [0, 70, -30, 0],
            y: [0, 80, 20, 0],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-teal-400/20 blur-[140px]"
          animate={{ x: [0, -120, 0], y: [0, -60, 0], scale: [1, 1.2, 1] }}
          transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-28 left-1/3 h-112 w-md rounded-full bg-fuchsia-400/18 blur-[130px]"
          animate={{ x: [0, 90, -40, 0], y: [0, -40, 20, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-45">
        {farStars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute h-px w-px rounded-full bg-blue-100/60"
            style={{ left: star.left, top: star.top }}
            animate={{ opacity: [0.12, 0.55, 0.12], scale: [1, 1.1, 1] }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
        {nearStars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute rounded-full bg-white/90"
            style={{
              left: star.left,
              top: star.top,
              width: `${star.size}px`,
              height: `${star.size}px`,
            }}
            animate={{ opacity: [0.2, 0.95, 0.2], scale: [1, 1.28, 1] }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <div className="pointer-events-none absolute inset-0 opacity-[0.12] bg-[linear-gradient(rgba(190,201,255,0.6)_1px,transparent_1px)] bg-size-[100%_4px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.65)_100%)]" />

      <motion.div
        className="pointer-events-none absolute left-[10%] top-[68%] h-24 w-40 rounded-full bg-slate-200/12 blur-2xl"
        animate={{ opacity: [0.18, 0.45, 0.18], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute right-[12%] top-[64%] h-20 w-32 rounded-full bg-violet-200/10 blur-2xl"
        animate={{ opacity: [0.1, 0.38, 0.1], scale: [1, 1.18, 1] }}
        transition={{
          duration: 7,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.9,
        }}
      />

      <div className="relative z-10 mx-auto max-w-6xl px-6 pb-20 pt-10">
        <nav
          className={`flex items-center justify-between ${hideHero ? "mb-6" : "mb-14"}`}
        >
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.32em] text-teal-100/70">
              {kicker}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {title}
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-white/30 bg-white/5 px-5 py-2 text-xs uppercase tracking-[0.2em] text-white/85 transition hover:bg-white/15"
          >
            Exit
          </Link>
        </nav>

        {hideHero ? null : (
          <motion.header
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="mb-12 max-w-4xl"
          >
            <h2 className="mb-5 text-4xl font-semibold leading-[1.04] tracking-tight sm:text-6xl">
              {subtitle}
            </h2>
            {quote ? (
              <p className="max-w-2xl text-base leading-relaxed text-slate-200/80 sm:text-lg">
                {quote}
              </p>
            ) : null}
          </motion.header>
        )}

        {children}
      </div>
    </div>
  );
}
