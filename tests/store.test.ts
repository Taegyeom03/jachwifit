// 날짜 키 검사(lib/store.ts): 없는 날짜 · DB가 받지 않는 범위는 기록하지 않는다
import { describe, expect, it } from "vitest";
import { isValidDayKey } from "@/lib/store";

describe("isValidDayKey", () => {
  it("정상 날짜", () => {
    expect(isValidDayKey("2026-11-23")).toBe(true);
    expect(isValidDayKey("2028-02-29")).toBe(true); // 윤년
  });
  it("형식만 맞고 없는 날짜 · 범위 밖은 거절", () => {
    for (const k of ["2026-02-30", "2026-13-01", "2027-02-29", "2019-12-31", "2101-01-01", "2026-1-5", "abcd-ef-gh"]) {
      expect(isValidDayKey(k), k).toBe(false);
    }
  });
});
