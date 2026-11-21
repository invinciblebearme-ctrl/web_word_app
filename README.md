# 오늘의 영단어 UP!

교육부 지정 초등 영단어 800개를 80회(회당 10단어)로 나눠 학습하는 웹앱입니다.

## 기능

- **회차별 학습** (`/challenge/:id`): 단어 이미지, 발음 듣기(Web Speech TTS), 발음 인식(Chrome·Edge·Whale)
- **스크램블 게임** (`/scramble`, `/scramble-game/:id`)
- **나만의 단어장** (`/my-voca`): 브라우저 localStorage에 저장, PDF로 내보내기
- **회차 퀴즈** (`/quiz/:id`): 뜻→단어, 그림→단어, 소리→뜻, 받아쓰기, 예문 빈칸 채우기 5가지 유형을 섞어 출제
- **오늘의 학습 · 오답 노트** (`/review`): 복습할 단어·틀린 단어·새 단어를 섞은 하루 12문제, 오답 노트
- **주제별 단어** (`/topics`): 800단어를 17개 주제(동물, 음식, 학교·공부 …)로 묶어 보고, 덜 익힌 단어부터 주제 퀴즈
- **단어별 예문**: 800단어마다 초등 수준 예문과 우리말 뜻, 문장 듣기
- **소리 패턴** (`/phonics`): sh·ch 같은 자음 짝, 첫소리 이어 읽기, 매직 e, 모음 짝꿍, r 모음, 단어 가족(-ight, -ake …)으로 묶어 보고 듣고 쓰기 퀴즈
- **나만의 문장** (`/sentences`): 배운 단어 2~3개로 영어 문장을 쓰고 저장, 따라 쓰기 줄이 있는 학습지 PDF로 내보내기
- **수업 모드** (`/classroom`): 전자칠판용 전체 화면 플래시카드(회차·주제·학급 오답, 키보드 조작, 자동 넘기기), 번호 뽑기, 타이머
- **학급 진도** (`/class`, 선택 기능): 학생은 학급 코드와 번호만으로 참여하고, 선생님은 번호별 학습량과 반 전체가 많이 틀린 단어 Top 10을 봅니다
- **발음 피드백**: 음성 인식 후보 5개 중 가장 가까운 것으로 채점, 비슷한 정도(%)와 틀린 글자 표시, 천천히 듣기
- **학습 습관**: 연속 학습일, 하루 목표(10문제), 최근 5주 학습 달력, 배지 17종
- **학습 기록**: 단어별 숙련도(처음 → 익히는 중 → 거의 앎 → 완전히 앎)를 기록하고 홈 화면에 회차별 진도 표시
- **퀴즈앤 링크 모음** (`/quizn/`): 정적 페이지
- **단어 팡팡 게임** (`/WordGame/`): 웹캠 손동작 인식 게임, 정적 페이지
- **앱 설치·오프라인** (PWA): 홈 화면에 추가할 수 있고, 한 번 본 화면과 단어 그림은 인터넷이 끊겨도 열립니다

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
  utils/classSync.js 학급 진도 보내기 (대기열·재전송), utils/classroom.js 수업 도구
functions/          Cloudflare Pages Functions (학급 진도 API, /api/classes/...)
migrations/         D1 데이터베이스 스키마
tests/functions/    API 테스트 (node:sqlite로 D1을 흉내 냄)
public/
  quizn/, WordGame/ 별도 정적 페이지 (빌드 시 그대로 복사됨)
```

단어를 수정하려면 `src/data/all_rounds.json`을 편집하세요. `img`에는 이미지 파일명(예: `apple.webp`)을 그대로 적습니다.

## 배포

- `CI` 워크플로가 push와 PR마다 빌드를 검증하고 `dist`를 아티팩트로 올립니다.
- 사이트(voca.allforedu.kr)는 **Cloudflare Pages**가 배포 전용 저장소 **TodayVoca800**을 보고 배포합니다.
  - `main`에 머지하면 `Deploy` 워크플로가 테스트·빌드한 뒤 `scripts/sync-site.sh`로 `dist` 내용과 `functions/`, `src/data/all_rounds.json`을 TodayVoca800에 커밋합니다. 그러면 Cloudflare가 자동으로 다시 배포합니다.
  - TodayVoca800은 직접 고치지 마세요. 다음 배포 때 덮어써집니다.
  - 필요한 설정(한 번만): TodayVoca800에 **쓰기 권한이 있는 Deploy key**를 등록하고, 그 개인 키를 이 저장소 Secrets의 `SITE_DEPLOY_KEY`로 넣습니다.
  - 수동 실행은 Actions → Deploy → Run workflow (main만). main 최신 커밋이 아닌 실행은 건너뜁니다.
  - 주소가 `#/...` 형식(HashRouter)이라 `_redirects` 같은 별도 설정은 필요 없습니다.

### 학급 진도 서버 설정 (D1)

학급 진도 기능만 서버가 필요합니다. 설정하지 않아도 나머지 기능은 그대로 쓸 수 있고, 학급 화면에는 "아직 설정되지 않았어요"가 나옵니다.

1. Cloudflare 대시보드 → **Storage & Databases → D1** → 데이터베이스 만들기 (예: `voca-class`)
2. 만든 데이터베이스의 **Console**에서 `migrations/0001_class.sql` 내용을 붙여 넣고 실행
3. Pages 프로젝트(TodayVoca800과 연결된 프로젝트) → **Settings → Bindings → D1 database** 추가: 변수 이름 `DB`, 데이터베이스 `voca-class` (운영·미리보기 모두)
4. 다시 배포하면 `/api/classes`가 동작합니다

