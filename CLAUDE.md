# Expo HAS CHANGED

Read the exact versioned documentation at:

https://docs.expo.dev/versions/v54.0.0/

Before writing or modifying Expo-related code, verify that the implementation is compatible with Expo SDK 54.

Do not rely on documentation for another Expo SDK version.

# Repository Guidelines

* PR, 이슈, 커밋은 원본 레포지토리가 아닌 팀에서 포크한 레포지토리에 생성한다.
* 작업 기준 브랜치는 `develop`이다.
* 기능 개발과 수정은 별도의 `feature/*` 브랜치에서 진행한다.
* 환경변수와 API 키가 포함된 `.env` 파일은 커밋하지 않는다.
* Expo 관련 패키지는 가능하면 `npx expo install`로 설치한다.
* 코드 수정 후 `npx tsc --noEmit`을 실행하여 TypeScript 오류를 확인한다.
* 제출 전 앱을 실행하고 주요 기능이 정상적으로 동작하는지 확인한다.
