# Typing Speed Racer

영어 타자 속도를 재는 미니게임입니다. 문장을 정확히 치면 자동차가 결승선으로 달리고, 끝나면 WPM·정확도·시간이 나옵니다. 난이도는 쉬움·보통·어려움이고 최고 기록은 브라우저 `localStorage`에 저장됩니다.

- **Pages URL (예정):** https://tatogames.github.io/Experiment/
- 의존성·빌드 단계가 없는 정적 웹앱입니다 (`app/index.html`, `style.css`, `main.js`).
- 물리 키보드가 있는 데스크톱 브라우저용입니다.

## 실행 방법

```sh
# 방법 1: 파일 직접 열기
open app/index.html

# 방법 2: 로컬 서버 (배포 환경과 비슷하게)
python3 -m http.server 8000 --directory app
# → http://localhost:8000/
```

## 배포

`typing-racer` 브랜치에 push하면 `.github/workflows/pages.yml`이 `app/` 폴더만 GitHub Pages로 배포합니다. Pages의 Source는 **GitHub Actions**여야 합니다. 순서는 [docs/deploy-checklist.md](docs/deploy-checklist.md)를 따르세요.

## 알려진 제한

Safari에서는 실제로 검증하지 못했고, 실제 스피커와 VoiceOver 확인도 남아 있습니다.
