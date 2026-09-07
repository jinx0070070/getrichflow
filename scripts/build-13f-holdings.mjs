/* 13F 거물 보유내역 빌더 (SEC EDGAR)
 *
 * whale-us.html의 "거물 13F" 디렉토리는 지금까지 보유종목을 시드 난수로
 * 지어내고 있었다. 이 스크립트가 진짜 13F 보유내역을 받아 정적 파일로 굽는다.
 *
 * 실행: node scripts/build-13f-holdings.mjs
 * 생성: f13-holdings-data.js  (window.RICHFLOW_F13)
 *
 * 왜 빌드타임인가:
 *   보유내역 XML은 www.sec.gov/Archives에 있는데 CORS 헤더가 없어 브라우저에서
 *   직접 못 받는다. 13F는 분기 공시라 스냅샷으로 구워도 신선도 문제가 없다.
 *   (data.sec.gov는 CORS가 열려 있지만 제출 목록만 주고 보유내역은 없다.)
 *
 * 이름 매칭 주의:
 *   큐레이션된 약칭("Fidelity (FMR)")과 EDGAR 등록명("FMR LLC")이 다르다.
 *   느슨하게 매칭하면 엉뚱한 회사가 조용히 붙는다(실제로 Fidelity가 지방은행
 *   FIDELITY D & D BANCORP로, Capital Group과 같은 회사로 붙는 일이 있었다).
 *   그래서 (1) 손으로 확인한 CIK를 ALIAS에 박고 (2) 나머지는 이름이 정확히
 *   맞는 후보만 추린 뒤 (3) 후보가 여럿이면 포트폴리오가 가장 큰 쪽을 고른다.
 *   결과는 EDGAR 등록명과 함께 저장해 화면에서 어느 법인인지 보이게 한다.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

/* SEC는 연락처가 담긴 User-Agent를 요구한다(없으면 403). */
const UA = 'RICHFLOW research jinx0070070@gmail.com';
const H = { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' };

/* 손으로 확인한 CIK — form.idx에서 실제 13F-HR 제출자를 찾아 대조했다. */
const ALIAS = {
  'Fidelity (FMR)': 315066,            // FMR LLC
  'Capital Group': 1422848,            // Capital Research Global Investors
  'T. Rowe Price': 80255,              // PRICE T ROWE ASSOCIATES INC /MD/
  'Charles Schwab IM': 884546,         // CHARLES SCHWAB INVESTMENT MANAGEMENT INC
  'Wellington Mgmt': 902219,
  'Franklin Templeton': 38777,         // FRANKLIN RESOURCES INC
  'Schroders': 1086619,                // SCHRODER INVESTMENT MANAGEMENT GROUP
  'Elliott Mgmt': 1791786,             // Elliott Investment Management L.P.
  'Icahn Enterprises': 921669,         // ICAHN CARL C
  'Bridgewater': 1350694,              // Bridgewater Associates, LP
  'Citadel': 1423053,                  // CITADEL ADVISORS LLC
  'Millennium': 1273087,               // MILLENNIUM MANAGEMENT LLC
  'Point72': 1603466,                  // Point72 Asset Management, L.P.
  'Whale Rock': 1387322,               // Whale Rock Capital Management LLC
  'Tiger Global': 1167483,             // TIGER GLOBAL MANAGEMENT LLC
  'PIF': 1767640,                      // PUBLIC INVESTMENT FUND
  'CPPIB': 1283718,
  'CalPERS': 919079,
  'CalSTRS': 1081019,
  'New York State CRF': 810265,
  'Texas Teachers': 796848,            // TEACHER RETIREMENT SYSTEM OF TEXAS
  'JPMorgan AM': 19617,                // JPMORGAN CHASE & CO
  'Goldman Sachs AM': 886982,          // GOLDMAN SACHS GROUP INC
  'UBS Asset Mgmt': 861177,            // UBS AM (asset management 사업부)
  'BNY Mellon': 1390777,               // Bank of New York Mellon Corp
  'Wells Fargo AM': 72971,             // WELLS FARGO & COMPANY/MN
  'HSBC Global AM': 873630,            // HSBC HOLDINGS PLC
  'Deutsche Bank (DWS)': 948046,
  'MetLife IM': 1529735,               // MetLife Investment Management, LLC (METLIFE INC 아님)
  'Morgan Stanley IM': 895421,
  '국민연금공단(NPS)': 1608046,          // National Pension Service
  'APG': 1434819,                      // APG Asset Management N.V.
};

/* 13F-HR을 안 낸 곳 — 이유를 화면에 그대로 보여준다.
 * 13F-NT는 "보유내역은 다른 운용사가 대신 신고했다"는 통지라 종목이 없다. */
const KNOWN_NONE = {
  'Vanguard Group': '이번 분기에 13F-NT(보유내역 없음 통지)를 제출했습니다',
  'Janus Henderson': '이번 분기에 13F-NT(보유내역 없음 통지)를 제출했습니다',
  'Eaton Vance': '이번 분기에 13F-NT(보유내역 없음 통지)를 제출했습니다',
  'Greenlight': '이번 분기에 13F-NT(보유내역 없음 통지)를 제출했습니다',
  'Scion Asset': 'EDGAR에 이번 분기 제출 기록이 없습니다',
  'GIC': 'EDGAR에 13F-HR 제출 기록을 찾지 못했습니다',
  'ADIA': 'EDGAR에 13F-HR 제출 기록을 찾지 못했습니다',
  'GPIF': 'EDGAR에 13F-HR 제출 기록을 찾지 못했습니다',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, kind = 'json', tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: H });
      if (r.status === 429 || r.status >= 500) { await sleep(1200 * (i + 1)); continue; }
      if (!r.ok) return null;
      return kind === 'json' ? await r.json() : await r.text();
    } catch { await sleep(600 * (i + 1)); }
  }
  return null;
}

