import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem("india-market-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    return "dark";
  }
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    try {
      window.localStorage.setItem("india-market-theme", theme);
    } catch {
      // Ignore storage failures
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
