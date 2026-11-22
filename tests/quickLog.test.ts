// 자주 먹는 음식 · 지난 기록 복사(lib/quickLog.ts) 단위 테스트
import { describe, expect, it } from "vitest";
import { copyEntries, frequentFoods, previousLoggedDay } from "@/lib/quickLog";
import type { Entry, Logs } from "@/lib/store";

const e = (foodId: number, id = `${foodId}`): Entry => ({ id, foodId, amount: 1, unit: "serving", meal: "아침" });
const logs: Logs = {
  "2026-11-18": { entries: [e(2), e(102), e(2, "2b")] },
  "2026-11-19": { entries: [e(2), e(44)] },
  "2026-11-20": { entries: [] },
  "2026-11-21": { entries: [e(102), e(104)] },
  "2026-11-23": { entries: [e(10)] },
};

describe("previousLoggedDay", () => {
  it("기록이 빈 날은 건너뛰고 가장 최근 기록한 날", () => {
    expect(previousLoggedDay(logs, "2026-11-23")).toBe("2026-11-21");
    expect(previousLoggedDay(logs, "2026-11-21")).toBe("2026-11-19");
  });
  it("너무 오래됐거나 없으면 null", () => {
    expect(previousLoggedDay(logs, "2026-11-18")).toBeNull();
    expect(previousLoggedDay(logs, "2026-12-30")).toBeNull();
  });
});

describe("frequentFoods", () => {
  it("먹은 날 수 순, 하루에 두 번은 1번으로, 한 번만 먹은 건 제외", () => {
    const names = frequentFoods(logs, "2026-11-23").map((f) => f.id);
    expect(names).toEqual([102, 2]); // 공기밥(11/18, 11/21 · 더 최근) · 계란(11/18, 11/19)
  });
  it("기준일 이후 기록은 세지 않는다", () => {
    expect(frequentFoods(logs, "2026-11-19").map((f) => f.id)).toEqual([2]);
  });
});

describe("copyEntries", () => {
  it("새 id로 복사하고 원본은 그대로", () => {
    let n = 0;
    const copied = copyEntries(logs["2026-11-19"], () => `new${n++}`);
    expect(copied.map((c) => c.id)).toEqual(["new0", "new1"]);
    expect(copied.map((c) => c.foodId)).toEqual([2, 44]);
    expect(logs["2026-11-19"].entries[0].id).toBe("2");
  });
});
