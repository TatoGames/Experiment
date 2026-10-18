# GitHub Pages 배포 체크리스트

대상: `TatoGames/Experiment` (브랜치 `typing-racer`) → https://tatogames.github.io/Experiment/

## 사전 확인
- [x] 앱은 상대경로(`style.css`, `main.js`)만 사용 → 하위 경로 배포 가능
- [x] QA 회귀 테스트 13/13, 접근성 위반 0 (이전 단계 결과)
- [x] 저장소 `TatoGames/Experiment`(기존, private) 사용, 브랜치 `typing-racer`는 사람이 미리 생성
- [x] 비밀값·개인 경로·토큰이 없는지 확인

## push
- [ ] `typing-racer` 브랜치에 `app/`, `docs/`, `README.md`, `.github/workflows/pages.yml` 커밋 후 push

## Pages 활성화
- [ ] Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정
- [ ] Actions 탭에서 "Deploy to GitHub Pages" 성공 확인

## 배포 후 확인
- [ ] https://tatogames.github.io/Experiment/ 이 열린다 (404면 Source 설정 확인)
- [ ] 콘솔 오류 없음, 난이도 선택 → 한 판 → 결과 화면 → 새로고침 후 최고 기록 유지
- [ ] README의 Pages URL이 실제 주소와 같다

## 롤백
- Settings → Pages에서 Source를 해제하거나, 문제 커밋을 `git revert` 후 push.
