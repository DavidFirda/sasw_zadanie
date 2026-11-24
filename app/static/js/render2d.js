
"use strict";

function partOpen(cat, label, bad, changed, extraCls=""){
  const cls=["part", bad?"bad":"", activeCat===cat?"active":"", changed?"enter":"", extraCls].filter(Boolean).join(" ");
  return `<g class="${cls}" data-cat="${cat}" tabindex="0" role="button" aria-label="${esc(KATMAP[cat].nazov)}: ${esc(label)}. Zmeniť">`;
}
function hit(x,y,w,h){ return `<rect class="hit" x="${x-3}" y="${y-3}" width="${w+6}" height="${h+6}" rx="6"/>`; }
function badge(x,y){ return `<g pointer-events="none"><circle cx="${x}" cy="${y}" r="9" fill="var(--bad)"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">!</text></g>`; }
function fan(cx,cy,r,col="var(--part-2)"){
  let s=`<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--part)" stroke="var(--metal-2)" stroke-width="1"/>`;
  for(let i=0;i<7;i++){ const a=i*2*Math.PI/7; const a2=a+.7; const r1=r*.28, r2=r*.92;
    s+=`<path d="M${(cx+r1*Math.cos(a)).toFixed(1)},${(cy+r1*Math.sin(a)).toFixed(1)} Q${(cx+r2*Math.cos(a+.15)).toFixed(1)},${(cy+r2*Math.sin(a+.15)).toFixed(1)} ${(cx+r2*Math.cos(a2)).toFixed(1)},${(cy+r2*Math.sin(a2)).toFixed(1)}" stroke="${col}" stroke-width="${Math.max(2,r*.16).toFixed(1)}" fill="none" stroke-linecap="round"/>`; }
  return s+`<circle cx="${cx}" cy="${cy}" r="${(r*.26).toFixed(1)}" fill="var(--case-2)" stroke="var(--metal-2)" stroke-width=".8"/>`;
}
function edgeFan(x,y,w,h){ // ventilátor z boku (hrana)
  const vert=h>w; let s=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="var(--part)" stroke="var(--metal-2)" stroke-width=".8"/>`;
  const n=vert?Math.floor(h/10):Math.floor(w/10);
  for(let i=1;i<n;i++) s+= vert?`<line x1="${x+2}" x2="${x+w-2}" y1="${y+i*10}" y2="${y+i*10}" stroke="var(--part-2)" stroke-width="1"/>`:`<line y1="${y+2}" y2="${y+h-2}" x1="${x+i*10}" x2="${x+i*10}" stroke="var(--part-2)" stroke-width="1"/>`;
  return s;
}

function casePal(id){ const w=C[id].farba==="biela"; return w?{shell:"#E3E6E5",shell2:"#C8CECB",inner:"#F3F5F4",slot:"#B9C0BD"}:{shell:"var(--case)",shell2:"var(--case-2)",inner:"var(--interior)",slot:"var(--case-2)"}; }
function drawCaseShell(id, ghost=false, hideFront=false){
  const L=LAYOUT[id]; const [bx,by,bw,bh]=L.body; const [ix,iy,iw,ih]=L.interior;
  if (ghost) return `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="8" fill="none" stroke="var(--muted)" stroke-dasharray="5 5" stroke-width="1" opacity=".55"/><text class="lbl" x="${bx+bw-8}" y="${by+bh-8}" text-anchor="end" opacity=".85">${esc(C[id].nazov)} pre porovnanie</text>`;
  const P=casePal(id); const st=L.style;
  let s="";
  for(const [fx,fw] of L.feet) s+=`<rect x="${fx}" y="${bh-2}" width="${fw}" height="${L.feetH+2}" rx="3" fill="${P.shell}" stroke="${P.shell2}"/>`;
  s+=`<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${st==="nr200p"?12:6}" fill="${P.shell}"/>`;
  s+=`<rect x="${ix}" y="${iy}" width="${iw}" height="${ih}" rx="4" fill="${P.inner}"/>`;
  const fx0=bw-L.frontT;
  if (st==="north"){ s+=`<rect x="${bw-24}" y="${by+4}" width="20" height="${bh-8}" rx="2" fill="var(--wood)"/>`; for(let x=bw-22;x<bw-5;x+=4) s+=`<line x1="${x}" x2="${x}" y1="${by+8}" y2="${bh-8}" stroke="var(--wood-2)" stroke-width="1.4"/>`; }
  if (st==="c4000d"){ s+=`<rect x="${fx0}" y="${by+2}" width="${L.frontT-2}" height="${bh-4}" rx="3" fill="${P.shell2}"/>`;
    for(let y=by+10;y<bh-10;y+=9) for(let x=fx0+4;x<bw-6;x+=8){ const o=((y/9)|0)%2?4:0; s+=`<path d="M${x+o} ${y} l3.2 5.5 h-6.4z" fill="${P.shell}"/>`; } }
  if (st==="h5"){ s+=`<rect x="${fx0}" y="${by+2}" width="${L.frontT-2}" height="${bh-4}" rx="3" fill="${P.shell2}"/>`; for(let y=by+8;y<bh-6;y+=5) for(let x=fx0+3;x<bw-3;x+=5) s+=`<circle cx="${x}" cy="${y}" r="1.1" fill="${P.shell}"/>`; }
  if (st==="o11"){ s+=`<rect x="${fx0}" y="${by+2}" width="${L.frontT}" height="${bh-4}" fill="rgba(150,200,215,.35)"/>`; s+=`<rect x="${ix}" y="${bh-58}" width="${iw}" height="10" fill="${P.shell2}" opacity=".7"/>`; }
  if (st==="nr200p"){ for(let x=18;x<bw-10;x+=9) s+=`<circle cx="${x}" cy="4.5" r="1.6" fill="${P.shell2}"/>`; for(let y=20;y<bh-10;y+=9) s+=`<circle cx="${bw-4.5}" cy="${y}" r="1.4" fill="${P.shell2}"/>`; }
  if (st!=="nr200p"){ for(let x=40;x<bw-60;x+=8) s+=`<rect x="${x}" y="4" width="4" height="6" rx="1" fill="${P.shell2}"/>`;
    for(let i=0;i<7;i++) s+=`<rect x="14" y="${196+i*20}" width="12" height="14" rx="1" fill="${P.slot}"/>`; }
  for (const f of L.fans){ if(hideFront && f[3]>f[2] && f[0]>L.W/2) continue; s+=edgeFan(...f); }
  return s;
}

