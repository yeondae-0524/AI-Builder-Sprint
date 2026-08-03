# Begin Again

> **젊음을 젊음으로 낭비한 것을 후회하지 않도록,
> 일상의 작은 도전과 감정을 기록해 나만의 이야기로 완성하는 여정형 서비스**

## 서비스 링크

* **Web:** https://logmapbeginagain.vercel.app/
* **GitHub:** https://github.com/yeondae-0524/AI-Builder-Sprint

> 심사용 테스트 계정이 필요한 경우 제출 구글폼 또는 운영진 메일을 통해 별도로 제공합니다.

---

## 서비스 소개

**Begin Again**은 효율과 성과에 지친 사용자가 잠시 속도를 늦추고, 자신의 일상과 감정에 집중할 수 있도록 돕는 서비스입니다.

사용자는 **1주, 2주 또는 한 달의 여정**을 시작하고, 관심사와 상황에 맞게 추천된 작은 미션을 수행합니다.

미션을 수행하며 사진, 감정, 메모를 기록하면 쌓인 기록을 AI가 하나의 에세이와 시각적 콘텐츠로 정리합니다. 사용자는 평소 무심코 지나쳤던 경험을 돌아보고, 자신의 여정을 하나의 이야기로 간직할 수 있습니다.

---

## 문제 정의

우리는 더 빠르고 효율적인 삶을 요구받지만, 그 과정에서 자신의 감정과 일상을 충분히 돌아보지 못합니다.

Begin Again은 거창한 목표 대신 다음과 같은 작은 경험에 집중합니다.

* 평소 지나치던 계절의 변화 발견하기
* 익숙한 장소를 새로운 방식으로 경험하기
* 좋아하는 냄새, 소리, 풍경 기록하기
* 자신의 감정에 이름 붙이기
* 쌓인 기록을 통해 변화한 자신 돌아보기

---

## 서비스 이용 흐름

```text
회원가입 및 로그인
        ↓
관심사와 여정 기간 선택
        ↓
AI 기반 미션 추천
        ↓
미션 수행
        ↓
사진·감정·메모 기록
        ↓
캘린더와 탐색 화면에서 기록 확인
        ↓
완료된 여정을 AI 에세이와 시각 콘텐츠로 생성
        ↓
나만의 책장에 저장
```

---

## 핵심 기능

### 1. 여정 생성

* 1주, 2주 또는 한 달 단위의 여정 생성
* 사용자의 관심사와 활동 성향 반영
* 여정별 미션과 기록 관리

### 2. AI 미션 추천

* Upstage Solar API를 활용한 맞춤형 미션 생성
* 일상에서 바로 수행할 수 있는 일상형 미션
* 사용자 주변 장소를 활용하는 장소형 미션
* 거리, 비용, 소요 시간 등을 고려한 추천

### 3. 미션 수행 및 기록

* 미션 수행 사진 업로드
* 당시의 감정 선택
* 경험에 대한 자유로운 메모 작성
* 기록 공개 범위 설정

### 4. 캘린더 기반 아카이빙

* 날짜별 미션 기록 확인
* 여정 진행 상황 확인
* 과거의 사진과 감정을 시간순으로 회고

### 5. 탐색 및 소셜 기능

* 다른 사용자가 공개한 기록 탐색
* 다양한 미션 경험 확인
* 다른 사용자의 기록을 통해 새로운 활동 발견

### 6. AI 에세이 생성

* 완료된 여정의 기록을 기반으로 에세이 생성
* 실제 사용자가 남긴 기록과 감정을 중심으로 구성
* 기록되지 않은 경험을 임의로 생성하지 않도록 제한
* 여정 전체를 하나의 이야기로 연결

### 7. 시각 콘텐츠 및 책장

* 여정 기록을 활용한 네 컷 콘텐츠 생성
* 완성된 에세이와 시각 콘텐츠 저장
* 나만의 책장에서 과거 여정 다시 보기

