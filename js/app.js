"use strict";
const App=(()=>{const $=id=>document.getElementById(id);let defer=null;
function toast(t,action,cb){const e=$("toast");e.hidden=false;e.textContent=t;e.onclick=cb||null;if(action)e.style.cursor="pointer";clearTimeout(toast.t);if(!action)toast.t=setTimeout(()=>e.hidden=true,4000)}
async function badge(){try{const ts=await DB.all("trainees"),as=await DB.all("assessments"),done=new Set(as.map(a=>a.traineeId)),n=ts.filter(t=>t.att==="Present"&&!done.has(t.id)).length;if(!navigator.setAppBadge)return;n?await navigator.setAppBadge(n):await navigator.clearAppBadge()}catch{}}
async function show(v){document.querySelectorAll(".view").forEach(s=>s.classList.toggle("on",s.id==="v-"+v));document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("on",b.dataset.v===v));if(v==="dash")dash();if(v==="storage")stor();if(v==="curr")CUR.render();if(v==="sessions"||v==="certs"||v==="quiz")await CUR.render(),await CERT.renderSessions()}
async function dash(){const c=async s=>await DB.count(s),as=await DB.all("assessments"),p=as.filter(a=>a.pass).length;$("stats").innerHTML=[["Modules",await c("courses")],["Sessions",await c("sessions")],["Trainees",await c("trainees")],["Assessments",as.length],["Pass rate",as.length?Math.round(p/as.length*100)+"%":"n/a"],["Pending sync",await c("sync_queue")]].map(([k,v])=>`<div class="card"><div class="big">${v}</div>${k}</div>`).join("");
$("audit").innerHTML=(await DB.all("audit_logs")).slice(-15).reverse().map(l=>`${esc(l.ts.slice(0,19).replace("T"," "))}  ${esc(l.action)}`).join("<br>")||"No activity yet."}
const gb=b=>(b/1073741824).toFixed(3)+" GB",mb=b=>(b/1048576).toFixed(2)+" MB";
async function stor(){const e=await DB.estimate(),pct=e.quota?Math.min(100,e.usage/e.quota*100):0,growth=e.usage/ Math.max(1,(await DB.count("audit_logs"))+1),proj=e.usage*3;
$("stor").innerHTML=`<p>Persistent storage: <b class="${e.persisted?"ok":"bad"}">${e.persisted?"granted":"not granted (browser may evict data; install the app and keep backups)"}</b></p><div class="bar"><i style="width:${pct}%"></i></div><p>Used ${mb(e.usage)} of ${gb(e.quota)} (${pct.toFixed(2)}%) · Available ${gb(Math.max(0,e.quota-e.usage))}</p><p>3-year projection at current size per year: ${gb(proj)} ${e.quota&&proj>e.quota?'<b class="bad">exceeds quota</b>':'<b class="ok">within quota</b>'}</p>`;
const v=await DB.vaultList().catch(()=>[]);$("vault").innerHTML=v.map(f=>`${esc(f.name)} (${mb(f.size)})`).join("<br>")||"Vault empty. Add manuals, PDFs or diagrams."}
async function importFile(f){try{if(/\.csv$/i.test(f.name)){const rows=(await f.text()).trim().split(/\r?\n/).slice(1);const s=(await DB.all("sessions"))[0];if(!s)return toast("Create a session first, then import a roster CSV (name,designation,company).");for(const r of rows){const[a,b,c]=r.split(",");if(a)await DB.put("trainees",{id:null,sessionId:s.id,name:a.trim(),des:(b||"").trim(),co:(c||"").trim(),lvl:"Beginner",att:"Present"})}toast("Roster imported into "+s.project)}
else{const j=JSON.parse(await f.text());if(j.stores)await DB.importAll(f);else if(j.modules)for(const m of j.modules)await DB.put("courses",{...m,id:null});else throw new Error("Unknown format");toast("Import complete")}await CUR.render()}catch(e){toast("Import failed: "+e.message)}}
async function boot(){await DB.open();DB.persist();await CUR.seed();CUR.init();CERT.init();
document.getElementById("nav").onclick=e=>{const b=e.target.closest("button");if(b)show(b.dataset.v)};
$("bkp").onclick=async()=>{const b=await DB.exportAll(),a=document.createElement("a");a.href=URL.createObjectURL(b);a.download="SCADA_UserEdu_backup_"+new Date().toISOString().slice(0,10)+".scadaedu";a.click();DB.log("Backup exported")};
$("rst").onchange=async e=>{await importFile(e.target.files[0]);stor()};$("cmp").onclick=async()=>{toast("Compacted "+await DB.compact()+" old records");stor()};
$("vaultIn").onchange=async e=>{for(const f of e.target.files)await DB.vaultPut(f.name,f);stor()};
const up=()=>{$("net").textContent=navigator.onLine?"online":"offline";$("net").classList.toggle("off",!navigator.onLine);if(navigator.onLine)syncNow()};addEventListener("online",up);addEventListener("offline",up);up();
addEventListener("beforeinstallprompt",e=>{e.preventDefault();defer=e;$("installBtn").hidden=false});$("installBtn").onclick=async()=>{if(!defer)return;defer.prompt();await defer.userChoice;defer=null;$("installBtn").hidden=true};addEventListener("appinstalled",()=>$("installBtn").hidden=true);
if(window.launchQueue)launchQueue.setConsumer(async p=>{for(const h of p.files||[])importFile(await h.getFile())});
const q=new URLSearchParams(location.search);if(q.get("shared"))toast("Shared files were added to the media vault");
let v=q.get("view")||"dash";const mod=q.get("module");if(mod)v="curr";await show(v);if(q.get("new"))$("sesForm").project.focus();
if(mod)toast("Requested module: "+decodeURIComponent(mod).replace(/^web\+scadaedu:/,""));
badge();registerSW()}
async function syncNow(){if(!("serviceWorker"in navigator))return;const r=await navigator.serviceWorker.ready;try{await r.sync.register("sync-training-records")}catch{}}
async function registerSW(){if(!("serviceWorker"in navigator))return;try{const r=await navigator.serviceWorker.register("sw.js");
const prompt=w=>toast("New SCADA LMS Version Available — Click to Reload",true,()=>w.postMessage({type:"SKIP_WAITING"}));
if(r.waiting&&navigator.serviceWorker.controller)prompt(r.waiting);r.addEventListener("updatefound",()=>{const n=r.installing;n.addEventListener("statechange",()=>{if(n.state==="installed"&&navigator.serviceWorker.controller)prompt(n)})});
let rl=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!rl){rl=true;location.reload()}});
if("periodicSync"in r){const s=await navigator.permissions.query({name:"periodic-background-sync"}).catch(()=>null);if(s&&s.state==="granted")r.periodicSync.register("periodic-curriculum-sync",{minInterval:864e5}).catch(()=>{})}
navigator.serviceWorker.addEventListener("message",async e=>{if(e.data&&e.data.type==="SYNC_DONE"){const qs=await DB.all("sync_queue");for(const x of qs){x.done=true;await DB.put("sync_queue",x)}}})}catch(e){console.warn("SW failed",e)}}
document.addEventListener("DOMContentLoaded",boot);return{toast,badge,show}})();