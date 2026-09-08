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
- `whale.html` — 국장 큰손 수급. **6개 탭 전부 실데이터**(2026-09-07 완료). 종합·외국인=네이버 투자자별 매매, 운용사=네이버 ETF 분석(액티브 ETF 60개 실보유), 국민연금·세력(5%룰)·내부자=DART.
- `active-etf-data.js` — 국내 주식형 액티브 ETF 89개 목록. `node scripts/build-active-etf.mjs`로 재생성(네이버 ETF 목록 → `data/naver-etf-list.json`).
- `whale-us.html` — 미장 큰손 수급. **5개 탭 전부 실데이터**(2026-09-07 완료). 종합·ARK=arkfunds.io, 내부자=Finnhub(워커 `?fh=insider`), SEC 공시·13F 제출일=data.sec.gov, 13F 보유종목=`f13-holdings-data.js`.
- `f13-holdings-data.js` — 13F 거물 86곳의 실제 보유 상위 10종목(78곳 해결). `node scripts/build-13f-holdings.mjs`로 분기마다 재생성.
- `theme.html` — 국장 테마·흐름. **4개 탭 전부 실데이터**(2026-09-08). 네이버 테마 266개·업종 79개 + 구성종목 시세·거래대금 + 액티브 ETF 자금.
- `theme-us.html` — 미장 테마·흐름. **4개 탭 전부 실데이터**(2026-09-08). 섹터 ETF 11 + 테마 ETF 23 + M7 시총 + ARK 공개 매매.
- 그 외 `screener*.html`, `calendar*.html`, `idea*.html`, `forecast*.html`, `leaders*.html`, `ai*.html`, `whale-coin.html` 등은 대부분 정적 샘플 디자인 시안.

## 현재 작업 인수인계 (2026-09-07)

작업 폴더는 `C:\GcadAI\prototype`. 배포는 `git push` 하나로 끝난다(GitHub Pages, 전파 1~2분).

### 이번에 한 일 — 큰손 수급(whale.html) 실데이터화 완료
- **운용사 탭**: 샘플이던 "액티브 ETF 1CU 편입·제외"를 실제로 받을 수 있는 데이터로 바꿨다.
  네이버 `etfAnalysis`로 국내 주식형 액티브 ETF 60개를 열어 보유 상위 10종목·순자산·자금
  유출입을 집계한다(겹쳐 담은 종목, 순자산 가중 통합 비중, 자금 몰린 펀드, 펀드별 상세, 운용사별).
- **공직자 탭 → 내부자 탭**: 공직자 재산공개는 관보 PDF뿐이라 무료 API가 없다. 대신 DART
  임원·주요주주 소유상황보고(D002, 14일 약 700건)로 교체했다.
- 하단 데이터 출처 문구를 실제 소스대로 고쳤다. **이제 6개 탭 모두 실데이터다.**

### 여기서 조심할 것
- **전일 스냅샷이 없다.** 정적 사이트라 "어제와 비교한 신규 편입·제외"는 만들 수 없다.
  샘플에 있던 "오늘 편입 21 / 제외 24" 같은 카드는 그래서 계산 가능한 지표로 바꾼 것이다.
  다시 넣고 싶으면 스냅샷을 어딘가에 쌓는 작업이 먼저다.
- **ETF 보유는 상위 10종목까지만 공시된다.** 통합 비중은 11위 아래가 빠져 있고, 화면에도 적어 뒀다.
- **DART 목록 API에는 매수·매도 방향과 수량이 없다.** 본문에 있다. 내부자 탭이 "신고가 몰린
  회사"까지만 보여주는 이유다. 방향까지 가려면 워커에 `elestock` 같은 상세 API를 열어야 하는데,
  워커는 `?dart=list`만 허용하므로 사용자가 워커를 고쳐 재배포해야 한다.

### 검증 방법 (브라우저 스크린샷은 이 환경에서 못 믿는다)
인라인 `<script>`를 뽑아 `node --check` 한 뒤, 목 DOM(`document.getElementById`가 가짜 엘리먼트를
돌려주는 정도)에 얹어 로더를 직접 실행하고 렌더 결과 문자열을 눈으로 확인했다. 실제 워커·네이버·
DART를 그대로 때리므로 값이 진짜인지까지 같이 확인된다. 이 방식이 이 프로젝트에서 제일 확실하다.

