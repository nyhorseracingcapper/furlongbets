/* PRICE RACES (James approved 2026-11-12, PAPER ONLY, NOT A BET SIGNAL): each race is read through the ValueCapper lens that fits it; the lens names the one ML 4-1+ horse it favours, if any.
   Reads ONLY the decrypted card's DATA.price_races {title,note,lenses[],races[{trk,race,label,lens,lens_name,reason,entry}],lens_counts,picks_by_lens,flagged_races} — the same data the CoPilot sheets render
   after THE ROBOT. Display only: never stakes, never changes a verdict, pick, probability, the BET meter or any other section. Missing data shows nothing. */
(function(root){
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function dash(v){ return (v==null||v==='')?'&ndash;':esc(v); }
  function info(d){ return (d&&d.title==='PRICE RACES'&&!d.error&&Array.isArray(d.lenses)&&Array.isArray(d.races))?d:null; }
  function html(data){
    var d=info(data); if(!d) return '';
    var fl=d.flagged_races||0, n=(d.races||[]).length, cnt=d.lens_counts||{}, pk=d.picks_by_lens||{}, xc=d.extra_lens_counts||{}, nx=d.extra_picks||0, ns=d.sel_picks||0;
    var out=['<details id="pricerace-sec" class="prc-wrap" open><summary>&#128176; '+esc(d.title)+'<span class="prc-paper">PAPER ONLY &middot; NOT A BET SIGNAL</span><span class="prc-sub">'+fl+' paper pick'+(fl===1?'':'s')+' in '+n+' races'+(nx?' + '+nx+' extra-flag horse'+(nx===1?'':'s'):'')+(ns?' + '+ns+' race-selected play'+(ns===1?'':'s'):'')+'</span></summary>',
      '<div class="prc-note">'+esc(d.note)+'</div>'];
    if(Array.isArray(d.sel)){   // SEL: race-selected plays at the very top (most selective list)
      out.push('<div class="prc-sel"><div class="prc-selh">&#127919; SEL &middot; Race-selected plays ('+d.sel.length+' today)</div><div class="prc-selsub">Frozen race-selection tree: each race is read for its type and gets the one method chosen for that type (or no play). '+d.sel.length+' of '+(d.sel_races_read||0)+' races read get a play. Extra paper flag only.</div>');
      d.sel.forEach(function(e){
        out.push('<div class="prc-horse"><span class="prc-tag">SEL</span><span class="prc-hn">'+esc(e.label)+' &middot; #'+esc(e.pgm)+' '+esc(e.horse)+'</span><span class="prc-ln">ML '+dash(e.ml_txt)+' &middot; VC line '+dash(e.vc_line)+' &middot; Contention '+dash(e.contention)+' &middot; VC #'+dash(e.vc_rank)+'</span>'
          +'<div class="prc-type"><b>Race type:</b> '+esc(e.race_type)+'.<br><b>Method chosen:</b> '+esc(e.method_words)+' ('+esc(e.method)+').</div></div>');
      });
      if(!d.sel.length) out.push('<div class="prc-rule">No race on this card gets a selected play.</div>');
      out.push('</div>');
    }
    var nm=d.lenses.filter(function(l){return !l.extra;}).length, nxl=d.lenses.length-nm;
    var leg=['<details class="prc-empty"><summary>Lenses used ('+nm+(nxl?' + '+nxl+' extra flags':'')+') &mdash; rule, test record, races today</summary>'];
    d.lenses.forEach(function(l){
      if(l.extra){ var q=xc[l.id]||0; leg.push('<div class="prc-rule"><b>'+esc(l.name)+'</b> &mdash; extra flag, '+q+' horse'+(q===1?'':'s')+' today<br>Race shape: '+esc(l.shape)+'<br>Horse: '+esc(l.horse)+' (ML '+esc(Math.round(l.ml_floor))+'-1 or longer)<br><span class="prc-rec">'+esc(l.record)+'</span></div>'); return; }
      var c=cnt[l.id]||0, p=pk[l.id]||0;
      leg.push('<div class="prc-rule"><b>'+esc(l.name)+'</b> &mdash; '+c+' race'+(c===1?'':'s')+' today, '+p+' pick'+(p===1?'':'s')+'<br>Race shape: '+esc(l.shape)+'<br>Horse: '+esc(l.horse)+' (ML '+esc(Math.round(l.ml_floor))+'-1 or longer)<br><span class="prc-rec">'+esc(l.record)+'</span></div>');
    });
    var none=cnt.NONE||0; leg.push('<div class="prc-rule">'+none+' race'+(none===1?'':'s')+' fit no lens: no play.</div></details>'); out.push(leg.join(''));
    d.races.forEach(function(r){
      var e=r.entry, xs=r.extras||[]; if(!e&&!xs.length) return;
      out.push('<div class="prc-race">'+esc(r.label)+' &middot; <span class="prc-lens">'+esc(r.lens_name)+'</span></div>');
      if(e) out.push('<div class="prc-horse"><span class="prc-hn">#'+esc(e.pgm)+' '+esc(e.horse)+'</span><span class="prc-ln">ML '+dash(e.ml_txt)+' &middot; VC line '+dash(e.vc_line)+' &middot; Contention '+dash(e.contention)+' &middot; VC #'+dash(e.vc_rank)+' &middot; TimeLines '+dash(e.tl_own10)+' of top 10</span>'
        +'<div class="prc-al"><b>'+esc(r.lens_name)+'</b> &mdash; '+esc(r.reason)+'. <i>Paper play only.</i></div></div>');
      xs.forEach(function(x){
        var pace=x.lens==='RPO'?'Master Pace #'+dash(x.mp_rank):(x.lens==='WRP'?'PP #'+dash(x.pp_rank):dash(x.n_traits)+' of 4 bomb traits');
        out.push('<div class="prc-horse prc-rpo"><span class="prc-tag">'+esc(x.tag)+'</span><span class="prc-hn">#'+esc(x.pgm)+' '+esc(x.horse)+'</span><span class="prc-ln">ML '+dash(x.ml_txt)+' &middot; VC line '+dash(x.vc_line)+' &middot; Contention '+dash(x.contention)+' &middot; VC #'+dash(x.vc_rank)+' &middot; '+pace+'</span>'
          +'<div class="prc-al"><b>'+esc(x.lens_name)+'</b> &mdash; '+esc(x.reason)+'. <i>Extra paper flag only.</i></div></div>');
      });
    });
    if(!fl&&!nx&&!ns) out.push('<div class="prc-rule">No paper pick on this card today.</div>');
    var empty=d.races.filter(function(r){ return !r.entry&&!(r.extras&&r.extras.length); });
    if(empty.length) out.push('<details class="prc-empty"><summary>'+empty.length+' race'+(empty.length===1?'':'s')+' with no pick (lens and reason)</summary>'
      +empty.map(function(r){ return '<div>'+esc(r.label)+' &mdash; <b>'+esc(r.lens_name)+'</b>: '+esc(r.reason||d.empty_race)+'</div>'; }).join('')+'</details>');
    out.push('</details>');
    return out.join('');
  }
  var api={info:info, html:html};
  root.PRC=api;
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
