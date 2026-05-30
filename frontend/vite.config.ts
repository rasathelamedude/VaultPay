import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // Bind IPv4 on Windows; "localhost" alone often listens only on [::1].
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  }
});
