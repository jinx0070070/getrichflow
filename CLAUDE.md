# RICHFLOW — 프로젝트 가이드 (Claude용)

한국어 투자 대시보드. 불스토리(bullstory) + 나박AI(nabakai) 기능을 합친 웹앱.
3개 마켓: 🇰🇷 국장(KR) · 🇺🇸 미장(US) · ₿ 코인(coin).

## 배포 / 실행
- **단일 파일 HTML** 구조(인라인 CSS/JS). 빌드 과정 없음.
- GitHub Pages로 서비스: https://jinx0070070.github.io/getrichflow/
- repo: `github.com/jinx0070070/getrichflow` (이 폴더가 그대로 repo 루트)
- 도메인: getrichflow.com (예약됨)
- **배포 = git push**. 편집 → `git add`/`commit`/`push` → GitHub Pages CDN 전파(보통 1~2분).
  전파 확인: `curl -s "https://jinx0070070.github.io/getrichflow/<file>?_=$RANDOM" | grep <새로추가한문자열>`

## 작업 원칙 (중요)
- **검증 안 한 API/함수는 쓰지 않는다.** 문서만 믿지 말고 실제로 `curl`로 호출해 응답 필드를 눈으로 확인한 뒤 코드에 넣는다. 브라우저에서 되는지(CORS/인증/rate limit)도 먼저 확인.
- JS 수정 후 **반드시 문법검사**: 인라인 `<script>` 블록을 뽑아 `node --check`.
- 큰 라이브러리 통째 삽입 지양(트레이딩뷰 위젯 등) — 커스텀 경량 엔진 유지.
- 쓸데없이 표시되는 UI(데이터 소스명, 초 카운터 등)는 넣지 않는다.

## 실시간 데이터 소스 (전부 무료·키 없음)
- **네이버 금융**(실시간, delayTime:0):
  - KR 종목: `m.stock.naver.com/api/stock/{6자리코드}/basic` (closePrice, fluctuationsRatio, compareToPreviousClosePrice) + `/integration`(시총/PER/PBR/배당/52주)
  - KR 지수: `m.stock.naver.com/api/index/KOSPI|KOSDAQ/basic`
  - 환율: `api.stock.naver.com/marketindex/exchange/FX_USDKRW` (하나은행 실시간, 토스와 일치)
  - 검색: `ac.stock.naver.com/ac?q=X&target=stock`
  - US 종목: `api.stock.naver.com/stock/{reutersCode}/basic` (reutersCode = TICKER+".O"=나스닥 / TICKER=NYSE), 장중 실시간
- **야후 파이낸스**: `query1.finance.yahoo.com/v8/finance/chart/{T}?interval=&range=&includePrePost=true` — 차트 캔들, 프리/애프터마켓. **US 정규장 데이터는 15분 지연**(주의).
- **하이퍼리퀴드**(24시간 주식 perp, CORS 열림, 브라우저 직접 POST):
  `api.hyperliquid.xyz/info` body `{type:'metaAndAssetCtxs',dex:'xyz'}` → [meta{universe},ctxs{markPx,prevDayPx}]. dex 여러 개(xyz/para/mkts/cash) 합치면 ~140 미국 종목(MSFT·AAPL·NVDA 등). 미국장 마감에도 가격 움직임.
- **바이낸스**: 코인 시세 `api.binance.com/api/v3/ticker/24hr` (CORS 열림).

## CORS 프록시 (Cloudflare Worker)
- GET 전용 프록시: `https://frosty-sea-d3c9.joyoonseo6299.workers.dev/?url=<encoded>`
- 코드: `cloudflare-worker.js` (allowlist: query1/query2.finance.yahoo.com, api.nasdaq.com, m.stock.naver.com, api.stock.naver.com, ac.stock.naver.com)
- 하이퍼리퀴드/바이낸스는 CORS 열려 있어 프록시 불필요(직접 fetch).
- fetchJSON 패턴: AbortController 6초 타임아웃 + HTML 에러페이지 필터(`txt[0]==='<'`).

## 주요 파일
- `index.html` — 홈. 마켓 스위처(?m=kr|us|coin), 실시간 지수행, AI 시황브리핑, 산업별 히트맵(국장 하드코딩 18섹터 / 미장 데이터배열 16섹터 / 코인 8섹터), 사이드 위젯(섹터 등락순위·자금흐름=라이브 히트맵 평균), ⭐관심종목 섹션, 라이브 티커.
- `stock.html` — 국장 종목 상세(?code= 또는 ?name=). 네이버 basic+integration + 야후 차트.
- `stock-us.html` — 미장 종목 상세(?t=TICKER). 하이퍼리퀴드(24h)→네이버(장중)→야후(프리/애프터) 우선순위.
- `watchlist.js` — 관심종목 공용 저장소(localStorage `richflow:watchlist`). 버튼 배선 `RichflowWatch.bindButton`.
- `stock-logo.js` — 종목 로고(KR: pstatic, US: financialmodelingprep). 캔버스 밝기분석으로 흰 로고 어두운배경 처리(`logo-dark`).
- `community.js`, `price-alert.js`, `research-*.js` — 커뮤니티/리서치.
- 그 외 `whale*.html`, `theme*.html`, `screener*.html`, `calendar*.html`, `idea*.html`, `ai*.html` 등은 대부분 정적 샘플 디자인 시안.

## 차트 엔진 (stock.html / stock-us.html 공용 구조, 각 파일에 인라인)
SVG viewBox(720×320) 기반. 상태객체 `CH`.
- 캔들/라인 전환, 10개 타임프레임(5분~월, 2/4/12h는 1h 집계), 일봉 5년/기본 200봉.
- 이동: 드래그. 가로줌: 휠. 세로줌: 오른쪽 가격축 드래그·휠(동적 nice 눈금). 측정: Shift+드래그. 자석: 🧲.
- 지표: 이평선 MA20/60, 볼린저밴드 BB(20,2).
- 작도: ✏️추세선(Shift=수평/수직 스냅), ➖수평선. 선 클릭=선택(× 뱃지)→삭제, 🗑️=전체삭제.
- 현재가 라인, 크로스헤어(가격+날짜 라벨), log 스케일 토글, ⟳리셋.
- 모바일 터치: 한 손가락=이동/작도/탭선택, 두 손가락 핀치=가로+세로 확대. `.chartbox{touch-action:none}`.
- 작도 로직은 `startDraw/moveDraw/endDraw` 헬퍼로 마우스·터치 공용.

## 검증 습관
- 배포 후 라이브에서 실제 값으로 재확인. 브라우저 프리뷰가 무거운 라이브 페이지(특히 미장)에서 자주 멈추므로, 합성 이벤트(MouseEvent/TouchEvent) 시뮬레이션이나 `curl`로 교차 검증.
