// AI 테스트 세트 채점용 (실제 OpenRouter 호출). npm run eval:ai
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    include: ["tests-eval/**/*.eval.ts"],
    // .env.local 값을 쓰되, 명령에서 준 OPENROUTER_MODEL(모델 비교)이 있으면 그걸 우선한다
    env: { ...loadEnv("development", process.cwd(), ""), ...(process.env.OPENROUTER_MODEL ? { OPENROUTER_MODEL: process.env.OPENROUTER_MODEL } : {}) },
    testTimeout: 90_000,
  },
});
