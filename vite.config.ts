import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

export default defineConfig({
  // Relative asset URLs work on GitHub project pages (/<repo>/) and on the local dev server.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    // IPv6 wildcard. With bindv6only=0 this also accepts 127.0.0.1.
    host: "::",
    port: 4179,
    strictPort: true,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
