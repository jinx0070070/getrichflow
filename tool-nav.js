/* RICHFLOW 투자 도구 — 공용 내비게이션
   각 도구 페이지 하단에 "전체 도구" 목록을 자동 삽입한다.
   사용법: 페이지 맨 아래에 <script src="tool-nav.js"></script> 한 줄. */
(function(){
  var TOOLS=[
    {f:'tool-portfolio.html',  i:'💼', n:'내 포트폴리오',    d:'평가금액·비중·손익 자동 계산', live:1},
    {f:'tool-dividend.html',   i:'💰', n:'한·미 배당주·ETF', d:'QQQ·SCHD·국내 배당주·월분배 ETF', live:1},
    {f:'tool-journal.html',    i:'📝', n:'매매일지',          d:'손익·승률 자동 집계'},
    {f:'tool-usprofit.html',   i:'🇺🇸', n:'미국주식 실수익',  d:'주가·환율·수수료 분해', live:1},
    {f:'tool-avgdown.html',    i:'📉', n:'물타기 계산기',      d:'새 평단가·본전 상승률', live:1},
    {f:'tool-tax.html',        i:'🧾', n:'양도세 계산기',      d:'손익통산·250만 공제·22%'},
    {f:'tool-fx.html',         i:'💱', n:'환율 계산기',        d:'원↔외화 양방향·수수료', live:1},
    {f:'tool-market-hours.html',i:'🕒', n:'미국 증시 개장',     d:'지금 열렸나·다음 개장', live:1},
    {f:'tool-breakeven.html',  i:'⚖️', n:'손익분기 계산기',    d:'본전까지 필요 상승률'},
    {f:'tool-compound.html',   i:'📈', n:'복리 계산기',        d:'월 적립→미래 자산'},
    {f:'tool-deposit.html',    i:'🏦', n:'예금·적금 계산기',   d:'세후 만기 수령액'}
  ];
  var CSS=''
    +'.tnav{margin:8px 0 20px}'
    +'.tnav h3{font-size:14px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:8px}'
    +'.tnav h3 .hint{margin-left:auto;font-size:11px;color:var(--txt-3);font-weight:600}'
    +'.tnav-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(196px,1fr));gap:9px}'
    +'.tnav-i{display:flex;align-items:flex-start;gap:10px;background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:11px 12px;text-decoration:none;color:inherit;transition:border-color .15s,transform .15s}'
    +'.tnav-i:hover{border-color:var(--brand);transform:translateY(-1px)}'
    +'.tnav-i.cur{background:var(--brand);border-color:var(--brand);color:#fff}'
    +'.tnav-i.cur .tnav-d{color:rgba(255,255,255,.72)}'
    +'.tnav-ic{font-size:16px;flex:none;line-height:1.3}'
    +'.tnav-n{font-size:12.5px;font-weight:800;letter-spacing:-.02em;display:flex;align-items:center;gap:5px;flex-wrap:wrap}'
    +'.tnav-d{font-size:10.5px;color:var(--txt-3);margin-top:3px;line-height:1.4}'
    +'.tnav-lv{font-size:8.5px;font-weight:800;padding:1px 5px;border-radius:4px;background:var(--up-bg);color:var(--up)}'
    +'.tnav-i.cur .tnav-lv{background:rgba(255,255,255,.2);color:#fff}';

  function build(){
    var here=(location.pathname.split('/').pop()||'').toLowerCase();
    var st=document.createElement('style'); st.textContent=CSS; document.head.appendChild(st);

    var sec=document.createElement('div');
    sec.className='card tnav';
    var items=TOOLS.map(function(t){
      var cur=(t.f.toLowerCase()===here);
      return '<a class="tnav-i'+(cur?' cur':'')+'" href="'+t.f+'">'
        +'<span class="tnav-ic">'+t.i+'</span>'
        +'<span><span class="tnav-n">'+t.n+(t.live?' <span class="tnav-lv">실시간</span>':'')+'</span>'
        +'<span class="tnav-d">'+t.d+'</span></span></a>';
    }).join('');
    sec.innerHTML='<h3>🧰 전체 투자 도구 <span class="hint">'+TOOLS.length+'개 · 모두 무료</span></h3>'
      +'<div class="tnav-grid">'+items+'</div>';

    // 면책(.disc) 바로 앞에 삽입, 없으면 wrap 끝에
    var disc=document.querySelector('.disc');
    if(disc&&disc.parentNode) disc.parentNode.insertBefore(sec,disc);
    else { var w=document.querySelector('.wrap'); if(w)w.appendChild(sec); }

    // 기존의 "함께 쓰면 좋아요" 카드는 중복이므로 제거
    var cards=document.querySelectorAll('.card h3');
    for(var i=0;i<cards.length;i++){
      if(/함께 쓰면 좋아요|바로가기/.test(cards[i].textContent)){
        var c=cards[i].closest('.card'); if(c&&c!==sec)c.remove();
      }
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);
  else build();
})();
