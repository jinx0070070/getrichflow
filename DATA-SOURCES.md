# RICHFLOW 데이터 소스 레지스트리

작성 기준: 2026-08-03

## 전체 종목 검색 인덱스

- 국장: KRX KIND 상장법인 목록 기준 2,802개(KOSPI·KOSDAQ·KONEX).
- 미장: Nasdaq Trader `nasdaqlisted.txt`와 `otherlisted.txt` 기준 5,623개 기업 종목.
- 미장 섹터·산업: Nasdaq Stock Screener 분류를 티커 기준으로 결합한다. Nasdaq 화면의 섹터·산업 원천은 Quotemedia의 SIC 매핑이다.
- 미장은 ETF, 테스트 종목, 워런트, 유닛, 권리증권, 우선주·채권형 명칭을 검색 인덱스에서 제외한다.
- SEC `company_tickers_exchange.json`을 결합해 가능한 종목에는 CIK를 저장하고 EDGAR 회사 페이지로 직접 연결한다.
- 원본 파일은 `data/`, 브라우저용 결과는 `research-all-data.js`에 저장한다.
- 전체 원본 다운로드와 갱신: `powershell -ExecutionPolicy Bypass -File scripts/refresh-research-universe.ps1`
- 이미 받은 원본만 다시 변환: `node scripts/build-research-universe.mjs`
- 화면은 수천 개 DOM을 동시에 만들지 않고 검색 결과를 100개씩 렌더링한다.

## 원칙

1. 수치의 우선순위는 `규제기관 공시 > 기업 IR > 정부 통계 > 라이선스 시세 > 뉴스/포털`이다.
2. 모든 수치는 `기준일(as_of)`, `수집시각(retrieved_at)`, `단위`, `원문 URL`, `원천 유형`을 저장한다.
3. 장중 시세·거래대금·수급은 정적 본문에 현재값처럼 쓰지 않고 반드시 지연 여부를 표시한다.
4. 전망치·목표가·경영진 가이던스는 확정 실적과 분리한다.
5. 브라우저 프론트엔드에 API 키를 넣지 않는다. 수집과 정규화는 서버에서 수행한다.

## 한국 시장

