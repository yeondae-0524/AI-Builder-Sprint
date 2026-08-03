Begin Again

젊음을 젊음으로 낭비한 것을 후회하지 않도록, 일상의 작은 도전과 감정을 기록해 나만의 이야기로 완성하는 여정형 서비스

서비스 소개

Begin Again은 효율과 성과에 지친 사용자가 잠시 속도를 늦추고 자신에게 집중할 수 있도록 돕는 서비스입니다.

사용자는 1주, 2주 또는 한 달의 여정을 시작하고, 일상에서 실천할 수 있는 작은 미션을 수행합니다. 수행 과정에서 사진과 감정을 기록하고, 쌓인 기록을 AI가 하나의 에세이와 시각적 콘텐츠로 정리합니다.

핵심 기능

회원가입 및 로그인

관심사와 기간에 맞는 여정 생성

일상형·장소형 미션 추천

사진, 감정, 메모를 포함한 미션 기록

캘린더 기반 기록 확인

다른 사용자의 기록 탐색 및 소셜 상호작용

Upstage AI 기반 미션 추천 및 최종 에세이 생성

완성된 에세이와 네 컷 콘텐츠 아카이빙

배포 주소

Web: https://logmapbeginagain.vercel.app/

GitHub: https://github.com/yeondae-0524/AI-Builder-Sprint

심사용 테스트 계정이 필요한 경우 구글폼 또는 운영진 메일을 통해 별도로 제공합니다.

기술 스택

구분

기술

Frontend

Expo SDK 54, React Native 0.81, React 19, TypeScript

Routing

Expo Router

Web deployment

Vercel

Backend / Database

Supabase, PostgreSQL, RPC, Edge Functions

Authentication

Supabase Auth

Storage

Supabase Storage

AI

Upstage Solar API

External API

Kakao Local API

Quality check

TypeScript, Expo ESLint

실행 환경

Node.js 20.19.x 이상

npm

Expo SDK 54

웹 브라우저 또는 Android/iOS 실행 환경

원격 Supabase 프로젝트 접근 정보

Expo SDK 54는 React Native 0.81, React 19.1.0 및 최소 Node.js 20.19.x를 기준으로 합니다.

로컬 실행 방법

1. 저장소 클론

git clone https://github.com/yeondae-0524/AI-Builder-Sprint.git
cd AI-Builder-Sprint

기본 브랜치가 develop이 아닌 환경에서는 다음 명령을 실행합니다.

git switch develop

2. 패키지 설치

npm install

3. 환경변수 파일 생성

프로젝트 루트의 .env.example을 복사해 .env 파일을 만듭니다.

macOS / Linux:

cp .env.example .env

Windows PowerShell:

Copy-Item .env.example .env

.env에 실제 테스트용 값을 입력합니다.

EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=your_supabase_publishable_or_anon_key

4. TypeScript 검사

npx tsc --noEmit

5. 앱 실행

웹:

npm run web

기본 Expo 개발 서버:

npm run start

Android:

npm run android

iOS:

npm run ios

터미널에 표시된 QR 코드를 SDK 54와 호환되는 Expo Go 또는 개발 빌드로 스캔할 수 있습니다.

캐시 문제 발생 시:

npx expo start --clear

환경변수

클라이언트 실행에 필요한 변수

변수명

필수

설명

EXPO_PUBLIC_SUPABASE_URL

O

Supabase 프로젝트 URL

EXPO_PUBLIC_SUPABASE_KEY

O

클라이언트용 Supabase publishable 또는 anon key

EXPO_PUBLIC_ 접두사가 붙은 값은 앱 번들에 포함될 수 있으므로 service role key, secret key, Upstage API key 등 비밀값을 넣지 마세요.

서버 및 배포 환경에서 사용하는 변수

아래 값은 일반 사용자의 로컬 클라이언트 실행에는 필요하지 않으며, Supabase Edge Functions 또는 별도 백엔드 환경에 설정합니다.

변수명

위치

설명

UPSTAGE_API_KEY

Supabase Edge Functions secret

AI 미션 추천 및 에세이 생성

SUPABASE_URL

Supabase / Backend

Supabase 프로젝트 URL

SUPABASE_SECRET_KEY

Backend secret

서버 전용 Supabase 키

KAKAO_REST_API_KEY

Backend secret

Kakao 장소 검색 API

실제 비밀값은 GitHub에 커밋하지 않습니다. 테스트용 키가 필요한 경우 운영진 안내에 따라 별도 전달합니다. 주최 측이 보유한 Upstage API 키는 제출하지 않습니다.

외부 서비스 의존성

본 프로젝트는 다음 외부 서비스에 의존합니다.

Supabase Auth

Supabase Database

Supabase Storage

Supabase Edge Functions

Upstage Solar API

Kakao Local API

Vercel

따라서 완전한 로컬 백엔드 재현보다 위 배포 주소를 통한 테스트를 권장합니다.

주요 테스트 시나리오

회원가입 또는 심사용 계정으로 로그인

관심사와 여정 기간 선택

추천 미션 확인 및 여정 시작

미션 수행 후 사진·감정·메모 기록

캘린더에서 기록 확인

탐색 화면에서 다른 기록 확인

완료된 여정으로 AI 에세이 생성

생성된 에세이와 네 컷 콘텐츠 확인 및 저장

프로젝트 구조

AI-Builder-Sprint/
├─ app/                 # Expo Router 화면
├─ components/          # 공통 UI 컴포넌트
├─ contexts/            # 전역 상태 및 인증 컨텍스트
├─ lib/                 # Supabase 클라이언트 등 공통 모듈
├─ services/            # 도메인별 API 및 데이터 접근 로직
├─ supabase/
│  ├─ functions/        # AI 및 서버 로직 Edge Functions
│  └─ migrations/       # 데이터베이스 마이그레이션
├─ backend/             # 별도 백엔드 및 통합 테스트 도구
├─ AGENTS.md            # 코딩 에이전트 작업 규칙
├─ AI_USAGE.md          # AI 활용 증빙
└─ app.json             # Expo 앱 설정

검증 명령어

npx tsc --noEmit
npm run lint
npm run web

보안 안내

.env 파일과 실제 API 키는 커밋하지 않습니다.

클라이언트에는 Supabase publishable/anon key만 사용합니다.

Supabase service role/secret key와 Upstage/Kakao 비밀키는 서버 환경에만 저장합니다.

심사용 테스트 키는 대회 종료 후 폐기하는 것을 권장합니다.

AI 활용 증빙

개발 과정에서 AI를 사용한 범위와 검증 과정은 AI_USAGE.md에 정리되어 있습니다.