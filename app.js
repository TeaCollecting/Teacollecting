import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Firebase web-app configuration (project: teacollecting)
const firebaseConfig = {
  apiKey: "AIzaSyCt8hvEtrNGy_wU7UkGz8HWOVUdWG66ASE",
  authDomain: "teacollecting.firebaseapp.com",
  projectId: "teacollecting",
  storageBucket: "teacollecting.firebasestorage.app",
  messagingSenderId: "1068483603311",
  appId: "1:1068483603311:web:254b058ec68c417a6c969a",
  measurementId: "G-0T603X6PEW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const $ = id => document.getElementById(id);
const money = n => "රු. " + Number(n || 0).toLocaleString("en-LK",{minimumFractionDigits:2,maximumFractionDigits:2});
const num = n => Number(n || 0);
const today = () => new Date().toLocaleDateString("en-CA");
const monthNow = () => today().slice(0,7);
let currentUser=null, role=null, farmers=[], collectionsData=[], paymentsData=[], inventoryData=[], settings={businessName:"තේ දළු එකතු කිරීම",businessPhone:"",businessAddress:""};
let settlementCalc=null, monthlyPrices={};
const priceForMonth=m=>num(monthlyPrices[m]);
const priceForDate=d=>priceForMonth((d||"").slice(0,7));
const valueOf=c=>Math.round(num(c.kg)*priceForDate(c.date)*100)/100;

function showToast(message){const el=$("toast");el.textContent=message;el.style.display="block";setTimeout(()=>el.style.display="none",3000)}
function showMessage(id,message,isError=false){$(id).textContent=message;$(id).style.color=isError?"#b42318":"#176b45"}
function dateInput(id){$(id).value=today()}
function safeText(v){return String(v??"")}
function farmerName(id){return farmers.find(f=>f.id===id)?.name || "නොදන්නා ගොවියා"}
function requireOwner(){if(role!=="owner"){showToast("මෙම ක්‍රියාව හිමිකරුට පමණි.");return false}return true}

async function loadAll(){
  const [f,c,p,i,s,mp] = await Promise.all([
    getDocs(collection(db,"farmers")), getDocs(collection(db,"collections")),
    getDocs(collection(db,"payments")), getDocs(collection(db,"inventory")),
    getDoc(doc(db,"settings","main")), getDocs(collection(db,"monthlyPrices"))
  ]);
  farmers=f.docs.map(d=>({id:d.id,...d.data()}));
  collectionsData=c.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  paymentsData=p.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.month||"").localeCompare(a.month||""));
  inventoryData=i.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  if(s.exists()) settings={...settings,...s.data()};
  monthlyPrices={};mp.docs.forEach(d=>{monthlyPrices[d.id]=num(d.data().pricePerKg)});
  renderAll();
}
function renderAll(){
  $("userLabel").textContent=(currentUser?.email||"")+" · "+(role==="owner"?"හිමිකරු":"දළු එකතු කරන්නා");
  document.body.classList.toggle("role-owner",role==="owner");
  const fopts='<option value="">ගොවියා තෝරන්න</option>'+farmers.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(f=>`<option value="${f.id}">${escapeHtml(f.code)} — ${escapeHtml(f.name)}</option>`).join("");
  $("collectionFarmer").innerHTML=fopts;$("settlementFarmer").innerHTML=fopts;
  $("businessName").value=settings.businessName||"";
  $("businessPhone").value=settings.businessPhone||"";
  $("businessAddress").value=settings.businessAddress||"";
  renderDashboard();renderFarmers();renderSettlementRows();renderInventory();renderReport();renderPrices();
}
function renderPrices(){
  if(!$("priceMonth").value)$("priceMonth").value=monthNow();
  $("monthPrice").value=priceForMonth($("priceMonth").value)||"";
  $("priceRows").innerHTML=Object.keys(monthlyPrices).sort().reverse().map(m=>`<tr><td>${escapeHtml(m)}</td><td>${money(monthlyPrices[m])}</td></tr>`).join("")||'<tr><td colspan="2">මිල ඇතුළත් කර නැත.</td></tr>';
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function renderDashboard(){
  const t=today(),m=monthNow(),todayRows=collectionsData.filter(c=>c.date===t),monthRows=collectionsData.filter(c=>(c.date||"").startsWith(m));
  $("todayKg").textContent=todayRows.reduce((s,c)=>s+num(c.kg),0).toLocaleString()+" kg";
  $("monthKg").textContent=monthRows.reduce((s,c)=>s+num(c.kg),0).toLocaleString()+" kg";
  const mPrice=priceForMonth(m);$("monthValue").textContent=mPrice?money(monthRows.reduce((s,c)=>s+num(c.kg),0)*mPrice):"මිල තීරණය කර නැත";
  $("farmerCount").textContent=farmers.length;
  $("todayRows").innerHTML=todayRows.map(c=>`<tr><td>${escapeHtml(c.createdAtText||c.date)}</td><td>${escapeHtml(farmerName(c.farmerId))}</td><td>${num(c.kg).toFixed(2)}</td></tr>`).join("")||'<tr><td colspan="3">අද දළු එකතු කිරීම් නැත.</td></tr>';
}
function renderFarmers(){
  const term=($("farmerSearch").value||"").toLowerCase();
  $("farmerRows").innerHTML=farmers.filter(f=>(f.name+" "+f.code+" "+(f.phone||"")).toLowerCase().includes(term)).map(f=>`<tr><td>${escapeHtml(f.code)}</td><td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.phone)}</td><td>${escapeHtml(f.address)}</td><td><button class="btn btn-secondary qr-farmer-btn" type="button" data-farmer-id="${escapeHtml(f.id)}">QR / මුද්‍රණය</button></td></tr>`).join("")||'<tr><td colspan="5">ගොවීන් නැත.</td></tr>';
  document.querySelectorAll(".qr-farmer-btn").forEach(btn=>btn.addEventListener("click",()=>showFarmerQr(btn.dataset.farmerId)));
}
function renderSettlementRows(){
  $("settlementRows").innerHTML=paymentsData.map(p=>`<tr><td>${escapeHtml(p.month)}</td><td>${escapeHtml(farmerName(p.farmerId))}</td><td>${num(p.kg).toFixed(2)}</td><td>${money(p.gross)}</td><td>${money(p.paidAmount)}</td><td>${money(p.balance)}</td></tr>`).join("")||'<tr><td colspan="6">ගෙවීම් සටහන් නැත.</td></tr>';
}
function renderInventory(){
  const collected=collectionsData.reduce((s,c)=>s+num(c.kg),0);
  const dispatched=inventoryData.filter(i=>i.type==="dispatch").reduce((s,i)=>s+num(i.kg),0);
  $("stockCollected").textContent=collected.toLocaleString()+" kg";$("stockDispatched").textContent=dispatched.toLocaleString()+" kg";$("stockBalance").textContent=(collected-dispatched).toLocaleString()+" kg";
  $("dispatchRows").innerHTML=inventoryData.map(i=>`<tr><td>${escapeHtml(i.date)}</td><td>${escapeHtml(i.destination)}</td><td>${num(i.kg).toFixed(2)}</td><td>${escapeHtml(i.note)}</td></tr>`).join("")||'<tr><td colspan="4">යැවීම් සටහන් නැත.</td></tr>';
}
function reportRows(){
  const from=$("reportFrom").value,to=$("reportTo").value;
  return collectionsData.filter(c=>(!from||c.date>=from)&&(!to||c.date<=to));
}
function renderReport(){
  const rows=reportRows(),kg=rows.reduce((s,c)=>s+num(c.kg),0),value=rows.reduce((s,c)=>s+valueOf(c),0),unpriced=rows.filter(c=>!priceForDate(c.date)).length;
  $("reportSummary").innerHTML=`<article class="stat"><span>එකතු කිරීම්</span><strong>${rows.length}</strong></article><article class="stat"><span>මුළු බර</span><strong>${kg.toLocaleString()} kg</strong></article><article class="stat"><span>මුළු වටිනාකම</span><strong>${money(value)}${unpriced?" *":""}</strong></article><article class="stat"><span>ගොවීන්</span><strong>${new Set(rows.map(r=>r.farmerId)).size}</strong></article>`;
  $("reportRows").innerHTML=rows.map(c=>`<tr><td>${escapeHtml(c.date)}</td><td>${escapeHtml(farmers.find(f=>f.id===c.farmerId)?.code||"")}</td><td>${escapeHtml(farmerName(c.farmerId))}</td><td>${num(c.kg).toFixed(2)}</td><td>${priceForDate(c.date)?money(priceForDate(c.date)):"—"}</td><td>${priceForDate(c.date)?money(valueOf(c)):"—"}</td><td>${escapeHtml(c.note)}</td></tr>`).join("")||'<tr><td colspan="7">මෙම කාලයට දත්ත නැත.</td></tr>';
}
function fillMonthOptions(){
  const opts=[];const d=new Date();for(let n=0;n<18;n++){const x=new Date(d.getFullYear(),d.getMonth()-n,1);opts.push(x.toLocaleDateString("en-CA").slice(0,7))}
  $("settlementMonth").innerHTML=opts.map(m=>`<option value="${m}">${m}</option>`).join("");$("settlementMonth").value=monthNow();
}
function updateSettlementBalance(){
  if(!settlementCalc)return;
  const due=settlementCalc.gross-num($("settleAdvance").value)-num($("settleDeductions").value);
  $("settleBalance").textContent=money(due-num($("settlePaid").value));
}
function calculateSettlement(){
  const farmerId=$("settlementFarmer").value,month=$("settlementMonth").value;
  if(!farmerId){showToast("කරුණාකර ගොවියකු තෝරන්න.");return}
  const price=priceForMonth(month);
  if(!price){$("settlementResult").classList.add("hidden");showToast(month+" මාසය සඳහා කිලෝ මිල තීරණය කර නැත. සැකසුම් පිටුවේ මිල ඇතුළත් කරන්න.");return}
  const rows=collectionsData.filter(c=>c.farmerId===farmerId&&(c.date||"").startsWith(month));
  const kg=rows.reduce((s,c)=>s+num(c.kg),0),gross=Math.round(kg*price*100)/100;
  const existing=paymentsData.find(p=>p.farmerId===farmerId&&p.month===month);
  settlementCalc={farmerId,month,kg,gross,price,existing};
  $("settleKg").textContent=kg.toFixed(2)+" kg";$("settleGross").textContent=money(gross);
  $("settleAdvance").value=existing?.advance??0;$("settleDeductions").value=existing?.deductions??0;
  $("settlePaid").value=existing?.paidAmount??Math.max(0,gross);$("settlePaidDate").value=existing?.paidDate||today();$("settleNote").value=existing?.note||"";
  $("settlementResult").classList.remove("hidden");updateSettlementBalance();
}
function printable(title,body,extraCss=""){
  const w=window.open("","_blank");if(!w){showToast("මුද්‍රණ කවුළුව අවහිර වී ඇත. Browser pop-ups සක්‍රීය කරන්න.");return}
  w.document.write(`<!doctype html><html lang="si"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700&display=swap" rel="stylesheet"><style>body{font-family:Arial,sans-serif;padding:25px;color:#18352a}h1{font-size:20px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #bbb;padding:8px;text-align:left}.total{font-size:18px;font-weight:bold;margin-top:18px}@media print{button{display:none}}${extraCss}</style></head><body>${body}<button onclick="window.print()">මුද්‍රණය / PDF</button></body></html>`);w.document.close();
}
function settlementPrint(){
  if(!settlementCalc)return;
  const f=farmers.find(x=>x.id===settlementCalc.farmerId)||{},advance=num($("settleAdvance").value),deductions=num($("settleDeductions").value),paid=num($("settlePaid").value),balance=settlementCalc.gross-advance-deductions-paid;
  printable("මාසික ගෙවීම් පත්‍රය",`<h1>${escapeHtml(settings.businessName)}</h1><p>${escapeHtml(settings.businessAddress)} ${escapeHtml(settings.businessPhone)}</p><h2>ගොවි මාසික ගෙවීම් පත්‍රය</h2><p>මාසය: ${escapeHtml(settlementCalc.month)}</p><p>ගොවි අංකය: ${escapeHtml(f.code)} | නම: ${escapeHtml(f.name)}</p><p>මුළු දළු: ${settlementCalc.kg.toFixed(2)} kg</p><table><tr><th>විස්තරය</th><th>මුදල</th></tr><tr><td>දළු වටිනාකම</td><td>${money(settlementCalc.gross)}</td></tr><tr><td>අත්තිකාරම්</td><td>${money(advance)}</td></tr><tr><td>වෙනත් අඩු කිරීම්</td><td>${money(deductions)}</td></tr><tr><td>මෙවර ගෙවූ මුදල</td><td>${money(paid)}</td></tr></table><p class="total">ඉතිරි ශේෂය: ${money(balance)}</p><p>ගෙවූ දිනය: ${escapeHtml($("settlePaidDate").value)}</p><p>අත්සන: __________________</p>`);
}
function exportCsv(){
  const rows=reportRows();const data=[["දිනය","ගොවි අංකය","ගොවියා","බර kg","මිල/kg","මුළු වටිනාකම","සටහන"],...rows.map(c=>[c.date,farmers.find(f=>f.id===c.farmerId)?.code||"",farmerName(c.farmerId),c.kg,priceForDate(c.date)||"",priceForDate(c.date)?valueOf(c):"",c.note||""])];
  const csv="\uFEFF"+data.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`tea-collections-${today()}.csv`;a.click();URL.revokeObjectURL(url);
}
async function withBusy(button,fn){button.disabled=true;try{await fn()}catch(e){console.error(e);showToast("දෝෂයක්: "+(e.message||"කරුණාකර සැකසුම් පරීක්ෂා කරන්න."))}finally{button.disabled=false}}

let activeQrFarmer=null;
let qrScanner=null;
function showFarmerQr(farmerId){
  const f=farmers.find(x=>x.id===farmerId);
  if(!f){showToast("ගොවියා සොයාගත නොහැක.");return}
  activeQrFarmer=f;
  $("qrFarmerDetails").innerHTML=`<strong>${escapeHtml(f.name)}</strong><span>ගොවි අංකය: ${escapeHtml(f.code)}</span><span>${escapeHtml(f.phone||"")}</span>`;
  $("farmerQrCode").innerHTML="";
  if(typeof QRCode==="undefined"){showToast("QR Code library එක load වී නැත. අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කරන්න.");return}
  // Only a non-secret database document ID is encoded; personal details are not stored in the QR.
  new QRCode($("farmerQrCode"),{text:"TEA-FARMER:"+f.id,width:220,height:220,colorDark:"#102a1d",colorLight:"#ffffff",correctLevel:QRCode.CorrectLevel.M});
  $("qrModal").classList.remove("hidden");
}
function closeFarmerQr(){$("qrModal").classList.add("hidden");activeQrFarmer=null}
$("closeQrModal").addEventListener("click",closeFarmerQr);
$("qrModal").addEventListener("click",e=>{if(e.target===$("qrModal"))closeFarmerQr()});
$("printFarmerQr").addEventListener("click",()=>{
  if(!activeQrFarmer)return;
  const f=activeQrFarmer,qr=$("farmerQrCode").querySelector("canvas")?.toDataURL("image/png")||$("farmerQrCode").querySelector("img")?.src;
  if(!qr){showToast("QR Code එක තවම සූදානම් නැත.");return}
  const css=`@page{size:85.6mm 54mm;margin:0}body.idcard-page{padding:0;margin:0;background:#fff}.idcard{width:85.6mm;height:54mm;box-sizing:border-box;border:.3mm solid #176b45;border-radius:3mm;overflow:hidden;display:flex;flex-direction:column;font-family:"Noto Sans Sinhala",Arial,sans-serif;color:#18352a;page-break-inside:avoid}.idcard .hd{background:#176b45;color:#fff;padding:1.6mm 3mm;font-size:9pt;font-weight:700;line-height:1.2}.idcard .bd{flex:1;display:flex;align-items:center;gap:2.5mm;padding:2mm 3mm}.idcard .info{flex:1;min-width:0}.idcard .nm{font-size:10.5pt;font-weight:700;line-height:1.25;word-break:break-word}.idcard .cd{font-size:9pt;margin-top:1mm}.idcard .ph{font-size:8pt;margin-top:.8mm;color:#4a6355}.idcard img{width:31mm;height:31mm;object-fit:contain}.idcard .ft{font-size:6.5pt;text-align:center;color:#6d7e74;padding-bottom:1.2mm}@media screen{body.idcard-page{padding:20px}.idcard{box-shadow:0 2px 10px #0003}}`;
  printable("ගොවි QR හැඳුනුම්පත",`<script>document.body.className="idcard-page"<\/script><div class="idcard"><div class="hd">${escapeHtml(settings.businessName)}</div><div class="bd"><div class="info"><div class="nm">${escapeHtml(f.name)}</div><div class="cd">ගොවි අංකය: ${escapeHtml(f.code)}</div><div class="ph">${escapeHtml(f.phone||"")}</div></div><img src="${qr}" alt="QR"></div><div class="ft">තේ දළු ගොවි හැඳුනුම්පත</div></div>`,css);
});
$("startScanner").addEventListener("click",async()=>{
  if(typeof Html5Qrcode==="undefined"){showMessage("scanMsg","QR Scanner library එක load වී නැත. අන්තර්ජාලය සම්බන්ධ කර නැවත උත්සාහ කරන්න.",true);return}
  try{
    $("qrReader").classList.remove("hidden");$("stopScanner").classList.remove("hidden");$("startScanner").classList.add("hidden");
    qrScanner=new Html5Qrcode("qrReader");
    await qrScanner.start({facingMode:"environment"},{fps:10,qrbox:{width:230,height:230}},async decodedText=>{
      let id=decodedText.startsWith("TEA-FARMER:")?decodedText.slice("TEA-FARMER:".length).trim():"";
      let f=farmers.find(x=>x.id===id);
      if(!f) f=farmers.find(x=>x.code===decodedText.trim());
      if(!f){showMessage("scanMsg","මෙම QR Code එක ලියාපදිංචි ගොවියකුට අදාළ නොවේ.",true);return}
      $("collectionFarmer").value=f.id;
      showMessage("scanMsg",`තෝරාගත් ගොවියා: ${f.name} (${f.code})`);
      showToast("ගොවියා තෝරාගෙන ඇත.");
      await stopQrScanner();
      $("collectionKg").focus();
    },()=>{});
  }catch(e){
    console.error(e);showMessage("scanMsg","කැමරාව භාවිත කළ නොහැක. Camera permission ලබා දෙන්න සහ HTTPS වෙතින් විවෘත කරන්න.",true);
    await stopQrScanner();
  }
});
async function stopQrScanner(){
  if(qrScanner){try{if(qrScanner.isScanning)await qrScanner.stop();await qrScanner.clear()}catch(e){console.warn(e)}qrScanner=null}
  $("qrReader").classList.add("hidden");$("stopScanner").classList.add("hidden");$("startScanner").classList.remove("hidden");
}
$("stopScanner").addEventListener("click",stopQrScanner);


$("loginForm").addEventListener("submit",e=>{e.preventDefault();withBusy(e.submitter,async()=>{ $("loginError").textContent="";await signInWithEmailAndPassword(auth,$("email").value.trim(),$("password").value); })});
$("logoutBtn").addEventListener("click",()=>signOut(auth));
onAuthStateChanged(auth,async user=>{
  currentUser=user;
  if(!user){$("loginView").classList.remove("hidden");$("appView").classList.add("hidden");$("userBox").classList.add("hidden");return}
  try{
    const profile=await getDoc(doc(db,"users",user.uid));
    if(!profile.exists()||!["owner","collector"].includes(profile.data().role)){await signOut(auth);$("loginError").textContent="මෙම ගිණුමට පද්ධති අවසර ලබා දී නැත. හිමිකරු අමතන්න.";return}
    role=profile.data().role;$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("userBox").classList.remove("hidden");
    fillMonthOptions();["collectionDate","dispatchDate","settlePaidDate"].forEach(dateInput);dateInput("reportFrom");dateInput("reportTo");
    await loadAll();
  }catch(e){console.error(e);showToast("දත්ත ලබාගත නොහැක. Firebase සැකසුම් හා ආරක්ෂක නීති පරීක්ෂා කරන්න.");}
});
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));$("page-"+btn.dataset.page).classList.remove("hidden")}));
$("farmerSearch").addEventListener("input",renderFarmers);
$("priceMonth").addEventListener("change",()=>{$("monthPrice").value=priceForMonth($("priceMonth").value)||""});
$("farmerForm").addEventListener("submit",e=>{e.preventDefault();if(!requireOwner())return;withBusy(e.submitter,async()=>{
  const code=$("farmerCode").value.trim(),name=$("farmerName").value.trim();
  if(farmers.some(f=>f.code.toLowerCase()===code.toLowerCase()))throw Error("මෙම ගොවි අංකය දැනටමත් භාවිතා වේ.");
  await addDoc(collection(db,"farmers"),{code,name,phone:$("farmerPhone").value.trim(),address:$("farmerAddress").value.trim(),active:true,createdAt:serverTimestamp(),createdBy:currentUser.uid});
  $("farmerForm").reset();showMessage("farmerMsg","ගොවියා සාර්ථකව සුරැකුණි.");await loadAll();
})});
$("collectionForm").addEventListener("submit",e=>{e.preventDefault();withBusy(e.submitter,async()=>{
  const kg=num($("collectionKg").value),farmerId=$("collectionFarmer").value;
  if(!farmerId||kg<=0)throw Error("ගොවියා සහ බර පරීක්ෂා කරන්න.");
  const date=$("collectionDate").value,now=new Date();
  await addDoc(collection(db,"collections"),{date,farmerId,kg,note:$("collectionNote").value.trim(),createdBy:currentUser.uid,createdAt:serverTimestamp(),createdAtText:now.toLocaleTimeString("si-LK",{hour:"2-digit",minute:"2-digit"})});
  $("collectionForm").reset();dateInput("collectionDate");showMessage("collectionMsg","දළු එකතු කිරීම සුරැකුණි.");await loadAll();
})});
$("calculateSettlement").addEventListener("click",calculateSettlement);
["settleAdvance","settleDeductions","settlePaid"].forEach(id=>$(id).addEventListener("input",updateSettlementBalance));
$("saveSettlement").addEventListener("click",()=>{if(!requireOwner()||!settlementCalc)return;withBusy($("saveSettlement"),async()=>{
  const advance=num($("settleAdvance").value),deductions=num($("settleDeductions").value),paidAmount=num($("settlePaid").value),balance=Math.round((settlementCalc.gross-advance-deductions-paidAmount)*100)/100;
  if(advance+deductions>settlementCalc.gross)throw Error("අත්තිකාරම් සහ අඩු කිරීම් මුළු දළු වටිනාකමට වඩා වැඩිය.");
  if(paidAmount<0||paidAmount>settlementCalc.gross-advance-deductions)throw Error("ගෙවන මුදල පරීක්ෂා කරන්න.");
  const payload={farmerId:settlementCalc.farmerId,month:settlementCalc.month,kg:settlementCalc.kg,pricePerKg:settlementCalc.price,gross:settlementCalc.gross,advance,deductions,paidAmount,balance,paidDate:$("settlePaidDate").value,note:$("settleNote").value.trim(),updatedBy:currentUser.uid,updatedAt:serverTimestamp()};
  if(settlementCalc.existing)await setDoc(doc(db,"payments",settlementCalc.existing.id),payload);else await addDoc(collection(db,"payments"),{...payload,createdBy:currentUser.uid,createdAt:serverTimestamp()});
  showMessage("settlementMsg","මාසික ගෙවීම් සුරැකුණි.");await loadAll();calculateSettlement();
})});
$("printSettlement").addEventListener("click",settlementPrint);
$("dispatchForm").addEventListener("submit",e=>{e.preventDefault();if(!requireOwner())return;withBusy(e.submitter,async()=>{
  const kg=num($("dispatchKg").value),current=collectionsData.reduce((s,c)=>s+num(c.kg),0)-inventoryData.reduce((s,i)=>s+num(i.kg),0);
  if(kg<=0||kg>current)throw Error("යැවූ බර පවතින තොගයට වඩා වැඩිය.");
  await addDoc(collection(db,"inventory"),{type:"dispatch",date:$("dispatchDate").value,kg,destination:$("dispatchDestination").value.trim(),note:$("dispatchNote").value.trim(),createdBy:currentUser.uid,createdAt:serverTimestamp()});
  $("dispatchForm").reset();dateInput("dispatchDate");showMessage("dispatchMsg","දළු යැවීම සුරැකුණි.");await loadAll();
})});
$("settingsForm").addEventListener("submit",e=>{e.preventDefault();if(!requireOwner())return;withBusy(e.submitter,async()=>{
  settings={businessName:$("businessName").value.trim(),businessPhone:$("businessPhone").value.trim(),businessAddress:$("businessAddress").value.trim()};
  await setDoc(doc(db,"settings","main"),{...settings,updatedBy:currentUser.uid,updatedAt:serverTimestamp()});
  showMessage("settingsMsg","සැකසුම් සුරැකුණි.");await loadAll();
})});
$("priceForm").addEventListener("submit",e=>{e.preventDefault();if(!requireOwner())return;withBusy(e.submitter,async()=>{
  const month=$("priceMonth").value,price=num($("monthPrice").value);
  if(!/^\d{4}-\d{2}$/.test(month))throw Error("මාසය තෝරන්න.");
  if(price<=0)throw Error("කිලෝවක මිල ශුන්‍යයට වඩා වැඩි විය යුතුය.");
  if(paymentsData.some(p=>p.month===month))throw Error(month+" මාසයට ගෙවීම් දැනටමත් සුරැකී ඇති නිසා මිල වෙනස් කළ නොහැක.");
  await setDoc(doc(db,"monthlyPrices",month),{month,pricePerKg:price,updatedBy:currentUser.uid,updatedAt:serverTimestamp()});
  showMessage("priceMsg",month+" මාසයේ මිල සුරැකුණි.");await loadAll();
})});
$("runReport").addEventListener("click",renderReport);$("exportCsv").addEventListener("click",exportCsv);
$("printReport").addEventListener("click",()=>printable("දළු එකතු කිරීම් වාර්තාව",`<h1>${escapeHtml(settings.businessName)}</h1><h2>දළු එකතු කිරීම් වාර්තාව</h2><p>${escapeHtml($("reportFrom").value)} සිට ${escapeHtml($("reportTo").value)} දක්වා</p><table><tr><th>දිනය</th><th>ගොවියා</th><th>බර kg</th><th>මිල/kg</th><th>වටිනාකම</th></tr>${reportRows().map(c=>`<tr><td>${escapeHtml(c.date)}</td><td>${escapeHtml(farmerName(c.farmerId))}</td><td>${num(c.kg).toFixed(2)}</td><td>${priceForDate(c.date)?money(priceForDate(c.date)):"—"}</td><td>${priceForDate(c.date)?money(valueOf(c)):"—"}</td></tr>`).join("")}</table><p><b>මුළු බර:</b> ${reportRows().reduce((s,c)=>s+num(c.kg),0).toFixed(2)} kg</p><p><b>මුළු වටිනාකම:</b> ${money(reportRows().reduce((s,c)=>s+valueOf(c),0))}</p>`));
if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(console.warn);