| 데이터 | 1차 소스 | 주기 | 공개 화면 사용 | 핵심 주의점 |
|---|---|---:|---|---|
| 사업·분기·반기보고서 | [OpenDART](https://opendart.fss.or.kr/) | 공시 감시 10분 | 가능 | `corp_code`, `rcept_no`, 연결/별도, 단위를 함께 저장 |
| 공급계약·증자·CB·자사주·M&A | OpenDART / [KRX KIND](https://kind.krx.co.kr/) | 공시 감시 10분 | 가능 | 계약금액과 최근 매출 대비 비율, 종료일, 정정공시 추적 |
| 5% 이상 대량보유 | OpenDART `majorstock.json` | 일 1회 | 가능 | 단순 보유와 경영참여 목적을 구분 |
| 임원·주요주주 보유 | OpenDART `elestock.json` | 일 1회 | 가능 | 장내매수, 증여, 스톡옵션 등 변동 원인을 분리 |
| 기업 설명·가이던스 | 기업 IR / KIND IR 자료 | 발표 즉시 | 가능 | 공시 수치와 충돌하면 공시 우선 |
| 금리·환율·통화·GDP | [한국은행 ECOS](https://ecos.bok.or.kr/api/#/) | 발표 일정 | 가능 | 계절조정, 잠정치, 수정치 구분 |
| 산업·고용·인구 | [KOSIS OpenAPI](https://kosis.kr/openapi/index/index.jsp) | 발표 일정 | 가능 | 통계표 ID와 항목 코드를 보존 |
| 시세·거래대금·투자자 수급 | KRX 또는 정식 라이선스 벤더 | 계약 주기 | 계약 필요 | KRX 원자료의 제3자 재배포는 별도 계약 확인 필수 |
| 뉴스 발견 | 네이버 검색 API / 언론사 RSS | 10~30분 | 제목·링크 중심 | 뉴스는 숫자의 최종 근거로 사용하지 않음 |

## 미국 시장

| 데이터 | 1차 소스 | 주기 | 공개 화면 사용 | 핵심 주의점 |
|---|---|---:|---|---|
| 10-K·10-Q·8-K·20-F·6-K | [SEC EDGAR APIs](https://www.sec.gov/search-filings/edgar-application-programming-interfaces) | RSS 10분 + 일괄 보정 | 가능 | `data.sec.gov`는 CORS가 없어 서버 수집 필요 |
| 재무제표 XBRL | SEC Companyfacts | 공시 즉시 | 가능 | taxonomy·segment·unit·fiscal period 정규화 |
| 기관 보유 | [SEC Form 13F datasets](https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets) | 분기 | 가능 | 분기 말 기준, 제출은 최대 45일 뒤. 공매도·비미국 상장 주식 제외 |
| 내부자 거래 | [SEC Form 3/4/5 datasets](https://www.sec.gov/data-research/sec-markets-data/insider-transactions-data-sets) | 10분 | 가능 | 공개시장 매매와 보상·옵션·세금 원천징수 코드를 분리 |
| 5% 이상 지분·행동주의 | SEC Schedule 13D/13G | 10분 | 가능 | 최초 신고, 수정 신고, 보유 목적 변화 추적 |
| 기업 실적·가이던스 | 공식 IR / SEC 첨부 Exhibit 99 | 발표 즉시 | 가능 | GAAP/비GAAP 조정표를 함께 저장 |
| 금리·경기·물가 | [FRED](https://fred.stlouisfed.org/docs/api/fred/), BLS, BEA | 발표 일정 | 대체로 가능 | FRED 개별 시리즈의 제3자 권리와 빈티지 확인 |
| 에너지 | [EIA Open Data](https://www.eia.gov/opendata/) | 일·주·월 | 가능 | 재고·생산·현물·선물 지표를 구분 |
| 국채 금리·재정 | [US Treasury](https://home.treasury.gov/treasury-daily-interest-rate-xml-feed) | 영업일 | 가능 | 만기별 수익률과 기준일 저장 |
| 선물 포지셔닝 | [CFTC COT](https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm) | 금요일 | 가능 | 화요일 포지션을 금요일 공개하므로 시차 표시 |
| 공매도 | [FINRA Short Interest](https://www.finra.org/filing-reporting/regulatory-filing-systems/short-interest) | 월 2회 | 가능 | 일간 short-sale volume과 short interest는 다른 지표 |
| 시세 | 정식 라이선스 벤더 | 계약 주기 | 계약 필요 | 실시간·15분 지연·EOD와 거래소 범위를 화면에 명시 |

## 시세 벤더 후보

| 후보 | 한국 | 미국 | 판단 |
|---|---|---|---|
| EODHD | KRX `.KO`, KOSDAQ `.KQ` | 지원 | KR/US EOD 통합 후보. 공개 재배포 권한을 계약서로 확인한 뒤 사용 |
| Twelve Data Business | 한국은 주로 EOD | 기본 미국 피드는 부분 거래소 | 외부 화면 표시는 Business 이상. 미국 통합시세와 해외 거래소는 추가 승인 가능성 |
| Marketstack Commercial | 거래소 범위 확인 필요 | 지원 | 상용 플랜이 있으나 KRX 범위와 재배포 조건을 계약 전 확인 |

초기 공개 버전은 `공식 공시 + 공식 통계 + EOD/지연 시세`가 안전하다. 네이버 금융, Yahoo Finance의 비공식 엔드포인트나 한국투자 OpenAPI를 공개 시세 재배포원으로 사용하지 않는다.

## 아티클 데이터 계약

각 아티클은 다음 정보를 갖는다.

```text
article.asOf
article.evidence.grade
article.evidence.basis
article.evidence.note
source.kind
source.asOf
source.label
source.url
```

향후 자동 수집 수치는 아래 필드까지 확장한다.

```text
metric_id, entity_id, market, raw_value, normalized_value, unit,
period_start, period_end, as_of, retrieved_at, source_url,
source_type, filing_id, is_estimate, is_restated, license_scope
```

## 수집 어댑터 우선순위

1. `dart` — 한국 공시·재무·지분·수주
2. `sec-edgar` — 미국 공시·XBRL·Form 4·13D/G
3. `company-ir` — 실적 발표·가이던스·프레젠테이션
4. `ecos-kosis` — 한국 거시·산업 통계
5. `fred-bls-bea-eia-treasury` — 미국 거시·에너지·금리
6. `sec-13f` — 분기 기관 보유 스냅샷
7. `cftc-finra` — 선물 포지셔닝·공매도
8. `licensed-market-data` — 공개 화면용 시세·거래대금
9. `news-discovery` — 기사 발견과 이벤트 후보 생성

## 화면 표기

- `실시간`, `15분 지연`, `EOD`, `공시`, `분기(최대 45일 지연)` 배지를 강제한다.
- 수치 옆 또는 아티클 사이드바에서 원문과 기준일을 바로 열 수 있게 한다.
- 상반된 자료가 있으면 숨기지 않고 공시 원문 우선 및 차이 원인을 함께 적는다.
- 13F를 실시간 고래 수급으로, FINRA 일간 공매도 거래량을 공매도 잔고로 표현하지 않는다.
