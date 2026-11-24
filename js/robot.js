/* THE ROBOT (James approved 2026-11-11, pt598u; play-card layout 18 Nov 2026): today's fires only, angle info on each play.
   Reads ONLY the decrypted card's DATA.robot. Display only: never stakes, never changes a verdict, pick, probability, the BET meter or any other section. Missing data shows nothing. Collapsed by default. */
(function(root){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function info(d){ return (d&&d.title==='THE ROBOT'&&!d.error&&Array.isArray(d.angles)&&Array.isArray(d.races))?d:null; }
  function cardsOf(d){ return Array.isArray(d.play_cards)?d.play_cards.slice():[]; }
  /* KIT item 4: live check of a conditional play. live = {odds:{pgm:odds-to-1}, ml:{pgm:odds-to-1}, nscr:n}. 'fail' greys the card (display only). */
  function o2(s){ if(s==null) return null; if(typeof s==='number') return s; var m=String(s).match(/^(\d+(?:\.\d+)?)\s*[\/-]\s*(\d+(?:\.\d+)?)$/); return m?(+m[1])/(+m[2]):(isFinite(+s)?+s:null); }
  function check(c, live){
    var specs=c&&c.cond_specs; if(!c||!c.conditional||!Array.isArray(specs)||!live||!live.odds) return {state:'unknown'};
    var od=live.odds, mine=od[String(c.pgm)], fav=null, fo=null, k; for(k in od){ if(od[k]!=null&&(fo==null||od[k]<fo)){ fo=od[k]; fav=k; } }
    var mlo=function(p){ var v=live.ml&&live.ml[p]; return v==null?null:v; }, fails=[], unk=0;
    specs.forEach(function(s){ var ok=null, n;
      if(s.k==='late_scr_ge') ok=(live.nscr==null?null:live.nscr>=s.v);
      else if(mine==null) ok=null;
      else if(s.k==='odds_lt') ok=mine<s.v; else if(s.k==='odds_ge') ok=mine>=s.v; else if(s.k==='odds_range') ok=(mine>=s.lo&&mine<s.hi);
      else if(s.k==='odds_ge_vc'){ var vl=o2(c.vc_line); ok=(vl==null?null:mine>=vl); }
      else if(s.k==='fav_under') ok=(fav===String(c.pgm)&&mine<s.v);
      else if(s.k==='fav_le_ml'){ var m0=mlo(String(c.pgm)); ok=(m0==null?null:(fav===String(c.pgm)&&mine<=s.v*m0)); }
      else if(s.k==='drift_ml'){ var m1=mlo(String(c.pgm)); ok=(m1?(mine>=s.lo*m1&&mine<=s.hi*m1):null); }
      else if(s.k==='fav_lt_ml'){ var m2=fav!=null?mlo(fav):null; ok=(m2?fo<s.v*m2:null); }
      else if(s.k==='n_under'){ n=0; for(k in od){ if(od[k]!=null&&od[k]<s.v) n++; } ok=(n>=s.lo&&n<=s.hi); }
      if(ok===false) fails.push(s.text||s.k); else if(ok===null) unk++; });
    return fails.length?{state:'fail',fails:fails}:(unk?{state:'unknown'}:{state:'pass'});
  }
  function cardHtml(c, live){
    var dets=(c.details||[]).map(function(x){ return '<div class="rbt-det">'+esc(x)+'</div>'; }).join('');
    var ck=check(c, live), off=ck.state==='fail';
    var note=off?'<div class="rbt-det rbt-offnote">Condition not met at the tote right now: '+esc(ck.fails.join('; '))+' (display only)</div>':'';
    return '<div class="rbt-card'+(off?' rbt-off" style="opacity:.45;filter:grayscale(1)':'')+'" data-cond="'+esc(ck.state)+'"><div class="rbt-line">'+esc(c.line||'')+'</div>'+dets+note+'</div>';
  }
  function html(data){
    var d=info(data); if(!d) return '';
    var cards=cardsOf(d);
    var sub=' &middot; '+cards.length+' today';
    var out=['<details id="robot-sec" class="rbt-wrap"><summary>&#129302; '+esc(d.title)+'<span class="rbt-sub">'+sub+'</span></summary>'];
    if(cards.length) cards.forEach(function(c){ out.push(cardHtml(c)); });
    else out.push('<div class="rbt-none">No ROBOT plays today</div>');
    out.push('</details>');
    return out.join('');
  }
  function race(data,r,live){
    var d=info(data); if(!d||!r) return '';
    var trk=String(r.trk), rn=String(r.race);
    var cards=cardsOf(d).filter(function(c){ return String(c.trk)===trk && String(c.race)===rn; });
    if(!cards.length) return '<details class="rbt-r" aria-label="THE ROBOT"><summary><span class="rbt-k">&#129302; THE ROBOT</span></summary> <span class="rbt-dim">No ROBOT plays</span></details>';
    return '<details class="rbt-r rbt-hit" aria-label="THE ROBOT"><summary><span class="rbt-k">&#129302; THE ROBOT</span></summary>'+cards.map(function(c){ return cardHtml(c, live); }).join('')+'</details>';
  }
  var api={info:info, html:html, race:race, check:check};
  root.RB=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
// KIT_ITEM4_LIVE_GREY
