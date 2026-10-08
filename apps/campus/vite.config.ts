import path from "path"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { defineConfig } from "vite"

// In development the portal talks to the Forge API (sign-in) and the
// Campus API through same-origin proxies, so no CORS setup is needed.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": { target: process.env.FORGE_API_URL || "http://localhost:5000", changeOrigin: true },
      "/campus": { target: process.env.CAMPUS_API_URL || "http://localhost:5100", changeOrigin: true },
    },
  },
})
