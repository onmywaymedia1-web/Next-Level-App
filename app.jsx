// App from Canvas: Ultra Lite + Energy + Per-Dot States
const {useEffect,useMemo,useState} = React;

// ---- tiny style helpers ----
const cx=(...a)=>a.filter(Boolean).join(' ');
const Btn=({kind="primary",className="",...p})=> <button className={cx("inline-flex items-center gap-2 px-3 py-2 rounded-2xl border text-sm select-none", kind==="primary"?"bg-emerald-600/80 border-emerald-500/50 hover:bg-emerald-600":"bg-neutral-800 border-neutral-700 hover:bg-neutral-700", className)} {...p}/>;
const Card=({className="",...p})=> <section className={cx("rounded-2xl border border-neutral-800 bg-neutral-900/60",className)} {...p}/>;
const H=(p)=> <h3 className="text-lg font-semibold" {...p}/>;
const Input=(p)=>
  <input
    className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 text-white placeholder-gray-400"
    {...p}
  />;
const Textarea=(p)=> <textarea className="w-full rounded-xl bg-neutral-900 border border-neutral-800 px-3 py-2 min-h-[84px]" {...p}/>;
const Sep=()=> <div className="h-px w-full bg-neutral-800 my-2"/>;
const Progress=({v=0})=> <div className="w-full h-2 rounded-full bg-neutral-800 overflow-hidden"><div className="h-full bg-emerald-500" style={{width:`${Math.min(100,Math.max(0,v))}%`}}/></div>;

// time helpers
function toISODate(d){ return d.toISOString().slice(0,10); }
function weekStartMonday(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); const wd=(x.getDay()+6)%7; x.setDate(x.getDate()-wd); return x; }
function weekEndSunday(d=new Date()){ const s=weekStartMonday(d); const e=new Date(s); e.setDate(s.getDate()+6); e.setHours(23,59,59,999); return e; }
function buildWeekId(d=new Date()){ const s=toISODate(weekStartMonday(d)); const e=toISODate(weekEndSunday(d)); return `${s}_${e}`; }
function rangeText(d=new Date()){ const s=weekStartMonday(d); const e=weekEndSunday(d); const fmt=(dt)=> dt.toLocaleDateString(undefined,{month:'short',day:'numeric'}); return `${fmt(s)} – ${fmt(e)}`; }

// data
const STORAGE_KEY='nextlevel.ultra.v3'; const STORE_VERSION=3;
const DEFAULT_MISSIONS=[
  { id: rid(), name:"No Weed/Alcohol/Drugs", weight:7, active:true, hiddenOnShare:false, polarity:'neg' },
  { id: rid(), name:"No BN/Casual Sex",   weight:7, active:true, hiddenOnShare:false, polarity:'neg' },
  { id: rid(), name:"Workout",               weight:5, active:true, hiddenOnShare:false, polarity:'pos' },
  { id: rid(), name:"Clean Diet",            weight:5, active:true, hiddenOnShare:false, polarity:'pos' },
  { id: rid(), name:"Sleep / Wake on Time",  weight:4, active:true, hiddenOnShare:false, polarity:'pos' },
  { id: rid(), name:"Meditation",            weight:3, active:true, hiddenOnShare:false, polarity:'pos' },
  { id: rid(), name:"Journaling",            weight:2, active:true, hiddenOnShare:false, polarity:'pos' },
  { id: rid(), name:"Clean Environment",     weight:3, active:true, hiddenOnShare:false, polarity:'pos' },
];
function rid(){ return 'm_'+Math.random().toString(36).slice(2,9); }
const deep=(x)=> JSON.parse(JSON.stringify(x));
const dayPossible=(tpl)=> tpl.filter(m=>m.active).reduce((a,m)=>a+m.weight,0);
const dotScore=(x)=> x===1?1 : x===0.5?0.5 : 0;
const computeDayEarned=(d)=> {
  let total = 0;
  for (const v of Object.values(d.pointsByMission||{})){
    if (Array.isArray(v)) total += v.reduce((a,x)=>a+dotScore(x),0);
    else total += (v||0);
  }
  return total + (d.earnedBonus||0) + (d.streakApplied||0);
};
const clamp01=(x)=> Math.max(0, Math.min(1, x));
const isPos=(m)=> m.polarity!=='neg';
function ensurePolarity(m){ if(!('polarity' in m)){ const name=(m.name||'').toLowerCase(); const negHints=['no weed','no alcohol','no drugs','no porn','casual sex','weed','alcohol']; m.polarity = negHints.some(h=> name.includes(h)) ? 'neg' : 'pos'; } return m; }
function energyForDay(week, dayEntry){
  const tpl=week.templateSnapshot.map(ensurePolarity);
  const posIds=tpl.filter(m=>m.active && isPos(m)).map(m=>m.id);
  const negIds=tpl.filter(m=>m.active && !isPos(m)).map(m=>m.id);
  const sumFor=(ids)=> ids.reduce((a,id)=>{
    const v = dayEntry.pointsByMission[id];
    const pts = Array.isArray(v)? v.reduce((aa,x)=>aa+dotScore(x),0) : (v||0);
    return a + pts;
  }, 0);
  const maxFor=(ids)=> ids.reduce((a,id)=>{ const m=tpl.find(mm=>mm.id===id); return a + (m?m.weight:0); },0);
  const posEarn=sumFor(posIds), posPoss=maxFor(posIds);
  const negEarn=sumFor(negIds), negPoss=maxFor(negIds);
  const posR= posPoss? posEarn/posPoss : 0;
  const negPenalty = negPoss? (1 - (negEarn/negPoss)) : 0;
  const energy = clamp01((posR - negPenalty + 1)/2);
  return { energyPct: Math.round(energy*100), posPct: Math.round(posR*100), negPenaltyPct: Math.round(negPenalty*100) };
}
function energyForWeek(week){ if(!week?.dayEntries?.length) return {avg:0}; const vals=week.dayEntries.map(d=> energyForDay(week,d).energyPct); const avg = Math.round(vals.reduce((a,n)=>a+n,0)/vals.length); return {avg}; }