/* ---------- 1. 분기 인덱스 (제출자 CIK 목록) ---------- */
function quarterCandidates() {
  const d = new Date(), y = d.getFullYear(), q = Math.floor(d.getMonth() / 3) + 1;
  const out = [];
  for (let i = 0; i < 4; i++) {
    const qq = q - i, yy = qq > 0 ? y : y - 1, n = qq > 0 ? qq : qq + 4;
    out.push([yy, n]);
  }
  return out;
}
async function loadFormIndex() {
  const cacheDir = path.join(os.tmpdir(), 'richflow-edgar');
  fs.mkdirSync(cacheDir, { recursive: true });
  for (const [y, q] of quarterCandidates()) {
    const cache = path.join(cacheDir, `form-${y}-QTR${q}.idx`);
    let text;
    if (fs.existsSync(cache) && Date.now() - fs.statSync(cache).mtimeMs < 86400e3) {
      text = fs.readFileSync(cache, 'latin1');
    } else {
      process.stdout.write(`form.idx 내려받는 중… ${y} QTR${q}\n`);
      const raw = await get(`https://www.sec.gov/Archives/edgar/full-index/${y}/QTR${q}/form.idx`, 'text');
      if (!raw) continue;
      text = raw;
      fs.writeFileSync(cache, text, 'latin1');
    }
    const filers = new Map();
    let n = 0;
    for (const ln of text.split('\n')) {
      if (!ln.startsWith('13F-HR ')) continue;
      const p = ln.trimEnd().split(/\s{2,}/);
      if (p.length < 5 || !/^\d+$/.test(p[2])) continue;
      n++;
      const key = p[1].toUpperCase(), prev = filers.get(key);
      if (!prev || p[3] > prev.date) filers.set(key, { name: p[1], cik: +p[2], date: p[3] });
    }
    if (n > 100) { console.log(`${y} QTR${q} — 13F-HR ${n}건 / 제출자 ${filers.size}곳`); return { filers, quarter: `${y} QTR${q}` }; }
  }
  throw new Error('form.idx를 못 받았다');
}

/* ---------- 2. 이름 → CIK ---------- */
const light = s => s.toUpperCase().replace(/&/g, ' AND ')
  .replace(/\(.*?\)/g, ' ')
  .replace(/\b(INC|LLC|L\.L\.C|LP|L\.P|LTD|PLC|CORP|CORPORATION|CO|COMPANY|TRUST|THE)\b/g, ' ')
  .replace(/[^A-Z0-9]+/g, '');

function candidatesFor(name, byLight) {
  const L = light(name);
  if (!L) return [];
  const exact = byLight.get(L);
  if (exact) return exact;
  const out = [];
  for (const [k, v] of byLight) {
    if (k.length < 6 || L.length < 6) continue;
    if (k.startsWith(L) || L.startsWith(k)) out.push(...v);
  }
  return out;
}

