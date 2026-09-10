import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { include: ["tests/base/**/*.test.ts"], fileParallelism: false },
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
});
