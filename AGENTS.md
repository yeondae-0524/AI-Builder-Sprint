# Expo SDK 54 Guidelines

Before writing or modifying Expo-related code, read the exact versioned Expo SDK 54 documentation:

https://docs.expo.dev/versions/v54.0.0/

Do not rely on documentation for a different Expo SDK version.

# Repository Guidelines

* PR, 이슈, 커밋은 원본 레포지토리가 아닌 팀에서 포크한 레포지토리에 생성한다.
* 작업 기준 브랜치는 `develop`이다.
* 기능 개발과 수정 작업은 별도의 `feature/*` 브랜치에서 진행한다.
* 환경변수와 API 키가 포함된 `.env` 파일은 커밋하지 않는다.
* 코드 수정 후 `npx tsc --noEmit`을 실행하여 TypeScript 오류를 확인한다.
* Expo 관련 패키지는 가능하면 `npm install` 대신 `npx expo install`로 설치한다.
* 제출 전 앱 실행과 주요 기능을 직접 테스트한다.