/* ---------- 3. 보유내역 ---------- */
async function holdingsOf(cik) {
  const p = String(cik).padStart(10, '0');
  const sub = await get(`https://data.sec.gov/submissions/CIK${p}.json`);
  const r = sub && sub.filings && sub.filings.recent;
  if (!r) return null;
  let acc = null, filed = null, form = null;
  for (let i = 0; i < r.form.length; i++) {
    if (String(r.form[i]) === '13F-HR' || String(r.form[i]) === '13F-HR/A') {
      acc = r.accessionNumber[i]; filed = r.filingDate[i]; form = r.form[i]; break;
    }
  }
  if (!acc) return { none: '최근 제출 목록에 13F-HR이 없습니다' };
  const a = acc.replace(/-/g, '');
  const ix = await get(`https://www.sec.gov/Archives/edgar/data/${cik}/${a}/index.json`);
  const items = (ix && ix.directory && ix.directory.item) || [];
  const file = items.find(it => /\.xml$/i.test(it.name) && !/primary_doc/i.test(it.name));
  if (!file) return { none: '보유내역 파일을 찾지 못했습니다' };
  const xml = await get(`https://www.sec.gov/Archives/edgar/data/${cik}/${a}/${file.name}`, 'text');
  if (!xml) return { none: '보유내역 파일을 받지 못했습니다' };
  const tag = (b, t) => {
    const m = b.match(new RegExp(`<(?:\\w+:)?${t}>([\\s\\S]*?)</(?:\\w+:)?${t}>`));
    return m ? m[1].trim() : '';
  };
  const agg = new Map();
  let rows = 0;
  const ratios = [];
  for (const m of xml.matchAll(/<(?:\w+:)?infoTable>([\s\S]*?)<\/(?:\w+:)?infoTable>/g)) {
    const b = m[1];
    const v = Number(tag(b, 'value')) || 0;
    const issuer = tag(b, 'nameOfIssuer');
    const cusip = tag(b, 'cusip');
    if (!issuer) continue;
    const sh = Number(tag(b, 'sshPrnamt')) || 0;
    const shType = (tag(b, 'sshPrnamtType') || 'SH').toUpperCase();
    if (v > 0 && sh > 0 && shType === 'SH') ratios.push(v / sh);
    rows++;
    const k = cusip || issuer;
    const cur = agg.get(k) || { issuer, cusip, value: 0, shares: 0 };
    cur.value += v;
    cur.shares += sh;
    agg.set(k, cur);
  }
  if (!rows) return { none: '보유내역이 비어 있습니다' };

  /* 단위 판별: 2023년 규칙 변경 뒤에도 value를 '천 달러'로 내는 제출자가 있다.
   * value/주식수는 곧 주당 가격이므로, 그 중앙값이 1달러도 안 되면 천 단위로 본다.
   * (표시 금액이 1000배 틀리는 것을 막는다. 비중 %는 비율이라 단위와 무관하다.) */
  let unit = 'usd', scale = 1;
  if (ratios.length >= 3) {
    const s = ratios.slice().sort((a, b) => a - b);
    const med = s[Math.floor(s.length / 2)];
    if (med > 0 && med < 1) { unit = 'thousands'; scale = 1000; }
  }
  for (const x of agg.values()) x.value *= scale;
  const total = [...agg.values()].reduce((n, x) => n + x.value, 0);

  /* 보여줄 상위 종목은 발행사 이름으로 한 번 더 합친다.
   * 알파벳처럼 클래스 A·C가 CUSIP이 달라 따로 신고되면 목록에 같은 이름이
   * 두 번 나와 읽기 나쁘다. 종목 수(count)는 CUSIP 기준 그대로 둔다. */
  const byName = new Map();
  for (const x of agg.values()) {
    const cur = byName.get(x.issuer) || { issuer: x.issuer, cusip: x.cusip, value: 0 };
    cur.value += x.value;
    byName.set(x.issuer, cur);
  }
  const list = [...byName.values()].sort((a, b) => b.value - a.value);
  return {
    acc, filed, form, total, count: agg.size, rows, unit,
    top: list.slice(0, 10).map(x => [x.issuer, x.cusip, x.value, +(x.value / total * 100).toFixed(2)]),
  };
}

