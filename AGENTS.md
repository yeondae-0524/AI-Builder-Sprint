# 제출용 문서 적용 순서

## 1. 최신 develop 브랜치 받기

프로젝트 최상위 폴더에서 다음 명령을 실행합니다.

```bash
git switch develop
git pull --ff-only origin develop
```

원격 저장소에 팀원의 최신 커밋이 있을 수 있으므로, 문서를 교체하기 전에 반드시 최신 상태로 업데이트합니다.

## 2. 제출용 문서 반영

다음 파일을 프로젝트 최상위 폴더에 복사하거나 기존 파일과 내용을 비교해 반영합니다.

* `README.md`
* `AI_USAGE.md`
* `AGENTS.md`
* 그 외 실제 개발 과정에서 사용한 AI 설정 파일

예시:

```text
CLAUDE.md
.claude/
.agents/
.omc/
```

실제로 사용하지 않은 설정 파일을 증빙 목적으로 새로 만들 필요는 없습니다.

API Key, 비밀번호, 토큰 등 민감정보가 포함된 파일은 복사하거나 커밋하지 않습니다.

> 추가 수정 허용 범위가 README와 AI 관련 설정 파일로 제한되어 있으므로, `app.json`, `.env.example`, 소스코드 및 기능 관련 파일은 수정하지 않습니다.

## 3. 배포 주소 확인

다음 주소가 정상적으로 열리는지 확인합니다.

* https://logmapbeginagain.vercel.app/

가능하면 아래 주요 기능도 함께 확인합니다.

1. 로그인
2. 미션 추천
3. 미션 기록
4. 캘린더 조회
5. AI 에세이 생성
6. 네 컷 콘텐츠 확인
7. 책장 저장

## 4. 심사용 테스트 계정 전달

심사용 테스트 계정이 필요한 경우 제출 구글폼 또는 운영진 메일을 통해 별도로 전달합니다.

테스트 계정의 비밀번호는 README, GitHub 저장소, 커밋 메시지 등에 공개하지 않습니다.

## 5. 프로젝트 검증

다음 명령을 각각 실행합니다.

```bash
npx tsc --noEmit
```

```bash
npm run lint
```

```bash
npm run web
```

`npm run web` 실행 후 브라우저에서 주요 기능을 확인하고, 터미널에서 `Ctrl+C`를 눌러 서버를 종료합니다.

변경된 파일을 확인합니다.

```bash
git status
git diff -- README.md AI_USAGE.md AGENTS.md
```

의도하지 않은 소스코드나 설정 파일이 변경 목록에 포함되어 있다면 커밋하지 않습니다.

## 6. 문서 커밋 및 푸시

README와 실제 사용한 AI 관련 파일만 스테이징합니다.

```bash
git add README.md AI_USAGE.md AGENTS.md
git status
```

`CLAUDE.md`, `.claude`, `.agents`, `.omc` 등을 실제로 사용했다면 해당 경로도 추가합니다.

```bash
git add CLAUDE.md .claude .agents .omc
```

존재하지 않는 경로는 명령에서 제외합니다.

변경 내용을 커밋하고 푸시합니다.

```bash
git commit -m "docs: add AI usage evidence"
git push origin develop
```

푸시가 거절되면 강제 푸시하지 않고 다음 명령으로 최신 변경을 받은 뒤 다시 시도합니다.

```bash
git pull --ff-only origin develop
git push origin develop
```

## 7. GitHub 최종 확인

GitHub의 default 브랜치에서 다음 항목을 직접 확인합니다.

* `README.md`에 서비스 기능과 개발 과정의 AI 활용 방식이 설명되어 있다.
* `AGENTS.md`와 `AI_USAGE.md`가 실제로 보인다.
* 실제 사용한 AI 설정 파일이 정상적으로 올라가 있다.
* `.gitignore` 때문에 AI 관련 폴더가 누락되지 않았다.
* API Key, 비밀번호, 토큰 등 민감정보가 포함되지 않았다.
* 소스코드나 기능 관련 파일이 추가로 수정되지 않았다.