function renderSVG(b){
  const k=C[b.skrinka]; const L=LAYOUT[b.skrinka]; const bad=new Set(); const chk=checks(b);
  chk.filter(x=>!x.ok).forEach(x=>x.cats.forEach(c=>bad.add(c)));
  const changed=new Set(); if(prevBuild) for(const kk of KAT){ if(JSON.stringify(prevBuild[kk.id])!==JSON.stringify(b[kk.id])) changed.add(kk.id); }
  const ox=0, oy=469-L.H; const other=byKat("skrinka").map(x=>x.id).find(id=>id!==b.skrinka&&LAYOUT[id]); const OL=other&&LAYOUT[other];
  let s=`<svg viewBox="-26 -40 504 540" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Náhľad zostavy v skrinke ${esc(k.nazov)}">
  <defs><linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".10"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>`;
  s+=`<line x1="-26" x2="478" y1="469" y2="469" stroke="var(--line)" stroke-width="1"/>`;
  s+=`<g transform="translate(${ox},${oy})">`;
  // skrinka
  s+=partOpen("skrinka",k.nazov,bad.has("skrinka"),changed.has("skrinka"))+drawCaseShell(b.skrinka,false,radFrontMounted(k,C[b.chladic]))+hit(...L.body)+`</g>`;
  s+=`<text class="lbl" x="0" y="-8">${esc(k.nazov)} · ${L.W} × ${L.H} mm</text>`;
  // zdroj (pod shroudom)
  const z=C[b.zdroj];
  if (z && L.psuBehind){ const [x,y,w,h]=L.psu[z.ff]||L.psu.ATX; const zb=bad.has("zdroj");
    s+=partOpen("zdroj",z.nazov,zb,changed.has("zdroj"))+`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="none" stroke="${zb?"var(--bad)":"var(--muted)"}" stroke-dasharray="5 4"/><text x="${x+w/2}" y="${y+h/2}" text-anchor="middle" class="lbl">${z.w} W · zdroj za doskou</text>`+hit(x,y,w,h)+(zb?badge(x+w,y):"")+`</g>`; }
  else if (z){ const p=L.psu[z.ff]||L.psu.ATX; const [x,y,w,h]=p; const zb=bad.has("zdroj");
    s+=partOpen("zdroj",z.nazov,zb,changed.has("zdroj"));
    if (z.ff!=="ATX" && L.psu.ATX && b.skrinka==="Fractal_North") s+=`<rect x="${L.psu.ATX[0]}" y="${L.psu.ATX[1]}" width="${L.psu.ATX[2]}" height="${L.psu.ATX[3]}" rx="3" fill="none" stroke="var(--metal-2)" stroke-dasharray="3 3"/>`;
    s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="var(--part)" stroke="${zb?"var(--bad)":"var(--metal-2)"}" stroke-width="1.2"/>`;
    for(let i=0;i<5;i++) s+=`<line x1="${x+w-38+i*7}" x2="${x+w-38+i*7}" y1="${y+8}" y2="${y+h-8}" stroke="var(--part-2)" stroke-width="2.5"/>`;
    s+=`<text x="${x+10}" y="${y+h/2+5}" font-size="14" font-weight="800" fill="var(--metal)">${z.w} W</text><text x="${x+10}" y="${y+h/2+18}" font-size="8.5" fill="var(--metal-2)">${esc(z.ff)} · ${esc(z.cert)}</text>`;
    s+=hit(x,y,w,h)+(zb?badge(x+w,y):"")+`</g>`;
  }
  if (L.shroud){ const [x,y,w,h]=L.shroud; s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="var(--case-2)" opacity=".42" pointer-events="none"/><line x1="${x}" x2="${x+w}" y1="${y}" y2="${y}" stroke="var(--metal-2)" stroke-width="1" pointer-events="none"/>`; }
  // SATA disky
  const hdd=(b.ulozisko||[]).map(i=>C[i]).filter(x=>x.typ==="HDD");
  if (hdd.length){ const x=hddX(L), y=L.hdd[1], w=147, h=26; s+=partOpen("ulozisko",hdd.map(x=>x.nazov).join(", "),bad.has("ulozisko"),changed.has("ulozisko"))+`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="var(--part-2)" stroke="var(--metal-2)"/><circle cx="${x+w*.62}" cy="${y+h/2}" r="${h*.32}" fill="var(--part)" stroke="var(--metal-2)"/><text x="${x+8}" y="${y+14}" font-size="9" font-weight="700" fill="var(--metal)">HDD 3,5"</text>`+hit(x,y,w,h)+`</g>`; }
  const sata=(b.ulozisko||[]).map(i=>C[i]).filter(x=>x.typ==="SATA");
  if (sata.length){ const [x,y,w,h]=L.sata; const ub=bad.has("ulozisko");
    s+=partOpen("ulozisko",sata.map(x=>x.nazov).join(", "),ub,changed.has("ulozisko"))+`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="var(--part-2)" stroke="var(--metal-2)"/><rect x="${x+6}" y="${y+6}" width="${w-12}" height="${h-12}" rx="2" fill="var(--part)"/><text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--metal)">SATA SSD</text>`+hit(x,y,w,h)+`</g>`; }
  // doska
  const d=C[b.doska]; const [bx0,by0]=L.board; let BD=null, slotY=L.board[1]+170;
  if (d){ BD=BOARD[d.ff]; const db=bad.has("doska"); slotY=by0+BD.slot;
    const pcb=d.tone!=="dark"?"var(--board-2)":"var(--board)"; const hs=d.tone==="silver"?"var(--metal)":d.tone==="white"?"#E6E9E8":"var(--part)";
    s+=partOpen("doska",d.nazov,db,changed.has("doska"));
    s+=`<rect x="${bx0}" y="${by0}" width="${BD.w}" height="${BD.h}" rx="3" fill="${pcb}"/>`;
    for(let i=1;i<6;i++) s+=`<path d="M${bx0+10} ${by0+BD.h*i/6} h${BD.w*0.3} l10 10 h${BD.w*0.25}" stroke="var(--copper)" stroke-opacity=".28" fill="none" stroke-width="1"/>`;
    for(const v of BD.vrm) s+=`<rect x="${bx0+v[0]}" y="${by0+v[1]}" width="${v[2]}" height="${v[3]}" rx="2" fill="${hs}"/>`;
    s+=`<rect x="${bx0+BD.io[0]}" y="${by0+BD.io[1]}" width="${BD.io[2]}" height="${BD.io[3]}" rx="2" fill="${hs}" opacity=".9"/>`;
    if (BD.chip) s+=`<rect x="${bx0+BD.chip[0]}" y="${by0+BD.chip[1]}" width="${BD.chip[2]}" height="${BD.chip[3]}" rx="3" fill="${hs}"/><text x="${bx0+BD.chip[0]+BD.chip[2]/2}" y="${by0+BD.chip[1]+BD.chip[3]/2+4}" text-anchor="middle" font-size="10" font-weight="700" fill="${d.tone!=="dark"?"var(--part)":"var(--metal)"}">${esc(d.cipset)}</text>`;
    const [scx,scy]=BD.socket; s+=`<rect x="${bx0+scx-BD.sock/2}" y="${by0+scy-BD.sock/2}" width="${BD.sock}" height="${BD.sock}" fill="var(--metal-2)" rx="2"/><text x="${bx0+scx}" y="${by0+scy+4}" text-anchor="middle" font-size="9" font-weight="700" fill="var(--part)">${esc(d.socket)}</text>`;
    for(const rx of BD.ram) s+=`<rect x="${bx0+rx}" y="${by0+BD.ramY[0]}" width="6" height="${BD.ramY[1]-BD.ramY[0]}" rx="1" fill="var(--board-2)" stroke="var(--metal-2)" stroke-width=".6"/>`;
    s+=`<rect x="${bx0+12}" y="${slotY-3}" width="${Math.min(160,BD.w-30)}" height="6" rx="1" fill="var(--part)" stroke="var(--metal-2)" stroke-width=".6"/>`;
    for(const y2 of BD.slots2) s+=`<rect x="${bx0+12}" y="${by0+y2}" width="150" height="5" rx="1" fill="var(--part)"/>`;
    const nv=(b.ulozisko||[]).map(i=>C[i]).filter(x=>x.typ==="NVMe").length;
    BD.m2.forEach((m,i)=>{ if(!m[2]) return; s+=`<rect x="${bx0+m[0]}" y="${by0+m[1]}" width="${m[2]}" height="${m[3]}" rx="2" fill="${i<nv?"var(--part-2)":"none"}" stroke="var(--metal-2)" stroke-dasharray="${i<nv?"none":"3 2"}" stroke-width=".8"/>`; });
    s+=`<text x="${bx0+BD.w-6}" y="${by0+BD.h-6}" text-anchor="end" font-size="8.5" fill="var(--metal)" opacity=".8">${esc(ffName(d.ff))}</text>`;
    s+=hit(bx0,by0,BD.w,BD.h)+(db?badge(bx0+BD.w,by0):"")+`</g>`;
    // NVMe ako samostatná klikateľná časť
    if (nv){ const m=BD.m2[0]; s+=partOpen("ulozisko","NVMe disk",bad.has("ulozisko"),changed.has("ulozisko"))+`<rect x="${bx0+m[0]}" y="${by0+m[1]}" width="${m[2]}" height="${m[3]}" rx="2" fill="var(--part-2)"/><text x="${bx0+m[0]+m[2]/2}" y="${by0+m[1]+m[3]-3.5}" text-anchor="middle" font-size="8" font-weight="700" fill="var(--metal)">M.2 NVMe${nv>1?" ×"+nv:""}</text>`+hit(bx0+m[0],by0+m[1],m[2],m[3])+`</g>`; }
    // RAM
    const r=C[b.pamat];
    if (r){ const rb=bad.has("pamat"); const lift=rb?-16:0;
      s+=partOpen("pamat",r.nazov,rb,changed.has("pamat"));
      let minx=1e9,maxx=0; BD.ramUse.slice(0,r.moduly).forEach(ix=>{ const x=bx0+BD.ram[ix]-1; minx=Math.min(minx,x); maxx=Math.max(maxx,x+8);
        s+=`<rect x="${x}" y="${by0+BD.ramY[0]-4+lift}" width="8" height="${BD.ramY[1]-BD.ramY[0]+4}" rx="1.5" fill="var(--part)" stroke="${rb?"var(--bad)":"var(--metal-2)"}" stroke-width="1"/><rect x="${x+1}" y="${by0+BD.ramY[0]-4+lift}" width="6" height="5" fill="${r.typ==="DDR5"?"var(--pcb)":"var(--copper)"}"/>`; });
      s+=`<text x="${maxx+4}" y="${by0+BD.ramY[0]+10+lift}" font-size="9" font-weight="700" fill="${rb?"var(--bad)":"var(--muted)"}">${esc(r.typ)}</text>`;
      s+=hit(minx,by0+BD.ramY[0]-4+lift,maxx-minx,BD.ramY[1]-BD.ramY[0]+4)+(rb?badge(maxx+2,by0+BD.ramY[0]-6+lift):"")+`</g>`; }
    // chladič + procesor
    const ch=C[b.chladic], c=C[b.procesor]; const cx=bx0+scx, cy=by0+scy;
    if (ch){ const cb=bad.has("chladic")||bad.has("procesor");
      s+=partOpen("chladic",ch.nazov,cb,changed.has("chladic")||changed.has("procesor"));
      if (ch.druh==="aio"){ const loc=radiatorMount(k,ch.radiator)||Object.keys(L.rad)[0]; const [rx,ry,dir]=L.rad[loc]||[64,16,"h"]; const rl=ch.radiator+38; const rb=bad.has("chladic");
        const n=ch.radiator/120|0; const bodyB=L.body[3]; let R;
        if(dir==="s"){ R=[rx,ry,rl,120]; s+=`<rect x="${R[0]}" y="${R[1]}" width="${R[2]}" height="${R[3]}" rx="6" fill="var(--part)" opacity=".55" stroke="${rb?"var(--bad)":"var(--metal-2)"}"/>`; for(let i=0;i<n;i++) s+=`<g opacity=".7">${fan(R[0]+19+60+i*120,R[1]+60,56)}</g>`; s+=`<text x="${R[0]+8}" y="${R[1]+14}" class="lbl">radiátor na bočnici</text>`; }
        else { R= dir==="h" ? [rx,ry,rl,52] : dir==="b" ? [rx,bodyB-60,rl,52] : [rx,ry,52,rl];
          s+=`<rect x="${R[0]}" y="${R[1]}" width="${R[2]}" height="${R[3]}" rx="4" fill="var(--part)" stroke="${rb?"var(--bad)":"var(--metal-2)"}"/>`;
          for(let i=0;i<n;i++){ s+= dir==="h" ? edgeFan(R[0]+19+i*120,R[1]+27,120,24) : dir==="b" ? edgeFan(R[0]+19+i*120,R[1],120,24) : edgeFan(R[0],R[1]+19+i*120,24,120); } }
        const ex= dir==="v"? R[0]+10 : R[0]+R[2]-10, ey = dir==="v"? R[1]+R[3]-10 : dir==="s" ? R[1]+R[3]-10 : R[1]+26;
        s+=`<path d="M${cx-10} ${cy-20} C ${cx-10} ${cy-90}, ${ex-40} ${ey+40}, ${ex} ${ey}" stroke="var(--part)" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M${cx+10} ${cy-20} C ${cx+10} ${cy-80}, ${ex-20} ${ey+60}, ${ex-14} ${ey+4}" stroke="var(--part-2)" stroke-width="9" fill="none" stroke-linecap="round"/>`;
        s+=`<circle cx="${cx}" cy="${cy}" r="32" fill="var(--part)" stroke="var(--metal-2)"/><circle cx="${cx}" cy="${cy}" r="22" fill="none" stroke="var(--pcb)" stroke-width="3"/><text x="${cx}" y="${cy-40}" text-anchor="middle" class="dim">AIO ${ch.radiator} mm · ${MOUNT_SK[loc]||""}</text>`;
        s+=hit(cx-32,cy-32,64,64)+(cb?badge(cx+32,cy-32):"");
      } else if (ch.druh==="vezovy"){ const w=(ch.sirka||146),h=150,x=cx-w/2,y=cy-h/2; const tw=(w-50)/2;
        s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="var(--metal)" opacity=".96"/>`;
        [[x+2,tw],[x+tw+27,tw]].forEach(([tx,tw2])=>{ for(let yy=y+6;yy<y+h-4;yy+=5) s+=`<line x1="${tx}" x2="${tx+tw2}" y1="${yy}" y2="${yy}" stroke="var(--metal-2)" stroke-width="1"/>`; });
        s+=edgeFan(x+tw+2,y-4,24,h+8)+edgeFan(x+w-24,y-4,24,h+8);
        s+=`<text x="${x+w/2}" y="${y-10}" text-anchor="middle" class="${bad.has("chladic")&&ch.vyska>k.maxChladic?"dim dim-bad":"dim"}">výška ${ch.vyska} / max ${k.maxChladic} mm</text>`;
        s+=hit(x,y-4,w,h+8)+(cb?badge(x+w,y):"");
      } else { const w=96,x=cx-w/2,y=cy-w/2;
        s+=`<rect x="${x}" y="${y}" width="${w}" height="${w}" rx="6" fill="var(--metal)"/>`+fan(cx,cy,44)+`<text x="${cx}" y="${y-8}" text-anchor="middle" class="dim">výška ${ch.vyska} mm${ch.maxTdp?` · do ${ch.maxTdp} W`:""}</text>`;
        s+=hit(x,y,w,w)+(cb?badge(x+w,y):""); }
      s+=`</g>`;
      if (c){ const half=ch.druh==="vezovy"?(ch.sirka||146)/2:ch.druh==="aio"?32:48; const tx=cx-half+4, ty=cy-(ch.druh==="vezovy"?75:ch.druh==="aio"?-36:48)+4;
        s+=partOpen("procesor",c.nazov,bad.has("procesor"),changed.has("procesor"))+`<rect x="${tx}" y="${ty}" width="74" height="17" rx="4" fill="var(--surface)" stroke="${bad.has("procesor")?"var(--bad)":"var(--line)"}"/><text x="${tx+37}" y="${ty+12}" text-anchor="middle" font-size="9.5" font-weight="700" fill="var(--ink)">${esc(c.socket)} CPU</text>`+hit(tx,ty,74,17)+`</g>`; }
    }
  }
  // grafika
  const g=b.grafika?C[b.grafika]:null;
  if (g){ const gb=bad.has("grafika"); const x0=L.bracketX, y0=slotY+4, len=g.dlzka, th=g.sloty*27; const tooLong=g.dlzka>k.maxGpu;
    s+=partOpen("grafika",g.nazov,gb,changed.has("grafika"));
    s+=`<rect x="${x0-6}" y="${y0-4}" width="6" height="${th+8}" fill="var(--metal)"/>`;
    s+=`<rect x="${x0}" y="${y0}" width="${len}" height="${th}" rx="5" fill="var(--part)" stroke="${tooLong?"var(--bad)":"var(--metal-2)"}" stroke-width="${tooLong?2:1}"/>`;
    if (g.vyrobca==="NVIDIA") s+=`<rect x="${x0+2}" y="${y0+2}" width="${len-4}" height="5" rx="2" fill="var(--metal)"/>`;
    const n=g.fans; const pos=n===3?[.2,.5,.8]:[.27,.73]; const r=Math.min(th*.42,len/(n*2.35));
    pos.forEach(p=>s+=fan(x0+len*p,y0+th/2+2,r));
    s+=`<text x="${x0+8}" y="${y0+th-6}" font-size="10" font-weight="800" fill="var(--metal)">${esc(shortName(g))}</text>`;
    // kóty
    const dy=y0+th+14; const lim=x0+k.maxGpu;
    s+=`<g pointer-events="none"><path class="dim-line${tooLong?" bad":""}" d="M${x0} ${dy-4} v8 M${x0} ${dy} H${x0+len} M${x0+len} ${dy-4} v8"/><text class="dim${tooLong?" dim-bad":""}" x="${x0+len/2}" y="${dy+13}" text-anchor="middle">grafika ${g.dlzka} mm</text>`;
    s+=`<line class="dim-line${tooLong?" bad":""}" x1="${lim}" x2="${lim}" y1="${y0-14}" y2="${dy+6}" stroke-dasharray="4 3"/><text class="dim${tooLong?" dim-bad":""}" x="${lim-4}" y="${y0-18}" text-anchor="end">limit ${k.maxGpu} mm</text></g>`;
    s+=hit(x0-6,y0-4,len+6,th+8)+(gb?badge(x0+len,y0):"")+`</g>`;
  } else if (d) {
    s+=partOpen("grafika","žiadna",false,false)+`<rect x="${L.bracketX}" y="${slotY+4}" width="200" height="40" rx="5" fill="none" stroke="var(--muted)" stroke-dasharray="5 4"/><text x="${L.bracketX+100}" y="${slotY+28}" text-anchor="middle" class="lbl">bez grafiky, obraz cez iGPU</text>`+hit(L.bracketX,slotY+4,200,40)+`</g>`;
  }
  s+=`<rect x="${L.interior[0]}" y="${L.interior[1]}" width="${L.interior[2]}" height="${L.interior[3]}" fill="url(#glass)" pointer-events="none"/>`;
  s+=`</g>`+(other?`<g class="ghost" transform="translate(0,${469-OL.H})" pointer-events="none">${drawCaseShell(other,true)}</g>`:"")+`</svg>`;
  prevBuild=structuredClone(b);
  return s;
}

function renderGauges(b){
  const {k,g,z,ch}=comps(b); const est=powerEst(b); const out=[];
  const G=(title,val,pct,isBad,note)=>`<div class="merac"><div class="m-h"><span>${title}</span><span class="m-v">${val}</span></div><div class="bar${isBad?" bad":""}"><i style="width:${Math.max(3,Math.min(100,pct)).toFixed(0)}%"></i></div><small>${note}</small></div>`;
  if (g&&k) out.push(G("Dĺžka grafiky",`${g.dlzka} / ${k.maxGpu} mm`,g.dlzka/k.maxGpu*100,g.dlzka>k.maxGpu,g.dlzka>k.maxGpu?`o ${g.dlzka-k.maxGpu} mm dlhšia`:`rezerva ${k.maxGpu-g.dlzka} mm`));
  if (ch&&k&&ch.druh==="aio"){ const loc=radiatorMount(k,ch.radiator); out.push(G("Radiátor",`${ch.radiator} mm`,loc?100:100,!loc,loc?`montáž ${MOUNT_SK[loc]}`:`skrinka berie ${radiatorList(k)}`)); }
  else if (ch&&k) out.push(G("Výška chladiča",`${ch.vyska} / ${k.maxChladic} mm`,ch.vyska/k.maxChladic*100,ch.vyska>k.maxChladic,ch.vyska>k.maxChladic?`o ${ch.vyska-k.maxChladic} mm vyšší`:`rezerva ${k.maxChladic-ch.vyska} mm`));
  if (z&&g) out.push(G("Zdroj",`${z.w} / ${g.odpZdroj} W`,g.odpZdroj/z.w*100,z.w<g.odpZdroj,z.w<g.odpZdroj?`chýba ${g.odpZdroj-z.w} W`:`výrobca grafiky odporúča ${g.odpZdroj} W`));
  if (z) out.push(G("Odhad spotreby",`${est} W`,est/z.w*100,est>z.w,`procesor + grafika + 75 W, zdroj ${z.w} W`));
  return out.join("");
}