/* ---------- 4. 실행 ---------- */
const html = fs.readFileSync(path.join(root, 'whale-us.html'), 'utf8');
const block = html.match(/const INV=\[([\s\S]*?)\n {2}\];/);
if (!block) throw new Error('whale-us.html에서 INV 목록을 못 찾았다');
const INV = [...block[1].matchAll(/\['([^']*)','([^']*)',(\d+),'(\w+)'\]/g)].map(m => m[1]);
console.log(`디렉토리 ${INV.length}곳`);

const { filers, quarter } = await loadFormIndex();
const byLight = new Map();
for (const f of filers.values()) {
  const k = light(f.name);
  if (!byLight.has(k)) byLight.set(k, []);
  byLight.get(k).push(f);
}
const byCik = new Map([...filers.values()].map(f => [f.cik, f]));

const out = {}, report = [];
for (const name of INV) {
  if (KNOWN_NONE[name]) { out[name] = { none: KNOWN_NONE[name] }; report.push([name, '—', KNOWN_NONE[name]]); continue; }
  let picked = null;
  if (ALIAS[name]) {
    const f = byCik.get(ALIAS[name]);
    picked = f || { name: '(CIK ' + ALIAS[name] + ')', cik: ALIAS[name] };
  } else {
    const cands = candidatesFor(name, byLight);
    if (cands.length === 1) picked = cands[0];
    else if (cands.length > 1) {
      /* 후보가 여럿이면 실제로 받아보고 포트폴리오가 가장 큰 쪽 */
      const scored = [];
      for (const c of cands.slice(0, 6)) {
        const h = await holdingsOf(c.cik); await sleep(140);
        if (h && h.total) scored.push({ c, h });
      }
      scored.sort((a, b) => b.h.total - a.h.total);
      if (scored.length) { out[name] = { edgar: scored[0].c.name, cik: scored[0].c.cik, ...scored[0].h };
        report.push([name, scored[0].c.name, `$${(scored[0].h.total / 1e9).toFixed(1)}B · ${scored[0].h.count}종목 (후보 ${cands.length})`]);
        continue; }
      picked = cands[0];
    }
  }
  if (!picked) { out[name] = { none: 'EDGAR에서 13F-HR 제출자를 찾지 못했습니다' }; report.push([name, '—', '매칭 실패']); continue; }
  const h = await holdingsOf(picked.cik); await sleep(140);
  if (!h || h.none) {
    out[name] = { edgar: picked.name, cik: picked.cik, none: (h && h.none) || '보유내역을 받지 못했습니다' };
    report.push([name, picked.name, (h && h.none) || '실패']);
  } else {
    out[name] = { edgar: picked.name, cik: picked.cik, ...h };
    report.push([name, picked.name, `$${(h.total / 1e9).toFixed(1)}B · ${h.count}종목`]);
  }
}

const asOf = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
const body = Object.entries(out).map(([k, v]) => ' ' + JSON.stringify(k) + ':' + JSON.stringify(v)).join(',\n');
fs.writeFileSync(path.join(root, 'f13-holdings-data.js'),
  `/* 13F 거물 보유내역 — SEC EDGAR 원본에서 집계.\n` +
  ` * 생성: node scripts/build-13f-holdings.mjs (${asOf}, ${quarter} 제출분)\n` +
  ` * top = [발행사, CUSIP, 평가액(달러), 비중(%)] 상위 10.\n` +
  ` * 13F는 분기 공시라 제출일 기준 스냅샷이며, 그 뒤 매매는 반영되지 않는다.\n` +
  ` */\n` +
  `window.RICHFLOW_F13={asOf:${JSON.stringify(asOf)},quarter:${JSON.stringify(quarter)},data:{\n${body}\n}};\n`,
  'utf8');

const ok = report.filter(r => r[1] !== '—' && !/실패|없|못/.test(r[2]));
console.log(`\n해결 ${ok.length} / ${INV.length}`);
console.log('--- 매핑 결과 ---');
for (const [a, b, c] of report) console.log(`  ${a.padEnd(22)} → ${String(b).slice(0, 40).padEnd(42)} ${c}`);
console.log('\nf13-holdings-data.js 생성 완료');