로컬 확인: `npx wrangler pages dev dist --d1 DB=local-class` (스키마는 `wrangler d1 execute ... --local --file migrations/0001_class.sql`로 적용)

**개인정보**: 학생 이름·이메일·IP는 받거나 저장하지 않습니다. 학생은 학급 코드 + 출석번호(1~99)와 기기마다 무작위로 만든 번호로만 구분합니다. 선생님 키는 해시로만 저장하며, 학급을 지우면 그 학급의 모든 기록이 함께 지워집니다. 학생이 학급에서 나가면 그 학생의 번호별 기록은 지워지고, 단어별 익명 집계만 남습니다.

## 학습 기록과 복습 규칙

- 퀴즈를 풀거나 쓰기 연습에서 단어별 **첫 시도**를 확인하면 기록됩니다. 단어 카드만 넘겨 본 것은 '본 적 있음'으로만 남고 숙련도는 바뀌지 않습니다.
- **복습할 날에** 맞히면 상자가 한 칸 올라가고(최대 5), 틀리면 언제든 0으로 돌아갑니다. 복습할 날 전에 다시 맞힌 것은 정답 수만 늘고 상자는 그대로라서, 하루에 여러 번 풀어도 '완전히 앎'으로 건너뛰지 않습니다. 다음 복습까지의 간격은 상자별로 0, 1, 3, 7, 14, 30일입니다.
- 숙련도: 상자 0~1 '익히는 중', 2~3 '거의 앎', 4~5 '완전히 앎'.
- 오늘의 학습은 최대 12문제입니다. 복습할 단어 → 오답 단어 순으로 채우되 새 단어 4개 자리는 남기고, 복습할 게 없으면 새 단어를 최대 8개 냅니다.
- 날짜별 푼 문제 수는 `word_activity_v1`에 기기 시간 기준으로 저장합니다. 연속 학습일은 오늘(아직 안 했으면 어제)까지 이어진 날 수입니다.
- 배지는 따로 저장하지 않고 학습 기록에서 매번 계산합니다. 연속 학습 배지는 최고 기록 기준이라 한 번 받으면 사라지지 않습니다.
- 기록은 학생 기기의 브라우저에만 저장되며 서버로 전송되지 않습니다.

## 오프라인 캐시 (서비스 워커)

- `public/sw.js`는 배포 빌드에서만 등록됩니다(`npm run dev`에서는 등록 안 됨).
- 페이지는 네트워크를 먼저 쓰고, 오프라인일 때만 저장본을 보여 줍니다. JS·CSS는 저장본을 먼저 쓰고 뒤에서 새로 받습니다.
- 단어 그림(`word-assets.pages.dev`)은 한 번 본 것을 최대 900개까지 저장합니다.
- 캐시 방식을 바꿀 때는 `sw.js`의 `VERSION`을 올리면 예전 캐시가 지워집니다.
- `WordGame/`, `quizn/` 정적 페이지는 서비스 워커가 처리하지 않습니다.

## 주제 분류와 발음 채점

- 주제는 `src/data/topics.json`(단어 → 주제 키)에 있습니다. 로컬 AI(Gemma)로 초안을 만든 뒤 사람이 검토해 고쳤습니다. 단어를 추가하면 여기도 함께 추가해야 하며, 빠지면 테스트가 실패합니다.
- 발음 채점(`src/utils/pronounce.js`)은 음성 인식이 소리만 듣는다는 점을 고려해 숫자(2 → two)와 소리가 같은 단어(four/for, two/to)를 맞은 것으로 봅니다. "the apple"처럼 3글자 이상 단어 앞뒤에 말이 붙어도 인정합니다.
- 직접 입력(음성 인식 미지원 브라우저)은 철자가 정확해야 정답입니다.
- 그림 서버에 없는 단어 그림(현재 27개)은 퀴즈에서 그림 문제 대신 뜻→단어 문제로 보여 줍니다.

## 예문·소리 패턴·나만의 문장

- 예문은 `src/data/examples.json`(`{영단어: {s: 예문, ko: 뜻}}`)에 있습니다. 로컬 AI(Gemma)로 초안을 만들고, Codex와 agy가 나눠 검수해 200개를 고쳤습니다(어색한 영어, 번역 오류, 아이에게 맞지 않는 장면). 예문에는 단어가 철자 그대로 들어 있어야 빈칸 문제가 만들어지고, 테스트가 이것을 확인합니다.
- 예문 데이터(약 68KB)는 첫 화면이 뜬 뒤 미리 불러옵니다. 아직 못 불러왔으면 빈칸 문제 없이 퀴즈가 나옵니다.
- 소리 패턴은 따로 태그를 달지 않고 철자 규칙으로 찾습니다(`src/utils/phonics.js`). 철자는 같아도 소리가 다른 단어(bread의 ea, war의 ar, doctor의 or 등)는 빼거나 따로 묶었습니다. 4단어 이상인 패턴만 보입니다.
- 나만의 문장은 고른 단어를 모두 넣고(cats, played처럼 바뀐 꼴도 인정) 3단어 이상이면 저장할 수 있습니다. 첫 글자 대문자와 문장부호는 도움말로만 알려 줍니다. 문장은 기기에만 저장되고(최대 200개), 학습지 PDF에는 최근 20개가 들어갑니다.

