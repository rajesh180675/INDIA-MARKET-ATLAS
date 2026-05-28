import { type ReactNode } from "react";
import { ThemeProvider } from "./ThemeContext";
import ErrorBoundary from "../components/ErrorBoundary";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>{children}</ThemeProvider>
    </ErrorBoundary>
  );
}
