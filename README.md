# 오늘의 영단어 UP!

교육부 지정 초등 영단어 800개를 80회(회당 10단어)로 나눠 학습하는 웹앱입니다.

## 기능

- **회차별 학습** (`/challenge/:id`): 단어 이미지, 발음 듣기(Web Speech TTS), 발음 인식(Chrome·Edge·Whale)
- **스크램블 게임** (`/scramble`, `/scramble-game/:id`)
- **나만의 단어장** (`/my-voca`): 브라우저 localStorage에 저장, PDF로 내보내기
- **퀴즈앤 링크 모음** (`/quizn/`): 정적 페이지
- **단어 팡팡 게임** (`/WordGame/`): 웹캠 손동작 인식 게임, 정적 페이지

## 개발

```bash
npm ci
npm run dev       # 개발 서버
npm run build     # dist/ 에 빌드
npm run preview   # 빌드 결과 미리보기
```

## 구조

```
src/
  pages/            화면 (Home, WordChallenge, ScrambleHome, ScrambleGame, MyVocabulary)
  components/       Navbar
  data/all_rounds.json   단어 데이터 (회차 → words[{en, ko, img}])
  utils/storage.js  나만의 단어장 (localStorage key: my_voca_list)
  utils/image.js    단어 이미지 URL (https://word-assets.pages.dev/<img>)
public/
  quizn/, WordGame/ 별도 정적 페이지 (빌드 시 그대로 복사됨)
```

단어를 수정하려면 `src/data/all_rounds.json`을 편집하세요. `img`에는 이미지 파일명(예: `apple.webp`)을 그대로 적습니다.

## 배포

- `CI` 워크플로가 push와 PR마다 빌드를 검증하고 `dist`를 아티팩트로 올립니다.
- `Deploy to GitHub Pages` 워크플로는 Actions 탭에서 수동으로 실행합니다. 처음 한 번은 저장소 Settings → Pages → Source를 "GitHub Actions"로 바꿔야 합니다.
