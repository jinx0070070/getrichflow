/* RICHFLOW 관심종목(즐겨찾기) 공용 저장소 — localStorage 기반, 페이지 공용 */
(function(){
  var KEY='richflow:watchlist';
  function read(){ try{ var v=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(v)?v:[]; }catch(e){ return []; } }
  function write(l){ try{ localStorage.setItem(KEY, JSON.stringify(l)); }catch(e){} try{ window.dispatchEvent(new CustomEvent('richflow:watch-change')); }catch(e){} }
  function norm(id){ return String(id==null?'':id).trim().toUpperCase(); }
  function keyOf(m,id){ return m+':'+norm(id); }
  function list(){ return read(); }
  function has(market,id){ var k=keyOf(market,id); return read().some(function(x){ return keyOf(x.market,x.id)===k; }); }
  function toggle(item){
    var l=read(), k=keyOf(item.market,item.id);
    var i=-1; for(var j=0;j<l.length;j++){ if(keyOf(l[j].market,l[j].id)===k){ i=j; break; } }
    var on;
    if(i>=0){ l.splice(i,1); on=false; }
    else { l.push({ market:item.market, id:String(item.id), name:item.name||String(item.id), url:item.url||'', ts:Date.now() }); on=true; }
    write(l); return on;
  }
  function remove(market,id){
    var k=keyOf(market,id);
    write(read().filter(function(x){ return keyOf(x.market,x.id)!==k; }));
  }
  /* 버튼에 배선: getItem()=>{market,id,name,url} 을 넘기면 클릭 토글 + 라벨 자동 동기화 */
  function bindButton(btn, getItem){
    if(!btn||typeof getItem!=='function') return function(){};
    function label(){
      var it=getItem(); if(!it||!it.id) return;
      var on=has(it.market,it.id);
      btn.textContent=on?'✓ 관심종목':'＋ 관심종목';
      btn.classList.toggle('on',on);
    }
    btn.addEventListener('click',function(){ var it=getItem(); if(!it||!it.id)return; toggle(it); label(); });
    window.addEventListener('richflow:watch-change',label);
    label();
    return label;
  }
  window.RichflowWatch={ list:list, has:has, toggle:toggle, remove:remove, bindButton:bindButton };
})();
