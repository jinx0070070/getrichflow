/* RICHFLOW 자동 리서치 엔진
 * 우리가 직접 연동한 원본 데이터(네이버 투자자별 매매·시세, DART 공시, SEC, ARK)를
 * 조합해 매일 자동으로 리서치 카드를 생성한다. 외부 유료 API·AI 생성 없음.
 *
 * 사용법: research.html에서 <script src="research-auto.js"></script> 후
 *   RichflowAutoResearch.build('kr'|'us').then(list => ...)
 * 반환 형식은 research-data.js의 아티클 객체와 호환된다.
 */
(function(){
  var WK='https://frosty-sea-d3c9.joyoonseo6299.workers.dev/?url=';
  var DART='https://frosty-sea-d3c9.joyoonseo6299.workers.dev/?dart=list';

  /* ---------- 공통 유틸 ---------- */
  function num(s){var v=parseFloat(String(s==null?'':s).replace(/[^0-9.\-]/g,''));return isFinite(v)?v:0;}
  function esc(v){return String(v==null?'':v).replace(/[&<>'"]/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c];});}
  function won(n){var a=Math.abs(n),s;
    if(a>=1e12)s=(a/1e12).toFixed(2)+'조';
    else if(a>=1e8)s=Math.round(a/1e8).toLocaleString('ko-KR')+'억';
    else if(a>=1e4)s=Math.round(a/1e4).toLocaleString('ko-KR')+'만';
    else s=Math.round(a).toLocaleString('ko-KR');
    return (n<0?'−':'')+s+'원';}
  function pct(p){return (p>=0?'+':'')+Number(p).toFixed(2)+'%';}
  function bd(s){s=String(s||'');return s.length===8?(+s.slice(4,6))+'.'+(+s.slice(6,8)):s;}
  function todayStr(){var d=new Date();
    return d.getFullYear()+'.'+String(d.getMonth()+1).padStart(2,'0')+'.'+String(d.getDate()).padStart(2,'0');}
  function nowTime(){var d=new Date();
    return todayStr()+' '+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');}
  function ymd(offsetDays){var d=new Date(Date.now()-(offsetDays||0)*864e5);
    return d.getFullYear()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');}

  function fetchJSON(url,ms){
    var ctrl=new AbortController(), t=setTimeout(function(){ctrl.abort();},ms||11000);
    return fetch(url,{signal:ctrl.signal}).then(function(r){
      if(!r.ok)throw new Error('HTTP '+r.status); return r.json();
    }).catch(function(){return null;}).then(function(v){clearTimeout(t);return v;});
  }
  function pool(items,n,fn){
    var out=[],i=0;
    function worker(){
      if(i>=items.length)return Promise.resolve();
      var k=i++;
      return Promise.resolve(fn(items[k])).then(function(v){out[k]=v;return worker();});
    }
    return Promise.all(Array.from({length:Math.min(n,items.length)},worker)).then(function(){return out;});
  }

  /* ---------- 대상 종목 ---------- */
  var KR=[['삼성전자','005930'],['SK하이닉스','000660'],['LG에너지솔루션','373220'],['삼성바이오로직스','207940'],
    ['현대차','005380'],['기아','000270'],['셀트리온','068270'],['KB금융','105560'],['NAVER','035420'],
    ['신한지주','055550'],['삼성SDI','006400'],['현대모비스','012330'],['카카오','035720'],['POSCO홀딩스','005490'],
    ['LG화학','051910'],['삼성물산','028260'],['하나금융','086790'],['한화오션','042660'],['HD한국조선해양','009540'],
    ['두산에너빌리티','034020'],['고려아연','010130'],['한미반도체','042700'],['크래프톤','259960'],['삼성전기','009150'],
    ['LG전자','066570'],['하이브','352820'],['에코프로비엠','247540'],['한화에어로스페이스','012450'],
    ['HMM','011200'],['우리금융지주','316140'],['현대로템','064350'],['SK이노베이션','096770']];

  var US=[['NVDA','엔비디아'],['AAPL','애플'],['MSFT','마이크로소프트'],['TSLA','테슬라'],['GOOGL','알파벳'],
    ['META','메타'],['AMZN','아마존'],['AMD','AMD'],['AVGO','브로드컴'],['COIN','코인베이스'],
    ['MSTR','마이크로스트래티지'],['PLTR','팔란티어'],['NFLX','넷플릭스'],['MU','마이크론'],['ORCL','오라클'],
    ['JPM','JP모건'],['LLY','일라이릴리'],['UBER','우버'],['HOOD','로빈후드'],['QCOM','퀄컴']];

  /* ---------- 데이터 수집 ---------- */
  function krTrend(code){
    return fetchJSON(WK+encodeURIComponent('https://m.stock.naver.com/api/stock/'+code+'/trend'));
  }
  function loadKR(){
    return pool(KR,6,function(s){
      return krTrend(s[1]).then(function(d){
        if(!Array.isArray(d)||!d.length)return null;
        var t=d[0], price=num(t.closePrice);
        return {name:s[0],code:s[1],date:t.bizdate,price:price,
          chg:num(t.compareToPreviousClosePrice),
          pct:price?num(t.compareToPreviousClosePrice)/price*100:0,
          fq:num(t.foreignerPureBuyQuant), oq:num(t.organPureBuyQuant), iq:num(t.individualPureBuyQuant),
          fAmt:num(t.foreignerPureBuyQuant)*price, oAmt:num(t.organPureBuyQuant)*price,
          fRatio:t.foreignerHoldRatio||'', days:d};
      });
    }).then(function(r){return r.filter(Boolean);});
  }
  function loadDart(detail,days,count){
    return fetchJSON(DART+'&detail='+detail+'&bgn='+ymd(days)+'&end='+ymd(0)+'&page=1&count='+(count||100),13000);
  }
  function loadArk(){
    var F=['ARKK','ARKW','ARKG','ARKQ','ARKF','ARKX'];
    return pool(F,6,function(f){
      return fetchJSON('https://arkfunds.io/api/v2/etf/trades?symbol='+f);
    }).then(function(res){
      var map={},latest='';
      res.forEach(function(d){
        if(!d||!d.trades)return;
        if((d.date_from||'')>latest)latest=d.date_from;
        d.trades.forEach(function(t){
          var k=t.ticker; if(!k)return;
          if(!map[k])map[k]={ticker:k,company:t.company,shares:0,pct:0,funds:{}};
          var sg=t.direction==='Buy'?1:-1;
          map[k].shares+=sg*(t.shares||0); map[k].pct+=sg*(t.etf_percent||0); map[k].funds[t.fund]=1;
        });
      });
      return {date:latest,list:Object.keys(map).map(function(k){return map[k];}).filter(function(x){return x.shares!==0;})};
    });
  }
  function loadUS(){
    return pool(US,5,function(s){
      return fetchJSON(WK+encodeURIComponent('https://api.stock.naver.com/stock/'+s[0]+'.O/basic')).then(function(d){
        if(!d||!d.closePrice)return fetchJSON(WK+encodeURIComponent('https://api.stock.naver.com/stock/'+s[0]+'/basic')).then(function(d2){
          return d2&&d2.closePrice?{sym:s[0],name:s[1],price:num(d2.closePrice),pct:num(d2.fluctuationsRatio)}:null;});
        return {sym:s[0],name:s[1],price:num(d.closePrice),pct:num(d.fluctuationsRatio)};
      });
    }).then(function(r){return r.filter(Boolean);});
  }

  /* ---------- 카드 생성기 ---------- */
  function card(o){
    return {
      id:o.id, thumb:o.thumb, category:o.category, market:o.market,
      title:o.title, summary:o.summary, published:nowTime(), readTime:'2분',
      badge:'자동 집계', auto:true, asOf:o.asOf||(todayStr()+' 기준'),
      evidence:{grade:'근거등급 A', basis:o.basis, note:'외부 해석 없이 원본 수치를 그대로 집계했습니다. 장중에는 값이 달라질 수 있습니다.'},
      bullets:o.bullets, tickers:o.tickers||[], sections:o.sections||[],
      sources:o.sources||[],
      tags:o.tags||['자동집계','실데이터'],
      keyStats:o.keyStats||[]
    };
  }

  /* 1) 외국인·기관 수급 */
  function cardFlow(rows){
    if(!rows.length)return null;
    var dt=bd(rows[0].date);
    var byF=rows.slice().sort(function(a,b){return b.fAmt-a.fAmt;});
    var byO=rows.slice().sort(function(a,b){return b.oAmt-a.oAmt;});
    var fTot=rows.reduce(function(n,x){return n+x.fAmt;},0);
    var oTot=rows.reduce(function(n,x){return n+x.oAmt;},0);
    var top=byF[0], bot=byF[byF.length-1];
    var same=(fTot>=0)===(oTot>=0);
    return card({
      id:'auto-flow-'+rows[0].date, thumb:'수급', category:'수급분석', market:'한국주식',
      title:(fTot>=0?'외국인이 '+won(fTot)+' 담았다':'외국인이 '+won(Math.abs(fTot))+' 팔았다')+
        ' — '+dt+' 기관은 '+(oTot>=0?'동반 매수':'반대 매도'),
      summary:'주요 '+rows.length+'종목 기준 외국인 순매수 '+won(fTot)+', 기관 '+won(oTot)+'. '+
        '외국인 최대 순매수는 '+top.name+'('+won(top.fAmt)+'), 최대 순매도는 '+bot.name+'('+won(bot.fAmt)+').',
      basis:'네이버 금융 투자자별 매매 (순매수 수량 × 종가)',
      asOf:dt+' 종가 기준 · 주요 '+rows.length+'종목',
      bullets:[
        '외국인 순매수 합계 <b>'+won(fTot)+'</b>, 기관 <b>'+won(oTot)+'</b>로 '+(same?'<b>같은 방향</b>':'<b>서로 반대 방향</b>')+'이다.',
        '외국인 순매수 1위는 <b>'+esc(top.name)+' '+won(top.fAmt)+'</b>, 순매도 1위는 <b>'+esc(bot.name)+' '+won(bot.fAmt)+'</b>이다.',
        '기관 순매수 1위는 <b>'+esc(byO[0].name)+' '+won(byO[0].oAmt)+'</b>이다.'
      ],
      tickers:byF.slice(0,3).map(function(x){return {name:x.name,code:x.code,price:Math.round(x.price).toLocaleString('ko-KR')+'원',change:pct(x.pct),direction:x.pct>=0?'up':'down'};}),
      keyStats:[['외국인 순매수',won(fTot),fTot>=0?'up':'down'],['기관 순매수',won(oTot),oTot>=0?'up':'down'],
        ['외국인 1위',esc(top.name)+' '+won(top.fAmt),'up'],['외국인 최하위',esc(bot.name)+' '+won(bot.fAmt),'down'],
        ['집계 종목',rows.length+'종목','']],
      tags:['수급','외국인','기관','자동집계'],
      sections:[
        {title:'1. 외국인 순매수 상위', body:'<p>'+byF.slice(0,5).map(function(x,i){
          return (i+1)+'. <b>'+esc(x.name)+'</b> '+won(x.fAmt)+' ('+pct(x.pct)+')';}).join('<br>')+'</p>'},
        {title:'2. 외국인 순매도 상위', body:'<p>'+byF.slice(-5).reverse().map(function(x,i){
          return (i+1)+'. <b>'+esc(x.name)+'</b> '+won(x.fAmt)+' ('+pct(x.pct)+')';}).join('<br>')+'</p>'},
        {title:'3. 읽는 법', body:'<p>외국인과 기관이 <b>같은 방향</b>이면 추세가 강하고, <b>반대 방향</b>이면 종목별 차별화 구간으로 본다. '+
          (same?'오늘은 두 주체가 같은 방향이라 '+(fTot>=0?'매수':'매도')+' 쏠림이 뚜렷하다.'
              :'오늘은 두 주체가 엇갈려 개별 종목 선택이 더 중요해지는 구간이다.')+'</p>'}
      ],
      sources:[{kind:'원본',label:'네이버 금융 투자자별 매매',url:'https://finance.naver.com/item/frgn.naver?code='+top.code}]
    });
  }

  /* 2) 급등락 */
  function cardMovers(rows){
    var m=rows.filter(function(x){return isFinite(x.pct)&&x.pct!==0;}).sort(function(a,b){return b.pct-a.pct;});
    if(m.length<4)return null;
    var up=m.slice(0,3), dn=m.slice(-3).reverse();
    var dt=bd(rows[0].date);
    return card({
      id:'auto-movers-'+rows[0].date, thumb:'등락', category:'시장동향', market:'한국주식',
      title:esc(up[0].name)+' '+pct(up[0].pct)+' 강세 — '+dt+' 주요 종목 등락 점검',
      summary:'주요 '+rows.length+'종목 중 상승 '+m.filter(function(x){return x.pct>0;}).length+'개, 하락 '+m.filter(function(x){return x.pct<0;}).length+'개. '+
        '상승 1위 '+up[0].name+' '+pct(up[0].pct)+', 하락 1위 '+dn[0].name+' '+pct(dn[0].pct)+'.',
      basis:'네이버 금융 실시간 시세 (전일 대비 등락률)',
      asOf:dt+' 기준',
      bullets:[
        '상승 상위: '+up.map(function(x){return '<b>'+esc(x.name)+' '+pct(x.pct)+'</b>';}).join(', '),
        '하락 상위: '+dn.map(function(x){return '<b>'+esc(x.name)+' '+pct(x.pct)+'</b>';}).join(', '),
        '상승 1위 '+esc(up[0].name)+'은 외국인 '+won(up[0].fAmt)+', 기관 '+won(up[0].oAmt)+'을 기록했다.'
      ],
      tickers:up.map(function(x){return {name:x.name,code:x.code,price:Math.round(x.price).toLocaleString('ko-KR')+'원',change:pct(x.pct),direction:x.pct>=0?'up':'down'};}),
      keyStats:[['상승 종목',m.filter(function(x){return x.pct>0;}).length+'개','up'],
        ['하락 종목',m.filter(function(x){return x.pct<0;}).length+'개','down'],
        ['상승 1위',esc(up[0].name)+' '+pct(up[0].pct),'up'],
        ['하락 1위',esc(dn[0].name)+' '+pct(dn[0].pct),'down'],
        ['평균 등락',pct(m.reduce(function(n,x){return n+x.pct;},0)/m.length),m.reduce(function(n,x){return n+x.pct;},0)>=0?'up':'down']],
      tags:['등락','시장동향','자동집계'],
      sections:[
        {title:'1. 오늘의 상승 종목', body:'<p>'+up.map(function(x){
          return '<b>'+esc(x.name)+'</b> '+pct(x.pct)+' · 종가 '+Math.round(x.price).toLocaleString('ko-KR')+'원 · 외국인 '+won(x.fAmt);}).join('<br>')+'</p>'},
        {title:'2. 오늘의 하락 종목', body:'<p>'+dn.map(function(x){
          return '<b>'+esc(x.name)+'</b> '+pct(x.pct)+' · 종가 '+Math.round(x.price).toLocaleString('ko-KR')+'원 · 외국인 '+won(x.fAmt);}).join('<br>')+'</p>'},
        {title:'3. 수급이 따라붙었나', body:'<p>주가가 올랐어도 <b>외국인·기관이 팔았다면</b> 개인 매수에 기댄 상승일 수 있다. '+
          '반대로 <b>하락했는데 외국인이 샀다면</b> 저가 매수 관점의 접근으로 해석한다.</p>'}
      ],
      sources:[{kind:'원본',label:'네이버 금융 시세',url:'https://finance.naver.com/item/main.naver?code='+up[0].code}]
    });
  }

  /* 3) DART 대량보유(5%룰) */
  function cardDart(d){
    if(!d||d.status!=='000'||!Array.isArray(d.list))return null;
    var list=d.list.filter(function(x){return /대량보유/.test(x.report_nm||'');});
    if(!list.length)return null;
    var cnt={};list.forEach(function(x){cnt[x.corp_name]=(cnt[x.corp_name]||0)+1;});
    var top=Object.keys(cnt).map(function(k){return [k,cnt[k]];}).sort(function(a,b){return b[1]-a[1];})[0];
    var flr={};list.forEach(function(x){var f=x.flr_nm||'';if(f)flr[f]=(flr[f]||0)+1;});
    var topFlr=Object.keys(flr).map(function(k){return [k,flr[k]];}).sort(function(a,b){return b[1]-a[1];})[0];
    var link=function(x){return 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+String(x.rcept_no||'').replace(/[^0-9]/g,'');};
    return card({
      id:'auto-dart-'+list[0].rcept_dt, thumb:'5%', category:'공시분석', market:'한국주식',
      title:'최근 5%룰 대량보유 '+list.length+'건 — '+esc(top[0])+'에 '+top[1]+'건 집중',
      summary:'최근 5거래일 DART 대량보유(5%룰) 공시 '+list.length+'건을 집계했다. '+
        '가장 많이 신고된 종목은 '+top[0]+'('+top[1]+'건), 가장 활발한 신고자는 '+(topFlr?topFlr[0]:'-')+'이다.',
      basis:'DART 전자공시 주식등의대량보유상황보고서(D001)',
      asOf:bd(list[0].rcept_dt)+' 최근 접수 · 최근 5거래일',
      bullets:[
        '집계 기간 대량보유 공시는 <b>'+list.length+'건</b>이며, 최신 접수일은 <b>'+bd(list[0].rcept_dt)+'</b>이다.',
        '가장 많이 신고된 종목은 <b>'+esc(top[0])+' '+top[1]+'건</b>이다.',
        (topFlr?'신고 주체 기준으로는 <b>'+esc(topFlr[0])+'</b>이 '+topFlr[1]+'건으로 가장 많다.':'신고 주체는 분산돼 있다.')
      ],
      keyStats:[['대량보유 공시',list.length+'건',''],['최신 접수',bd(list[0].rcept_dt),''],
        ['최다 신고 종목',esc(top[0])+' '+top[1]+'건','up'],
        ['최다 신고자',topFlr?esc(topFlr[0])+' '+topFlr[1]+'건':'-','']],
      tags:['공시','5%룰','DART','자동집계'],
      sections:[
        {title:'1. 최근 대량보유 공시', body:'<p>'+list.slice(0,8).map(function(x){
          return bd(x.rcept_dt)+' · <b>'+esc(x.corp_name)+'</b> — 신고자 '+esc(x.flr_nm||'-')+
            ' <a href="'+link(x)+'" target="_blank" rel="noopener">원문↗</a>';}).join('<br>')+'</p>'},
        {title:'2. 5%룰이란', body:'<p>지분을 <b>5% 이상 신규 취득</b>하거나 이후 <b>1%p 이상 변동</b>하면 5일 안에 DART에 신고해야 한다. '+
          '여러 주체가 같은 종목에 몰리면 수급 신호로 읽지만, 공시는 실제 매매보다 <b>며칠 늦게</b> 도착한다는 점을 감안해야 한다.</p>'}
      ],
      sources:[{kind:'원본',label:'DART 전자공시',url:'https://dart.fss.or.kr/dsab007/main.do'}]
    });
  }

  /* 4) ARK 매매 (미장) */
  function cardArk(ark){
    if(!ark||!ark.list.length)return null;
    var buys=ark.list.filter(function(x){return x.shares>0;}).sort(function(a,b){return b.pct-a.pct;});
    var sells=ark.list.filter(function(x){return x.shares<0;}).sort(function(a,b){return a.pct-b.pct;});
    if(!buys.length&&!sells.length)return null;
    var dt=String(ark.date||'').slice(5).replace('-','.');
    var sh=function(n){n=Math.abs(n);return n>=1e6?(n/1e6).toFixed(1)+'M주':n>=1e3?Math.round(n/1e3)+'K주':Math.round(n)+'주';};
    return card({
      id:'auto-ark-'+ark.date, thumb:'ARK', category:'수급분석', market:'미국주식',
      title:'ARK가 '+dt+'에 담고 판 종목 — 순매수 '+buys.length+'개, 순매도 '+sells.length+'개',
      summary:'ARK Invest 6개 액티브 ETF의 '+dt+' 공개 매매 내역이다. '+
        (buys[0]?'순매수 상위는 '+buys[0].ticker:'')+(sells[0]?', 순매도 상위는 '+sells[0].ticker:'')+'.',
      basis:'ARK Invest 일별 공개 매매 내역 (arkfunds.io)',
      asOf:dt+' 공개 거래 기준',
      bullets:[
        (buys[0]?'순매수 상위: '+buys.slice(0,3).map(function(x){return '<b>'+esc(x.ticker)+' '+sh(x.shares)+'</b>';}).join(', '):'순매수 종목 없음'),
        (sells[0]?'순매도 상위: '+sells.slice(0,3).map(function(x){return '<b>'+esc(x.ticker)+' '+sh(x.shares)+'</b>';}).join(', '):'순매도 종목 없음'),
        'ARK는 <b>매일 장 마감 후 보유 내역을 공개</b>하는 몇 안 되는 큰손이라, 방향 전환을 가장 빨리 확인할 수 있다.'
      ],
      tickers:buys.slice(0,3).map(function(x){return {name:x.company||x.ticker,code:x.ticker,price:'',change:'순매수',direction:'up'};}),
      keyStats:[['순매수 종목',buys.length+'개','up'],['순매도 종목',sells.length+'개','down'],
        ['순매수 1위',buys[0]?esc(buys[0].ticker)+' '+sh(buys[0].shares):'-','up'],
        ['순매도 1위',sells[0]?esc(sells[0].ticker)+' '+sh(sells[0].shares):'-','down'],
        ['기준일',dt,'']],
      tags:['ARK','미장','수급','자동집계'],
      sections:[
        {title:'1. ARK 순매수', body:'<p>'+(buys.length?buys.slice(0,6).map(function(x){
          return '<b>'+esc(x.ticker)+'</b> '+esc(x.company||'')+' — '+sh(x.shares)+' ('+Object.keys(x.funds).join('·')+')';}).join('<br>'):'해당 없음')+'</p>'},
        {title:'2. ARK 순매도', body:'<p>'+(sells.length?sells.slice(0,6).map(function(x){
          return '<b>'+esc(x.ticker)+'</b> '+esc(x.company||'')+' — '+sh(x.shares)+' ('+Object.keys(x.funds).join('·')+')';}).join('<br>'):'해당 없음')+'</p>'},
        {title:'3. 참고', body:'<p>ARK 매매는 <b>비중 조절</b> 목적일 수 있어 한 건만으로 방향을 단정하기 어렵다. '+
          '여러 날 연속 같은 방향이거나 여러 펀드가 동시에 움직일 때 신호가 강해진다.</p>'}
      ],
      sources:[{kind:'원본',label:'ARK Invest 공개 매매',url:'https://ark-funds.com/'}]
    });
  }

  /* 5) 미장 등락 */
  function cardUsMovers(rows){
    var m=rows.filter(function(x){return isFinite(x.pct);}).sort(function(a,b){return b.pct-a.pct;});
    if(m.length<4)return null;
    var up=m.slice(0,3), dn=m.slice(-3).reverse();
    var usd=function(n){return '$'+n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});};
    return card({
      id:'auto-usmovers-'+ymd(0), thumb:'US', category:'시장동향', market:'미국주식',
      title:esc(up[0].name)+' '+pct(up[0].pct)+' — 미장 주요 종목 등락 점검',
      summary:'주요 미국 '+rows.length+'종목 중 상승 '+m.filter(function(x){return x.pct>0;}).length+'개, 하락 '+m.filter(function(x){return x.pct<0;}).length+'개. '+
        '상승 1위 '+up[0].name+' '+pct(up[0].pct)+', 하락 1위 '+dn[0].name+' '+pct(dn[0].pct)+'.',
      basis:'네이버 금융 미국 종목 시세',
      bullets:[
        '상승 상위: '+up.map(function(x){return '<b>'+esc(x.name)+' '+pct(x.pct)+'</b>';}).join(', '),
        '하락 상위: '+dn.map(function(x){return '<b>'+esc(x.name)+' '+pct(x.pct)+'</b>';}).join(', '),
        '주요 종목 평균 등락률은 <b>'+pct(m.reduce(function(n,x){return n+x.pct;},0)/m.length)+'</b>이다.'
      ],
      tickers:up.map(function(x){return {name:x.name,code:x.sym,price:usd(x.price),change:pct(x.pct),direction:x.pct>=0?'up':'down'};}),
      keyStats:[['상승 종목',m.filter(function(x){return x.pct>0;}).length+'개','up'],
        ['하락 종목',m.filter(function(x){return x.pct<0;}).length+'개','down'],
        ['상승 1위',esc(up[0].name)+' '+pct(up[0].pct),'up'],
        ['하락 1위',esc(dn[0].name)+' '+pct(dn[0].pct),'down'],
        ['평균 등락',pct(m.reduce(function(n,x){return n+x.pct;},0)/m.length),m.reduce(function(n,x){return n+x.pct;},0)>=0?'up':'down']],
      tags:['미장','등락','자동집계'],
      sections:[
        {title:'1. 상승 종목', body:'<p>'+up.map(function(x){return '<b>'+esc(x.name)+' ('+x.sym+')</b> '+usd(x.price)+' '+pct(x.pct);}).join('<br>')+'</p>'},
        {title:'2. 하락 종목', body:'<p>'+dn.map(function(x){return '<b>'+esc(x.name)+' ('+x.sym+')</b> '+usd(x.price)+' '+pct(x.pct);}).join('<br>')+'</p>'}
      ],
      sources:[{kind:'원본',label:'네이버 금융 해외증시',url:'https://m.stock.naver.com/worldstock/stock/'+up[0].sym+'.O'}]
    });
  }

  /* ---------- 빌드 ---------- */
  var cacheKR=null, cacheUS=null;
  function buildKR(){
    if(cacheKR)return Promise.resolve(cacheKR);
    return Promise.all([loadKR(), loadDart('D001',5,100)]).then(function(r){
      var rows=r[0]||[], dart=r[1];
      var out=[cardFlow(rows), cardMovers(rows), cardDart(dart)].filter(Boolean);
      cacheKR=out; return out;
    }).catch(function(){return [];});
  }
  function buildUS(){
    if(cacheUS)return Promise.resolve(cacheUS);
    return Promise.all([loadUS(), loadArk()]).then(function(r){
      var out=[cardArk(r[1]), cardUsMovers(r[0]||[])].filter(Boolean);
      cacheUS=out; return out;
    }).catch(function(){return [];});
  }

  window.RichflowAutoResearch={
    VERSION:'2',
    build:function(market){ return market==='us'?buildUS():buildKR(); }
  };
})();
