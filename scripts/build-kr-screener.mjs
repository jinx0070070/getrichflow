/* 국장 종목탐색용 재무지표 빌더
 *
 * 실행: node scripts/build-kr-screener.mjs
 * 생성: kr-screener-data.js  (window.RICHFLOW_KR_SCREENER)
 *
 * 왜 굽는가:
 *   PER·PBR·배당수익률은 종목마다 따로 조회해야 해서(네이버 `/integration`)
 *   화면에서 2,700종목을 매번 부를 수 없다. 그래서 **분기마다 바뀌는 값**인
 *   EPS·BPS·주당배당금만 미리 받아 두고, 화면에서는 실시간 주가와 나눠
 *   PER·PBR·배당수익률을 그때그때 계산한다. 주가가 움직여도 값이 안 틀어진다.
 *     PER = 주가/EPS · PBR = 주가/BPS · 배당수익률 = 주당배당금/주가
 *     ROE = EPS/BPS×100 (정의 그대로라 주가와 무관)
 *
 * 업종은 네이버 업종 분류(79개)의 구성종목을 받아 종목→업종으로 뒤집는다.
 * research-all-data.js의 KRX 표준산업분류는 너무 잘게 쪼개져 있어 필터로 못 쓴다.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const NV = 'https://m.stock.naver.com/api/';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function getJSON(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (r.status === 429 || r.status >= 500) { await sleep(500 * (i + 1)); continue; }
      if (!r.ok) return null;
      return await r.json();
    } catch { await sleep(400 * (i + 1)); }
  }
  return null;
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}
const num = s => {
  const v = parseFloat(String(s == null ? '' : s).replace(/[^0-9.\-]/g, ''));
  return isFinite(v) ? v : 0;
};

/* ---------- 1. 종목 유니버스 ---------- */
const allSrc = fs.readFileSync(path.join(root, 'research-all-data.js'), 'utf8');
const win = {};
new Function('window', allSrc)(win);
const universe = (win.RICHFLOW_ALL_LISTED?.kr || [])
  .filter(x => x && x[0] && x[1] && x[2] !== '코넥스')
  .map(x => ({ code: String(x[0]), name: x[1], market: x[2] }));
if (!universe.length) throw new Error('research-all-data.js에서 국내 종목을 못 읽었다');
console.log(`유니버스 ${universe.length}종목 (코넥스 제외)`);

/* ---------- 2. 업종 분류 (네이버 79개) ---------- */
const indList = await getJSON(NV + 'stocks/industry?page=1&pageSize=100');
const groups = (indList?.groups || []).filter(g => g && g.name);
console.log(`업종 ${groups.length}개 구성종목 조회 중…`);
const sectorOf = new Map();
const sectors = groups.map(g => g.name);
await pool(groups, 6, async (g, gi) => {
  let page = 1;
  for (;;) {
    const d = await getJSON(`${NV}stocks/industry/${g.no}?page=${page}&pageSize=100`);
    const stocks = d?.stocks || [];
    stocks.forEach(s => { if (s.itemCode && !sectorOf.has(s.itemCode)) sectorOf.set(s.itemCode, gi); });
    const total = d?.totalCount || 0;
    if (stocks.length < 100 || page * 100 >= total) break;
    page++;
  }
});
console.log(`업종 매핑 ${sectorOf.size}종목`);

/* ---------- 3. 종목별 재무지표 ---------- */
console.log('재무지표 조회 중…');
let done = 0;
const rows = await pool(universe, 8, async s => {
  const d = await getJSON(`${NV}stock/${s.code}/integration`);
  done++;
  if (done % 500 === 0) console.log(`  ${done}/${universe.length}`);
  if (!d) return null;
  const m = {};
  (d.totalInfos || []).forEach(t => { if (t && t.code) m[t.code] = t.value; });
  const eps = num(m.eps), bps = num(m.bps), dps = num(m.dividend);
  /* EPS·BPS가 둘 다 없으면 지표로 걸러낼 수 없는 종목(스팩·신규상장 등)이라 뺀다 */
  if (!eps && !bps) return null;
  return [s.code, s.name, s.market === '코스피' ? 0 : 1,
    sectorOf.has(s.code) ? sectorOf.get(s.code) : -1,
    Math.round(eps), Math.round(bps), Math.round(dps)];
});
const list = rows.filter(Boolean);
console.log(`지표 확보 ${list.length}종목 (실패·제외 ${universe.length - list.length})`);

const withSector = list.filter(r => r[3] >= 0).length;
const withDiv = list.filter(r => r[6] > 0).length;
console.log(`  업종 있음 ${withSector} · 배당 있음 ${withDiv}`);

const asOf = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
fs.writeFileSync(path.join(root, 'kr-screener-data.js'),
  `/* 국장 종목탐색 재무지표 — 네이버 금융 종목별 지표에서 집계.\n` +
  ` * 생성: node scripts/build-kr-screener.mjs (${asOf})\n` +
  ` * [종목코드, 종목명, 시장(0=코스피 1=코스닥), 업종index(-1=없음), EPS, BPS, 주당배당금]\n` +
  ` * PER·PBR·배당수익률은 화면에서 실시간 주가와 나눠 계산한다(주가가 움직여도 안 틀어짐).\n` +
  ` */\n` +
  `window.RICHFLOW_KR_SCREENER={asOf:${JSON.stringify(asOf)},sectors:${JSON.stringify(sectors)},list:[\n` +
  list.map(r => JSON.stringify(r)).join(',\n') +
  `\n]};\n`, 'utf8');
console.log('kr-screener-data.js 생성 완료');
