import { useEffect, useState } from "react";

type Theme = "dark" | "light";

function readTheme(): Theme {
  if (typeof document === "undefined") {
    return "dark";
  }

  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export default function useDocumentTheme() {
  const [theme, setTheme] = useState<Theme>(readTheme);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }

    const target = document.documentElement;
    const observer = new MutationObserver(() => setTheme(readTheme()));
    observer.observe(target, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    setTheme(readTheme());

    return () => observer.disconnect();
  }, []);

  return theme;
}