function newWeekFromTemplate(template, d=new Date()){
  const s=weekStartMonday(d);
  const days=[...Array(7)].map((_,i)=>{ const t=new Date(s); t.setDate(s.getDate()+i);
    const entries = Object.fromEntries(template.map(m=>[m.id, Array.from({length:m.weight}).fill(0)]));
    return {dateISO: toISODate(t), pointsByMission: entries};
  });
  return {weekId: buildWeekId(d), startISO: weekStartMonday(d).toISOString(), endISO: weekEndSunday(d).toISOString(), dayEntries:days, templateSnapshot:deep(template), totals:{earned:0, possible: dayPossible(template)*7, pct:0, badge:undefined, bestDayISO:undefined, mulliganUsed:false, streakDays:0}};
}
function computeWeekTotals(week){ const maxPerDay=dayPossible(week.templateSnapshot); let bestISO='', best=-1, earned=0, possible=0; for(const d of week.dayEntries){ const e=computeDayEarned(d); earned+=e; possible+=maxPerDay; if(e>best){best=e; bestISO=d.dateISO;} } const pct=possible? (earned/possible)*100:0; return {earned:Math.round(earned), possible, pct, bestDayISO:bestISO}; }
const badgeForPct=(p)=> p>=90? 'Platinum' : p>=80? 'Gold' : p>=70? 'Silver' : p>=60? 'Bronze' : undefined;
function applyBonusesAndMulligan(week){ const maxPerDay=dayPossible(week.templateSnapshot); const pctFor=(d)=> maxPerDay? (computeDayEarned({...d,streakApplied:0})/maxPerDay)*100:0; let cur=0; for(const d of week.dayEntries){ if(pctFor(d)>=80){ cur++; if(cur>=3){ const mult=Math.min(1.1+0.05*(cur-3),1.3); const base=Object.values(d.pointsByMission).reduce((a,v)=>a+(Array.isArray(v)?v.reduce((aa,x)=>aa+dotScore(x),0):(v||0)),0); d.streakApplied=Math.round(base*(mult-1)); } } else cur=0; } let low=Infinity, idx=0; week.dayEntries.forEach((d,i)=>{ const e=computeDayEarned(d); if(e<low){low=e; idx=i;} }); const sixty=Math.round(maxPerDay*0.6); const dd=week.dayEntries[idx]; if(computeDayEarned(dd)<sixty){ const delta=sixty-computeDayEarned(dd); dd.mulligan=true; dd.earnedBonus=(dd.earnedBonus||0)+delta; week.totals.mulliganUsed=true; } const totals=computeWeekTotals(week); week.totals={...week.totals, ...totals, badge: badgeForPct(totals.pct)}; }

