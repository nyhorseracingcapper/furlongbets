/* THE ROBOT (James approved 2026-11-11, pt598u): research angles from ROBOT that pass the leaderboard (pass_fail == "PASS").
   Reads ONLY the decrypted card's DATA.robot {title,note,empty_race,none_yet,n_pass,angles[],races[],flagged_horses} — the same data the CoPilot sheets render
   under the Bet Slip. Display only: never stakes, never changes a verdict, pick, probability, the BET meter or any other section. Missing data shows nothing. */
(function(root){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function dash(v){ return (v==null||v==='')?'&ndash;':esc(v); }
  function info(d){ return (d&&d.title==='THE ROBOT'&&!d.error&&Array.isArray(d.angles)&&Array.isArray(d.races))?d:null; }
  function angleMap(d){ var m={}; (d.angles||[]).forEach(function(a){ m[a.id]=a; }); return m; }
  function angleLine(a,cond){
    return '<div class="rbt-al"><b>'+esc(a.id)+'</b> '+esc(a.definition)+(cond?' <span class="rbt-cd">'+esc(cond)+'</span>':'')+'<br><span class="rbt-rec">'+esc(a.record)+'</span></div>';
  }
  function horse(e,am){
    return '<div class="rbt-horse"><span class="rbt-hn">#'+esc(e.pgm)+' '+esc(e.horse)+'</span>'
      +'<span class="rbt-ln">ML '+dash(e.ml_txt)+' &middot; VC line '+dash(e.vc_line)+' &middot; VC #'+dash(e.vc_rank)+' &middot; BM #'+dash(e.bm_rank)+' &middot; SC #'+dash(e.sc_rank)+'</span>'
      +'<div class="rbt-als">'+(e.angles||[]).map(function(x){ var a=am[x.id]; return a?angleLine(a,x.condition):''; }).join('')+'</div></div>';
  }
  function html(data){
    var d=info(data); if(!d) return '';
    var n=d.n_pass||0;
    if(!n) return '<details id="robot-sec" class="rbt-wrap" open><summary>&#129302; '+esc(d.title)+'<span class="rbt-sub">'+esc(d.none_yet)+'</span></summary><div class="rbt-note">'+esc(d.note)+'</div><div class="rbt-ang">'+esc(d.none_yet)+'</div></details>';
    var am=angleMap(d), bad=d.angles.filter(function(a){ return a.status!=='evaluated'; });
    var sub=n+' passing angle'+(n===1?'':'s')+' &middot; '+d.flagged_horses+' horse'+(d.flagged_horses===1?'':'s')+' flagged today'+(bad.length?' &middot; '+bad.length+' cannot be evaluated today':'');
    var out=['<details id="robot-sec" class="rbt-wrap" open><summary>&#129302; '+esc(d.title)+'<span class="rbt-sub">'+sub+'</span></summary>','<div class="rbt-note">'+esc(d.note)+'</div>'];
    d.angles.forEach(function(a){
      if(a.status==='evaluated') out.push('<div class="rbt-ang"><b class="rbt-id">'+esc(a.id)+'</b>'+esc(a.definition)+'<br><span class="rbt-rec">'+esc(a.record)+'</span></div>');
      else out.push('<div class="rbt-ang rbt-cannot"><b class="rbt-id">'+esc(a.id)+'</b>'+esc(a.definition)+'<br><span class="rbt-cn">'+esc(a.id)+': cannot evaluate today (missing '+esc(a.missing)+')</span><br><span class="rbt-rec">'+esc(a.record)+'</span></div>');
    });
    d.races.forEach(function(r){
      if(!(r.entries||[]).length) return;
      out.push('<div class="rbt-race" data-open="1" data-trk="'+esc(r.trk)+'" data-race="'+esc(r.race)+'">'+esc(r.label)+'</div>');
      r.entries.forEach(function(e){ out.push(horse(e,am)); });
    });
    var empty=d.races.filter(function(r){ return !(r.entries||[]).length; });
    if(empty.length) out.push('<details class="rbt-empty"><summary>'+empty.length+' race'+(empty.length===1?'':'s')+': '+esc(d.empty_race)+'</summary>'
      +empty.map(function(r){ return '<div>'+esc(r.label)+' &mdash; '+esc(d.empty_race)+'</div>'; }).join('')+'</details>');
    out.push('</details>');
    return out.join('');
  }
  /* compact per-race block for the race detail (under the call box) */
  function race(data,r){
    var d=info(data); if(!d||!r) return '';
    var key=String(r.trk)+'|'+String(r.race), hit=null;
    (d.races||[]).forEach(function(x){ if(String(x.trk)+'|'+String(x.race)===key) hit=x; });
    if(!hit) return '';
    if(!d.n_pass) return '<section class="rbt-r" aria-label="THE ROBOT"><span class="rbt-k">&#129302; THE ROBOT</span> <span class="rbt-dim">'+esc(d.none_yet)+'</span></section>';
    if(!(hit.entries||[]).length) return '<section class="rbt-r" aria-label="THE ROBOT"><span class="rbt-k">&#129302; THE ROBOT</span> <span class="rbt-dim">'+esc(d.empty_race)+'</span></section>';
    var am=angleMap(d);
    return '<section class="rbt-r rbt-hit" aria-label="THE ROBOT"><span class="rbt-k">&#129302; THE ROBOT</span>'+hit.entries.map(function(e){ return horse(e,am); }).join('')+'<div class="rbt-note">'+esc(d.note)+'</div></section>';
  }
  var api={info:info, html:html, race:race};
  root.RB=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
