import { Suspense } from "react";
import Today from "./Today";

export default function Home() {
  return (
    <Suspense fallback={<p className="muted">불러오는 중…</p>}>
      <Today />
    </Suspense>
  );
}
