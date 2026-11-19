/* THE ROBOT (James approved 2026-11-11, pt598u; compact layout 18 Nov 2026): today's plays + 12-angle table.
   Reads ONLY the decrypted card's DATA.robot. Display only: never stakes, never changes a verdict, pick, probability, the BET meter or any other section. Missing data shows nothing. Collapsed by default. */
(function(root){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function info(d){ return (d&&d.title==='THE ROBOT'&&!d.error&&Array.isArray(d.angles)&&Array.isArray(d.races))?d:null; }
  function fmtWin(v){ return (v==null||v==='')?'—':Number(v).toFixed(1); }
  function fmtRoi(v){ if(v==null||v==='') return '—'; var n=Number(v); return (n>=0?'+':'')+n.toFixed(1)+'%'; }
  function fmtPlays(v){ return (v==null||v==='')?'—':String(v); }
  function playLines(d){ return Array.isArray(d.play_lines)?d.play_lines.slice():[]; }
  function naToday(d){
    if(Array.isArray(d.na_today)) return d.na_today;
    return (d.angles||[]).filter(function(a){ return a.status!=='evaluated'; }).map(function(a){ return a.id; });
  }
  function html(data){
    var d=info(data); if(!d) return '';
    var plays=playLines(d);
    var sub=plays.length? (plays.length+' today') : 'No plays today';
    var out=['<details id="robot-sec" class="rbt-wrap"><summary>&#129302; '+esc(d.title)+'<span class="rbt-sub">'+sub+'</span></summary>'];
    out.push('<div class="rbt-h">TODAY\'S ROBOT PLAYS</div>');
    if(plays.length) plays.forEach(function(line){ out.push('<div class="rbt-play">'+esc(line)+'</div>'); });
    else out.push('<div class="rbt-play">No ROBOT plays today</div>');
    if((d.angles||[]).length){
      out.push('<div class="rbt-h">ANGLES</div>');
      out.push('<div class="rbt-tblwrap"><table class="rbt-tbl"><colgroup><col class="ang"><col class="rule"><col class="num"><col class="num"><col class="num"></colgroup>');
      out.push('<thead><tr><th>Angle</th><th>Rule</th><th class="num">Win%</th><th class="num">ROI</th><th class="num">Plays</th></tr></thead><tbody>');
      d.angles.forEach(function(a){
        var rule=a.short_rule||a.definition||'';
        out.push('<tr><td><b class="rbt-id">'+esc(a.id)+'</b></td><td>'+esc(rule)+'</td><td class="num">'+esc(fmtWin(a.win_pct))+'</td><td class="num">'+esc(fmtRoi(a.win_roi))+'</td><td class="num">'+esc(fmtPlays(a.plays))+'</td></tr>');
      });
      out.push('</tbody></table></div>');
    }
    var na=naToday(d);
    if(na.length) out.push('<div class="rbt-fn">n/a today: '+esc(na.join(', '))+'</div>');
    out.push('</details>');
    return out.join('');
  }
  function race(data,r){
    var d=info(data); if(!d||!r) return '';
    var pre=String(r.trk)+' R'+String(r.race)+' #';
    var lines=playLines(d).filter(function(line){ return String(line).indexOf(pre)===0; });
    if(!lines.length) return '<details class="rbt-r" aria-label="THE ROBOT"><summary><span class="rbt-k">&#129302; THE ROBOT</span></summary> <span class="rbt-dim">No ROBOT plays</span></details>';
    return '<details class="rbt-r rbt-hit" aria-label="THE ROBOT"><summary><span class="rbt-k">&#129302; THE ROBOT</span></summary>'+lines.map(function(line){ return '<div class="rbt-play">'+esc(line)+'</div>'; }).join('')+'</details>';
  }
  var api={info:info, html:html, race:race};
  root.RB=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
