import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vitest/config";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isSingleFile = process.env.SINGLE_FILE === "true";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(isSingleFile ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.tsx",
    css: true,
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
});