---

## 기술 스택

| 구분             | 기술                                                   |
| -------------- | ---------------------------------------------------- |
| Frontend       | Expo SDK 54, React Native 0.81, React 19, TypeScript |
| Routing        | Expo Router                                          |
| Web Deployment | Vercel                                               |
| Backend        | Supabase Edge Functions, 별도 Node.js 백엔드              |
| Database       | Supabase, PostgreSQL, RPC                            |
| Authentication | Supabase Auth                                        |
| Storage        | Supabase Storage                                     |
| AI             | Upstage Solar API                                    |
| External API   | Kakao Local API                                      |
| Quality Check  | TypeScript, Expo ESLint                              |

---

## 시스템 구성

```text
Expo / React Native Client
        │
        ├── Supabase Auth
        ├── Supabase Database
        ├── Supabase Storage
        │
        ├── Supabase Edge Functions
        │       ├── AI 미션 추천
        │       └── AI 에세이 생성
        │
        ├── Upstage Solar API
        └── Kakao Local API
```

---

## 실행 환경

* Node.js 20.19.x 이상
* npm
* Expo SDK 54
* 웹 브라우저 또는 Android/iOS 실행 환경
* 원격 Supabase 프로젝트 접근 정보

Expo SDK 54는 React Native 0.81, React 19.1.0 및 최소 Node.js 20.19.x 환경을 기준으로 합니다.

---

## 로컬 실행 방법

### 1. 저장소 클론

```bash
git clone https://github.com/yeondae-0524/AI-Builder-Sprint.git
cd AI-Builder-Sprint
```

기본 브랜치가 `develop`이 아닌 환경에서는 다음 명령을 실행합니다.

```bash
git switch develop
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경변수 파일 생성

프로젝트 루트의 `.env.example`을 복사해 `.env` 파일을 만듭니다.

macOS / Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

생성한 `.env` 파일에 실제 테스트용 값을 입력합니다.

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_publishable_or_anon_key
```

### 4. TypeScript 검사

```bash
npx tsc --noEmit
```

### 5. 앱 실행

웹:

```bash
npm run web
```

기본 Expo 개발 서버:

```bash
npm run start
```

Android:

```bash
npm run android
```

iOS:

```bash
npm run ios
```

터미널에 표시된 QR 코드는 Expo SDK 54와 호환되는 Expo Go 또는 개발 빌드에서 스캔할 수 있습니다.

캐시 문제가 발생하는 경우 다음 명령을 실행합니다.

```bash
npx expo start --clear
```

---

## 환경변수

### 클라이언트 환경변수

