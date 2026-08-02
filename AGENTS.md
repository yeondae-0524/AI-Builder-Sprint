제출용 문서 적용 순서

1. 이 폴더의 README.md, AI_USAGE.md, .env.example을 프로젝트 최상위 폴더에 복사합니다.
2. app.json은 기존 파일을 백업한 뒤 교체합니다. 변경점은 expo.name을 "Begin Again"으로 바꾼 것입니다.
3. 배포 주소 https://logmapbeginagain.vercel.app/ 가 실제로 열리는지 확인합니다.
4. 심사용 테스트 계정이 있다면 README의 안내와 구글폼에 계정 정보를 추가합니다.
5. 다음 명령을 실행합니다.

npx tsc --noEmit
npm run lint
npm run web
git status
git add README.md AI_USAGE.md .env.example app.json
git commit -m "docs: complete preliminary submission guide"
git push origin develop