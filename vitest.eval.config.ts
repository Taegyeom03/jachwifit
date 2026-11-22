// AI 테스트 세트 채점용 (실제 OpenRouter 호출). npm run eval:ai
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests-eval/**/*.eval.ts"],
    env: loadEnv("development", process.cwd(), ""),
    testTimeout: 90_000,
  },
});