| 변수명                        |  필수 | 설명                                      |
| -------------------------- | :-: | --------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL` |  O  | Supabase 프로젝트 URL                       |
| `EXPO_PUBLIC_SUPABASE_KEY` |  O  | 클라이언트용 Supabase publishable 또는 anon key |

> `EXPO_PUBLIC_` 접두사가 붙은 환경변수는 앱 번들에 포함될 수 있습니다.
> Service Role Key, Secret Key, Upstage API Key 등의 비밀값을 입력하면 안 됩니다.

### 서버 및 배포 환경변수

아래 환경변수는 일반 사용자의 로컬 클라이언트 실행에는 필요하지 않습니다. Supabase Edge Functions 또는 별도 백엔드 환경에 설정합니다.

| 변수명                   | 설정 위치                          | 설명                |
| --------------------- | ------------------------------ | ----------------- |
| `UPSTAGE_API_KEY`     | Supabase Edge Functions Secret | AI 미션 추천 및 에세이 생성 |
| `SUPABASE_URL`        | Supabase / Backend             | Supabase 프로젝트 URL |
| `SUPABASE_SECRET_KEY` | Backend Secret                 | 서버 전용 Supabase 키  |
| `KAKAO_REST_API_KEY`  | Backend Secret                 | Kakao 장소 검색 API   |

실제 비밀값은 GitHub에 커밋하지 않습니다.

테스트용 키가 필요한 경우 운영진 안내에 따라 별도로 전달하며, 주최 측이 보유한 Upstage API 키는 저장소에 제출하지 않습니다.

---

## 외부 서비스 의존성

본 프로젝트는 다음 외부 서비스에 의존합니다.

* Supabase Auth
* Supabase Database
* Supabase Storage
* Supabase Edge Functions
* Upstage Solar API
* Kakao Local API
* Vercel

일부 기능은 원격 Supabase 프로젝트와 외부 API 연결이 필요하므로, 완전한 로컬 백엔드 재현보다 배포 주소를 통한 테스트를 권장합니다.

---

## 주요 테스트 시나리오

1. 회원가입 또는 심사용 계정으로 로그인합니다.
2. 관심사와 여정 기간을 선택합니다.
3. 추천 미션을 확인하고 여정을 시작합니다.
4. 미션 수행 후 사진, 감정, 메모를 기록합니다.
5. 캘린더에서 저장된 기록을 확인합니다.
6. 탐색 화면에서 다른 사용자의 공개 기록을 확인합니다.
7. 완료된 여정을 바탕으로 AI 에세이를 생성합니다.
8. 생성된 에세이와 네 컷 콘텐츠를 확인합니다.
9. 완성된 결과물을 책장에 저장합니다.

---

## 프로젝트 구조

```text
AI-Builder-Sprint/
├─ app/                    # Expo Router 기반 화면
├─ components/             # 공통 UI 컴포넌트
├─ contexts/               # 전역 상태 및 인증 컨텍스트
├─ lib/                    # Supabase 클라이언트 등 공통 모듈
├─ services/               # 도메인별 API 및 데이터 접근 로직
├─ supabase/
│  ├─ functions/           # AI 및 서버 로직 Edge Functions
│  └─ migrations/          # 데이터베이스 마이그레이션
├─ backend/                # 별도 백엔드 및 통합 테스트 도구
├─ AGENTS.md               # 코딩 에이전트 작업 규칙
├─ AI_USAGE.md             # AI 활용 및 검증 과정
├─ app.json                # Expo 앱 설정
└─ package.json            # 프로젝트 의존성과 실행 명령
```

---

## 검증 명령어

제출 전 다음 명령을 실행해 프로젝트 상태를 확인합니다.

```bash
npx tsc --noEmit
npm run lint
npm run web
```

---

## 보안 안내

* `.env` 파일과 실제 API 키는 GitHub에 커밋하지 않습니다.
* 클라이언트에는 Supabase publishable 또는 anon key만 사용합니다.
* Supabase Service Role Key와 Secret Key는 서버 환경에서만 사용합니다.
* Upstage 및 Kakao 비밀키는 Supabase Edge Functions 또는 별도 백엔드에 저장합니다.
* 심사용 테스트 키는 대회 종료 후 폐기하는 것을 권장합니다.

---

## AI 활용 및 검증

Begin Again은 AI를 단순한 부가 기능이 아니라, 사용자의 경험을 발견하고 회고하도록 돕는 핵심 도구로 활용합니다.

AI는 다음 과정에 사용됩니다.

* 사용자 조건에 맞는 미션 생성
* 미션 기록을 기반으로 한 에세이 작성
* 기록 사이의 흐름과 감정 연결
* 여정 기반 시각 콘텐츠 구성

AI가 사용자가 기록하지 않은 사건이나 감정을 임의로 만들어내지 않도록 프롬프트 규칙과 응답 검증 로직을 적용했습니다.

개발 과정에서 AI를 사용한 범위와 결과 검증 과정은 [`AI_USAGE.md`](./AI_USAGE.md)에 정리되어 있습니다.

---

## 서비스 메시지

> 거창한 변화가 아니어도 괜찮습니다.
> 오늘의 작은 경험을 기록하는 순간,
> 당신의 삶은 다시 시작됩니다.
