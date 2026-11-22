# 자취핏 작업 규칙

자취생을 위한 칼로리 · 단백질 · 식비 플래너 (Next.js 15 · TypeScript · Supabase · Netlify).
기획 문서는 옆 폴더 `../jachifit/docs` (PRD · 결정 기록 · handoff)에 있다.

## 실행 · 확인
- `npm run dev` (http://localhost:3000), `npm run typecheck`, `npm test`, `npm run build`
- 기능을 바꾸면 `npm run typecheck && npm test`를 통과시킨 뒤 커밋한다.
- 개발 서버가 켜진 채로 `npm run build`를 하면 `.next`가 덮어써져 개발 서버가 깨진다. 빌드 전에 개발 서버를 끈다.

## Git 규칙
- main에 직접 커밋하지 않는다. 브랜치 `feat/…` · `fix/…` · `docs/…` · `chore/…` → PR → 리뷰 → merge.
- 커밋 메시지는 `종류: 무엇을 왜` (한국어). 종류는 feat · fix · docs · style · refactor · test · chore. 한 커밋 = 한 가지 작업.
- PR 본문: 무엇을 바꿨는지 · 확인 방법 · 남은 문제, 관련 이슈는 `Closes #번호`.
- CI(.github/workflows/ci.yml)가 초록이어야 merge한다.

## 키 · 개인정보
- 키는 `.env.local`(로컬)과 Netlify 환경변수에만 둔다. `.env*`는 커밋하지 않고 `.env.example`에는 이름만 적는다.
- 브라우저에 노출되는 값(`NEXT_PUBLIC_`)은 Supabase publishable(anon) 키뿐이다. service_role · AI 키 같은 비밀값에 `NEXT_PUBLIC_`을 붙이지 않는다.
- 키 값을 코드 · 로그 · 화면 · 커밋 메시지에 쓰지 않는다.

## 데이터
- 음식 데이터 원본은 `data/foods.csv`, 앱은 `lib/foods.data.json`(자동 생성)을 읽는다. 음식 id = CSV 행 번호이므로 새 음식은 맨 끝에 추가한다.
- 영양 · 가격마다 출처와 기준일을 남기고, 확인 안 된 값은 `임시값`으로 표시한다.

## 문서
- 기능이 바뀌면 README(주요 기능 · 실행 방법 · 필요한 키 이름)를 같은 PR에서 고친다.
- 설계 결정은 `../jachifit/docs`의 decisions.md에 남긴다.
