/* THE BEAST = PAPER ONLY (James approved 2026-11-09). Reads ONLY the decrypted card's DATA.beast_paper
   {key,trk,race,pgm,horse,ml,paper_only:true,stake:0,min_odds_to_1:4,min_dec:5,rule} — the same horse the CoPilot sheet shows.
   Display only: never stakes, never changes a verdict, pick, probability or the BET meter. The legacy DATA.beast field is ignored. */
(function(root){
  var MIN_DEC=5.0;   // 4/1 at post (decimal 5.00)
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function info(data){ var b=data&&data.beast_paper; return (b&&b.paper_only===true&&b.trk!=null&&b.race!=null&&b.pgm!=null)?b:null; }
  function key(data,K){ var b=info(data); if(!b) return null; return K?K(b.trk,b.race,b.pgm):(b.trk+'|'+b.race+'|'+b.pgm); }
  function minDec(data){ var b=info(data); var m=b&&Number(b.min_dec); return (m&&m>=MIN_DEC)?m:MIN_DEC; }
  function inRace(data,race,K){ var b=info(data); if(!b||!race) return false; return key(data,K)===(K?K(race.trk,race.race,b.pgm):(race.trk+'|'+race.race+'|'+b.pgm)); }
  function chip(){ return '<span class="hc beast" title="Paper only — no stake. Counts on paper only if 4/1 or more at post.">★ BEAST · PAPER ONLY</span>'; }
  function line(data,live){
    var b=info(data); if(!b) return '';
    var md=minDec(data), price='';
    if(live!=null&&isFinite(live)) price=(live>=md)?' Live price meets 4/1 (paper play counts if it holds at post).':' Live price is under 4/1 — no paper play unless it drifts to 4/1+.';
    return '<span class="beastpaper"><b>★ THE BEAST — PAPER ONLY, no stake:</b> #'+esc(b.pgm)+' '+esc(b.horse||'')+'. Tracked on paper only if it is 4/1 or more at post ('+md.toFixed(2)+' decimal). Do not bet it.'+price+'</span>';
  }
  var api={MIN_DEC:MIN_DEC, info:info, key:key, minDec:minDec, inRace:inRace, chip:chip, line:line};
  root.BP=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
