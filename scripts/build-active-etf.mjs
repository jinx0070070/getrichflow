/* 국내 주식형 액티브 ETF 목록 빌더
 *
 * 원본: 네이버 금융 ETF 목록 (https://finance.naver.com/api/sise/etfItemList.nhn, EUC-KR)
 *   → data/naver-etf-list.json 으로 저장(UTF-8)
 * 생성: active-etf-data.js  (window.RICHFLOW_ACTIVE_ETF)
 *
 * 실행: node scripts/build-active-etf.mjs
 *
 * 이 파일이 만드는 것은 "어떤 ETF가 있는가"라는 목록뿐이다.
 * 구성종목·순자산·자금유입 같은 값은 whale.html이 화면에서
 * m.stock.naver.com/api/stock/{code}/etfAnalysis 로 그때그때 받아온다.
 *
 * etfTabCode: 1=국내 시장지수 2=국내 업종·테마 3=국내 파생 4=해외 주식
 *             5=원자재 6=채권 7=기타(혼합·TDF·머니마켓)
 * 이 중 1·2만 담는다. 국내 주식을 실제로 담고 파는 펀드라야
 * "운용사가 무슨 종목을 샀나"를 볼 수 있기 때문이다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const dataDir = path.join(root, 'data');

const SRC = 'https://finance.naver.com/api/sise/etfItemList.nhn';
const EQUITY_TABS = new Set([1, 2]);

const res = await fetch(SRC, { headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://finance.naver.com/sise/etf.naver' } });
if (!res.ok) throw new Error('ETF 목록 요청 실패: HTTP ' + res.status);
const json = JSON.parse(new TextDecoder('euc-kr').decode(new Uint8Array(await res.arrayBuffer())));
const all = json?.result?.etfItemList || [];
if (!all.length) throw new Error('ETF 목록이 비어 있다 — 응답 형식이 바뀌었는지 확인할 것');

fs.mkdirSync(dataDir, { recursive: true });
fs.writeFileSync(path.join(dataDir, 'naver-etf-list.json'), JSON.stringify(json, null, 1), 'utf8');

const active = all
  .filter(x => String(x.itemname || '').includes('액티브') && EQUITY_TABS.has(Number(x.etfTabCode)))
  .map(x => [String(x.itemcode).trim(), String(x.itemname).trim(), Number(x.etfTabCode), Number(x.marketSum) || 0])
  .filter(x => x[0] && x[1])
  .sort((a, b) => b[3] - a[3]);

if (!active.length) throw new Error('주식형 액티브 ETF를 하나도 못 찾았다');

const asOf = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const out =
  `/* 국내 주식형 액티브 ETF 목록 — 네이버 금융 ETF 목록에서 추출.\n` +
  ` * 생성: node scripts/build-active-etf.mjs (${asOf})\n` +
  ` * [종목코드, ETF명, 분류(1=시장지수 2=업종·테마), 시가총액(억원)]\n` +
  ` * 구성종목·순자산·자금유입은 화면에서 네이버 etfAnalysis로 실시간 조회한다.\n` +
  ` */\n` +
  `window.RICHFLOW_ACTIVE_ETF={asOf:${JSON.stringify(asOf)},total:${active.length},list:[\n` +
  active.map(x => JSON.stringify(x)).join(',\n') +
  `\n]};\n`;

fs.writeFileSync(path.join(root, 'active-etf-data.js'), out, 'utf8');

const byTab = t => active.filter(x => x[2] === t).length;
console.log(`ETF 전체 ${all.length}개 → 주식형 액티브 ${active.length}개 (시장지수 ${byTab(1)} · 업종테마 ${byTab(2)})`);
console.log('최대: ' + active.slice(0, 3).map(x => `${x[1]}(${x[3].toLocaleString()}억)`).join(', '));
console.log('active-etf-data.js 생성 완료');