function toDots(v, weight){ if (Array.isArray(v)) return v.slice(0,weight).concat(Array(Math.max(0, weight-(v.length||0))).fill(0)); const filled = Math.max(0, Math.min(weight, Number(v)||0)); return Array.from({length:weight}, (_,i)=> i<filled?1:0); }
function load(){
  const defaults = () => {
    const missions = deep(DEFAULT_MISSIONS);
    return {
      version: STORE_VERSION,
      missions,
      currentWeek: newWeekFromTemplate(missions, new Date()),
      history: [],
      settings: { displayName:'Player One', avatarUrl:'', incomeEnabled:false }
    };
  };
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaults();

    let s = JSON.parse(raw);

    if(!s.version) s.version=1;
    if(Array.isArray(s.missions)) s.missions=s.missions.map(ensurePolarity);
    if(s.currentWeek?.templateSnapshot) s.currentWeek.templateSnapshot=s.currentWeek.templateSnapshot.map(ensurePolarity);

    for(const day of s.currentWeek?.dayEntries||[]){
      for(const m of s.currentWeek.templateSnapshot){
        const v = day.pointsByMission?.[m.id];
        day.pointsByMission[m.id]= toDots(v, m.weight);
      }
    }
    for(const w of s.history||[]){
      for(const day of w.dayEntries||[]){
        for(const m of w.templateSnapshot||[]){
          const v = day.pointsByMission?.[m.id];
          day.pointsByMission[m.id]= toDots(v, m.weight);
        }
      }
    }
    return s;
  }catch(e){
    console.warn('load() failed; using defaults', e);
    return defaults();
  }
}

