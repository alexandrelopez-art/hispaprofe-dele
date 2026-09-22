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
    // Los ficheros van de uno en uno. Las pruebas que llaman a tesseract de
    // verdad (rótulos y examen completo) levantan cada una su worker de
    // WebAssembly; en paralelo se pelean por la CPU y la memoria del
    // portátil y lo que suelto tarda 24 s pasa de 300 s y revienta por
    // tiempo. El resto de la suite son 3 s, así que serializar no duele.
    fileParallelism: false,
    // Un examen entero son ~30 llamadas a tesseract: los 5 s de vitest no dan.
    testTimeout: 120_000,
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
