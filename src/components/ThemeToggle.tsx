import { motion } from "framer-motion";

type Props = {
  theme: "dark" | "light";
  onToggle: () => void;
};

export default function ThemeToggle({ theme, onToggle }: Props) {
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${isDark ? "light" : "dark"} theme`}
      className="theme-button inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 transition hover:bg-white/10"
    >
      <span className="relative flex h-6 w-11 items-center rounded-full bg-white/10 p-1 ring-1 ring-white/10">
        <motion.span
          className="block h-4 w-4 rounded-full bg-gradient-to-br from-amber-300 via-orange-300 to-sky-300 shadow-lg"
          animate={{ x: isDark ? 0 : 20, rotate: isDark ? 0 : 180 }}
          transition={{ type: "spring", stiffness: 360, damping: 28 }}
        />
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="text-base leading-none">{isDark ? "🌙" : "☀️"}</span>
        <span className="hidden sm:inline">{isDark ? "Dark mode" : "Light mode"}</span>
      </span>
    </button>
  );
}
