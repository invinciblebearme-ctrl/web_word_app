#!/usr/bin/env bash
# 빌드 결과(dist)와 서버 함수(functions)를 배포 저장소(TodayVoca800) 폴더로 옮긴다.
# 사용: npm run build 후 scripts/sync-site.sh <배포 저장소 폴더>
set -euo pipefail
SITE=${1:?배포 저장소 폴더를 지정하세요}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
test -f "$ROOT/dist/index.html" || { echo "dist가 없습니다. 먼저 npm run build" >&2; exit 1; }
# 잘못된 폴더를 지우지 않도록: 대상이 TodayVoca800 저장소의 맨 위 폴더인지 확인
SITE=$(cd "$SITE" && pwd -P)
[ "$SITE" != "$(cd "$ROOT" && pwd -P)" ] || { echo "소스 저장소 자신은 대상이 될 수 없습니다" >&2; exit 1; }
[ "$(git -C "$SITE" rev-parse --show-toplevel 2>/dev/null)" = "$SITE" ] || { echo "$SITE 는 git 저장소 맨 위 폴더가 아닙니다" >&2; exit 1; }
git -C "$SITE" remote get-url origin | grep -qiE '[:/]invinciblebearme-ctrl/TodayVoca800(\.git)?$' \
  || { echo "$SITE 의 origin이 TodayVoca800이 아닙니다" >&2; exit 1; }

# 정적 파일: dist 내용으로 맞춤 (.git, functions, src는 아래에서 따로 처리)
rsync -a --delete --exclude .git --exclude functions --exclude src --exclude README.md "$ROOT/dist/" "$SITE/"
# Pages Functions: 저장소 맨 위 functions/ 를 Cloudflare가 서버 코드로 읽는다
rsync -a --delete "$ROOT/functions/" "$SITE/functions/"
# functions/_lib/api.js 가 ../../src/data/all_rounds.json 을 읽으므로 같은 경로에 둔다
rm -rf "$SITE/src"
mkdir -p "$SITE/src/data"
cp "$ROOT/src/data/all_rounds.json" "$SITE/src/data/"

cat > "$SITE/README.md" <<'MD'
# TodayVoca800 (배포용)

이 저장소는 [web_word_app](https://github.com/invinciblebearme-ctrl/web_word_app)의 `main`에서
GitHub Actions가 자동으로 빌드해 올리는 배포 전용 저장소입니다. **여기서 직접 고치지 마세요.**
다음 배포 때 덮어써집니다. 수정은 web_word_app에서 하세요.
MD
echo "synced to $SITE"
