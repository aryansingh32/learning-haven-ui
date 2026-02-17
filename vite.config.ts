import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 5173,
    hmr: {
      overlay: false,
    },
    proxy: {
      // Proxy compile requests to the compile server
      "/api/compile": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
        // Don't fail if compile server is down - JSCPP will be used as fallback
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('[Vite] Compile server proxy error (this is OK - JSCPP will be used):', err.message);
          });
        },
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Pre-bundle JSCPP and its CJS dependencies so Vite's
  // CJS→ESM conversion handles them as a single unit
  optimizeDeps: {
    include: ["JSCPP", "lodash", "pegjs-util"],
  },
}));
