import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Temporary public exposure (Cloudflare Tunnel, etc.)
    allowedHosts: true
  }
});
