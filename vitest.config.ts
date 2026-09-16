import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/base/**"],
    // Huso UTC para las pruebas de fecha: sin esto, el color de la suite
    // dependería del huso del portátil (Colombia, Madrid, etc.) y una
    // prueba que mata mutaciones en un lugar no las mata en otro.
    env: { TZ: "UTC" },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  // La primera prueba que importa un .tsx (la pantalla de personas) necesita
  // el runtime automático de JSX; sin esto, esbuild transforma a
  // React.createElement sin importar React y revienta en tiempo de
  // ejecución con "React is not defined".
  esbuild: { jsx: "automatic" },
});