### 미장 큰손(whale-us.html)도 실데이터화 완료
- ARK·SEC 공시·내부자(Finnhub)·13F 제출일은 이전부터 실데이터였다. 가짜는 **거물 디렉토리의
  보유종목**(시드 난수)과 모달의 "최근 분기 매수/매도"·"집중 섹터"였다.
- `scripts/build-13f-holdings.mjs`가 SEC 13F 원본 XML을 파싱해 `f13-holdings-data.js`로 굽는다.
  86곳 중 78곳 해결, 나머지는 13F-NT 제출 등 사유를 화면에 적었다. **분기마다 다시 돌리면 된다.**
- 여기서 배운 함정 셋:
  1. **이름 매칭을 느슨하게 하면 조용히 틀린다.** Fidelity가 지방은행에, Capital Group이 같은
     회사에 붙었다. 손으로 확인한 CIK를 ALIAS에 박고, 후보가 여럿이면 포트폴리오 큰 쪽을 고른다.
     화면에 EDGAR 등록 법인명을 같이 보여줘 틀리면 눈에 띄게 했다.
  2. **13F의 value 단위가 제출자마다 다르다**(달러 / 천 달러). 주당 가격 중앙값이 1달러 미만이면
     천 단위로 판정해 1000배 보정한다. 보정 전 T. Rowe Price가 $1.0B(실제 $999B)로 나왔다.
  3. **`node -e '...'`는 백슬래시를 먹는다.** 정규식이 든 진단 코드를 `-e`로 돌리면 `\w`가 `w`가
     되어 전부 빈 값이 나온다. 실제로 멀쩡한 데이터를 "$0.0B"로 오진했다. 진단도 파일로 저장해 돌릴 것.

### 테마·흐름(theme.html / theme-us.html)도 실데이터화 완료 (2026-09-08)
- 국장: 네이버 `stocks/theme`(266개)·`stocks/industry`(79개)가 등락률·상승/하락 종목수를 주고,
  `stocks/theme/{no}`로 구성종목 시세와 거래대금까지 드릴다운된다. 응답에 `themeDescription`도 있다.
- 미장: 테마마다 대표 ETF가 있어 그 ETF 시세를 테마 등락으로 쓴다. 네이버 해외 `basic`이
  시세·시가총액(`marketValueFullRaw`)·거래대금(`accumulatedTradingValueRaw`)을 한 번에 준다.
- **못 만든 것과 그 이유**: 히스토리를 주는 API가 없어 "최근 20거래일 자금 흐름", "3개월 로테이션",
  "YTD 수익률"은 만들 수 없다. 지수 포인트 기여도도 지수 제수가 없어 불가. 지어내는 대신
  계산이 성립하는 값(오늘 등락·오른 종목 비율·거래대금·시총가중 기여도)으로 바꿔 이름도 그렇게 붙였다.
- **미장 종목코드 함정**: 네이버 해외 reutersCode는 거래소마다 접미어가 다르다
  (없음=NYSE / `.O`=나스닥 / **`.K`=아멕스**). `.O`만 예비로 두었더니 XLRE·JETS·KWEB·BOTZ가
  조용히 목록에서 빠졌다. `ac.stock.naver.com/ac?q=<티커>&target=stock`으로 하나씩 확인해
  `RC` 표에 박아 뒀다. 티커를 추가할 때도 같은 방법으로 확인할 것.

### 남은 것
- `screener*`·`calendar*`·`idea*`·`forecast*`·`leaders*`·`whale-coin`은 아직 샘플.
- 다음 후보(데이터 확인됨): **종목탐색** — 나스닥 스크리너 API(워커 경유)가 전체 미국 종목의
  시세·시총·등락을, 네이버 정렬 API가 국장 종목을 준다. **미장 캘린더** — 나스닥 실적 캘린더에
  EPS 컨센서스가, IPO 캘린더도 나온다(국장 실적 일정은 무료 소스가 없어 반쪽).
  **대표주**는 옵션 데이터가 전부 유료라 불가, **커넥션**은 뉴스+AI가 필요해 백엔드 없이는 어렵다.
- 추적 안 되는 임시 파일 `_nb.html`·`_se.html`(경쟁사 저장본)이 작업 폴더에 있다. 커밋 대상 아님.

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
