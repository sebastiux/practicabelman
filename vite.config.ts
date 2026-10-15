import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Rutas relativas: funciona igual en https://<usuario>.github.io/<repo>/ que en local.
  base: "./",
  plugins: [react()],
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
