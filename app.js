import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

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
const PRICE_PENDING="මිල තවම නියම වී නැත";
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
  const fopts='<option value="">ගොවියා තෝරන්න</option>'+farmers.filter(f=>f.active!==false).sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(f=>`<option value="${f.id}">${escapeHtml(f.code)} — ${escapeHtml(f.name)}</option>`).join("");
  $("collectionFarmer").innerHTML=fopts;$("settlementFarmer").innerHTML=fopts;
  $("businessName").value=settings.businessName||"";
  $("businessPhone").value=settings.businessPhone||"";
  $("businessAddress").value=settings.businessAddress||"";
  renderDashboard();renderFarmers();renderSettlementRows();renderInventory();renderReport();renderPrices();
}
function renderPrices(){
  if(!$("priceMonth")||!$("monthPrice")||!$("priceRows"))return;
  if(!$("priceMonth").value)$("priceMonth").value=pendingPriceMonths()[0]||monthNow();renderPendingPrices();
  $("monthPrice").value=priceForMonth($("priceMonth").value)||"";
  $("priceRows").innerHTML=Object.keys(monthlyPrices).sort().reverse().map(m=>`<tr><td>${escapeHtml(m)}</td><td>${money(monthlyPrices[m])}</td></tr>`).join("")||'<tr><td colspan="2">මිල ඇතුළත් කර නැත.</td></tr>';
}
function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
function renderDashboard(){
  const t=today(),m=monthNow(),todayRows=collectionsData.filter(c=>c.date===t),monthRows=collectionsData.filter(c=>(c.date||"").startsWith(m));
  $("todayKg").textContent=todayRows.reduce((s,c)=>s+num(c.kg),0).toLocaleString()+" kg";
  $("monthKg").textContent=monthRows.reduce((s,c)=>s+num(c.kg),0).toLocaleString()+" kg";
  const mPrice=priceForMonth(m);$("monthValue").textContent=mPrice?money(monthRows.reduce((s,c)=>s+num(c.kg),0)*mPrice):PRICE_PENDING;
  $("farmerCount").textContent=farmers.length;
  $("todayRows").innerHTML=todayRows.map(c=>`<tr><td>${escapeHtml(c.createdAtText||c.date)}</td><td>${escapeHtml(farmerName(c.farmerId))}</td><td>${num(c.kg).toFixed(2)}</td></tr>`).join("")||'<tr><td colspan="3">අද දළු එකතු කිරීම් නැත.</td></tr>';
  renderTodayCollect();renderPriceNote();
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
function fillMonthOptions(){
  const opts=[];const d=new Date();for(let n=0;n<18;n++){const x=new Date(d.getFullYear(),d.getMonth()-n,1);opts.push(x.toLocaleDateString("en-CA").slice(0,7))}
  $("settlementMonth").innerHTML=opts.map(m=>`<option value="${m}">${m}${priceForMonth(m)?"":" (මිල නැත)"}</option>`).join("");
  const sm=priceForMonth(monthNow())?monthNow():(opts.filter(x=>priceForMonth(x)).sort().pop()||monthNow());
  $("settlementMonth").value=sm;
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
  if(!price){$("settlementResult").classList.add("hidden");showToast(month+" මාසයේ කිලෝ මිල තවම ඇතුළත් කර නැත. කලින් මාසයක මිල මෙම මාසයට අදාළ නොවේ. සැකසුම් පිටුවේ "+month+" සඳහා මිල ඇතුළත් කරන්න.");return}
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
    role=profile.data().role;document.body.classList.toggle("role-owner",role==="owner");$("loginView").classList.add("hidden");$("appView").classList.remove("hidden");$("userBox").classList.remove("hidden");
    fillMonthOptions();["collectionDate","dispatchDate","settlePaidDate"].forEach(dateInput);dateInput("reportFrom");dateInput("reportTo");
    showPage(role==="owner"?"dashboard":"collect");
    await loadAll();
  }catch(e){console.error(e);showToast("දත්ත ලබාගත නොහැක. Firebase සැකසුම් හා ආරක්ෂක නීති පරීක්ෂා කරන්න.");}
});
document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
$("farmerSearch").addEventListener("input",renderFarmers);
$("priceMonth")?.addEventListener("change",()=>{$("monthPrice").value=priceForMonth($("priceMonth").value)||""});
$("collectionForm").addEventListener("submit",e=>{e.preventDefault();withBusy(e.submitter,async()=>{
  const gross=num($("collectionKg").value),deduct=Math.max(0,num($("collectionDeduct").value)),farmerId=$("collectionFarmer").value;
  const kg=Math.round((gross-deduct)*100)/100;
  if(!farmerId||gross<=0)throw Error("ගොවියා සහ බර පරීක්ෂා කරන්න.");
  if(kg<=0)throw Error("අඩු කිරීම මුළු බරට වඩා වැඩිය. අගයන් පරීක්ෂා කරන්න.");
  const date=$("collectionDate").value,now=new Date(),farmerObj=farmers.find(x=>x.id===farmerId);
  await addDoc(collection(db,"collections"),{date,farmerId,kg,grossKg:gross,deductKg:deduct,note:$("collectionNote").value.trim(),createdBy:currentUser.uid,createdAt:serverTimestamp(),createdAtText:now.toLocaleTimeString("si-LK",{hour:"2-digit",minute:"2-digit"})});
  $("collectionForm").reset();dateInput("collectionDate");updateCollectionNet();showMessage("collectionMsg","දළු එකතු කිරීම සුරැකුණි.");await loadAll();
  openReceipt({date,time:now.toLocaleTimeString("si-LK",{hour:"2-digit",minute:"2-digit"}),farmer:farmerObj,gross,deduct,kg,month:monthSummary(farmerId,date)}).catch(console.error);
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
$("priceForm")?.addEventListener("submit",e=>{e.preventDefault();if(!requireOwner())return;withBusy(e.submitter,async()=>{
  const month=$("priceMonth").value,price=num($("monthPrice").value);
  if(!/^\d{4}-\d{2}$/.test(month))throw Error("මාසය තෝරන්න.");
  if(price<=0)throw Error("කිලෝවක මිල ශුන්‍යයට වඩා වැඩි විය යුතුය.");
  if(paymentsData.some(p=>p.month===month))throw Error(month+" මාසයට ගෙවීම් දැනටමත් සුරැකී ඇති නිසා මිල වෙනස් කළ නොහැක.");
  await setDoc(doc(db,"monthlyPrices",month),{month,pricePerKg:price,updatedBy:currentUser.uid,updatedAt:serverTimestamp()});
  showMessage("priceMsg",month+" මාසයේ මිල සුරැකුණි.");await loadAll();
})});

function showPage(name){
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.page===name));
  document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
  $("page-"+name)?.classList.remove("hidden");
}
function nextFarmerCode(){
  let max=0,width=4;
  farmers.forEach(f=>{const m=/^F-(\d+)$/i.exec(f.code||"");if(m){max=Math.max(max,parseInt(m[1],10));width=Math.max(width,m[1].length)}});
  return "F-"+String(max+1).padStart(width,"0");
}
// Owner-only: delete a farmer (Firestore rules also enforce this)
$("farmerRows").addEventListener("click",e=>{
  const b=e.target.closest(".del-farmer-btn");if(!b)return;
  if(!requireOwner())return;
  const f=farmers.find(x=>x.id===b.dataset.farmerId);if(!f)return;
  const cols=collectionsData.filter(c=>c.farmerId===f.id).length,pays=paymentsData.filter(p=>p.farmerId===f.id).length;
  let msg=`"${f.name}" (${f.code}) ගොවියා මකා දමන්නද?`;
  if(cols||pays)msg+=`\n\nඅවවාදයයි: මෙම ගොවියාට දළු එකතු කිරීම් ${cols} ක් සහ ගෙවීම් ${pays} ක් ඇත. ඒවා ඉතිරි වන අතර වාර්තාවල "නොදන්නා ගොවියා" ලෙස පෙනේ.`;
  if(!confirm(msg))return;
  withBusy(b,async()=>{await deleteDoc(doc(db,"farmers",f.id));showToast("ගොවියා මකා දමන ලදී.");await loadAll()});
});

// ---------- Calculator ----------
let calcExpr="",calcDone=false;
const calcSym=s=>s.replace(/\*/g,"×").replace(/\//g,"÷").replace(/-/g,"−");
function calcEval(s){
  s=s.replace(/[+\-*/.]+$/,"");
  if(!s||!/^[0-9+\-*/.]+$/.test(s))return NaN;
  try{const v=Function('"use strict";return ('+s+')')();return Number.isFinite(v)?Math.round(v*1e8)/1e8:NaN}catch{return NaN}
}
function calcFmt(v){let s=String(v);if(/e/i.test(s))s=v.toFixed(8).replace(/\.?0+$/,"");return s}
function calcRender(){
  $("calcDisplay").textContent=calcExpr?calcSym(calcExpr):"0";
  const hasOp=/[0-9.][+\-*/]/.test(calcExpr),v=calcEval(calcExpr);
  $("calcPreview").textContent=(hasOp&&!calcDone&&!isNaN(v))?"= "+calcFmt(v):"";
}
function calcPress(k){
  clearTimeout(calcCloseTimer);
  if(calcDone){if(/[\d.]/.test(k))calcExpr="";calcDone=false}
  const tok=calcExpr.split(/[+\-*/]/).pop(),last=calcExpr.slice(-1);
  if(k==="C")calcExpr="";
  else if(k==="B")calcExpr=calcExpr.slice(0,-1);
  else if(/\d/.test(k)){if(tok==="0")calcExpr=calcExpr.slice(0,-1);calcExpr+=k}
  else if(k==="."){if(tok.includes("."))return;calcExpr+=tok===""?"0.":"."}
  else if("+-*/".includes(k)){
    if(calcExpr===""){if(k==="-")calcExpr="-";}
    else if("+-*/".includes(last)){if(calcExpr.length>1)calcExpr=calcExpr.slice(0,-1)+k}
    else calcExpr+=k;
  }
  else if(k==="%"){if(tok&&tok!=="-"&&!isNaN(parseFloat(tok)))calcExpr=calcExpr.slice(0,calcExpr.length-tok.length)+calcFmt(Math.round(parseFloat(tok)/100*1e8)/1e8)}
  else if(k==="="){
    const v=calcEval(calcExpr);
    if(isNaN(v)){if(calcExpr){$("calcPreview").textContent="";$("calcDisplay").textContent="දෝෂයකි";calcExpr="";}return}
    calcHist.push({expr:calcSym(calcExpr),res:calcFmt(v)});if(calcHist.length>5)calcHist.shift();renderCalcHist();
    $("calcPreview").textContent=calcSym(calcExpr)+" =";calcExpr=calcFmt(v);calcDone=true;
    $("calcDisplay").textContent=calcExpr;calcPop();calcAfterEquals(v);return;
  }
  calcRender();
}
let calcIsOpen=false,calcHist=[],calcCloseTimer=null,calcAuto=true;
try{calcAuto=localStorage.getItem("teaPosCalcAuto")!=="0"}catch{}
$("calcAutoClose").checked=calcAuto;
$("calcAutoClose").addEventListener("change",e=>{calcAuto=e.target.checked;try{localStorage.setItem("teaPosCalcAuto",calcAuto?"1":"0")}catch{}});
// Any tap inside the calculator cancels a pending auto pop-down (so you can keep calculating)
$("calcSheet").addEventListener("pointerdown",()=>clearTimeout(calcCloseTimer),true);
// After "=": show the answer briefly, then pop the calculator down
function calcAfterEquals(v){
  if(!calcAuto)return;
  clearTimeout(calcCloseTimer);
  calcCloseTimer=setTimeout(()=>{
    if(!calcIsOpen)return;
    const r=Math.round(v*100)/100,onCollect=!$("page-collect").classList.contains("hidden"),fill=onCollect&&r>0;
    if(fill)$("collectionKg").value=String(r);
    closeCalc();
    showToast("ප්‍රතිඵලය: "+calcFmt(v)+" kg"+(fill?" — බර ක්ෂේත්‍රයට යොදා ඇත":""));
    if(navigator.clipboard)navigator.clipboard.writeText(calcFmt(v)).catch(()=>{});
  },1100);
}
function calcPop(){const d=$("calcDisplay");d.classList.remove("pop");void d.offsetWidth;d.classList.add("pop")}
// Quick tare chips: subtract the bag weight from the current total (module scope, so no inline onclick)
document.querySelectorAll(".calc-chip[data-tare]").forEach(b=>b.addEventListener("click",()=>{
  if(navigator.vibrate)navigator.vibrate(8);
  if(!calcExpr||calcExpr==="-"){showToast("පළමුව දළු බර ඇතුළත් කරන්න.");return}
  calcDone=false;
  calcExpr=calcExpr.replace(/[+\-*/.]+$/,"")+"-"+b.dataset.tare;
  calcRender();calcPop();
}));
$("calcReset").addEventListener("click",()=>{if(navigator.vibrate)navigator.vibrate(8);calcExpr="";calcDone=false;calcRender();calcPop()});
function renderCalcHist(){
  $("calcHistory").innerHTML=calcHist.slice(-3).map(h=>`<button type="button" class="calc-h" data-r="${escapeHtml(h.res)}">${escapeHtml(h.expr)} = <b>${escapeHtml(h.res)}</b></button>`).join("");
}
$("calcHistory").addEventListener("click",e=>{const b=e.target.closest(".calc-h");if(!b)return;calcExpr=b.dataset.r;calcDone=false;calcRender()});
function openCalc(){
  const o=$("calcModal");o.classList.remove("hidden");void o.offsetWidth;o.classList.add("show");
  calcIsOpen=true;$("calcSheet").style.transform="";calcRender();renderCalcHist();
}
function closeCalc(){
  clearTimeout(calcCloseTimer);
  if(!calcIsOpen)return;calcIsOpen=false;
  const o=$("calcModal");o.classList.remove("show");$("calcSheet").style.transform="";
  setTimeout(()=>{if(!calcIsOpen)o.classList.add("hidden")},250);
}
$("calcFab").addEventListener("click",openCalc);
$("closeCalc").addEventListener("click",closeCalc);
$("calcCloseBtn").addEventListener("click",closeCalc);
$("calcModal").addEventListener("click",e=>{if(e.target===$("calcModal"))closeCalc()});
document.querySelectorAll(".calc-key").forEach(b=>b.addEventListener("click",()=>{if(navigator.vibrate)navigator.vibrate(8);calcPress(b.dataset.k)}));
$("calcUse").addEventListener("click",()=>{
  const v=calcEval(calcExpr);
  if(isNaN(v)||v<=0){showToast("වලංගු බරක් ගණනය කරන්න.");return}
  showPage("collect");
  $("collectionKg").value=(Math.round(v*100)/100).toString();
  closeCalc();$("collectionKg").focus();
});
document.addEventListener("keydown",e=>{
  if(!calcIsOpen)return;
  if(e.key==="Escape"){closeCalc();return}
  let k=null;
  if(/^[0-9]$/.test(e.key))k=e.key;
  else if("+-*/.".includes(e.key))k=e.key;
  else if(e.key===",")k=".";
  else if(e.key==="Enter"||e.key==="=")k="=";
  else if(e.key==="Backspace")k="B";
  else if(e.key==="%")k="%";
  else if(e.key.toLowerCase()==="c")k="C";
  if(k){e.preventDefault();calcPress(k)}
});

// =====================================================================
// Farmer information (full profile, edit, profile view, CSV)
// =====================================================================
const FARMER_FORM_TITLE="නව ගොවියකු ලියාපදිංචි කිරීම";
function renderFarmers(){
  const term=($("farmerSearch").value||"").toLowerCase();
  $("farmerRows").innerHTML=farmers.filter(f=>[f.name,f.code,f.phone,f.route,f.address,f.nic].join(" ").toLowerCase().includes(term)).map(f=>`<tr><td>${escapeHtml(f.code)}</td><td>${escapeHtml(f.name)}</td><td>${escapeHtml(f.phone)}</td><td>${escapeHtml(f.route)}</td><td>${escapeHtml(f.address)}</td><td>${f.active===false?'<span class="badge off">අක්‍රීය</span>':'<span class="badge on">සක්‍රීය</span>'}</td><td><button class="btn btn-light view-farmer-btn" type="button" data-farmer-id="${escapeHtml(f.id)}">විස්තර</button> <button class="btn btn-secondary qr-farmer-btn" type="button" data-farmer-id="${escapeHtml(f.id)}">QR</button></td><td class="owner-only"><button class="btn btn-light edit-farmer-btn" type="button" data-farmer-id="${escapeHtml(f.id)}">සංස්කරණය</button> <button class="btn btn-light del-farmer-btn" type="button" data-farmer-id="${escapeHtml(f.id)}">මකන්න</button></td></tr>`).join("")||'<tr><td colspan="8">ගොවීන් නැත.</td></tr>';
  document.querySelectorAll(".qr-farmer-btn").forEach(btn=>btn.addEventListener("click",()=>showFarmerQr(btn.dataset.farmerId)));
  if(!$("farmerCode").value&&!$("farmerEditId").value)$("farmerCode").value=nextFarmerCode();
}
function resetFarmerForm(){
  $("farmerForm").reset();$("farmerEditId").value="";$("farmerFormTitle").textContent=FARMER_FORM_TITLE;
  $("farmerCancelEdit").classList.add("hidden");$("farmerCode").value=nextFarmerCode();
}
function startEditFarmer(id){
  if(!requireOwner())return;
  const f=farmers.find(x=>x.id===id);if(!f)return;
  $("farmerEditId").value=f.id;$("farmerFormTitle").textContent="ගොවි විස්තර සංස්කරණය: "+(f.name||"");
  const set=(k,v)=>{$(k).value=v??""};
  set("farmerCode",f.code);set("farmerName",f.name);set("farmerPhone",f.phone);set("farmerNic",f.nic);set("farmerAddress",f.address);
  set("farmerRoute",f.route);set("farmerLand",f.landAcres);set("farmerJoined",f.joinedDate);set("farmerBank",f.bankName);
  set("farmerAccount",f.bankAccount);set("farmerNote",f.note);$("farmerActive").value=f.active===false?"no":"yes";
  $("farmerCancelEdit").classList.remove("hidden");$("farmerForm").scrollIntoView({behavior:"smooth",block:"start"});
}
$("farmerCancelEdit").addEventListener("click",()=>{resetFarmerForm();showMessage("farmerMsg","")});
$("farmerForm").addEventListener("submit",e=>{e.preventDefault();withBusy(e.submitter||$("farmerForm").querySelector("[type=submit]"),async()=>{
  const editId=$("farmerEditId").value,code=$("farmerCode").value.trim(),name=$("farmerName").value.trim();
  if(editId&&!requireOwner())return;
  if(farmers.some(f=>f.id!==editId&&(f.code||"").toLowerCase()===code.toLowerCase()))throw Error("මෙම ගොවි අංකය දැනටමත් භාවිතා වේ.");
  const land=$("farmerLand").value.trim();
  const data={code,name,phone:$("farmerPhone").value.trim(),nic:$("farmerNic").value.trim(),address:$("farmerAddress").value.trim(),route:$("farmerRoute").value.trim(),landAcres:land===""?null:num(land),joinedDate:$("farmerJoined").value||"",bankName:$("farmerBank").value.trim(),bankAccount:$("farmerAccount").value.trim(),note:$("farmerNote").value.trim(),active:$("farmerActive").value!=="no"};
  if(editId)await setDoc(doc(db,"farmers",editId),{...data,updatedBy:currentUser.uid,updatedAt:serverTimestamp()},{merge:true});
  else await addDoc(collection(db,"farmers"),{...data,createdAt:serverTimestamp(),createdBy:currentUser.uid});
  resetFarmerForm();showMessage("farmerMsg",editId?"ගොවි විස්තර යාවත්කාලීන විය.":"ගොවියා සාර්ථකව සුරැකුණි.");await loadAll();
})});
function downloadCsv(name,data){
  const csv="\uFEFF"+data.map(row=>row.map(v=>'"'+String(v??"").replace(/"/g,'""')+'"').join(",")).join("\r\n");
  const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8;"})),a=document.createElement("a");a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
$("farmerExportCsv").addEventListener("click",()=>{
  if(!requireOwner())return;
  downloadCsv(`farmers-${today()}.csv`,[["ගොවි අංකය","නම","දුරකථනය","හැඳුනුම්පත් අංකය","ලිපිනය","මාර්ගය/ප්‍රදේශය","ඉඩම (අක්කර)","ලියාපදිංචි දිනය","බැංකුව","ගිණුම් අංකය","තත්ත්වය","සටහන"],
    ...farmers.slice().sort((a,b)=>(a.code||"").localeCompare(b.code||"")).map(f=>[f.code,f.name,f.phone,f.nic,f.address,f.route,f.landAcres??"",f.joinedDate,f.bankName,f.bankAccount,f.active===false?"අක්‍රීය":"සක්‍රීය",f.note])]);
});
// ----- Farmer profile -----
let profileFarmerId=null;
function farmerProfileData(f){
  const cols=collectionsData.filter(c=>c.farmerId===f.id),pays=paymentsData.filter(p=>p.farmerId===f.id),m=monthNow(),owner=role==="owner";
  const kgAll=cols.reduce((s,c)=>s+num(c.kg),0),kgMonth=cols.filter(c=>(c.date||"").startsWith(m)).reduce((s,c)=>s+num(c.kg),0);
  const info=[["ගොවි අංකය",f.code],["නම",f.name],["දුරකථනය",f.phone],["ලිපිනය / ගම",f.address],["මාර්ගය / ප්‍රදේශය",f.route],["ඉඩම (අක්කර)",f.landAcres??""],["ලියාපදිංචි දිනය",f.joinedDate],["තත්ත්වය",f.active===false?"අක්‍රීය":"සක්‍රීය"]];
  if(owner)info.push(["හැඳුනුම්පත් අංකය",f.nic],["බැංකුව",f.bankName],["ගිණුම් අංකය",f.bankAccount]);
  info.push(["සටහන",f.note]);
  const stats=[["මුළු දළු (සියල්ල)",kgAll.toFixed(2)+" kg"],["මේ මාසයේ දළු",kgMonth.toFixed(2)+" kg"],["එකතු කිරීම් ගණන",String(cols.length)],["අවසන් එකතු කිරීම",cols[0]?.date||"—"]];
  if(owner){const gross=pays.reduce((s,p)=>s+num(p.gross),0),paid=pays.reduce((s,p)=>s+num(p.paidAmount),0),adv=pays.reduce((s,p)=>s+num(p.advance),0),bal=pays.reduce((s,p)=>s+num(p.balance),0);
    stats.push(["ගෙවා නිම කළ මුළු වටිනාකම",money(gross)],["අත්තිකාරම්",money(adv)],["ගෙවූ මුදල",money(paid)],["ඉතිරි ශේෂය",money(bal)])}
  return {info,stats,recent:cols.slice(0,10)};
}
function showFarmerProfile(id){
  const f=farmers.find(x=>x.id===id);if(!f)return;profileFarmerId=id;
  const d=farmerProfileData(f),cell=([l,v])=>`<div><span>${escapeHtml(l)}</span><strong>${escapeHtml(v===""||v==null?"—":v)}</strong></div>`;
  $("farmerProfile").innerHTML=`<h2>${escapeHtml(f.name)} <small class="muted">(${escapeHtml(f.code)})</small></h2><div class="profile-grid">${d.info.map(cell).join("")}</div><h3>සාරාංශය</h3><div class="profile-grid">${d.stats.map(cell).join("")}</div><h3>අවසන් එකතු කිරීම් 10</h3><div class="table-wrap"><table><thead><tr><th>දිනය</th><th>බර (kg)</th><th>සටහන</th></tr></thead><tbody>${d.recent.map(c=>`<tr><td>${escapeHtml(c.date)}</td><td>${num(c.kg).toFixed(2)}</td><td>${escapeHtml(c.note)}</td></tr>`).join("")||'<tr><td colspan="3">එකතු කිරීම් නැත.</td></tr>'}</tbody></table></div>`;
  $("farmerModal").classList.remove("hidden");
}
function closeFarmerProfile(){$("farmerModal").classList.add("hidden");profileFarmerId=null}
$("closeFarmerModal").addEventListener("click",closeFarmerProfile);
$("farmerModal").addEventListener("click",e=>{if(e.target===$("farmerModal"))closeFarmerProfile()});
$("printFarmerProfile").addEventListener("click",()=>{
  const f=farmers.find(x=>x.id===profileFarmerId);if(!f)return;const d=farmerProfileData(f);
  const rows=a=>a.map(([l,v])=>`<tr><th>${escapeHtml(l)}</th><td>${escapeHtml(v===""||v==null?"—":v)}</td></tr>`).join("");
  printable("ගොවි විස්තර",`<h1>${escapeHtml(settings.businessName)}</h1><h2>ගොවි විස්තර පත්‍රය</h2><table>${rows(d.info)}</table><h3>සාරාංශය</h3><table>${rows(d.stats)}</table><h3>අවසන් එකතු කිරීම්</h3><table><tr><th>දිනය</th><th>බර kg</th><th>සටහන</th></tr>${d.recent.map(c=>`<tr><td>${escapeHtml(c.date)}</td><td>${num(c.kg).toFixed(2)}</td><td>${escapeHtml(c.note)}</td></tr>`).join("")}</table>`);
});
$("farmerRows").addEventListener("click",e=>{
  const v=e.target.closest(".view-farmer-btn");if(v){showFarmerProfile(v.dataset.farmerId);return}
  const ed=e.target.closest(".edit-farmer-btn");if(ed)startEditFarmer(ed.dataset.farmerId);
});

// =====================================================================
// Custom report builder
// =====================================================================
const REP_KEY="teaPosReportPresets";
const r2=x=>Math.round(num(x)*100)/100;
const fOf=c=>farmers.find(f=>f.id===c.farmerId)||{};
const sumKg=rows=>r2(rows.reduce((s,c)=>s+num(c.kg),0));
const sumVal=rows=>r2(rows.reduce((s,c)=>s+(priceForDate(c.date)?valueOf(c):0),0));
// m = modes where the column is available: d=detail, f=per farmer, o=by date/month/route
const REP_COLS={
  date:{h:"දිනය",m:"d",d:c=>c.date||""},
  time:{h:"වේලාව",m:"d",d:c=>c.createdAtText||""},
  code:{h:"ගොවි අංකය",m:"df",d:c=>fOf(c).code||"",g:g=>g.f.code||""},
  name:{h:"ගොවියා",m:"df",d:c=>farmerName(c.farmerId),g:g=>g.f.name||"නොදන්නා ගොවියා"},
  route:{h:"මාර්ගය / ප්‍රදේශය",m:"df",d:c=>fOf(c).route||"",g:g=>g.f.route||""},
  phone:{h:"දුරකථනය",m:"df",d:c=>fOf(c).phone||"",g:g=>g.f.phone||""},
  address:{h:"ලිපිනය",m:"df",d:c=>fOf(c).address||"",g:g=>g.f.address||""},
  nic:{h:"හැඳුනුම්පත් අංකය",m:"f",g:g=>g.f.nic||""},
  bank:{h:"බැංකුව",m:"f",g:g=>g.f.bankName||""},
  account:{h:"ගිණුම් අංකය",m:"f",g:g=>g.f.bankAccount||""},
  land:{h:"ඉඩම (අක්කර)",m:"f",g:g=>g.f.landAcres??""},
  joined:{h:"ලියාපදිංචි දිනය",m:"f",g:g=>g.f.joinedDate||""},
  count:{h:"එකතු කිරීම් ගණන",m:"fo",k:"int",sum:1,g:g=>g.rows.length},
  kg:{h:"බර (kg)",m:"dfo",k:"kg",sum:1,d:c=>r2(c.kg),g:g=>sumKg(g.rows)},
  avg:{h:"සාමාන්‍ය බර (kg)",m:"fo",k:"kg",g:g=>g.rows.length?r2(sumKg(g.rows)/g.rows.length):0},
  price:{h:"මිල/kg",m:"d",k:"money",d:c=>priceForDate(c.date)||""},
  value:{h:"වටිනාකම",m:"dfo",k:"money",sum:1,d:c=>priceForDate(c.date)?valueOf(c):"",g:g=>g.rows.some(c=>priceForDate(c.date))?sumVal(g.rows):""},
  last:{h:"අවසන් දිනය",m:"f",g:g=>g.rows.map(c=>c.date).sort().pop()||""},
  note:{h:"සටහන",m:"d",d:c=>c.note||""}
};
const REP_DEFAULT={d:["date","code","name","kg","price","value","note"],f:["code","name","route","count","kg","value"],o:["count","kg","avg","value"]};
let repSel=JSON.parse(JSON.stringify(REP_DEFAULT)),repRange="custom";
const repMode=()=>{const g=$("reportGroup").value;return g==="detail"?"d":g==="farmer"?"f":"o"};
const fmtCell=(col,v)=>col.k==="kg"?(v===""?"":num(v).toFixed(2)):col.k==="money"?(v===""?PRICE_PENDING:money(v)):col.k==="int"?String(v):String(v??"");

function repConfig(){return{from:$("reportFrom").value,to:$("reportTo").value,farmer:$("reportFarmer").value,route:$("reportRoute").value,group:$("reportGroup").value,sort:$("reportSort").value,zero:$("reportZero").checked,title:$("reportTitle").value.trim()}}
function repRows(cfg){return collectionsData.filter(c=>(!cfg.from||c.date>=cfg.from)&&(!cfg.to||c.date<=cfg.to)&&(!cfg.farmer||c.farmerId===cfg.farmer)&&(!cfg.route||fOf(c).route===cfg.route))}

function buildReport(){
  const cfg=repConfig(),rows=repRows(cfg),mode=repMode();
  const keys=Object.keys(REP_COLS).filter(k=>repSel[mode].includes(k)&&REP_COLS[k].m.includes(mode));
  const labelHead={date:"දිනය",month:"මාසය",route:"මාර්ගය / ප්‍රදේශය"}[cfg.group];
  const head=(mode==="o"?[labelHead]:[]).concat(keys.map(k=>REP_COLS[k].h));
  let body=[];
  if(mode==="d"){
    const s=rows.slice();
    if(cfg.sort==="dateAsc")s.sort((a,b)=>(a.date||"").localeCompare(b.date||""));
    else if(cfg.sort==="kgDesc")s.sort((a,b)=>num(b.kg)-num(a.kg));
    else if(cfg.sort==="name")s.sort((a,b)=>farmerName(a.farmerId).localeCompare(farmerName(b.farmerId))||(a.date||"").localeCompare(b.date||""));
    // dateDesc: collectionsData is already newest-first
    body=s.map(c=>keys.map(k=>{const col=REP_COLS[k],v=col.d(c);return[v,fmtCell(col,v)]}));
  }else{
    const groups=new Map();
    rows.forEach(c=>{
      const key=cfg.group==="farmer"?c.farmerId:cfg.group==="date"?c.date:cfg.group==="month"?(c.date||"").slice(0,7):(fOf(c).route||"(මාර්ගයක් නැත)");
      if(!groups.has(key))groups.set(key,{key,label:cfg.group==="farmer"?farmerName(c.farmerId):key,rows:[],f:cfg.group==="farmer"?fOf(c):{}});
      groups.get(key).rows.push(c);
    });
    if(cfg.zero&&cfg.group==="farmer")farmers.forEach(f=>{if(groups.has(f.id)||(cfg.farmer&&f.id!==cfg.farmer)||(cfg.route&&f.route!==cfg.route))return;groups.set(f.id,{key:f.id,label:f.name||"",rows:[],f})});
    const arr=[...groups.values()];
    if(cfg.sort==="kgDesc")arr.sort((a,b)=>sumKg(b.rows)-sumKg(a.rows));
    else if(cfg.sort==="dateDesc")arr.sort((a,b)=>String(b.label).localeCompare(String(a.label)));
    else arr.sort((a,b)=>String(a.label).localeCompare(String(b.label)));
    body=arr.map(g=>(mode==="o"?[[g.label,g.label]]:[]).concat(keys.map(k=>{const col=REP_COLS[k],v=col.g(g);return[v,fmtCell(col,v)]})));
  }
  const foot=(mode==="o"?[["මුළු එකතුව","මුළු එකතුව"]]:[]).concat(keys.map((k,i)=>{
    const col=REP_COLS[k];
    if(col.sum){const idx=head.length-keys.length+i,t=r2(body.reduce((s,r)=>s+num(r[idx][0]),0));if(col.k==="money"&&body.every(r=>r[idx][0]===""))return["",fmtCell(col,"")];return[t,fmtCell(col,t)]}
    return i===0&&mode!=="o"?["මුළු එකතුව","මුළු එකතුව"]:["",""];
  }));
  const farmersN=new Set(rows.map(c=>c.farmerId)).size,kg=sumKg(rows),value=sumVal(rows),unpriced=rows.filter(c=>!priceForDate(c.date)).length;
  return{cfg,head,body,foot,keys,stats:{n:rows.length,farmersN,kg,value,unpriced}};
}
function repFilterText(cfg){
  const p=[];
  p.push((cfg.from||"…")+" සිට "+(cfg.to||"…")+" දක්වා");
  if(cfg.farmer)p.push("ගොවියා: "+farmerName(cfg.farmer));
  if(cfg.route)p.push("මාර්ගය: "+cfg.route);
  return p.join(" | ");
}
function refreshReportFilters(){
  const fs=$("reportFarmer"),rs=$("reportRoute"),ps=$("reportPreset"),fv=fs.value,rv=rs.value,pv=ps.value;
  fs.innerHTML='<option value="">සියලුම ගොවීන්</option>'+farmers.slice().sort((a,b)=>(a.name||"").localeCompare(b.name||"")).map(f=>`<option value="${escapeHtml(f.id)}">${escapeHtml(f.code)} — ${escapeHtml(f.name)}</option>`).join("");fs.value=fv;
  const routes=[...new Set(farmers.map(f=>f.route).filter(Boolean))].sort();
  rs.innerHTML='<option value="">සියලුම මාර්ග / ප්‍රදේශ</option>'+routes.map(r=>`<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");rs.value=rv;
  ps.innerHTML='<option value="">— සුරැකි වාර්තා —</option>'+Object.keys(repLoadPresets()).sort().map(n=>`<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");ps.value=pv;
}
function renderColChecks(){
  const mode=repMode();
  $("reportCols").innerHTML=Object.keys(REP_COLS).filter(k=>REP_COLS[k].m.includes(mode)).map(k=>`<label class="rep-col"><input type="checkbox" data-col="${k}" ${repSel[mode].includes(k)?"checked":""}><span>${escapeHtml(REP_COLS[k].h)}</span></label>`).join("");
  $("reportZeroWrap").classList.toggle("hidden",$("reportGroup").value!=="farmer");
}
function renderReport(){
  refreshReportFilters();renderColChecks();
  const r=buildReport(),s=r.stats;
  $("reportSummary").innerHTML=`<article class="stat"><span>එකතු කිරීම්</span><strong>${s.n}</strong></article><article class="stat"><span>ගොවීන් ගණන</span><strong>${s.farmersN}</strong></article><article class="stat"><span>මුළු බර</span><strong>${s.kg.toLocaleString()} kg</strong></article><article class="stat"><span>මුළු වටිනාකම</span><strong>${s.n&&s.unpriced===s.n?PRICE_PENDING:money(s.value)+(s.unpriced?" *":"")}</strong></article>${s.unpriced?`<p class="muted full" style="grid-column:1/-1">* එකතු කිරීම් ${s.unpriced} කට අදාළ මාසයේ මිල තවම නියම වී නැති නිසා වටිනාකම ගණනය වී නැත. (කලින් මාසයක මිල මෙම මාසයට අදාළ නොවේ. මාසය අවසානයේ මිල ඇතුළත් කළ විට ස්වයංක්‍රීයව ගණනය වේ.)</p>`:""}`;
  if(!r.head.length){$("reportHead").innerHTML="";$("reportRows").innerHTML='<tr><td>අවම වශයෙන් එක් තීරුවක් තෝරන්න.</td></tr>';$("reportFoot").innerHTML="";return}
  $("reportHead").innerHTML="<tr>"+r.head.map(h=>`<th>${escapeHtml(h)}</th>`).join("")+"</tr>";
  $("reportRows").innerHTML=r.body.map(row=>"<tr>"+row.map(c=>`<td>${escapeHtml(c[1])}</td>`).join("")+"</tr>").join("")||`<tr><td colspan="${r.head.length}">තෝරාගත් කොන්දේසි වලට දත්ත නැත.</td></tr>`;
  $("reportFoot").innerHTML=r.body.length?"<tr>"+r.foot.map(c=>`<th>${escapeHtml(c[1])}</th>`).join("")+"</tr>":"";
}
function exportReportCsv(){
  const r=buildReport();if(!r.head.length||!r.body.length){showToast("අපනයනය කිරීමට දත්ත නැත.");return}
  downloadCsv(`tea-report-${today()}.csv`,[r.head,...r.body.map(row=>row.map(c=>c[0])),r.foot.map(c=>c[0])]);
}
function printReportCustom(){
  const r=buildReport();if(!r.head.length){showToast("තීරු තෝරන්න.");return}
  const title=r.cfg.title||"දළු එකතු කිරීම් වාර්තාව";
  printable(title,`<h1>${escapeHtml(settings.businessName)}</h1><h2>${escapeHtml(title)}</h2><p>${escapeHtml(repFilterText(r.cfg))}</p><table><tr>${r.head.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr>${r.body.map(row=>"<tr>"+row.map(c=>`<td>${escapeHtml(c[1])}</td>`).join("")+"</tr>").join("")}<tr>${r.foot.map(c=>`<th>${escapeHtml(c[1])}</th>`).join("")}</tr></table><p>මුළු බර: <b>${r.stats.kg.toFixed(2)} kg</b> | මුළු වටිනාකම: <b>${money(r.stats.value)}</b></p><p>මුද්‍රණ දිනය: ${today()}</p>`);
}
// quick date ranges
function setRange(key){
  const d=new Date(),iso=x=>x.toLocaleDateString("en-CA"),y=d.getFullYear(),m=d.getMonth();let from="",to=iso(d);
  if(key==="today")from=to;
  else if(key==="week"){from=iso(new Date(y,m,d.getDate()-6))}
  else if(key==="month"){from=iso(new Date(y,m,1))}
  else if(key==="lastmonth"){from=iso(new Date(y,m-1,1));to=iso(new Date(y,m,0))}
  else if(key==="year"){from=iso(new Date(y,0,1))}
  else if(key==="all"){from="";to=""}
  repRange=key;$("reportFrom").value=from;$("reportTo").value=to;
  document.querySelectorAll(".rep-range").forEach(b=>b.classList.toggle("active",b.dataset.range===key));
}
// saved report layouts (stored in this browser)
function repLoadPresets(){try{return JSON.parse(localStorage.getItem(REP_KEY)||"{}")}catch{return{}}}
function repSavePresets(p){try{localStorage.setItem(REP_KEY,JSON.stringify(p));return true}catch{showToast("මෙම බ්‍රවුසරයේ සුරැකිය නොහැක.");return false}}
$("reportPresetSave").addEventListener("click",()=>{
  const name=$("reportPresetName").value.trim();if(!name){showToast("වාර්තාවට නමක් ලබා දෙන්න.");return}
  const c=repConfig(),p=repLoadPresets();
  p[name]={group:c.group,sort:c.sort,zero:c.zero,title:c.title,farmer:c.farmer,route:c.route,range:repRange,from:c.from,to:c.to,sel:JSON.parse(JSON.stringify(repSel))};
  if(repSavePresets(p)){$("reportPresetName").value="";refreshReportFilters();$("reportPreset").value=name;showToast("වාර්තා සැකසුම සුරැකුණි.")}
});
$("reportPreset").addEventListener("change",()=>{
  const p=repLoadPresets()[$("reportPreset").value];if(!p)return;
  $("reportGroup").value=p.group;$("reportSort").value=p.sort;$("reportZero").checked=!!p.zero;$("reportTitle").value=p.title||"";
  repSel={...JSON.parse(JSON.stringify(REP_DEFAULT)),...p.sel};
  if(p.range&&p.range!=="custom")setRange(p.range);else{repRange="custom";$("reportFrom").value=p.from||"";$("reportTo").value=p.to||"";document.querySelectorAll(".rep-range").forEach(b=>b.classList.remove("active"))}
  $("reportFarmer").value=p.farmer||"";$("reportRoute").value=p.route||"";renderReport();
});
$("reportPresetDelete").addEventListener("click",()=>{
  const n=$("reportPreset").value;if(!n||!confirm(`"${n}" සුරැකි වාර්තා සැකසුම මකන්නද?`))return;
  const p=repLoadPresets();delete p[n];repSavePresets(p);renderReport();
});
document.querySelectorAll(".rep-range").forEach(b=>b.addEventListener("click",()=>{setRange(b.dataset.range);renderReport()}));
$("reportCols").addEventListener("change",e=>{
  const cb=e.target.closest("input[data-col]");if(!cb)return;const mode=repMode(),k=cb.dataset.col,s=new Set(repSel[mode]);
  cb.checked?s.add(k):s.delete(k);repSel[mode]=[...s];renderReport();
});
["reportFarmer","reportRoute","reportGroup","reportSort","reportZero"].forEach(id=>$(id).addEventListener("change",renderReport));
$("reportTitle").addEventListener("input",()=>{});
["reportFrom","reportTo"].forEach(id=>$(id).addEventListener("change",()=>{repRange="custom";document.querySelectorAll(".rep-range").forEach(b=>b.classList.remove("active"));renderReport()}));
$("runReport").addEventListener("click",renderReport);$("exportCsv").addEventListener("click",exportReportCsv);$("printReport").addEventListener("click",printReportCustom);
$("reportColsReset").addEventListener("click",()=>{repSel[repMode()]=[...REP_DEFAULT[repMode()]];renderReport()});

if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./sw.js").catch(console.warn);


// =====================================================================
// Mini-printer receipt (58mm / 80mm thermal) — preview, PDF, PNG, print
// Receipt is drawn on a canvas (203 dpi ≈ 8 dots/mm) so Sinhala text is
// rendered by the browser and looks the same in the PNG, PDF and printout.
// =====================================================================
const RECEIPT_CREDIT="Nexora Technologies · 0706562952"; // බිල්පතේ පහළ පේළිය; අවශ්‍ය නැත්නම් "" ලෙස තබන්න
const RECEIPT_PREF_KEY="teaPos.receiptPrefs";
const RECEIPT_FONT='"Noto Sans Sinhala","Iskoola Pota","Nirmala UI",Arial,sans-serif';
let receiptData=null,receiptCanvas=null;
function receiptPrefs(){try{return{paper:"58",phone:false,...JSON.parse(localStorage.getItem(RECEIPT_PREF_KEY)||"{}")}}catch{return{paper:"58",phone:false}}}
function saveReceiptPrefs(){try{localStorage.setItem(RECEIPT_PREF_KEY,JSON.stringify({paper:$("receiptPaper").value,phone:$("receiptPhone").checked}))}catch{}}
async function buildReceiptCanvas(d,paper,withPhone){
  const W=paper==="80"?576:384,PAD=14,H=2400;
  try{await Promise.all([document.fonts.load('400 22px "Noto Sans Sinhala"'),document.fonts.load('700 22px "Noto Sans Sinhala"')])}catch{}
  const tmp=document.createElement("canvas");tmp.width=W;tmp.height=H;
  const g=tmp.getContext("2d");g.fillStyle="#fff";g.fillRect(0,0,W,H);g.fillStyle="#000";g.strokeStyle="#000";g.textBaseline="top";
  let y=14;
  const font=(px,w=400)=>{g.font=`${w} ${px}px ${RECEIPT_FONT}`};
  const graphemes=t=>(typeof Intl!=="undefined"&&Intl.Segmenter)?Array.from(new Intl.Segmenter("si",{granularity:"grapheme"}).segment(t),x=>x.segment):Array.from(t);
  const wrap=(text,maxW)=>{
    const out=[];
    String(text??"").split("\n").forEach(par=>{
      let line="";
      par.split(/\s+/).filter(Boolean).forEach(word=>{
        const t=line?line+" "+word:word;
        if(g.measureText(t).width<=maxW){line=t;return}
        if(line){out.push(line);line=""}
        if(g.measureText(word).width<=maxW){line=word;return}
        let chunk="";
        for(const ch of graphemes(word)){if(chunk&&g.measureText(chunk+ch).width>maxW){out.push(chunk);chunk=ch}else chunk+=ch}
        line=chunk;
      });
      out.push(line);
    });
    return out.length?out:[""];
  };
  const center=(text,px,w=400,gap=4)=>{if(!String(text||"").trim())return;font(px,w);g.textAlign="center";for(const l of wrap(text,W-2*PAD)){g.fillText(l,W/2,y);y+=Math.round(px*1.4)}y+=gap};
  const dash=()=>{g.setLineDash([7,5]);g.lineWidth=2;g.beginPath();g.moveTo(PAD,y+8);g.lineTo(W-PAD,y+8);g.stroke();g.setLineDash([]);y+=20};
  const row=(label,value,px=22,w=400)=>{
    font(px,w);const lw=g.measureText(label).width,vw=g.measureText(value).width;
    g.textAlign="left";g.fillText(label,PAD,y);
    if(lw+vw+14<=W-2*PAD){g.textAlign="right";g.fillText(value,W-PAD,y);y+=Math.round(px*1.5)}
    else{y+=Math.round(px*1.4);g.textAlign="right";for(const l of wrap(value,W-2*PAD)){g.fillText(l,W-PAD,y);y+=Math.round(px*1.4)}y+=4}
  };
  const f=d.farmer||{};
  center(settings.businessName,28,700,2);
  center(settings.businessAddress,18,400,0);
  center(settings.businessPhone,18,400,0);
  y+=4;dash();
  center("තේ දළු ලදුපත",25,700,2);
  dash();
  row("දිනය",safeText(d.date));
  if(d.time)row("වේලාව",safeText(d.time));
  row("ගොවි අංකය",safeText(f.code),22,700);
  row("නම",safeText(f.name),22,700);
  if(withPhone&&f.phone)row("දුරකථන",safeText(f.phone));
  dash();
  const ded=num(d.deduct);
  row("මුළු බර",num(d.gross??d.kg).toFixed(2)+" kg");
  row("මල්ලේ බර",(ded>0?"- ":"")+ded.toFixed(2)+" kg");
  y+=2;
  center("ශුද්ධ දළු බර",20,400,0);
  center(num(d.kg).toFixed(2)+" kg",54,700,2);
  dash();
  center("ස්තූතියි!",22,600,2);
  center(RECEIPT_CREDIT,15,400,0);
  y+=22;
  const out=document.createElement("canvas");out.width=W;out.height=Math.ceil(y);
  out.getContext("2d").drawImage(tmp,0,0);
  return out;
}
async function refreshReceipt(){
  if(!receiptData)return;
  receiptCanvas=await buildReceiptCanvas(receiptData,$("receiptPaper").value,$("receiptPhone").checked);
  $("receiptImg").src=receiptCanvas.toDataURL("image/png");
}
async function openReceipt(d){
  receiptData=d;const p=receiptPrefs();
  $("receiptPaper").value=p.paper;$("receiptPhone").checked=!!p.phone;
  $("receiptModal").classList.remove("hidden");
  await refreshReceipt();
}
function closeReceipt(){$("receiptModal").classList.add("hidden");receiptData=null}
function receiptFileName(ext){
  const f=receiptData?.farmer||{};
  return ("receipt-"+(f.code||"farmer")+"-"+(receiptData?.date||today())).replace(/[^\w.-]+/g,"_")+"."+ext;
}
function downloadUrl(url,name){const a=document.createElement("a");a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove()}
$("closeReceiptModal").addEventListener("click",closeReceipt);
$("receiptModal").addEventListener("click",e=>{if(e.target===$("receiptModal"))closeReceipt()});
["receiptPaper","receiptPhone"].forEach(id=>$(id).addEventListener("change",()=>{saveReceiptPrefs();refreshReceipt()}));
$("receiptPng").addEventListener("click",()=>{
  if(!receiptCanvas)return;
  receiptCanvas.toBlob(blob=>{const url=URL.createObjectURL(blob);downloadUrl(url,receiptFileName("png"));setTimeout(()=>URL.revokeObjectURL(url),4000)},"image/png");
});
$("receiptPdf").addEventListener("click",()=>{
  if(!receiptCanvas)return;
  if(!window.jspdf){showToast("PDF library එක load වී නැත. අන්තර්ජාල සම්බන්ධතාව පරීක්ෂා කරන්න.");return}
  const pageW=Number($("receiptPaper").value),imgW=receiptCanvas.width/8,imgH=receiptCanvas.height/8,pageH=Math.ceil(imgH+6);
  const pdf=new window.jspdf.jsPDF({unit:"mm",format:[pageW,pageH],orientation:pageW>pageH?"l":"p"});
  pdf.addImage(receiptCanvas.toDataURL("image/png"),"PNG",(pageW-imgW)/2,2,imgW,imgH);
  pdf.save(receiptFileName("pdf"));
});
$("receiptPrint").addEventListener("click",()=>{
  if(!receiptCanvas)return;
  const w=window.open("","_blank");if(!w){showToast("මුද්‍රණ කවුළුව අවහිර වී ඇත. Browser pop-ups සක්‍රීය කරන්න.");return}
  const paper=$("receiptPaper").value,imgMm=receiptCanvas.width/8;
  w.document.write(`<!doctype html><html lang="si"><head><meta charset="utf-8"><title>ලදුපත</title><style>@page{size:${paper}mm auto;margin:0}html,body{margin:0;background:#fff}img{display:block;width:${imgMm}mm;margin:0 auto}@media screen{body{padding:12px;text-align:center}img{margin:0 auto 12px}button{padding:10px 18px;font-size:16px}}@media print{button{display:none}}</style></head><body><img src="${receiptCanvas.toDataURL("image/png")}" alt=""><button onclick="window.print()">🖨️ මුද්‍රණය</button></body></html>`);
  w.document.close();
});
function renderTodayCollect(){
  const el=$("todayCollectRows");if(!el)return;
  const rows=collectionsData.filter(c=>c.date===today()).sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
  el.innerHTML=rows.map(c=>`<tr><td>${escapeHtml(c.createdAtText||c.date)}</td><td>${escapeHtml(farmerName(c.farmerId))}</td><td>${num(c.kg).toFixed(2)}</td><td><button class="btn btn-secondary receipt-btn" type="button" data-id="${escapeHtml(c.id)}">🧾 ලදුපත</button></td></tr>`).join("")||'<tr><td colspan="4">අද දළු එකතු කිරීම් නැත.</td></tr>';
}
$("todayCollectRows").addEventListener("click",e=>{
  const b=e.target.closest(".receipt-btn");if(!b)return;
  const c=collectionsData.find(x=>x.id===b.dataset.id);if(!c)return;
  openReceipt({date:c.date,time:c.createdAtText||"",farmer:farmers.find(x=>x.id===c.farmerId),gross:c.grossKg??c.kg,deduct:c.deductKg||0,kg:c.kg,month:monthSummary(c.farmerId,c.date)}).catch(console.error);
});

function updateCollectionNet(){
  const net=Math.round((num($("collectionKg").value)-Math.max(0,num($("collectionDeduct").value)))*100)/100;
  $("collectionNet").textContent=Math.max(0,net).toFixed(2)+" kg";
  $("collectionNet").style.color=net<=0&&num($("collectionKg").value)>0?"#b42318":"";
}
["collectionKg","collectionDeduct"].forEach(id=>$(id).addEventListener("input",updateCollectionNet));
$("calcUse").addEventListener("click",()=>setTimeout(updateCollectionNet,0));
// Monthly running total for the receipt: it starts again from zero every new month automatically.
function monthSummary(farmerId,date){
  const m=(date||today()).slice(0,7);
  const rows=collectionsData.filter(c=>c.farmerId===farmerId&&(c.date||"").startsWith(m));
  return{month:m,kg:rows.reduce((s,c)=>s+num(c.kg),0),deduct:rows.reduce((s,c)=>s+num(c.deductKg),0),visits:rows.length};
}


// =====================================================================
// Phone card layout: copy each column heading onto its cell (data-label)
// so the CSS can show every table row as a card on small screens.
// =====================================================================
function cardifyTable(t){
  const heads=[...t.querySelectorAll("thead th")].map(h=>h.textContent.trim());
  t.querySelectorAll("tbody tr, tfoot tr").forEach(tr=>[...tr.children].forEach((c,i)=>{
    const label=c.hasAttribute("colspan")?"":(heads[i]||"");
    if(c.getAttribute("data-label")!==label)c.setAttribute("data-label",label);
  }));
}
document.querySelectorAll("table").forEach(t=>{
  cardifyTable(t);
  let queued=false;
  new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;cardifyTable(t)})}).observe(t,{childList:true,subtree:true});
});


// ===== Monthly price status: each month has its own price, entered at month end =====
function pendingPriceMonths(){
  return[...new Set(collectionsData.map(c=>(c.date||"").slice(0,7)).filter(Boolean))].filter(m=>!priceForMonth(m)).sort();
}
function renderPendingPrices(){
  const el=$("pendingPriceMonths");if(!el)return;
  const p=pendingPriceMonths();
  el.textContent=p.length?"මිල තවම ඇතුළත් කර නැති මාස: "+p.join(", ")+" (සෑම මාසයකටම වෙන වෙනම මිලක් ඇතුළත් කරන්න)":"දළු එකතු කළ සියලු මාසවල මිල ඇතුළත් කර ඇත.";
}
function renderPriceNote(){
  const el=$("collectPriceNote");if(!el)return;
  const m=monthNow(),p=priceForMonth(m);
  el.textContent=p?`${m} මාසයේ කිලෝවක මිල: ${money(p)}.`:`${m} මාසයේ කිලෝවක මිල තවම නියම වී නැත (කලින් මාසයේ මිල මෙම මාසයට අදාළ නොවේ). දැන් සටහන් වන්නේ බර පමණි; මාසය අවසානයේ මිල ඇතුළත් කළ පසු වටිනාකම ගණනය වේ.`;
}