function App(){
  const [store,setStore]=useState(load());
  const [tab,setTab]=useState('dash');
  const [sel,setSel]=useState(store.missions[0]?.id||'');
  const [reportNotes,setReportNotes]=useState({wins:'',losses:'',lessons:''});
  const todayISO=new Date().toISOString().slice(0,10);
  const currentEntry=store.currentWeek.dayEntries.find(d=>d.dateISO===todayISO)||store.currentWeek.dayEntries[0];
  const possibleToday=dayPossible(store.currentWeek.templateSnapshot);
  const earnedToday=computeDayEarned(currentEntry);
  const needsFinalize = store.currentWeek.weekId!==buildWeekId(new Date());

  useEffect(()=>save(store),[store]);
  const totals=useMemo(()=> computeWeekTotals(store.currentWeek),[store.currentWeek]);
  useEffect(()=>{ setStore(s=>({...s, currentWeek:{...s.currentWeek, totals:{...s.currentWeek.totals, ...totals}}})); },[totals.earned,totals.possible,totals.pct]);

  function cycleDot(missionId, dotIdx){ setStore(s=>{ const w=deep(s.currentWeek); const i=w.dayEntries.findIndex(d=>d.dateISO===todayISO); if(i<0) return s; const m=w.templateSnapshot.find(x=>x.id===missionId); if(!m) return s; const arr = toDots(w.dayEntries[i].pointsByMission[missionId], m.weight); const cur = arr[dotIdx] ?? 0; let next=0; if(cur===0) next=1; else if(cur===1) next=-1; else if(cur===-1) next=0.5; else next=0; arr[dotIdx]=next; w.dayEntries[i].pointsByMission[missionId]=arr; return {...s, currentWeek:w}; }); }
  function finalize(){ setStore(s=>{ const archived=deep(s.currentWeek); applyBonusesAndMulligan(archived); const nw=newWeekFromTemplate(s.missions,new Date()); return {...s, history:[archived,...s.history].slice(0,104), currentWeek:nw}; }); setTab('report'); }
  function exportCaption(){ const w=store.history[0]||store.currentWeek; const fmt=(iso)=> new Date(iso).toLocaleDateString(undefined,{month:'short',day:'numeric'}); const pct=(w.totals?.pct||0).toFixed(1); const cap=`Next Level — Week ${fmt(w.startISO)}–${fmt(w.endISO)}\nScore: ${Math.round(w.totals.earned)}/${Math.round(w.totals.possible)} (${pct}%)  Badge: ${w.totals.badge||'—'}\nWins: ${reportNotes.wins||'-'}\nL's: ${reportNotes.losses||'-'}\nLessons: ${reportNotes.lessons||'-'}`; navigator.clipboard.writeText(cap); }
  function addMission(){
  setStore(s=>{
    const m = { id: rid(), name:'New Mission', weight:1, active:true, hiddenOnShare:false, polarity:'pos' };

    // 1) add to master template
    const missions = [...s.missions, m];

    // 2) also add to current week’s template + all days
    const w = deep(s.currentWeek);
    w.templateSnapshot = [...w.templateSnapshot, m];
    for(const d of w.dayEntries){
      d.pointsByMission[m.id] = Array.from({length:m.weight}).fill(0);
    }

    return {...s, missions, currentWeek: w};
  });
}
}
  function updateMission(i,patch){ setStore(s=>{ const ms=deep(s.missions); ms[i]={...ms[i],...patch}; const snap=s.currentWeek.templateSnapshot.findIndex(m=>m.id===ms[i].id); if(snap>=0){ s.currentWeek.templateSnapshot[snap]={...ms[i]}; for(const day of s.currentWeek.dayEntries){ day.pointsByMission[ms[i].id] = toDots(day.pointsByMission[ms[i].id], ms[i].weight); } } return {...s, missions:ms, currentWeek:{...s.currentWeek}}; }); }
  function removeMission(id){ setStore(s=> ({...s, missions: s.missions.filter(m=>m.id!==id)})); }
  function sample(){ const templ=deep(store.missions); const weeks=[]; let dt=new Date(); dt.setDate(dt.getDate()-7*8); for(let w=0; w<8; w++){ const wk=newWeekFromTemplate(templ, dt); wk.dayEntries.forEach(d=>{ for(const m of wk.templateSnapshot){ const arr = Array.from({length:m.weight}).fill(0).map(()=>{ const r=Math.random(); return r<0.1?-1 : r<0.2?0.5 : r<0.6?1 : 0; }); d.pointsByMission[m.id]=arr; } if(Math.random()<0.1){ d.earnedBonus=(d.earnedBonus||0)+5; } }); applyBonusesAndMulligan(wk); weeks.push(wk); dt=new Date(dt.getTime()+7*86400000); } setStore(s=>({...s, history: weeks.reverse().concat(s.history)})); }
  function resetAll(){ if(confirm('Erase all data?')){ localStorage.removeItem(STORAGE_KEY); location.reload(); } }

  const energyToday = energyForDay(store.currentWeek, currentEntry);
  const energyWeekAvg = energyForWeek(store.currentWeek).avg;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-4 md:p-6">
      <header className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-400/40 to-cyan-500/30 grid place-items-center">⚡️</div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Next Level — Weekly Missions</h1>
            <p className="text-xs md:text-sm opacity-70">{rangeText(new Date())} · {store.settings?.displayName||'Player One'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Btn kind="secondary" onClick={()=>setTab('template')}>Template</Btn>
          <Btn kind="secondary" onClick={()=>setTab('dash')}>Dashboard</Btn>
        </div>
      </header>

      {needsFinalize && (
        <div className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-3 text-yellow-200 flex items-center justify-between">
          <div>New week detected. Finalize last week to generate your report.</div>
          <Btn onClick={finalize}>Finalize Week</Btn>
        </div>
      )}

      {tab==='dash' && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between"><H>Today</H><div className="text-sm opacity-70">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'})}</div></div>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between"><div className="text-sm opacity-80">Week Score</div><div className="font-semibold">{Math.round(store.currentWeek.totals.earned)}/{Math.round(store.currentWeek.totals.possible)} · {store.currentWeek.totals.pct.toFixed(1)}%</div></div>
              <Progress v={store.currentWeek.totals.pct}/>
              <div className="mt-4 space-y-3">
                {store.currentWeek.templateSnapshot.filter(m=>m.active).map(m=>{ const dots = toDots(currentEntry.pointsByMission[m.id], m.weight); const earned = dots.reduce((a,x)=> a + dotScore(x), 0); const selected=sel===m.id; return (
                  <div key={m.id} onClick={()=>setSel(m.id)} className={cx("rounded-xl p-3 border", selected? 'border-emerald-400/40 bg-emerald-400/5':'border-neutral-800 bg-neutral-900/50')}>
                    <div className="flex items-center justify-between mb-2"><div className="font-medium">{m.name} <span className="text-xs opacity-60">(max {m.weight})</span> <span className={cx('ml-2 text-[10px] uppercase px-2 py-0.5 rounded-lg border', m.polarity==='neg'? 'border-red-500/40 text-red-300':'border-emerald-500/40 text-emerald-300')}>{m.polarity==='neg'? 'Negative':'Positive'}</span></div><div className="text-sm opacity-70">{earned}/{m.weight}</div></div>
                    <div className="flex items-center gap-2 flex-wrap">{dots.map((v,idx)=>{ const base = "relative h-7 w-7 rounded-full border focus:outline-none focus:ring-2 focus:ring-emerald-500 grid place-items-center"; let classes = "bg-neutral-800 border-neutral-700"; let style = {}; let mark = null; if (v===1){ classes = "bg-emerald-500/90 border-emerald-300/60"; } else if (v===-1){ classes = "bg-red-600/90 border-red-300/60"; mark = <span className="text-[12px] leading-none">×</span>; } else if (v===0.5){ classes = "border-emerald-300/40"; style = { background: "linear-gradient(90deg, rgb(16 185 129 / 0.9) 50%, rgb(38 38 38) 50%)" }; } return <button key={idx} onClick={()=>cycleDot(m.id, idx)} className={cx(base, classes)} style={style}>{mark}</button>; })}</div>
                  </div>
                );})}
              </div>
              <div className="mt-4 flex items-center justify-between"><div className="text-sm opacity-80">Today: {earnedToday}/{possibleToday}</div><div className="flex gap-2"><Btn kind="secondary" onClick={()=>{ const t=prompt('Quick day note:', currentEntry.note||''); if(t!==null){ setStore(s=>{ const w=deep(s.currentWeek); const i=w.dayEntries.findIndex(d=>d.dateISO===currentEntry.dateISO); w.dayEntries[i]={...w.dayEntries[i], note:t}; return {...s,currentWeek:w}; }); } }}>Add Note</Btn><Btn onClick={finalize}>Finalize Week Now</Btn></div></div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <div className="p-4 border-b border-neutral-800 flex items-center justify-between"><H>Energy</H><span className="text-xs opacity-70">avg {energyWeekAvg}%</span></div>
              <div className="p-4 text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-28 rounded-full bg-neutral-800 overflow-hidden">
                    <div className="w-full bg-emerald-500 h-full origin-bottom" style={{transform:`scaleY(${energyToday.energyPct/100})`}}/>
                  </div>
                  <div className="text-xs space-y-1">
                    <div>Energy Today: <span className="font-semibold">{energyToday.energyPct}%</span></div>
                    <div className="opacity-80">Pos cores: {energyToday.posPct}%</div>
                    <div className="opacity-80">Neg drain: {energyToday.negPenaltyPct}%</div>
                    <div className="opacity-70">How it works: negatives reduce energy when missed.</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-neutral-800"><H>This Week</H></div>
              <div className="p-4 text-sm">
                <div className="flex items-center justify-between"><div>Best Day</div><div className="opacity-80">{store.currentWeek.totals.bestDayISO||'–'}</div></div>
                <Sep/>
                <div className="text-xs opacity-70">Tip: Tap bubbles to add points. Screenshot report in the Report tab.</div>
              </div>
            </Card>

            <Card>
              <div className="p-4 border-b border-neutral-800"><H>Maintenance</H></div>
              <div className="p-4 space-y-2">
                <Btn kind="secondary" className="w-full" onClick={sample}>Generate Sample Data</Btn>
                <Btn kind="secondary" className="w-full" onClick={resetAll}>Reset All</Btn>
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab==='report' && (
        <div className="grid md:grid-cols-3 gap-4">
          <Card className="md:col-span-2">
            <div className="p-4 border-b border-neutral-800"><H>Weekly Report</H></div>
            <div className="p-4">
              <div className="flex items-center gap-3 mb-2">
                {store.settings?.avatarUrl? <img src={store.settings.avatarUrl} alt="avatar" className="h-10 w-10 rounded-xl object-cover"/> : <div className="h-10 w-10 rounded-xl bg-emerald-500/20 grid place-items-center">NL</div>}
                <div>
                  <div className="font-semibold">{store.settings?.displayName||'Player One'}</div>
                  <div className="text-xs opacity-70">{rangeText(new Date(store.currentWeek.startISO))}</div>
                </div>
                <div className="ml-auto text-xs px-2 py-1 rounded-lg border border-neutral-700">{store.currentWeek.totals.badge||'—'}</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <Stat label="Points" val={`${Math.round(store.currentWeek.totals.earned)}/${Math.round(store.currentWeek.totals.possible)}`}/>
                <Stat label="Completion" val={`${store.currentWeek.totals.pct.toFixed(1)}%`}/>
                <Stat label="Best Day" val={store.currentWeek.totals.bestDayISO||'–'}/>
              </div>
              <Sep/>
              <div className="space-y-2">
                <div className="text-sm opacity-80">Mission Summary</div>
                {store.currentWeek.templateSnapshot.filter(m=>m.active && !m.hiddenOnShare).map(m=>{ const max=m.weight*7; const earned=store.currentWeek.dayEntries.reduce((a,d)=>{ const arr = toDots(d.pointsByMission[m.id], m.weight); return a + arr.reduce((aa,x)=>aa+dotScore(x),0); },0); return (
                  <div key={m.id} className="flex items-center gap-2">
                    <div className="w-48 truncate">{m.name}</div>
                    <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{width:`${(earned/max)*100}%`}}/></div>
                    <div className="w-24 text-right text-xs opacity-70">{earned}/{max}</div>
                  </div>
                );})}
              </div>
              <Sep/>
              <div className="grid md:grid-cols-3 gap-3">
                <div><div className="text-xs uppercase opacity-70">Wins</div><Textarea value={reportNotes.wins} onChange={e=>setReportNotes({...reportNotes,wins:e.target.value})} placeholder="What went well?"/></div>
                <div><div className="text-xs uppercase opacity-70">L's</div><Textarea value={reportNotes.losses} onChange={e=>setReportNotes({...reportNotes,losses:e.target.value})} placeholder="What didn't?"/></div>
                <div><div className="text-xs uppercase opacity-70">Lessons</div><Textarea value={reportNotes.lessons} onChange={e=>setReportNotes({...reportNotes,lessons:e.target.value})} placeholder="What will you change?"/></div>
              </div>
              <div className="mt-3 flex gap-2"><Btn onClick={exportCaption}>Copy Caption</Btn><Btn kind="secondary" onClick={()=> alert('Tip: use your device screenshot to share the card')}>How to Share</Btn></div>
            </div>
          </Card>
          <Card>
            <div className="p-4 border-b border-neutral-800"><H>About Sharing</H></div>
            <div className="p-4 text-sm opacity-80 space-y-2"><p>Use the caption + a screenshot of this card to post in Skool. Hide specific missions in Template.</p><p>Pro tip: add 1–2 photos of you training/working in your post for more engagement.</p></div>
          </Card>
        </div>
      )}

      {tab==='template' && (
        <Card>
          <div className="p-4 border-b border-neutral-800"><H>Template & Settings</H></div>
          <div className="p-4 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs uppercase opacity-70">Display Name</div>
                <Input value={store.settings?.displayName||''} onChange={e=> setStore(s=>({...s, settings:{...s.settings, displayName:e.target.value}}))}/>
              </div>
              <div>
                <div className="text-xs uppercase opacity-70">Avatar URL</div>
                <Input value={store.settings?.avatarUrl||''} onChange={e=> setStore(s=>({...s, settings:{...s.settings, avatarUrl:e.target.value}}))}/>
              </div>
            </div>
            {store.missions.map((m,i)=> (
              <div key={m.id} className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/50">
                <div className="grid md:grid-cols-5 items-center gap-2">
                  <Input className="md:col-span-2" value={m.name} onChange={e=>updateMission(i,{name:e.target.value})}/>
                  <div className="flex items-center gap-2 text-sm">
                    <span>Weight</span>
                    <select className="bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1" value={m.weight} onChange={e=>updateMission(i,{weight:Number(e.target.value)})}>{[1,2,3,4,5,6,7].map(n=> <option key={n} value={n}>{n}</option>)}</select>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span>Type</span>
                    <select className="bg-neutral-900 border border-neutral-800 rounded-xl px-2 py-1" value={m.polarity||'pos'} onChange={e=>updateMission(i,{polarity:e.target.value})}>
                      <option value="pos">Positive</option>
                      <option value="neg">Negative</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={m.active} onChange={e=>updateMission(i,{active:e.target.checked})}/> Active</label>
                    <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!m.hiddenOnShare} onChange={e=>updateMission(i,{hiddenOnShare:e.target.checked})}/> Hide</label>
                    <Btn kind="secondary" onClick={()=>removeMission(m.id)}>Delete</Btn>
                  </div>
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between"><Btn onClick={addMission}>Add Mission</Btn><Btn onClick={finalize}>Finalize Week Now</Btn></div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({label,val}){ return <div className="rounded-xl border border-neutral-800 p-3 bg-neutral-900/60"><div className="text-xs opacity-70">{label}</div><div className="text-lg font-semibold">{val}</div></div>; }

// Render
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
