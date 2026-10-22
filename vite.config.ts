import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => ({
  // O app desktop carrega o bundle via file://; nesse caso, URLs absolutas
  // apontariam para a raiz do disco em vez da pasta dist/assets.
  base: mode === "desktop" ? "./" : "/",
  plugins: [
    react(),
    tailwindcss(),
  ],
}));
