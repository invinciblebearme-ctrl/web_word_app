# 오늘의 영단어 UP!

교육부 지정 초등 영단어 800개를 80회(회당 10단어)로 나눠 학습하는 웹앱입니다.

## 기능

- **회차별 학습** (`/challenge/:id`): 단어 이미지, 발음 듣기(Web Speech TTS), 발음 인식(Chrome·Edge·Whale)
- **스크램블 게임** (`/scramble`, `/scramble-game/:id`)
- **나만의 단어장** (`/my-voca`): 브라우저 localStorage에 저장, PDF로 내보내기
- **회차 퀴즈** (`/quiz/:id`): 뜻→단어, 그림→단어, 소리→뜻, 받아쓰기 4가지 유형을 섞어 출제
- **오늘의 복습 · 오답 노트** (`/review`): 간격 반복으로 복습할 날이 된 단어와 틀린 단어 모음
- **학습 기록**: 단어별 숙련도(처음 → 익히는 중 → 거의 앎 → 완전히 앎)를 기록하고 홈 화면에 회차별 진도 표시
- **퀴즈앤 링크 모음** (`/quizn/`): 정적 페이지
- **단어 팡팡 게임** (`/WordGame/`): 웹캠 손동작 인식 게임, 정적 페이지

## 개발

```bash
npm ci
npm run dev       # 개발 서버
npm run build     # dist/ 에 빌드
npm run preview   # 빌드 결과 미리보기
npm test          # 단위 테스트 (vitest)
```

## 구조

```
src/
  pages/            화면 (Home, WordChallenge, ScrambleHome, ScrambleGame, MyVocabulary)
  components/       Navbar
  data/all_rounds.json   단어 데이터 (회차 → words[{en, ko, img}])
  utils/storage.js  나만의 단어장 (localStorage key: my_voca_list)
  utils/image.js    단어 이미지 URL (https://word-assets.pages.dev/<img>)
  utils/progress.js 학습 기록과 간격 반복 (localStorage key: word_progress_v1)
  utils/quiz.js     퀴즈 문제 생성
  utils/speech.js   발음 듣기(TTS)와 음성 인식 지원 여부
public/
  quizn/, WordGame/ 별도 정적 페이지 (빌드 시 그대로 복사됨)
```

단어를 수정하려면 `src/data/all_rounds.json`을 편집하세요. `img`에는 이미지 파일명(예: `apple.webp`)을 그대로 적습니다.

## 배포

- `CI` 워크플로가 push와 PR마다 빌드를 검증하고 `dist`를 아티팩트로 올립니다.
- `Deploy to GitHub Pages` 워크플로는 Actions 탭에서 수동으로 실행합니다. 처음 한 번은 저장소 Settings → Pages → Source를 "GitHub Actions"로 바꿔야 합니다.

## 학습 기록과 복습 규칙

- 퀴즈를 풀거나 쓰기 연습에서 단어별 **첫 시도**를 확인하면 기록됩니다. 단어 카드만 넘겨 본 것은 '본 적 있음'으로만 남고 숙련도는 바뀌지 않습니다.
- 맞히면 상자가 한 칸 올라가고(최대 5), 틀리면 0으로 돌아갑니다. 다음 복습까지의 간격은 상자별로 0, 1, 3, 7, 14, 30일입니다.
- 숙련도: 상자 0~1 '익히는 중', 2~3 '거의 앎', 4~5 '완전히 앎'.
- 기록은 학생 기기의 브라우저에만 저장되며 서버로 전송되지 않습니다.
