/* ValueCapper Academy section. Reads window.ACADEMY = {meta, races:{"TRK|R": {...}}} from the decrypted card.
   Pure display: no network, no effect on picks, probabilities, verdicts, ovals or the BET meter. Missing data shows a dash. */
(function(root){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  var DASH='<span class="acad-dim">—</span>', NONE='<span class="acad-dim">none</span>';
  function hn(x){ return '<b>#'+esc(x.pgm)+' '+esc(x.name)+'</b>'; }
  function row(n,label,val){ return '<div class="acad-l"><i>'+n+'</i>'+esc(label)+'</div><div class="acad-v">'+val+'</div>'; }
  function paceWhy(w){
    return String(w==null?'':w).replace('Need To Lead, not projected to lead','needs the lead, not projected to get it').replace('Poor Under Pressure, no clear 2 L lead','poor under pressure');
  }
  function who(x){
    if(x==null) return '';
    if(typeof x!=='object') return '#'+esc(x);
    return '#'+esc(x.pgm)+(x.why?' <span class="acad-sub">('+esc(paceWhy(x.why))+')</span>':'');
  }
  function setup(a){ var s=a.setup||{}; if(!s.shape) return DASH; return '<b>'+esc(s.shape)+'</b>'+(s.reason?' <span class="acad-sub">— '+esc(s.reason)+'</span>':''); }
  function accu(a){
    var p=a.accupressure||{}, out=[];
    if(!(p.first_call||[]).length && !(p.second_call||[]).length && !(p.closers||[]).length && !(p.need_to_lead||[]).length && !(p.poor_under_pressure||[]).length) return DASH;
    if((p.pressured||[]).length) out.push('Pressure on '+p.pressured.map(function(x){return '#'+esc(x&&x.pgm!=null?x.pgm:x);}).join(', ')+' <span class="acad-sub">(within 2 L at the 1st call)</span>');
    else if(a.setup&&a.setup.vc_scenario==='Unpressured') out.push('<span class="acad-sub">No pressure on the lead</span>');
    else if((p.first_call||[]).length) out.push('1st-call leader '+hn(p.first_call[0]));
    if((p.compromised||[]).length) out.push('Compromised: '+p.compromised.map(who).join(', '));
    out.push('Benefits: '+((p.benefits||[]).length?p.benefits.map(function(x){return hn(x)+' <span class="acad-sub">('+esc(paceWhy(x.why))+')</span>';}).join(', '):DASH));
    return out.join(' · ');
  }
  function lvt(a){ var v=a.lone_valuetech; if(!v) return NONE;
    return '<span class="acad-flag">LONE VT</span>'+hn(v)+' <span class="acad-sub">VC line '+esc(v.vc_line||'—')+' · Cont '+esc(v.cont||'—')+' · VTR '+esc(v.vtr_pct!=null?v.vtr_pct+'%':'—')+'</span>'; }
  function uniq(a){ var u=a.unique||[]; if(!u.length) return NONE; var x=u[0];
    return hn(x)+' — '+esc(x.attr)+' <span class="acad-sub">('+esc(x.detail)+')</span>'+(u.length>1?' <span class="acad-dim">+'+(u.length-1)+' more</span>':''); }
  function anti(a){ var v=a.anti_value; if(!v) return NONE;
    return '<span class="acad-flag">DOUBT</span>'+hn(v)+' <span class="acad-sub">(ML '+esc(v.ml||'—')+', VC line '+esc(v.vc_line||'—')+')</span>'
      +(v.reasons||[]).map(function(r){return '<span class="acad-rule">'+esc(r.rule)+': '+esc(r.detail)+'</span>';}).join(''); }
  function raceMap(A){
    var races=A&&A.races;
    if(!races) return null;
    if(!Array.isArray(races)) return races;
    var map={};
    races.forEach(function(race){
      if(!race) return;
      var key=race.race||((race.trk||'')+'|'+(parseInt(race.race_no,10)||''));
      map[key]=race;
    });
    return map;
  }
  function html(r){
    try{
      var A=root.ACADEMY; if(!A||!r) return '';
      var races=raceMap(A); if(!races) return '';
      var key=String(r.trk||'').toUpperCase()+'|'+String(parseInt(r.race,10));
      var a=races[key]; if(!a) return '';
      var M=A.meta||{}, R=M.rules||{}, lean=a.lean||{};
      return '<section class="acad" aria-label="ValueCapper Academy">'
        +'<div class="acad-h"><span class="acad-k">VALUECAPPER ACADEMY</span>'+(a.setup&&a.setup.shape?'<span class="acad-chip">'+esc(a.setup.shape)+'</span>':'')
        +'<span class="acad-scen">VC AccuPressure: '+esc((a.setup&&a.setup.vc_scenario)||'—')+' · ARC '+esc(a.arc_size!=null?a.arc_size:'—')+'</span></div>'
        +'<div class="acad-rows">'
        +row(1,'Race setup',setup(a))+row(2,'AccuPressure',accu(a))+row(3,'Lone ValueTech',lvt(a))
        +row(4,'Unique',uniq(a))+row(5,'Anti-value',anti(a))
        +'<div class="acad-lean '+(lean.kind==='lean'?'lean':'none')+'"><span class="acad-l"><i>6</i>Academy lean</span>'+esc(lean.text||'—')+'</div>'
        +'</div><div class="acad-f"><span>'+esc(M.caption||'')+'</span>'
        +'<details><summary>Rules ▸</summary><ol class="acad-rules">'
        +['setup','pressure','lone_vt','unique','anti','lean'].map(function(k){return '<li>'+esc(R[k]||'')+'</li>';}).join('')+'</ol></details></div></section>';
    }catch(e){ return ''; }
  }
  function isCopilotLoneVT(text){ return /lone\s*valuetech/i.test(String(text==null?'':text)); }
  root.ACAD={html:html, isCopilotLoneVT:isCopilotLoneVT};
})(typeof window!=='undefined'?window:globalThis);
