# Coin Shop

포인트 적립, 상품 구매, 관리자용 학생/상품/가맹점/PIN/공지 관리를 제공하는 Next.js + Supabase 프로젝트입니다.

상세 운영 방법은 [guide.md](guide.md)를 참고하세요.

## 기술 스택

| 영역 | 사용 기술 |
| --- | --- |
| Frontend | Next.js, React, Tailwind CSS |
| Backend | Next.js API Routes |
| Database/Auth | Supabase |
| Excel Upload | xlsx |
| Deploy | Vercel |

## 주요 기능

- 학생 학부모 연락처 기반 입장
- 형제/자매처럼 같은 연락처에 여러 학생이 있을 경우 학생 선택
- 학생 마이페이지
  - 기본 정보
  - 포인트 내역
  - 구매 내역
- 학생 상점 입장
  - 상품 카테고리 필터
  - 상품 상세 팝업
  - DP 차감 구매
- 관리자 페이지
  - 학생 관리
  - 상점 관리
  - 가맹점 관리
  - PIN 관리
  - 공지 관리

## 주요 경로

| 경로 | 설명 |
| --- | --- |
| `/lobby` | 학생 입장 화면 |
| `/dashboard` | 학생 마이페이지/상점 |
| `/admin` | 관리자 로그인/관리 화면 |

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 접속합니다.

```text
http://localhost:3000
```

## 환경변수

`.env` 또는 배포 환경에 아래 값을 설정합니다.

| 변수명 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 서버 API용 Supabase service role key |

예시는 [.env.sample](.env.sample)을 참고하세요.

주의: `SUPABASE_SERVICE_ROLE_KEY`는 서버 API에서만 사용해야 하며 클라이언트 코드에 노출되면 안 됩니다.

## 검증

배포 전 아래 명령어를 실행합니다.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Supabase

Supabase CLI 로그인:

```bash
npx supabase login
```

프로젝트 연결:

```bash
npx supabase link --project-ref YOUR_PROJECT_REF
```

마이그레이션 적용 전 확인:

```bash
npx supabase db push --dry-run
```

실제 DB 반영:

```bash
npx supabase db push
```

더 자세한 migration 운영 방법은 [guide.md](guide.md)의 `Migration 작업` 섹션을 참고하세요.

## Vercel 배포

이 프로젝트는 별도 Django/Express 서버 없이 Vercel + Supabase로 배포할 수 있습니다.

1. Vercel에서 GitHub 저장소 Import
2. Framework Preset을 `Next.js`로 설정
3. 환경변수 3개 등록
4. Deploy 실행
5. Supabase Auth URL Configuration에 Vercel 도메인 추가

## 참고

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

To learn more about Next.js:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)
- [Next.js GitHub repository](https://github.com/vercel/next.js)

For Vercel deployment details, see the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying).
