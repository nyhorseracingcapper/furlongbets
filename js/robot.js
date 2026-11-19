/* THE ROBOT (James approved 2026-11-11, pt598u; play-card layout 18 Nov 2026): today's fires only, angle info on each play.
   Reads ONLY the decrypted card's DATA.robot. Display only: never stakes, never changes a verdict, pick, probability, the BET meter or any other section. Missing data shows nothing. Collapsed by default. */
(function(root){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function info(d){ return (d&&d.title==='THE ROBOT'&&!d.error&&Array.isArray(d.angles)&&Array.isArray(d.races))?d:null; }
  function cardsOf(d){ return Array.isArray(d.play_cards)?d.play_cards.slice():[]; }
  function cardHtml(c){
    var dets=(c.details||[]).map(function(x){ return '<div class="rbt-det">'+esc(x)+'</div>'; }).join('');
    return '<div class="rbt-card"><div class="rbt-line">'+esc(c.line||'')+'</div>'+dets+'</div>';
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
  function race(data,r){
    var d=info(data); if(!d||!r) return '';
    var trk=String(r.trk), rn=String(r.race);
    var cards=cardsOf(d).filter(function(c){ return String(c.trk)===trk && String(c.race)===rn; });
    if(!cards.length) return '<details class="rbt-r" aria-label="THE ROBOT"><summary><span class="rbt-k">&#129302; THE ROBOT</span></summary> <span class="rbt-dim">No ROBOT plays</span></details>';
    return '<details class="rbt-r rbt-hit" aria-label="THE ROBOT"><summary><span class="rbt-k">&#129302; THE ROBOT</span></summary>'+cards.map(cardHtml).join('')+'</details>';
  }
  var api={info:info, html:html, race:race};
  root.RB=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
