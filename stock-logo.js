(function(){
  function logoUrl(market,ticker){
    if(market==='kr')return 'https://ssl.pstatic.net/imgstock/fn/real/logo/stock/Stock'+encodeURIComponent(ticker)+'.svg';
    return 'https://financialmodelingprep.com/image-stock/'+encodeURIComponent(ticker)+'.png';
  }
  // 로고 밝기 분석: 투명배경 + 밝은 로고면 어두운 배경 필요(흰 로고 안 보이는 것 방지)
  function analyze(el,img){
    try{
      const s=28,c=document.createElement('canvas');c.width=s;c.height=s;
      const ctx=c.getContext('2d');ctx.clearRect(0,0,s,s);ctx.drawImage(img,0,0,s,s);
      const d=ctx.getImageData(0,0,s,s).data;
      let trans=0,vis=0,light=0,total=0;
      for(let i=0;i<d.length;i+=4){
        total++;const a=d[i+3];
        if(a<40){trans++;continue;}
        vis++;const l=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];
        if(l>172)light++;
      }
      const transR=total?trans/total:0, lightR=vis?light/vis:0;
      if(transR>0.12&&lightR>0.55)el.classList.add('logo-dark');
    }catch(e){/* 캔버스 tainted 등 → 기본 흰배경 유지 */}
  }
  function set(target,market,ticker,name){
    const el=typeof target==='string'?document.querySelector(target):target;if(!el||!ticker)return;
    el.classList.remove('has-image','logo-fallback','logo-dark');el.textContent='';
    const letter=document.createElement('span');letter.className='sh-logo-letter';letter.textContent=String(name||ticker).trim().slice(0,1).toUpperCase()||'·';
    const img=document.createElement('img');img.alt=(name||ticker)+' 로고';img.loading='eager';img.referrerPolicy='no-referrer';img.crossOrigin='anonymous';
    img.onload=()=>{el.classList.add('has-image');analyze(el,img);};
    img.onerror=()=>{img.remove();el.classList.add('logo-fallback');};
    el.append(img,letter);img.src=logoUrl(market,ticker);
  }
  window.RichflowStockLogo={set};
})();
