(function(){
  function logoUrl(market,ticker){
    if(market==='kr')return 'https://ssl.pstatic.net/imgstock/fn/real/logo/stock/Stock'+encodeURIComponent(ticker)+'.svg';
    return 'https://financialmodelingprep.com/image-stock/'+encodeURIComponent(ticker)+'.png';
  }
  function set(target,market,ticker,name){
    const el=typeof target==='string'?document.querySelector(target):target;if(!el||!ticker)return;
    el.classList.remove('has-image','logo-fallback');el.textContent='';
    const letter=document.createElement('span');letter.className='sh-logo-letter';letter.textContent=String(name||ticker).trim().slice(0,1).toUpperCase()||'·';
    const img=document.createElement('img');img.alt=(name||ticker)+' 로고';img.loading='eager';img.referrerPolicy='no-referrer';
    img.onload=()=>el.classList.add('has-image');
    img.onerror=()=>{img.remove();el.classList.add('logo-fallback');};
    el.append(img,letter);img.src=logoUrl(market,ticker);
  }
  window.RichflowStockLogo={set};
})();
