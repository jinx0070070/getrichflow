import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const dataDir=path.join(root,'data');

const decodeHtml=value=>value
  .replace(/<br\s*\/?\s*>/gi,' ')
  .replace(/<[^>]+>/g,' ')
  .replace(/&amp;/g,'&')
  .replace(/&lt;/g,'<')
  .replace(/&gt;/g,'>')
  .replace(/&quot;/g,'"')
  .replace(/&#39;/g,"'")
  .replace(/&nbsp;/g,' ')
  .replace(/\s+/g,' ')
  .trim();

const krHtml=new TextDecoder('euc-kr').decode(fs.readFileSync(path.join(dataDir,'krx-listed-companies.xls')));
const kr=[];
for(const row of krHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)){
  const cells=[...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>decodeHtml(x[1]));
  if(cells.length<5)continue;
  const [name,rawMarket,code,industry,product]=cells;
  const market=rawMarket==='유가'?'코스피':rawMarket;
  if(!name||!code||!['코스피','코스닥','코넥스'].includes(market))continue;
  kr.push([code,name,market,industry,product]);
}

const sec=JSON.parse(fs.readFileSync(path.join(dataDir,'sec-company-tickers-exchange.json'),'utf8'));
const cikByTicker=new Map(sec.data.map(([cik,,ticker])=>[String(ticker).toUpperCase(),cik]));
const sectorNames={
  'Finance':'금융','Consumer Discretionary':'경기소비재','Health Care':'헬스케어',
  'Technology':'기술','Industrials':'산업재','Real Estate':'부동산','Energy':'에너지',
  'Utilities':'유틸리티','Consumer Staples':'필수소비재','Basic Materials':'소재',
  'Telecommunications':'커뮤니케이션','Miscellaneous':'기타'
};
const screenerPath=path.join(dataDir,'nasdaq-stock-screener.json');
const screener=fs.existsSync(screenerPath)?JSON.parse(fs.readFileSync(screenerPath,'utf8'))?.data?.rows||[]:[];
const classificationByTicker=new Map(screener.map(row=>[
  String(row.symbol||'').toUpperCase(),
  [sectorNames[row.sector]||'기타',String(row.industry||'미분류').trim()||'미분류']
]));
const excluded=/\b(warrants?|units?|rights?|preferred|depositary shares?|notes? due|bonds?|debentures?)\b/i;
const usByTicker=new Map;
const cleanUsName=value=>value
  .replace(/\s+-\s+(Class\s+[A-Z]\s+)?Common Stock.*$/i,'')
  .replace(/\s+-\s+(Class\s+[A-Z]\s+)?Ordinary Shares.*$/i,'')
  .replace(/\s+-\s+American Depositary Shares.*$/i,'')
  .replace(/\s+(Class\s+[A-Z]\s+)?Common Stock(?:,.*)?$/i,'')
  .trim();

const addUs=(ticker,name,exchange,etf,test)=>{
  ticker=(ticker||'').trim();name=(name||'').trim();
  if(!ticker||!name||test==='Y'||etf==='Y'||excluded.test(name)||ticker.includes('$'))return;
  if(/^File Creation Time/i.test(ticker))return;
  const [sector,industry]=classificationByTicker.get(ticker.toUpperCase())||['기타','미분류'];
  usByTicker.set(ticker,[ticker,cleanUsName(name)||name,exchange,cikByTicker.get(ticker.toUpperCase())||null,sector,industry]);
};

const parsePipe=file=>fs.readFileSync(path.join(dataDir,file),'utf8').split(/\r?\n/).filter(Boolean).map(x=>x.split('|'));
const nasdaq=parsePipe('nasdaqlisted.txt');
for(const row of nasdaq.slice(1))addUs(row[0],row[1],'Nasdaq',row[6],row[3]);
const exchangeNames={A:'NYSE American',N:'NYSE',P:'NYSE Arca',Z:'Cboe',V:'IEX'};
const other=parsePipe('otherlisted.txt');
for(const row of other.slice(1))addUs(row[0],row[1],exchangeNames[row[2]]||row[2]||'US',row[4],row[6]);

const uniqueKr=[...new Map(kr.map(row=>[row[0],row])).values()];
uniqueKr.sort((a,b)=>a[1].localeCompare(b[1],'ko'));
kr.splice(0,kr.length,...uniqueKr);
const us=[...usByTicker.values()].sort((a,b)=>a[0].localeCompare(b[0],'en'));
const generatedAt=new Date().toISOString();
const output=`/* Generated from KRX KIND and Nasdaq Trader official symbol directories.\n * Run: node scripts/build-research-universe.mjs\n */\nwindow.RICHFLOW_ALL_LISTED=${JSON.stringify({kr,us})};\nwindow.RICHFLOW_ALL_LISTED_META=${JSON.stringify({generatedAt,krCount:kr.length,usCount:us.length})};\n`;
fs.writeFileSync(path.join(root,'research-all-data.js'),output,'utf8');
console.log(JSON.stringify({generatedAt,kr:uniqueKr.length,us:us.length,bytes:Buffer.byteLength(output)}));
