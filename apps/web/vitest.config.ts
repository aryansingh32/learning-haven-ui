import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "../../tests/frontend/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "./src") },
      { find: "@repo/assessment-core", replacement: path.resolve(__dirname, "../../packages/assessment-core/src/index.ts") },
      // Specs in ../../tests/frontend sit outside this package, so bare imports
      // would otherwise fail to resolve; point them at this app's node_modules.
      { find: /^(react|react-dom|react-router-dom|sonner|@tanstack\/react-query|@testing-library\/[^/]+)(\/.*)?$/, replacement: path.resolve(__dirname, "node_modules") + "/$1$2" },
    ],
  },
});
