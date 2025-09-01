import React, {useState, useEffect} from "react";
import {createRoot} from "react-dom/client";

// helpers
const rid=()=> 'm'+Math.random().toString(36).slice(2,9);
const deep=x=>JSON.parse(JSON.stringify(x));

const STORAGE_KEY='nextlevel.ultra.v3';
const STORE_VERSION=3;

const DEFAULT_MISSIONS=[
  {id:rid(), name:"No Weed/Alcohol/Drugs", weight:7, polarity:'neg', active:true},
  {id:rid(), name:"Workout", weight:5, polarity:'pos', active:true},
];

function toDots(v,w){ if(Array.isArray(v)) return v; return Array.from({length:w}).fill(0); }

function newWeekFromTemplate(template, d=new Date()){
  const days=[...Array(7)].map((_,i)=>{
    const entries=Object.fromEntries(template.map(m=>[m.id, toDots(0,m.weight)]));
    return {dateISO:new Date(d.getTime()+i*86400000).toISOString().slice(0,10), pointsByMission:entries};
  });
  return {weekId:d.toISOString().slice(0,10), templateSnapshot:template, dayEntries:days};
}

function load(){
  const defaults=()=>{
    const missions=deep(DEFAULT_MISSIONS);
    return {version:STORE_VERSION, missions, currentWeek:newWeekFromTemplate(missions,new Date()), history:[], settings:{displayName:'Player One'}};
  };
  try{
    const raw=localStorage.getItem(STORAGE_KEY);
    if(!raw) return defaults();
    let s=JSON.parse(raw);
    return s;
  }catch(e){ return defaults(); }
}

function App(){
  const [store,setStore]=useState(load());

  useEffect(()=>{ localStorage.setItem(STORAGE_KEY, JSON.stringify(store)); },[store]);

  function addMission(){
    setStore(s=>{
      const m={id:rid(), name:'New Mission', weight:1, polarity:'pos', active:true};
      const missions=[...s.missions,m];
      const w=deep(s.currentWeek);
      w.templateSnapshot=[...w.templateSnapshot,m];
      for(const d of w.dayEntries){ d.pointsByMission[m.id]=toDots(0,m.weight); }
      return {...s, missions, currentWeek:w};
    });
  }

  return <div className="p-4">
    <h1 className="text-xl font-bold">Next Level</h1>
    <button onClick={addMission} className="bg-emerald-600 px-2 py-1 rounded">Add Mission</button>
    {store.missions.map(m=>
      <div key={m.id} className="my-2">
        <input value={m.name} onChange={e=>{
          setStore(s=>({...s, missions:s.missions.map(x=>x.id===m.id?{...x,name:e.target.value}:x)}));
        }} className="bg-neutral-900 text-white placeholder-gray-400 px-2 py-1 rounded"/>
      </div>
    )}
  </div>;
}

createRoot(document.getElementById("root")).render(<App/>);