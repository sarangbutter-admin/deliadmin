/* =====================================================================
   MOCK BACKEND
   Everything is saved in this browser (localStorage). When we move to
   Supabase, each collection below becomes a table:
     settings     (one row: currency, delivery_fee, delivery_km, cutoff_hour, closed_weekdays, time_slots, address, hours)
     box_sizes    (n, price, active)
     products     (id, name, description, art, surcharge, status: available|soldout|hidden, sort)
     addons       (id, name, description, price, active)
     flash_sales  (id, name, type: percent|amount, value, applies_to: all|<n>, starts_at, ends_at)
     orders       (id, code, created_at, customer, size, mode, day, time_slot, note, addons,
                   base, discount, sale_name, surcharge, addons_total, fee, total, status)
     order_items  (order_id, product_id, qty)
   ===================================================================== */
const DEFAULT_CATS=[{id:"classics",name:"Classics"},{id:"chocolate",name:"Chocolate"},{id:"specials",name:"Specials"}];
const CAT_OF={bb:"classics",oc:"classics",sm:"classics",dc:"chocolate",rv:"chocolate",rb:"chocolate",mt:"specials",lm:"specials",pb:"specials"};
const DB_KEY = "delidome-db-v1", CART_KEY = "delidome-cart-v1";
const ART = {
  bb:{label:"Classic chip",       dough:"#D19554", edge:"#97592A", chips:["#3B2214","#2A170C"], salt:true},
  dc:{label:"Cocoa",              dough:"#5A3322", edge:"#2E170D", chips:["#F2E5CE","#1A0C06"]},
  rv:{label:"Red velvet",         dough:"#B02736", edge:"#6E1520", chips:["#7A1220"], drizzle:"#FFF7EC"},
  mt:{label:"Matcha",             dough:"#9BB063", edge:"#5F7A35", chips:["#F7F0E0","#EFE4CC"], salt:true},
  rb:{label:"Dark with berries",  dough:"#41241A", edge:"#24120B", chips:["#E0405F","#F2E5CE"]},
  pb:{label:"Peanut butter",      dough:"#DDAA62", edge:"#A8743A", chips:["#4A2A1C","#E7BE73"]},
  sm:{label:"Marshmallow top",    dough:"#BC8148", edge:"#80501F", chips:["#2E170D"], mallow:true},
  oc:{label:"Oat",                dough:"#CC955C", edge:"#94602F", chips:["#EAD3A6","#7A4A26"]},
  lm:{label:"Lemon sugar",        dough:"#EBCB6B", edge:"#B8922E", chips:["#FFF8E1","#F5E3A0"], salt:true},
  ub:{label:"Ube",                dough:"#8E6BB8", edge:"#5B3F82", chips:["#F3E9FF","#3B2214"]}
};
const PLATES = ["#000096","#D9DCFA","#2328C8","#EEF0FF"];
const STATUSES = [["awaiting","Awaiting payment"],["review","Check payment"],["new","Payment confirmed"],["baking","Baking"],["ready","Ready / Out for delivery"],["completed","Delivered / Picked up"],["cancelled","Cancelled"]];
const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const DOW_LONG = ["Sundays","Mondays","Tuesdays","Wednesdays","Thursdays","Fridays","Saturdays"];

/* --- utils --- */
const $ = s => document.querySelector(s);
const imgOk = s => /^(data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+|https:\/\/[^\s"'<>\\]+)$/i.test(String(s||"")) ? String(s) : "";
const esc = s => String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const r2 = v => Math.round(v*100)/100;
const money = v => DB.settings.currency + r2(v).toFixed(2);
const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const fromYmd = s => {const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)};
const addDays = (d,n) => {const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const today0 = () => {const n=new Date();return new Date(n.getFullYear(),n.getMonth(),n.getDate())};
const fmtDay = s => fromYmd(s).toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
const fmtHour = h => h===0?"12am":h<12?h+"am":h===12?"12pm":(h-12)+"pm";
const fmtDT = ms => new Date(ms).toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
function fmtDur(ms){ms=Math.max(0,ms);const s=Math.floor(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60,p=n=>String(n).padStart(2,"0");return (d?d+"d ":"")+`${p(h)}:${p(m)}:${p(x)}`}
function fmtAgo(ms){const m=Math.round((Date.now()-ms)/60000);if(m<1)return "just now";if(m<60)return m+" min ago";const h=Math.round(m/60);if(h<24)return h+" hr ago";return Math.round(h/24)+" d ago"}
const fmtShort = ms => new Date(ms).toLocaleDateString("en-US",{month:"short",day:"numeric"});
const starStr = n => "★".repeat(n)+"☆".repeat(5-n);
const uid = () => Math.random().toString(36).slice(2,9);
const newCode = () => "DD-"+Math.random().toString(36).slice(2,6).toUpperCase();
function listJoin(a){return a.length<2?a.join(""):a.slice(0,-1).join(", ")+" or "+a[a.length-1]}
function rng(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}

/* --- seed data --- */
function seedDB(){
  const now=Date.now(), H=3600e3;
  const db={v:1,
    settings:{currency:"$",tz:"Asia/Jakarta",deliveryFee:5,deliveryKm:10,samedayOn:false,samedayLeadH:3,samedayCutoff:15,samedayFee:8,samedayPayMin:60,minPayMin:30,rejPayMin:120,payCdColor:"#C8102E",payCdSize:"L",payCdFx:true,pickupOn:true,pickupLeadH:24,schedOn:true,schedLeadH:24,cutoffHour:20,closedWeekdays:[1],lowStockAt:10,customOn:true,customMin:14,customStep:2,customMax:48,customPer:3.25,payWindowH:24,complaintWindowH:24,waCountry:"62",payBank:"Example Bank\nAccount 123 456 7890\nName: Delidome Cookies",
      times:["10 to 11am","12 to 1pm","3 to 4pm","5 to 6pm"],
      address:"12 Example Street, Your City. Look for the blue dome sign.",
      hours:[["Tue to Fri","10am to 6pm"],["Saturday","9am to 5pm"],["Sunday","10am to 3pm"],["Monday","Closed"]]},
    sizes:[{n:4,price:16,active:true},{n:6,price:22,active:true},{n:12,price:40,active:true}],
    products:[
      {id:"bb",art:"bb",name:"Brown butter chip",desc:"Nutty brown butter dough, dark chocolate chunks, sea salt.",surcharge:0,status:"available"},
      {id:"dc",art:"dc",name:"Double cocoa",desc:"Dark cocoa dough packed with milk and white chocolate.",surcharge:0,status:"available"},
      {id:"rv",art:"rv",name:"Red velvet",desc:"Soft red velvet with a cream cheese swirl.",surcharge:0,status:"available"},
      {id:"mt",art:"mt",name:"Matcha white chip",desc:"Earthy matcha dough with white chocolate and a pinch of salt.",surcharge:.5,status:"available"},
      {id:"rb",art:"rb",name:"Raspberry dark",desc:"Dark chocolate dough with tart freeze-dried raspberry.",surcharge:1.5,status:"available"},
      {id:"pb",art:"pb",name:"Peanut butter cup",desc:"Peanut butter dough with chopped chocolate peanut cups.",surcharge:1,status:"available"},
      {id:"sm",art:"sm",name:"Toasted s'more",desc:"Graham dough, milk chocolate, toasted marshmallow top.",surcharge:1,status:"available"},
      {id:"oc",art:"oc",name:"Oat cinnamon",desc:"Chewy oats, brown sugar and a warm hit of cinnamon.",surcharge:0,status:"available"},
      {id:"lm",art:"lm",name:"Lemon sugar",desc:"Bright lemon zest rolled in crunchy sugar.",surcharge:0,status:"hidden"}
    ],
    addons:[
      {id:"wrap",name:"Gift wrap",desc:"Ribbon, tissue and a sticker seal.",price:3,active:true},
      {id:"card",name:"Greeting card",desc:"We handwrite your gift note on a card.",price:2,active:true},
      {id:"milk",name:"Fresh milk, 500 ml",desc:"Chilled, to go with the cookies.",price:4,active:true}
    ],
    sales:[
      {id:uid(),name:"Lunch rush",type:"percent",value:20,appliesTo:"all",start:now-15*60e3,end:now+105*60e3},
      {id:uid(),name:"Party box deal",type:"amount",value:8,appliesTo:"12",start:now+5*H,end:now+8*H},
      {id:uid(),name:"Opening week",type:"percent",value:15,appliesTo:"all",start:now-8*24*H,end:now-24*H}
    ],
    orders:[]
  };
  const STK={bb:48,dc:36,rv:24,mt:18,rb:9,pb:30,sm:6,oc:0,lm:20};
  db.products.forEach(p=>{p.track=true;p.stock=STK[p.id]??24});
  db.categories=DEFAULT_CATS.map(c=>({...c}));
  db.products.forEach(p=>{p.cat=CAT_OF[p.id]||"";p.reviews=[]});
  const D=86400e3,SR={bb:[["Rina A.",5,"Crisp edges, gooey middle. The sea salt on top is perfect.",2],["Budi S.",4,"Great flavor, a little sweet for me but my kids loved it.",5],["Maya T.",5,"Ordered a box of 12 for the office and they were gone by noon.",9]],
    dc:[["Kevin L.",5,"Deep chocolate and not too sweet.",3],["Sari W.",4,"Rich and fudgy. Needed a glass of milk!",6]],rv:[["Nadia P.",5,"The cream cheese swirl is the best part.",4]],mt:[["Dimas P.",4,"Earthy matcha taste, not bitter.",7]]};
  Object.entries(SR).forEach(([id,list])=>{db.products.find(p=>p.id===id).reviews=list.map(([user,stars,text,ago])=>({id:uid(),user,stars,text,at:now-ago*D,src:"owner",example:true}))});
  // example orders
  const r=rng(11), names=["Rina Ayu","Budi Santoso","Maya Tan","Kevin Lim","Sari Wulan","Dimas Pratama","Ayu Kirana","Joko Rahman","Lina Hartono","Nadia Putri"];
  const offsets=[-2,-1,0,0,1,1,1,2,2,3], sizes=[6,4,12,6,6,12,4,6,6,12];
  const avail=db.products.filter(p=>p.status==="available").map(p=>p.id);
  const t0=today0();
  names.forEach((name,i)=>{
    let d=addDays(t0,offsets[i]);while(db.settings.closedWeekdays.includes(d.getDay()))d=addDays(d,1);
    const size=sizes[i],box=[];for(let k=0;k<size;k++)box.push(avail[Math.floor(r()*avail.length)]);
    const mode=r()<.35?"delivery":"pickup",addons=[];if(r()<.35)addons.push("wrap");if(r()<.25)addons.push("card");
    const q=quote({size,box,mode,addons},db,{at:0});
    const status=offsets[i]<0?"completed":offsets[i]===0?(i%2?"ready":"baking"):(i%3===0?"baking":"new");
    const first=name.split(" ")[0].toLowerCase();
    db.orders.push({id:uid(),code:"DD-"+(1040+i),example:true,createdAt:Math.min(now-(10-i)*2.5*H, d.getTime()-6*H),
      customer:{name,email:first+"@example.com",phone:"0812-0000-"+String(1000+i*37).slice(-4),address:mode==="delivery"?"Example address "+(i+1):""},
      size,items:countItems(box),mode,day:ymd(d),time:db.settings.times[Math.floor(r()*db.settings.times.length)],
      note:i===4?"Birthday gift, please add a candle if you can.":"",addons,sale:"",
      base:q.base,discount:0,surcharge:q.surcharge,addonsTotal:q.addons,fee:q.fee,total:r2(q.total),status});
  });
  db.orders.sort((a,b)=>b.createdAt-a.createdAt);
  {const c=db.orders.find(o=>o.status==="completed");if(c)c.completedAt=now-3*H}
  return db;
}
function countItems(box){const c={};box.forEach(id=>c[id]=(c[id]||0)+1);return c}

/* --- load / save --- */
let DB;
function defaultAnnouncer(){return {on:true,sticky:true,size:"M",cdColor:"#C8102E",cdBg:"#FFFFFF",cdFx:true,cdSize:"L",imgOn:true,imgFx:true,
  live:{text:"Flash sale: {name}. {off} {applies}.",label:"Ends in",bg:"#C8102E",ink:"#FFFFFF",img:""},
  soon:{text:"Coming up: {name}, {off} {applies}.",label:"Starts in",bg:"#EEF0FF",ink:"#000096",img:""},
  fdlive:{text:"{name}: free delivery on {applies}.",label:"Ends in",bg:"#0A6B34",ink:"#FFFFFF",img:""},
  fdsoon:{text:"Coming up: {name}, free delivery on {applies}.",label:"Starts in",bg:"#E6F7EC",ink:"#0A6B34",img:""},
  mq:{bg:"#000096",ink:"#FFFFFF",font:"display",fontData:"",fontName:"",size:"M",speed:"medium",sepOn:true,sepImg:""},
  custom:{on:false,text:"Free delivery this weekend!",label:"Ends in",endsAt:"",bg:"#000096",ink:"#FFFFFF",img:""}}}
function defaultMarquee(){return {on:true,texts:["Baked fresh every morning","Build a box your way","Pickup or local delivery","Order by 8pm for next-day cookies"],images:[],bg:"#000096",color:"#ffffff",font:"display",size:"M",speed:"medium",fontData:null,fontName:""}}
function defaultThanks(){return {logo:"",cookies:[],fx:true,amount:28,title:"Order placed",titleUpd:"Order updated",
  text:"Thanks, {name}! Your box of {size} is set for {mode} on {when}.",
  urgent:"Your cookies are waiting! Pay within {hours} to keep them.",
  cdLabel:"Time left to pay",payBtn:"Pay now & secure my cookies 🍪",trackBtn:"Track my order",buildBtn:"Build another box",
  bg:"#ffffff",accent:"#000096",cdColor:"#C8102E"}}
function defaultProofPop(){return {on:true,emoji:"🙏",img:"",cookies:[],fx:true,amount:36,
  title:"Thank you, {name}! ✅",
  text:"We have received your payment proof for order {code}. We will check it and confirm it shortly. You can follow the progress in My orders.",
  btn:"Track my order",bg:"#ffffff",accent:"#000096",ink:"#0B0B45"}}
function defaultAlerts(){return {on:true,sound:true,vol:70,repeat:false,stay:true,custom:"",customName:"",
  ev:{order:{on:true,snd:"register"},proof:{on:true,snd:"chime"},complaint:{on:true,snd:"alarm"}}}}
function defaultLabel(){return {logo:"",qr:"",qrCaption:"",notes:"",warnOn:true,warn1:"UNBOXING WITH UNCUT VIDEO!",warn2:"CONTACT US IF SEAL BROKEN"}}
function migrate(db){
  if(db.settings){const D={samedayOn:false,samedayLeadH:3,samedayCutoff:15,samedayFee:8,samedayPayMin:60,minPayMin:30,rejPayMin:120,payCdColor:"#C8102E",payCdSize:"L",payCdFx:true,pickupOn:true,pickupLeadH:24,schedOn:true,schedLeadH:24};for(const k in D)if(db.settings[k]===undefined)db.settings[k]=D[k]}
  db.label=Object.assign(defaultLabel(),db.label||{});
  db.thanks=Object.assign(defaultThanks(),db.thanks||{});
  if(!Array.isArray(db.broadcasts))db.broadcasts=[];
  if(!Array.isArray(db.customers))db.customers=[];
  if(!db.badges||!Array.isArray(db.badges.list))db.badges=defaultBadges();
  if(db.badges.autoBest===undefined)db.badges.autoBest=true;if(!db.badges.bestTop)db.badges.bestTop=3;
  if(db.settings&&db.settings.menuSort===undefined)db.settings.menuSort="popular";
  if(!Array.isArray(db.coupons))db.coupons=[{id:"cp1",code:"WELCOME10",desc:"10% off your box",type:"percent",value:10,minSpend:0,appliesTo:"all",startsAt:"",endsAt:"",maxUses:0,onePerPhone:true,stack:true,show:true,on:true}];
  db.alerts=deepFill(defaultAlerts(),db.alerts);
  if(!Array.isArray(db.payMethods))db.payMethods=[{id:"pm1",name:"Bank transfer",details:(db.settings&&db.settings.payBank)||"Example Bank\nAccount 123 456 7890\nName: Delidome Cookies",img:"",on:true}];
  db.proofpop=Object.assign(defaultProofPop(),db.proofpop||{});
  if(db.page&&db.page.strip&&db.page.strip.mode){const st=db.page.strip,d=defaultPage().strip.items;
    db.page.strip={items:st.mode==="off"?d.map(x=>({...x,on:false})):st.mode==="custom"?String(st.text||"").split("\n").map(x=>x.trim()).filter(Boolean).map(t=>({t,on:true})):d}}
  db.page=deepFill(defaultPage(),db.page);
  if(!db.marquee)db.marquee=defaultMarquee();
  db.announcer=deepFill(defaultAnnouncer(),db.announcer);
  if(db.settings.complaintWindowH===undefined)db.settings.complaintWindowH=24;
  if(db.settings.waCountry===undefined)db.settings.waCountry="62";
  if(db.settings.payWindowH===undefined)Object.assign(db.settings,{payWindowH:24,payBank:"Example Bank\nAccount 123 456 7890\nName: Delidome Cookies"});
  if(db.settings.lowStockAt===undefined)db.settings.lowStockAt=10;
  if(db.settings.customOn===undefined)Object.assign(db.settings,{customOn:true,customMin:14,customStep:2,customMax:48,customPer:3.25});
  if(!Array.isArray(db.categories)){db.categories=DEFAULT_CATS.map(c=>({...c}));db.products.forEach(p=>{if(p.cat===undefined)p.cat=CAT_OF[p.id]||""})}
  db.products.forEach(p=>{if(p.cat===undefined)p.cat="";if(!Array.isArray(p.reviews))p.reviews=[]});
  db.products.forEach(p=>{if(p.track===undefined){p.track=true;p.stock=p.status==="soldout"?0:40}if(typeof p.stock!=="number")p.stock=0});
  return db;
}
function loadDB(){if(SBH.on){SBH.initDB();return}try{const s=JSON.parse(localStorage.getItem(DB_KEY)||"null");if(s&&s.v===1){DB=migrate(s);return}}catch(e){}DB=migrate(seedDB());saveDB()}
function saveDB(){const r=SBH.on?SBH.save():(()=>{try{localStorage.setItem(DB_KEY,JSON.stringify(DB));return true}catch(e){return false}})();if(typeof afterSave==="function")afterSave();return r}


/* --- pricing --- */
const prod = (id,db=DB) => db.products.find(p=>p.id===id);
const isFD=s=>s.type==="freedelivery";
function saleStatus(s,at=Date.now()){return at<s.start?"scheduled":at<s.end?"live":"ended"}
function saleDiscount(s,base){if(isFD(s))return 0;return r2(s.type==="percent"?base*s.value/100:Math.min(s.value,base))}
function validCustom(n,db=DB){const t=db.settings;return !!t.customOn&&Number.isInteger(n)&&n>=t.customMin&&n<=t.customMax&&(n-t.customMin)%t.customStep===0&&!db.sizes.some(s=>s.n===n)}
function snapCustom(v,db=DB){const t=db.settings;v=Math.round(+v)||t.customMin;if(v<=t.customMin)return t.customMin;let n=t.customMin+Math.ceil((v-t.customMin)/t.customStep)*t.customStep;if(n>t.customMax)n=t.customMin+Math.floor((t.customMax-t.customMin)/t.customStep)*t.customStep;return n}
function basePrice(n,db=DB){const sz=db.sizes.find(s=>s.n===n);return sz?sz.price:validCustom(n,db)?r2(n*db.settings.customPer):0}
function bestSale(n,at=Date.now(),db=DB){
  const price=basePrice(n,db);if(!price)return null;
  return db.sales.filter(s=>!isFD(s)&&saleStatus(s,at)==="live"&&(s.appliesTo==="all"||+s.appliesTo===n))
    .sort((a,b)=>saleDiscount(b,price)-saleDiscount(a,price))[0]||null;
}
const freeDelSale=(n,at=Date.now(),db=DB)=>db.sales.find(s=>isFD(s)&&saleStatus(s,at)==="live"&&(s.appliesTo==="all"||+s.appliesTo===n))||null;
const cpNorm=v=>String(v||"").toUpperCase().replace(/[^A-Z0-9_-]/g,"").slice(0,20);
const cpOff=c=>c.type==="percent"?`${c.value}% off`:c.type==="amount"?`${money(c.value)} off`:"Free delivery";
const cpUses=(code,db,excl)=>db.orders.filter(o=>o.coupon===code&&o.status!=="cancelled"&&o.id!==excl);
function cpState(c,db=DB,now=Date.now()){
  if(!c.on)return "off";
  const st=c.startsAt?new Date(c.startsAt).getTime():0,en=c.endsAt?new Date(c.endsAt).getTime():0;
  if(st&&now<st)return "scheduled";if(en&&now>=en)return "expired";
  if(c.maxUses>0&&cpUses(c.code,db).length>=c.maxUses)return "used";return "live"}
function couponCheck(code,c,db,{base,saleDisc,phone,excl}){
  code=cpNorm(code);const cp=(db.coupons||[]).find(x=>x.code===code);
  if(!cp)return {ok:false,err:"That code isn't valid. Check the spelling and try again."};
  const stt=cpState(cp,db);
  if(stt==="off"||stt==="expired")return {ok:false,err:"This coupon has expired."};
  if(stt==="scheduled")return {ok:false,err:"This coupon isn't active yet."};
  if(cp.maxUses>0&&cpUses(code,db,excl).length>=cp.maxUses)return {ok:false,err:"Sorry, this coupon has been fully claimed."};
  if(cp.appliesTo!=="all"&&+cp.appliesTo!==c.size)return {ok:false,err:`This coupon is for boxes of ${cp.appliesTo} only.`};
  if(cp.minSpend>0&&base<cp.minSpend)return {ok:false,err:`Spend at least ${money(cp.minSpend)} on the box to use this coupon.`};
  if(saleDisc>0&&!cp.stack)return {ok:false,err:"This coupon can't be combined with the flash sale."};
  if(cp.onePerPhone&&phone){const ph=String(phone).replace(/\D/g,"").replace(/^(0|62)/,"");if(cpUses(code,db,excl).some(o=>String(o.customer&&o.customer.phone||"").replace(/\D/g,"").replace(/^(0|62)/,"")===ph))return {ok:false,err:"You've already used this coupon."}}
  const room=Math.max(0,base-saleDisc);
  const discount=cp.type==="percent"?r2(room*cp.value/100):cp.type==="amount"?r2(Math.min(cp.value,room)):0;
  return {ok:true,coupon:cp,discount,freeDel:cp.type==="freedelivery"};
}
function quote(c,db=DB,{at=Date.now(),withDelivery=true}={}){
  const base=basePrice(c.size,db);
  const sale=at?bestSale(c.size,at,db):null,discount=sale?saleDiscount(sale,base):0;
  const surcharge=r2(c.box.reduce((a,id)=>a+(prod(id,db)?.surcharge||0),0));
  const addons=r2((c.addons||[]).reduce((a,id)=>{const x=db.addons.find(y=>y.id===id&&y.active);return a+(x?x.price:0)},0));
  const cp=c.coupon?couponCheck(c.coupon,c,db,{base,saleDisc:discount,phone:c.phone,excl:c.editId}):null;
  const couponDisc=cp&&cp.ok?cp.discount:0;
  const fdSale=at&&c.mode==="delivery"?freeDelSale(c.size,at,db):null;
  const fee=withDelivery&&c.mode==="delivery"&&!fdSale&&!(cp&&cp.ok&&cp.freeDel)?(c.speed==="sameday"?(db.settings.samedayFee??db.settings.deliveryFee):db.settings.deliveryFee):0;
  return {base,sale,fdSale,discount,surcharge,addons,fee,coupon:cp&&cp.ok?cp.coupon:null,couponDisc,couponErr:cp&&!cp.ok?cp.err:"",total:r2(base-discount-couponDisc+surcharge+addons+fee)};
}
const saleOffText = s => isFD(s)?"Free delivery":s.type==="percent"?`${s.value}% off`:`${money(s.value)} off`;
const saleAppliesText = s => s.appliesTo==="all"?"every box":`the box of ${s.appliesTo}`;

/* --- cookie drawing --- */
let gid=0;
function cookieSVG(f, seed){
  const r=rng(seed), id="g"+(gid++), N=30, pts=[];
  for(let i=0;i<N;i++){const a=i/N*Math.PI*2, rad=44+(r()-.5)*3.6;pts.push([50+Math.cos(a)*rad,50+Math.sin(a)*rad])}
  const mid=(p,q)=>[(p[0]+q[0])/2,(p[1]+q[1])/2];
  let d="M"+mid(pts[N-1],pts[0]).map(v=>v.toFixed(1)).join(" ");
  for(let i=0;i<N;i++){const p=pts[i],m=mid(p,pts[(i+1)%N]);d+=` Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${m[0].toFixed(1)} ${m[1].toFixed(1)}`}
  let s=`<svg class="ck" viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="${id}" cx="45%" cy="40%" r="62%"><stop offset="0" stop-color="${f.dough}"/><stop offset=".72" stop-color="${f.dough}"/><stop offset="1" stop-color="${f.edge}"/></radialGradient></defs><path d="${d}Z" fill="url(#${id})"/>`;
  for(let i=0;i<7;i++){const a=r()*6.28,rr=r()*30;s+=`<ellipse cx="${(50+Math.cos(a)*rr).toFixed(1)}" cy="${(50+Math.sin(a)*rr).toFixed(1)}" rx="${(3+r()*5).toFixed(1)}" ry="${(1+r()*1.5).toFixed(1)}" fill="${f.edge}" opacity=".28" transform="rotate(${(r()*180).toFixed(0)} ${(50+Math.cos(a)*rr).toFixed(1)} ${(50+Math.sin(a)*rr).toFixed(1)})"/>`}
  const nChips=f.mallow?7:13;
  for(let i=0;i<nChips;i++){const a=r()*6.28,rr=Math.sqrt(r())*34,x=50+Math.cos(a)*rr,y=50+Math.sin(a)*rr,w=4+r()*5,h=3.5+r()*4;
    s+=`<rect x="${(x-w/2).toFixed(1)}" y="${(y-h/2).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.6" fill="${f.chips[i%f.chips.length]}" transform="rotate(${(r()*90).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`}
  if(f.mallow){for(let i=0;i<4;i++){const a=r()*6.28,rr=r()*22,x=50+Math.cos(a)*rr,y=50+Math.sin(a)*rr,R=8+r()*4;
    s+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R.toFixed(1)}" fill="#FFF4E2"/><circle cx="${(x+R*.25).toFixed(1)}" cy="${(y+R*.3).toFixed(1)}" r="${(R*.55).toFixed(1)}" fill="#D8964A" opacity=".55"/>`}}
  if(f.drizzle){let p="M22 38";for(let i=0;i<6;i++){p+=` Q${30+i*9} ${i%2?30:70} ${34+i*9} ${i%2?62:40}`}
    s+=`<path d="${p}" stroke="${f.drizzle}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`}
  if(f.salt){for(let i=0;i<9;i++){const a=r()*6.28,rr=r()*30;s+=`<rect x="${(50+Math.cos(a)*rr).toFixed(1)}" y="${(50+Math.sin(a)*rr).toFixed(1)}" width="2" height="2" fill="#fff" opacity=".9" transform="rotate(${(r()*90).toFixed(0)} ${(50+Math.cos(a)*rr).toFixed(1)} ${(50+Math.sin(a)*rr).toFixed(1)})"/>`}}
  return s+"</svg>";
}
const seedOf = id => [...id].reduce((a,c)=>a+c.charCodeAt(0),0)*97+3;
const artOf = p => ART[p?.art]||ART.bb;
const plateColorOf = p => {const i=DB.products.indexOf(p);return PLATES[(i<0?DB.products.length:i)%PLATES.length]};
const DARK_PLATES = ["#000096","#2328C8"];
const hasImage = p => p.art!=="none" && !(p.art==="photo"&&!p.img);
const initials = n => (n||"?").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
function plateInner(p){
  if(p.art==="photo"&&p.img)return `<img class="ck ph${p.cutout?" cut":""}" src="${esc(imgOk(p.img))}" alt="" draggable="false">`;
  if(!hasImage(p))return "";
  return cookieSVG(artOf(p),seedOf(p.id));
}
const HEX6=/^#[0-9a-f]{6}$/i;
const lumOf=h=>{const c=[1,3,5].map(i=>{const v=parseInt(h.slice(i,i+2),16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]};
const BG_DIRS={diag:"linear-gradient(135deg,",down:"linear-gradient(180deg,",right:"linear-gradient(90deg,",radial:"radial-gradient(circle,"};
// the circle behind a flavor: automatic colour, or the owner's own colour / gradient / picture / none
function plateBg(p,b){
  b=b||p.bg||{};const d=plateColorOf(p);let css,dark;
  if(b.type==="color"&&HEX6.test(b.c1||"")){css=`background:${b.c1}`;dark=lumOf(b.c1)<.3}
  else if(b.type==="gradient"&&HEX6.test(b.c1||"")&&HEX6.test(b.c2||"")){css=`background:${BG_DIRS[b.dir]||BG_DIRS.diag}${b.c1},${b.c2})`;dark=(lumOf(b.c1)+lumOf(b.c2))/2<.3}
  else if(b.type==="image"&&imgOk(b.img)){css=`background:#000096 url("${imgOk(b.img)}") center/cover no-repeat`;dark=true}
  else if(b.type==="none"){css="background:transparent";dark=false}
  else{css=`background:${d};${d==="#EEF0FF"?"box-shadow:inset 0 0 0 2px #000096":""}`;dark=DARK_PLATES.includes(d)}
  if(b.ring&&HEX6.test(b.ring))css+=`;box-shadow:inset 0 0 0 4px ${b.ring}`;
  const z=+b.size;if(z>=40&&z<=100)css+=`;--ck:${Math.round(z)}%`;
  return {css,dark};
}
function plateHTML(p,bgDraft){const g=plateBg(p,bgDraft);return `<div class="plate${g.dark?" dark":""}${hasImage(p)?"":" blank"}" style="${esc(g.css)}">${plateInner(p)}</div>`}
function crumbColors(p){
  if(p.art==="photo"&&p.tints)return {dough:p.tints[0],edge:p.tints[1],chips:[p.tints[2]]};
  if(!hasImage(p))return {dough:"#000096",edge:"#2328C8",chips:["#D9DCFA"]};
  return artOf(p);
}

/* ================= SHOP ================= */
loadDB();
const fresh = () => ({size:6, box:[], step:1, mode:"pickup", speed:"scheduled", day:null, time:null, note:"", addons:[], coupon:""});
let S = fresh(), hadCart=false;
try{const s=JSON.parse(localStorage.getItem(CART_KEY)||"null");if(s&&Array.isArray(s.box)){S={...S,...s,step:s.step===2?2:1};hadCart=true;
  }}catch(e){}
const saveCart = () => {try{localStorage.setItem(CART_KEY,JSON.stringify({size:S.size,box:S.box,mode:S.mode,speed:S.speed,note:S.note,addons:S.addons,editId:S.editId||null,day:S.day,time:S.time,step:S.step,coupon:S.coupon||""}))}catch(e){}};
const activeSizes = () => DB.sizes.filter(s=>s.active).sort((a,b)=>a.n-b.n);
const heldOwn = id => {if(!S.editId||view!=="store")return 0;const o=DB.orders.find(x=>x.id===S.editId);return o&&o.holds&&o.status==="awaiting"?(o.items[id]||0):0};
const stockLeft = p => p&&p.track?Math.max(0,p.stock+heldOwn(p.id)):Infinity;
const isOut = p => !p||p.status==="soldout"||stockLeft(p)<=0;
const availProducts = () => DB.products.filter(p=>p.status==="available"&&stockLeft(p)>0);
const pickable = () => DB.products.filter(p=>p.status==="available"&&stockLeft(p)-countOf(p.id)>0);
const ratingOf = p => {const r=p.reviews||[],n=r.length;return {n,avg:n?r.reduce((a,x)=>a+x.stars,0)/n:0}};
const isLow = p => p.track&&p.status!=="hidden"&&p.stock<=DB.settings.lowStockAt;
function sanitizeCart(){
  const sz=activeSizes();
  if(!sz.find(s=>s.n===S.size)&&!validCustom(S.size))S.size=(sz.find(s=>s.n===6)||sz[0]||{n:6}).n;
  const used={};
  S.box=S.box.filter(id=>{const p=prod(id);if(!p||p.status!=="available")return false;used[id]=(used[id]||0)+1;return used[id]<=stockLeft(p)}).slice(0,S.size);
  S.addons=(S.addons||[]).filter(id=>DB.addons.find(a=>a.id===id&&a.active));
  if(S.editId){const eo=DB.orders.find(x=>x.id===S.editId);if(!eo||eo.status!=="awaiting")S.editId=null}
  if(!full())S.step=1;
}
const full = () => S.box.length===S.size && S.size>0;
const countOf = id => S.box.filter(x=>x===id).length;
const Q = () => quote(S,DB,{withDelivery:S.step===2});
const total = () => {const q=Q();return S.step===2?q.total:r2(q.total-q.addons)};

const TZS=["Asia/Jakarta","Asia/Makassar","Asia/Jayapura","Asia/Singapore","Asia/Kuala_Lumpur","Asia/Bangkok","Asia/Manila","Asia/Hong_Kong","Asia/Tokyo","Australia/Sydney","Europe/London","Europe/Paris","America/New_York","America/Chicago","America/Los_Angeles","UTC"];
// "now" on the shop's clock, so the day list matches what the server accepts wherever the visitor is
function shopNow(){
  if(SBH.on||DB.settings.tz){try{const p=new Intl.DateTimeFormat("en-CA",{timeZone:DB.settings.tz||"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).reduce((a,x)=>(a[x.type]=x.value,a),{});
    return {d:new Date(+p.year,+p.month-1,+p.day),h:+p.hour}}catch(e){}}
  const n=new Date();return {d:today0(),h:n.getHours()};
}
// the three ways to get an order: Sameday shipment, Pickup, Scheduled delivery (each can be switched off and has its own lead time)
const OPT_NAME={sameday:"Sameday shipment",pickup:"Pickup",scheduled:"Scheduled delivery"};
const optOf=c=>c.mode==="pickup"?"pickup":c.speed==="sameday"?"sameday":"scheduled";
const whenTxt=o=>o.mode!=="pickup"&&o.speed==="sameday"?"Today (sameday)":`${fmtDay(o.day)}, ${o.time}`;
const modeName=o=>o.mode==="pickup"?"Pickup":o.speed==="sameday"?"Sameday shipment":o.speed==="scheduled"?"Scheduled delivery":"Delivery";
const optLead=(k,s=DB.settings)=>Math.max(0,+(k==="sameday"?s.samedayLeadH:k==="pickup"?s.pickupLeadH:s.schedLeadH)||0);
const fmtLead=h=>h>=24&&h%24===0?`${h/24} day${h/24>1?"s":""}`:`${h} hour${h===1?"":"s"}`;
function samedayOpen(){const n=shopNow(),s=DB.settings;return !!s.samedayOn&&n.h<s.samedayCutoff&&!s.closedWeekdays.includes(n.d.getDay())}
const optOn=k=>k==="sameday"?!!DB.settings.samedayOn:k==="pickup"?DB.settings.pickupOn!==false:DB.settings.schedOn!==false;
const optAvail=k=>k==="sameday"?samedayOpen():optOn(k);
function dayOptions(){
  const now=shopNow(),k=optOf(S);
  if(k==="sameday")return [now.d];
  let start=addDays(now.d,Math.floor((now.h+Math.ceil(optLead(k)))/24));if(now.h>=DB.settings.cutoffHour)start=addDays(start,1);
  return Array.from({length:7},(_,i)=>addDays(start,i));
}
// keep the chosen option, day and time valid
function fixWhen(){
  if(!optAvail(optOf(S))){const k=["pickup","scheduled","sameday"].find(optAvail);if(k){S.mode=k==="pickup"?"pickup":"delivery";S.speed=k==="sameday"?"sameday":"scheduled"}}
  if(optOf(S)==="sameday"){S.day=ymd(shopNow().d);S.time="Same day";return}
  if(!dayOptions().some(d=>ymd(d)===S.day)){S.day=null;S.time=null}
  if(S.time&&!DB.settings.times.includes(S.time))S.time=null;
  if(S.time&&S.day&&slotTooSoon(S.day,S.time,optOf(S)))S.time=null;
}

// ---- when must an order be paid? ----
// slotStartMin mirrors the server: "10 to 11am" -> 600 (minutes after midnight), null when it can't be read
function slotStartMin(p){
  p=String(p||"").toLowerCase();let m=p.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-|–|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/),h1,m1,h2,m2,s1,s2;
  const mins=(h,mi,sf)=>(h%12+(sf==="pm"?12:0))*60+mi;
  if(!m){m=p.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);if(!m)return null;h1=+m[1];m1=+(m[2]||0);if(h1<1||h1>12||m1>59)return null;return mins(h1,m1,m[3])}
  h1=+m[1];m1=+(m[2]||0);s1=m[3];h2=+m[4];m2=+(m[5]||0);s2=m[6];
  if(h1>24||h2>24||m1>59||m2>59)return null;
  if(!s1&&!s2){if(h1>=24)return null;return h1*60+m1}
  if(h1<1||h1>12||h2<1||h2>12)return null;
  if(!s1){s1=s2;if(mins(h1,m1,s1)>mins(h2,m2,s2))s1=s2==="pm"?"am":"pm"}
  return mins(h1,m1,s1);
}
function shopNowT(){ // the shop's wall clock as a plain number, so day and time can be compared in the shop's time zone
  try{const p=new Intl.DateTimeFormat("en-CA",{timeZone:DB.settings.tz||"Asia/Jakarta",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date()).reduce((a,x)=>(a[x.type]=x.value,a),{});
    return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)}catch(e){const n=new Date();return Date.UTC(n.getFullYear(),n.getMonth(),n.getDate(),n.getHours(),n.getMinutes(),n.getSeconds())}
}
const minPayMs=()=>Math.max(1,+DB.settings.minPayMin||30)*60e3;
const slotWall=(day,min)=>{const [y,m,d]=String(day).split("-").map(Number);return Date.UTC(y,m-1,d)+min*60e3};
const slotTooSoon=(day,time,k)=>{const m=slotStartMin(time);return m!==null&&!!day&&slotWall(day,m)<shopNowT()+optLead(k)*3600e3+minPayMs()};
// the pay deadline (real clock): the usual window, but never later than (pickup/delivery time - lead time); sameday gets a short window
function payDeadlineMs(c){
  const st=DB.settings,now=Date.now();let span=Math.max(1,+st.payWindowH||24)*3600e3;
  if(c.mode!=="pickup"&&c.speed==="sameday")span=Math.min(span,Math.max(minPayMs(),(+st.samedayPayMin||60)*60e3));
  else if(c.day){const m=slotStartMin(c.time),k=optOf(c);span=Math.min(span,slotWall(c.day,m===null?540:m)-shopNowT()-optLead(k)*3600e3)}
  return now+Math.max(minPayMs(),span);
}
const fmtSpan=ms=>{const m=Math.max(1,Math.round(ms/60e3)),h=Math.floor(m/60),r=m%60;return h?`${h} hour${h>1?"s":""}${r?` ${r} min`:""}`:`${r} min`};
function applyCdLook(){const st=DB.settings,r=document.documentElement;r.style.setProperty("--pcd",st.payCdColor||"#C8102E");r.style.setProperty("--pcdz",({M:1.1,L:1.4,XL:1.8})[st.payCdSize]||1.4);document.body.classList.toggle("pcd-fx",st.payCdFx!==false)}
let shopCat="all";
const catName = id => (DB.categories.find(c=>c.id===id)||{}).name||"";
/* --- badges, best sellers and menu order --- */
const BADGE_FONTS={display:["Bold display","var(--display)"],body:["Clean","var(--body)"],serif:["Serif",'Georgia,"Times New Roman",serif'],mono:["Typewriter",'ui-monospace,Menlo,Consolas,monospace'],hand:["Handwritten",'"Segoe Script","Bradley Hand","Comic Sans MS",cursive']};
const BADGE_FX={shine:"Shine",pulse:"Pulse",bounce:"Bounce",glow:"Glow",wiggle:"Wiggle",none:"No effect"};
function defaultBadges(){return {autoBest:true,bestTop:3,list:[
  {id:"best",text:"🔥 Best seller",font:"display",color:"#FFFFFF",bg:"#C8102E",fx:"shine"},
  {id:"wanted",text:"💛 Most wanted",font:"display",color:"#3B2200",bg:"#FFC53D",fx:"pulse"},
  {id:"seasonal",text:"🍂 Seasonal",font:"display",color:"#FFFFFF",bg:"#B5541B",fx:"glow"},
  {id:"new",text:"✨ New flavor",font:"display",color:"#FFFFFF",bg:"#000096",fx:"bounce"},
  {id:"limited",text:"⏳ Limited",font:"display",color:"#FFFFFF",bg:"#6B2BD9",fx:"wiggle"}]}}
const PAID_SET=["new","baking","ready","completed"];
// how many of each flavor were bought (last 90 days). Visitors get the totals from the server.
function soldMap(){
  if(DB.sold)return DB.sold;   // shop visitors get the totals from the server
  const m={},since=Date.now()-90*864e5;
  DB.orders.forEach(o=>{if(!PAID_SET.includes(o.status)||(o.createdAt||0)<since)return;Object.entries(o.items||{}).forEach(([k,n])=>m[k]=(m[k]||0)+n)});
  return m;
}
function bestIds(){const b=DB.badges;if(!b||!b.autoBest||!b.list.some(x=>x.id==="best"))return [];const sold=soldMap();
  return DB.products.filter(p=>p.status!=="hidden"&&(sold[p.id]||0)>0).sort((a,c)=>(sold[c.id]||0)-(sold[a.id]||0)).slice(0,Math.max(1,Math.min(10,+b.bestTop||3))).map(p=>p.id)}
function badgesOf(p,best){const ids=[...(p.badges||[])];if((best||bestIds()).includes(p.id)&&!ids.includes("best"))ids.unshift("best");
  return ids.map(id=>(DB.badges.list||[]).find(b=>b.id===id)).filter(Boolean)}
function badgeHTML(b){const f=(BADGE_FONTS[b.font]||BADGE_FONTS.display)[1],fx=BADGE_FX[b.fx]?b.fx:"shine";
  const css=`color:${HEX6.test(b.color||"")?b.color:"#FFFFFF"};background:${HEX6.test(b.bg||"")?b.bg:"#C8102E"};font-family:${f}`;
  return `<span class="bdg fx-${fx}" style="${esc(css)}">${esc(String(b.text||"").slice(0,24))}</span>`}
function menuOrder(list){const by=DB.settings.menuSort||"popular",sold=soldMap(),pos=new Map(DB.products.map((p,i)=>[p.id,i]));
  return list.slice().sort((a,b)=>(isOut(a)-isOut(b))||(by==="popular"?(sold[b.id]||0)-(sold[a.id]||0):0)||(pos.get(a.id)-pos.get(b.id)))}
function renderMenu(){
  const vis=DB.products.filter(p=>p.status!=="hidden");
  const groups=DB.categories.map(c=>({id:c.id,name:c.name,n:vis.filter(p=>p.cat===c.id).length})).filter(g=>g.n);
  const other=vis.filter(p=>!catName(p.cat)).length;
  if(other&&groups.length)groups.push({id:"none",name:"Other",n:other});
  if(shopCat!=="all"&&!groups.some(g=>g.id===shopCat))shopCat="all";
  $("#catBar").hidden=groups.length<2;
  $("#catBar").innerHTML=`<button class="fchip" type="button" data-scat="all" aria-pressed="${shopCat==="all"}">All</button>`+groups.map(g=>`<button class="fchip" type="button" data-scat="${g.id}" aria-pressed="${shopCat===g.id}">${esc(g.name)}</button>`).join("");
  const prods=menuOrder(shopCat==="all"||groups.length<2?vis:vis.filter(p=>shopCat==="none"?!catName(p.cat):p.cat===shopCat)),best=bestIds();
  $("#menuGrid").innerHTML = prods.map((p,i)=>{const bd=badgesOf(p,best).slice(0,2);
    const out=isOut(p),img=true,badge=p.surcharge>0?`<span class="xtra">+${money(p.surcharge)}</span>`:"",
      low=!out&&p.track&&p.stock<=DB.settings.lowStockAt?`<span class="stk">Only ${p.stock} left</span>`:"";
    return `<div class="card${out?" out":""}${img?"":" noimg"}" data-id="${p.id}" style="--i:${i}">
      ${img?`<div class="pwrap">${plateHTML(p)}${badge}${low}${bd.length?`<div class="bdgs">${bd.map(badgeHTML).join("")}</div>`:""}</div>`:""}
      <h4>${esc(p.name)}${img?"":badge}</h4>${(()=>{const r=ratingOf(p);return `<button class="rate${r.n?"":" none"}" type="button" data-reviews="${p.id}" aria-label="${r.n?`${r.avg.toFixed(1)} out of 5 stars, ${r.n} reviews. Read or write a review for ${esc(p.name)}`:`No reviews yet for ${esc(p.name)}`}">${r.n?`<span class="stars">★</span> ${r.avg.toFixed(1)} <span class="cnt">(${r.n})</span>`:"No reviews yet"}</button>`})()}<p>${esc(p.desc)}</p>
      ${out?`<span class="sold">${p.status==="soldout"?"Sold out today":"Out of stock"}</span>`:`<div class="stepper"><button type="button" data-act="dec" aria-label="Remove one ${esc(p.name)}">−</button><output aria-live="polite">0</output><button type="button" data-act="inc" aria-label="Add one ${esc(p.name)}">+</button></div>`}
    </div>`}).join("");
  $("#xtraHint").hidden=!prods.some(p=>p.surcharge>0&&!isOut(p));
}
function renderOpts(){
  const set=DB.settings;fixWhen();
  $("#modes").innerHTML=["sameday","pickup","scheduled"].filter(optOn).map(k=>{const ok=optAvail(k);return `<button class="chip" type="button" data-opt="${k}" ${ok?"":"disabled"}>${OPT_NAME[k]}${ok?"":" (closed today)"}</button>`}).join("");
  const sd=optOf(S)==="sameday";$("#dayBlock").hidden=sd;$("#timeBlock").hidden=sd;
  $("#days").innerHTML = dayOptions().map(d=>{const closed=set.closedWeekdays.includes(d.getDay());
    return `<button class="day" type="button" data-day="${ymd(d)}" ${closed?`disabled aria-label="${fmtDay(ymd(d))}, closed"`:""}><small>${DOW[d.getDay()]}</small><strong>${d.getDate()}</strong></button>`}).join("");
  const closedTxt=set.closedWeekdays.length?`We're closed ${listJoin(set.closedWeekdays.slice().sort().map(d=>DOW_LONG[d])).replace(" or "," and ")}. `:"";
  $("#daysHint").textContent=`${closedTxt}Order at least ${fmtLead(optLead(optOf(S)))} ahead. Orders after ${fmtHour(set.cutoffHour)} count from the next day. Time slots that are too soon are greyed out.`;
  renderTimes();
}
function renderTimes(){
  const k=optOf(S);$("#times").innerHTML=DB.settings.times.map(t=>{const off=!!S.day&&k!=="sameday"&&slotTooSoon(S.day,t,k);return `<button class="chip" type="button" data-time="${esc(t)}" ${off?`disabled aria-label="${esc(t)}, too soon"`:""}>${esc(t)}</button>`}).join("");
  document.querySelectorAll("[data-time]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.time===S.time));
}
function renderStoreStatic(){
  const set=DB.settings;
  renderMenu();renderMarquee($("#marq"),DB.marquee);
  renderOpts();
  const closedTxt=set.closedWeekdays.length?`We're closed ${listJoin(set.closedWeekdays.slice().sort().map(d=>DOW_LONG[d])).replace(" or "," and ")}. `:"";
  $("#heroStrip").innerHTML=[`Boxes of ${listJoin(activeSizes().map(s=>s.n))}`,set.samedayOn?`Sameday shipment before ${fmtHour(set.samedayCutoff)}`:"",optLead("scheduled")===24&&optLead("pickup")===24?`Order by ${fmtHour(set.cutoffHour)} for the next day`:`Order ${fmtLead(Math.min(optLead("pickup"),optLead("scheduled")))} ahead`,closedTxt?closedTxt.replace("We're closed ","Closed ").replace(/\. $/,""):""].filter(Boolean).map(t=>`<span>${t}</span>`).join("");
  renderLanding();
  $("#hours").innerHTML = set.hours.map(h=>`<dt>${esc(h[0])}</dt><dd>${esc(h[1])}</dd>`).join("");
  $("#addr").textContent = set.address;
  const act=DB.addons.filter(a=>a.active);
  $("#extrasBlock").hidden=!act.length;
  $("#extras").innerHTML=act.map(a=>`<button class="extra" type="button" data-addon="${a.id}" aria-pressed="false"><span class="tick">✓</span><span><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></span><span class="pr">+${money(a.price)}</span></button>`).join("");
  heroFloats($("#dome"),DB.page.hero);
}

function ctaState(){
  const left=S.size-S.box.length;
  if(S.step===1) return left>0?{label:`Pick ${left} more`,dis:true}:{label:"Choose a day",dis:false,go:"step2"};
  if(!S.day||!S.time) return {label:"Pick a day and time",dis:true};
  return {label:`Checkout (${money(total())})`,dis:false,go:"checkout"};
}
function renderStore(){
  let q=Q();
  if(S.coupon&&q.couponErr){cpMsg(`Coupon ${S.coupon}: ${q.couponErr}`,false);S.coupon="";q=Q()}
  // custom box
  {const t=DB.settings,cb=$("#customBox");cb.hidden=!t.customOn;
   if(t.customOn){const on=validCustom(S.size),n=on?S.size:snapCustom(S.cv||t.customMin);S.cv=n;
    const base=basePrice(n),sale=bestSale(n),now=sale?r2(base-saleDiscount(sale,base)):base;
    cb.dataset.on=on;
    cb.innerHTML=`<h4>Need a bigger box?</h4><p>Build your own from ${t.customMin} cookies, in steps of ${t.customStep}. ${money(t.customPer)} per cookie.</p>
    <div class="crow"><div class="stepper" role="group" aria-label="Custom box size"><button type="button" data-cstep="-1" aria-label="Fewer cookies" ${n<=t.customMin?"disabled":""}>−</button><input id="cvIn" type="number" inputmode="numeric" min="${t.customMin}" max="${t.customMax}" step="${t.customStep}" value="${n}" aria-label="Number of cookies"><button type="button" data-cstep="1" aria-label="More cookies" ${n+t.customStep>t.customMax?"disabled":""}>+</button></div>
    <span class="cprice num">${sale?`<s style="opacity:.6;font-weight:400">${money(base)}</s> `:""}${money(now)}</span>
    <button class="btn btn-blue btn-sm cuse" type="button" data-cuse ${on?"disabled":""}>${on?"Selected":`Use box of ${n}`}</button></div>`}}
  // sizes (with live sale prices)
  $("#sizes").innerHTML = activeSizes().map(s=>{const sale=bestSale(s.n),now=sale?r2(s.price-saleDiscount(sale,s.price)):s.price;
    return `<button class="size" type="button" data-size="${s.n}" aria-pressed="${s.n===S.size}">${sale?`<span class="saletag">${sale.type==="percent"?"−"+sale.value+"%":"Sale"}</span>`:""}<strong>${s.n}</strong><small>COOKIES</small><span class="num">${sale?`<s>${money(s.price)}</s>`:""}${money(now)}</span></button>`}).join("");
  document.querySelectorAll(".card").forEach(c=>{const st=c.querySelector(".stepper");if(!st)return;const n=countOf(c.dataset.id);st.querySelector("output").textContent=n;c.classList.toggle("has",n>0);
    st.querySelector('[data-act="dec"]').disabled=n===0;st.querySelector('[data-act="inc"]').disabled=full()||n>=stockLeft(prod(c.dataset.id))});
  $("#fillRest").disabled=full();
  $("#step1").hidden=S.step!==1; $("#step2").hidden=S.step!==2;
  $("#tab1").setAttribute("aria-current",S.step===1?"step":"false");
  $("#tab2").setAttribute("aria-current",S.step===2?"step":"false");
  $("#tab1").classList.toggle("done",S.step===2&&full());
  $("#tab2").disabled=!full();
  document.querySelectorAll("[data-opt]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.opt===optOf(S)));
  {const k=optOf(S),st=DB.settings;const fdp=k!=="pickup"?freeDelSale(S.size):null;$("#modeHint").textContent=(fdp?`🚚 Free delivery promo is on: ${fdp.name}. `:"")+(k==="sameday"?`Sameday shipment adds ${money(st.samedayFee??st.deliveryFee)}. Order before ${fmtHour(st.samedayCutoff)} and we ship about ${fmtLead(optLead("sameday"))} after your payment is confirmed. We deliver within ${st.deliveryKm} km of the shop.`:k==="scheduled"?`Scheduled delivery adds ${money(st.deliveryFee)}. Pick a day and time. We deliver within ${st.deliveryKm} km of the shop.`:"Free pickup at the front counter. Pick a day and time.");}
  document.querySelectorAll(".day").forEach(b=>b.setAttribute("aria-pressed",b.dataset.day===S.day));
  document.querySelectorAll("[data-time]").forEach(b=>b.setAttribute("aria-pressed",b.dataset.time===S.time));
  document.querySelectorAll("[data-addon]").forEach(b=>b.setAttribute("aria-pressed",S.addons.includes(b.dataset.addon)));
  $("#giftNote").value=S.note;
  // box panel
  const cols=S.size<=4?2:S.size<=9?3:4;
  $("#slots").style.gridTemplateColumns=`repeat(${cols},minmax(0,1fr))`;
  $("#slots").innerHTML=Array.from({length:S.size},(_,i)=>{const id=S.box[i];if(!id)return `<div class="slot" aria-hidden="true"></div>`;
    const p=prod(id),pd=pop.get(i);return `<button class="slot filled${pd!==undefined?" pop":""}" type="button" data-slot="${i}" style="--i:${i};--pd:${pd||0}ms" aria-label="Remove ${esc(p.name)}">${plateHTML(p)}</button>`}).join("");
  $("#bpTitle").textContent=`Box of ${S.size}`;
  $("#bpCount").textContent=`${S.box.length} of ${S.size}`;
  $("#pillCount").textContent=`${S.box.length}/${S.size}`;
  let L=`<div><dt>Box of ${S.size}</dt><dd>${money(q.base)}</dd></div>`;
  if(q.sale)L+=`<div class="saleln"><dt>${esc(q.sale.name)} (${saleOffText(q.sale)})</dt><dd>−${money(q.discount)}</dd></div>`;
  if(q.coupon&&q.couponDisc>0)L+=`<div class="saleln"><dt>Coupon ${esc(q.coupon.code)}</dt><dd>−${money(q.couponDisc)}</dd></div>`;
  if(q.surcharge>0)L+=`<div><dt>Premium flavors</dt><dd>+${money(q.surcharge)}</dd></div>`;
  if(S.step===2){
    S.addons.forEach(id=>{const a=DB.addons.find(x=>x.id===id);if(a)L+=`<div><dt>${esc(a.name)}</dt><dd>+${money(a.price)}</dd></div>`});
    L+=`<div><dt>${OPT_NAME[optOf(S)]}</dt><dd>${q.fee?money(q.fee):"Free"}</dd></div>`;
    if(S.day)L+=`<div><dt>When</dt><dd>${S.mode!=="pickup"&&S.speed==="sameday"?"Today (sameday)":fmtDay(S.day)+(S.time?", "+esc(S.time):"")}</dd></div>`;
  }
  $("#lines").innerHTML=L;
  renderCoupon(q);
  $("#total").textContent=money(total());
  const c=ctaState();
  for(const b of [$("#panelCta"),$("#barCta")]){b.textContent=c.label;b.disabled=c.dis;b.dataset.go=c.go||"";b.classList.toggle("ready",!c.dis)}
  $("#clearBtn").disabled=!S.box.length;
  $("#randBtn").disabled=!availProducts().length;
  $("#randLabel").textContent=full()?"Shuffle box":"Random fill";
  pop.clear();
  $("#barTotal").textContent=money(total());
  $("#barSub").textContent=S.step===1?`${S.box.length} of ${S.size} picked`:`Box of ${S.size}`;
  updateFlash();
  saveCart();
}
function anRender(el,k,cfg,AN,text,ms){
  const c=cfg[k],sig=JSON.stringify([k,text,c.label,c.bg,c.ink,AN.size,AN.cdSize,AN.cdColor,AN.cdBg,AN.cdFx,AN.imgOn&&c.img?c.img.length:0,AN.imgFx]);
  if(el._sig!==sig){el._sig=sig;el._ai=null;el.style.removeProperty("--mdur");el.style.removeProperty("--mbg");
    el.style.setProperty("--fl-bg",c.bg);el.style.setProperty("--fl-ink",c.ink);el.style.setProperty("--fl-cd",AN.cdColor);el.style.setProperty("--fl-cdbg",AN.cdBg);
    el.className="flash sz-"+AN.size+" cds-"+(AN.cdSize||"L")+(AN.cdFx?" fx-cd":"")+(AN.imgOn&&c.img&&AN.imgFx?" fx-img":"")+(el.id==="flash"?" pinned":"");
    el.innerHTML=`<div class="fw">${AN.imgOn&&c.img?`<img class="fimg" src="${esc(c.img)}" alt="">`:`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M9.5 1 3 9h4l-1 6 6.5-8h-4z" fill="currentColor"/></svg>`}<span class="ftx">${esc(text)}</span>${ms===null?"":`<span class="cdn"></span>`}</div>`}
  const cd=el.querySelector(".cdn");if(cd)cd.textContent=(c.label?c.label+" ":"")+fmtDur(ms);
}
function anCustomMs(c,now){if(!c.endsAt)return null;const t=new Date(c.endsAt).getTime();return isNaN(t)?null:t-now}
// everything the announcer can say right now: live sales, free delivery promos, coming-up ones (24 h ahead) and the owner's own note
function anFill(t,s){return t.replace(/\{name\}/g,s.name).replace(/\{off\}/g,saleOffText(s)).replace(/\{applies\}/g,saleAppliesText(s))}
function anItems(now,AN){
  const items=[];
  DB.sales.filter(s=>saleStatus(s,now)==="live").sort((a,b)=>a.end-b.end).forEach(s=>{const k=isFD(s)?"fdlive":"live";items.push({k,text:anFill(AN[k].text,s),end:s.end})});
  DB.sales.filter(s=>saleStatus(s,now)==="scheduled"&&s.start-now<24*3600e3).sort((a,b)=>a.start-b.start).forEach(s=>{const k=isFD(s)?"fdsoon":"soon";items.push({k,text:anFill(AN[k].text,s),end:s.start})});
  const cm=AN.custom.on&&AN.custom.text?anCustomMs(AN.custom,now):undefined;
  if(AN.custom.on&&AN.custom.text&&!(cm!==null&&cm!==undefined&&cm<=0))items.push({k:"custom",text:AN.custom.text,end:cm===undefined||cm===null?null:now+cm});
  return items;
}
function updateFlash(now=Date.now()){
  applyCdLook();
  const AN=DB.announcer,el=$("#flash"),hdr=$(".top");
  const items=AN.on?anItems(now,AN):[];
  if(!items.length){el.hidden=true;return}
  if(AN.sticky){if(el.parentNode!==hdr)hdr.appendChild(el)}else if(el.parentNode===hdr)hdr.after(el);
  el.hidden=false;
  if(items.length>1)anMarquee(el,items,AN,now);   // two or more at once: one running line
  else anRender(el,items[0].k,AN,AN,items[0].text,items[0].end===null?null:items[0].end-now);
  el.classList.toggle("pinned",!!AN.sticky);
  if(!AN.sticky)el.classList.remove("pinned");
}
// ----- announcer marquee (used when several announcements show at the same time) -----
let anFace=null,anFaceKey="";
function anEnsureFont(m){
  if(!m.fontData){if(anFace){try{document.fonts.delete(anFace)}catch(e){}anFace=null;anFaceKey=""}return}
  const key=m.fontName+m.fontData.length;if(key===anFaceKey)return;
  try{if(anFace)document.fonts.delete(anFace);anFace=new FontFace("DD Announcer",`url(${m.fontData})`);document.fonts.add(anFace);anFaceKey=key;anFace.load().then(()=>{document.querySelectorAll(".anmq").forEach(e=>{if(e._ai)anMqBuild(e)})}).catch(()=>{})}catch(e){}
}
const anFontFam=m=>m.font==="custom"&&m.fontData?'"DD Announcer",var(--body)':(MQ_FONTS[m.font]||MQ_FONTS.display)[1];
function anMqSeq(items,AN,n){
  const m=AN.mq,out=[];
  for(let r=0;r<n;r++)items.forEach(it=>{const c=AN[it.k];
    out.push(`<span class="mt anit">${AN.imgOn&&c.img?`<img class="fimg" src="${esc(c.img)}" alt="">`:""}<span class="ftx">${esc(it.text)}</span>${it.end===null?"":`<span class="cdn" data-end="${it.end}" data-lab="${esc(c.label||"")}"></span>`}</span>`);
    out.push(m.sepOn&&m.sepImg?`<img class="mi" src="${esc(imgOk(m.sepImg))}" alt="" draggable="false">`:`<span class="mdot" aria-hidden="true">✦</span>`)});
  return out.join("");
}
function anMqBuild(el){
  const ai=el._ai;if(!ai)return;const {items,AN}=ai;
  el.classList.toggle("still",RM);
  const draw=n=>{const set=anMqSeq(items,AN,n);el.innerHTML=`<div class="track"><div class="set">${set}</div><div class="set" aria-hidden="true">${set}</div></div>`};
  draw(1);
  const cw=el.clientWidth;if(!cw){anCd(el,Date.now());return}
  const w1=el.querySelector(".set").scrollWidth||1,n=Math.max(1,Math.ceil(cw/w1));
  if(n>1)draw(n);
  const w=el.querySelector(".set").scrollWidth;
  el.style.setProperty("--mdur",Math.max(6,w/(MQ_SPEED[AN.mq.speed]||70))+"s");
  anCd(el,Date.now());
}
function anCd(el,now){el.querySelectorAll(".cdn[data-end]").forEach(c=>{const ms=+c.dataset.end-now;c.textContent=(c.dataset.lab?c.dataset.lab+" ":"")+fmtDur(Math.max(0,ms))})}
function anMarquee(el,items,AN,now){
  const m=AN.mq,sig="M"+JSON.stringify([items.map(i=>[i.k,i.text,i.end,AN[i.k].label,AN.imgOn&&AN[i.k].img?AN[i.k].img.length:0]),m,m.sepImg?m.sepImg.length:0,AN.cdSize,AN.cdColor,AN.cdBg,AN.cdFx,AN.imgOn,AN.imgFx]);
  if(el._sig!==sig){el._sig=sig;anEnsureFont(m);
    el.style.setProperty("--mbg",m.bg);el.style.setProperty("--mfg",m.ink);el.style.setProperty("--msz",(MQ_SIZE[m.size]||18)+"px");el.style.setProperty("--mfont",anFontFam(m));
    el.style.setProperty("--fl-bg",m.bg);el.style.setProperty("--fl-ink",m.ink);el.style.setProperty("--fl-cd",AN.cdColor);el.style.setProperty("--fl-cdbg",AN.cdBg);
    el.className="flash marq anmq cds-"+(AN.cdSize||"L")+(AN.cdFx?" fx-cd":"")+(AN.imgOn&&AN.imgFx?" fx-img":"")+(el.id==="flash"?" pinned":"");
    el.setAttribute("aria-label",items.map(i=>i.text).join(". "));
    el._ai={items,AN};anMqBuild(el)}
  else anCd(el,now);
}

/* --- motion helpers --- */
const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pop = new Map();
const inView = r => r.bottom>0 && r.top<innerHeight;
function fx(html,cls){const d=document.createElement("div");d.className="fx "+(cls||"");d.innerHTML=html;document.body.appendChild(d);return d}
function squash(el){el.animate([{transform:"scale(1)"},{transform:"scale(1.2,.84) rotate(-10deg)"},{transform:"scale(.9,1.14) rotate(8deg)"},{transform:"scale(1.05) rotate(-2deg)"},{transform:"scale(1)"}],{duration:520,easing:"ease-out"})}
function shake(el){el.animate([{transform:"none"},{transform:"translateX(-8px) scale(.92) rotate(-8deg)"},{transform:"translateX(7px) scale(.92) rotate(7deg)"},{transform:"translateX(-3px) scale(.97)"},{transform:"none"}],{duration:400,easing:"ease-out"})}
function bump(el){el.animate([{transform:"scale(1)"},{transform:"scale(1.5)"},{transform:"scale(1)"}],{duration:320,easing:"ease-out"})}
function tag(el,text){const r=el.getBoundingClientRect(),t=fx(text,"fx-tag");
  t.style.transform=`translate(${r.left+r.width/2-16}px,${r.top-6}px)`;
  t.animate([{opacity:0,transform:t.style.transform+" scale(.6)"},{opacity:1,offset:.25,transform:t.style.transform+" translateY(-14px) scale(1.1)"},{opacity:0,transform:t.style.transform+" translateY(-40px) scale(1)"}],{duration:750,easing:"ease-out"}).onfinish=()=>t.remove()}
function crumbs(el,f){const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,cols=[f.dough,f.edge,...f.chips];
  for(let i=0;i<10;i++){const s=4+Math.random()*5,c=fx("");Object.assign(c.style,{width:s+"px",height:s+"px",borderRadius:"40%",background:cols[i%cols.length]});
    const a=Math.random()*Math.PI*2,d=r.width*(.45+Math.random()*.35),x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d;
    c.animate([{transform:`translate(${cx}px,${cy}px) scale(1)`,opacity:1},{transform:`translate(${x}px,${y}px) rotate(${Math.random()*360}deg) scale(1)`,opacity:1,offset:.55},{transform:`translate(${x}px,${y+30}px) scale(.3)`,opacity:0}],{duration:650+Math.random()*200,easing:"cubic-bezier(.2,.7,.4,1)"}).onfinish=()=>c.remove()}}
function flyIn(srcPlate,idx,html){
  const slot=document.querySelector(`[data-slot="${idx}"]`);if(!slot)return;
  let dst=slot.getBoundingClientRect(),toBar=false;
  if(!inView(dst)){const bar=$("#barTotal");if(bar.offsetParent){dst=bar.getBoundingClientRect();toBar=true}else return}
  let src=srcPlate.getBoundingClientRect();
  if(html){const cx=src.left+src.width/2,cy=src.top+src.height/2;src={left:cx-28,top:cy-28,width:56,height:56}}
  const g=fx(html||srcPlate.outerHTML);
  Object.assign(g.style,{width:src.width+"px",height:src.height+"px",transformOrigin:"0 0"});
  const s=toBar?.35:dst.width/src.width,dx=dst.left-src.left,dy=dst.top-src.top;
  if(!toBar)slot.style.visibility="hidden";
  g.animate([{transform:`translate(${src.left}px,${src.top}px) scale(1) rotate(0)`},
    {transform:`translate(${src.left+dx*.5}px,${src.top+dy*.5-90}px) scale(${(1+s)/2}) rotate(200deg)`,offset:.5},
    {transform:`translate(${dst.left}px,${dst.top}px) scale(${s}) rotate(360deg)`}],{duration:620,easing:"cubic-bezier(.45,0,.25,1)"}).onfinish=()=>{
      g.remove();
      if(toBar){bump($("#barTotal"));return}
      slot.style.visibility="";slot.animate([{transform:"scale(.7)"},{transform:"scale(1.18)"},{transform:"scale(1)"}],{duration:320,easing:"ease-out"})}
}
function ghostOut(i){
  if(RM)return;const el=document.querySelector(`[data-slot="${i}"]`);if(!el)return;const r=el.getBoundingClientRect();if(!inView(r))return;
  const g=fx((el.querySelector(".plate")||el.querySelector(".noimg-t")).outerHTML);Object.assign(g.style,{width:r.width+"px",height:r.height+"px"});
  const t=`translate(${r.left}px,${r.top}px)`;
  g.animate([{transform:t+" scale(1)",opacity:1},{transform:t+" scale(1.2) rotate(-25deg)",opacity:1,offset:.3},{transform:t+" translateY(40px) scale(0) rotate(180deg)",opacity:0}],{duration:450,easing:"ease-in"}).onfinish=()=>g.remove()
}
function celebrate(){if(RM)return;const p=$(".boxpanel");
  p.animate([{transform:"scale(1)"},{transform:"scale(1.03) rotate(-.6deg)"},{transform:"scale(.99) rotate(.4deg)"},{transform:"scale(1)"}],{duration:600,delay:400,easing:"ease-out"});
  if(inView(p.getBoundingClientRect()))crumbs(p.querySelector(".slots"),{dough:"#FFFFFF",edge:"#D9DCFA",chips:["#FFFFFF","#EEF0FF"]})}

/* --- box actions --- */
function setSize(n){S.size=n;if(S.box.length>n)S.box=S.box.slice(0,n);if(!full())S.step=1;renderStore()}

function cpMsg(t,ok){const m=$("#cpnMsg");if(!m)return;m.textContent=t||"";m.hidden=!t;m.classList.toggle("ok",!!ok);clearTimeout(cpMsg.t);if(t)cpMsg.t=setTimeout(()=>{m.hidden=true},6000)}
function renderCoupon(q){
  const ap=$("#cpnAp"),f=$("#cpnForm"),ch=$("#cpnCh");if(!ap)return;
  const on=!!(S.coupon&&q.coupon);
  if(on){ap.hidden=false;ap.innerHTML=`<span>🎟 <b>${esc(q.coupon.code)}</b> applied${q.couponDisc>0?` · −${money(q.couponDisc)}`:q.coupon.type==="freedelivery"?(S.mode==="delivery"?" · free delivery":" · free delivery when you pick delivery"):""}</span><button type="button" data-cpnrm aria-label="Remove coupon">✕</button>`}else ap.hidden=true;
  f.hidden=on;
  const list=DB.coupons.filter(c=>c.show&&cpState(c)==="live"&&!(on&&q.coupon.code===c.code));
  ch.innerHTML=on?"":list.map(c=>`<button type="button" data-cpnuse="${esc(c.code)}"><b>${esc(c.code)}</b><small>${esc(c.desc||cpOff(c))}${c.minSpend>0?` · min ${money(c.minSpend)}`:""}</small></button>`).join("");
}
async function applyCoupon(code){
  code=cpNorm(code);if(!code){cpMsg("Type your coupon code first.",false);return}
  if(SBH.on){const r=await SBH.checkCoupon(code,S.size,($("#coPhone")||{}).value||"",S.editId).catch(ex=>({ok:false,err:ex.message}));if(!r.ok){cpMsg(r.err,false);return}}
  const q0=quote({...S,coupon:code},DB,{withDelivery:S.step===2});
  if(q0.couponErr){cpMsg(q0.couponErr,false);return}
  S.coupon=code;$("#cpnIn").value="";renderStore();
  cpMsg(q0.couponDisc>0?`Nice! You saved ${money(q0.couponDisc)}.`:"Coupon added.",true);
  const ap=$("#cpnAp");if(ap&&!RM)ap.animate([{transform:"scale(1)"},{transform:"scale(1.06)"},{transform:"scale(1)"}],{duration:400})
}
$("#cpnForm").addEventListener("submit",e=>{e.preventDefault();applyCoupon($("#cpnIn").value)});
$("#cpn").addEventListener("click",e=>{const u=e.target.closest("[data-cpnuse]");if(u){applyCoupon(u.dataset.cpnuse);return}
  if(e.target.closest("[data-cpnrm]")){S.coupon="";renderStore();cpMsg("Coupon removed.",true)}});
// tap the cookie picture to add it
$("#menuGrid").addEventListener("click",e=>{
  if(e.target.closest("button,a,.stepper"))return;
  const w=e.target.closest(".pwrap, h4");if(!w)return;const card=w.closest(".card");if(!card||card.classList.contains("out"))return;
  const id=card.dataset.id;if(full()){toast(`Your box is full. Remove a cookie to add another.`);return}add(id,card)});
function add(id,card){
  if(full())return;
  if(countOf(id)>=stockLeft(prod(id))){toast(`That's all we have of ${prod(id).name} right now`);return}
  S.box.push(id);const idx=S.box.length-1;
  if(!card||RM)pop.set(idx,0);
  renderStore();
  if(card&&!RM){const pl=card.querySelector(".plate"),p=prod(id),st=card.querySelector(".stepper");
    squash(pl||card.querySelector("h4"));crumbs(pl||st,crumbColors(p));bump(card.querySelector("output"));tag(st,p.surcharge>0?`+1 · +${money(p.surcharge)}`:"+1");
    flyIn(pl,idx)}
  if(full())celebrate();
}
function removeAt(i){
  const id=S.box[i];if(id===undefined)return;ghostOut(i);S.box.splice(i,1);S.step=1;renderStore();
  if(!RM){const card=document.querySelector(`.card[data-id="${id}"]`);if(card&&inView(card.getBoundingClientRect())){shake(card.querySelector(".plate")||card.querySelector("h4"));bump(card.querySelector("output"))}}
}
function removeOne(id,card){const i=S.box.lastIndexOf(id);if(i<0)return;removeAt(i);if(card&&!RM)tag(card.querySelector(".stepper"),"−1")}
const randomId = () => {const a=pickable();return a.length?a[Math.floor(Math.random()*a.length)].id:null};
function fillBox(base){
  let k=0;while(!full()){const id=randomId();if(!id)break;S.box.push(id);S.shuf=1;pop.set(S.box.length-1,base+k++*80)}
  if(!full())toast("Not enough stock to fill the whole box");
}
function fillRest(){if(!pickable().length){toast("Every flavor is out of stock right now");return}fillBox(0);renderStore();if(full())celebrate()}
function randomFill(){
  if(!availProducts().length){toast("Every flavor is out of stock right now");return}let base=0;
  if(full()){S.box.forEach((_,i)=>ghostOut(i));S.box=[];S.shuf=0;base=180}
  fillBox(base);
  renderStore();if(full())celebrate();
  if(!RM)$("#randBtn svg").animate([{transform:"rotate(0)"},{transform:"rotate(360deg)"}],{duration:500,easing:"ease-out"});
}
function clearBox(){if(!S.box.length)return;S.shuf=0;S.box.forEach((_,i)=>ghostOut(i));S.box=[];S.step=1;renderStore()}
function scrollToEl(el){
  const go=()=>{const fl=$("#flash"),head=$(".top").getBoundingClientRect().height+(fl.hidden||fl.parentNode===$(".top")?0:fl.getBoundingClientRect().height);
    const y=el.getBoundingClientRect().top+window.scrollY-head-16;
    window.scrollTo({top:Math.max(0,y),behavior:"instant"})};
  go();requestAnimationFrame(go);setTimeout(go,120);setTimeout(go,400);
}
function goStep(n){if(n===2&&!full())return;S.step=n;renderStore();
  if(document.activeElement)document.activeElement.blur();
  scrollToEl($(n===2?"#step2":"#build"))}
function cta(go){if(go==="step2")goStep(2);else if(go==="checkout")openCheckout()}

const CUST_KEY="delidome-cust-v1";
function loadCust(){try{return JSON.parse(localStorage.getItem(CUST_KEY)||"{}")||{}}catch(e){return {}}}
function saveCust(){try{const r=document.querySelector('input[name="coNotify"]:checked');localStorage.setItem(CUST_KEY,JSON.stringify({name:$("#coName").value,phone:$("#coPhone").value,email:$("#coEmail").value,address:$("#coAddr").value,notify:r?r.value:"both"}))}catch(e){}}
function prefillCust(){const c=loadCust();[["#coName","name"],["#coPhone","phone"],["#coEmail","email"],["#coAddr","address"]].forEach(([q,k])=>{if(c[k]&&!$(q).value)$(q).value=c[k]});const r=c.notify&&document.querySelector(`input[name="coNotify"][value="${c.notify}"]`);if(r)r.checked=true}
function openCheckout(){
  const q=quote(S),counts=countItems(S.box);
  $("#summary").innerHTML=`<div><span>Box of ${S.size}</span><span class="num">${money(q.base)}</span></div>`+
    Object.entries(counts).map(([id,n])=>{const p=prod(id);return `<div class="m"><span>${n} × ${esc(p.name)}</span><span>${p.surcharge>0?"+"+money(p.surcharge*n):""}</span></div>`}).join("")+
    (q.sale?`<div class="sl"><span>${esc(q.sale.name)} (${saleOffText(q.sale)})</span><span class="num">−${money(q.discount)}</span></div>`:"")+
    (q.coupon&&q.couponDisc>0?`<div class="sl"><span>Coupon ${esc(q.coupon.code)}</span><span class="num">−${money(q.couponDisc)}</span></div>`:"")+
    S.addons.map(id=>{const a=DB.addons.find(x=>x.id===id);return a?`<div><span>${esc(a.name)}</span><span class="num">+${money(a.price)}</span></div>`:""}).join("")+
    `<div><span>${OPT_NAME[optOf(S)]}</span><span class="num">${q.fee?money(q.fee):"Free"}</span></div>`+
    `<div><span>When</span><span>${esc(whenTxt(S))}</span></div>`+
    (S.note?`<div><span>Note</span><span style="text-align:right">${esc(S.note)}</span></div>`:"")+
    `<div class="t"><span>Total</span><span class="num">${money(q.total)}</span></div>`;
  const del=S.mode==="delivery";$("#addrFields").hidden=!del;
  $("#coAddr").required=del;
  const eo=S.editId&&DB.orders.find(x=>x.id===S.editId);
  if(!eo)prefillCust();
  if(eo){const c=eo.customer;$("#coEmail").value=c.email;$("#coName").value=c.name;$("#coPhone").value=c.phone;$("#coAddr").value=c.address||"";const nr=document.querySelector(`input[name="coNotify"][value="${eo.notify||"both"}"]`);if(nr)nr.checked=true}
  $("#sheetTitle").textContent=eo?"Review changes":"Checkout";$("#placeBtn").textContent=eo?"Save changes":"Place order";
  $("#coNote").textContent=eo?`Your original payment deadline stays the same (${fmtLeft(eo.expiresAt-Date.now())} left).`:`You'll have ${fmtSpan(payDeadlineMs(S)-Date.now())} to pay after placing your order. Unpaid orders are cancelled automatically.`+(S.mode==="delivery"?" Your box may be split into smaller or bigger boxes for delivery safety.":"");
  $("#coErr").hidden=true;$("#checkoutView").hidden=false;$("#doneView").hidden=true;
  $("#sheet").hidden=false;document.body.style.overflow="hidden";setTimeout(()=>$("#coName").focus(),50);
}
function closeSheet(){$("#sheet").hidden=true;document.body.style.overflow="";$("#sheet .sheet-card").style.background="";$("#dnFx")&&($("#dnFx").innerHTML="");endPreview()}

/* --- shop wiring --- */
/* --- shop reviews --- */
const RV={pid:null,stars:0};
function rvEligible(pid){return mineOrders().filter(o=>o.status==="completed"&&o.items&&o.items[pid]&&!(o.rated||{})[pid])}
function renderReviews(){
  const p=prod(RV.pid);if(!p){closeReviews();return}
  const {n,avg}=ratingOf(p),rs=p.reviews.slice().sort((a,b)=>b.at-a.at),el=rvEligible(p.id);
  if(!el.some(o=>o.id===RV.oid))RV.oid=el[0]?el[0].id:null;
  $("#rvCard").innerHTML=`<div class="sheet-top"><div><h3>${esc(p.name)}</h3><span class="note">${n?`<span class="stars">${starStr(Math.round(avg))}</span> ${avg.toFixed(1)} · ${n} review${n>1?"s":""}`:"No reviews yet."}</span></div><button class="x" type="button" data-rvclose aria-label="Close">✕</button></div>
  <div class="rvlist">${rs.map(r=>`<article class="rv"><div class="rv-h"><b>${esc(r.user)}</b>${r.example?`<span class="ex">Sample</span>`:""}${r.verified||r.orderId?`<span class="vf">✓ Bought it</span>`:""}<span class="stars" role="img" aria-label="${r.stars} out of 5 stars">${starStr(r.stars)}</span><small>${fmtShort(r.at)}</small></div><p>${esc(r.text)}</p></article>`).join("")}</div>
  ${el.length?`<form class="form" id="rvForm" novalidate style="margin-top:${n?18:10}px"><h4 style="margin:0">Review your ${esc(p.name)}</h4>
    ${el.length>1?`<div class="field"><label for="rvOrder">From order</label><select class="in" id="rvOrder">${el.map(o=>`<option value="${o.id}" ${o.id===RV.oid?"selected":""}>${esc(o.code)} · ${fmtDay(o.day)}</option>`).join("")}</select></div>`:`<p class="note" style="margin:0">From your order ${esc(el[0].code)}. One review per flavor per order.</p>`}
    <div class="field"><span class="lblx" id="rvRateLbl">Rating</span><div class="starpick" role="radiogroup" aria-labelledby="rvRateLbl">${[1,2,3,4,5].map(i=>`<button type="button" class="sp${i<=RV.stars?" on":""}" data-sp="${i}" role="radio" aria-checked="${i===RV.stars}" aria-label="${i} star${i>1?"s":""}">★</button>`).join("")}</div></div>
    <div class="field"><label for="rvText">Your review (optional)</label><textarea id="rvText" rows="3" maxlength="200" placeholder="What did you think?"></textarea></div>
    <p class="err" id="rvErr" hidden></p><button class="btn btn-blue" type="submit">Post review</button></form>`
  :`<div class="rvlock"><b>Only customers who bought ${esc(p.name)} can review it.</b><span>You can review each flavor once per order, after it's delivered or picked up. Find it in My orders.</span></div>`}`;
}
// one rating per flavor per order, proven by the order's secret token on the server
function rateOrder(o,rt){
  if(SBH.on)return SBH.rate(o.id,rt);
  o.rated=o.rated||{};Object.entries(rt).forEach(([pid,r])=>{const p=prod(pid);if(!p||o.rated[pid]||!o.items[pid])return;
    p.reviews.push({id:uid(),user:(o.customer.name.split(' ')[0]||'Customer').slice(0,30),text:(r.comment||'').trim()||'Rated '+r.n+' out of 5',stars:r.n,at:Date.now(),src:'customer',orderId:o.id});o.rated[pid]=r.n});
  saveDB();return Promise.resolve();
}
function openReviews(id){RV.pid=id;RV.stars=0;RV.oid=null;renderReviews();$("#rvSheet").hidden=false;document.body.style.overflow="hidden"}
function closeReviews(){const m=$("#rvSheet");if(!m||m.hidden)return;m.hidden=true;document.body.style.overflow=""}
$("#menuGrid").addEventListener("click",e=>{const b=e.target.closest("[data-reviews]");if(b)openReviews(b.dataset.reviews)});
$("#rvSheet").addEventListener("click",e=>{
  if(e.target.id==="rvSheet"||e.target.closest("[data-rvclose]")){closeReviews();return}
  const sp=e.target.closest("[data-sp]");
  if(sp){RV.stars=+sp.dataset.sp;document.querySelectorAll("#rvForm .sp").forEach(b=>{const i=+b.dataset.sp;b.classList.toggle("on",i<=RV.stars);b.setAttribute("aria-checked",i===RV.stars)})}
});
$("#rvSheet").addEventListener("change",e=>{if(e.target.id==="rvOrder")RV.oid=e.target.value});
$("#rvSheet").addEventListener("submit",e=>{
  if(e.target.id!=="rvForm")return;e.preventDefault();
  const o=DB.orders.find(x=>x.id===RV.oid),text=$("#rvText").value.trim(),err=$("#rvErr");
  const fail=m=>{err.textContent=m;err.hidden=false};
  if(!o)return fail("We couldn't find your order. Open My orders and try again.");
  if(!RV.stars)return fail("Tap a star rating.");
  const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;
  rateOrder(o,{[RV.pid]:{n:RV.stars,comment:text}}).then(()=>{RV.stars=0;renderReviews();toast("Thanks for your review");renderMenu();renderStore()}).catch(ex=>{btn.disabled=false;fail(ex.message)});
});
$("#catBar").addEventListener("click",e=>{const b=e.target.closest("[data-scat]");if(!b)return;shopCat=b.dataset.scat;renderMenu();renderStore()});
function setCustom(n){S.cv=snapCustom(n);if(validCustom(S.size))setSize(S.cv);else renderStore()}
$("#customBox").addEventListener("click",e=>{const st=e.target.closest("[data-cstep]"),u=e.target.closest("[data-cuse]"),t=DB.settings;
  if(st){const n=(S.cv||t.customMin)+(+st.dataset.cstep)*t.customStep;setCustom(Math.min(Math.max(n,t.customMin),t.customMax))}
  else if(u)setSize(snapCustom(S.cv))});
$("#customBox").addEventListener("change",e=>{if(e.target.id==="cvIn")setCustom(e.target.value)});
$("#customBox").addEventListener("keydown",e=>{if(e.target.id==="cvIn"&&e.key==="Enter"){e.preventDefault();e.target.blur()}});
$("#sizes").addEventListener("click",e=>{const b=e.target.closest("[data-size]");if(b)setSize(+b.dataset.size)});
$("#menuGrid").addEventListener("click",e=>{const b=e.target.closest("[data-act]");if(!b)return;const card=b.closest(".card"),id=card.dataset.id;b.dataset.act==="inc"?add(id,card):removeOne(id,card)});
$("#slots").addEventListener("click",e=>{const b=e.target.closest("[data-slot]");if(b)removeAt(+b.dataset.slot)});
$("#fillRest").addEventListener("click",fillRest);
$("#randBtn").addEventListener("click",randomFill);
$("#clearBtn").addEventListener("click",clearBox);
$("#tab1").addEventListener("click",()=>goStep(1));
$("#tab2").addEventListener("click",()=>goStep(2));
$("#backBtn").addEventListener("click",()=>goStep(1));
$("#modes").addEventListener("click",e=>{const b=e.target.closest("[data-opt]");if(b&&!b.disabled){const k=b.dataset.opt;S.mode=k==="pickup"?"pickup":"delivery";S.speed=k==="sameday"?"sameday":"scheduled";renderOpts();renderStore()}});
$("#days").addEventListener("click",e=>{const b=e.target.closest("[data-day]");if(b&&!b.disabled){S.day=b.dataset.day;if(S.time&&slotTooSoon(S.day,S.time,optOf(S)))S.time=null;renderTimes();renderStore()}});
$("#times").addEventListener("click",e=>{const b=e.target.closest("[data-time]");if(b){S.time=b.dataset.time;renderStore()}});
$("#extras").addEventListener("click",e=>{const b=e.target.closest("[data-addon]");if(!b)return;const id=b.dataset.addon;
  S.addons=S.addons.includes(id)?S.addons.filter(x=>x!==id):[...S.addons,id];renderStore();if(!RM&&S.addons.includes(id))bump(b.querySelector(".tick"))});
$("#giftNote").addEventListener("input",e=>{S.note=e.target.value;saveCart()});
$("#coForm").addEventListener("input",saveCust);$("#coForm").addEventListener("change",saveCust);
$("#panelCta").addEventListener("click",e=>cta(e.currentTarget.dataset.go));
$("#barCta").addEventListener("click",e=>cta(e.currentTarget.dataset.go));
$("#pillBtn").addEventListener("click",()=>{const b=$("#pillBtn");b.classList.add("tapped");clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove("tapped"),1400);scrollToEl($("#build"))});
$("#closeSheet").addEventListener("click",closeSheet);
$("#sheet").addEventListener("click",e=>{if(e.target.id==="sheet")closeSheet()});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;if(!$("#sheet").hidden)closeSheet();if(!$("#drawer").hidden)closeDrawer();closeModal();closeReviews();closeMO()});
$("#moSheet").addEventListener("input",e=>{if(e.target.id==="moMail"){const v=e.target.value.replace(/\D/g,"");if(v!==e.target.value)e.target.value=v}});
$("#coPhone").addEventListener("input",e=>{const v=e.target.value.replace(/\D/g,"");if(v!==e.target.value)e.target.value=v});
$("#coForm").addEventListener("submit",e=>{
  e.preventDefault();
  if(!/^\d{8,15}$/.test($("#coPhone").value)){$("#coErr").textContent="WhatsApp number: use numbers only, 8 to 15 digits.";$("#coErr").hidden=false;$("#coPhone").focus();return}
  const f=e.currentTarget;
  if(!f.checkValidity()){const bad=f.querySelector(":invalid");$("#coErr").textContent=`Please check "${bad.labels[0].textContent}".`;$("#coErr").hidden=false;bad.focus();return}
  const counts=countItems(S.box),short=Object.entries(counts).find(([id,n])=>{const p=prod(id);return !p||p.status!=="available"||n>stockLeft(p)});
  if(short){const p=prod(short[0]),left=p?stockLeft(p):0;
    $("#coErr").textContent=p&&p.status==="available"&&left>0?`Sorry, only ${left} ${p.name} left. Please change your box.`:`Sorry, ${p?p.name:"that flavor"} just sold out. Please change your box.`;
    $("#coErr").hidden=false;sanitizeCart();renderStoreStatic();renderStore();return}
  const q=quote({...S,phone:$("#coPhone").value.trim()}),del=S.mode==="delivery",ed=S.editId?DB.orders.find(x=>x.id===S.editId&&x.status==="awaiting"):null;
  if(S.coupon&&q.couponErr){const m=q.couponErr;S.coupon="";$("#coErr").textContent=m+" The coupon was removed, so please check your new total.";$("#coErr").hidden=false;renderStore();openCheckout();return}
  const notify=(document.querySelector('input[name="coNotify"]:checked')||{value:"both"}).value;
  const cust={name:$("#coName").value.trim(),email:$("#coEmail").value.trim(),phone:$("#coPhone").value.trim(),
    address:del?$("#coAddr").value.trim():""};
  const fields={notify,size:S.size,items:countItems(S.box),mode:S.mode,speed:S.mode==="pickup"?"pickup":S.speed,day:S.day,time:S.time,note:S.note,addons:[...S.addons],sale:q.sale?`${q.sale.name} (${saleOffText(q.sale)})`:"",
    base:q.base,discount:q.discount,coupon:q.coupon?q.coupon.code:"",couponDisc:q.couponDisc,surcharge:q.surcharge,addonsTotal:q.addons,fee:q.fee,total:q.total,customer:cust};
  if(SBH.on){
    const btn=f.querySelector("button[type=submit]");if(btn)btn.disabled=true;
    SBH.place({notify,shuffled:!!S.shuf,size:S.size,items:fields.items,mode:S.mode,speed:S.speed,day:S.day,time:S.time,note:S.note,addons:[...S.addons],coupon:fields.coupon,expectTotal:q.total,customer:cust},ed).then(o=>{
      addMine(o.id);S.editId=null;saveCart();renderDone(o,!!ed);
      S=fresh();$("#coForm").reset();saveCart();sanitizeCart();renderStoreStatic();renderStore();renderEditBar();renderBag();
    }).catch(err=>{$("#coErr").textContent=err.message;$("#coErr").hidden=false;SBH.loadShop(true)}).finally(()=>{if(btn)btn.disabled=false});
    return}
  let o;
  if(ed){releaseHold(ed);Object.assign(ed,fields,{editedAt:Date.now()});o=ed;takeHold(o)}
  else{o={id:uid(),code:newCode(),tracked:true,holds:false,createdAt:Date.now(),expiresAt:payDeadlineMs(fields),status:"awaiting",...fields};DB.orders.unshift(o);takeHold(o)}
  if(!ed)logMsg(o,chanList(o.notify),"awaiting",msgText(o,"awaiting"),"system");
  saveDB();addMine(o.id);S.editId=null;saveCart();
  renderDone(o,!!ed);
  S=fresh();$("#coForm").reset();saveCart();sanitizeCart();renderStoreStatic();renderStore();renderEditBar();renderBag();
});
const COOKIE_SVG="data:image/svg+xml,"+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><circle cx='32' cy='32' r='28' fill='#D9A066'/><circle cx='32' cy='32' r='28' fill='none' stroke='#B07A3F' stroke-width='3'/><g fill='#4A2A14'><circle cx='22' cy='24' r='4'/><circle cx='40' cy='19' r='3.5'/><circle cx='44' cy='38' r='4'/><circle cx='26' cy='43' r='3.5'/><circle cx='33' cy='31' r='2.6'/></g></svg>");
function thFill(t,o){const del=o.mode==="delivery";return String(t).replace(/\{name\}/g,o.customer.name.split(" ")[0]||"friend").replace(/\{size\}/g,o.size).replace(/\{mode\}/g,del?"delivery":"pickup").replace(/\{when\}/g,`${fmtDay(o.day)}, ${o.time}`).replace(/\{hours\}\s*hours?/g,o.expiresAt?fmtSpan(o.expiresAt-Date.now()):DB.settings.payWindowH+" hours").replace(/\{hours\}/g,o.expiresAt?fmtSpan(o.expiresAt-Date.now()):DB.settings.payWindowH).replace(/\{code\}/g,o.code).replace(/\{total\}/g,money(o.total))}
let dnTimer;
function fxBurst(fx,T,fb){
  clearTimeout(fx._t);fx.innerHTML="";
  if(RM||!T.fx)return;
  const imgs=T.cookies.length?T.cookies:(fb&&fb.length?fb:[COOKIE_SVG]),n=Math.max(4,Math.min(60,+T.amount||28)),cols=["#000096","#ffffff","#F5B942","#7A7AFF"];let h="";
  for(let i=0;i<n;i++){const sz=26+Math.random()*34;h+=`<i class="dn-p" style="--x:${(Math.random()*96).toFixed(1)}%;--s:${sz.toFixed(0)}px;--d:${(Math.random()*2.4).toFixed(2)}s;--t:${(2.6+Math.random()*2.4).toFixed(2)}s;--sw:${(Math.random()*160-80).toFixed(0)}px;--r:${(Math.random()*900-450).toFixed(0)}deg"><img src="${esc(imgs[i%imgs.length])}" alt="" draggable="false"></i>`}
  for(let i=0;i<Math.round(n/2);i++){h+=`<i class="dn-p dot" style="--x:${(Math.random()*98).toFixed(1)}%;--s:${(8+Math.random()*8).toFixed(0)}px;--d:${(Math.random()*2.6).toFixed(2)}s;--t:${(2.2+Math.random()*2).toFixed(2)}s;--sw:${(Math.random()*120-60).toFixed(0)}px;--r:${(Math.random()*1000-500).toFixed(0)}deg;background:${cols[i%cols.length]};${i%cols.length===1?"box-shadow:0 0 0 1px #c9c9ee":""}"></i>`}
  fx.innerHTML=h;fx._t=setTimeout(()=>{fx.innerHTML=""},9000);
}
function dnBurst(){fxBurst($("#dnFx"),DB.thanks)}

function renderDone(o,ed,preview){
  const T=DB.thanks,box=$("#doneBox");
  box.style.setProperty("--dn-acc",T.accent);box.style.setProperty("--dn-cd",T.cdColor);
  $("#sheet .sheet-card").style.background=T.bg;
  const bd=$("#doneBadge");bd.classList.toggle("logo",!!T.logo);bd.innerHTML=T.logo?`<img src="${esc(T.logo)}" alt="${esc(DB.page.name||"Delidome")}">`:"✓";
  $("#doneTitle").textContent=ed?T.titleUpd:T.title;
  $("#doneText").textContent=thFill(T.text,o);$("#doneUrgent").textContent=thFill(T.urgent,o);
  $("#doneCode").textContent=o.code;
  $("#doneView").dataset.id=preview?"":o.id;
  $("#doneCd").innerHTML=`<small>${esc(T.cdLabel)}</small><span class="cd" data-exp="${o.expiresAt}">${fmtLeft(o.expiresAt-Date.now())}</span>`;
  $("#donePM").innerHTML=payMethodsHTML();
  $("#donePay").textContent=T.payBtn;$("#doneClose").textContent=T.trackBtn;$("#newBox").textContent=T.buildBtn;
  $("#checkoutView").hidden=true;$("#doneView").hidden=false;
  if(preview){const sv=$("#storeView");sv.hidden=false;sv.classList.add("th-only");$("#sheet").hidden=false;document.body.style.overflow="hidden"}
  dnBurst();
}
const doneGo=()=>{const id=$("#doneView").dataset.id;closeSheet();if(id)openMO(id)};
function endPreview(){const sv=$("#storeView");if(sv.classList.contains("th-only")){sv.classList.remove("th-only");sv.hidden=true}}
function ppShow(o,preview){
  const P=DB.proofpop;if(!P.on&&!preview)return false;
  const pop=$("#ppPop");
  pop.style.setProperty("--pp-bg",P.bg);pop.style.setProperty("--pp-acc",P.accent);pop.style.setProperty("--pp-ink",P.ink);
  $("#ppCard").innerHTML=`${P.emoji?`<div class="pp-emoji" aria-hidden="true">${esc(P.emoji)}</div>`:""}${P.img?`<img class="pp-img" src="${esc(P.img)}" alt="">`:""}<h3>${esc(thFill(P.title,o))}</h3><p>${esc(thFill(P.text,o))}</p><button class="btn" type="button" data-ppclose>${esc(P.btn)}</button>`;
  if(preview){const sv=$("#storeView");sv.hidden=false;sv.classList.add("th-only")}
  pop.hidden=false;fxBurst($("#ppFx"),P,DB.thanks.cookies);
  setTimeout(()=>{const b=$("#ppCard [data-ppclose]");b&&b.focus()},60);
  return true;
}
function ppClose(){const pop=$("#ppPop");if(pop.hidden)return;pop.hidden=true;$("#ppFx").innerHTML="";endPreview()}
$("#ppPop").addEventListener("click",e=>{if(e.target.id==="ppPop"||e.target.closest("[data-ppclose]"))ppClose()});
addEventListener("keydown",e=>{if(e.key==="Escape"&&!$("#ppPop").hidden)ppClose()});
$("#doneClose").addEventListener("click",doneGo);
$("#donePay").addEventListener("click",doneGo);
$("#doneView").addEventListener("click",e=>{const b=e.target.closest("[data-pmsave]");if(b)savePayImg(b.dataset.pmsave)});
$("#newBox").addEventListener("click",()=>{S=fresh();renderEditBar();$("#coForm").reset();closeSheet();sanitizeCart();renderStoreStatic();renderStore();scrollToEl($("#build"))});

/* --- My orders (customer): pay, proof, track, edit --- */
const normPhone=v=>String(v||"").replace(/\D/g,"").replace(/^(0|62)/,"");
const MINE_KEY="delidome-mine-v1";let MINE=[];try{MINE=JSON.parse(localStorage.getItem(MINE_KEY)||"[]")||[]}catch(e){}
const addMine=id=>{if(!MINE.includes(id))MINE.unshift(id);try{localStorage.setItem(MINE_KEY,JSON.stringify(MINE))}catch(e){}};
const mineOrders=()=>MINE.map(id=>DB.orders.find(o=>o.id===id)).filter(Boolean);
function fmtLeft(ms){ms=Math.max(0,ms);const t=Math.floor(ms/1000),h=Math.floor(t/3600),m=Math.floor(t%3600/60),sec=t%60;return [h,m,sec].map(n=>String(n).padStart(2,"0")).join(":")}
const CUS={awaiting:"Awaiting payment",review:"Checking payment",new:"Confirmed",baking:"Baking",cancelled:"Cancelled"};
const isRej=o=>o.status==="awaiting"&&!!o.rejected;
const refundTxt=o=>o.refund?(o.refund.full?"Refunded":"Partly refunded"):"";
const cusLabel=o=>(isRej(o)?"Payment rejected":(CUS[o.status]||stLabel(o.status,o.mode)))+(o.refund?" · "+refundTxt(o):"");
function releaseHold(o){if(SBH.on)return;if(o.tracked&&o.holds){Object.entries(o.items).forEach(([pid,n])=>{const p=prod(pid);if(p&&p.track)p.stock+=n});o.holds=false}}
function takeHold(o){if(SBH.on)return;if(o.tracked&&!o.holds){Object.entries(o.items).forEach(([pid,n])=>{const p=prod(pid);if(p&&p.track)p.stock=Math.max(0,p.stock-n)});o.holds=true}}
function expireOrders(){
  if(SBH.on)return false;
  const now=Date.now();let ch=false;
  DB.orders.forEach(o=>{if(o.status==="awaiting"&&o.expiresAt&&now>=o.expiresAt){o.status="cancelled";o.cancelReason="It was not paid in time, so it was cancelled automatically.";releaseHold(o);logMsg(o,chanList(o.notify||"both"),"cancelled",msgText(o,"cancelled"),"system");ch=true}});
  if(ch)saveDB();return ch;
}
const SEEN_KEY="delidome-seen-v1";let SEEN=0,SEENV=0;try{SEEN=+localStorage.getItem(SEEN_KEY)||0}catch(e){}
function notifs(){
  const map=new Map();
  mineOrders().forEach(o=>(o.msgs||[]).filter(m=>m.status!=="refunded").forEach(m=>{const k=o.id+"|"+m.at+"|"+m.text;const e=map.get(k);if(e){if(!e.ch.includes(m.channel))e.ch.push(m.channel)}else map.set(k,{o,m,ch:[m.channel]})}));
  return [...map.values()].sort((a,b)=>b.m.at-a.m.at);
}
// a friendly nudge to rate orders that were delivered / picked up
const RN_KEY="delidome-ratenudge-v1";let RN_SEEN={};try{RN_SEEN=JSON.parse(localStorage.getItem(RN_KEY)||"{}")||{}}catch(e){}
function rateNudge(){
  if(view!=="store"||!$("#rnPop")||!$("#rnPop").hidden||!$("#moSheet").hidden||!$("#sheet").hidden)return;
  if(Date.now()-(RN_SEEN._last||0)<864e5)return;   // one reminder a day at most
  const o=mineOrders().find(o=>o.status==="completed"&&!(RN_SEEN[o.id]===-1||Date.now()-(RN_SEEN[o.id]||0)<864e5)&&Object.keys(o.items||{}).some(pid=>prod(pid)&&!(o.rated||{})[pid]));if(!o)return;
  const left=Object.keys(o.items).filter(pid=>prod(pid)&&!(o.rated||{})[pid]).map(pid=>prod(pid).name);
  $("#rnPop").innerHTML=`<div class="rn-ic" aria-hidden="true">⭐</div><div class="rn-tx"><b>How were your cookies?</b><span>Your order ${esc(o.code)} was ${o.mode==="delivery"?"delivered":"picked up"}. Rate ${esc(listJoin(left.slice(0,3)).replace(" or "," and "))}${left.length>3?" and more":""}.</span></div><div class="rn-act"><button class="btn btn-blue btn-sm" type="button" data-rnrate="${o.id}">Rate now</button><button class="linkbtn sm" type="button" data-rnlater="${o.id}">Later</button></div>`;
  $("#rnPop").hidden=false;
}
function rnDone(id,forGood){RN_SEEN[id]=forGood?-1:Date.now();RN_SEEN._last=Date.now();try{localStorage.setItem(RN_KEY,JSON.stringify(RN_SEEN))}catch(e){}$("#rnPop").hidden=true}
{const rp=$("#rnPop");if(rp)rp.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.rnrate){rnDone(b.dataset.rnrate,true);openMO(b.dataset.rnrate);setTimeout(()=>{const r=$("#moCard .rstars");r&&r.scrollIntoView({block:"center"})},80)}
  else if(b.dataset.rnlater)rnDone(b.dataset.rnlater)})}
// orders still waiting for payment: the bell tells the customer to pay before the time runs out
const refundsNew=()=>mineOrders().filter(o=>o.refund&&o.refund.at>SEEN);
const refundList=()=>mineOrders().filter(o=>o.refund);
const payDue=()=>mineOrders().filter(o=>o.status==="awaiting"&&o.expiresAt&&o.expiresAt>Date.now());
function renderBell(){
  applyCdLook();
  try{rateNudge()}catch(e){}
  const list=notifs(),n=list.filter(x=>x.m.at>SEEN).length+activeBroadcasts().filter(x=>x.at>SEEN).length+payDue().length+refundsNew().length,b=$("#bellCount"),btn=$("#bellBtn");
  if(!b)return;b.hidden=!n;b.textContent=n>9?"9+":n;btn.classList.toggle("ring",n>0);
  btn.setAttribute("aria-label",n?`Notifications, ${n} new`:"Notifications");
  if(!$("#bellPop").hidden)drawBell(list);
}
let BELLF="all";
const ST_ICON={refunded:"💸",awaiting:"⏳",review:"🔎",new:"✅",baking:"🍪",ready:"🚚",completed:"🎉",cancelled:"❌"};
function drawBell(list){
  $("#bellTabs").innerHTML=[["all","All"],["orders","My orders"],["deals","News & deals"]].map(([k,l])=>`<button type="button" role="tab" data-belltab="${k}" aria-selected="${BELLF===k}">${l}</button>`).join("");
  const items=[];
  if(BELLF!=="deals")payDue().forEach(o=>{
    items.push({at:Infinity,h:`<button class="bell-it bell-pay" type="button" data-bellgo="${o.id}"><span class="bell-ic" aria-hidden="true">⏰</span><span class="bell-tx"><small>Order #${esc(o.code)} · ${isRej(o)?"payment rejected":"waiting for payment"}</small><b>${isRej(o)?"Payment rejected – please send a new proof":"Pay now or you'll miss your cookies!"}</b>${isRej(o)&&o.rejected.reason?`<span class="bell-rej">Reason: ${esc(o.rejected.reason)}</span>`:""}<span class="bell-cdrow">Time left: <span class="cd" data-exp="${o.expiresAt}">${fmtLeft(o.expiresAt-Date.now())}</span></span></span><span class="bell-ch" aria-hidden="true">›</span></button>`})});
  if(BELLF!=="deals")refundList().forEach(o=>{
    items.push({at:o.refund.at,h:`<button class="bell-it${o.refund.at>SEENV?" new":""}" type="button" data-bellgo="${o.id}"><span class="bell-ic" aria-hidden="true">💸</span><span class="bell-tx"><small>Order #${esc(o.code)} · ${fmtAgo(o.refund.at)}</small><b>${o.refund.full?"Your order was refunded":"Part of your order was refunded"}: ${money(o.refund.amount)}</b><span>${o.refund.note?esc(o.refund.note)+" · ":""}It can take a few days to show in your account.</span></span><span class="bell-ch" aria-hidden="true">›</span></button>`})});
  if(BELLF!=="deals")list.forEach(x=>{const st=x.m.status,o=x.o,lab=st?stLabel(st,o.mode):"Update";
    items.push({at:x.m.at,h:`<button class="bell-it${x.m.at>SEENV?" new":""}" type="button" data-bellgo="${o.id}"><span class="bell-ic" aria-hidden="true">${ST_ICON[st]||"📦"}</span><span class="bell-tx"><small>Order · ${fmtAgo(x.m.at)}</small><b>Order #${esc(o.code)} · ${esc(lab)}</b><span>${esc(x.m.text)}</span></span><span class="bell-ch" aria-hidden="true">›</span></button>`})});
  if(BELLF!=="orders")DB.sales.filter(s=>saleStatus(s)!=="ended").forEach(s=>{const live=saleStatus(s)==="live";
    items.push({at:live?s.start:Date.now()-3600e3,h:`<button class="bell-it" type="button" data-bellsale="1"><span class="bell-ic" aria-hidden="true">${isFD(s)?"🚚":"🔥"}</span><span class="bell-tx"><small>${isFD(s)?"Free delivery":"Flash sale"} · ${live?fmtAgo(s.start):"coming up"}</small><b>${isFD(s)?(live?"Free delivery now":"Free delivery soon"):(live?"Flash sale now":"Flash sale soon")}: ${esc(s.name)}</b><span>${esc(saleOffText(s))} · ${live?"ends":"starts"} ${fmtDT(live?s.end:s.start)}</span></span><span class="bell-ch" aria-hidden="true">›</span></button>`})});
  if(BELLF!=="orders")activeBroadcasts().forEach(x=>{const p=x.pid&&prod(x.pid);
    items.push({at:x.at,h:`<button class="bell-it${x.at>SEENV?" new":""}" type="button" ${p?`data-bellprod="${p.id}"`:'data-bellnone="1"'}><span class="bell-ic" aria-hidden="true">${nfIcon(x.type)}</span><span class="bell-tx"><small>${nfName(x.type)} · ${fmtAgo(x.at)}</small><b>${esc(x.title)}</b>${x.text?`<span>${esc(x.text)}</span>`:""}${x.code?`<span class="bell-code" data-bellcode="${esc(x.code)}">🎟 ${esc(x.code)} · tap to copy</span>`:""}${p?`<span style="color:var(--blue);font-weight:600">View ${esc(p.name)}</span>`:""}</span>${p?`<span class="bell-ch" aria-hidden="true">›</span>`:"<span></span>"}</button>`})});
  items.sort((a,b)=>(b.at===Infinity)-(a.at===Infinity)||b.at-a.at);
  $("#bellList").innerHTML=items.length?items.map(i=>i.h).join(""):`<div class="bell-empty">${BELLF==="deals"?"No news or deals right now.":"No notifications yet. Updates about your orders will show up here."}</div>`;
}
function openBell(){SEENV=SEEN;const list=notifs();drawBell(list);const pop=$("#bellPop");pop.hidden=false;$("#bellBtn").setAttribute("aria-expanded","true");
  const latest=Math.max(list.reduce((a,x)=>Math.max(a,x.m.at),SEEN),...refundList().map(o=>o.refund.at),...activeBroadcasts().map(x=>x.at));SEEN=latest;try{localStorage.setItem(SEEN_KEY,String(SEEN))}catch(e){}
  $("#bellCount").hidden=true;$("#bellBtn").classList.remove("ring")}
function closeBell(){const p=$("#bellPop");if(p.hidden)return;p.hidden=true;$("#bellBtn").setAttribute("aria-expanded","false");renderBell()}
$("#bellBtn").addEventListener("click",e=>{e.stopPropagation();$("#bellPop").hidden?openBell():closeBell()});
$("#bellPop").addEventListener("click",e=>{e.stopPropagation();if(e.target.closest("[data-bellclose]")){closeBell();return}
  const cc=e.target.closest("[data-bellcode]");if(cc){const v=cc.dataset.bellcode,orig=cc.textContent;const ok=()=>{cc.textContent="✓ Copied "+v;setTimeout(()=>{cc.textContent=orig},1500)};try{navigator.clipboard.writeText(v).then(ok,()=>toast("Press and hold the code to copy it"))}catch(err){toast("Press and hold the code to copy it")}return}
  const t=e.target.closest("[data-belltab]");if(t){BELLF=t.dataset.belltab;drawBell(notifs());return}
  const bp=e.target.closest("[data-bellprod]");if(bp){closeBell();const el=document.querySelector(`.card[data-id="${bp.dataset.bellprod}"]`);if(el){scrollToEl(el);el.classList.remove("hl");void el.offsetWidth;el.classList.add("hl");setTimeout(()=>el.classList.remove("hl"),2600)}else scrollToEl($("#build"));return}
  if(e.target.closest("[data-bellsale]")){closeBell();scrollToEl($("#build"));return}
  const g=e.target.closest("[data-bellgo]");if(g){closeBell();openMO(g.dataset.bellgo)}});
document.addEventListener("click",e=>{if(!$("#bellPop").hidden&&!e.target.closest("#bellPop"))closeBell()});
addEventListener("keydown",e=>{if(e.key==="Escape")closeBell()});
function renderBag(){
  const n=mineOrders().filter(o=>o.status==="awaiting").length,b=$("#moCount");
  if(b){b.hidden=!n;b.textContent=n;$("#moBtn").classList.toggle("hot",n>0)}
  renderBell();
}
const MO={id:null,cform:false,rate:{}};
function payMethodsHTML(){
  const ms=DB.payMethods.filter(m=>m.on&&(m.name||m.details||m.img));
  if(!ms.length)return `<p class="mo-sub" style="margin:0">Please contact us for payment details.</p>`;
  return `<div class="pmlist"><div class="mo-sub">${ms.length>1?"Pay with any of these":"How to pay"}</div>${ms.map(m=>`<div class="pmc"><b>${esc(m.name||"Payment")}</b>${m.details?`<pre>${esc(m.details)}</pre>`:""}${m.img?`<button class="pmimgbtn" type="button" data-pmsave="${m.id}" aria-label="Save the ${esc(m.name||"payment")} image"><img class="pmimg" src="${esc(m.img)}" alt="${esc(m.name||"Payment")} image"><span>⬇ Tap to save this image</span></button>`:""}</div>`).join("")}</div>`;
}
async function savePayImg(id){
  const m=DB.payMethods.find(x=>x.id===id);if(!m||!m.img)return;
  const mt=/^data:(image\/(png|jpeg|webp));base64,(.*)$/.exec(m.img);if(!mt){toast("Can't save this image");return}
  const bin=atob(mt[3]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  const ext=mt[2]==="jpeg"?"jpg":mt[2],name=`${(DB.page.name||"delidome").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}-${(m.name||"payment").replace(/[^a-z0-9]+/gi,"-").toLowerCase()}.${ext}`,blob=new Blob([u],{type:mt[1]});
  let dl=null;try{dl=window.claude&&await window.claude.use("downloads")}catch(e){}
  if(dl){try{await dl.save({filename:name,data:blob});toast("Image saved")}catch(err){if(err&&err.code!=="declined")toast("Couldn't save the image here. Press and hold it to save.")}return}
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast("Image saved");
}
$("#moSheet").addEventListener("click",e=>{const b=e.target.closest("[data-pmsave]");if(b)savePayImg(b.dataset.pmsave);
  const c=e.target.closest("[data-awbcopy]");if(c){const v=c.dataset.awbcopy;const ok=()=>{c.textContent="Copied";setTimeout(()=>{c.textContent="Copy"},1500)};
    try{navigator.clipboard.writeText(v).then(ok,()=>{toast("Press and hold the number to copy it")})}catch(err){toast("Press and hold the number to copy it")}}});
const proofOk=f=>f&&/^image\//.test(f.type);
async function processProof(file){
  if(!proofOk(file))throw new Error("Please choose a photo or screenshot (JPG, PNG or WebP).");
  if(file.size>25e6)throw new Error("That image is over 25 MB. Try a smaller one.");
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Couldn't read that image."));i.src=url});
    const MAX=1000,k=Math.min(1,MAX/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.round(img.naturalWidth*k),h=Math.round(img.naturalHeight*k);
    const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d");x.fillStyle="#fff";x.fillRect(0,0,w,h);x.imageSmoothingQuality="high";x.drawImage(img,0,0,w,h);
    return c.toDataURL("image/jpeg",.78);
  }finally{URL.revokeObjectURL(url)}
}
function moSteps(o){
  const labels=["Order placed","Payment","Confirmed","Baking",o.mode==="delivery"?"Out for delivery":"Ready for pickup",o.mode==="delivery"?"Delivered":"Picked up"];
  const idx={awaiting:1,review:1,new:2,baking:3,ready:4,completed:5}[o.status]??1;
  const del=o.mode==="delivery",ship=del&&(o.courier||o.awb);
  const sub=i=>i===1&&isRej(o)?`<span class="trk-rej">Rejected${o.rejected.reason?": "+esc(o.rejected.reason):""}. Please send a new proof.</span>`:i===4&&del?(ship?`<span class="trk">${o.courier?`Courier: <b>${esc(o.courier)}</b>`:""}${o.courier&&o.awb?"<br>":""}${o.awb?`Airway bill: <b>${esc(o.awb)}</b> <button class="trkcopy" type="button" data-awbcopy="${esc(o.awb)}">Copy</button>`:""}</span>`:(o.status==="ready"?"Courier details will show here soon":"")):i===0?fmtDT(o.createdAt):i===1?(o.status==="awaiting"?"Waiting for your payment":o.status==="review"?"Proof sent, we're checking it":"Received"):"";
  return `<ol class="track-l">${labels.map((l,i)=>{const done=i<idx||(o.status==="completed"&&i===5),now=i===idx&&!done;
    return `<li class="${done?"done":now?"now":""}"><span class="dot">${done?"✓":""}</span><span>${l}${(done||now||(i===4&&ship&&o.status==="completed"))&&sub(i)?`<small>${sub(i)}</small>`:""}</span></li>`}).join("")}</ol>`;
}

/* --- ratings and complaints (customer) --- */
const COMPLAINT_REASONS=["Damaged product","Wrong item","Missing item","Product quality","Late delivery","Other"];
const CP_STATUS={open:"New",review:"In review",resolved:"Resolved",rejected:"Rejected"};
const cwinEnd=o=>o.completedAt?o.completedAt+DB.settings.complaintWindowH*3600e3:0;
const cwinOpen=o=>o.status==="completed"&&!o.complaint&&Date.now()<cwinEnd(o);
const UNBOX_NOTE=`<div class="cnote"><b>Please keep your unboxing video.</b><span>Record the whole opening of the package in one uncut video. If something is wrong, we'll ask for it as proof.</span></div>`;
function ratingHTML(o){
  const rated=o.rated||{},ids=Object.keys(o.items);
  const rows=ids.map(pid=>{const p=prod(pid);if(!p)return "";const done=rated[pid];
    return done?`<div class="rrow"><b>${esc(p.name)}</b><span class="stars" role="img" aria-label="You rated ${done} out of 5">${starStr(done)}</span></div>`
    :`<div class="rrow"><b>${esc(p.name)}</b><div class="rstars" role="group" aria-label="Rate ${esc(p.name)}">${[1,2,3,4,5].map(n=>`<button type="button" data-rstar="${pid}" data-n="${n}" aria-label="${n} star${n>1?"s":""}">★</button>`).join("")}</div><input class="in" data-rcomment="${pid}" maxlength="200" placeholder="Say something about it (optional)" aria-label="Comment on ${esc(p.name)}"></div>`}).join("");
  const left=ids.some(pid=>prod(pid)&&!rated[pid]);
  return `<div class="dsec"><h4>Rate your cookies</h4>${rows}${left?`<p class="err" id="rtErr" hidden></p><button class="btn btn-blue btn-sm" type="button" data-rsubmit style="margin-top:8px">Send ratings</button>`:`<p class="hint" style="margin:8px 0 0">Thanks for rating!</p>`}</div>`;
}
function complaintHTML(o){
  if(o.status!=="ready"&&o.status!=="completed")return "";
  const end=cwinEnd(o),win=DB.settings.complaintWindowH;
  if(o.status==="ready")return `<div class="dsec"><h4>Problem with your order?</h4>${UNBOX_NOTE}<p class="hint">You can report a problem for ${win} hours after your order is ${o.mode==="delivery"?"delivered":"picked up"}.</p></div>`;
  if(o.complaint){const c=o.complaint;
    const names=c.scope==="order"?"Whole order":c.items.map(id=>{const p=prod(id);return p?p.name:"Removed flavor"}).join(", ");
    return `<div class="dsec"><h4>Your complaint</h4><div class="cbox"><div class="mo-row"><b>${esc(c.reason)}</b><span class="mo-chip st-${c.status==="resolved"?"completed":c.status==="rejected"?"cancelled":c.status==="review"?"baking":"awaiting"}">${CP_STATUS[c.status]}</span></div>
      <span class="mo-sub">Sent ${fmtDT(c.at)} · ${esc(names)}</span><p style="margin:0;white-space:pre-line">${esc(c.text)}</p>
      ${c.photos.length?`<div class="cphotos">${c.photos.map(src=>`<img src="${esc(imgOk(src))}" alt="Photo you sent">`).join("")}</div>`:""}
      ${c.reply?`<div class="mo-pay"><b>Reply from the shop</b><span style="white-space:pre-line">${esc(c.reply)}</span></div>`:`<p class="hint" style="margin:0">We'll reply here as soon as we've looked at it. Keep your unboxing video handy.</p>`}</div></div>`}
  if(Date.now()>=end)return `<div class="dsec"><h4>Problem with your order?</h4><p class="hint" style="margin:0">The ${win}-hour complaint window for this order has closed.</p></div>`;
  const head=`<div class="dsec"><h4>Problem with your order?</h4>${UNBOX_NOTE}<p class="mo-sub" style="margin:10px 0">Complaint window closes in <span class="cd" data-cexp="${end}">${fmtLeft(end-Date.now())}</span></p>`;
  if(!MO.cform)return head+`<button class="btn btn-ghost-blue btn-sm" type="button" data-cpopen>Report a problem</button></div>`;
  return head+`<form class="form cbox" id="moComplain" novalidate>
    <div class="field"><label for="cpReason">What went wrong?</label><select id="cpReason">${COMPLAINT_REASONS.map(r=>`<option>${r}</option>`).join("")}</select></div>
    <div class="field"><span class="flbl" style="font-weight:600;font-size:14px">Which part of the order?</span>
      <label class="chk"><input type="radio" name="cpScope" value="order" checked> Whole order</label>
      <label class="chk"><input type="radio" name="cpScope" value="items"> Specific flavors</label>
      <div id="cpItems" hidden style="padding-left:26px;display:grid;gap:6px">${Object.keys(o.items).map(pid=>{const p=prod(pid);return p?`<label class="chk"><input type="checkbox" name="cpItem" value="${pid}"> ${o.items[pid]} × ${esc(p.name)}</label>`:""}).join("")}</div></div>
    <div class="field"><label for="cpText">Tell us what happened</label><textarea id="cpText" rows="4" maxlength="600" placeholder="e.g. 3 cookies were crushed when I opened the box"></textarea></div>
    <div class="field"><label for="cpPhotos">Photos (optional, up to 3)</label><input id="cpPhotos" type="file" accept="image/*" multiple></div>
    <label class="chk"><input type="checkbox" id="cpVideo"> I have an uncut unboxing video and can send it if asked.</label>
    <p class="err" id="cpErr" hidden></p>
    <div class="mo-row" style="gap:8px"><button class="btn btn-blue btn-sm" type="submit">Send complaint</button><button class="linkbtn" type="button" data-cpclose>Cancel</button></div></form></div>`;
}
function renderMO(){
  const card=$("#moCard"),list=mineOrders();
  const o=MO.id&&DB.orders.find(x=>x.id===MO.id);
  if(!o){
    MO.id=null;
    card.innerHTML=`<div class="sheet-top"><h3>My orders</h3><button class="x" type="button" data-moclose aria-label="Close">✕</button></div>
    ${list.length?`<div class="mo-list">${list.map(x=>`<button class="mo-card" type="button" data-moopen="${x.id}"><div class="mo-row"><span class="mo-code">${esc(x.code)}</span><span class="mo-chip st-${isRej(x)?"rejected":x.status}">${cusLabel(x)}</span></div>
      <div class="mo-row"><span>Box of ${x.size} · ${money(x.total)}${x.refund?` · <b style="color:#0a7a3b">${refundTxt(x)} ${money(x.refund.amount)}</b>`:""}</span><span class="mo-sub">${fmtDay(x.day)}, ${esc(x.time)}</span></div>
      ${x.status==="completed"&&x.complaint?`<div class="mo-sub">Complaint: ${CP_STATUS[x.complaint.status]}</div>`:cwinOpen(x)?`<div class="mo-sub">Complaint window: <span class="cd" data-cexp="${cwinEnd(x)}">${fmtLeft(cwinEnd(x)-Date.now())}</span></div>`:""}${x.status==="completed"&&Object.keys(x.items).some(id=>prod(id)&&!(x.rated||{})[id])?`<div class="mo-sub">Tap to rate your cookies</div>`:""}
      ${x.status==="awaiting"?`<div class="mo-sub">Pay within <span class="cd" data-exp="${x.expiresAt}">${fmtLeft(x.expiresAt-Date.now())}</span></div>`:""}</button>`).join("")}</div>`:`<p class="hint">No orders yet in this browser. Build a box and it will show up here.</p>`}
    <details class="mo-find" ${list.length?"":"open"}><summary>Find an order</summary>
      <form class="form" id="moFind" novalidate style="margin-top:12px"><div class="row2"><div class="field"><label for="moCode">Order code</label><input id="moCode" placeholder="DD-ABCD" autocapitalize="characters"></div><div class="field"><label for="moMail">WhatsApp number used</label><input id="moMail" type="tel" inputmode="numeric" maxlength="24" placeholder="Numbers only"></div></div>
      <p class="err" id="moErr" hidden></p><button class="btn btn-blue" type="submit">Find order</button></form></details>`;
    return}
  if(SBH.on)SBH.needFiles(o);
  const items=Object.entries(o.items).map(([id,n])=>{const p=prod(id);return `<div class="m"><span>${n} × ${esc(p?p.name:"Removed flavor")}</span><span></span></div>`}).join("");
  const awaiting=o.status==="awaiting";
  const total=Math.max(1,(o.expiresAt||0)-(o.createdAt||0)||DB.settings.payWindowH*3600e3);
  card.innerHTML=`<div class="sheet-top"><div><button class="mo-back" type="button" data-moback>← All orders</button><h3 style="margin-top:6px">${esc(o.code)}</h3></div><button class="x" type="button" data-moclose aria-label="Close">✕</button></div>
  <div class="mo-row" style="margin:6px 0 14px"><span class="mo-chip st-${isRej(o)?"rejected":o.status}">${cusLabel(o)}</span><span class="mo-sub">${modeName(o)} · ${esc(whenTxt(o))}</span></div>
  ${o.refund?`<div class="mo-pay" style="background:#E6F6EC;border-color:#9AD3AE"><b>💸 ${o.refund.full?"Refunded":"Partly refunded"}: ${money(o.refund.amount)}</b><span>${fmtDT(o.refund.at)}${o.refund.note?" · "+esc(o.refund.note):""}</span><span class="mo-sub">It can take a few days to show in your account.</span></div>`:""}
  ${o.status==="cancelled"?`<div class="mo-pay" style="background:#FCE3E8"><b>This order was cancelled.</b><span>${esc(o.cancelReason||"It was cancelled.")}</span><button class="btn btn-blue btn-sm" type="button" data-monew>Build a new box</button></div>`:""}
  ${awaiting?`<div class="mo-pay"><div><div class="mo-sub">Time left to pay</div><div class="mo-big cd" data-exp="${o.expiresAt}">${fmtLeft(o.expiresAt-Date.now())}</div><div class="mo-bar" style="margin-top:8px"><i data-expbar="${o.expiresAt}" data-expfrom="${o.createdAt||0}" style="width:${Math.max(0,Math.min(100,(o.expiresAt-Date.now())/total*100))}%"></i></div><p class="mo-sub" style="margin:8px 0 0">If it isn't paid in time, the order is cancelled automatically.</p></div>
    ${o.rejected?`<div class="rej-box" role="alert"><b>✕ Payment rejected</b><span>${o.rejected.reason?esc(o.rejected.reason):"We couldn't verify your payment proof."}</span><span>Please send a new payment proof below before the time runs out.</span></div>`:""}
    <div><div class="mo-sub">Transfer exactly</div><div class="mo-big">${money(o.total)}</div></div>
    ${payMethodsHTML()}
    <form class="form" id="moPay" novalidate><h4 style="margin:0">Send your payment proof</h4>
      <div class="field"><label for="mpName">Full name</label><input id="mpName" value="${esc(o.customer.name)}" autocomplete="name" required placeholder="Name of the person who paid"></div>
      <div class="field"><label for="mpFile">Proof of payment (photo or screenshot)</label><input id="mpFile" type="file" accept="image/*"></div>
      <img class="proofimg" id="mpPrev" alt="Proof preview" hidden>
      <p class="err" id="mpErr" hidden></p>
      <button class="btn btn-blue" type="submit">I've paid, send proof</button></form></div>`:""}
  ${o.status==="review"&&o.proof?`<div class="mo-pay"><b>We're checking your payment.</b><span class="mo-sub">Sent ${fmtDT(o.proof.at)} by ${esc(o.proof.name)}. This page updates when it's confirmed.</span><img class="proofimg" src="${esc(imgOk(o.proof.img))}" alt="Your payment proof"></div>`:""}
  <div class="dsec" style="margin-top:18px"><h4>Track your order</h4>${o.status==="cancelled"?`<p class="hint" style="margin:0">Cancelled ${o.cancelReason?"":""}</p>`:moSteps(o)}${o.refund?`<ol class="track-l" style="margin-top:6px"><li class="done"><span class="dot">✓</span><span>${o.refund.full?"Refunded":"Partly refunded"} · ${money(o.refund.amount)}<small>${esc(fmtDT(o.refund.at))}</small></span></li></ol>`:""}</div>
  <div class="dsec"><h4>Your box of ${o.size}</h4><div class="summary" style="margin:0">${items}
    ${o.discount>0?`<div class="sl"><span>${esc(o.sale||"Flash sale")}</span><span class="num">−${money(o.discount)}</span></div>`:""}
    ${o.couponDisc>0?`<div class="sl"><span>Coupon ${esc(o.coupon)}</span><span class="num">−${money(o.couponDisc)}</span></div>`:""}
    <div><span>${modeName(o)}</span><span class="num">${o.fee?money(o.fee):"Free"}</span></div>
    <div class="t"><span>Total</span><span class="num">${money(o.total)}</span></div></div>${o.mode==="delivery"?`<p class="hint">Your box may be split into smaller or bigger boxes for delivery safety.</p>`:""}</div>
  ${o.status==="completed"?ratingHTML(o):""}
  ${complaintHTML(o)}
  ${awaiting?`<div class="mo-row" style="margin-top:14px;gap:8px"><button class="btn btn-ghost-blue btn-sm" type="button" data-moedit="${o.id}">Edit order</button><button class="danger" type="button" data-mocancel="${o.id}">Cancel order</button></div><p class="hint">You can change your box until you've sent payment.</p>`:""}`;
}
function openMO(id){MO.id=id||null;MO.cform=false;MO.rate={};renderMO();$("#moSheet").hidden=false;document.body.style.overflow="hidden"}
function closeMO(){const m=$("#moSheet");if(!m||m.hidden)return;m.hidden=true;document.body.style.overflow=""}
function renderEditBar(){
  const b=$("#editBar"),o=S.editId&&DB.orders.find(x=>x.id===S.editId);
  b.hidden=!o;if(o)b.innerHTML=`<span><b>Editing order ${esc(o.code)}.</b> Change your box, then save at checkout.</span><button type="button" id="stopEdit">Stop editing</button>`;
}
function startEdit(id){
  const o=DB.orders.find(x=>x.id===id);if(!o||o.status!=="awaiting"){toast("This order can't be edited any more");return}
  S.editId=id;S.size=o.size;S.box=Object.entries(o.items).flatMap(([pid,n])=>Array(n).fill(pid));S.mode=o.mode;S.speed=o.speed==="sameday"?"sameday":"scheduled";S.note=o.note||"";S.addons=[...o.addons];S.coupon=o.coupon||"";
  S.day=dayOptions().some(d=>ymd(d)===o.day)?o.day:null;S.time=S.day?o.time:null;S.step=1;fixWhen();
  closeMO();sanitizeCart();renderStoreStatic();renderStore();renderEditBar();saveCart();scrollToEl($("#build"));toast(`Editing ${o.code}`);
}
$("#moBtn").addEventListener("click",()=>openMO(null));
$("#moSheet").addEventListener("click",e=>{
  if(e.target.id==="moSheet"||e.target.closest("[data-moclose]")){closeMO();return}
  const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.moopen){MO.id=d.moopen;MO.cform=false;MO.rate={};renderMO()}
  else if(d.moback!==undefined){MO.id=null;MO.cform=false;renderMO()}
  else if(d.cpopen!==undefined){MO.cform=true;renderMO();const f=$('#moComplain');f&&f.scrollIntoView({block:'center'})}
  else if(d.cpclose!==undefined){MO.cform=false;renderMO()}
  else if(d.rstar){MO.rate[d.rstar]=+d.n;b.parentElement.querySelectorAll('button').forEach(x=>x.classList.toggle('on',+x.dataset.n<=+d.n))}
  else if(d.rsubmit!==undefined){const o=DB.orders.find(x=>x.id===MO.id);if(!o)return;const picks=Object.entries(MO.rate);
    if(!picks.length){const er=$('#rtErr');er.textContent='Tap the stars to rate at least one flavor.';er.hidden=false;return}
    const rt={};picks.forEach(([pid,n])=>{const c=($('#moCard').querySelector(`[data-rcomment="${pid}"]`)||{}).value||'';rt[pid]={n,comment:c.trim()}});
    rateOrder(o,rt).then(()=>{MO.rate={};toast('Thanks for your rating!');renderMO();renderMenu()}).catch(ex=>{const er=$('#rtErr');er.textContent=ex.message;er.hidden=false})}
  else if(d.moedit)startEdit(d.moedit);
  else if(d.monew!==undefined){closeMO();scrollToEl($("#build"))}
  else if(d.mocancel){armed(b,()=>{const o=DB.orders.find(x=>x.id===d.mocancel);if(!o||o.status!=="awaiting")return;
    if(SBH.on){SBH.cancel(o.id).then(()=>{if(S.editId===o.id){S.editId=null;saveCart();renderEditBar()}toast("Order cancelled");renderBag();renderMO()}).catch(ex=>toast(ex.message));return}
    o.status="cancelled";o.cancelReason="You cancelled this order.";releaseHold(o);saveDB();if(S.editId===o.id){S.editId=null;renderEditBar()}toast("Order cancelled");renderBag();renderMO()})}
});
$("#moSheet").addEventListener("change",e=>{
  if(e.target.name==="cpScope"){$("#cpItems").hidden=e.target.value!=="items";return}
  if(e.target.id!=="mpFile")return;const f=e.target.files[0],img=$("#mpPrev");
  if(!f){img.hidden=true;return}
  if(proofOk(f)){img.src=URL.createObjectURL(f);img.hidden=false}else img.hidden=true;
});
$("#moSheet").addEventListener("submit",async e=>{
  e.preventDefault();
  if(e.target.id==="moFind"){
    const code=$("#moCode").value.trim().toUpperCase(),num=normPhone($("#moMail").value),err=$("#moErr");
    if(SBH.on){
      if(!code||!num){err.textContent="Enter the order code and the WhatsApp number you used.";err.hidden=false;return}
      try{const id=await SBH.track(code,$("#moMail").value);
        if(!id){err.textContent="We couldn't find that order. Check the code and the WhatsApp number you used.";err.hidden=false;return}
        addMine(id);renderBag();MO.id=id;renderMO()}catch(ex){err.textContent=ex.message;err.hidden=false}
      return}
    const o=num?DB.orders.find(x=>x.code===code&&normPhone(x.customer.phone)===num):null;
    if(!o){err.textContent="We couldn't find that order. Check the code and the WhatsApp number you used.";err.hidden=false;return}
    addMine(o.id);renderBag();MO.id=o.id;renderMO();return}
  if(e.target.id==="moComplain"){
    const o=DB.orders.find(x=>x.id===MO.id),err=$("#cpErr"),bad=m=>{err.textContent=m;err.hidden=false};
    if(!o||!cwinOpen(o)){bad("The complaint window for this order has closed.");return}
    const scope=document.querySelector('input[name="cpScope"]:checked').value,items=[...document.querySelectorAll('input[name="cpItem"]:checked')].map(x=>x.value),text=$("#cpText").value.trim();
    if(scope==="items"&&!items.length){bad("Choose which flavors have the problem, or pick Whole order.");return}
    if(text.length<10){bad("Please describe the problem (at least 10 characters).");$("#cpText").focus();return}
    if(!$("#cpVideo").checked){bad("Please confirm you have your uncut unboxing video.");return}
    const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Sending...";
    try{
      const files=[...$("#cpPhotos").files].slice(0,3),photos=[];for(const f of files)photos.push(await processProof(f));
      if(SBH.on){await SBH.complain(o.id,{reason:$("#cpReason").value,scope,items:scope==="items"?items:[],text,photos});MO.cform=false;toast("Complaint sent. We'll reply here.");renderMO();return}
      o.complaint={at:Date.now(),reason:$("#cpReason").value,scope,items:scope==="items"?items:[],text,photos,status:"open",reply:"",updatedAt:Date.now()};
      if(!saveDB()){delete o.complaint;bad("Not enough storage space for the photos. Try fewer or smaller photos.");btn.disabled=false;btn.textContent="Send complaint";return}
      MO.cform=false;toast("Complaint sent. We'll reply here.");renderMO();
    }catch(ex){bad(ex.message);btn.disabled=false;btn.textContent="Send complaint"}
    return}
  if(e.target.id==="moPay"){
    const o=DB.orders.find(x=>x.id===MO.id),err=$("#mpErr"),name=$("#mpName").value.trim(),f=$("#mpFile").files[0];
    const bad=m=>{err.textContent=m;err.hidden=false};
    if(!o||o.status!=="awaiting"){bad("This order is no longer waiting for payment.");return}
    if(name.length<2){bad("Please enter your full name.");$("#mpName").focus();return}
    if(!f){bad("Please attach your proof of payment.");return}
    const btn=e.target.querySelector("button[type=submit]");btn.disabled=true;btn.textContent="Sending...";
    try{
      const img=await processProof(f),prev={proof:o.proof,status:o.status,rejected:o.rejected};
      if(SBH.on){await SBH.proof(o.id,name,img);renderBag();renderMO();if(!ppShow(o))toast("Proof sent. We'll confirm your payment soon.");return}
      o.proof={name,img,at:Date.now()};o.status="review";delete o.rejected;logMsg(o,chanList(o.notify||"both"),"review",msgText(o,"review"),"system");
      if(!saveDB()){o.proof=prev.proof;o.status=prev.status;if(prev.rejected)o.rejected=prev.rejected;bad("Not enough storage space to save the image. Try a smaller screenshot.");btn.disabled=false;btn.textContent="I've paid, send proof";return}
      renderBag();renderMO();if(!ppShow(o))toast("Proof sent. We'll confirm your payment soon.");
    }catch(ex){bad(ex.message);btn.disabled=false;btn.textContent="I've paid, send proof"}
  }
});
$("#editBar").addEventListener("click",e=>{if(e.target.id==="stopEdit"){S.editId=null;S.box=[];S.step=1;S.day=null;S.time=null;S.note="";S.addons=[];S.coupon="";S.size=6;sanitizeCart();renderEditBar();renderStoreStatic();renderStore();saveCart();toast("Editing stopped")}});
/* live countdowns + automatic cancellation */
function tickCountdowns(){
  const now=Date.now();
  document.querySelectorAll("[data-exp],[data-cexp]").forEach(el=>{el.textContent=fmtLeft(+(el.dataset.exp||el.dataset.cexp)-now)});
  if(!$("#moSheet").hidden&&!MO.cform&&[...document.querySelectorAll("[data-cexp]")].some(el=>+el.dataset.cexp<=now))renderMO();
  document.querySelectorAll("[data-expbar]").forEach(el=>{const t=Math.max(1,(+el.dataset.expbar)-(+el.dataset.expfrom||0)||DB.settings.payWindowH*3600e3);el.style.width=Math.max(0,Math.min(100,(+el.dataset.expbar-now)/t*100))+"%"});
  renderBell();
}
function sweepOrders(){
  if(!expireOrders())return;
  renderBag();
  if(view==="store"){sanitizeCart();renderStoreStatic();renderStore();renderEditBar();if(!$("#moSheet").hidden)renderMO()}
  else if(view==="admin")renderAdmin();
}
setInterval(()=>{tickCountdowns();if(Math.round(Date.now()/1000)%10===0)sweepOrders()},1000);

/* ================= ADMIN ================= */
const A={sel:new Set(),lbl:null,lblPrev:"sample",rvPid:null,tab:"dashboard",nf:{type:"news",title:"",text:"",pid:"",code:"",until:""},dd:"today",vr:"today",dsig:"",filter:"all",od:"all",q:"",pq:"",pcat:"all",modal:null,np:null,bakeDay:null,openOrder:null,
  draft:{kind:"discount",name:"Flash sale",type:"percent",value:20,appliesTo:"all",startMode:"now",startAt:"",durH:1,durM:0}};
function toast(msg){if(typeof toastHook==="function")msg=toastHook(msg);const t=$("#toast");t.textContent=msg;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>t.hidden=true,Math.max(1600,msg.length*45))}
let saveTimer;function saveSoon(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>{saveDB();toast("Saved")},500)}
function armed(btn,fn){if(btn.dataset.armed){fn();return}btn.dataset.armed="1";const t=btn.textContent;btn.textContent="Tap again to confirm";btn.classList.add("armed");
  setTimeout(()=>{if(btn.isConnected){delete btn.dataset.armed;btn.textContent=t;btn.classList.remove("armed")}},3000)}
const stLabel=(k,mode)=>k==="refunded"?"Refunded":k==="ready"?(mode==="delivery"?"Out for delivery":"Ready for pickup"):k==="completed"?(mode==="delivery"?"Delivered":"Picked up"):STATUSES.find(x=>x[0]===k)[1];
const statusSel = o => `<select class="st st-${o.status}" data-status-for="${o.id}" aria-label="Status for ${o.code}">${STATUSES.map(([k])=>`<option value="${k}" ${k===o.status?"selected":""}>${stLabel(k,o.mode)}</option>`).join("")}</select>`;
const miniPlate = p => p?`<div class="mini">${plateHTML(p)}</div>`:`<div class="mini"></div>`;
const head = (title,sub) => `<div class="ahead"><div><h1>${title}</h1><p>${sub}</p></div></div>`;
const MOCK = SBH.on ? "" : `<div class="mocknote"><span>●</span><span><b>Mockup.</b> Changes save in this browser and show in the shop straight away. Orders tagged <b>Example</b> are sample data. This becomes the Supabase backend later.</span></div>`;

function renderAdmin(){
  if(!tabAllowed(A.tab))A.tab=Object.keys(TAB_PERM).find(tabAllowed)||"orders";
  document.querySelectorAll("#anav [data-tab]").forEach(b=>{b.style.display=tabAllowed(b.dataset.tab)?"":"none"});
  {const r=document.querySelector("#adminView .side .role");if(r)r.textContent=ROLE()==="owner"?"Owner":(SBH.title||"Staff")}
  if(A.tab!=="labels")A.lbl=null;
  document.querySelectorAll("#anav [data-tab]").forEach(b=>b.setAttribute("aria-current",b.dataset.tab===A.tab?"page":"false"));
  const nNew=DB.orders.filter(o=>o.status==="review"||o.status==="new").length,nLive=DB.sales.filter(s=>saleStatus(s)==="live").length;
  $("#cOrders").textContent=nNew||"";$("#cOrders").hidden=!nNew;
  {const nc=DB.orders.filter(o=>o.complaint&&(o.complaint.status==="open")).length;$("#cComplaints").textContent=nc||"";$("#cComplaints").hidden=!nc;$("#cComplaints").classList.toggle("live",!!nc)}
  {const nc=DB.coupons.filter(c=>cpState(c)==="live").length;$("#cCoupons").textContent=nc?nc+" live":"";$("#cCoupons").hidden=!nc;$("#cCoupons").classList.toggle("live",!!nc)}
  $("#cSales").textContent=nLive?nLive+" live":"";$("#cSales").hidden=!nLive;
  const lowN=DB.products.filter(isLow).length;
  $("#cProducts").textContent=lowN?lowN+" low":DB.products.filter(p=>p.status==="available").length;$("#cProducts").classList.toggle("live",!!lowN);
  $("#amain").innerHTML=({notify:viewNotify,dashboard:viewDashboard,orders:viewOrders,sales:viewSales,products:viewProducts,complaints:viewComplaints,boxes:viewBoxes,marquee:viewMarquee,announcer:viewAnnouncer,coupons:viewCoupons,hero:viewHero,labels:viewLabels,landing:viewLanding,settings:viewSettings,customers:viewCustomers,team:viewTeam,badges:viewBadges,log:viewLog})[A.tab]();
  if(A.tab==="log"&&LG.list===null)loadLog();
  if(A.tab==="customers"&&(CU.list===null||CU.stale))loadCustomers();
  if(A.tab==="team"&&TM.list===null)loadTeam();
  tickAdmin();
  if(A.tab==="sales")updatePreview();
  if(A.tab==="marquee")afterViewMarquee();
  if(A.tab==="announcer")anDrawPrev();
  if(A.tab==="hero")hrDraw();
  if(A.tab==="labels")fitLabel();
  drawDraftBar();
}


/* --- drafts: shop settings, marquee banner and landing page go live only when the owner presses Publish --- */
const DRAFT_NAMES={settings:"Shop settings",marquee:"Marquee banner",page:"Landing page and top banner"};
function drawDraftBar(){
  const am=$("#amain");if(!am||!SBH.pending)return;
  const keys=SBH.pending();let bar=$("#draftBar");
  {const tabs={settings:["settings","boxes"],marquee:["marquee"],page:["landing","hero"]};document.querySelectorAll("[data-tab]").forEach(b=>b.classList.toggle("pend",keys.some(k=>(tabs[k]||[]).includes(b.dataset.tab))))}
  const onTab=SBH.admin&&["settings","boxes","marquee","landing"].includes(A.tab);
  if(!keys.length&&!onTab){if(bar)bar.remove();return}
  const busy=keys.length>0,sig=(busy?keys.join():"idle")+"|"+A.tab;
  const html=busy?`<div class="db-tx"><b>Not published yet</b><span>${keys.map(k=>esc(DRAFT_NAMES[k])).join(", ")}. Customers still see the old version.</span></div><div class="db-act"><button class="btn btn-blue" type="button" data-dbpub>Save &amp; publish</button><button class="ghost" type="button" data-dbdisc>Discard changes</button></div>`
    :`<div class="db-tx"><b>✓ Everything here is published</b><span>Changes you make on this page go live only after you press Save &amp; publish.</span></div><div class="db-act"><button class="btn btn-blue" type="button" disabled>Save &amp; publish</button><button class="ghost" type="button" disabled>Discard changes</button></div>`;
  if(!bar){bar=document.createElement("div");bar.id="draftBar";bar.setAttribute("role","status");am.prepend(bar)}
  bar.className="draftbar"+(busy?"":" idle");
  if(bar.dataset.sig!==sig){bar.dataset.sig=sig;bar.innerHTML=html}
}
function afterSave(){if(SBH.on&&SBH.admin)requestAnimationFrame(()=>{try{drawDraftBar()}catch(e){}})}
function toastHook(msg){return msg==="Saved"&&SBH.admin&&SBH.pending&&["settings","boxes","marquee","landing"].includes(A.tab)&&SBH.pending().length?"Draft kept. Press Publish changes to show it in the shop.":msg}
document.addEventListener("click",async e=>{
  const b=e.target.closest("[data-dbpub],[data-dbdisc]");if(!b||!SBH.pending)return;
  const keys=SBH.pending();if(!keys.length)return;
  if(b.dataset.dbdisc!==undefined){
    if(b.dataset.arm!=="1"){b.dataset.arm="1";b.textContent="Tap again to discard";setTimeout(()=>{if(b.isConnected){b.dataset.arm="";b.textContent="Discard changes"}},3500);return}
    SBH.discard(keys);A.hr=null;try{applyCdLook()}catch(er){}renderAdmin();toast("Changes discarded. Back to the published version.");return}
  b.disabled=true;b.textContent="Publishing…";
  const ok=await SBH.publish(keys);
  if(ok){toast("Published to the shop");renderAdmin()}else{b.disabled=false;b.textContent="Save & publish"}
});
/* --- Announcer (owner) --- */
A.an=null;A.anK="live";A.anEnd=Date.now()+2*3600e3+17*60e3;
const anClone=o=>JSON.parse(JSON.stringify(o));
const anDraft=()=>A.an||(A.an=anClone(DB.announcer));
const anDirty=()=>A.an&&JSON.stringify(A.an)!==JSON.stringify(DB.announcer);
function anSample(k,AN){
  const fill=t=>t.replace(/\{name\}/g,"Weekend crunch").replace(/\{off\}/g,"20% off").replace(/\{applies\}/g,"on every box");
  const fdf=t=>t.replace(/\{name\}/g,"Free delivery weekend").replace(/\{off\}/g,"Free delivery").replace(/\{applies\}/g,"on every box");
  if(k==="live")return {text:fill(AN.live.text),ms:A.anEnd-Date.now()};
  if(k==="soon")return {text:fill(AN.soon.text),ms:A.anEnd-Date.now()};
  if(k==="fdlive")return {text:fdf(AN.fdlive.text),ms:A.anEnd-Date.now()};
  if(k==="fdsoon")return {text:fdf(AN.fdsoon.text),ms:A.anEnd-Date.now()};
  return {text:AN.custom.text||"Your announcement here",ms:anCustomMs(AN.custom,Date.now())};
}
// sample line-up for the marquee preview: a sale, a free delivery promo and the owner's note
function anSampleItems(AN){const now=Date.now(),e=A.anEnd;return [{k:"live",text:anSample("live",AN).text,end:e},{k:"fdlive",text:anSample("fdlive",AN).text,end:e},{k:"custom",text:AN.custom.text||"Your announcement here",end:null}]}
function anDrawPrev(){const el=document.getElementById("anPrev");if(!el)return;const AN=anDraft();
  el.parentNode.classList.toggle("off",!AN.on);el._sig=null;
  if(A.anK==="mq"){el.hidden=false;anMarquee(el,anSampleItems(AN),AN,Date.now())}
  else{const sm=anSample(A.anK,AN);anRender(el,A.anK,AN,AN,sm.text,sm.ms)}
  el.classList.remove("pinned");
  const st=document.getElementById("anDirty");if(st){st.hidden=!anDirty()}
  const sv=document.getElementById("anSave");if(sv)sv.disabled=!anDirty();const ds=document.getElementById("anDisc");if(ds)ds.disabled=!anDirty()}
function anTick(now){const el=document.getElementById("anPrev"),cd=el&&el.querySelector(".cdn");if(!cd)return;if(A.anK==="mq"){anCd(el,now);return}const AN=anDraft(),sm=anSample(A.anK,AN);if(sm.ms===null)return;const c=AN[A.anK];cd.textContent=(c.label?c.label+" ":"")+fmtDur(sm.ms)}
function anMqPanel(AN){
  const m=AN.mq,col=(label,path,v)=>`<label class="af">${label}<input type="color" data-an="${path}" value="${v}" style="width:100%;height:42px"></label>`;
  const fontOpts=Object.entries(MQ_FONTS).map(([k,v])=>`<option value="${k}" ${m.font===k?"selected":""}>${v[0]}</option>`).join("")+(m.fontData?`<option value="custom" ${m.font==="custom"?"selected":""}>${esc(m.fontName||"Your font")} (uploaded)</option>`:"");
  return `<section class="panel"><h2>Running text</h2>
    <p class="sub">When two or more announcements are showing at the same time (for example a flash sale, a free delivery promo and your own message), the banner turns into one running line that shows all of them. Each announcement keeps its own picture and its lively countdown. With only one announcement, the normal banner shows.</p>
    <div class="grid3" style="margin-top:12px;align-items:end">${col("Background","mq.bg",m.bg)}${col("Text color","mq.ink",m.ink)}
      <label class="af">Font<select class="in" data-an="mq.font">${fontOpts}</select></label></div>
    <div class="grid3" style="margin-top:12px;align-items:end">
      <label class="af">Text size<select class="in" data-an="mq.size">${["S","M","L"].map(z=>`<option value="${z}" ${m.size===z?"selected":""}>${({S:"Small",M:"Medium",L:"Large"})[z]}</option>`).join("")}</select></label>
      <label class="af">Speed<select class="in" data-an="mq.speed">${["slow","medium","fast"].map(z=>`<option value="${z}" ${m.speed===z?"selected":""}>${z[0].toUpperCase()+z.slice(1)}</option>`).join("")}</select></label>
      <div class="af">Your own font<div class="colin"><label class="ghost mqbtn">${m.fontData?"Replace font":"Upload font"}<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden data-anfont></label>${m.fontData?`<button class="danger" type="button" data-anfontrm>Remove</button>`:""}</div></div></div>
    <p class="note" style="margin-top:10px">${m.fontData?`Uploaded font: <b>${esc(m.fontName)}</b>. Choose it in the Font list.`:"Upload a .ttf, .otf, .woff or .woff2 file (up to 1 MB), then pick it in the Font list."} Only upload fonts you have the license to use on the web.</p>
    <div style="display:flex;align-items:center;gap:10px;margin-top:14px"><label class="sw"><input type="checkbox" data-an="mq.sepOn" ${m.sepOn?"checked":""} aria-label="Show a picture between announcements"><span></span></label><span class="stlabel"><b>Picture between announcements</b><br><small style="color:var(--muted)">Shown after each sentence. Off shows a small star instead.</small></span></div>
    <div style="margin-top:12px"><h2 style="font-size:15px;margin:0 0 6px">Picture between sentences</h2>
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">${m.sepImg?`<img src="${esc(m.sepImg)}" alt="" style="height:48px;border-radius:10px;border:1px solid var(--line)">`:`<span class="note">No picture yet. A small star shows instead.</span>`}
      <label class="ghost mqbtn">${m.sepImg?"Replace picture":"Upload picture"}<input type="file" accept="image/*" hidden data-ansep></label>${m.sepImg?`<button class="danger" type="button" data-ansepro>Remove</button>`:""}</div>
      <p class="note" style="margin-top:8px">Each announcement can also have its own picture at its start: open its tab (Flash sale live, Free delivery live, My announcement…) and use <b>Banner image</b> there. The preview above shows a sample sale, a free delivery promo and your note.</p></div>
  </section>`;
}
function viewAnnouncer(){
  const AN=anDraft(),K=A.anK,c=AN[K];
  const col=(label,path,v)=>`<label class="af">${label}<input type="color" data-an="${path}" value="${v}" style="width:100%;height:42px"></label>`;
  const sw=(label,path,v,hint)=>`<div class="stockrow" style="display:flex;align-items:center;gap:10px;margin-top:10px"><label class="sw"><input type="checkbox" data-an="${path}" ${v?"checked":""} aria-label="${label}"><span></span></label><span class="stlabel"><b>${label}</b>${hint?`<br><small style="color:var(--muted)">${hint}</small>`:""}</span></div>`;
  const tabs=[["live","Flash sale live"],["soon","Coming up"],["fdlive","Free delivery live"],["fdsoon","Free delivery coming up"],["custom","My announcement"],["mq","Running text (2 or more)"]].map(([k,l])=>`<button type="button" class="${K===k?"on":""}" data-ank="${k}" style="border:1.5px solid ${K===k?"var(--blue)":"var(--line)"};background:${K===k?"var(--blue)":"#fff"};color:${K===k?"#fff":"var(--ink)"};border-radius:99px;padding:7px 14px;font-weight:600;cursor:pointer">${l}</button>`).join("");
  return head("Announcer","The banner pinned under the shop header. It stays visible while customers scroll. Changes appear in the preview only; nothing goes live until you press Save.")+MOCK+`
  <div class="stack">
    <section class="panel" style="position:sticky;top:8px;z-index:6">
      <div class="phead"><div><h2>Preview <span id="anDirty" hidden style="font-size:12px;background:var(--red);color:#fff;border-radius:99px;padding:2px 9px;margin-left:6px;vertical-align:middle">Not saved yet</span></h2><p class="sub">This is how it looks in the shop. The timer below is a sample.</p></div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0 10px">${tabs}</div>
      <div style="border-radius:14px;overflow:hidden;border:1px solid var(--line)"><div class="flash" id="anPrev"></div></div>
      <p class="note" style="margin-top:8px" ${AN.on?"hidden":""}>The announcer is switched off, so customers won't see any banner.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-blue" id="anSave" type="button" data-ansave disabled>Save &amp; publish</button><button class="btn btn-ghost-blue" id="anDisc" type="button" data-andisc disabled>Discard changes</button><button class="danger" type="button" data-anreset>Reset to default</button></div>
    </section>
    <section class="panel">
      <h2>Show &amp; behave</h2>
      ${sw("Announcer on","on",AN.on,"Master switch for the whole banner.")}
      ${sw("Keep pinned while scrolling","sticky",AN.sticky,"Locked under the header on every scroll. Off lets it scroll away with the page.")}
      ${sw("Show image","imgOn",AN.imgOn,"Uses the picture you upload for each banner below.")}
      ${sw("Lively image","imgFx",AN.imgFx,"The picture wiggles and bounces.")}
      ${sw("Lively countdown","cdFx",AN.cdFx,"The timer pulses and a shine sweeps across the banner.")}
    </section>
    ${K==="mq"?anMqPanel(AN):`<section class="panel">
      <h2>${({live:"When a flash sale is live",soon:"When a sale is coming up (24 hours before)",fdlive:"When a free delivery promo is live",fdsoon:"When a free delivery promo is coming up (24 hours before)",custom:"Your own announcement"})[K]}</h2>
      ${K==="custom"?sw("Show my announcement","custom.on",AN.custom.on,"Shows when no flash sale is live or coming up."):""}
      <label class="af" style="margin-top:10px">Message<input class="in" data-an="${K}.text" maxlength="140" value="${esc(c.text)}"></label>
      ${K!=="custom"?`<p class="note" style="margin:4px 0 0">Fill-ins: <b>{name}</b> sale name, <b>{off}</b> discount, <b>{applies}</b> what it covers.</p>`:""}
      <div class="grid3" style="margin-top:12px;align-items:end">
        <label class="af">Timer label<input class="in" data-an="${K}.label" maxlength="20" value="${esc(c.label)}"></label>
        ${K==="custom"?`<label class="af">Ends at (optional)<input class="in" type="datetime-local" data-an="custom.endsAt" value="${esc(c.endsAt)}"></label><span class="note">Leave empty for no timer. The banner hides itself when time is up.</span>`:`<span></span><span></span>`}
      </div>
      <div class="grid3" style="margin-top:12px;align-items:end">${col("Background",K+".bg",c.bg)}${col("Text color",K+".ink",c.ink)}
        <label class="af">Text size<select class="in" data-an="size"><option value="S" ${AN.size==="S"?"selected":""}>Small</option><option value="M" ${AN.size==="M"?"selected":""}>Medium</option><option value="L" ${AN.size==="L"?"selected":""}>Large</option></select></label></div>
      <div class="grid3" style="margin-top:12px;align-items:end">${col("Timer text (red by default)","cdColor",AN.cdColor)}${col("Timer background","cdBg",AN.cdBg)}<label class="af">Timer size<select class="in" data-an="cdSize">${[["M","Medium"],["L","Large (default)"],["XL","Extra large"]].map(([v,l])=>`<option value="${v}" ${(AN.cdSize||"L")===v?"selected":""}>${l}</option>`).join("")}</select></label></div>
      <div style="margin-top:14px"><h2 style="font-size:15px;margin:0 0 6px">Banner image</h2>
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">${c.img?`<img src="${esc(c.img)}" alt="" style="height:48px;border-radius:10px;border:1px solid var(--line)">`:`<span class="note">No image yet. A lightning bolt shows instead.</span>`}
        <label class="ghost mqbtn">${c.img?"Replace image":"Upload image"}<input type="file" accept="image/*" hidden data-animg></label>${c.img?`<button class="danger" type="button" data-anrm>Remove</button>`:""}</div></div>
    </section>`}
  </div>`;
}


/* --- Top banner / hero (owner) --- */
A.hr=null;
const hrDraft=()=>A.hr||(A.hr=anClone(DB.page.hero));
const hrDirty=()=>A.hr&&JSON.stringify(A.hr)!==JSON.stringify(DB.page.hero);
function hrDraw(){
  const el=document.getElementById("hrPrev");if(!el)return;const pg=DB.page,wrap=el.parentNode;
  wrap.style.setProperty("--blue",pg.brand);wrap.style.setProperty("--display",lpFamily(pg.headFont,pg));wrap.style.setProperty("--body",lpFamily(pg.bodyFont,pg));
  const h=anClone(hrDraft());if(!h.bg)h.bg=pg.brand;heroFill(el,h);
  const d=hrDirty();["hrDirty"].forEach(i=>{const n=document.getElementById(i);if(n)n.hidden=!d});
  ["hrSave","hrDisc"].forEach(i=>{const n=document.getElementById(i);if(n)n.disabled=!d});
}
function viewHero(){
  const pg=DB.page,h=hrDraft(),prods=DB.products.filter(p=>p.status!=="hidden"&&hasImage(p)).slice(0,6);
  const inp=(label,path,max,rows)=>`<label class="af">${label}${rows?`<textarea class="in" rows="${rows}" data-hr="${path}" maxlength="${max}">${esc(h[path])}</textarea>`:`<input class="in" data-hr="${path}" maxlength="${max}" value="${esc(h[path])}">`}</label>`;
  const slot=i=>{const c=safeMedia(h.cookies[i]),pr=prods[i];
    const thumb=c?`<img src="${esc(c)}" alt="" style="width:100%;height:100%;object-fit:contain">`:pr?`<div class="plate" style="background:#1A1FB0;width:100%">${plateInner(pr)}</div>`:`<span class="note">Empty</span>`;
    return `<div class="pmcard" style="text-align:center;gap:8px"><b style="font-size:13px">Cookie ${i+1}</b><div style="width:72px;height:72px;margin:0 auto;display:grid;place-items:center;background:#EEF0FF;border-radius:50%;overflow:hidden">${thumb}</div>
      <span class="note" style="margin:0">${c?"Your image":pr?"Default (flavor photo)":"Nothing to show"}</span>
      <label class="ghost mqbtn" style="justify-self:center">${c?"Replace":"Upload"}<input type="file" accept="image/*" hidden data-hrck="${i}"></label>${c?`<button class="danger" type="button" data-hrckrm="${i}">Use default</button>`:""}</div>`};
  const mt=h.mediaType,src=h.src||"",isData=/^data:/i.test(src);
  const col=(l,k,v)=>`<label class="af">${l}<input type="color" data-hr="${k}" value="${v}" style="width:100%;height:42px"></label>`;
  return head("Top banner","The big dome at the top of your shop. Edit everything here and check the preview. Nothing changes in the shop until you press Save.")+MOCK+`
  <div class="stack">
    <section class="panel hrsticky">
      <div class="phead"><div><h2>Preview <span id="hrDirty" hidden style="font-size:12px;background:var(--red);color:#fff;border-radius:99px;padding:2px 9px;margin-left:6px;vertical-align:middle">Not saved yet</span></h2><p class="sub">Updates as you edit.</p></div></div>
      <div style="--blue:${pg.brand}"><div class="dome" id="hrPrev"><div class="hm"></div><div class="ho"></div><p class="eyebrow"></p><h1></h1><p class="lede"></p><div class="hero-ctas"><a class="btn btn-white"></a><a class="btn btn-ghost"></a></div></div></div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px"><button class="btn btn-blue" id="hrSave" type="button" data-hrsave disabled>Save &amp; publish</button><button class="btn btn-ghost-blue" id="hrDisc" type="button" data-hrdisc disabled>Discard changes</button><button class="danger" type="button" data-hrreset>Reset to default</button></div>
    </section>
    <section class="panel"><h2>Words and buttons</h2>
      <div class="grid2" style="margin-top:10px">${inp("Small line above the title","eyebrow",60)}${inp("Title","title",90)}</div>
      <div style="margin-top:10px">${inp("Intro text","lede",240,3)}</div>
      <div class="grid2" style="margin-top:10px">${inp("Button 1 label (empty hides it)","btn1",30)}${inp("Button 2 label (empty hides it)","btn2",30)}</div>
      <div class="grid2" style="margin-top:10px">${col("Banner color","bg",h.bg||pg.brand)}${col("Text color","color",h.color||"#ffffff")}</div>
    </section>
    <section class="panel"><h2>Background picture or video</h2>
      <label class="af" style="margin-top:10px">Media<select class="in" data-hr="mediaType" data-hrrr="1"><option value="none" ${mt==="none"?"selected":""}>None (solid color)</option><option value="image" ${mt==="image"?"selected":""}>Image</option><option value="video" ${mt==="video"?"selected":""}>Video</option></select></label>
      ${mt!=="none"?`<div class="colin" style="margin-top:10px"><label class="ghost mqbtn">${src?"Replace":"Upload"} ${mt}<input type="file" accept="${mt==="image"?"image/*":"video/mp4,video/webm"}" hidden data-hrmedia></label>${src?`<button class="danger" type="button" data-hrmediarm>Remove</button>`:""}</div>
        <label class="af" style="margin-top:10px">Or paste a link (https)<input class="in" data-hr="src" value="${isData?"":esc(src)}" placeholder="${isData?"Uploaded file":"https://..."}"></label>
        ${mt==="video"?`<p class="note">Uploaded videos are limited to 3 MB. For longer ones paste an .mp4 link.</p>`:""}
        <label class="af" style="margin-top:10px">Darken the picture: ${h.overlay}%<input type="range" min="0" max="80" step="5" value="${h.overlay}" data-hr="overlay" data-hrnum="1"></label>`:""}
    </section>
    <section class="panel"><h2>Floating cookies</h2>
      <div style="display:flex;gap:10px;align-items:center;margin:10px 0"><label class="sw"><input type="checkbox" data-hr="floats" ${h.floats?"checked":""} aria-label="Show floating cookies"><span></span></label><span class="stlabel">Show floating cookies</span></div>
      <p class="sub" style="margin:0 0 10px">Upload your own picture for any spot. Spots you leave alone keep showing your flavor photos, as before.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px">${[0,1,2,3,4,5].map(slot).join("")}</div>
    </section>
  </div>`;
}


/* --- Coupons (owner) --- */
A.cp=null;
const CP_BLANK=()=>({id:"",code:"",desc:"",type:"percent",value:10,minSpend:0,appliesTo:"all",startsAt:"",endsAt:"",maxUses:0,onePerPhone:true,stack:true,show:true,on:true});
function cpGiven(c){return DB.orders.filter(o=>o.coupon===c.code&&o.status!=="cancelled").reduce((a,o)=>a+(o.couponDisc||0),0)}
function viewCoupons(){
  const F=A.cp,ST={live:["Live","#0A6B34"],scheduled:["Scheduled","#8a5a00"],expired:["Ended","#777"],used:["Used up","#777"],off:["Off","#777"]};
  const list=DB.coupons.map(c=>{const st=cpState(c),u=cpUses(c.code,DB).length;return `<div class="pmcard" style="gap:6px">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><b style="font-size:17px;letter-spacing:.06em">${esc(c.code)}</b><span style="font-size:12px;font-weight:700;color:${ST[st][1]}">${ST[st][0]}${c.show?" · promoted":""}</span></div>
    <div>${esc(cpOff(c))}${c.minSpend>0?` · min box ${money(c.minSpend)}`:""}${c.appliesTo!=="all"?` · box of ${c.appliesTo} only`:""}</div>
    ${c.desc?`<div class="note" style="margin:0">${esc(c.desc)}</div>`:""}
    <div class="note" style="margin:0">Used ${u}${c.maxUses>0?` of ${c.maxUses}`:""} · given ${money(cpGiven(c))}${c.endsAt?` · ends ${esc(c.endsAt.replace("T"," "))}`:""}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="ghost" type="button" data-cpedit="${c.id}">Edit</button><button class="ghost" type="button" data-cptog="${c.id}">${c.on?"Turn off":"Turn on"}</button><button class="danger" type="button" data-cpdel="${c.id}">Delete</button></div></div>`}).join("");
  const sw=(l,k,h)=>`<div style="display:flex;gap:10px;align-items:center;margin-top:10px"><label class="sw"><input type="checkbox" data-cpf="${k}" ${F[k]?"checked":""} aria-label="${l}"><span></span></label><span class="stlabel"><b>${l}</b><br><small style="color:var(--muted)">${h}</small></span></div>`;
  const sizes=DB.sizes.filter(z=>z.active).map(z=>`<option value="${z.n}" ${String(F&&F.appliesTo)===String(z.n)?"selected":""}>Box of ${z.n} only</option>`).join("");
  const form=F?`<section class="panel"><h2>${F.id?"Edit coupon":"New coupon"}</h2>
    <div class="grid2" style="margin-top:10px"><label class="af">Code (letters and numbers)<input class="in" data-cpf="code" maxlength="20" value="${esc(F.code)}" style="text-transform:uppercase" placeholder="SWEET10"></label>
      <label class="af">What customers see<input class="in" data-cpf="desc" maxlength="60" value="${esc(F.desc)}" placeholder="10% off your box"></label></div>
    <div class="grid3" style="margin-top:10px"><label class="af">Type<select class="in" data-cpf="type" data-cprr="1"><option value="percent" ${F.type==="percent"?"selected":""}>Percent off</option><option value="amount" ${F.type==="amount"?"selected":""}>Amount off</option><option value="freedelivery" ${F.type==="freedelivery"?"selected":""}>Free delivery</option></select></label>
      ${F.type!=="freedelivery"?`<label class="af">${F.type==="percent"?"Percent (1 to 100)":"Amount off"}<input class="in" type="number" min="0" step="${F.type==="percent"?1:0.01}" data-cpf="value" value="${F.value}"></label>`:`<span></span>`}
      <label class="af">Minimum box price<input class="in" type="number" min="0" step="0.01" data-cpf="minSpend" value="${F.minSpend}"></label></div>
    <div class="grid3" style="margin-top:10px"><label class="af">Works on<select class="in" data-cpf="appliesTo"><option value="all" ${F.appliesTo==="all"?"selected":""}>Every box</option>${sizes}</select></label>
      <label class="af">Starts (optional)<input class="in" type="datetime-local" data-cpf="startsAt" value="${esc(F.startsAt)}"></label>
      <label class="af">Ends (optional)<input class="in" type="datetime-local" data-cpf="endsAt" value="${esc(F.endsAt)}"></label></div>
    <label class="af" style="margin-top:10px;max-width:260px">Total uses allowed (0 = unlimited)<input class="in" type="number" min="0" step="1" data-cpf="maxUses" value="${F.maxUses}"></label>
    ${sw("One use per customer","onePerPhone","Checked by WhatsApp number.")}${sw("Can be used with a flash sale","stack","Off means it won't apply while a flash sale discounts that box.")}${sw("Promote it in the shop","show","Shows as a tappable offer in the customer's box panel.")}${sw("Active","on","Turn off to pause it.")}
    <p class="err" id="cpErr" hidden></p>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-blue" type="button" data-cpsave>Save coupon</button><button class="btn btn-ghost-blue" type="button" data-cpcancel>Cancel</button></div></section>`:"";
  return head("Coupons","Create discount codes that customers type in (or tap) in their box. Discounts apply to the box price, and show on the order.")+MOCK+`<div class="stack">
    ${form}
    <section class="panel"><div class="phead"><div><h2>All coupons</h2><p class="sub">Coupons marked "promoted" appear as tappable offers next to the coupon box.</p></div>${F?"":`<button class="btn btn-blue btn-sm" type="button" data-cpnew>+ New coupon</button>`}</div>
    ${DB.coupons.length?`<div class="pmlist" style="margin-top:10px;display:grid;gap:10px">${list}</div>`:`<div class="empty">No coupons yet.</div>`}</section></div>`;
}

/* --- Notifications to all customers (owner) --- */
const NF_TYPES=[["news","📣","News"],["deal","🎁","Deal"],["flash","🔥","Flash sale"],["info","ℹ️","Info"]];
const nfIcon=t=>(NF_TYPES.find(x=>x[0]===t)||NF_TYPES[0])[1],nfName=t=>(NF_TYPES.find(x=>x[0]===t)||NF_TYPES[0])[2];
const bcActive=b=>!b.until||b.until>=ymd(today0());
const activeBroadcasts=()=>(DB.broadcasts||[]).filter(bcActive);
function viewNotify(){
  const f=A.nf;
  return head("Notifications","Send news, deals and info to every customer. They see it under the bell on the shop.")+MOCK+`
  <div class="stack">
    <section class="panel">
      <h2>🔔 Send a notification</h2><p class="sub">Every customer sees it under the bell 🔔 on the shop. Order updates and flash sales are added there automatically.</p>
      <div class="stack" style="gap:14px">
        <div class="af">Type<div class="chips">${NF_TYPES.map(([k,i,n])=>`<button class="fchip" type="button" data-nftype="${k}" aria-pressed="${f.type===k}">${i} ${n}</button>`).join("")}</div></div>
        <label class="af">Title<input class="in" data-nf="title" maxlength="80" value="${esc(f.title)}" placeholder="e.g. Weekend deal: 10% off all cookies"></label>
        <label class="af">Message (optional)<textarea class="in" rows="3" data-nf="text" maxlength="240" placeholder="e.g. Use the code at checkout. Valid until Sunday!">${esc(f.text)}</textarea></label>
        <div class="grid3">
          <label class="af">Link to a flavor (optional)<select class="in" data-nf="pid"><option value="">None</option>${DB.products.filter(p=>p.status!=="hidden").map(p=>`<option value="${p.id}" ${f.pid===p.id?"selected":""}>${esc(p.name)}</option>`).join("")}</select></label>
          <label class="af">Coupon code to show (optional)<input class="in" data-nf="code" maxlength="20" value="${esc(f.code)}" placeholder="e.g. BUTTER10" style="text-transform:uppercase"></label>
          <label class="af">Show until (optional)<input class="in" type="date" data-nf="until" value="${esc(f.until)}"></label>
        </div>
        <p class="err" id="nfErr" hidden></p>
        <div><button class="btn btn-blue" type="button" data-nfsend>📣 Send to all customers</button></div>
        <p class="note" style="margin:0">This code is shown under the bell and customers can tap to copy it. To make it work at checkout, create the same code in the Coupons tab.</p>
      </div>
    </section>
    <section class="panel">
      <h2>Sent notifications (${DB.broadcasts.length})</h2>
      ${DB.broadcasts.length?DB.broadcasts.map(b=>`<div class="db-row"><div class="grow"><b>${nfIcon(b.type)} ${esc(b.title)}</b>${b.text?`<span class="meta">${esc(b.text)}</span>`:""}<span class="meta">${nfName(b.type)} · sent ${fmtAgo(b.at)}${b.code?` · code ${esc(b.code)}`:""}${b.pid&&prod(b.pid)?` · links to ${esc(prod(b.pid).name)}`:""}${b.until?` · ${bcActive(b)?"shows until":"expired"} ${fmtDay(b.until)}`:""}</span></div><button class="danger" type="button" data-nfdel="${b.id}">Delete</button></div>`).join(""):`<p class="note" style="margin:6px 0 0">Nothing sent yet.</p>`}
    </section>
  </div>`;
}
/* --- Dashboard (owner) --- */
const VIS_KEY="delidome-visits-v1",VID_KEY="delidome-vid-v1",LASTV_KEY="delidome-lastv-v1",STAFF_KEY="delidome-staff-v1";
let VIS=[];const loadVis=()=>{try{VIS=JSON.parse(localStorage.getItem(VIS_KEY)||"[]")||[]}catch(e){VIS=[]}};loadVis();
function trackVisit(){
  try{
    if(localStorage.getItem(STAFF_KEY)||navigator.webdriver||/bot|crawl|spider|slurp|headless|preview/i.test(navigator.userAgent))return;
    const now=Date.now(),last=+localStorage.getItem(LASTV_KEY)||0;if(now-last<30*60e3)return;
    let vid=localStorage.getItem(VID_KEY);if(!vid){vid=uid()+uid();localStorage.setItem(VID_KEY,vid)}
    localStorage.setItem(LASTV_KEY,String(now));
    if(SBH.on){SBH.visit(vid);return}
    loadVis();VIS=VIS.filter(v=>now-v.t<40*864e5).slice(-4000);VIS.push({t:now,v:vid});localStorage.setItem(VIS_KEY,JSON.stringify(VIS));
  }catch(e){}
}
function dashRange(k){
  const t=today0().getTime();
  if(k==="all")return [0,Infinity];if(k==="today")return [t,t+864e5];
  if(k==="week")return [t-6*864e5,t+864e5];if(k==="month")return [t-29*864e5,t+864e5];
  const d=fromYmd(k).getTime();return [d,d+864e5];
}
const dashSig=()=>DB.orders.map(o=>o.status+(o.proof?1:0)+(o.complaint?o.complaint.status:"")).join(",")+"|"+DB.orders.length+"|"+VIS.length;
/* --- Dashboard: Sales and Performance tabs --- */
A.dt="overview";A.sr="today";A.sf="";A.st="";
const DT_TABS=[["overview","Overview"],["sales","Sales"],["perf","Performance"]];
function srRange(){
  if(A.sr==="custom"){const f=A.sf?fromYmd(A.sf).getTime():0,t=A.st?fromYmd(A.st).getTime()+864e5:Infinity;return [f,Math.max(t,f+864e5)]}
  return dashRange(A.sr);
}
function dashTabs(){return `<div class="seg dt-tabs" role="tablist" aria-label="Dashboard sections" style="margin:0 0 14px">${DT_TABS.map(([k,l])=>`<button type="button" role="tab" data-dt="${k}" aria-pressed="${A.dt===k}">${l}</button>`).join("")}</div>`}
function srFilter(){
  const [a,b]=srRange(),one=ms=>new Date(ms).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});
  const span=A.sr==="custom"?(A.sf||A.st?`${A.sf?one(a):"Start"} to ${A.st?one(b-864e5):"today"}`:"Pick dates"):A.sr==="today"?"Today":`${one(a)} to ${one(b-864e5)}`;
  return `<section class="panel"><div class="chips">${[["today","Today"],["week","This week"],["month","This month"],["custom","Custom dates"]].map(([k,l])=>`<button class="fchip" type="button" data-srk="${k}" aria-pressed="${A.sr===k}">${l}</button>`).join("")}</div>
    ${A.sr==="custom"?`<div class="grid2" style="margin-top:10px"><label class="af">From<input class="in" type="date" data-srf value="${esc(A.sf)}"></label><label class="af">To<input class="in" type="date" data-srt value="${esc(A.st)}"></label></div>`:""}
    <p class="note" style="margin:10px 0 0">Showing: <b>${esc(span)}</b>. "This week" is the last 7 days and "This month" is the last 30 days. The shop keeps the last 180 days of orders on this screen.</p></section>`;
}
const kpiTile=(n,l,sub,hot)=>`<div class="db-k${hot?" hot":""}" style="cursor:default"><strong>${n}</strong><small>${l}</small>${sub?`<small style="opacity:.75">${sub}</small>`:""}</div>`;
const rankList=(rows,unit)=>rows.length?`<ol class="rank">${rows.map(([n,v],i)=>{const mx=rows[0][1]||1;return `<li><span class="rk-n">${i+1}</span><span class="rk-l">${esc(n)}</span><span class="rk-v">${v} ${v===1?unit.replace(/s$/,""):unit}</span><i class="rk-b" style="width:${Math.max(4,v/mx*100)}%"></i></li>`}).join("")}</ol>`:`<div class="empty">Nothing in this period.</div>`;
function moreInsights(set){
  const key=o=>normPhone(o.customer&&o.customer.phone)||String(o.customer&&o.customer.email||"").toLowerCase()||o.id;
  const per={};set.forEach(o=>{const k=key(o),c=per[k]||(per[k]={name:(o.customer&&o.customer.name)||"Customer",n:0,spent:0});c.n++;c.spent+=(o.total||0)-((o.refund&&o.refund.amount)||0)});
  const everyPaid={};DB.orders.filter(o=>o.paidAt||o.status==="completed").forEach(o=>{const k=key(o);everyPaid[k]=(everyPaid[k]||0)+1});
  const uniq=Object.keys(per).length,repeat=Object.keys(per).filter(k=>(everyPaid[k]||0)>=2).length;
  const disc=set.reduce((x,o)=>x+(o.discount||0)+(o.couponDisc||0),0);
  const pick=set.filter(o=>o.mode!=="delivery").length,del=set.length-pick,same=set.filter(o=>o.speed==="sameday").length;
  const slots={};set.forEach(o=>{if(o.time)slots[o.time]=(slots[o.time]||0)+1});
  const busy=Object.entries(slots).sort((x,y)=>y[1]-x[1])[0];
  const top=Object.values(per).sort((x,y)=>y.spent-x.spent||y.n-x.n).slice(0,5);
  const t=(n,l)=>`<div class="db-k" style="cursor:default"><strong>${n}</strong><small>${l}</small></div>`;
  return `<section class="panel"><h2>✨ More insights</h2>
    <div class="db-kpis perf" style="margin-top:12px">
      ${t(uniq,"Unique customers")}${t(repeat,"Repeat customers")}
      ${t(money(disc),"Discounts given")}${t(`${pick} / ${del}`,"Pickup / Delivery")}
      ${t(same,"Sameday orders")}${t(busy?esc(busy[0]):"–",`Busiest time slot${busy?` (${busy[1]} order${busy[1]===1?"":"s"})`:""}`)}
    </div>
    <h3 style="margin:16px 0 6px;font-size:15px">Top customers</h3>
    ${top.length?`<ol class="rank">${top.map((c,i)=>`<li><span class="rk-n">${i+1}</span><span class="rk-l">${esc(c.name)} <small class="note">(${c.n} order${c.n===1?"":"s"})</small></span><span class="rk-v">${money(c.spent)}</span></li>`).join("")}</ol>`:`<div class="empty">Nothing in this period.</div>`}
    <p class="note" style="margin:10px 0 0">Repeat customers have 2 or more paid orders in total. Discounts are flash sales plus coupons. Top customers are ranked by what they spent after refunds.</p></section>`;
}
function viewDashSales(){
  const [a,b]=srRange(),inR=ms=>ms>=a&&ms<b;
  const when=o=>o.completedAt||(o.refund&&o.refund.at)||o.paidAt||o.createdAt||0;
  const set=DB.orders.filter(o=>(o.status==="completed"||o.refund)&&inR(when(o)));
  const n=set.length,sum=f=>set.reduce((x,o)=>x+(f(o)||0),0);
  const items=sum(o=>Object.values(o.items||{}).reduce((q,v)=>q+v,0)),gross=sum(o=>o.total),fee=sum(o=>o.fee);
  const dels=set.filter(o=>o.mode==="delivery").length,refs=set.filter(o=>o.refund),refund=refs.reduce((x,o)=>x+o.refund.amount,0),net=gross-fee-refund;
  const ownerCancel=DB.orders.filter(o=>o.status==="cancelled"&&(o.cancelBy==="owner"||o.cancelBy==="staff")&&inR(o.cancelledAt||o.createdAt)).length;
  const bySize={},byItem={};let shuf=0;
  set.forEach(o=>{bySize[o.size]=(bySize[o.size]||0)+1;if(o.shuffled)shuf++;Object.entries(o.items||{}).forEach(([id,q])=>{const p=prod(id),nm=p?p.name:"Removed flavor";byItem[nm]=(byItem[nm]||0)+q})});
  const sizes=Object.entries(bySize).sort((x,y)=>y[1]-x[1]||x[0]-y[0]).map(([k,v])=>[`Box of ${k}`,v]);
  const best=Object.entries(byItem).sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0]));
  return head("Dashboard","How the shop is doing right now, and what needs you.")+dashTabs()+MOCK+srFilter()+`<div class="stack">
    <section class="panel"><h2>Sales</h2><p class="sub">Only orders that were delivered or picked up, plus refunded orders. Each order counts on the day it was delivered or picked up (or refunded).</p>
      <div class="db-kpis" style="margin-top:12px">
        ${kpiTile(n,"Total orders")}${kpiTile(items,"Total items sold")}${kpiTile(money(gross),"Total gross sales")}
        ${kpiTile(money(n?gross/n:0),"Average per order")}${kpiTile(money(fee),"Total delivery fee")}${kpiTile(money(dels?fee/dels:0),"Average delivery fee",`per delivery order (${dels})`)}
        ${kpiTile(money(refund),"Total refund",`${refs.length} order${refs.length===1?"":"s"}`)}${kpiTile(money(refs.length?refund/refs.length:0),"Average refund per order")}
        ${kpiTile(money(net),"Total net sales","gross − delivery fee − refund",true)}
        ${kpiTile(ownerCancel,"Total owner cancelled orders","cancelled by the owner or staff")}
      </div></section>
    <section class="panel"><h2>Most picked box</h2><p class="sub">Number of orders for each box size, top selling first.</p>${rankList(sizes,"orders")}</section>
    <section class="panel"><h2>Total order random</h2><p class="sub">Orders where the customer used Random fill, Shuffle or "fill the rest for me".</p>
      <div class="db-kpis" style="margin-top:8px">${kpiTile(shuf,"Orders using random",n?Math.round(shuf/n*100)+"% of orders":"")}</div></section>
    <section class="panel"><h2>Best seller item</h2><p class="sub">Cookies sold per flavor, top selling first.</p>${rankList(best,"cookies")}</section>
    ${moreInsights(set)}</div>`;
}
function viewDashPerf(){
  const [a,b]=srRange(),inR=ms=>ms>=a&&ms<b;
  const pct=(x,y)=>y?(Math.round(x/y*1000)/10)+"%":"–";
  const placedL=DB.orders.filter(o=>inR(o.createdAt));
  const placed=placedL.length,paid=placedL.filter(o=>o.paidAt||PAID_ST.includes(o.status)||o.refund).length,done=placedL.filter(o=>o.status==="completed").length;
  const sys=placedL.filter(o=>o.status==="cancelled"&&o.cancelBy==="system").length;
  const ownerC=placedL.filter(o=>o.status==="cancelled"&&(o.cancelBy==="owner"||o.cancelBy==="staff")).length;
  const refunded=placedL.filter(o=>o.refund).length;
  const prog=placedL.filter(o=>["new","baking","ready"].includes(o.status)).length;
  const cpL=DB.orders.filter(o=>o.complaint&&inR(o.complaint.at||o.createdAt));
  const cpDone=cpL.filter(o=>o.complaint.status==="resolved").length,cpOpen=cpL.filter(o=>o.complaint.status==="open"||o.complaint.status==="review").length;
  const revs=DB.products.flatMap(p=>(p.reviews||[]).filter(r=>!r.example&&inR(r.at||0)));
  const avg=revs.length?(revs.reduce((x,r)=>x+(+r.stars||0),0)/revs.length).toFixed(1)+" ★":"–";
  const t=(n,l,cls)=>`<div class="db-k${cls?" "+cls:""}" style="cursor:default"><strong>${n}</strong><small>${l}</small></div>`;
  return head("Dashboard","How the shop is doing right now, and what needs you.")+dashTabs()+MOCK+srFilter()+`<div class="stack"><section class="panel"><h2>Performance</h2>
    <div class="db-kpis perf" style="margin-top:12px">
      ${t(placed,"Total placed orders")}${t(sys,"Cancelled by system<br>no payment in time","warn")}
      ${t(cpL.length,"Total complaints","warn")}${t(paid,"Paid orders")}
      ${t(pct(paid,placed),"Payment rate")}${t(done,"Delivered / picked up")}
      ${t(pct(done,placed),"Completion rate")}${t(ownerC,"Cancelled by owner")}
      ${t(refunded,"Refunded")}${t(prog,"Still in progress")}
      ${t(pct(cpL.length,done),"Complaint rate")}${t(cpDone,"Complaints resolved","good")}
      ${t(cpOpen,"Complaints not resolved")}${t(avg,`Average rating (${revs.length} review${revs.length===1?"":"s"})`)}
    </div>
    <p class="note" style="margin:12px 0 0">Orders by order date · complaints and reviews by the date they were sent. Payment rate = paid ÷ placed. Completion rate = delivered or picked up ÷ placed. Complaint rate = complaints ÷ delivered or picked up.</p></section></div>`;
}
function viewDashboard(){
  if(A.dt==="sales")return viewDashSales();if(A.dt==="perf")return viewDashPerf();
  A.dsig=dashSig();
  const [s0,s1]=dashRange(A.dd),inR=(ms,a=s0,b=s1)=>ms>=a&&ms<b;
  const lbl=A.dd==="all"?"all dates":A.dd==="today"?"today":fmtDay(A.dd);
  const ordersIn=DB.orders.filter(o=>o.status!=="cancelled"&&inR(o.createdAt)).sort((a,b)=>b.createdAt-a.createdAt);
  const paidIn=DB.orders.filter(o=>canLabel(o)&&inR(o.paidAt||o.createdAt));
  const rev=paidIn.reduce((a,o)=>a+o.total-((o.refund&&o.refund.amount)||0),0);
  const review=DB.orders.filter(o=>o.status==="review").sort((a,b)=>((a.proof&&a.proof.at)||0)-((b.proof&&b.proof.at)||0));
  const prog=DB.orders.filter(o=>["new","baking","ready"].includes(o.status)).length;
  const cps=DB.orders.filter(o=>o.complaint&&o.complaint.status==="open").length;
  // visitors
  const [v0,v1]=dashRange(A.vr),vs=VIS.filter(v=>inR(v.t,v0,v1)),uniq=new Set(vs.map(v=>v.v)).size;
  const placed=DB.orders.filter(o=>o.status!=="cancelled"&&inR(o.createdAt,v0,v1)).length,conv=uniq?Math.min(100,Math.round(placed/uniq*100)):0;
  const nb=A.vr==="today"?24:A.vr==="week"?7:30,step=A.vr==="today"?3600e3:864e5,cnt=Array(nb).fill(0);
  vs.forEach(v=>{const i=Math.min(nb-1,Math.floor((v.t-v0)/step));if(i>=0)cnt[i]++});
  const mx=Math.max(...cnt,0);
  const axis=A.vr==="today"?[0,6,12,18].map(h=>[h/24*100,h+"h"]):A.vr==="week"?cnt.map((_,i)=>[(i+.5)/7*100,new Date(v0+i*864e5).toLocaleDateString("en-US",{weekday:"short"})]):[0,7,14,21,29].map(i=>[(i+.5)/30*100,new Date(v0+i*864e5).toLocaleDateString("en-US",{month:"short",day:"numeric"})]);
  const unit=A.vr==="today"?"hour":"day",note=`Visits per ${unit}${A.vr==="today"?" today":A.vr==="week"?", last 7 days":", last 30 days"}. Staff and search-engine bots are not counted; a visitor returning within 30 minutes counts once.`;
  // activity
  const ev=[];DB.orders.forEach(o=>{
    ev.push({at:o.createdAt,i:"🍪",t:`New order #${o.code} · ${o.customer.name} · ${money(o.total)}`});
    if(o.proof)ev.push({at:o.proof.at,i:"🧾",t:`Payment submitted for #${o.code} (${o.proof.name})`});
    if(o.complaint)ev.push({at:o.complaint.at,i:"⚠️",t:`Complaint on #${o.code} · ${o.complaint.reason}`});
    if(o.completedAt)ev.push({at:o.completedAt,i:"📦",t:`#${o.code} ${stLabel("completed",o.mode).toLowerCase()}`})});
  ev.sort((a,b)=>b.at-a.at);const t0=today0().getTime();
  const when=ms=>ms>=t0?new Date(ms).toLocaleTimeString("en-US",{hour:"numeric",minute:"2-digit"}):fmtDT(ms);
  const appr=ROLE()==="owner"?DB.orders.filter(o=>o.status==="review"&&o.payReq):[];
  const rj=ROLE()==="owner"?DB.orders.filter(o=>o.status==="review"&&o.rejReq):[];
  const rejHTML=rj.length?`<section class="panel apprbox rej"><h2 class="blinky">⏳ Proof rejections waiting for you (${rj.length})</h2><p class="sub">Staff want to reject these payment proofs. The customer is only told after you approve.</p>
    <div style="display:grid;gap:8px;margin-top:10px">${rj.map(o=>`<div class="apprrow"><div><b>#${esc(o.code)}</b> · ${esc(o.customer.name)} · ${money(o.total)}<br><small>Rejected by ${esc(o.rejReq.by)} · ${fmtAgo(o.rejReq.at)}${o.rejReq.reason?` · "${esc(o.rejReq.reason)}"`:""}</small></div>
      <div class="oc-sts" style="margin:0">${o.proof?`<button class="oc-b" type="button" data-oproof="${o.id}">View proof</button>`:""}<button class="danger" type="button" data-rapprove="${o.id}">✓ Approve rejection</button><button class="oc-b" type="button" data-rdeny="${o.id}">Keep payment</button></div></div>`).join("")}</div></section>`:"";
  const apprHTML=appr.length?`<section class="panel apprbox"><h2 class="blinky">⏳ Waiting for your approval (${appr.length})</h2><p class="sub">Staff checked these payments. They only become "Payment confirmed" after you approve.</p>
    <div style="display:grid;gap:8px;margin-top:10px">${appr.map(o=>`<div class="apprrow"><div><b>#${esc(o.code)}</b> · ${esc(o.customer.name)} · ${money(o.total)}<br><small>Checked by ${esc(o.payReq.by)} · ${fmtAgo(o.payReq.at)}</small></div>
      <div class="oc-sts" style="margin:0">${o.proof?`<button class="oc-b" type="button" data-oproof="${o.id}">View proof</button>`:""}<button class="btn btn-blue btn-sm" type="button" data-papprove="${o.id}">✓ Approve</button><button class="oc-b" type="button" data-preject="${o.id}">Turn down</button></div></div>`).join("")}</div></section>`:"";
  return head("Dashboard","How the shop is doing right now, and what needs you.")+dashTabs()+MOCK+rejHTML+apprHTML+`
  <div class="stack">
    <section class="panel">
      <div class="db-top"><button class="fchip" type="button" data-dd="all" aria-pressed="${A.dd==="all"}">All dates</button><button class="fchip" type="button" data-dd="today" aria-pressed="${A.dd==="today"}">Today</button><input class="oc-date" type="date" data-dddate value="${A.dd!=="all"&&A.dd!=="today"?A.dd:""}" aria-label="Show a single date"></div>
      <p class="note" style="margin:10px 0 12px">Orders and Paid follow the date filter. Items waiting for you always show every date.</p>
      <div class="db-kpis">
        <button class="db-k" type="button" data-dashgo="orders"><strong>${ordersIn.length}</strong><small>Orders · ${esc(lbl)}</small></button>
        <button class="db-k" type="button" data-dashgo="orders"><strong>${money(rev)}</strong><small>Paid · ${esc(lbl)}</small></button>
        <button class="db-k${review.length?" hot":""}" type="button" data-dashgo="orders" data-dfilter="review"><strong>${review.length}</strong><small>Payments to confirm</small></button>
        <button class="db-k" type="button" data-dashgo="orders"><strong>${prog}</strong><small>Orders in progress</small></button>
        <button class="db-k" type="button" data-dashgo="complaints"><strong>${cps}</strong><small>Open complaints</small></button>
      </div>
    </section>
    ${ROLE()==="owner"?`<section class="panel">
      <h2>👥 Visitors</h2>
      <div class="chips" style="margin-top:10px">${[["today","Today"],["week","This week"],["month","This month"]].map(([k,l])=>`<button class="fchip" type="button" data-vr="${k}" aria-pressed="${A.vr===k}">${l}</button>`).join("")}</div>
      <div class="db-vis"><div><strong>${vs.length}</strong><small>Visits</small></div><div><strong>${uniq}</strong><small>Unique visitors</small></div><div><strong>${placed}</strong><small>Orders placed</small></div><div><strong>${conv}%</strong><small>Visitors who ordered</small></div></div>
      <div class="db-chart" role="img" aria-label="${esc(note)} Total ${vs.length}.">${cnt.map((c,i)=>`<i class="${c?"":"z"}" style="height:${c&&mx?Math.max(4,c/mx*100):0}%" title="${c} visit${c===1?"":"s"}"></i>`).join("")}</div>
      <div class="db-axis" aria-hidden="true">${axis.map(([p,l])=>`<span style="left:${p}%">${l}</span>`).join("")}</div>
      <p class="note" style="margin:6px 0 0">${esc(note)}</p>
    </section>`:""}
    <section class="panel">
      <div class="db-top"><button class="ghost" type="button" data-dashgo="orders" data-dfilter="all">Open all orders</button><button class="ghost" type="button" data-dashsound>${DB.alerts.sound?"🔔 Sound on":"🔕 Sound off"}</button></div>
      <p class="note" style="margin:10px 0 0"><span class="db-live"></span>Live: new orders, payments and complaints appear here and as a pop-up while this page is open.</p>
    </section>
    <section class="panel">
      <h2>💰 Waiting for your payment confirmation</h2>
      ${review.length?review.map(o=>`<div class="db-row"><div class="grow"><b>#${esc(o.code)}</b> ${esc(o.customer.name)} · ${money(o.total)}<span class="meta">${o.proof?`from ${esc(o.proof.name)} · ${fmtAgo(o.proof.at)}`:""}</span></div><div class="colin" style="flex:none;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="ghost" type="button" data-dproof="${o.id}">🧾 Proof</button><button class="btn btn-blue btn-sm" type="button" data-dconfirm="${o.id}">✓ Confirm</button></div></div>`).join(""):`<div class="empty" style="margin-top:10px">Nothing is waiting. You're all caught up.</div>`}
    </section>
    <section class="panel">
      <h2><span class="db-live"></span>Live activity</h2>
      ${ev.length?ev.slice(0,10).map(e=>`<div class="db-row"><span class="grow">${e.i} ${esc(e.t)}</span><span class="note" style="margin:0;white-space:nowrap">${esc(when(e.at))}</span></div>`).join(""):`<div class="empty">No activity yet.</div>`}
    </section>
    <section class="panel">
      <h2>📋 Latest orders · ${esc(lbl)}</h2>
      ${ordersIn.length?ordersIn.slice(0,8).map(o=>`<button class="db-row" type="button" data-order="${o.id}" style="width:100%;background:none;border:0;border-top:1px solid var(--ice-2);text-align:left;font:inherit;color:var(--ink);cursor:pointer"><span class="grow"><b>#${esc(o.code)}</b> ${esc(o.customer.name)} · ${money(o.total)}</span><span class="mo-chip st-${o.status}">${esc(stLabel(o.status,o.mode))}</span></button>`).join(""):`<div class="empty" style="margin-top:10px">No orders for ${esc(lbl)}.</div>`}
    </section>
  </div>`;
}
/* --- Orders dashboard --- */
function viewOrders(){
  const now=Date.now(),t=today0(),tomorrow=ymd(addDays(t,1)),todayS=ymd(t);
  const live=DB.orders.filter(o=>o.status!=="cancelled"&&o.status!=="awaiting");
  const wk=live.filter(o=>o.createdAt>=now-7*86400e3),rev=wk.reduce((a,o)=>a+o.total,0);
  const nNew=DB.orders.filter(o=>o.status==="review"||o.status==="new").length;
  const tmr=live.filter(o=>o.day===tomorrow);
  const days=[...new Set(live.filter(o=>o.day>=todayS&&o.status!=="completed").map(o=>o.day))].sort();
  if(!A.bakeDay||!days.includes(A.bakeDay))A.bakeDay=days[0]||null;
  // bake sheet
  let bake=`<div class="empty">No boxes to bake yet.</div>`;
  if(A.bakeDay){
    const os=live.filter(o=>o.day===A.bakeDay&&o.status!=="completed"),agg={};let cookies=0;const bySize={};let pick=0,deliv=0;
    os.forEach(o=>{Object.entries(o.items).forEach(([id,n])=>{agg[id]=(agg[id]||0)+n;cookies+=n});bySize[o.size]=(bySize[o.size]||0)+1;o.mode==="delivery"?deliv++:pick++});
    const rows=Object.entries(agg).sort((a,b)=>b[1]-a[1]),max=rows[0]?rows[0][1]:1;
    bake=`<ul class="bake">${rows.map(([id,n])=>{const p=prod(id);return `<li>${miniPlate(p)}<div><div style="font-weight:600">${esc(p?p.name:"Removed flavor")}</div><div class="bar-t"><i style="width:${n/max*100}%"></i></div></div><b>${n}</b></li>`}).join("")}</ul>
      <div class="bakesum"><span>${cookies} cookies</span>${Object.entries(bySize).sort((a,b)=>a[0]-b[0]).map(([n,c])=>`<span>${c} × box of ${n}</span>`).join("")}<span>${pick} pickup</span><span>${deliv} delivery</span></div>`;
  }
  const base=ordRows(),rows=shownRows(),todayYmd=ymd(t);
  const cnt=k=>k==="all"?base.length:k==="rejected"?base.filter(isRej).length:k==="awaiting"?base.filter(o=>o.status==="awaiting"&&!isRej(o)).length:base.filter(o=>o.status===k).length;
  const toPrint=rows.filter(o=>canLabel(o)&&!o.labelAt).length;
  const dayTxt=A.od==="all"?"all dates":A.od==="today"?"today":fmtDay(A.od);
  const alerts=DB.products.filter(isLow).sort((a,b)=>a.stock-b.stock);
  return head("Orders","Today's work at a glance: what's new, what to bake, and every order's status.")+MOCK+`
  <div class="stack">
    ${alerts.length?`<section class="panel"><div class="phead"><div><h2>Stock alert</h2><p class="sub">Flavors at or below ${DB.settings.lowStockAt} cookies. Customers see "Only N left" and can't order more than what's in stock.</p></div><button class="btn btn-blue btn-sm" type="button" data-goto="products">Restock flavors</button></div><div class="chips">${alerts.map(p=>`<span class="fchip${p.stock===0?" outc":""}">${esc(p.name)} <i>${p.stock===0?"Out of stock":p.stock+" left"}</i></span>`).join("")}</div></section>`:""}
    <div class="kpis">
      <div class="kpi${nNew?" alert":""}"><small>New orders</small><strong>${nNew}</strong><span>paid or payment to check</span></div>
      <div class="kpi"><small>Boxes for tomorrow</small><strong>${tmr.length}</strong><span>${tmr.reduce((a,o)=>a+o.size,0)} cookies, ${fmtDay(tomorrow)}</span></div>
      <div class="kpi"><small>Sales, last 7 days</small><strong>${money(rev)}</strong><span>${wk.length} orders</span></div>
      <div class="kpi"><small>Average order</small><strong>${money(wk.length?rev/wk.length:0)}</strong><span>last 7 days</span></div>
    </div>
    <section class="panel">
        <div class="phead"><div><h2>Bake sheet</h2><p class="sub">Cookies to bake for each day, from open orders.</p></div>${A.bakeDay?`<div class="colin" style="flex-wrap:wrap;gap:8px"><button class="btn btn-blue btn-sm" type="button" data-bakeprint>🖨 Print bake sheet</button><button class="ghost" type="button" data-bakedl>Save file</button></div>`:""}</div>
        <div class="chips">${days.map(d=>`<button class="fchip" type="button" data-bake="${d}" aria-pressed="${d===A.bakeDay}">${d===todayS?"Today":d===tomorrow?"Tomorrow":fmtDay(d)}</button>`).join("")}</div>
        ${bake}
      </section>
      <section class="panel">
        <div class="oc-dates">
          <button class="fchip" type="button" data-od="all" aria-pressed="${A.od==="all"}">All dates</button>
          <button class="fchip" type="button" data-od="today" aria-pressed="${A.od==="today"}">Today</button>
          <input class="oc-date" type="date" data-oddate value="${A.od!=="all"&&A.od!=="today"?A.od:""}" aria-label="Show orders placed on a date">
        </div>
        <div class="chips" style="margin-top:12px">${[["all","All"],...STATUSES.slice(0,2),["rejected","Rejected"],...STATUSES.slice(2)].map(([k,l])=>`<button class="fchip${k==="rejected"?" fc-rej":""}" type="button" data-filter="${k}" aria-pressed="${A.filter===k}">${l} <i>${cnt(k)}</i></button>`).join("")}</div>
        <div class="tools-row" style="margin:12px 0 14px">
          <span class="note" style="margin:0">${rows.length} order${rows.length===1?"":"s"} · ${esc(dayTxt)} (by order date)</span>
          <div class="colin" style="flex-wrap:wrap;gap:8px"><button class="btn btn-blue btn-sm" type="button" data-printsel ${toPrint?"":"disabled"}>Print unprinted labels (${toPrint})</button>
          <input class="search" id="oSearch" type="search" placeholder="Search name, phone or order" value="${esc(A.q)}" aria-label="Search orders"></div>
        </div>
        ${rows.length?`<div class="oc-grid">${rows.map(orderCard).join("")}</div>`:`<div class="empty">No orders match.</div>`}
      </section>
  </div>`;
}

function openOrder(id){
  const o=DB.orders.find(x=>x.id===id);if(!o)return;A.openOrder=id;
  if(SBH.on&&!o._ft&&((o.proof&&!o.proof.img)||(o.complaint&&o.complaint.photoCount>0&&!(o.complaint.photos||[]).length))){o._ft=1;SBH.adminFiles(o).then(()=>{if(A.openOrder===id)openOrder(id)})}
  const d=$("#drawer");
  d.innerHTML=`<div class="drawer-card" role="dialog" aria-modal="true" aria-label="Order ${esc(o.code)}">
    <div class="sheet-top"><div><h3>${esc(o.code)}</h3><span class="note">Placed ${fmtDT(o.createdAt)}${o.example?" · Example":""}</span></div><button class="x" type="button" data-close aria-label="Close">✕</button></div>
    <div class="dsec"><h4>Status</h4><div class="seg">${STATUSES.map(([k])=>`<button type="button" data-set-status="${k}" aria-pressed="${o.status===k}"${k==="awaiting"&&isRej(o)?' class="oc-rejb"':""}>${k==="awaiting"&&isRej(o)?"✕ Rejected":stLabel(k,o.mode)}</button>`).join("")}</div></div>
    ${o.status==="awaiting"?`<div class="dsec"><h4>Payment</h4><p class="hint" style="margin:0 0 8px">Waiting for the customer. Cancels automatically in <span class="cd" data-exp="${o.expiresAt||0}">${fmtLeft((o.expiresAt||0)-Date.now())}</span>.</p><button class="btn btn-blue btn-sm" type="button" data-pay-manual>Mark as paid (cash or other)</button></div>`:""}
    ${isRej(o)?`<div class="dsec"><h4>Payment proof</h4><p class="rej-t" style="margin:0">✕ Rejected ${fmtAgo(o.rejected.at||Date.now())}${o.rejected.reason?`: ${esc(o.rejected.reason)}`:""}</p><p class="hint" style="margin:6px 0 0">The proof is hidden until the customer sends a new one. It then comes back here as Check payment.</p></div>`:""}
    ${o.proof&&!isRej(o)?`<div class="dsec"><h4>Payment proof</h4><dl class="dl"><dt>Name</dt><dd>${esc(o.proof.name)}</dd><dt>Sent</dt><dd>${fmtDT(o.proof.at)}</dd><dt>Amount due</dt><dd>${money(o.total)}</dd></dl><a href="${esc(imgOk(o.proof.img))}" target="_blank" rel="noopener" style="display:block;margin-top:10px"><img class="proofimg" src="${esc(imgOk(o.proof.img))}" alt="Payment proof from ${esc(o.proof.name)}"></a>
      ${o.status==="review"&&o.rejReq?`<div class="oc-alert appr rej" style="margin-top:12px">⏳ ${ROLE()==="owner"?`${esc(o.rejReq.by)} wants to REJECT this proof${o.rejReq.reason?` ("${esc(o.rejReq.reason)}")`:""}`:"Proof rejection sent – waiting for owner approval"}</div>${ROLE()==="owner"?`<div class="mo-row" style="gap:8px;margin-top:8px"><button class="danger" type="button" data-rapprove-d>✓ Approve rejection</button><button class="oc-b" type="button" data-rdeny-d>Keep payment</button></div>`:""}`:''}
      ${o.status==="review"?`<div class="stack" style="margin-top:12px;gap:10px"><label class="af">Reason if rejecting (optional)<input class="in" id="rejReason" maxlength="80" placeholder="e.g. amount doesn't match"></label><div class="mo-row" style="gap:8px"><button class="btn btn-blue btn-sm" type="button" data-pay-ok>Confirm payment</button><button class="danger" type="button" data-pay-no>Reject</button></div></div>`:""}</div>`:""}
    <div class="dsec"><h4>Messages to customer</h4><p class="hint" style="margin:0 0 8px">Customer prefers: ${o.notify==="whatsapp"?"WhatsApp":o.notify==="email"?"Email":"WhatsApp and email"}</p>
      ${(o.msgs||[]).length?`<div class="ditems">${o.msgs.slice().reverse().map(m=>`<div style="display:grid;gap:2px"><span class="note"><b>${CHANNELS[m.channel]}</b> · ${fmtDT(m.at)} · ${m.by==="system"?"automatic":"staff"}</span><span style="font-size:14px">${esc(m.text)}</span>${m.channel==="whatsapp"?`<a href="${esc(waLink(o,m.text))}" target="_blank" rel="noopener" class="note">Send again on WhatsApp</a>`:`<a href="${esc(mailLink(o,m.text))}" class="note">Send again by email</a>`}</div>`).join("")}</div>`:`<p class="hint" style="margin:0">No messages yet. They're logged when you change the status.</p>`}</div>
    ${o.complaint?`<div class="dsec"><h4>Complaint</h4><p class="hint" style="margin:0 0 8px">${esc(o.complaint.reason)} · ${CP_STATUS[o.complaint.status]}</p><button class="btn btn-blue btn-sm" type="button" data-cpgo>View complaint</button></div>`:""}
    ${o.cancelReason?`<div class="dsec"><h4>Cancelled</h4><p class="hint" style="margin:0">${esc(o.cancelReason)}</p></div>`:""}
    ${o.refund?`<div class="dsec"><h4>Refund</h4><dl class="dl"><dt>Status</dt><dd><b>${o.refund.full?"Refunded":"Partly refunded"}</b></dd><dt>Amount</dt><dd>${money(o.refund.amount)} of ${money(o.total)}</dd><dt>When</dt><dd>${fmtDT(o.refund.at)}${o.refund.by?` · by ${esc(o.refund.by)}`:""}</dd>${o.refund.note?`<dt>Note</dt><dd>${esc(o.refund.note)}</dd>`:""}</dl></div>`:canRefund(o)?`<div class="dsec"><h4>Refund</h4><p class="hint" style="margin:0 0 8px">Paid orders can be refunded in full or in part. The customer is told in the shop.</p><button class="btn btn-blue btn-sm" type="button" data-refund="${o.id}">💸 Refund this order</button></div>`:""}
    <div class="dsec"><h4>Shipping label</h4>${o.mode==="delivery"?`<div class="grid2"><label class="af">Courier<input class="in" data-ship="courier" maxlength="30" value="${esc(o.courier||"")}" placeholder="e.g. JNE"></label><label class="af">Airway bill / tracking no.<input class="in" data-ship="awb" maxlength="40" value="${esc(o.awb||"")}" placeholder="e.g. JP1234567890"></label></div>`:`<p class="hint" style="margin:0 0 8px">Pickup order: the label shows the pickup time.</p>`}<button class="btn btn-blue btn-sm" type="button" data-printone="${o.id}" style="margin-top:10px">Print label</button></div>
    <div class="dsec"><h4>Customer</h4><dl class="dl"><dt>Name</dt><dd>${esc(o.customer.name)}</dd><dt>WhatsApp</dt><dd>${esc(o.customer.phone)}</dd><dt>Email</dt><dd>${esc(o.customer.email)}</dd>${o.customer.address?`<dt>Address</dt><dd>${esc(o.customer.address)}</dd>`:""}</dl></div>
    <div class="dsec"><h4>When</h4><dl class="dl"><dt>${modeName(o)}</dt><dd>${esc(whenTxt(o))}</dd>${o.note?`<dt>Note</dt><dd>${esc(o.note)}</dd>`:""}</dl></div>
    <div class="dsec"><h4>Box of ${o.size}</h4><div class="ditems">${Object.entries(o.items).map(([id,n])=>{const p=prod(id);return `<div>${miniPlate(p)}<span>${n} × ${esc(p?p.name:"Removed flavor")}</span><span class="num">${p&&p.surcharge>0?"+"+money(p.surcharge*n):""}</span></div>`}).join("")}</div></div>
    <div class="dsec"><h4>Payment</h4><div class="summary" style="margin:0">
      <div><span>Box of ${o.size}</span><span class="num">${money(o.base)}</span></div>
      ${o.discount>0?`<div class="sl"><span>${esc(o.sale||"Flash sale")}</span><span class="num">−${money(o.discount)}</span></div>`:""}
      ${o.couponDisc>0?`<div class="sl"><span>Coupon ${esc(o.coupon)}</span><span class="num">−${money(o.couponDisc)}</span></div>`:""}
      ${o.surcharge>0?`<div><span>Premium flavors</span><span class="num">+${money(o.surcharge)}</span></div>`:""}
      ${o.addons.map(id=>{const a=DB.addons.find(x=>x.id===id);return `<div><span>${esc(a?a.name:"Extra")}</span><span class="num">${a?"+"+money(a.price):""}</span></div>`}).join("")}
      <div><span>${modeName(o)}</span><span class="num">${o.fee?money(o.fee):"Free"}</span></div>
      <div class="t"><span>Total</span><span class="num">${money(o.total)}</span></div></div></div>
  </div>`;
  d.hidden=false;
}
function closeDrawer(){$("#drawer").hidden=true;A.openOrder=null}

/* --- order cards --- */
const canLabel=o=>PAID_ST.includes(o.status);
function ordRows(){
  const q=A.q.trim().toLowerCase(),day=A.od==="all"?null:A.od==="today"?ymd(today0()):A.od;
  return DB.orders.filter(o=>(!day||ymd(new Date(o.createdAt))===day)&&(!q||[o.code,o.customer.name,o.customer.email,o.customer.phone].join(" ").toLowerCase().includes(q))).sort((a,b)=>ordRank(a)-ordRank(b)||b.createdAt-a.createdAt);
}
const ordRank=o=>(o.payReq||o.rejReq)&&o.status==="review"?0:o.complaint&&(o.complaint.status==="open"||o.complaint.status==="review")?0:o.status==="review"?1:2;
// order steps: forward only for staff; confirm payment needs proof (and an owner's approval when staff confirm it)
function stepWhy(o,st){
  const cur=o.status,own=ROLE()==="owner",del=o.mode==="delivery";
  if(st===cur)return "";
  if(st==="new"&&!o.proof)return "Confirm payment needs the customer's payment proof first.";
  if(st==="ready"&&del&&!(String(o.courier||"").trim()&&String(o.awb||"").trim()))return "Type the courier and the airway bill number first. The order moves to Out for delivery by itself.";
  const SEQ=["awaiting","review","new","baking","ready","completed"],ci=SEQ.indexOf(cur),si=SEQ.indexOf(st);
  if(st==="new"&&ci>=0&&ci<3&&cur!=="review")return "Confirm payment needs the customer's payment proof first.";
  if(si>=3&&ci>=0&&ci<2)return "Confirm the payment first. Baking and the next steps only open after Payment confirmed.";
  if(ci>=2&&si>ci+1)return "Orders move one step at a time. They can't skip a step.";
  if(own)return "";
  if(cur==="review"&&st==="new")return o.rejReq?"A proof rejection is already waiting for the owner.":o.payReq?"Already waiting for the owner's approval.":"";
  if(cur==="review"&&st==="awaiting")return o.payReq?"A payment confirmation is already waiting for the owner.":o.rejReq?"Already waiting for the owner's approval.":"";
  const ok=(["awaiting","review"].includes(cur)&&st==="cancelled")||(cur==="new"&&st==="baking")||(cur==="baking"&&st==="ready")||(cur==="ready"&&st==="completed");
  return ok?"":["new","baking"].includes(cur)&&st==="cancelled"?"Only an owner can cancel a paid order.":"Orders only move forward one step at a time. Going back needs an owner.";
}
const canEditOrder=o=>ROLE()==="owner"?!["cancelled","completed"].includes(o.status):["awaiting","review"].includes(o.status);
const canCancelOrder=o=>ROLE()==="owner"?!["cancelled","completed"].includes(o.status):["awaiting","review"].includes(o.status);
const shownRows=()=>ordRows().filter(o=>A.filter==="all"||(A.filter==="rejected"?isRej(o):A.filter==="awaiting"?o.status==="awaiting"&&!isRej(o):o.status===A.filter));
function orderCard(o){
  const del=o.mode==="delivery",c=o.customer,paid=canLabel(o);
  const flow=["awaiting","new","baking","ready","completed"];
  const keys=flow.includes(o.status)?flow:[o.status,...flow];
  const items=Object.entries(o.items).map(([id,n])=>{const p=prod(id);return `<div>${esc(p?p.name:"Removed flavor")} ×${n}</div>`}).join("");
  const addons=o.addons.map(id=>{const a=DB.addons.find(x=>x.id===id);return a?`<div class="note" style="margin:0">+ ${esc(a.name)}</div>`:""}).join("");
  const payLine=isRej(o)?`<span class="rej-t">✕ Payment proof rejected${o.rejected.reason?`: ${esc(o.rejected.reason)}`:""}</span><br>Waiting for a new proof · cancels in <span class="cd" data-exp="${o.expiresAt||0}">${fmtLeft((o.expiresAt||0)-Date.now())}</span>`:o.proof?`Payment proof from <b>${esc(o.proof.name)}</b> · ${fmtAgo(o.proof.at)}`:(o.status==="awaiting"?`Payment: <b>not paid yet</b> · cancels in <span class="cd" data-exp="${o.expiresAt||0}">${fmtLeft((o.expiresAt||0)-Date.now())}</span>`:"");
  const canEdit=canEditOrder(o),own=ROLE()==="owner";
  const lbl=paid?(o.labelAt?`<div class="oc-lbl ok">✓ Label printed ${fmtAgo(o.labelAt)}</div>`:`<div class="oc-lbl warn">⚠ Label not printed yet</div>`):(o.status==="cancelled"?"":`<div class="oc-lbl off">Label can be printed after payment is confirmed</div>`);
  return `<article class="oc-card" aria-label="Order ${esc(o.code)}">
    <div class="oc-h"><span>#${esc(o.code)} · ${esc(c.name)}${o.example?`<span class="ex">Example</span>`:""}${o.complaint?`<span class="ex oc-cp">Complaint</span>`:""}</span><b class="num">${money(o.total)}</b></div>
    ${o.refund?`<div class="oc-alert ref">💸 ${o.refund.full?"Refunded":"Partly refunded"}: ${money(o.refund.amount)} · ${fmtAgo(o.refund.at)}${o.refund.note?" · "+esc(o.refund.note):""}</div>`:""}
    ${o.status==="review"&&o.payReq?`<div class="oc-alert appr">⏳ ${own?`${esc(o.payReq.by)} confirmed this payment – needs your approval`:`Payment checked – waiting for owner approval`}</div>${own?`<div class="oc-sts"><button class="btn btn-blue btn-sm" type="button" data-papprove="${o.id}">✓ Approve payment</button><button class="oc-b" type="button" data-preject="${o.id}">Turn down</button></div>`:""}`
      :o.status==="review"&&o.rejReq?`<div class="oc-alert appr rej">⏳ ${own?`${esc(o.rejReq.by)} wants to REJECT this payment proof${o.rejReq.reason?` ("${esc(o.rejReq.reason)}")`:""} – needs your approval`:`Proof rejection sent – waiting for owner approval`}</div>${own?`<div class="oc-sts"><button class="danger" type="button" data-rapprove="${o.id}">✓ Approve rejection</button><button class="oc-b" type="button" data-rdeny="${o.id}">Keep payment (turn down)</button></div>`:""}`
      :o.status==="review"?`<div class="oc-alert pay">💰 Payment submitted – needs your confirmation</div>`:""}
    ${o.complaint&&(o.complaint.status==="open"||o.complaint.status==="review")?`<div class="oc-alert cmp">ORDER COMPLAINED - need your attention</div>`:""}
    ${o.proof&&!isRej(o)?`<div><button class="oc-b" type="button" data-oproof="${o.id}">View payment proof</button></div>`:""}
    <div class="oc-info"><span class="mode" style="margin:0">${modeName(o)}</span> ${esc(whenTxt(o))}<br>${esc(c.phone)} · ${esc(c.email)}${del&&c.address?`<br>${esc(c.address)}`:""}${o.note?`<br><i>Note: ${esc(o.note)}</i>`:""}</div>
    <div class="oc-items"><div class="note" style="margin:0">Box of ${o.size} · placed ${fmtAgo(o.createdAt)}</div>${items}${addons}</div>
    ${payLine?`<div class="oc-info">${payLine}</div>`:""}
    ${o.cancelReason?`<div class="oc-info">Cancel reason: ${esc(o.cancelReason)}</div>`:""}
    <div class="oc-sts" role="group" aria-label="Order status">${keys.map(k=>{const why=stepWhy(o,k);return `<button class="oc-b${why&&o.status!==k?" off":""}${k==="awaiting"&&isRej(o)?" oc-rejb":""}${k==="review"&&o.status==="review"?" oc-chk":""}" type="button" data-ostatus="${o.id}:${k}" aria-pressed="${o.status===k}" ${why&&o.status!==k?`aria-disabled="true" title="${esc(why)}"`:""}>${k==="new"?"✓ ":""}${k==="awaiting"&&isRej(o)?"✕ Rejected":k==="new"&&o.status==="review"&&!own&&!o.payReq?"Confirm payment (owner approves)":stLabel(k,o.mode)}</button>`}).join("")}</div>
    <div class="oc-sts">${canEdit?`<button class="oc-b" type="button" data-osub="${o.id}">✎ Edit / substitute</button>`:""}${canCancelOrder(o)?`<button class="oc-b" type="button" data-ocancel="${o.id}">✕ Cancel order</button>`:""}${canRefund(o)?`<button class="oc-b" type="button" data-refund="${o.id}">💸 Refund</button>`:""}<button class="oc-b" type="button" data-order="${o.id}">Details</button></div>
    ${lbl}
    ${paid&&del?`<div class="grid2"><label class="af" style="font-size:12px">Courier<input class="in" data-oship="courier" data-oid="${o.id}" ${!own&&["ready","completed"].includes(o.status)&&String(o.awb||"").trim()?"disabled":""} maxlength="30" value="${esc(o.courier||"")}" placeholder="e.g. JNE"></label><label class="af" style="font-size:12px">Airway bill<input class="in" data-oship="awb" data-oid="${o.id}" ${!own&&["ready","completed"].includes(o.status)&&String(o.awb||"").trim()?"disabled":""} maxlength="40" value="${esc(o.awb||"")}" placeholder="Tracking no."></label></div>`:""}
    ${paid&&del&&["new","baking"].includes(o.status)?`<p class="note" style="margin:0">${o.status==="baking"?"Type the courier and airway bill: the order moves to <b>Out for delivery</b> by itself.":"After baking, type the courier and airway bill to send it out."}</p>`:""}
    <div class="oc-sts"><button class="oc-b oc-print" type="button" data-printcard="${o.id}" ${paid?"":"disabled"}>🖨 Print 4×6 label</button><button class="oc-b" type="button" data-dlcard="${o.id}" ${paid?"":"disabled"}>Save file</button></div>
    <div class="oc-sts"><a class="btn btn-blue btn-sm" href="${esc(waLink(o,msgText(o,o.status)))}" target="_blank" rel="noopener">WhatsApp</a><a class="btn btn-blue btn-sm" href="${esc(mailLink(o,msgText(o,o.status)))}">Email</a></div>
  </article>`;
}
function showProof(id){
  const o=DB.orders.find(x=>x.id===id);if(!o||!o.proof)return;
  if(SBH.on&&!o.proof.img&&!o._ft){o._ft=1;SBH.adminFiles(o).then(()=>showProof(id));return}
  openModal(`<div class="sheet-top"><h3 id="modalTitle">Payment proof · ${esc(o.code)}</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
  <dl class="dl"><dt>Name</dt><dd>${esc(o.proof.name)}</dd><dt>Sent</dt><dd>${fmtDT(o.proof.at)}</dd><dt>Amount due</dt><dd>${money(o.total)}</dd></dl>
  <a href="${esc(imgOk(o.proof.img))}" target="_blank" rel="noopener" style="display:block;margin-top:10px"><img class="proofimg" src="${esc(imgOk(o.proof.img))}" alt="Payment proof from ${esc(o.proof.name)}"></a>
  <div style="margin-top:14px"><button class="btn btn-ghost-blue btn-sm" type="button" data-mclose>Close</button></div>`,"proof");
}
let OS=null;
function openSubst(id){const o=DB.orders.find(x=>x.id===id);if(!o)return;OS={id,rows:Object.entries(o.items).map(([pid,n])=>({pid,n}))};renderSubst()}
function renderSubst(){
  const o=DB.orders.find(x=>x.id===OS.id);if(!o)return;
  const opts=cur=>(prod(cur)?"":`<option value="${cur}" selected>Removed flavor</option>`)+DB.products.filter(p=>p.status!=="hidden"||p.id===cur).map(p=>`<option value="${p.id}" ${p.id===cur?"selected":""}>${esc(p.name)}${p.track?` (${p.stock} left)`:""}</option>`).join("");
  openModal(`<div class="sheet-top"><h3 id="modalTitle">Edit / substitute · ${esc(o.code)}</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
  <p class="hint" style="margin:0 0 12px">Swap a flavor, for example when one runs out. The box size and quantities stay the same. Premium flavor prices and stock are updated.</p>
  <div class="stack" style="gap:10px">${OS.rows.map((r,i)=>`<label class="af" style="font-size:13px">${r.n} × <select class="in" data-osubsel="${i}">${opts(r.pid)}</select></label>`).join("")}</div>
  <div class="mo-row" style="margin-top:16px;gap:10px;justify-content:flex-end"><button class="ghost" type="button" data-mclose>Cancel</button><button class="btn btn-blue btn-sm" type="button" data-osubsave>Save changes</button></div>`,"osub");
}
$("#modal").addEventListener("change",e=>{if(A.modal==="osub"&&OS&&e.target.dataset.osubsel!==undefined)OS.rows[+e.target.dataset.osubsel].pid=e.target.value});
$("#modal").addEventListener("click",e=>{
  if(A.modal!=="osub"||!OS||!e.target.closest("[data-osubsave]"))return;
  const o=DB.orders.find(x=>x.id===OS.id);if(!o)return;
  releaseHold(o);
  const m={};OS.rows.forEach(r=>m[r.pid]=(m[r.pid]||0)+r.n);o.items=m;
  const sur=Object.entries(m).reduce((a,[pid,n])=>{const p=prod(pid);return a+(p&&p.surcharge>0?p.surcharge*n:0)},0);
  o.total=Math.round((o.total-(o.surcharge||0)+sur)*100)/100;o.surcharge=sur;
  takeHold(o);saveDB();closeModal();OS=null;toast(`${o.code} updated`);renderAdmin();if(A.openOrder===o.id)openOrder(o.id);
});


/* --- customer messages: templates, log, confirm dialog --- */
const CHANNELS={whatsapp:"WhatsApp",email:"Email"};
function rejMsg(o,reason){const nm=(o.customer.name.split(" ")[0]||"there");return `Hi ${nm}, we couldn't accept the payment proof for order ${o.code}${reason?": "+reason:""}. Please send a new payment proof in My orders before the time runs out, or your order will be cancelled automatically.`}
function msgText(o,st){
  const nm=(o.customer.name.split(" ")[0]||"there"),shop=DB.page.name||"Delidome",when=whenTxt(o);
  const t={
    awaiting:`Hi ${nm}, your ${shop} order ${o.code} (${money(o.total)}) is waiting for payment. Please pay and send your proof in My orders before it is cancelled automatically.`,
    review:`Hi ${nm}, we got your payment proof for order ${o.code} and we're checking it now.`,
    new:`Hi ${nm}, your payment for order ${o.code} is confirmed. Thank you! Your box is set for ${o.mode==="delivery"?"delivery":"pickup"} on ${when}.`,
    baking:`Hi ${nm}, your order ${o.code} is being baked now.`,
    ready:o.mode==="delivery"?`Hi ${nm}, your order ${o.code} is out for delivery.${o.courier||o.awb?` ${o.courier?"Courier: "+o.courier+". ":""}${o.awb?"Airway bill: "+o.awb+".":""}`:""} Please keep your phone close.`:`Hi ${nm}, your order ${o.code} is ready for pickup. Address: ${DB.settings.address}`,
    completed:o.mode==="delivery"?`Hi ${nm}, your order ${o.code} was delivered. Enjoy! Please keep your unboxing video, rate your cookies, and tell us within ${DB.settings.complaintWindowH} hours if anything is wrong.`:`Hi ${nm}, thanks for picking up order ${o.code}. Enjoy! You can rate your cookies in My orders and tell us within ${DB.settings.complaintWindowH} hours if anything is wrong.`,
    refunded:`Hi ${nm}, your order ${o.code} was refunded${o.refund?": "+money(o.refund.amount):""}.${o.refund&&o.refund.note?" "+o.refund.note:""} It can take a few days to show in your account.`,
    cancelled:`Hi ${nm}, your order ${o.code} was cancelled.${o.cancelReason?" "+o.cancelReason:""} Contact us if you have questions.`
  };
  return t[st]||`Hi ${nm}, your order ${o.code} is now: ${stLabel(st,o.mode)}.`;
}
function waLink(o,text){let d=String(o.customer.phone).replace(/\D/g,"");if(d.startsWith("0"))d=DB.settings.waCountry+d.slice(1);return `https://wa.me/${d}?text=${encodeURIComponent(text)}`}
function mailLink(o,text){return `mailto:${encodeURIComponent(o.customer.email)}?subject=${encodeURIComponent((DB.page.name||"Delidome")+" order "+o.code)}&body=${encodeURIComponent(text)}`}
function logMsg(o,channels,st,text,by){o.msgs=o.msgs||[];channels.forEach(ch=>o.msgs.push({at:Date.now(),channel:ch,status:st,text,by}))}
const chanList=v=>v==="both"?["whatsapp","email"]:v==="none"?[]:[v];
function applyStatus(id,st){
  const o=DB.orders.find(x=>x.id===id);if(!o)return;const prev=o.status;o.status=st;let note="";
  if(st==='awaiting'&&prev==='cancelled'){o.expiresAt=payDeadlineMs(o);delete o.cancelReason}
  if(st!=='cancelled')delete o.cancelReason;
  if(st==='new'&&!o.paidAt)o.paidAt=Date.now();
  if(st==='completed'&&prev!=='completed')o.completedAt=Date.now();
  if(st!=='completed')delete o.completedAt;
  if(!SBH.on&&o.tracked&&st==="cancelled"&&o.holds){Object.entries(o.items).forEach(([pid,n])=>{const p=prod(pid);if(p&&p.track)p.stock+=n});o.holds=false;note=", stock put back"}
  else if(!SBH.on&&o.tracked&&prev==="cancelled"&&st!=="cancelled"&&!o.holds){Object.entries(o.items).forEach(([pid,n])=>{const p=prod(pid);if(p&&p.track)p.stock=Math.max(0,p.stock-n)});o.holds=true;note=", stock taken again"}
  saveDB();toast(`${o.code} marked ${stLabel(st,o.mode).toLowerCase()}${note}`);renderAdmin();if(A.openOrder===id)openOrder(id)}

/* --- change status with confirmation --- */
let SC=null;
function setOrderStatus(id,st,extra){
  const o=DB.orders.find(x=>x.id===id);if(!o)return;
  if(o.status===st){renderAdmin();return}
  const why=stepWhy(o,st);if(why){toast(why);renderAdmin();return}
  if(ROLE()!=="owner"&&o.status==="review"&&st==="new"){   // staff: ask an owner to approve
    if(!SBH.on){toast("Sent to the owner for approval");return}
    SBH.patchOrder(id,{status:"new"}).then(()=>{toast("Payment checked. Waiting for the owner to approve it.");renderAdmin()}).catch(e=>toast(e.message));return}
  if(ROLE()!=="owner"&&o.status==="review"&&st==="awaiting"){   // staff: ask an owner to approve the rejection
    if(!SBH.on){toast("Sent to the owner for approval");return}
    SBH.patchOrder(id,{status:"awaiting",rejected:{at:Date.now(),reason:(extra&&extra.reason)||""}}).then(()=>{toast("Rejection sent. Waiting for the owner to approve it.");renderAdmin();if(A.openOrder===id)openOrder(id)}).catch(e=>toast(e.message));return}
  SC={id,st,extra:extra||null,done:false};renderStatusDialog();
}
function renderStatusDialog(){
  const o=DB.orders.find(x=>x.id===SC.id);if(!o)return;
  if(SC.done){
    const t=SC.text,ch=SC.channels;
    $("#modalCard").innerHTML=`<div class="sheet-top"><h3 id="modalTitle">Status changed</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
    <p><b>${esc(o.code)}</b> is now <b>${esc(stLabel(SC.st,o.mode))}</b>.</p>
    ${ch.length?`<p class="hint" style="margin:0 0 10px">Send the message to ${esc(o.customer.name)} now. Tap a button to send it from your own WhatsApp or email app.</p>
    <div class="mo-row" style="gap:10px;justify-content:flex-start">${ch.includes("whatsapp")?`<a class="btn btn-blue btn-sm" href="${esc(waLink(o,t))}" target="_blank" rel="noopener">Send on WhatsApp</a>`:""}${ch.includes("email")?`<a class="btn btn-blue btn-sm" href="${esc(mailLink(o,t))}">Send email</a>`:""}</div>`:`<p class="hint">The customer was not notified.</p>`}
    <div style="margin-top:16px"><button class="btn btn-ghost-blue btn-sm" type="button" data-mclose>Done</button></div>`;
    return}
  const pref=o.notify||"both",c=o.customer,st=SC.st;
  const opt=(v,label,sub)=>`<label class="chk" style="align-items:flex-start"><input type="radio" name="scNotify" value="${v}" ${pref===v?"checked":""}><span>${label}${sub?`<small class="note" style="display:block">${esc(sub)}</small>`:""}</span></label>`;
  $("#modalCard").innerHTML=`<div class="sheet-top"><h3 id="modalTitle">Change status?</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
  <p style="margin:0 0 4px"><b>${esc(o.code)}</b> · ${esc(c.name)}</p>
  <p style="margin:0 0 14px"><span class="mo-chip st-${o.status}">${esc(stLabel(o.status,o.mode))}</span> → <span class="mo-chip st-${SC.extra&&SC.extra.reject?"rejected":st}">${esc(SC.extra&&SC.extra.reject?"Rejected":stLabel(st,o.mode))}</span></p>
  ${st==="cancelled"?`<p class="hint" style="margin:0 0 12px">Cancelling puts the cookies back into stock.</p>`:""}
  <div class="af" style="gap:8px">Notify the customer by
    <div class="stack" style="gap:8px">${opt("whatsapp","WhatsApp",c.phone)}${opt("email","Email",c.email)}${opt("both","Both")}${opt("none","Don't notify")}</div>
    <p class="note" style="margin:0">The customer chose: ${esc(pref==="both"?"WhatsApp and email":CHANNELS[pref])}.</p></div>
  <label class="af" style="margin-top:12px">Message<textarea class="in" id="scText" rows="4" maxlength="500">${esc(SC.extra&&SC.extra.reject?rejMsg(o,SC.extra.reason):msgText(Object.assign({},o,SC.extra&&SC.extra.reason?{cancelReason:SC.extra.reason}:{}),st))}</textarea></label>
  <div class="mo-row" style="margin-top:16px;gap:10px;justify-content:flex-end"><button class="ghost" type="button" data-mclose>Keep as ${esc(stLabel(o.status,o.mode))}</button><button class="btn btn-blue btn-sm" type="button" data-scok>Yes, change status</button></div>`;
  if(!$("#modal").hidden){}else openModal($("#modalCard").innerHTML,"status");
  A.modal="status";
}
$("#modal").addEventListener("click",e=>{
  if(A.modal!=="status")return;
  if(e.target.closest("[data-scok]")&&SC&&!SC.done){
    const o=DB.orders.find(x=>x.id===SC.id);if(!o)return;
    const chv=(document.querySelector('input[name="scNotify"]:checked')||{value:"none"}).value,text=$("#scText").value.trim(),channels=chanList(chv);
    const ex=SC.extra;delete o.rejReq;delete o.payReq;if(ex&&ex.reject){o.rejected={at:Date.now(),reason:ex.reason||""};o.expiresAt=Math.max(payDeadlineMs(o),Date.now()+Math.max(5,+DB.settings.rejPayMin||120)*60e3)}
    if(ex&&ex.manual){}
    applyStatus(SC.id,SC.st);
    if(channels.length&&text)logMsg(o,channels,SC.st,text,"staff");
    saveDB();SC.done=true;SC.text=text;SC.channels=channels;renderStatusDialog();renderAdmin();if(A.openOrder===SC.id)openOrder(SC.id);
  }
},true);

/* --- refunds (owner only) --- */
const canRefund=o=>ROLE()==="owner"&&!!o.paidAt&&!o.refund;
let RF=null;
function refundMsgText(o,amt,note){const full=amt>=o.total-.005,nm=(o.customer.name.split(" ")[0]||"there");return `Hi ${nm}, your order ${o.code} was ${full?"refunded":"partly refunded"}: ${money(amt)}.${note?" "+note:""} It can take a few days to show in your account.`}
function renderRefund(){
  const o=DB.orders.find(x=>x.id===RF.id);if(!o)return;const c=o.customer,pref=o.notify||"both";
  if(RF.done){
    const t=RF.text,ch=RF.channels;
    $("#modalCard").innerHTML=`<div class="sheet-top"><h3 id="modalTitle">Refund saved</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
    <p><b>${esc(o.code)}</b> is marked <b>${o.refund&&o.refund.full?"refunded":"partly refunded"}</b>. The customer sees it in their bell and order history.</p>
    ${ch.length?`<p class="hint" style="margin:0 0 10px">You can also message ${esc(c.name)} now. Tap a button to send it from your own WhatsApp or email app.</p><div class="mo-row" style="gap:10px;justify-content:flex-start">${ch.includes("whatsapp")?`<a class="btn btn-blue btn-sm" href="${esc(waLink(o,t))}" target="_blank" rel="noopener">Send on WhatsApp</a>`:""}${ch.includes("email")?`<a class="btn btn-blue btn-sm" href="${esc(mailLink(o,t))}">Send email</a>`:""}</div>`:""}
    <div style="margin-top:16px"><button class="btn btn-ghost-blue btn-sm" type="button" data-mclose>Done</button></div>`;return}
  const opt=(v,label,sub)=>`<label class="chk" style="align-items:flex-start"><input type="radio" name="rfNotify" value="${v}" ${pref===v?"checked":""}><span>${label}${sub?`<small class="note" style="display:block">${esc(sub)}</small>`:""}</span></label>`;
  $("#modalCard").innerHTML=`<div class="sheet-top"><h3 id="modalTitle">Refund order</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
  <p style="margin:0 0 12px"><b>${esc(o.code)}</b> · ${esc(c.name)} · paid ${money(o.total)}</p>
  <div class="grid2"><label class="af">Refund amount<div class="money-in"><span>${esc(DB.settings.currency)}</span><input class="in" id="rfAmt" type="number" min="0.01" step="0.01" max="${o.total}" value="${o.total}"></div></label>
    <label class="af">Note for the customer (optional)<input class="in" id="rfNote" maxlength="120" placeholder="e.g. sent back to your bank"></label></div>
  <p class="note" style="margin:6px 0 0">Make the bank or e-wallet transfer yourself first. This only records it. A refund can't be undone here.</p>
  <div class="af" style="gap:8px;margin-top:12px">Also message the customer by<div class="stack" style="gap:8px">${opt("whatsapp","WhatsApp",c.phone)}${opt("email","Email",c.email)}${opt("both","Both")}${opt("none","Don't send a message")}</div><p class="note" style="margin:0">The shop bell and order history are updated either way.</p></div>
  <p class="err" id="rfErr" hidden></p>
  <div class="mo-row" style="margin-top:16px;gap:10px;justify-content:flex-end"><button class="ghost" type="button" data-mclose>Cancel</button><button class="btn btn-blue btn-sm" type="button" data-rfok>Mark as refunded</button></div>`;
}
document.addEventListener("click",async e=>{
  const rb=e.target.closest("[data-refund]");
  if(rb){const o=DB.orders.find(x=>x.id===rb.dataset.refund);if(!o||!canRefund(o))return;RF={id:o.id,done:false};openModal("","refund");renderRefund();return}
  if(A.modal!=="refund"||!RF||!e.target.closest("[data-rfok]"))return;
  const o=DB.orders.find(x=>x.id===RF.id),er=$("#rfErr"),btn=e.target.closest("[data-rfok]");if(!o)return;
  const amt=Math.round((+$("#rfAmt").value||0)*100)/100,note=$("#rfNote").value.trim();
  if(!(amt>0&&amt<=o.total+.005)){er.textContent=`Enter an amount from 0.01 up to ${money(o.total)}.`;er.hidden=false;return}
  const chv=(document.querySelector('input[name="rfNotify"]:checked')||{value:"none"}).value,channels=chanList(chv),text=refundMsgText(o,amt,note);
  btn.disabled=true;btn.textContent="Saving…";
  try{
    if(SBH.on)await SBH.refundOrder(o.id,amt,note,channels.map(ch=>({channel:ch,text})));
    else{o.refund={amount:amt,full:amt>=o.total-.005,at:Date.now(),note,by:"Owner"};logMsg(o,channels,"refunded",text,"staff");saveDB()}
    RF.done=true;RF.text=text;RF.channels=channels;renderRefund();renderAdmin();if(A.openOrder===o.id)openOrder(o.id);
  }catch(err){er.textContent=err.message||"Couldn't save the refund.";er.hidden=false;btn.disabled=false;btn.textContent="Mark as refunded"}
});

/* --- Check payment pop-up: view the proof, approve or reject with a reason --- */
let CPY=null;
function openCheckPay(id){
  const o=DB.orders.find(x=>x.id===id);if(!o||o.status!=="review")return;
  if(SBH.on&&o.proof&&!o.proof.img&&!o._ft){o._ft=1;SBH.adminFiles(o).then(()=>openCheckPay(id));return}
  CPY={id};const own=ROLE()==="owner",pr=o.proof;
  const waiting=o.payReq?`<div class="oc-alert appr" style="margin:10px 0 0">⏳ ${esc(o.payReq.by)} already approved this payment${own?" – your approval finishes it":" – waiting for the owner"}.</div>`:o.rejReq?`<div class="oc-alert appr rej" style="margin:10px 0 0">⏳ ${esc(o.rejReq.by)} wants to reject this proof${o.rejReq.reason?` ("${esc(o.rejReq.reason)}")`:""}${own?" – your decision finishes it":" – waiting for the owner"}.</div>`:"";
  openModal(`<div class="sheet-top"><h3 id="modalTitle">Check payment · ${esc(o.code)}</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
  ${pr?`<dl class="dl"><dt>Paid by</dt><dd>${esc(pr.name)}</dd><dt>Sent</dt><dd>${fmtDT(pr.at)}</dd><dt>Amount due</dt><dd><b>${money(o.total)}</b></dd></dl>
  ${pr.img?`<a href="${esc(imgOk(pr.img))}" target="_blank" rel="noopener" style="display:block;margin-top:10px"><img class="proofimg" src="${esc(imgOk(pr.img))}" alt="Payment proof from ${esc(pr.name)}"></a>`:`<p class="hint">Loading the picture…</p>`}`:`<p class="hint">No proof picture.</p>`}
  ${waiting}
  <label class="af" style="margin-top:12px">Reason if you reject (the customer sees this)<textarea class="in" id="cpyReason" rows="2" maxlength="80" placeholder="e.g. the amount doesn't match, the picture is blurry">${esc((o.rejReq&&o.rejReq.reason)||"")}</textarea></label>
  <p class="err" id="cpyErr" hidden></p>
  <div class="mo-row" style="margin-top:14px;gap:10px;justify-content:flex-end"><button class="danger" type="button" data-cpyno>✕ Reject</button><button class="btn btn-blue btn-sm" type="button" data-cpyok>✓ Approve payment</button></div>
  ${own?"":`<p class="note" style="margin:8px 0 0">Your choice goes to the owner to approve.</p>`}`,"checkpay");
}
$("#modal").addEventListener("click",e=>{
  if(A.modal!=="checkpay"||!CPY)return;
  const o=DB.orders.find(x=>x.id===CPY.id);if(!o)return;
  if(e.target.closest("[data-cpyok]")){closeModal();CPY=null;
    if(ROLE()==="owner"&&o.payReq){SBH.on?SBH.patchOrder(o.id,{status:"new"}).then(()=>{toast("Payment approved");renderAdmin()}).catch(x=>toast(x.message)):setOrderStatus(o.id,"new");return}
    setOrderStatus(o.id,"new");return}
  if(e.target.closest("[data-cpyno]")){
    const r=($("#cpyReason").value||"").trim();
    if(!r){const er=$("#cpyErr");er.textContent="Type a reason so the customer knows what to fix.";er.hidden=false;$("#cpyReason").focus();return}
    closeModal();CPY=null;setOrderStatus(o.id,"awaiting",{reject:true,reason:r});return}
});

/* --- Flash sales --- */
function viewSales(){
  const D=A.draft,now=Date.now();
  const order={live:0,scheduled:1,ended:2};
  const list=DB.sales.slice().sort((a,b)=>order[saleStatus(a,now)]-order[saleStatus(b,now)]||a.start-b.start);
  const presets=[[30,"30 min"],[60,"1 hr"],[180,"3 hr"],[360,"6 hr"],[1440,"24 hr"]],dur=D.durH*60+D.durM;
  return head("Flash sales","Run a timed discount on the box price. The shop shows a banner with a live countdown and the sale price on each box.")+MOCK+`
  <div class="two">
    <section class="panel">
      <h2>New flash sale or promo</h2><p class="sub">${D.kind==="freedelivery"?"A timed free delivery promo. While it is live, delivery and sameday shipment cost nothing. It shows in the announcer like a flash sale.":"Discounts apply to the box price. Premium flavors, extras and delivery are charged at full price."}</p>
      <form id="saleForm" class="stack" style="gap:14px" novalidate>
        <div class="af">What kind of promo<div class="seg"><button type="button" data-skind="discount" aria-pressed="${D.kind!=="freedelivery"}">Discount on the box</button><button type="button" data-skind="freedelivery" aria-pressed="${D.kind==="freedelivery"}">Free delivery</button></div></div>
        <label class="af">${D.kind==="freedelivery"?"Promo name":"Sale name"}<input class="in" data-draft="name" value="${esc(D.name)}" maxlength="40"></label>
        ${D.kind==="freedelivery"?"":`<div class="stack" style="gap:14px">
          <div class="af">Discount<div class="seg"><button type="button" data-stype="percent" aria-pressed="${D.type==="percent"}">Percent off</button><button type="button" data-stype="amount" aria-pressed="${D.type==="amount"}">Amount off</button></div></div>
          <label class="af">${D.type==="percent"?"Percent":"Amount"}<div class="money-in"><span>${D.type==="percent"?"%":DB.settings.currency}</span><input class="in" type="number" min="1" step="${D.type==="percent"?1:.5}" data-draft="value" value="${D.value}"></div></label>
        </div>`}
        <label class="af">Applies to<select class="in" data-draft="appliesTo"><option value="all" ${D.appliesTo==="all"?"selected":""}>Every box size</option>${DB.sizes.map(s=>`<option value="${s.n}" ${D.appliesTo===String(s.n)?"selected":""}>Box of ${s.n} only</option>`).join("")}</select></label>
        <div class="af">Starts<div class="seg"><button type="button" data-smode="now" aria-pressed="${D.startMode==="now"}">Right now</button><button type="button" data-smode="later" aria-pressed="${D.startMode==="later"}">Schedule</button></div></div>
        ${D.startMode==="later"?`<label class="af">Start date and time<input class="in" type="datetime-local" data-draft="startAt" value="${esc(D.startAt)}"></label>`:""}
        <div class="af">Duration
          <div class="durs">${presets.map(([m,l])=>`<button class="fchip" type="button" data-dur="${m}" aria-pressed="${dur===m}">${l}</button>`).join("")}</div>
          <div class="grid2" style="margin-top:6px"><div class="money-in"><input class="in" type="number" min="0" max="168" data-draft="durH" value="${D.durH}" aria-label="Hours"><span style="padding-right:10px">hours</span></div><div class="money-in"><input class="in" type="number" min="0" max="59" step="5" data-draft="durM" value="${D.durM}" aria-label="Minutes"><span style="padding-right:10px">min</span></div></div>
        </div>
        <div class="preview" id="salePreview"></div>
        <p class="err" id="saleErr" hidden></p>
        <button class="btn btn-blue" type="submit">${D.kind==="freedelivery"?"Create free delivery promo":"Create flash sale"}</button>
      </form>
    </section>
    <section class="panel">
      <h2>All sales and promos</h2><p class="sub">Live sales show in the shop now. Scheduled ones show a "coming up" banner in the last 24 hours before they start.</p>
      ${list.length?`<div class="sales">${list.map(s=>{const st=saleStatus(s,now);return `<div class="sale ${st}">
        <div><span class="spill ${st}">${st==="live"?"Live":st==="scheduled"?"Scheduled":"Ended"}</span>${isFD(s)?` <span class="spill ${st}" style="background:#0A6B34;color:#fff">🚚 Free delivery</span>`:""}<h3>${esc(s.name)}</h3><p>${saleOffText(s)} ${saleAppliesText(s)} · ${fmtDT(s.start)} to ${fmtDT(s.end)}</p></div>
        <div class="cd"><small>${st==="live"?"Ends in":st==="scheduled"?"Starts in":"Ended"}</small><span data-cd="${s.id}"></span></div>
        <div class="acts">${st==="live"?`<button class="ghost" type="button" data-sale-end="${s.id}">End now</button><button class="ghost" type="button" data-sale-extend="${s.id}">+30 min</button>`:""}${st==="scheduled"?`<button class="ghost" type="button" data-sale-start="${s.id}">Start now</button>`:""}<button class="danger" type="button" data-sale-del="${s.id}">Delete</button></div>
      </div>`}).join("")}</div>`:`<div class="empty">No flash sales yet.</div>`}
    </section>
  </div>`;
}
function updatePreview(){
  const el=$("#salePreview");if(!el)return;const D=A.draft;
  if(D.kind==="freedelivery"){const mins0=(+D.durH||0)*60+(+D.durM||0);el.innerHTML=`<div><span>Delivery fee</span><span><s>${money(DB.settings.deliveryFee)}</s> → <b>Free</b></span></div><div><span>Runs for</span><span>${mins0?(Math.floor(mins0/60)?Math.floor(mins0/60)+" hr ":"")+(mins0%60?mins0%60+" min":""):"—"}</span></div>`;document.querySelectorAll("[data-dur]").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.dur===mins0));return}
  const fake={type:D.type,value:+D.value||0};
  const sizes=DB.sizes.filter(s=>D.appliesTo==="all"||String(s.n)===D.appliesTo);
  const mins=(+D.durH||0)*60+(+D.durM||0);
  el.innerHTML=sizes.map(s=>`<div><span>Box of ${s.n}</span><span><s>${money(s.price)}</s> → <b>${money(s.price-saleDiscount(fake,s.price))}</b></span></div>`).join("")+
    `<div><span>Runs for</span><span>${mins?(Math.floor(mins/60)?Math.floor(mins/60)+" hr ":"")+(mins%60?mins%60+" min":""):"—"}</span></div>`;
  document.querySelectorAll("[data-dur]").forEach(b=>b.setAttribute("aria-pressed",+b.dataset.dur===mins));
}
function createSale(){
  const D=A.draft,err=$("#saleErr"),mins=(+D.durH||0)*60+(+D.durM||0),val=+D.value;
  const fail=m=>{err.textContent=m;err.hidden=false},fd=D.kind==="freedelivery";
  if(!D.name.trim())return fail(fd?"Give the promo a name.":"Give the sale a name.");
  if(!fd&&!(val>0))return fail("Set a discount above 0.");
  if(!fd&&D.type==="percent"&&val>90)return fail("Percent off can be at most 90%.");
  if(mins<5)return fail("Make it run at least 5 minutes.");
  let start=Date.now();
  if(D.startMode==="later"){start=new Date(D.startAt).getTime();if(!D.startAt||isNaN(start))return fail("Pick a start date and time.");if(start<Date.now()-60e3)return fail("The start time is in the past.")}
  DB.sales.push({id:uid(),name:D.name.trim(),type:fd?"freedelivery":D.type,value:fd?0:val,appliesTo:D.appliesTo,start,end:start+mins*60e3});
  saveDB();toast(D.startMode==="now"?(fd?"Free delivery promo is live":"Flash sale is live"):(fd?"Free delivery promo scheduled":"Flash sale scheduled"));renderAdmin();
}

/* --- Flavors --- */
const lookOptions = p => `${p.img?`<option value="photo" ${p.art==="photo"?"selected":""}>Look: Your photo</option>`:""}${Object.entries(ART).map(([k,a])=>`<option value="${k}" ${p.art===k?"selected":""}>Look: ${a.label}</option>`).join("")}<option value="none" ${p.art==="none"?"selected":""}>Look: None (no image)</option>`;
const catOptions = sel => `<option value="">No category</option>`+DB.categories.map(c=>`<option value="${c.id}" ${sel===c.id?"selected":""}>${esc(c.name)}</option>`).join("");
function productMatches(p){
  if(A.pcat==="none"&&catName(p.cat))return false;
  if(A.pcat!=="all"&&A.pcat!=="none"&&p.cat!==A.pcat)return false;
  const q=A.pq.trim().toLowerCase();
  return !q||[p.name,p.desc,catName(p.cat)].join(" ").toLowerCase().includes(q);
}
function prow(p){return `<div class="prow" data-prow="${p.id}">
      <div class="pthumb" data-drop="${p.id}">${plateHTML(p)}
        <label class="upl">${p.img?"Replace photo":"Upload photo"}<input type="file" accept="image/*" data-upload="${p.id}" aria-label="Upload photo for ${esc(p.name)}"></label>
        ${p.img?`<button class="linkbtn sm" type="button" data-rmimg="${p.id}">Remove photo</button>`:""}
        <button class="linkbtn sm" type="button" data-pbg="${p.id}">🎨 Background</button>
      </div>
      <div class="pfields">
        <div class="grid3">
          <label class="af">Name<input class="in" data-k="products:${p.id}:name" value="${esc(p.name)}" maxlength="40"></label>
          <label class="af">Category<select class="in" data-k="products:${p.id}:cat">${catOptions(p.cat)}</select></label>
          <label class="af">Extra price per cookie<div class="money-in"><span>+${DB.settings.currency}</span><input class="in" type="number" min="0" step="0.25" data-k="products:${p.id}:surcharge" value="${p.surcharge}"></div></label>
        </div>
        <label class="af">Description<input class="in" data-k="products:${p.id}:desc" value="${esc(p.desc)}" maxlength="90"></label>
        <div class="bdgpick"><span class="lblx">Badges</span>${(DB.badges.list||[]).map(b=>{const on=(p.badges||[]).includes(b.id),auto=b.id==="best"&&bestIds().includes(p.id)&&!on;return `<button type="button" class="bdgtog${on?" on":""}${auto?" auto":""}" data-pbadge="${p.id}:${esc(b.id)}" aria-pressed="${on}" title="${auto?"Added automatically (top seller)":on?"Tap to remove":"Tap to add"}">${badgeHTML(b)}${auto?"<small>auto</small>":""}</button>`}).join("")}<button type="button" class="linkbtn sm" data-gotab="badges">Edit badges</button></div>
        <div class="stockrow">
          <label class="sw"><input type="checkbox" data-k="products:${p.id}:track" ${p.track?"checked":""} aria-label="Track stock for ${esc(p.name)}"><span></span></label><span class="stlabel">Track stock</span>
          ${p.track?`<div class="stepin"><button class="ghost" type="button" data-stk="${p.id}:-1" aria-label="One less">−</button><input class="in" type="number" min="0" step="1" data-k="products:${p.id}:stock" value="${p.stock}" aria-label="Cookies in stock for ${esc(p.name)}"><button class="ghost" type="button" data-stk="${p.id}:1" aria-label="One more">+</button></div><button class="ghost" type="button" data-stk="${p.id}:12">+12</button>${p.stock<=0?`<span class="spill out">Out of stock</span>`:p.stock<=DB.settings.lowStockAt?`<span class="spill low">Low: ${p.stock} left</span>`:`<span class="spill ok">${p.stock} in stock</span>`}`:`<span class="note">Unlimited. Turn on to count cookies.</span>`}
        </div>
        <div class="pfoot">
          <div class="left">
            <div class="seg" role="group" aria-label="Availability">${[["available","Available"],["soldout","Sold out"],["hidden","Hidden"]].map(([k,l])=>`<button type="button" data-pstatus="${p.id}:${k}" aria-pressed="${p.status===k}">${l}</button>`).join("")}</div>
            <select class="in" style="width:auto" data-k="products:${p.id}:art" aria-label="Cookie look">${lookOptions(p)}</select>
            <select class="in" style="width:auto" data-move="${p.id}" aria-label="Move ${esc(p.name)} in the menu"><option value="">Menu position ${DB.products.indexOf(p)+1} of ${DB.products.length}</option><option value="top">Move to top</option><option value="up">Move up one</option><option value="down">Move down one</option><option value="middle">Move to middle</option><option value="bottom">Move to bottom</option></select>
            <button class="ghost" type="button" data-rvadmin="${p.id}">${(()=>{const r=ratingOf(p);return r.n?`Reviews · ★ ${r.avg.toFixed(1)} (${r.n})`:"Reviews · none yet"})()}</button>
          </div>
          <button class="danger" type="button" data-pdel="${p.id}">Delete</button>
        </div>
      </div>
    </div>`}
function productRows(){
  const rows=DB.products.filter(productMatches);
  return rows.length?rows.map(prow).join(""):`<div class="empty">No flavors match${A.pq?` "${esc(A.pq)}"`:""}. <button class="linkbtn" type="button" data-pclear>Clear search and filters</button></div>`;
}
const pCountText = () => {const n=DB.products.filter(productMatches).length;return n===DB.products.length?`${n} flavors`:`Showing ${n} of ${DB.products.length}`};
function viewProducts(){
  const noCat=DB.products.filter(p=>!catName(p.cat)).length;
  const chip=(k,l,n)=>`<button class="fchip" type="button" data-pcat="${k}" aria-pressed="${A.pcat===k}">${l} <i>${n}</i></button>`;
  return head("Flavors","Find a flavor, edit it, or add a new one. Changes show in the shop straight away.")+MOCK+`
  <section class="panel">
    <div class="phead"><div><h2>Menu</h2><p class="sub" id="pCount">${pCountText()}</p></div>
      <div class="chips"><button class="ghost" type="button" data-pcatmanage>Manage categories</button><button class="btn btn-blue btn-sm" type="button" data-padd>+ Add flavor</button></div></div>
    <div class="ptools"><input class="search" id="pSearch" type="search" placeholder="Search flavor or category" value="${esc(A.pq)}" aria-label="Search flavors and categories"></div>
    <div class="chips" style="margin-bottom:6px">${chip("all","All",DB.products.length)}${DB.categories.map(c=>chip(c.id,esc(c.name),DB.products.filter(p=>p.cat===c.id).length)).join("")}${noCat&&DB.categories.length?chip("none","No category",noCat):""}</div>
    <details class="helpd"><summary>How prices, stock and photos work</summary><p>Extra price is charged per cookie on top of the box price; leave it at 0 for regular flavors. Stock counts cookies: each order takes them out and a cancelled order puts them back, and at 0 the flavor shows "Out of stock" by itself. Upload or drag a photo onto any flavor; it's cropped square and resized to 400 px, and a PNG with a transparent background shows as a cut-out. Look: None shows an empty circle.</p></details>
    <div id="plist">${productRows()}</div>
  </section>`;
}

function moveProduct(id,where){
  const arr=DB.products,i=arr.findIndex(p=>p.id===id);if(i<0||!where)return;
  const [p]=arr.splice(i,1);let j=i;
  if(where==="top")j=0;
  else if(where==="bottom")j=arr.length;
  else if(where==="middle")j=Math.floor(arr.length/2);
  else if(where==="up"){let k=i-1;while(k>=0&&!productMatches(arr[k]))k--;j=k>=0?k:i}
  else if(where==="down"){let k=i;while(k<arr.length&&!productMatches(arr[k]))k++;j=k<arr.length?k+1:i}
  arr.splice(j,0,p);saveDB();
  toast({top:"Moved to the top",bottom:"Moved to the bottom",middle:"Moved to the middle",up:"Moved up",down:"Moved down"}[where]);
  renderAdmin();
  const row=document.querySelector(`[data-prow="${id}"]`);if(row){row.scrollIntoView({block:"center",behavior:RM?"auto":"smooth"});row.classList.add("flash-row")}
}

/* --- Reviews (admin) --- */
function rvSummary(p){const r=ratingOf(p);return r.n?`<span class="stars">${starStr(Math.round(r.avg))}</span> ${r.avg.toFixed(1)} · ${r.n} review${r.n>1?"s":""}`:"No reviews yet"}
function renderAdminReviews(){
  const p=prod(A.rvPid);if(!p){closeModal();return}
  const rs=p.reviews.slice().sort((a,b)=>b.at-a.at);
  const starsSel=(id,val)=>`<select class="in" ${id} aria-label="Stars">${[5,4,3,2,1].map(n=>`<option value="${n}" ${n===val?"selected":""}>${starStr(n)} (${n})</option>`).join("")}</select>`;
  $("#modalCard").innerHTML=`<div class="sheet-top"><div><h3 id="modalTitle">Reviews: ${esc(p.name)}</h3><span class="note" id="rvSum">${rvSummary(p)}</span></div><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
  <div class="rvadm">${rs.length?rs.map(r=>`<div class="rvedit" data-rid="${r.id}">
      <div class="grid2"><label class="af">Username<input class="in" data-rv="user" value="${esc(r.user)}" maxlength="30"></label><label class="af">Stars${starsSel('data-rv="stars"',r.stars)}</label></div>
      <label class="af">Review<textarea class="in" rows="2" data-rv="text" maxlength="280">${esc(r.text)}</textarea></label>
      <div class="pfoot"><span class="note">${fmtShort(r.at)} · ${r.example?"Sample":r.src==="customer"?"Posted in the shop":"Added by you"}</span><button class="danger" type="button" data-rvdel="${r.id}">Delete</button></div>
    </div>`).join(""):`<div class="empty">No reviews for this flavor yet.</div>`}</div>
  <div class="rvadd"><h4 style="margin:0">Add a review</h4>
    <div class="grid2"><label class="af">Username<input class="in" id="arUser" maxlength="30" placeholder="e.g. Sari W."></label><label class="af">Stars${starsSel('id="arStars"',5)}</label></div>
    <label class="af">Review<textarea class="in" rows="2" id="arText" maxlength="280" placeholder="What the customer said"></textarea></label>
    <p class="note">Only add reviews your customers actually gave you.</p>
    <p class="err" id="arErr" hidden></p>
    <div class="modal-actions"><button class="btn btn-blue btn-sm" type="button" data-rvadd>Add review</button></div></div>
  <div class="modal-actions"><button class="btn btn-line" type="button" data-mclose>Done</button></div>`;
}
function openAdminReviews(id){A.rvPid=id;openModal("","reviews");renderAdminReviews()}
function addAdminReview(){
  const p=prod(A.rvPid),user=$("#arUser").value.trim(),text=$("#arText").value.trim(),err=$("#arErr"),fail=m=>{err.textContent=m;err.hidden=false};
  if(!user)return fail("Add the username.");
  if(text.length<3)return fail("Add the review text.");
  p.reviews.push({id:uid(),user,text,stars:+$("#arStars").value,at:Date.now(),src:"owner"});
  saveDB();toast("Review added");renderAdminReviews();renderAdmin();
}

/* --- Add flavor popup --- */
function openModal(html,kind){$("#modalCard").innerHTML=html;A.modal=kind;$("#modal").hidden=false;document.body.style.overflow="hidden"}
function closeModal(){const m=$("#modal");if(!m||m.hidden)return;const wasStatus=A.modal==="status";m.hidden=true;A.modal=null;if(wasStatus){SC=null;renderAdmin()}document.body.style.overflow=""}
const npProduct = () => ({id:"np",name:"New flavor",art:A.np.art,img:A.np.img,cutout:A.np.cutout,tints:A.np.tints});
function refreshNp(){
  $("#npPrev").innerHTML=plateHTML(npProduct());
  $("#npArt").innerHTML=lookOptions({img:A.np.img,art:A.np.art});
  $("#npRemove").hidden=!A.np.img;
  $("#npUpl").firstChild.textContent=A.np.img?"Replace photo":"Upload photo";
}
function openAddFlavor(){
  const keys=Object.keys(ART),art=keys[DB.products.length%keys.length];
  A.np={art,defArt:art,img:null,cutout:false,tints:null};
  const defCat=!["all","none"].includes(A.pcat)?A.pcat:"";
  openModal(`<div class="sheet-top"><h3 id="modalTitle">Add flavor</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
  <form class="form" id="npForm" novalidate style="margin-top:14px">
    <div class="np-top" style="margin-top:0">
      <div class="np-prev" id="npPrev"></div>
      <div class="acts"><label class="upl" id="npUpl">Upload photo<input type="file" accept="image/*" id="npFile" aria-label="Upload a photo"></label><button class="linkbtn sm" type="button" id="npRemove" data-npremove hidden>Remove photo</button><span class="note">Optional. Cropped square and resized to 400 px.</span></div>
    </div>
    <div class="field"><label for="npName">Name</label><input id="npName" maxlength="40" autocomplete="off" placeholder="e.g. Salted caramel"></div>
    <div class="field"><label for="npDesc">Description</label><input id="npDesc" maxlength="90" autocomplete="off" placeholder="Dough, mix-ins and topping"></div>
    <div class="row2">
      <div class="field"><label for="npCat">Category</label><select id="npCat">${catOptions(defCat)}<option value="__new">+ New category…</option></select></div>
      <div class="field"><label for="npPrice">Extra price per cookie</label><input id="npPrice" type="number" min="0" step="0.25" value="0"></div>
    </div>
    <div class="field" id="npNewCatWrap" hidden><label for="npNewCat">New category name</label><input id="npNewCat" maxlength="30" autocomplete="off" placeholder="e.g. Seasonal"></div>
    <div class="row2">
      <div class="field"><label for="npArt">Look</label><select id="npArt"></select></div>
      <div class="field"><label for="npStatus">Status</label><select id="npStatus"><option value="available">Available</option><option value="soldout">Sold out</option><option value="hidden">Hidden</option></select></div>
    </div>
    <div class="field"><label for="npPos">Position in menu</label><select id="npPos"><option value="top">Top of the menu</option><option value="middle">Middle of the menu</option><option value="bottom" selected>Bottom of the menu</option></select></div>
    <div class="stockrow"><label class="sw"><input type="checkbox" id="npTrack" checked aria-label="Track stock"><span></span></label><span class="stlabel">Track stock</span>
      <span id="npStockWrap" class="stepin"><input class="in" type="number" min="0" step="1" id="npStock" value="24" aria-label="Cookies in stock"><span class="note">cookies in stock</span></span></div>
    <p class="err" id="npErr" hidden></p>
    <div class="modal-actions"><button class="btn btn-line" type="button" data-mclose>Cancel</button><button class="btn btn-blue" type="submit">Add flavor</button></div>
  </form>`,"add");
  refreshNp();
}
function saveNewFlavor(){
  const err=$("#npErr"),fail=m=>{err.textContent=m;err.hidden=false};
  const name=$("#npName").value.trim();
  if(!name){$("#npName").focus();return fail("Give the flavor a name.")}
  if(DB.products.some(p=>p.name.trim().toLowerCase()===name.toLowerCase()))return fail(`There's already a flavor called "${name}".`);
  let cat=$("#npCat").value,newCat=null;
  if(cat==="__new"){
    const nn=$("#npNewCat").value.trim();if(!nn){$("#npNewCat").focus();return fail("Type a name for the new category.")}
    const ex=DB.categories.find(c=>c.name.toLowerCase()===nn.toLowerCase());
    if(ex)cat=ex.id;else{newCat={id:uid(),name:nn};cat=newCat.id}
  }
  const p={id:uid(),art:$("#npArt").value,name,desc:$("#npDesc").value.trim()||"Describe the dough, mix-ins and topping.",cat,
    surcharge:Math.max(0,parseFloat($("#npPrice").value)||0),status:$("#npStatus").value,track:$("#npTrack").checked,stock:Math.max(0,Math.round(parseFloat($("#npStock").value)||0))};
  if(A.np.img){p.img=A.np.img;p.cutout=A.np.cutout;p.tints=A.np.tints}
  if(newCat)DB.categories.push(newCat);
  const pos=$("#npPos").value;
  if(pos==="top")DB.products.unshift(p);else if(pos==="middle")DB.products.splice(Math.floor(DB.products.length/2),0,p);else DB.products.push(p);
  if(!saveDB()){DB.products.splice(DB.products.indexOf(p),1);if(newCat)DB.categories.pop();return fail("Not enough storage space for that photo. Pick a smaller one or remove another photo.")}
  closeModal();A.pcat="all";A.pq="";toast(`${name} added`);renderAdmin();
  const row=document.querySelector(`[data-prow="${p.id}"]`);if(row){row.scrollIntoView({block:"center",behavior:RM?"auto":"smooth"});row.classList.add("flash-row")}
}

/* --- Categories popup --- */
function renderCats(focusNew){
  const cats=DB.categories;
  $("#modalCard").innerHTML=`<div class="sheet-top"><h3 id="modalTitle">Categories</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
    <p class="note" style="margin-top:6px">Categories group flavors in the shop menu and make them easy to find here. Deleting one keeps its flavors, just without a category.</p>
    <div style="margin-top:12px">${cats.length?cats.map(c=>`<div class="catrow"><input class="in" data-catname="${c.id}" value="${esc(c.name)}" maxlength="30" aria-label="Category name"><span class="note">${DB.products.filter(p=>p.cat===c.id).length} flavors</span><button class="danger" type="button" data-catdel="${c.id}">Delete</button></div>`).join(""):`<div class="empty">No categories yet.</div>`}</div>
    <div class="catrow" style="grid-template-columns:minmax(0,1fr) auto;margin-top:10px"><input class="in" id="newCatName" maxlength="30" placeholder="New category name" aria-label="New category name"><button class="btn btn-blue btn-sm" type="button" data-catadd>Add</button></div>
    <p class="err" id="catErr" hidden></p>
    <div class="modal-actions"><button class="btn btn-blue" type="button" data-mclose>Done</button></div>`;
  if(focusNew)$("#newCatName").focus();
}
function openCats(){openModal("","cats");renderCats(true)}
function addCat(){
  const el=$("#newCatName"),n=el.value.trim(),err=$("#catErr");
  if(!n){err.textContent="Type a category name.";err.hidden=false;return}
  if(DB.categories.some(c=>c.name.toLowerCase()===n.toLowerCase())){err.textContent=`There's already a category called "${n}".`;err.hidden=false;return}
  DB.categories.push({id:uid(),name:n});saveDB();toast(`${n} added`);renderCats(true);renderAdmin();
}

/* --- Flavor background editor (preview first, saved only on "Save") --- */
let BG=null;
function openBg(id){const p=prod(id);if(!p)return;const cur=p.bg||{};
  BG={id,d:Object.assign({type:"auto",c1:"#EEF0FF",c2:"#000096",dir:"diag",img:"",size:84,ring:""},JSON.parse(JSON.stringify(cur)))};
  if(!BG.d.size)BG.d.size=84;
  openModal("","pbg");renderBg();}
function bgPrev(){const p=prod(BG.id),el=$("#bgPrev");if(!p||!el)return;
  el.innerHTML=[["Menu",""],["Small","sm"]].map(([l,c])=>`<div class="bgp ${c}"><div class="bgp-plate">${plateHTML(p,BG.d)}</div><span>${l}</span></div>`).join("")}
function renderBg(){const p=prod(BG.id),d=BG.d,t=d.type;
  const types=[["auto","Automatic"],["color","Colour"],["gradient","Gradient"],["image","Picture"],["none","None"]];
  const col=(id,lbl,v)=>`<label class="af">${lbl}<span class="bgcol"><input type="color" id="${id}" value="${HEX6.test(v||"")?v:"#000096"}"><input class="in" id="${id}Hex" value="${esc(v||"")}" maxlength="7" placeholder="#000096"></span></label>`;
  $("#modalCard").innerHTML=`<div class="sheet-top"><h3 id="modalTitle">Background · ${esc(p.name)}</h3><button class="x" type="button" data-mclose aria-label="Close">✕</button></div>
    <p class="note" style="margin-top:6px">The circle behind this flavor's photo in the shop. Nothing changes for customers until you tap Save.</p>
    <div class="bgprev" id="bgPrev"></div>
    <div class="seg" role="group" aria-label="Background type" style="flex-wrap:wrap;margin-top:12px">${types.map(([k,l])=>`<button type="button" data-bgtype="${k}" aria-pressed="${t===k}">${l}</button>`).join("")}</div>
    <div class="stack" style="gap:12px;margin-top:12px">
      ${t==="auto"?`<p class="note" style="margin:0">Uses the shop's rotating brand colours.</p>`:""}
      ${t==="color"?col("bgC1","Colour",d.c1):""}
      ${t==="gradient"?`<div class="grid2">${col("bgC1","From",d.c1)}${col("bgC2","To",d.c2)}</div>
        <label class="af">Direction<select class="in" id="bgDir">${[["diag","Diagonal ↘"],["down","Top to bottom ↓"],["right","Left to right →"],["radial","From the centre ◎"]].map(([k,l])=>`<option value="${k}" ${d.dir===k?"selected":""}>${l}</option>`).join("")}</select></label>`:""}
      ${t==="image"?`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="upl">${d.img?"Change picture":"Choose picture"}<input type="file" accept="image/*" id="bgFile"></label>${d.img?`<span class="note" style="margin:0">Picture ready</span>`:`<span class="note" style="margin:0">Square pictures work best (pattern, texture, colour splash).</span>`}</div>`:""}
      ${t==="none"?`<p class="note" style="margin:0">No circle. Best with cut-out photos (transparent PNG).</p>`:""}
      <label class="af">Photo size inside the circle: <b id="bgSizeV">${d.size}%</b><input type="range" id="bgSize" min="50" max="100" step="1" value="${d.size}"></label>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label class="sw"><input type="checkbox" id="bgRingOn" ${d.ring?"checked":""}><span></span></label><span class="stlabel">Outline ring</span>${d.ring?`<span class="bgcol"><input type="color" id="bgRing" value="${HEX6.test(d.ring)?d.ring:"#000096"}"></span>`:""}</div>
    </div>
    <p class="err" id="bgErr" hidden></p>
    <div class="modal-actions"><button class="btn btn-ghost-blue" type="button" data-bgreset>Reset to automatic</button><button class="btn btn-ghost-blue" type="button" data-mclose>Cancel</button><button class="btn btn-blue" type="button" data-bgsave>Save</button></div>`;
  bgPrev();
}
function bgSave(){const p=prod(BG.id);if(!p)return;const d=BG.d;
  if(d.type==="image"&&!d.img){const e=$("#bgErr");e.textContent="Choose a picture first, or pick another type.";e.hidden=false;return}
  const out={type:d.type,size:Math.round(+d.size)||84};
  if(d.type==="color")out.c1=d.c1;
  if(d.type==="gradient"){out.c1=d.c1;out.c2=d.c2;out.dir=d.dir}
  if(d.type==="image")out.img=d.img;
  if(d.ring)out.ring=d.ring;
  if(out.type==="auto"&&out.size===84&&!out.ring)delete p.bg;else p.bg=out;
  saveDB();closeModal();renderAdmin();toast("Background saved");
}
$("#modal").addEventListener("click",e=>{if(A.modal!=="pbg"||!BG)return;const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.bgtype){BG.d.type=d.bgtype;renderBg()}
  else if(d.bgsave!==undefined)bgSave();
  else if(d.bgreset!==undefined){BG.d={type:"auto",c1:BG.d.c1,c2:BG.d.c2,dir:"diag",img:BG.d.img,size:84,ring:""};renderBg()}
});
$("#modal").addEventListener("input",e=>{if(A.modal!=="pbg"||!BG)return;const el=e.target,id=el.id,d=BG.d;
  if(id==="bgC1"||id==="bgC2"){d[id==="bgC1"?"c1":"c2"]=el.value;const h=$("#"+id+"Hex");if(h)h.value=el.value}
  else if(id==="bgC1Hex"||id==="bgC2Hex"){const v=el.value.trim();if(HEX6.test(v)){d[id==="bgC1Hex"?"c1":"c2"]=v;const c=$("#"+id.slice(0,4));if(c)c.value=v}}
  else if(id==="bgDir")d.dir=el.value;
  else if(id==="bgSize"){d.size=+el.value;$("#bgSizeV").textContent=el.value+"%"}
  else if(id==="bgRing")d.ring=el.value;
  else return;
  bgPrev();
});
$("#modal").addEventListener("change",async e=>{if(A.modal!=="pbg"||!BG)return;const el=e.target;
  if(el.id==="bgDir"){BG.d.dir=el.value;bgPrev()}
  else if(el.id==="bgRingOn"){BG.d.ring=el.checked?(BG.d.ring||"#000096"):"";renderBg()}
  else if(el.id==="bgFile"&&el.files[0]){try{const r=await processImage(el.files[0]);BG.d.img=r.img;renderBg()}catch(x){const er=$("#bgErr");er.textContent=x.message;er.hidden=false}}
});

/* --- Boxes & extras --- */
function viewBoxes(){
  return head("Boxes & extras","Set box sizes and prices, and the paid extras customers can add at checkout.")+MOCK+`
  <div class="stack">
    <section class="panel">
      <h2>Box sizes</h2><p class="sub">Turn a size off to hide it from the shop without deleting it.</p>
      <div class="tablewrap"><table class="t" style="min-width:460px"><thead><tr><th>Cookies</th><th>Price</th><th>On sale now</th><th>Available</th><th></th></tr></thead><tbody>
      ${DB.sizes.slice().sort((a,b)=>a.n-b.n).map(s=>{const sale=bestSale(s.n);return `<tr>
        <td><b>Box of ${s.n}</b></td>
        <td style="width:150px"><div class="money-in"><span>${DB.settings.currency}</span><input class="in" type="number" min="0" step="0.5" data-k="sizes:${s.n}:price" value="${s.price}" aria-label="Price for box of ${s.n}"></div></td>
        <td>${sale?`<span class="spill live">${money(s.price-saleDiscount(sale,s.price))}</span>`:`<span class="note">No</span>`}</td>
        <td><label class="sw"><input type="checkbox" data-k="sizes:${s.n}:active" ${s.active?"checked":""} aria-label="Box of ${s.n} available"><span></span></label></td>
        <td class="r"><button class="danger" type="button" data-sdel="${s.n}">Delete</button></td></tr>`}).join("")}
      </tbody></table></div>
      <div class="grid3" style="margin-top:14px;align-items:end">
        <label class="af">New size (cookies)<input class="in" type="number" min="1" max="24" id="newN" placeholder="e.g. 9"></label>
        <label class="af">Price<div class="money-in"><span>${DB.settings.currency}</span><input class="in" type="number" min="0" step="0.5" id="newP" placeholder="30"></div></label>
        <button class="ghost" type="button" data-sadd style="height:40px">+ Add size</button>
      </div>
      <p class="err" id="sizeErr" hidden style="margin-top:8px"></p>
    </section>
    <section class="panel">
      <div class="phead"><div><h2>Custom box</h2><p class="sub">Lets customers build a bigger box than your fixed sizes. They can only pick the minimum or a step above it (for example 14, 16, 18).</p></div>
        <label class="sw"><input type="checkbox" data-k="settings::customOn" ${DB.settings.customOn?"checked":""} aria-label="Custom box on"><span></span></label></div>
      <div class="grid3" style="align-items:end">
        <label class="af">Minimum cookies<input class="in" type="number" min="1" step="1" data-k="settings::customMin" value="${DB.settings.customMin}"></label>
        <label class="af">Step (add by)<input class="in" type="number" min="1" step="1" data-k="settings::customStep" value="${DB.settings.customStep}"></label>
        <label class="af">Maximum cookies<input class="in" type="number" min="1" step="1" data-k="settings::customMax" value="${DB.settings.customMax}"></label>
      </div>
      <div class="grid3" style="margin-top:12px;align-items:end"><label class="af">Price per cookie<div class="money-in"><span>${DB.settings.currency}</span><input class="in" type="number" min="0" step="0.05" data-k="settings::customPer" value="${DB.settings.customPer}"></div></label>
        <p class="note" style="grid-column:span 2;margin:0">Example: a box of ${DB.settings.customMin} costs ${money(r2(DB.settings.customMin*DB.settings.customPer))}. Flash sales set to "Every box" apply to it; per-cookie flavor extras are added on top.</p></div>
    </section>
    <section class="panel">
      <div class="phead"><div><h2>Paid extras</h2><p class="sub">Shown in step 2 of the box builder. Each one adds its price to the order.</p></div><button class="btn btn-blue btn-sm" type="button" data-aadd>+ Add extra</button></div>
      ${DB.addons.length?`<div class="tablewrap"><table class="t" style="min-width:620px"><thead><tr><th>Name</th><th>Description</th><th>Price</th><th>Active</th><th></th></tr></thead><tbody>
      ${DB.addons.map(a=>`<tr>
        <td><input class="in" data-k="addons:${a.id}:name" value="${esc(a.name)}" aria-label="Extra name"></td>
        <td><input class="in" data-k="addons:${a.id}:desc" value="${esc(a.desc)}" aria-label="Extra description"></td>
        <td style="width:130px"><div class="money-in"><span>+${DB.settings.currency}</span><input class="in" type="number" min="0" step="0.5" data-k="addons:${a.id}:price" value="${a.price}" aria-label="Extra price"></div></td>
        <td><label class="sw"><input type="checkbox" data-k="addons:${a.id}:active" ${a.active?"checked":""} aria-label="${esc(a.name)} active"><span></span></label></td>
        <td class="r"><button class="danger" type="button" data-adel="${a.id}">Delete</button></td></tr>`).join("")}
      </tbody></table></div>`:`<div class="empty">No extras yet.</div>`}
    </section>
  </div>`;
}

/* --- Settings --- */
const SND_OPTS=[["register","Ka-ching"],["chime","Chime"],["bell","Bell"],["door","Doorbell"],["pop","Cookie pop"],["alarm","Alarm"]];
function viewSettings(){
  const s=DB.settings,th=DB.thanks,pp=DB.proofpop,al=DB.alerts;
  return head("Shop settings","Delivery, order cutoff, opening days and the details shown on the shop page.")+MOCK+`
  <div class="stack">
    <section class="panel">
      <h2>Ordering</h2><p class="sub">Customers can order up to 7 days ahead.</p>
      <div class="grid3">
        <label class="af">Currency symbol<input class="in" data-k="settings::currency" value="${esc(s.currency)}" maxlength="4"></label>
        <label class="af">Delivery fee<div class="money-in"><span>${esc(s.currency)}</span><input class="in" type="number" min="0" step="0.5" data-k="settings::deliveryFee" value="${s.deliveryFee}"></div></label>
        <label class="af">Delivery radius<div class="money-in"><input class="in" type="number" min="1" data-k="settings::deliveryKm" value="${s.deliveryKm}"><span style="padding-right:10px">km</span></div></label>
      </div>
      <h3 style="margin:18px 0 4px;font-size:15px">Ways to get an order</h3><p class="sub" style="margin:0 0 8px">Switch each one on or off. Lead time = how long before the pickup or delivery a customer must order.</p>
      <div class="stack" style="gap:10px">${[
        ["sameday","Sameday shipment","samedayOn","samedayLeadH","hours it takes to ship after payment is confirmed","hours"],
        ["pickup","Pickup","pickupOn","pickupLeadH","order at least this far ahead (24 = next day)","hours"],
        ["scheduled","Scheduled delivery","schedOn","schedLeadH","order at least this far ahead (24 = next day)","hours"]].map(([k,n,on,lead,hint,u])=>`<div class="pmcard" style="gap:8px">
        <label class="chk"><input type="checkbox" data-k="settings::${on}" ${s[on]!==false&&(on!=="samedayOn"||s[on])?"checked":""}> <b>${n}</b></label>
        <div class="grid3"><label class="af">Lead time<div class="money-in"><input class="in" type="number" min="0" step="1" data-k="settings::${lead}" value="${s[lead]}"><span style="padding-right:10px">${u}</span></div><small class="note">${hint}</small></label>
        ${k==="sameday"?`<label class="af">Order by (today)<select class="in" data-k="settings::samedayCutoff">${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===s.samedayCutoff?"selected":""}>${fmtHour(h)}</option>`).join("")}</select></label>
        <label class="af">Sameday fee<div class="money-in"><span>${esc(s.currency)}</span><input class="in" type="number" min="0" step="0.5" data-k="settings::samedayFee" value="${s.samedayFee}"></div></label>`:""}</div></div>`).join("")}</div>
      <div class="grid2" style="margin-top:12px">
        <label class="af">Order cutoff for next day<select class="in" data-k="settings::cutoffHour">${Array.from({length:24},(_,h)=>`<option value="${h}" ${h===s.cutoffHour?"selected":""}>${fmtHour(h)}</option>`).join("")}</select></label>
        <div class="af">Closed days<div class="chips">${DOW.map((d,i)=>`<button class="fchip" type="button" data-closed="${i}" aria-pressed="${s.closedWeekdays.includes(i)}">${d}</button>`).join("")}</div></div>
      </div>
      <div class="grid2" style="margin-top:12px"><label class="af">Shop time zone<select class="in" data-k="settings::tz">${(TZS.includes(s.tz||"Asia/Jakarta")?TZS:[s.tz,...TZS]).map(z=>`<option value="${esc(z)}" ${z===(s.tz||"Asia/Jakarta")?"selected":""}>${esc(z.replace(/_/g," "))}</option>`).join("")}</select><small class="note">Used for the order cutoff and the days customers can pick.</small></label></div>
      <div class="grid2" style="margin-top:12px"><label class="af">Low stock warning at<div class="money-in"><input class="in" type="number" min="0" step="1" data-k="settings::lowStockAt" value="${s.lowStockAt}"><span style="padding-right:10px">cookies</span></div></label></div>
      <label class="af" style="margin-top:12px">Pickup and delivery time slots (one per line)<textarea class="in" rows="4" data-lines="times">${esc(s.times.join("\n"))}</textarea></label>
    </section>
    <section class="panel">
      <div class="phead"><div><h2>Owner alerts</h2><p class="sub">A popup and a sound while the Admin page is open: when a new order is placed, when a customer sends a payment proof, and when a customer files a complaint. Browsers only play sound after you have clicked on the page once.</p></div><button class="btn btn-blue btn-sm" type="button" data-altest>Test alert</button></div>
      <div class="stack" style="gap:6px">
        <label class="chk"><input type="checkbox" data-alc="on" ${al.on?"checked":""}> Alerts on</label>
        <label class="chk"><input type="checkbox" data-alc="sound" ${al.sound?"checked":""}> Play a sound</label>
        <label class="chk"><input type="checkbox" data-alc="stay" ${al.stay?"checked":""}> Keep popups until I dismiss them (otherwise they close after 10 seconds)</label>
        <label class="chk"><input type="checkbox" data-alc="repeat" ${al.repeat?"checked":""}> Repeat the sound every 20 seconds until I dismiss</label>
        <label class="af" style="margin-top:6px">Volume<input class="in" type="range" min="10" max="100" step="5" data-alr value="${al.vol}"></label>
        <div style="margin-top:8px">${[["order","New order placed"],["proof","Payment proof submitted"],["complaint","Customer complaint"]].map(([k,l])=>`<div class="alrow"><span class="sw"><input type="checkbox" data-alc="ev.${k}.on" ${al.ev[k].on?"checked":""} aria-label="Alert for ${l}"><span></span></span><b style="font-size:14px">${l}</b><select class="in" data-alsel="ev.${k}.snd" aria-label="Sound for ${l}" style="min-width:140px">${SND_OPTS.map(([v,n])=>`<option value="${v}" ${al.ev[k].snd===v?"selected":""}>${n}</option>`).join("")}${al.custom?`<option value="custom" ${al.ev[k].snd==="custom"?"selected":""}>Your sound</option>`:""}</select><button class="ghost" type="button" data-alplay="${k}">▶ Play</button></div>`).join("")}</div>
        <div class="af" style="margin-top:10px">Your own sound (MP3, WAV or OGG, under 400 KB)<div class="colin" style="flex-wrap:wrap"><label class="ghost mqbtn">${al.custom?"Replace sound":"Upload sound"}<input type="file" accept="audio/*" hidden data-alsnd></label>${al.custom?`<span class="note" style="margin:0">${esc(al.customName||"Your sound")}</span><button class="danger" type="button" data-alsndrm>Remove</button>`:""}</div></div>
      </div>
    </section>
    <section class="panel">
      <h2>Customer messages</h2><p class="sub">When you change an order's status you confirm it and choose how to notify the customer. WhatsApp links need the country code for numbers that start with 0.</p>
      <div class="grid2"><label class="af">Country code for WhatsApp<div class="money-in"><span>+</span><input class="in" data-k="settings::waCountry" value="${esc(s.waCountry)}" maxlength="4" inputmode="numeric"></div></label></div>
    </section>
    <section class="panel">
      <h2>Complaints</h2><p class="sub">How long after "Delivered / Picked up" a customer can report a problem. They also see a countdown in My orders.</p>
      <div class="grid2"><label class="af">Complaint window<div class="money-in"><input class="in" type="number" min="1" step="1" data-k="settings::complaintWindowH" value="${s.complaintWindowH}"><span style="padding-right:10px">hours</span></div></label></div>
    </section>
    <section class="panel">
      <h2>Payment</h2><p class="sub">Shown to customers when they pay. Orders that aren't paid in time are cancelled automatically and their cookies go back into stock.</p>
      <div class="grid2" style="align-items:start"><label class="af">Payment window<div class="money-in"><input class="in" type="number" min="1" step="1" data-k="settings::payWindowH" value="${s.payWindowH}"><span style="padding-right:10px">hours</span></div><small class="note">The most time a customer gets to pay. It shrinks automatically when the order is due sooner (pickup or delivery time minus lead time).</small></label></div>
      <div class="grid2" style="margin-top:12px;align-items:start"><label class="af">Sameday payment time<div class="money-in"><input class="in" type="number" min="1" step="5" data-k="settings::samedayPayMin" value="${s.samedayPayMin}"><span style="padding-right:10px">minutes</span></div><small class="note">Sameday shipment orders must be paid within this time.</small></label>
        <label class="af">Shortest time to pay<div class="money-in"><input class="in" type="number" min="1" step="5" data-k="settings::minPayMin" value="${s.minPayMin}"><span style="padding-right:10px">minutes</span></div><small class="note">Time slots that leave less than this (after the lead time) are greyed out.</small></label></div>
      <div class="grid2" style="margin-top:12px;align-items:start"><label class="af">Time to send a new proof after a rejection<div class="money-in"><input class="in" type="number" min="5" step="5" data-k="settings::rejPayMin" value="${s.rejPayMin}"><span style="padding-right:10px">minutes</span></div><small class="note">When you reject a payment proof, the countdown starts again: the normal time to pay, and never less than this.</small></label></div>
      <h3 style="margin:18px 0 4px;font-size:15px">Payment countdown look</h3><p class="sub" style="margin:0 0 8px">The "time left to pay" timer that customers see on their order, on the order placed page and in the notification bell.</p>
      <div class="grid3" style="align-items:end"><label class="af">Timer color<input type="color" data-k="settings::payCdColor" value="${esc(s.payCdColor||"#C8102E")}" style="width:100%;height:42px"></label>
        <label class="af">Timer size<select class="in" data-k="settings::payCdSize">${[["M","Medium"],["L","Large"],["XL","Extra large"]].map(([v,l])=>`<option value="${v}" ${s.payCdSize===v?"selected":""}>${l}</option>`).join("")}</select></label>
        <label class="chk" style="padding-bottom:12px"><input type="checkbox" data-k="settings::payCdFx" ${s.payCdFx!==false?"checked":""}> Lively (pulsing)</label></div>
      <h3 style="margin:18px 0 4px;font-size:16px">Payment methods</h3><p class="sub" style="margin-top:0">Add as many as you need (bank, e-wallet, QRIS). Customers see the ones that are switched on. If you add a picture such as a QR code, customers can tap it to save it.</p>
      <div class="stack" style="gap:12px">${DB.payMethods.map(m=>`<div class="pmcard">
        <div class="pmtop"><span class="sw" title="Show to customers"><input type="checkbox" data-pmon="${m.id}" ${m.on?"checked":""} aria-label="Show ${esc(m.name||"method")} to customers"><span></span></span><input class="in" data-pm="${m.id}|name" maxlength="40" value="${esc(m.name)}" placeholder="Method name, e.g. Bank transfer" aria-label="Method name"><button class="danger" type="button" data-pmdel="${m.id}">Delete</button></div>
        <textarea class="in" rows="3" data-pm="${m.id}|details" maxlength="400" placeholder="Account number, name, instructions" aria-label="Payment details">${esc(m.details)}</textarea>
        <div class="colin" style="flex-wrap:wrap"><label class="ghost mqbtn">${m.img?"Replace image":"Add image (QR code, logo)"}<input type="file" accept="image/*" hidden data-pmimg="${m.id}"></label>${m.img?`<img class="lpthumb" style="max-height:56px;max-width:90px" src="${esc(m.img)}" alt="Image for ${esc(m.name)}"><button class="danger" type="button" data-pmimgrm="${m.id}">Remove image</button>`:""}</div></div>`).join("")}
      <div><button class="btn btn-blue btn-sm" type="button" data-pmadd>+ Add payment method</button></div></div>
    </section>
    <section class="panel">
      <h2>Shop details</h2><p class="sub">Shown in the "Come say hello" section.</p>
      <label class="af">Address<input class="in" data-k="settings::address" value="${esc(s.address)}"></label>
      <label class="af" style="margin-top:12px">Opening hours (one per line, as Day | Hours)<textarea class="in" rows="4" data-lines="hours">${esc(s.hours.map(h=>h.join(" | ")).join("\n"))}</textarea></label>
    </section>
    <section class="panel">
      <div class="phead"><div><h2>Order placed page</h2><p class="sub">The celebration customers see after placing an order. You can use {name}, {size}, {mode}, {when}, {hours}, {code} and {total} in the sentences.</p></div><button class="btn btn-blue btn-sm" type="button" data-thpreview>Preview</button></div>
      <div class="stack" style="gap:14px">
        <div class="af">Logo (shown instead of the check mark)<div class="colin" style="flex-wrap:wrap"><label class="ghost mqbtn">${th.logo?"Replace logo":"Upload Delidome logo"}<input type="file" accept="image/*" hidden data-thlogo></label>${th.logo?`<img class="lpthumb" style="max-height:44px;max-width:140px" src="${esc(th.logo)}" alt="Logo"><button class="danger" type="button" data-thlogorm>Remove</button>`:""}</div></div>
        <div class="af">Falling cookie pictures (up to 8, a built-in cookie is used if you add none)<div class="thck">${th.cookies.map((c,i)=>`<span class="th"><img src="${esc(c)}" alt="Cookie ${i+1}"><button type="button" data-thckrm="${i}" aria-label="Remove cookie picture ${i+1}">×</button></span>`).join("")}${th.cookies.length<8?`<label class="ghost mqbtn">Add cookie pictures<input type="file" accept="image/*" multiple hidden data-thck></label>`:""}</div><p class="note" style="margin:0">PNG with a transparent background looks best.</p></div>
        <div class="grid2"><label class="af" style="flex-direction:row;display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink)"><span class="sw"><input type="checkbox" data-thc="fx" ${th.fx?"checked":""}><span></span></span> Falling cookies effect</label>
        <label class="af">How many cookies fall<input class="in" type="range" min="6" max="60" step="2" data-thr="amount" value="${th.amount}"></label></div>
        <div class="grid2"><label class="af">Heading (new order)<input class="in" data-th="title" maxlength="40" value="${esc(th.title)}"></label><label class="af">Heading (order changed)<input class="in" data-th="titleUpd" maxlength="40" value="${esc(th.titleUpd)}"></label></div>
        <label class="af">Message<textarea class="in" rows="2" data-th="text" maxlength="240">${esc(th.text)}</textarea></label>
        <label class="af">Pay reminder line<textarea class="in" rows="2" data-th="urgent" maxlength="200">${esc(th.urgent)}</textarea></label>
        <div class="grid3"><label class="af">Countdown label<input class="in" data-th="cdLabel" maxlength="30" value="${esc(th.cdLabel)}"></label><label class="af">Pay button<input class="in" data-th="payBtn" maxlength="44" value="${esc(th.payBtn)}"></label><label class="af">Track button<input class="in" data-th="trackBtn" maxlength="30" value="${esc(th.trackBtn)}"></label></div>
        <label class="af">"Build another box" button<input class="in" data-th="buildBtn" maxlength="30" value="${esc(th.buildBtn)}"></label>
        <div class="grid3"><label class="af">Background<input type="color" data-thcol="bg" value="${th.bg}" style="width:100%;height:42px"></label><label class="af">Accent (heading, button)<input type="color" data-thcol="accent" value="${th.accent}" style="width:100%;height:42px"></label><label class="af">Countdown color<input type="color" data-thcol="cdColor" value="${th.cdColor}" style="width:100%;height:42px"></label></div>
        <div><button class="danger" type="button" data-threset>Reset this page</button></div>
      </div>
    </section>
    <section class="panel">
      <div class="phead"><div><h2>Payment proof sent popup</h2><p class="sub">The thank-you popup customers get after they press "I've paid, send proof". You can use {name}, {code}, {total}, {size}, {mode}, {when} and {hours} in the sentences.</p></div><button class="btn btn-blue btn-sm" type="button" data-pppreview>Preview</button></div>
      <div class="stack" style="gap:14px">
        <label class="af" style="flex-direction:row;display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink)"><span class="sw"><input type="checkbox" data-ppc="on" ${pp.on?"checked":""}><span></span></span> Show this popup</label>
        <div class="grid2"><label class="af">Top emoji (leave empty for none)<input class="in" data-pp="emoji" maxlength="4" value="${esc(pp.emoji)}"></label>
        <div class="af">Picture (your logo or any image)<div class="colin" style="flex-wrap:wrap"><label class="ghost mqbtn">${pp.img?"Replace picture":"Upload picture"}<input type="file" accept="image/*" hidden data-ppimg></label>${pp.img?`<img class="lpthumb" style="max-height:44px;max-width:120px" src="${esc(pp.img)}" alt="Popup picture"><button class="danger" type="button" data-ppimgrm>Remove</button>`:""}</div></div></div>
        <div class="af">Falling cookie pictures for this popup (up to 8; if empty it uses the Order placed page cookies)<div class="thck">${pp.cookies.map((c,i)=>`<span class="th"><img src="${esc(c)}" alt="Cookie ${i+1}"><button type="button" data-ppckrm="${i}" aria-label="Remove cookie picture ${i+1}">×</button></span>`).join("")}${pp.cookies.length<8?`<label class="ghost mqbtn">Add cookie pictures<input type="file" accept="image/*" multiple hidden data-ppck></label>`:""}</div></div>
        <div class="grid2"><label class="af" style="flex-direction:row;display:flex;align-items:center;gap:10px;font-size:14px;color:var(--ink)"><span class="sw"><input type="checkbox" data-ppc="fx" ${pp.fx?"checked":""}><span></span></span> Falling cookies effect</label>
        <label class="af">How many cookies fall<input class="in" type="range" min="6" max="60" step="2" data-ppr="amount" value="${pp.amount}"></label></div>
        <label class="af">Heading<input class="in" data-pp="title" maxlength="60" value="${esc(pp.title)}"></label>
        <label class="af">Message<textarea class="in" rows="3" data-pp="text" maxlength="300">${esc(pp.text)}</textarea></label>
        <label class="af">Button<input class="in" data-pp="btn" maxlength="30" value="${esc(pp.btn)}"></label>
        <div class="grid3"><label class="af">Background<input type="color" data-ppcol="bg" value="${pp.bg}" style="width:100%;height:42px"></label><label class="af">Accent (heading, button)<input type="color" data-ppcol="accent" value="${pp.accent}" style="width:100%;height:42px"></label><label class="af">Text color<input type="color" data-ppcol="ink" value="${pp.ink}" style="width:100%;height:42px"></label></div>
        <div><button class="danger" type="button" data-ppreset>Reset this popup</button></div>
      </div>
    </section>
    ${SBH.on?"":`<section class="panel">
      <h2>Demo data</h2><p class="sub">Put back the example flavors, sales and orders. This clears anything you changed.</p>
      <button class="danger" type="button" data-reset>Reset demo data</button>
    </section>`}
  </div>`;
}

/* --- admin wiring --- */
function setK(el){
  const [coll,id,field]=el.dataset.k.split(":");
  let v=el.type==="checkbox"?el.checked:el.type==="number"?Math.max(0,parseFloat(el.value)||0):el.value;
  if(field==="cutoffHour"||field==="samedayCutoff")v=+v;
  if(/^(sameday|pickup|sched)LeadH$/.test(field))v=Math.min(720,Math.round(v));
  if(field==="payWindowH"||field==="complaintWindowH"||field==="samedayPayMin"||field==="minPayMin"||field==="rejPayMin")v=Math.max(1,v);
  if(field==="stock"||field==="lowStockAt"||field==="samedayPayMin"||field==="minPayMin"||field==="rejPayMin"||field==="payWindowH"||field==="complaintWindowH"||/^custom(Min|Step|Max)$/.test(field))v=Math.round(v);
  if(coll==="settings"){DB.settings[field]=v;const t=DB.settings;if(/^custom/.test(field)){t.customMin=Math.max(1,t.customMin);t.customStep=Math.max(1,t.customStep);if(t.customMax<t.customMin)t.customMax=t.customMin}}
  else{const item=coll==="sizes"?DB.sizes.find(x=>String(x.n)===id):DB[coll].find(x=>x.id===id);if(item)item[field]=v}
  return {coll,field};
}
const am=$("#amain");
am.addEventListener("input",e=>{const el=e.target;if(!el.dataset.cpf||!A.cp)return;cpSetF(el)});
am.addEventListener("change",e=>{const el=e.target;if(!el.dataset.cpf||!A.cp)return;cpSetF(el);if(el.dataset.cprr)renderAdmin()});
function cpSetF(el){const k=el.dataset.cpf;A.cp[k]=el.type==="checkbox"?el.checked:el.type==="number"?(+el.value||0):el.value}
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.cpnew!==undefined){A.cp=CP_BLANK();renderAdmin();scrollTo(0,0)}
  else if(d.cpedit){const c=DB.coupons.find(x=>x.id===d.cpedit);if(c){A.cp=anClone(c);renderAdmin();scrollTo(0,0)}}
  else if(d.cpcancel!==undefined){A.cp=null;renderAdmin()}
  else if(d.cptog){const c=DB.coupons.find(x=>x.id===d.cptog);if(c){c.on=!c.on;saveDB();toast(c.on?"Coupon is on":"Coupon is off");renderAdmin()}}
  else if(d.cpdel){armed(b,()=>{DB.coupons=DB.coupons.filter(x=>x.id!==d.cpdel);saveDB();toast("Coupon deleted");renderAdmin()})}
  else if(d.cpsave!==undefined){const F=A.cp,er=$("#cpErr"),fail=t=>{er.textContent=t;er.hidden=false};
    F.code=cpNorm(F.code);if(!/^[A-Z0-9_-]{3,20}$/.test(F.code))return fail("Use 3 to 20 letters or numbers for the code.");
    if(DB.coupons.some(c=>c.code===F.code&&c.id!==F.id))return fail("You already have a coupon with that code.");
    if(F.type==="percent"&&!(F.value>0&&F.value<=100))return fail("Percent must be between 1 and 100.");
    if(F.type==="amount"&&!(F.value>0))return fail("Set an amount above 0.");
    if(F.startsAt&&F.endsAt&&new Date(F.endsAt)<=new Date(F.startsAt))return fail("The end must be after the start.");
    const c={...F,id:F.id||"cp"+uid(),maxUses:Math.max(0,Math.round(F.maxUses||0)),minSpend:Math.max(0,F.minSpend||0),value:F.type==="freedelivery"?0:F.value};
    const i=DB.coupons.findIndex(x=>x.id===c.id);if(i>=0)DB.coupons[i]=c;else DB.coupons.unshift(c);
    saveDB();A.cp=null;toast("Coupon saved");renderAdmin()}
});

am.addEventListener("input",e=>{const el=e.target;if(!el.dataset.hr)return;hrSet(el)});
function hrSet(el){const h=hrDraft(),k=el.dataset.hr;h[k]=el.type==="checkbox"?el.checked:el.dataset.hrnum?+el.value:el.value;
  if(k==="src"&&!el.value)h.src="";hrDraw();if(el.dataset.hrrr)renderAdmin();else if(el.dataset.hrnum){const l=el.closest("label");if(l&&l.firstChild)l.firstChild.textContent=`Darken the picture: ${h.overlay}%`}}
am.addEventListener("change",async e=>{const el=e.target;
  if(el.dataset.hr){hrSet(el);return}
  if(el.dataset.hrck!==undefined){const f=el.files[0];if(!f)return;try{hrDraft().cookies[+el.dataset.hrck]=await lpResize(f,360);renderAdmin();toast("Added to the preview. Press Save to publish.")}catch(err){toast(err.message)}return}
  if(el.dataset.hrmedia!==undefined){const f=el.files[0];if(!f)return;const h=hrDraft();
    try{if(h.mediaType==="video"){if(f.size>3*1024*1024){toast("That video is over 3 MB. Paste a link to an .mp4 instead.");el.value="";return}h.src=await readData(f)}else h.src=await lpResize(f,1600);renderAdmin();toast("Added to the preview. Press Save to publish.")}catch(err){toast(err.message)}}});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.gotab){A.tab=d.gotab;renderAdmin();scrollTo(0,0)}
  else if(d.hrckrm!==undefined){hrDraft().cookies[+d.hrckrm]="";renderAdmin()}
  else if(d.hrmediarm!==undefined){hrDraft().src="";renderAdmin()}
  else if(d.hrsave!==undefined){const prev=DB.page.hero;DB.page.hero=anClone(A.hr);if(saveDB()){if(SBH.publish)SBH.publish(["page"]);toast("Top banner published to the shop");A.hr=null;renderAdmin()}else{DB.page.hero=prev;toast("Not enough storage space. Try smaller pictures.")}}
  else if(d.hrdisc!==undefined){A.hr=null;renderAdmin();toast("Changes discarded")}
  else if(d.hrreset!==undefined){armed(b,()=>{A.hr=anClone(defaultPage().hero);renderAdmin();toast("Reset in the preview. Press Save to publish.")})}
});

am.addEventListener("input",e=>{const el=e.target;if(!el.dataset.an)return;anSet(el)});
am.addEventListener("change",async e=>{const el=e.target;
  if(el.dataset.an){anSet(el);return}
  if(el.dataset.ansep!==undefined){const f=el.files[0];if(!f)return;try{anDraft().mq.sepImg=await lpResize(f,160);renderAdmin();toast("Picture added to the preview. Press Save to publish.")}catch(err){toast(err.message)}return}
  if(el.dataset.anfont!==undefined){const f=el.files[0];if(!f)return;
    if(f.size>1024*1024){toast("That font is over 1 MB. Use a smaller file or a .woff2 version.");el.value="";return}
    if(!/\.(ttf|otf|woff2?)$/i.test(f.name)){toast("Use a .ttf, .otf, .woff or .woff2 file.");el.value="";return}
    try{const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Couldn't read that file."));r.readAsDataURL(f)});
      const test=new FontFace("DD Test",`url(${data})`);await test.load();
      Object.assign(anDraft().mq,{fontData:data,fontName:f.name.replace(/\.[^.]+$/,"").slice(0,40),font:"custom"});renderAdmin();toast("Font added to the preview. Press Save to publish.")
    }catch(err){toast("That file isn't a usable font.")}return}
  if(el.dataset.animg!==undefined){const f=el.files[0];if(!f)return;try{anDraft()[A.anK].img=await lpResize(f,200);renderAdmin();toast("Image added to the preview. Press Save to publish.")}catch(err){toast(err.message)}}});
function anSet(el){const AN=anDraft(),path=el.dataset.an.split(".");let o=AN;for(let i=0;i<path.length-1;i++)o=o[path[i]];
  const k=path[path.length-1];o[k]=el.type==="checkbox"?el.checked:el.value;
  if(el.type==="checkbox"&&(k==="on"||k==="custom")){}
  anDrawPrev();if(el.type==="checkbox"||el.tagName==="SELECT")anPrevOnly()}
function anPrevOnly(){const n=document.querySelector("#amain .note[hidden], #amain .note:not([hidden])");}
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.ank){A.anK=d.ank;renderAdmin()}
  else if(d.anrm!==undefined){anDraft()[A.anK].img="";renderAdmin()}
  else if(d.ansepro!==undefined){anDraft().mq.sepImg="";renderAdmin()}
  else if(d.anfontrm!==undefined){const m=anDraft().mq;m.fontData="";m.fontName="";if(m.font==="custom")m.font="display";renderAdmin()}
  else if(d.ansave!==undefined){const prev=DB.announcer;DB.announcer=anClone(A.an);if(saveDB()){toast("Announcer published to the shop");A.an=null;renderAdmin()}else{DB.announcer=prev;toast("Not enough storage space. Try a smaller image.")}}
  else if(d.andisc!==undefined){A.an=null;renderAdmin();toast("Changes discarded")}
  else if(d.anreset!==undefined){armed(b,()=>{A.an=defaultAnnouncer();renderAdmin();toast("Reset in the preview. Press Save to publish.")})}
});

am.addEventListener("input",e=>{const el=e.target;if(el.dataset.nf){A.nf[el.dataset.nf]=el.dataset.nf==="code"?el.value.toUpperCase().replace(/\s+/g,""):el.value;if(el.dataset.nf==="code")el.value=A.nf.code;const er=$("#nfErr");if(er)er.hidden=true}});
am.addEventListener("change",e=>{const el=e.target;if(el.dataset.nf==="pid"||el.dataset.nf==="until")A.nf[el.dataset.nf]=el.value});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.nftype){A.nf.type=d.nftype;renderAdmin()}
  else if(d.nfsend!==undefined){const f=A.nf,er=$("#nfErr");
    if(f.title.trim().length<3){er.textContent="Please write a title (at least 3 characters).";er.hidden=false;return}
    DB.broadcasts.unshift({id:uid(),type:f.type,title:f.title.trim(),text:f.text.trim(),pid:f.pid,code:f.code.trim(),until:f.until,at:Date.now()});
    if(DB.broadcasts.length>100)DB.broadcasts.length=100;
    if(!saveDB()){DB.broadcasts.shift();er.textContent="Not enough storage space.";er.hidden=false;return}
    A.nf={type:f.type,title:"",text:"",pid:"",code:"",until:""};toast("Sent to all customers");renderAdmin()}
  else if(d.nfdel){armed(b,()=>{DB.broadcasts=DB.broadcasts.filter(x=>x.id!==d.nfdel);saveDB();toast("Notification deleted");renderAdmin()})}
});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
  if(b.dataset.bakeprint!==undefined)printBake(A.bakeDay);else if(b.dataset.bakedl!==undefined)downloadBake(A.bakeDay)});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.dt){A.dt=d.dt;renderAdmin();window.scrollTo(0,0)}
  else if(d.srk){A.sr=d.srk;renderAdmin()}
  else if(d.dd){A.dd=d.dd;renderAdmin()}
  else if(d.vr){A.vr=d.vr;renderAdmin()}
  else if(d.dashgo){A.tab=d.dashgo;if(d.dfilter)A.filter=d.dfilter;renderAdmin();window.scrollTo(0,0)}
  else if(d.dashsound!==undefined){DB.alerts.sound=!DB.alerts.sound;saveDB();renderAdmin()}
  else if(d.dproof)showProof(d.dproof);
  else if(d.dconfirm)setOrderStatus(d.dconfirm,"new");
});
am.addEventListener("change",e=>{const el=e.target;if(el.dataset.dddate!==undefined){A.dd=el.value||"today";renderAdmin()}
  else if(el.dataset.srf!==undefined){A.sf=el.value;renderAdmin()}else if(el.dataset.srt!==undefined){A.st=el.value;renderAdmin()}});
function alPath(path,val){const p=path.split("."),k=p.pop();let o=DB.alerts;p.forEach(x=>o=o[x]);o[k]=val}
am.addEventListener("input",e=>{const el=e.target;if(el.dataset.alr!==undefined){DB.alerts.vol=+el.value;saveSoon()}});
am.addEventListener("change",async e=>{const el=e.target;
  if(el.dataset.alc){alPath(el.dataset.alc,el.checked);if(el.checked)alAckAll();saveDB();toast("Saved");return}
  if(el.dataset.alsel){alPath(el.dataset.alsel,el.value);saveDB();alPlay(el.value);toast("Saved");return}
  if(el.dataset.alsnd!==undefined){const f=el.files[0];if(!f)return;
    if(!/^audio\//.test(f.type)){toast("That isn't an audio file.");renderAdmin();return}
    if(f.size>400e3){toast("That sound is over 400 KB. Use a shorter one.");renderAdmin();return}
    try{const d=await readData(f),prev=[DB.alerts.custom,DB.alerts.customName];DB.alerts.custom=d;DB.alerts.customName=f.name;if(!saveDB()){DB.alerts.custom=prev[0];DB.alerts.customName=prev[1];toast("Not enough storage space.")}else{toast("Sound added");alPlay("custom")}}catch(err){toast(err.message)}renderAdmin()}
});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.altest!==undefined){alPush({type:"order",id:"",at:Date.now(),key:"test"+Date.now(),test:true})}
  else if(d.alplay){alPlay(DB.alerts.ev[d.alplay].snd)}
  else if(d.alsndrm!==undefined){const al=DB.alerts;al.custom="";al.customName="";Object.values(al.ev).forEach(v=>{if(v.snd==="custom")v.snd="chime"});saveDB();renderAdmin()}
});
am.addEventListener("input",e=>{const el=e.target;if(el.dataset.pm){const [id,f]=el.dataset.pm.split("|"),m=DB.payMethods.find(x=>x.id===id);if(m){m[f]=el.value;saveSoon()}}});
am.addEventListener("change",async e=>{const el=e.target;
  if(el.dataset.pmon){const m=DB.payMethods.find(x=>x.id===el.dataset.pmon);if(m){m.on=el.checked;saveDB();toast("Saved")}return}
  if(el.dataset.pmimg){const m=DB.payMethods.find(x=>x.id===el.dataset.pmimg),f=el.files[0];if(!m||!f)return;try{const prev=m.img;m.img=await lpResize(f,900);if(!saveDB()){m.img=prev;toast("Not enough storage space. Try a smaller image.")}else toast("Image added")}catch(err){toast(err.message)}renderAdmin()}
});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.pmadd!==undefined){DB.payMethods.push({id:uid(),name:"",details:"",img:"",on:true});saveDB();renderAdmin()}
  else if(d.pmdel){armed(b,()=>{DB.payMethods=DB.payMethods.filter(x=>x.id!==d.pmdel);saveDB();toast("Method deleted");renderAdmin()})}
  else if(d.pmimgrm){const m=DB.payMethods.find(x=>x.id===d.pmimgrm);if(m){m.img="";saveDB();renderAdmin()}}
});
am.addEventListener("input",e=>{const el=e.target,P=DB.proofpop;
  if(el.dataset.pp){P[el.dataset.pp]=el.value;saveSoon()}
  else if(el.dataset.ppcol){P[el.dataset.ppcol]=el.value;saveSoon()}
  else if(el.dataset.ppr){P[el.dataset.ppr]=+el.value;saveSoon()}
});
am.addEventListener("change",async e=>{const el=e.target,P=DB.proofpop;
  if(el.dataset.ppc){P[el.dataset.ppc]=el.checked;saveDB();toast("Saved");return}
  if(el.dataset.ppimg!==undefined){const f=el.files[0];if(!f)return;try{const prev=P.img;P.img=await lpResize(f,400);if(!saveDB()){P.img=prev;toast("Not enough storage space. Try a smaller picture.")}else toast("Picture added")}catch(err){toast(err.message)}renderAdmin();return}
  if(el.dataset.ppck!==undefined){const fs=[...el.files].slice(0,8-P.cookies.length);try{for(const f of fs){const d=await lpResize(f,160);P.cookies.push(d);if(!saveDB()){P.cookies.pop();toast("Not enough storage space. Remove a picture first.");break}}if(fs.length)toast("Cookie pictures added")}catch(err){toast(err.message)}renderAdmin()}
});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.pppreview!==undefined)ppShow(thSample(),true);
  else if(d.ppimgrm!==undefined){DB.proofpop.img="";saveDB();renderAdmin()}
  else if(d.ppckrm!==undefined){DB.proofpop.cookies.splice(+d.ppckrm,1);saveDB();renderAdmin()}
  else if(d.ppreset!==undefined){armed(b,()=>{DB.proofpop=defaultProofPop();saveDB();toast("Popup reset");renderAdmin()})}
});
/* --- order placed page editor --- */
function thSample(){return {id:"",code:"DD-PREV",customer:{name:"Sari Wulan"},mode:"delivery",size:6,day:ymd(addDays(today0(),1)),time:DB.settings.times[0]||"10 to 11am",total:30.5,expiresAt:Date.now()+DB.settings.payWindowH*3600e3}}
am.addEventListener("input",e=>{const el=e.target,T=DB.thanks;
  if(el.dataset.th){T[el.dataset.th]=el.value;saveSoon()}
  else if(el.dataset.thcol){T[el.dataset.thcol]=el.value;saveSoon()}
  else if(el.dataset.thr){T[el.dataset.thr]=+el.value;saveSoon()}
});
am.addEventListener("change",async e=>{const el=e.target,T=DB.thanks;
  if(el.dataset.thc){T[el.dataset.thc]=el.checked;saveDB();toast("Saved");return}
  if(el.dataset.thlogo!==undefined){const f=el.files[0];if(!f)return;try{const prev=T.logo;T.logo=await lpResize(f,300);if(!saveDB()){T.logo=prev;toast("Not enough storage space. Try a smaller logo.")}else toast("Logo added")}catch(err){toast(err.message)}renderAdmin();return}
  if(el.dataset.thck!==undefined){const fs=[...el.files].slice(0,8-T.cookies.length);try{for(const f of fs){const d=await lpResize(f,160);T.cookies.push(d);if(!saveDB()){T.cookies.pop();toast("Not enough storage space. Remove a picture first.");break}}if(fs.length)toast("Cookie pictures added")}catch(err){toast(err.message)}renderAdmin()}
});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.thpreview!==undefined){renderDone(thSample(),false,true)}
  else if(d.thlogorm!==undefined){DB.thanks.logo="";saveDB();renderAdmin()}
  else if(d.thckrm!==undefined){DB.thanks.cookies.splice(+d.thckrm,1);saveDB();renderAdmin()}
  else if(d.threset!==undefined){armed(b,()=>{DB.thanks=defaultThanks();saveDB();toast("Page reset");renderAdmin()})}
});
am.addEventListener("click",e=>{
  if(e.target.closest("select,input,textarea"))return;
  const b=e.target.closest("button,tr[data-order]");if(!b)return;const d=b.dataset;
  if(d.order){openOrder(d.order);return}
  if(d.ostatus){const [i,st]=d.ostatus.split(":"),oo=DB.orders.find(x=>x.id===i);
    if(oo&&st==="review"&&oo.status==="review"){openCheckPay(i);return}
    if(oo&&st==="awaiting"&&isRej(oo)){toast("Rejected"+(oo.rejected.reason?": "+oo.rejected.reason:"")+". Waiting for the customer to send a new proof.");return}
    setOrderStatus(i,st);return}
  if(d.rapprove){const o=DB.orders.find(x=>x.id===d.rapprove);if(o)setOrderStatus(o.id,"awaiting",{reject:true,reason:(o.rejReq&&o.rejReq.reason)||""});return}
  if(d.rdeny){armed(b,()=>SBH.patchOrder(d.rdeny,{rejReqReject:true}).then(()=>{toast("Kept. The order stays at Check payment.");renderAdmin()}).catch(x=>toast(x.message)));return}
  if(d.papprove){setOrderStatus(d.papprove,"new");return}
  if(d.preject){armed(b,()=>SBH.patchOrder(d.preject,{payReqReject:true}).then(()=>{toast("Turned down. The order stays at Check payment.");renderAdmin()}).catch(x=>toast(x.message)));return}
  if(d.od){A.od=d.od;renderAdmin();return}
  if(d.osub){openSubst(d.osub);return}
  if(d.oproof){showProof(d.oproof);return}
  if(d.ocancel){setOrderStatus(d.ocancel,"cancelled");return}
  if(d.printcard){const o=DB.orders.find(x=>x.id===d.printcard);if(o)printLabels([o],DB.label);return}
  if(d.dlcard){const o=DB.orders.find(x=>x.id===d.dlcard);if(o)downloadLabels([o],DB.label);return}
  if(d.printsel!==undefined){printLabels(shownRows().filter(o=>canLabel(o)&&!o.labelAt),DB.label);return}
  if(d.goto){A.tab=d.goto;renderAdmin();window.scrollTo(0,0);return}
  if(d.stk){const [id,delta]=d.stk.split(":"),p=prod(id);if(p){p.stock=Math.max(0,(p.stock||0)+(+delta));saveDB();toast(`${p.name}: ${p.stock} in stock`);renderAdmin()}return}
  if(d.filter){A.filter=d.filter;renderAdmin()}
  else if(d.bake){A.bakeDay=d.bake;renderAdmin()}
  else if(d.skind){A.draft.kind=d.skind;if(d.skind==="freedelivery"&&/^Flash sale/.test(A.draft.name))A.draft.name="Free delivery weekend";if(d.skind==="discount"&&/^Free delivery/.test(A.draft.name))A.draft.name="Flash sale";renderAdmin()}
  else if(d.stype){A.draft.type=d.stype;if(d.stype==="amount"&&A.draft.value>20)A.draft.value=5;renderAdmin()}
  else if(d.smode){A.draft.startMode=d.smode;if(d.smode==="later"&&!A.draft.startAt){const t=new Date(Date.now()+3600e3);t.setMinutes(0,0,0);A.draft.startAt=new Date(t.getTime()-t.getTimezoneOffset()*60e3).toISOString().slice(0,16)}renderAdmin()}
  else if(d.dur){A.draft.durH=Math.floor(+d.dur/60);A.draft.durM=+d.dur%60;document.querySelector('[data-draft="durH"]').value=A.draft.durH;document.querySelector('[data-draft="durM"]').value=A.draft.durM;updatePreview()}
  else if(d.saleEnd){const s=DB.sales.find(x=>x.id===d.saleEnd);s.end=Date.now();saveDB();toast("Sale ended");renderAdmin()}
  else if(d.saleExtend){const s=DB.sales.find(x=>x.id===d.saleExtend);s.end+=30*60e3;saveDB();toast("Added 30 minutes");renderAdmin()}
  else if(d.saleStart){const s=DB.sales.find(x=>x.id===d.saleStart),len=s.end-s.start;s.start=Date.now();s.end=s.start+len;saveDB();toast("Flash sale is live");renderAdmin()}
  else if(d.saleDel){armed(b,()=>{DB.sales=DB.sales.filter(x=>x.id!==d.saleDel);saveDB();toast("Sale deleted");renderAdmin()})}
  else if(d.pstatus){const [id,st]=d.pstatus.split(":");prod(id).status=st;saveDB();toast("Saved");renderAdmin()}
  else if(d.pdel!==undefined){armed(b,()=>needOwner("delete a flavor").then(()=>{DB.products=DB.products.filter(p=>p.id!==d.pdel);saveDB();toast("Flavor deleted");renderAdmin()}).catch(()=>{}))}
  else if(d.rvadmin){openAdminReviews(d.rvadmin)}
  else if(d.padd!==undefined){openAddFlavor()}
  else if(d.pcatmanage!==undefined){openCats()}
  else if(d.pcat){A.pcat=d.pcat;renderAdmin()}
  else if(d.pclear!==undefined){A.pq="";A.pcat="all";renderAdmin()}
  else if(d.sadd!==undefined){const n=Math.round(+$("#newN").value),p=+$("#newP").value,err=$("#sizeErr");
    if(!(n>=1&&n<=24)){err.textContent="Box size must be between 1 and 24 cookies.";err.hidden=false;return}
    if(DB.sizes.some(s=>s.n===n)){err.textContent=`There's already a box of ${n}.`;err.hidden=false;return}
    if(!(p>0)){err.textContent="Set a price above 0.";err.hidden=false;return}
    DB.sizes.push({n,price:p,active:true});saveDB();toast(`Box of ${n} added`);renderAdmin()}
  else if(d.sdel){armed(b,()=>{if(DB.sizes.length<=1){toast("Keep at least one box size");return}needOwner("delete a box size").then(()=>{DB.sizes=DB.sizes.filter(s=>String(s.n)!==d.sdel);saveDB();toast("Size deleted");renderAdmin()}).catch(()=>{})})}
  else if(d.aadd!==undefined){DB.addons.push({id:uid(),name:"New extra",desc:"",price:1,active:false});saveDB();toast("Extra added, turned off");renderAdmin()}
  else if(d.adel){armed(b,()=>needOwner("delete an extra").then(()=>{DB.addons=DB.addons.filter(a=>a.id!==d.adel);saveDB();toast("Extra deleted");renderAdmin()}).catch(()=>{}))}
  else if(d.closed){const i=+d.closed,c=DB.settings.closedWeekdays;DB.settings.closedWeekdays=c.includes(i)?c.filter(x=>x!==i):[...c,i];saveDB();toast("Saved");renderAdmin()}
  else if(d.pbg){openBg(d.pbg);return}
  else if(d.pbadge){const [pid,bid]=d.pbadge.split(":"),p=prod(pid);if(!p)return;const l=p.badges||[];p.badges=l.includes(bid)?l.filter(x=>x!==bid):[...l,bid];if(!p.badges.length)delete p.badges;saveDB();renderAdmin();return}
  else if(d.gotab){A.tab=d.gotab;renderAdmin();window.scrollTo(0,0);return}
  else if(d.rmimg){const p=prod(d.rmimg);delete p.img;delete p.cutout;delete p.tints;if(p.art==="photo")p.art="none";saveDB();toast("Photo removed. Look set to None.");renderAdmin()}
  else if(d.reset!==undefined){armed(b,()=>{DB=seedDB();saveDB();S=fresh();A.bakeDay=null;toast("Demo data restored");renderAdmin()})}
});
am.addEventListener("input",e=>{
  const el=e.target;
  if(el.dataset.oship){const o=DB.orders.find(x=>x.id===el.dataset.oid);if(o){o[el.dataset.oship]=el.value;saveSoon()}return}
  if(el.id==="pSearch"){A.pq=el.value;$("#plist").innerHTML=productRows();$("#pCount").textContent=pCountText();return}
  if(el.id==="oSearch"){A.q=el.value;const pos=el.selectionStart;renderAdmin();const n=$("#oSearch");n.focus();n.setSelectionRange(pos,pos);return}
  if(el.dataset.draft){A.draft[el.dataset.draft]=el.type==="number"?(parseFloat(el.value)||0):el.value;$("#saleErr")&&($("#saleErr").hidden=true);updatePreview();return}
  if(el.dataset.k&&el.type!=="number"&&el.type!=="checkbox"&&el.tagName!=="SELECT"){setK(el);saveSoon()}
});
am.addEventListener("change",e=>{
  const el=e.target;
  if(el.dataset.oddate!==undefined){A.od=el.value||"all";renderAdmin();return}
  if(el.dataset.statusFor){setOrderStatus(el.dataset.statusFor,el.value);return}
  if(el.dataset.move){moveProduct(el.dataset.move,el.value);return}
  if(el.dataset.upload){uploadPhoto(el.dataset.upload,el.files[0],el.closest(".upl"));return}
  if(el.dataset.draft&&el.tagName==="SELECT"){A.draft[el.dataset.draft]=el.value;updatePreview();return}
  if(el.dataset.lines){
    const lines=el.value.split("\n").map(x=>x.trim()).filter(Boolean);
    if(el.dataset.lines==="times")DB.settings.times=lines.length?lines:DB.settings.times;
    else DB.settings.hours=lines.map(l=>{const [a,...b]=l.split("|");return [a.trim(),b.join("|").trim()]});
    saveDB();toast("Saved");return;
  }
  if(/^settings::(samedayOn|pickupOn|schedOn)$/.test(el.dataset.k||"")&&!el.checked){const t=DB.settings,n=["samedayOn","pickupOn","schedOn"].filter(k=>k!==el.dataset.k.slice(10)&&(k==="samedayOn"?t[k]:t[k]!==false)).length;if(!n){el.checked=true;toast("Keep at least one way to get an order switched on.");return}}
  if(el.dataset.k&&(el.type==="number"||el.type==="checkbox"||el.tagName==="SELECT")){const {coll,field}=setK(el);saveDB();toast("Saved");if(/^payCd/.test(field))applyCdLook();
    if(field==="art"||field==="active"||field==="currency"||field==="track"||field==="stock"||field==="lowStockAt"||field==="cat"||coll==="sizes"||/^custom/.test(field))renderAdmin()}
});
/* --- photo upload: auto square-crop + resize to 400px --- */
const hex=(r,g,b)=>"#"+[r,g,b].map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,"0")).join("");
async function processImage(file){
  if(!file||!/^image\//.test(file.type))throw new Error("That file isn't an image. Use JPG, PNG or WebP.");
  if(file.size>20e6)throw new Error("That image is over 20 MB. Try a smaller one.");
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Couldn't read that image. Try a JPG or PNG."));i.src=url});
    const W=img.naturalWidth,H=img.naturalHeight,side=Math.min(W,H),sx=(W-side)/2,sy=(H-side)/2,OUT=400;
    // probe: transparency + average color
    const pc=document.createElement("canvas");pc.width=pc.height=40;const px=pc.getContext("2d",{willReadFrequently:true});px.drawImage(img,sx,sy,side,side,0,0,40,40);
    const d=px.getImageData(0,0,40,40).data;let clear=0,r=0,g=0,b=0,n=0;
    for(let i=0;i<d.length;i+=4){if(d[i+3]<200)clear++;else{r+=d[i];g+=d[i+1];b+=d[i+2];n++}}
    const cutout=clear>40*40*.08;n=n||1;r/=n;g/=n;b/=n;
    const tints=[hex(r,g,b),hex(r*.65,g*.65,b*.65),hex(r+(255-r)*.5,g+(255-g)*.5,b+(255-b)*.5)];
    // step down in halves for a sharper resize from large photos
    let src=img,sw=side,sxx=sx,syy=sy;
    while(sw>OUT*2){const c=document.createElement("canvas");c.width=c.height=Math.round(sw/2);const x=c.getContext("2d");x.imageSmoothingQuality="high";x.drawImage(src,sxx,syy,sw,sw,0,0,c.width,c.height);src=c;sw=c.width;sxx=0;syy=0}
    const c=document.createElement("canvas");c.width=c.height=OUT;const x=c.getContext("2d");x.imageSmoothingQuality="high";x.drawImage(src,sxx,syy,sw,sw,0,0,OUT,OUT);
    let out;
    if(cutout){out=c.toDataURL("image/png");const w=c.toDataURL("image/webp",.85);if(w.startsWith("data:image/webp")&&w.length<out.length)out=w}
    else{out=c.toDataURL("image/jpeg",.82)}
    return {img:out,cutout,tints,W,H,kb:Math.round(out.length*.75/1024)};
  }finally{URL.revokeObjectURL(url)}
}
async function uploadPhoto(id,file,lbl){
  const p=prod(id);if(!p||!file)return;
  lbl&&lbl.classList.add("busy");
  try{
    const r=await processImage(file),prev={img:p.img,cutout:p.cutout,tints:p.tints,art:p.art};
    Object.assign(p,{img:r.img,cutout:r.cutout,tints:r.tints,art:"photo"});
    if(!saveDB()){Object.assign(p,prev);if(!prev.img)delete p.img;toast("Not enough storage space. Remove another photo or use a smaller one.");}
    else toast(`Photo added: ${r.W}×${r.H} resized to 400×400 (${r.kb} KB)${r.cutout?", cut-out":""}`);
  }catch(err){toast(err.message)}
  renderAdmin();
}

/* --- marquee banner --- */
const MQ_FONTS={display:["Unbounded","var(--display)"],body:["Instrument Sans","var(--body)"],serif:["Serif",'Georgia,"Times New Roman",serif'],mono:["Monospace",'ui-monospace,Menlo,Consolas,monospace'],hand:["Handwritten",'"Segoe Script","Brush Script MT","Comic Sans MS",cursive'],impact:["Poster",'Impact,"Arial Narrow Bold","Haettenschweiler",sans-serif']};
const MQ_SIZE={S:14,M:18,L:28},MQ_SPEED={slow:40,medium:70,fast:110};
let mqFace=null,mqFaceKey="";
function mqEnsureFont(m){
  if(!m.fontData){if(mqFace){try{document.fonts.delete(mqFace)}catch(e){}mqFace=null;mqFaceKey=""}return}
  const key=m.fontName+m.fontData.length;if(key===mqFaceKey)return;
  try{if(mqFace)document.fonts.delete(mqFace);mqFace=new FontFace("DD Custom",`url(${m.fontData})`);document.fonts.add(mqFace);mqFaceKey=key;mqFace.load().then(()=>mqFit()).catch(()=>{})}catch(e){}
}
function mqFamily(m){return m.font==="custom"&&m.fontData?'"DD Custom",var(--body)':(MQ_FONTS[m.font]||MQ_FONTS.display)[1]}
function mqSeq(m,n){ // n repeats of the sentences, a random photo after each one (never the same twice in a row)
  const out=[];let last=-1;const imgs=m.images||[];
  for(let k=0;k<n;k++)m.texts.forEach(t=>{out.push(`<span class="mt">${esc(t)}</span>`);
    if(imgs.length){let i=Math.floor(Math.random()*imgs.length);if(imgs.length>1&&i===last)i=(i+1+Math.floor(Math.random()*(imgs.length-1)))%imgs.length;last=i;out.push(`<img class="mi" src="${esc(imgOk(imgs[i]))}" alt="" draggable="false">`)}
    else out.push(`<span class="mdot" aria-hidden="true">✦</span>`)});
  return out.join("");
}
function renderMarquee(el,m){
  if(!el)return;m=m||DB.marquee;
  const texts=(m.texts||[]).filter(Boolean);
  el.hidden=!m.on||!texts.length;if(el.hidden)return;
  mqEnsureFont(m);
  el.style.setProperty("--mbg",m.bg);el.style.setProperty("--mfg",m.color);el.style.setProperty("--msz",(MQ_SIZE[m.size]||18)+"px");el.style.setProperty("--mfont",mqFamily(m));
  el.setAttribute("aria-label",texts.join(". "));
  el._m={...m,texts};mqBuild(el);
}
function mqBuild(el){
  const m=el._m;if(!m)return;
  el.classList.toggle("still",RM);
  const draw=n=>{const set=mqSeq(m,n);el.innerHTML=`<div class="track"><div class="set">${set}</div><div class="set" aria-hidden="true">${set}</div></div>`};
  draw(1);
  const cw=el.clientWidth;if(!cw)return; // hidden: re-fit when shown
  const w1=el.querySelector(".set").scrollWidth||1;
  const n=Math.max(1,Math.ceil(cw/w1));
  if(n>1)draw(n);
  const w=el.querySelector(".set").scrollWidth;
  el.style.setProperty("--mdur",Math.max(6,w/(MQ_SPEED[m.speed]||70))+"s");
}
function mqFit(){document.querySelectorAll(".marq").forEach(el=>{if(el._m&&!el.hidden)mqBuild(el);else if(el._ai&&!el.hidden)anMqBuild(el)})}
let mqT;addEventListener("resize",()=>{clearTimeout(mqT);mqT=setTimeout(mqFit,200)});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(mqFit);
document.addEventListener("click",e=>{});

function mqLum(h){const c=[1,3,5].map(i=>{const v=parseInt(h.slice(i,i+2),16)/255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)});return .2126*c[0]+.7152*c[1]+.0722*c[2]}
function mqContrast(a,b){const x=mqLum(a),y=mqLum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
function viewMarquee(){
  const m=DB.marquee,ok=mqContrast(m.bg,m.color)>=3;
  const fontOpts=Object.entries(MQ_FONTS).map(([k,v])=>`<option value="${k}" ${m.font===k?"selected":""}>${v[0]}</option>`).join("")+(m.fontData?`<option value="custom" ${m.font==="custom"?"selected":""}>${esc(m.fontName||"Your font")} (uploaded)</option>`:"");
  return head("Marquee banner","The running text above “Build your box”. Add 1 to 5 photos and they pop up at random between the sentences.")+MOCK+`
  <div class="stack">
    <section class="panel">
      <div class="phead"><div><h2>Preview</h2><p class="sub">Updates as you type. Reload the shop to see the photos reshuffle.</p></div>
        <label class="sw"><input type="checkbox" data-mq="on" ${m.on?"checked":""} aria-label="Show marquee in shop"><span></span></label></div>
      <div class="marq prev" id="mqPrev"></div>
      <p class="note" id="mqWarn" style="margin-top:8px;color:var(--red)" ${ok?"hidden":""}>Text and background look too similar. Pick colors that contrast more.</p>
    </section>
    <section class="panel mqgrid">
      <div><h2>Text</h2><p class="sub">One sentence per line, up to 12.</p>
        <label class="af"><span class="vh" style="position:absolute;left:-9999px">Marquee sentences</span><textarea class="in" rows="5" data-mq="texts" maxlength="1200" aria-label="Marquee sentences">${esc(m.texts.join("\n"))}</textarea></label></div>
      <div><h2>Photos <span class="note" id="mqCount">${m.images.length} of 5</span></h2><p class="sub">Shown at random between sentences. They are resized small automatically. Transparent PNGs keep their see-through background.</p>
        <div class="mqimgs">${m.images.map((src,i)=>`<div class="th"><img src="${esc(imgOk(src))}" alt="Marquee photo ${i+1}"><button type="button" data-mqrm="${i}" aria-label="Remove photo ${i+1}">×</button></div>`).join("")}
          ${m.images.length<5?`<label class="ghost mqbtn">+ Add photo<input type="file" accept="image/*" multiple hidden data-mqimg></label>`:`<span class="note">Maximum reached</span>`}</div></div>
    </section>
    <section class="panel">
      <h2>Look</h2>
      <div class="grid3" style="margin-top:12px;align-items:end">
        <label class="af">Text color<div class="colin"><input type="color" data-mqc="color" value="${m.color}" aria-label="Text color picker"><input class="in" data-mqc="color" value="${m.color}" maxlength="7" aria-label="Text color hex"></div></label>
        <label class="af">Background color<div class="colin"><input type="color" data-mqc="bg" value="${m.bg}" aria-label="Background color picker"><input class="in" data-mqc="bg" value="${m.bg}" maxlength="7" aria-label="Background color hex"></div></label>
        <label class="af">Font<select class="in" data-mq="font">${fontOpts}</select></label>
      </div>
      <div class="grid3" style="margin-top:12px;align-items:end">
        <label class="af">Text size<select class="in" data-mq="size"><option value="S" ${m.size==="S"?"selected":""}>Small</option><option value="M" ${m.size==="M"?"selected":""}>Medium</option><option value="L" ${m.size==="L"?"selected":""}>Large</option></select></label>
        <label class="af">Speed<select class="in" data-mq="speed"><option value="slow" ${m.speed==="slow"?"selected":""}>Slow</option><option value="medium" ${m.speed==="medium"?"selected":""}>Medium</option><option value="fast" ${m.speed==="fast"?"selected":""}>Fast</option></select></label>
        <div class="af">Your own font<div class="colin"><label class="ghost mqbtn">${m.fontData?"Replace font":"Upload font"}<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden data-mqfont></label>${m.fontData?`<button class="danger" type="button" data-mqfontrm>Remove</button>`:""}</div></div>
      </div>
      <p class="note" style="margin-top:10px">${m.fontData?`Uploaded font: <b>${esc(m.fontName)}</b>. Choose it in the Font list.`:"Upload a .ttf, .otf, .woff or .woff2 file (up to 1 MB), then pick it in the Font list."} Only upload fonts you have the license to use on the web.</p>
      <div class="colin" style="margin-top:12px"><button class="ghost" type="button" data-mqreset>Reset banner to default</button></div>
    </section>
  </div>`;
}
function afterViewMarquee(){renderMarquee($("#mqPrev"),DB.marquee)}
let mqSaveT;
function mqSave(msg){clearTimeout(mqSaveT);mqSaveT=setTimeout(()=>{if(saveDB())toast(msg||"Saved");else toast("Not enough storage space. Remove a photo or font.")},350)}
function mqPreview(){renderMarquee($("#mqPrev"),DB.marquee);const w=$("#mqWarn");if(w)w.hidden=mqContrast(DB.marquee.bg,DB.marquee.color)>=3}
async function mqSmall(file){
  if(!/^image\//.test(file.type))throw new Error("That file isn't an image. Use JPG, PNG or WebP.");
  if(file.size>20e6)throw new Error("That image is over 20 MB. Try a smaller one.");
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Couldn't read that image."));i.src=url});
    const MAX=240,k=Math.min(1,MAX/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
    const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});x.imageSmoothingQuality="high";x.drawImage(img,0,0,w,h);
    const d=x.getImageData(0,0,w,h).data;let clear=0;for(let i=3;i<d.length;i+=4)if(d[i]<200)clear++;
    if(clear>w*h*.02){let o=c.toDataURL("image/webp",.85);if(!o.startsWith("data:image/webp"))o=c.toDataURL("image/png");return o}
    return c.toDataURL("image/jpeg",.85);
  }finally{URL.revokeObjectURL(url)}
}
am.addEventListener("input",e=>{
  const el=e.target,m=DB.marquee;
  if(el.dataset.mq==="texts"){m.texts=el.value.split("\n").map(x=>x.trim().slice(0,90)).filter(Boolean).slice(0,12);mqPreview();mqSave()}
  else if(el.dataset.mqc){const k=el.dataset.mqc,v=el.value.trim();if(!HEX6.test(v.startsWith("#")?v:"#"+v))return;const h=(v.startsWith("#")?v:"#"+v).toLowerCase();m[k]=h;
    am.querySelectorAll(`[data-mqc="${k}"]`).forEach(o=>{if(o!==el&&o.value.toLowerCase()!==h)o.value=h});mqPreview();mqSave()}
});
am.addEventListener("change",async e=>{
  const el=e.target,m=DB.marquee;
  if(el.dataset.mq&&el.dataset.mq!=="texts"){
    const k=el.dataset.mq;m[k]=el.type==="checkbox"?el.checked:el.value;saveDB();toast("Saved");mqPreview();return}
  if(el.dataset.mqimg!==undefined){
    const files=[...el.files].slice(0,5-m.images.length);if(!files.length)return;
    for(const f of files){try{const prev=m.images.slice();m.images.push(await mqSmall(f));if(!saveDB()){m.images=prev;toast("Not enough storage space. Remove another photo first.");break}}catch(err){toast(err.message);break}}
    if([...el.files].length>files.length)toast("Only 5 photos fit. Extra ones were skipped.");
    renderAdmin();return}
  if(el.dataset.mqfont!==undefined){
    const f=el.files[0];if(!f)return;
    if(f.size>1024*1024){toast("That font is over 1 MB. Use a smaller file or a .woff2 version.");el.value="";return}
    if(!/\.(ttf|otf|woff2?)$/i.test(f.name)){toast("Use a .ttf, .otf, .woff or .woff2 file.");el.value="";return}
    try{
      const data=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Couldn't read that file."));r.readAsDataURL(f)});
      const test=new FontFace("DD Test",`url(${data})`);await test.load();
      const prev={fontData:m.fontData,fontName:m.fontName,font:m.font};
      Object.assign(m,{fontData:data,fontName:f.name.replace(/\.[^.]+$/,"").slice(0,40),font:"custom"});
      if(!saveDB()){Object.assign(m,prev);toast("Not enough storage space for that font.")}else toast("Font added and selected");
    }catch(err){toast("That file isn't a usable font.")}
    renderAdmin();return}
});
am.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;const d=b.dataset,m=DB.marquee;
  if(d.mqrm!==undefined){m.images.splice(+d.mqrm,1);saveDB();toast("Photo removed");renderAdmin()}
  else if(d.mqfontrm!==undefined){m.fontData=null;m.fontName="";if(m.font==="custom")m.font="display";saveDB();toast("Font removed");renderAdmin()}
  else if(d.mqreset!==undefined){armed(b,()=>{DB.marquee=defaultMarquee();saveDB();toast("Banner reset");renderAdmin()})}
});

/* --- landing page editor --- */
const LP_DEFAULT_SVG=`<svg viewBox="0 0 30 24" aria-hidden="true"><path d="M3 21a12 12 0 0 1 24 0Z" fill="currentColor"/><circle cx="15" cy="5" r="2.6" fill="currentColor"/><rect x="1" y="20.5" width="28" height="3" rx="1.5" fill="currentColor"/></svg>`;
function defaultPage(){return {name:"delidome",logo:"",brand:"#000096",bg:"#ffffff",ink:"#0B0B45",headFont:"display",bodyFont:"body",fonts:[],
  hero:{eyebrow:"Baked fresh every morning",title:"Warm cookies, boxed your way.",lede:"Pick a box, fill it with the flavors you love, and choose when you want it. Pickup or local delivery.",btn1:"Build a box",btn2:"See the flavors",bg:"",color:"#ffffff",mediaType:"none",src:"",overlay:35,floats:true,cookies:["","","","","",""]},
  strip:{items:[{t:"Boxes of {sizes}",on:true},{t:"Order by {cutoff} for the next day",on:true},{t:"Closed {closed}",on:true}]},
  build:{title:"Build your box",intro:"Choose a size, fill every spot, then tell us when you want it. Each box is baked the morning it leaves the oven room."},
  blocks:[],
  visit:{title:"Come say hello",text:"Pickup is at the front counter. Give your name and we'll bring your box out.",bg:"",faqTitle:"Good to know"},
  faq:[{q:"When is the order cutoff?",a:"{cutoff} the day before. We bake every box fresh in the morning, so we need the evening to plan the bake."},
       {q:"How long do the cookies stay fresh?",a:"They're best on the day you get them. Keep them in an airtight container for up to three days, and give them 5 minutes in a warm oven to bring them back."},
       {q:"Can I order for an event?",a:"Yes. For more than five boxes, message us at least three days ahead so we can set aside oven time."},
       {q:"What about allergies?",a:"Every cookie contains wheat, dairy and egg, and our kitchen handles nuts. We can't promise any box is allergen free."}],
  footer:{text:"Fresh cookie boxes, baked to order.",bg:"",color:"#ffffff"}}}
function deepFill(d,o){if(o===undefined||o===null)return d;if(Array.isArray(d)||typeof d!=="object")return o;const r={...o};for(const k in d)r[k]=deepFill(d[k],o[k]);return r}
const safeUrl=u=>{u=String(u||"").trim();return /^(https:\/\/|#(build|menu|visit|shop)$)/i.test(u)?u:""};
const safeMedia=u=>{u=String(u||"").trim();return /^(https:\/\/|data:(image|video)\/)/i.test(u)?u:""};
let lpFaces={};
function lpEnsureFonts(pg){
  const ids=new Set((pg.fonts||[]).map(f=>f.id));
  for(const id in lpFaces)if(!ids.has(id)){try{document.fonts.delete(lpFaces[id])}catch(e){}delete lpFaces[id]}
  (pg.fonts||[]).forEach(f=>{if(lpFaces[f.id])return;try{const ff=new FontFace("DD-"+f.id,`url(${f.data})`);document.fonts.add(ff);lpFaces[f.id]=ff;ff.load().then(()=>mqFit()).catch(()=>{})}catch(e){}});
}
function lpFamily(key,pg){if(String(key).startsWith("f:")){const f=(pg.fonts||[]).find(x=>x.id===key.slice(2));if(f)return `"DD-${f.id}",var(--body)`}return (MQ_FONTS[key]||MQ_FONTS.body)[1]}
function videoHTML(src,{bg=false}={}){
  src=safeMedia(src);if(!src)return "";
  if(/^data:video\//i.test(src)||/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(src))
    return bg?`<video src="${esc(src)}" ${RM?"":"autoplay"} muted loop playsinline preload="metadata"></video>`:`<video src="${esc(src)}" controls playsinline preload="metadata"></video>`;
  if(bg)return "";
  let m=src.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
  if(m)return `<div class="vf"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Video" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  m=src.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if(m)return `<div class="vf"><iframe src="https://player.vimeo.com/video/${m[1]}" title="Video" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div>`;
  return `<p><a href="${esc(src)}" target="_blank" rel="noopener">Watch the video</a></p>`;
}

const HERO_SPOTS=[[3,6],[85,4],[-4,46],[90,40],[2,84],[86,82]];
function heroFloats(dome,h){
  if(!dome)return;dome.querySelectorAll(".float").forEach(n=>n.remove());
  const prods=DB.products.filter(p=>p.status!=="hidden"&&hasImage(p)).slice(0,6),cs=(h&&h.cookies)||[];let html="";
  for(let i=0;i<6;i++){const c=safeMedia(cs[i]);let inner="";
    if(c)inner=`<img class="ck ph${/^data:image\/jpeg/i.test(c)?"":" cut"}" src="${esc(c)}" alt="" draggable="false">`;else if(prods[i])inner=plateInner(prods[i]);
    if(!inner)continue;
    html+=`<div class="float" aria-hidden="true" style="left:${HERO_SPOTS[i][0]}%;top:${HERO_SPOTS[i][1]}%"><div class="plate" style="background:${i%2?"#2328C8":"#1A1FB0"}">${inner}</div></div>`}
  dome.insertAdjacentHTML("afterbegin",html);
}
function heroFill(dome,h){
  if(!dome)return;const q=x=>dome.querySelector(x),ey=q(".eyebrow"),ti=q("h1"),le=q(".lede"),ab=dome.querySelectorAll(".hero-ctas a");
  ey.textContent=h.eyebrow;ey.hidden=!h.eyebrow;ti.textContent=h.title;le.textContent=h.lede;le.hidden=!h.lede;
  ab[0].textContent=h.btn1;ab[0].hidden=!h.btn1;ab[1].textContent=h.btn2;ab[1].hidden=!h.btn2;
  dome.style.background=h.bg||"";dome.style.color=h.color||"";dome.classList.toggle("nofloat",!h.floats);
  const hm=q(".hm"),src=safeMedia(h.src);let hasM=false;hm.innerHTML="";hm.style.backgroundImage="";
  if(h.mediaType==="image"&&src){hm.style.backgroundImage=`url("${imgOk(src).replace(/["()\\\s]/g,c=>encodeURIComponent(c))}")`;hasM=true}
  else if(h.mediaType==="video"&&src){const v=videoHTML(src,{bg:true});if(v){hm.innerHTML=v;hasM=true}}
  q(".ho").style.opacity=hasM?(Math.max(0,Math.min(90,+h.overlay||0))/100):0;
  heroFloats(dome,h);
}
let favKey="";
function lpFavicon(pg){
  let l=document.querySelector('link[rel="icon"]');if(!l){l=document.createElement("link");l.rel="icon";document.head.appendChild(l)}
  const lg=safeMedia(pg.logo),key=lg?"i"+lg.length+lg.slice(-30):"d"+pg.brand;if(key===favKey)return;favKey=key;
  const dflt=()=>{l.type="image/svg+xml";l.href="data:image/svg+xml,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 24"><path d="M3 21a12 12 0 0 1 24 0Z" fill="${pg.brand}"/><circle cx="15" cy="5" r="2.6" fill="${pg.brand}"/><rect x="1" y="20.5" width="28" height="3" rx="1.5" fill="${pg.brand}"/></svg>`)};
  if(!lg){dflt();return}
  const im=new Image();im.onload=()=>{try{const c=document.createElement("canvas");c.width=c.height=64;const x=c.getContext("2d"),k=Math.min(64/im.naturalWidth,64/im.naturalHeight),w=im.naturalWidth*k,h=im.naturalHeight*k;x.drawImage(im,(64-w)/2,(64-h)/2,w,h);l.type="image/png";l.href=c.toDataURL("image/png")}catch(e){dflt()}};im.onerror=dflt;im.src=lg;
}
function renderLanding(){
  const pg=DB.page,sv=$("#storeView");if(!pg||!sv)return;
  lpEnsureFonts(pg);
  sv.style.setProperty("--blue",pg.brand);sv.style.setProperty("--ink",pg.ink);
  sv.style.setProperty("--display",lpFamily(pg.headFont,pg));sv.style.setProperty("--body",lpFamily(pg.bodyFont,pg));
  document.documentElement.style.setProperty("--pagebg",pg.bg);
  const nm=pg.name||"delidome";document.title=`${nm} Cookie Boxes`;
  $("#brandTxt").textContent=nm;$("#ftBrand").textContent=nm;$(".top .logo").setAttribute("aria-label",`${nm} home`);
  const lg=safeMedia(pg.logo);const mark=lg?`<img src="${esc(lg)}" alt="">`:LP_DEFAULT_SVG;$("#logoMark").innerHTML=mark;$("#ftMark").innerHTML=mark;
  lpFavicon(pg);
  heroFill($("#dome"),pg.hero);
  // strip
  const set=DB.settings,closed=set.closedWeekdays.slice().sort().map(d=>DOW_LONG[d]),tok={sizes:listJoin(activeSizes().map(x=>x.n)),cutoff:fmtHour(set.cutoffHour),closed:listJoin(closed).replace(" or "," and ")};
  $("#heroStrip").innerHTML=pg.strip.items.filter(it=>it.on&&it.t&&!(/\{closed\}/.test(it.t)&&!closed.length)).map(it=>`<span>${esc(it.t.replace(/\{(sizes|cutoff|closed)\}/g,(m,k)=>tok[k]))}</span>`).join("");
  $("#buildTitle").textContent=pg.build.title;$("#buildIntro").textContent=pg.build.intro;$("#buildIntro").hidden=!pg.build.intro;
  const v=pg.visit,vs=$("#visit");$("#visitTitle").textContent=v.title;$("#visitText").textContent=v.text;$("#visitText").hidden=!v.text;$("#faqTitle").textContent=v.faqTitle;vs.style.background=v.bg||"";
  $("#faqList").innerHTML=pg.faq.filter(f=>f.q).map((f,i)=>`<details ${i===0?"open":""}><summary>${esc(f.q)}</summary><p>${esc(String(f.a||"").replace(/\{cutoff\}/g,fmtHour(DB.settings.cutoffHour)))}</p></details>`).join("");
  $("#faqTitle").hidden=!pg.faq.some(f=>f.q);
  const f=pg.footer,ft=$("#siteFoot");$("#ftText").textContent=f.text;ft.style.background=f.bg||"";ft.style.color=f.color||"";
  ft.querySelectorAll("a,.logo").forEach(a=>a.style.color=f.color||"");
  // custom sections
  const blk=b=>{
    const lay=b.layout||"right",sm=safeMedia(b.src);let media="";
    if(lay!=="text"){if(b.mediaType==="image"&&sm)media=`<div class="lp-media"><img src="${esc(sm)}" alt="${esc(b.heading||"")}" loading="lazy"></div>`;
      else if(b.mediaType==="video"&&sm){const vh=videoHTML(sm);if(vh)media=`<div class="lp-media">${vh}</div>`}}
    const bl=safeUrl(b.btnLink),btn=b.btnLabel&&bl?`<a class="btn btn-blue" href="${esc(bl)}" ${bl[0]==="#"?"":'target="_blank" rel="noopener"'} ${b.color?`style="background:transparent;color:${esc(b.color)}"`:""}>${esc(b.btnLabel)}</a>`:"";
    const text=(b.heading||b.text||btn)?`<div class="lp-text">${b.heading?`<h2>${esc(b.heading)}</h2>`:""}${b.text?`<p>${esc(b.text)}</p>`:""}${btn}</div>`:"";
    const st=`${b.bg?`background:${esc(b.bg)};`:""}${b.color?`color:${esc(b.color)};`:""}`;
    return `<section class="lp l-${esc(lay)}" ${st?`style="${st}"`:""}><div class="wrap lp-in">${lay==="full"?media+text:text+media}</div></section>`;
  };
  $("#lpTop").innerHTML=pg.blocks.filter(b=>b.pos==="top").map(blk).join("");
  $("#lpBottom").innerHTML=pg.blocks.filter(b=>b.pos!=="top").map(blk).join("");
}

const lpGet=path=>path.split(".").reduce((o,k)=>o==null?o:o[k],DB.page);
function lpSet(path,v){const ks=path.split(".");let o=DB.page;for(let i=0;i<ks.length-1;i++)o=o[ks[i]];o[ks[ks.length-1]]=v}
const HEX_OK=/^#[0-9a-f]{6}$/i;
const lpIn=(label,path,o={})=>`<label class="af">${label}${o.rows?`<textarea class="in" rows="${o.rows}" data-lp="${path}" maxlength="${o.max||600}" placeholder="${esc(o.ph||"")}">${esc(lpGet(path)||"")}</textarea>`:`<input class="in" data-lp="${path}" maxlength="${o.max||120}" value="${esc(lpGet(path)||"")}" placeholder="${esc(o.ph||"")}">`}</label>`;
function lpCol(label,path,fallback,optional){
  const raw=lpGet(path)||"",v=HEX_OK.test(raw)?raw:fallback;
  return `<div class="af">${label}<div class="colin"><input type="color" data-lpc="${path}" value="${v}" aria-label="${esc(label)} picker"><input class="in" data-lpc="${path}" ${optional?'data-lpopt="1"':""} value="${esc(raw)}" placeholder="${optional?"default":""}" maxlength="7" aria-label="${esc(label)} hex">${optional&&raw?`<button class="ghost" type="button" data-lpclear="${path}">Reset</button>`:""}</div></div>`;
}
function lpFontSel(label,path){
  const pg=DB.page,cur=lpGet(path);
  const opts=Object.entries(MQ_FONTS).map(([k,v])=>`<option value="${k}" ${cur===k?"selected":""}>${v[0]}</option>`).join("")+pg.fonts.map(f=>`<option value="f:${f.id}" ${cur==="f:"+f.id?"selected":""}>${esc(f.name)} (uploaded)</option>`).join("");
  return `<label class="af">${label}<select class="in" data-lp="${path}">${opts}</select></label>`;
}
function lpMedia(base,obj,{video=true,imageLabel="Image"}={}){
  const t=obj.mediaType||"none",src=obj.src||"",isData=/^data:/i.test(src);
  let body="";
  if(t==="image"){
    body=`${src?`<img class="lpthumb" src="${esc(safeMedia(src))}" alt="Current image">`:""}
    <div class="colin"><label class="ghost mqbtn">${src?"Replace image":"Upload image"}<input type="file" accept="image/*" hidden data-lpimg="${base}.src"></label>${src?`<button class="danger" type="button" data-lpclear="${base}.src">Remove</button>`:""}</div>
    <label class="af">Or paste an image link (https)<input class="in" data-lp="${base}.src" value="${isData?"":esc(src)}" placeholder="${isData?"Uploaded file":"https://..."}"></label>`;
  }else if(t==="video"){
    const vh=src?videoHTML(src,{bg:base==="hero"}):"";
    body=`${vh&&/<video/.test(vh)?vh.replace("<video",'<video class="lpthumb" style="max-width:280px"').replace(" autoplay","").replace(" muted loop"," muted controls"):src?`<p class="note">Video linked.</p>`:""}
    <div class="colin"><label class="ghost mqbtn">${src?"Replace video":"Upload short video"}<input type="file" accept="video/mp4,video/webm" hidden data-lpvid="${base}.src"></label>${src?`<button class="danger" type="button" data-lpclear="${base}.src">Remove</button>`:""}</div>
    <label class="af">Or paste a video link<input class="in" data-lp="${base}.src" value="${isData?"":esc(src)}" placeholder="${isData?"Uploaded file":base==="hero"?"https://.../video.mp4":"YouTube, Vimeo or .mp4 link"}"></label>
    <p class="note">Uploads are limited to 3 MB. For longer videos, paste a link${base==="hero"?" to an .mp4 file":" (YouTube, Vimeo or .mp4)"}.</p>`;
  }
  return `<div class="stack" style="gap:10px"><label class="af">Media<select class="in" data-lp="${base}.mediaType" data-rr="1"><option value="none" ${t==="none"?"selected":""}>None</option><option value="image" ${t==="image"?"selected":""}>${imageLabel}</option>${video?`<option value="video" ${t==="video"?"selected":""}>Video</option>`:""}</select></label>${body}</div>`;
}
const LPOPEN={};
function lpRender(){const y=scrollY;renderAdmin();scrollTo(0,y)}
function viewLanding(){
  const pg=DB.page,h=pg.hero;
  const sec=(title,body,open,key)=>{key=key||title.replace(/ \(\d+\)$/,"");const o=LPOPEN[key]===undefined?open:LPOPEN[key];return `<details class="panel lpsec" data-sec="${esc(key)}" ${o?"open":""}><summary>${title}</summary><div class="lpbody">${body}</div></details>`};
  return head("Landing page","Edit the words, photos, videos, fonts and colors of your shop's front page. Changes show in the shop straight away.")+MOCK+`
  <div class="stack">
  ${sec("Brand, colors and fonts",`
    <div class="grid2">${lpIn("Brand name","name",{max:30})}
      <div class="af">Logo image (optional)<div class="colin"><label class="ghost mqbtn">${pg.logo?"Replace logo":"Upload logo"}<input type="file" accept="image/*" hidden data-lpimg="logo"></label>${pg.logo?`<img class="lpthumb" style="max-height:36px;max-width:90px" src="${esc(safeMedia(pg.logo))}" alt="Logo"><button class="danger" type="button" data-lpclear="logo">Remove</button>`:""}</div></div></div>
    <div class="grid3">${lpCol("Brand color (buttons, accents)","brand","#000096")}${lpCol("Page background","bg","#ffffff")}${lpCol("Text color","ink","#0B0B45")}</div>
    <div class="grid2">${lpFontSel("Heading font","headFont")}${lpFontSel("Body font","bodyFont")}</div>
    <div class="af">Your own fonts<div class="colin" style="flex-wrap:wrap">${pg.fonts.map(f=>`<span class="fchip">${esc(f.name)} <button class="danger" type="button" data-lpfontrm="${f.id}" style="padding:2px 8px">×</button></span>`).join("")}${pg.fonts.length<3?`<label class="ghost mqbtn">+ Upload font<input type="file" accept=".ttf,.otf,.woff,.woff2,font/*" hidden data-lpfont></label>`:""}</div>
      <p class="note">Up to 3 fonts (.ttf, .otf, .woff, .woff2, 1 MB each). They appear in the font lists above. Only upload fonts you're licensed to use on the web.</p></div>`,true)}
  ${sec("Top banner (hero)",`
    <p class="note" style="margin:0">The banner's words, buttons, colors, picture and floating cookies now live in the <button class="ghost" type="button" data-gotab="hero" style="padding:4px 12px">Top banner</button> tab, where you can preview before saving.</p>
    <div class="af">Info line under the banner<p class="note" style="margin:0">Each item is a line of text. Tick to show it. <b>{sizes}</b> becomes your box sizes (like "4, 6 or 12"), <b>{cutoff}</b> your order cutoff time, <b>{closed}</b> your closed days.</p></div>
    ${pg.strip.items.map((it,i)=>`<div class="colin"><span class="sw"><input type="checkbox" data-lp="strip.items.${i}.on" ${it.on?"checked":""} aria-label="Show item ${i+1}"><span></span></span><input class="in" data-lp="strip.items.${i}.t" maxlength="80" value="${esc(it.t)}" aria-label="Info item ${i+1}"><button class="danger" type="button" data-lpsdel="${i}" aria-label="Delete item ${i+1}">×</button></div>`).join("")}
    ${pg.strip.items.length<6?`<button class="ghost" type="button" data-lpsadd style="justify-self:start">+ Add item</button>`:""}`,true)}
  ${sec(`Extra sections (${pg.blocks.length})`,`
    <p class="sub" style="margin:0">Add image, video or text sections above or below the box builder. Use the Marquee banner tab for the running text strip.</p>
    ${pg.blocks.map((b,i)=>`<div class="lpblock"><div class="mo-row"><b>Section ${i+1}</b><div class="colin"><button class="ghost" type="button" data-lpbup="${i}" ${i===0?"disabled":""} aria-label="Move up">↑</button><button class="ghost" type="button" data-lpbdown="${i}" ${i===pg.blocks.length-1?"disabled":""} aria-label="Move down">↓</button><button class="danger" type="button" data-lpbdel="${i}">Delete</button></div></div>
      <div class="grid2"><label class="af">Where<select class="in" data-lp="blocks.${i}.pos"><option value="top" ${b.pos==="top"?"selected":""}>Above "Build your box"</option><option value="bottom" ${b.pos!=="top"?"selected":""}>Below the box builder</option></select></label>
      <label class="af">Layout<select class="in" data-lp="blocks.${i}.layout" data-rr="1"><option value="right" ${b.layout==="right"?"selected":""}>Text left, media right</option><option value="left" ${b.layout==="left"?"selected":""}>Media left, text right</option><option value="full" ${b.layout==="full"?"selected":""}>Media on top, text centered</option><option value="text" ${b.layout==="text"?"selected":""}>Text only</option></select></label></div>
      ${lpIn("Heading",`blocks.${i}.heading`,{max:90})}${lpIn("Text",`blocks.${i}.text`,{rows:3,max:600})}
      ${b.layout!=="text"?lpMedia(`blocks.${i}`,b):""}
      <div class="grid2">${lpIn("Button label (optional)",`blocks.${i}.btnLabel`,{max:30})}${lpIn("Button link (#build, #menu or https://...)",`blocks.${i}.btnLink`,{max:200,ph:"#build"})}</div>
      <div class="grid2">${lpCol("Section background",`blocks.${i}.bg`,"#ffffff",true)}${lpCol("Section text color",`blocks.${i}.color`,"#0B0B45",true)}</div></div>`).join("")}
    ${pg.blocks.length<8?`<button class="btn btn-blue btn-sm" type="button" data-lpbadd style="justify-self:start">+ Add section</button>`:`<p class="note">Maximum of 8 sections.</p>`}`,pg.blocks.length>0)}
  ${sec("Build your box heading",`${lpIn("Heading","build.title",{max:60})}${lpIn("Intro text","build.intro",{rows:3,max:300})}`)}
  ${sec("Come say hello and FAQ",`
    <div class="grid2">${lpIn("Heading","visit.title",{max:60})}${lpIn("FAQ heading","visit.faqTitle",{max:60})}</div>
    ${lpIn("Text","visit.text",{rows:2,max:300})}${lpCol("Section background","visit.bg","#EEF0FF",true)}
    <p class="note">Opening hours and the address are edited in Shop settings. In an answer, <b>{cutoff}</b> becomes your order cutoff time.</p>
    ${pg.faq.map((f,i)=>`<div class="lpblock">${lpIn("Question",`faq.${i}.q`,{max:120})}${lpIn("Answer",`faq.${i}.a`,{rows:3,max:500})}<button class="danger" type="button" data-lpfdel="${i}" style="justify-self:start">Delete question</button></div>`).join("")}
    ${pg.faq.length<8?`<button class="btn btn-blue btn-sm" type="button" data-lpfadd style="justify-self:start">+ Add question</button>`:""}`)}
  ${sec("Footer",`${lpIn("Footer text","footer.text",{max:120})}<div class="grid2">${lpCol("Footer background","footer.bg",pg.brand,true)}${lpCol("Footer text color","footer.color","#ffffff")}</div>`)}
  <div><button class="ghost" type="button" data-lpreset>Reset landing page to default</button></div>
  </div>`;
}
let lpT;function lpSave(){clearTimeout(lpT);lpT=setTimeout(()=>{if(saveDB())toast("Saved");else toast("Not enough storage space. Remove a photo, video or font.")},400)}
async function lpResize(file,MAX){
  if(!/^image\//.test(file.type))throw new Error("That file isn't an image. Use JPG, PNG or WebP.");
  if(file.size>25e6)throw new Error("That image is over 25 MB. Try a smaller one.");
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Couldn't read that image."));i.src=url});
    const k=Math.min(1,MAX/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
    const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});x.imageSmoothingQuality="high";x.drawImage(img,0,0,w,h);
    const px=x.getImageData(0,0,w,h).data;let clear=0;for(let i=3;i<px.length;i+=16)if(px[i]<200)clear++;
    if(clear>(w*h/4)*.02){let o=c.toDataURL("image/webp",.85);if(!o.startsWith("data:image/webp"))o=c.toDataURL("image/png");return o}
    return c.toDataURL("image/jpeg",.82);
  }finally{URL.revokeObjectURL(url)}
}
const readData=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(new Error("Couldn't read that file."));r.readAsDataURL(f)});
function lpTry(path,val,okMsg){const prev=lpGet(path);lpSet(path,val);if(!saveDB()){lpSet(path,prev);toast("Not enough storage space. Remove another photo, video or font first.");return false}if(okMsg)toast(okMsg);return true}
am.addEventListener("input",e=>{
  const el=e.target;
  if(el.dataset.lp&&el.type!=="range"&&el.tagName!=="SELECT"&&el.type!=="checkbox"){lpSet(el.dataset.lp,el.value);lpSave()}
  else if(el.dataset.lpc){const path=el.dataset.lpc,raw=el.value.trim();
    if(raw===""&&el.dataset.lpopt){lpSet(path,"");lpSave();return}
    const v=raw.startsWith("#")?raw:"#"+raw;if(!HEX_OK.test(v))return;const hx=v.toLowerCase();lpSet(path,hx);
    am.querySelectorAll(`[data-lpc="${path}"]`).forEach(o=>{if(o!==el&&o.value.toLowerCase()!==hx)o.value=hx});lpSave()}
});
am.addEventListener("change",async e=>{
  const el=e.target;
  if(el.dataset.lp&&(el.tagName==="SELECT"||el.type==="range"||el.type==="checkbox")){
    const v=el.type==="checkbox"?el.checked:el.dataset.num?+el.value:el.value;lpSet(el.dataset.lp,v);saveDB();toast("Saved");if(el.dataset.rr||el.dataset.lp.endsWith("mediaType"))lpRender();return}
  if(el.dataset.lp&&el.dataset.lp.endsWith(".src")){lpRender();return}
  if(el.dataset.lpimg){const f=el.files[0];if(!f)return;try{const d=await lpResize(f,el.dataset.lpimg==="logo"?240:1600);lpTry(el.dataset.lpimg,d,"Image added")}catch(err){toast(err.message)}lpRender();return}
  if(el.dataset.lpvid){const f=el.files[0];if(!f)return;
    if(f.size>3*1024*1024){toast("That video is over 3 MB. Paste a link to it instead (YouTube, Vimeo or an .mp4 file).");el.value="";return}
    try{lpTry(el.dataset.lpvid,await readData(f),"Video added")}catch(err){toast(err.message)}lpRender();return}
  if(el.dataset.lpfont!==undefined){const f=el.files[0];if(!f)return;const pg=DB.page;
    if(pg.fonts.length>=3){toast("You can keep up to 3 fonts. Remove one first.");return}
    if(f.size>1024*1024){toast("That font is over 1 MB. Use a smaller file or a .woff2 version.");el.value="";return}
    if(!/\.(ttf|otf|woff2?)$/i.test(f.name)){toast("Use a .ttf, .otf, .woff or .woff2 file.");el.value="";return}
    try{const data=await readData(f);await new FontFace("DD-Test",`url(${data})`).load();
      const rec={id:uid(),name:f.name.replace(/\.[^.]+$/,"").slice(0,40),data};pg.fonts.push(rec);
      if(!saveDB()){pg.fonts.pop();toast("Not enough storage space for that font.")}else toast("Font added. Pick it in the font lists.")}
    catch(err){toast("That file isn't a usable font.")}
    lpRender();return}
});
am.addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;const d=b.dataset,pg=DB.page;
  if(d.lpclear){lpSet(d.lpclear,"");saveDB();toast("Cleared");lpRender()}
  else if(d.lpfontrm){pg.fonts=pg.fonts.filter(f=>f.id!==d.lpfontrm);["headFont","bodyFont"].forEach(k=>{if(pg[k]==="f:"+d.lpfontrm)pg[k]=k==="headFont"?"display":"body"});saveDB();toast("Font removed");lpRender()}
  else if(d.lpbadd!==undefined){pg.blocks.push({id:uid(),pos:"bottom",layout:"right",heading:"New section",text:"Write something here.",mediaType:"none",src:"",btnLabel:"",btnLink:"",bg:"",color:""});saveDB();toast("Section added");lpRender()}
  else if(d.lpbdel!==undefined){armed(b,()=>{pg.blocks.splice(+d.lpbdel,1);saveDB();toast("Section deleted");lpRender()})}
  else if(d.lpbup!==undefined||d.lpbdown!==undefined){const i=+(d.lpbup??d.lpbdown),j=d.lpbup!==undefined?i-1:i+1;if(j<0||j>=pg.blocks.length)return;[pg.blocks[i],pg.blocks[j]]=[pg.blocks[j],pg.blocks[i]];saveDB();lpRender()}
  else if(d.lpsadd!==undefined){pg.strip.items.push({t:"New item",on:true});saveDB();lpRender()}
  else if(d.lpsdel!==undefined){pg.strip.items.splice(+d.lpsdel,1);saveDB();lpRender()}
  else if(d.lpfadd!==undefined){pg.faq.push({q:"New question",a:"Your answer."});saveDB();lpRender()}
  else if(d.lpfdel!==undefined){armed(b,()=>{pg.faq.splice(+d.lpfdel,1);saveDB();toast("Question deleted");lpRender()})}
  else if(d.lpreset!==undefined){armed(b,()=>{DB.page=defaultPage();saveDB();toast("Landing page reset");lpRender()})}
});
am.addEventListener("toggle",e=>{const d=e.target;if(d.dataset&&d.dataset.sec)LPOPEN[d.dataset.sec]=d.open},true);

/* --- Complaints (admin) --- */
A.cpFilter="all";A.cpOpen=null;
function viewComplaints(){
  const all=DB.orders.filter(o=>o.complaint).sort((a,b)=>b.complaint.at-a.complaint.at);
  const cnt=k=>k==="all"?all.length:all.filter(o=>o.complaint.status===k).length;
  const rows=all.filter(o=>A.cpFilter==="all"||o.complaint.status===A.cpFilter);
  const scopeTxt=c=>c.scope==="order"?"Whole order":c.items.map(id=>{const p=prod(id);return p?p.name:"Removed flavor"}).join(", ");
  return head("Complaints","Problems customers report within "+DB.settings.complaintWindowH+" hours of delivery or pickup. Customers are asked to keep an uncut unboxing video as proof.")+MOCK+`
  <div class="stack"><section class="panel">
    <div class="chips" style="margin-bottom:12px">${[["all","All"],...Object.entries(CP_STATUS)].map(([k,l])=>`<button class="fchip" type="button" data-cpfilter="${k}" aria-pressed="${A.cpFilter===k}">${l} <i>${cnt(k)}</i></button>`).join("")}</div>
    ${rows.length?`<div class="tablewrap"><table class="t"><thead><tr><th>Order</th><th>Customer</th><th>Problem</th><th>Items</th><th>Status</th></tr></thead><tbody>
    ${rows.map(o=>{const c=o.complaint;return `<tr data-cpopen="${o.id}" style="cursor:pointer"><td><span class="code-c">${esc(o.code)}</span><span class="meta">${fmtAgo(c.at)}</span></td><td>${esc(o.customer.name)}<span class="meta">${esc(o.customer.phone)}</span></td><td><b>${esc(c.reason)}</b><span class="meta">${esc(c.text.slice(0,50))}${c.text.length>50?"…":""}</span></td><td>${esc(scopeTxt(c))}</td><td><span class="mo-chip st-${c.status==="resolved"?"completed":c.status==="rejected"?"cancelled":c.status==="review"?"baking":"awaiting"}">${CP_STATUS[c.status]}</span></td></tr>`}).join("")}
    </tbody></table></div>`:`<div class="empty">No complaints${A.cpFilter==="all"?" yet":" in this view"}.</div>`}
  </section></div>`;
}
function openComplaint(id){
  const o=DB.orders.find(x=>x.id===id);if(!o||!o.complaint)return;
  if(SBH.on&&o.complaint.photoCount>0&&!(o.complaint.photos||[]).length&&!o._ft){o._ft=1;SBH.adminFiles(o).then(()=>openComplaint(id));return}A.cpOpen=id;const c=o.complaint;
  const names=c.scope==="order"?"Whole order":c.items.map(i=>{const p=prod(i);return p?p.name:"Removed flavor"}).join(", ");
  const wa=String(o.customer.phone).replace(/\D/g,"");
  $("#drawer").innerHTML=`<div class="drawer-card" role="dialog" aria-modal="true" aria-label="Complaint for ${esc(o.code)}">
    <div class="sheet-top"><div><h3>${esc(o.code)} complaint</h3><span class="note">Sent ${fmtDT(c.at)}</span></div><button class="x" type="button" data-close aria-label="Close">✕</button></div>
    <div class="dsec"><h4>Problem</h4><dl class="dl"><dt>Type</dt><dd>${esc(c.reason)}</dd><dt>About</dt><dd>${esc(names)}</dd><dt>Delivered</dt><dd>${o.completedAt?fmtDT(o.completedAt):"n/a"}</dd></dl><p style="white-space:pre-line;margin:10px 0 0">${esc(c.text)}</p>
      ${c.photos.length?`<div class="cphotos" style="margin-top:10px">${c.photos.map(src=>`<a href="${esc(imgOk(src))}" target="_blank" rel="noopener"><img src="${esc(imgOk(src))}" alt="Customer photo"></a>`).join("")}</div>`:""}
      <p class="hint" style="margin:10px 0 0">The customer confirmed they have an uncut unboxing video. Ask for it on WhatsApp before you decide.</p></div>
    <div class="dsec"><h4>Customer</h4><dl class="dl"><dt>Name</dt><dd>${esc(o.customer.name)}</dd><dt>WhatsApp</dt><dd>${esc(o.customer.phone)} ${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">Open WhatsApp</a>`:""}</dd><dt>Email</dt><dd>${esc(o.customer.email)}</dd><dt>${modeName(o)}</dt><dd>${fmtDay(o.day)}, ${esc(o.time)}</dd></dl></div>
    <div class="dsec"><h4>Your response</h4><div class="stack" style="gap:10px">
      <label class="af">Status<select class="in" id="cpStatus">${Object.entries(CP_STATUS).map(([k,l])=>`<option value="${k}" ${c.status===k?"selected":""}>${l}</option>`).join("")}</select></label>
      <label class="af">Reply (the customer sees this in My orders)<textarea class="in" id="cpReply" rows="4" maxlength="600" placeholder="e.g. Sorry about that. We'll send a replacement box tomorrow.">${esc(c.reply||"")}</textarea></label>
      <button class="btn btn-blue btn-sm" type="button" data-cpsave style="justify-self:start">Save response</button></div></div>
  </div>`;
  $("#drawer").hidden=false;
}
$("#drawer").addEventListener("click",e=>{
  if(e.target.closest("[data-cpsave]")){const o=DB.orders.find(x=>x.id===A.cpOpen);if(!o||!o.complaint)return;
    o.complaint.status=$("#cpStatus").value;o.complaint.reply=$("#cpReply").value.trim();o.complaint.updatedAt=Date.now();saveDB();toast("Response saved");renderAdmin();openComplaint(o.id)}
});
am.addEventListener("click",e=>{
  const f=e.target.closest("[data-cpfilter]");if(f){A.cpFilter=f.dataset.cpfilter;renderAdmin();return}
  const r=e.target.closest("tr[data-cpopen]");if(r)openComplaint(r.dataset.cpopen);
});

/* --- shipping labels --- */
/* Minimal QR encoder: byte mode, error correction M, versions 1-10 */
function qrEncode(text){
  const ECC=[-1,10,16,26,18,24,16,18,22,22,26],BLK=[-1,1,1,1,2,2,4,4,4,5,5];
  const bytes=[...unescape(encodeURIComponent(text))].map(c=>c.charCodeAt(0));
  const raw=v=>{let r=(16*v+128)*v+64;if(v>=2){const a=Math.floor(v/7)+2;r-=(25*a-10)*a-55;if(v>=7)r-=36}return r};
  let ver=0,cap=0;
  for(let v=1;v<=10;v++){cap=Math.floor(raw(v)/8)-ECC[v]*BLK[v];if(4+(v>=10?16:8)+8*bytes.length<=cap*8){ver=v;break}}
  if(!ver)throw new Error("Text is too long for the QR code");
  const bits=[];const put=(val,n)=>{for(let i=n-1;i>=0;i--)bits.push((val>>>i)&1)};
  put(4,4);put(bytes.length,ver>=10?16:8);bytes.forEach(b=>put(b,8));
  put(0,Math.min(4,cap*8-bits.length));while(bits.length%8)bits.push(0);
  for(let pad=0xEC;bits.length<cap*8;pad^=0xEC^0x11)put(pad,8);
  const data=[];for(let i=0;i<bits.length;i+=8){let b=0;for(let j=0;j<8;j++)b=b<<1|bits[i+j];data.push(b)}
  const mul=(x,y)=>{let z=0;for(let i=7;i>=0;i--){z=(z<<1)^((z>>>7)*0x11D);z^=((y>>>i)&1)*x}return z};
  const gen=d=>{const r=Array(d).fill(0);r[d-1]=1;let root=1;for(let i=0;i<d;i++){for(let j=0;j<d;j++){r[j]=mul(r[j],root);if(j+1<d)r[j]^=r[j+1]}root=mul(root,2)}return r};
  const rs=(blk,g)=>{const rem=Array(g.length).fill(0);blk.forEach(b=>{const f=b^rem.shift();rem.push(0);g.forEach((c,i)=>rem[i]^=mul(c,f))});return rem};
  const nb=BLK[ver],el=ECC[ver],rawCw=Math.floor(raw(ver)/8),nShort=nb-rawCw%nb,shortLen=Math.floor(rawCw/nb),g=gen(el);
  const blocks=[];for(let i=0,k=0;i<nb;i++){const dl=shortLen-el+(i<nShort?0:1);const d=data.slice(k,k+dl);k+=dl;const e=rs(d,g);if(i<nShort)d.push(0);blocks.push(d.concat(e))}
  const all=[];for(let i=0;i<blocks[0].length;i++)blocks.forEach((b,j)=>{if(i!==shortLen-el||j>=nShort)all.push(b[i])});
  const size=ver*4+17,m=Array.from({length:size},()=>Array(size).fill(false)),fn=Array.from({length:size},()=>Array(size).fill(false));
  const set=(x,y,v)=>{m[y][x]=v;fn[y][x]=true};
  for(let i=0;i<size;i++){set(6,i,i%2===0);set(i,6,i%2===0)}
  const finder=(cx,cy)=>{for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy)),x=cx+dx,y=cy+dy;if(x>=0&&x<size&&y>=0&&y<size)set(x,y,d!==2&&d!==4)}};
  finder(3,3);finder(size-4,3);finder(3,size-4);
  if(ver>1){const na=Math.floor(ver/7)+2,step=Math.ceil((ver*4+4)/(na*2-2))*2,pos=[6];for(let p=size-7;pos.length<na;p-=step)pos.splice(1,0,p);
    pos.forEach((cx,i)=>pos.forEach((cy,j)=>{if((i===0&&j===0)||(i===0&&j===na-1)||(i===na-1&&j===0))return;for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)set(cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1)}))}
  const fmt=mask=>{const dd=0<<3|mask;let r=dd;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);const b=((dd<<10)|r)^0x5412,bit=i=>((b>>>i)&1)===1;
    for(let i=0;i<=5;i++)set(8,i,bit(i));set(8,7,bit(6));set(8,8,bit(7));set(7,8,bit(8));for(let i=9;i<15;i++)set(14-i,8,bit(i));
    for(let i=0;i<8;i++)set(size-1-i,8,bit(i));for(let i=8;i<15;i++)set(8,size-15+i,bit(i));set(8,size-8,true)};
  fmt(0);
  if(ver>=7){let r=ver;for(let i=0;i<12;i++)r=(r<<1)^((r>>>11)*0x1F25);const b=ver<<12|r;for(let i=0;i<18;i++){const c=((b>>>i)&1)===1,a=size-11+i%3,bb=Math.floor(i/3);set(a,bb,c);set(bb,a,c)}}
  let k=0;for(let right=size-1;right>=1;right-=2){if(right===6)right=5;for(let vert=0;vert<size;vert++)for(let j=0;j<2;j++){const x=right-j,up=((right+1)&2)===0,y=up?size-1-vert:vert;if(!fn[y][x]&&k<all.length*8){m[y][x]=((all[k>>>3]>>>(7-(k&7)))&1)===1;k++}}}
  const maskFn=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
  const applyMask=mk=>{for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(!fn[y][x]&&maskFn[mk](x,y))m[y][x]=!m[y][x]};
  const penalty=()=>{let p=0;const line=a=>{let run=1;for(let i=1;i<a.length;i++){if(a[i]===a[i-1]){run++;if(run===5)p+=3;else if(run>5)p++}else run=1}
      const s=a.map(v=>v?1:0).join("");for(const pat of ["10111010000","00001011101"]){let i=-1;while((i=s.indexOf(pat,i+1))>=0)p+=40}};
    for(let y=0;y<size;y++)line(m[y]);for(let x=0;x<size;x++)line(m.map(r=>r[x]));
    for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=m[y][x];if(c===m[y][x+1]&&c===m[y+1][x]&&c===m[y+1][x+1])p+=3}
    let dark=0;m.forEach(r=>r.forEach(v=>{if(v)dark++}));p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;return p};
  let best=0,bp=1e9;for(let mk=0;mk<8;mk++){applyMask(mk);fmt(mk);const p=penalty();if(p<bp){bp=p;best=mk}applyMask(mk)}
  applyMask(best);fmt(best);
  return {size,m};
}
function qrSvg(text){const {size,m}=qrEncode(text);let d="";for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(m[y][x])d+=`M${x} ${y}h1v1h-1z`;return `<svg viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges"><path d="${d}" fill="#000"/></svg>`}


const LBL_CSS=`.lbl{width:4in;height:6in;box-sizing:border-box;padding:.17in;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif;display:flex;flex-direction:column;gap:.06in;overflow:hidden;break-after:page;page-break-after:always;text-align:left}
.lbl *{box-sizing:border-box}
.lbl-h{display:flex;align-items:center;gap:8px;border-bottom:3px solid #000;padding-bottom:.05in}
.lbl-h img{max-height:.4in;max-width:1.1in;object-fit:contain;display:block}
.lbl-h b{font-size:19px;font-weight:900;letter-spacing:.02em;text-transform:uppercase;flex:1;line-height:1.05;min-width:0;overflow-wrap:anywhere}
.lbl-h span{font-size:9px;text-align:right;font-weight:700;line-height:1.2}
.lbl-from{font-size:9px;line-height:1.25}.lbl-from small{font-size:8px;font-weight:700;display:block;letter-spacing:.08em}
.lbl-box{border:2px solid #000;padding:.055in .08in}
.lbl-box>small{display:block;font-size:8px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:2px}
.lbl-to{flex:1;min-height:1.2in}
.lbl-to .nm{font-size:20px;font-weight:900;line-height:1.1;overflow-wrap:anywhere}.lbl-to .ph{font-size:13px;font-weight:700;margin-top:2px}.lbl-to .ad{font-size:12px;line-height:1.3;margin-top:3px;overflow-wrap:anywhere}.lbl-to .wh{font-size:10px;font-weight:700;margin-top:5px}
.lbl-awb .no{font-family:"Courier New",monospace;font-size:16px;font-weight:700;letter-spacing:.08em;min-height:18px}
.lbl-items ul{margin:0;padding:0;list-style:none;font-size:11px;line-height:1.3}.lbl-items li b{font-weight:900}
.lbl-note{font-size:10px;font-weight:700;line-height:1.25;white-space:pre-line;overflow-wrap:anywhere}
.lbl-warn{background:#000;color:#fff;text-align:center;padding:.06in .05in;font-weight:900;font-size:13px;line-height:1.25;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.lbl-warn span{display:block;font-size:11px}
.lbl-f{display:flex;justify-content:space-between;align-items:flex-end;gap:10px;margin-top:auto}
.lbl-tot{font-size:16px;font-weight:900;display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.lbl-paid{display:inline-block;border:2px solid #000;padding:1px 8px;font-weight:900;font-size:12px}
.lbl-qr{text-align:center;width:.95in;font-size:7px;line-height:1.1;font-weight:700;flex:none}.lbl-qr svg{width:.82in;height:.82in;display:block;margin:0 auto 2px}`;
document.head.insertAdjacentHTML("beforeend",`<style id="lblCss">${LBL_CSS}
#printArea{display:none}
@media print{body.print-labels>*:not(#printArea){display:none!important}body.print-labels #printArea{display:block}body.print-labels{background:#fff!important;margin:0}}
.lblwrap{overflow:hidden;border:1px solid var(--ice-2);border-radius:10px;background:#fff}
.lblwrap .lbl{transform-origin:top left}
.lbl-unsaved{color:#9A3B00;font-size:13px;font-weight:600}</style>`);
document.body.insertAdjacentHTML("beforeend",'<div id="printArea" aria-hidden="true"></div>');
const PAID_ST=["new","baking","ready","completed"];
function labelHTML(o,L){
  L=L||DB.label;const nm=(DB.page.name||"Delidome").toUpperCase(),del=o.mode==="delivery";
  const items=Object.entries(o.items).map(([id,n])=>{const p=prod(id);return `<li>${n}× ${esc(p?p.name:"Flavor")}</li>`}).join("");
  const ad=(o.addons||[]).map(id=>{const a=DB.addons.find(x=>x.id===id);return a?`<li>+ ${esc(a.name)}</li>`:""}).join("");
  let qr="";if(L.qr&&L.qr.trim()){try{qr=`<div class="lbl-qr">${qrSvg(L.qr.trim())}${esc(L.qrCaption||"")}</div>`}catch(e){qr=""}}
  const paid=PAID_ST.includes(o.status);
  const notes=[L.notes,o.note?`GIFT NOTE: ${o.note}`:""].filter(Boolean).join("\n");
  return `<div class="lbl">
    <div class="lbl-h">${L.logo?`<img src="${esc(L.logo)}" alt="">`:""}<b>${esc(nm)}</b><span>${esc(o.code)}<br>${esc(fmtShort(o.createdAt))}</span></div>
    <div class="lbl-from"><small>FROM</small>${esc(DB.page.name||"Delidome")}<br>${esc(DB.settings.address)}</div>
    <div class="lbl-box lbl-to"><small>${del?"Ship to":"Pickup"}</small><div class="nm">${esc(o.customer.name)}</div><div class="ph">${esc(o.customer.phone)}</div>${del&&o.customer.address?`<div class="ad">${esc(o.customer.address)}</div>`:""}<div class="wh">${del?"DELIVER":"PICK UP"}: ${esc(fmtDay(o.day))} · ${esc(o.time)}</div></div>
    ${del?`<div class="lbl-box lbl-awb"><small>Courier: ${esc(o.courier||"—")} · Airway bill</small><div class="no">${esc(o.awb||"")}</div></div>`:""}
    <div class="lbl-box lbl-items"><small>Items</small><ul><li><b>Box of ${o.size}</b></li>${items}${ad}</ul></div>
    ${notes?`<div class="lbl-note">${esc(notes)}</div>`:""}
    ${L.warnOn&&(L.warn1||L.warn2)?`<div class="lbl-warn">${esc(L.warn1||"")}${L.warn2?`<span>${esc(L.warn2)}</span>`:""}</div>`:""}
    <div class="lbl-f"><div class="lbl-tot">${money(o.total)}<span class="lbl-paid">${paid?"PAID":"UNPAID"}</span></div>${qr}</div></div>`;
}
function sampleOrder(){
  const ps=DB.products.filter(p=>p.status!=="hidden").slice(0,3),items={};ps.forEach((p,i)=>items[p.id]=[2,1,3][i]||1);
  return {code:"DD-SAMPLE",createdAt:Date.now(),customer:{name:"Sample Customer",phone:"0812 3456 7890",address:"Jl. Contoh No. 1, Depok"},mode:"delivery",courier:"JNE",awb:"JP1234567890",size:Object.values(items).reduce((a,b)=>a+b,0),items,addons:[],day:ymd(addDays(today0(),1)),time:DB.settings.times[0]||"10 to 11am",note:"",total:42.5,status:"new"};
}
function labelGate(orders){
  const ok=orders.filter(o=>!o.id||canLabel(o));
  if(ok.length<orders.length)toast(ok.length?"Skipped orders that aren't paid yet.":"Labels can be printed after payment is confirmed.");
  return ok;
}
function markPrinted(orders){const r=orders.filter(o=>o.id);if(!r.length)return;r.forEach(o=>o.labelAt=Date.now());saveDB();if(A.tab==="orders")renderAdmin()}
function printLabels(orders,L){
  orders=labelGate(orders);
  if(!orders.length){return}
  markPrinted(orders);
  $("#printArea").innerHTML=orders.map(o=>labelHTML(o,L)).join("");
  const st=document.createElement("style");st.id="pageStyle";st.textContent="@page{size:4in 6in;margin:0}";document.head.appendChild(st);
  document.body.classList.add("print-labels");
  const done=()=>{document.body.classList.remove("print-labels");st.remove();$("#printArea").innerHTML="";removeEventListener("afterprint",done)};
  addEventListener("afterprint",done);
  try{window.print()}catch(e){done();toast("Printing isn't available here. Use Download labels instead.")}
  setTimeout(()=>{if(document.body.classList.contains("print-labels"))done()},60000);
}
function downloadLabels(orders,L){
  orders=labelGate(orders);
  if(!orders.length){return}
  markPrinted(orders);
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Shipping labels</title><style>@page{size:4in 6in;margin:0}body{margin:0;background:#eee}${LBL_CSS}@media screen{.lbl{margin:12px auto;box-shadow:0 2px 10px rgba(0,0,0,.2)}}@media print{body{background:#fff}.lbl{margin:0}}</style></head><body>${orders.map(o=>labelHTML(o,L)).join("")}<script>onload=function(){setTimeout(function(){print()},400)}<\/script></body></html>`;
  const name=`delidome-labels-${ymd(new Date())}.html`;
  (async()=>{
    let dl=null;try{dl=window.claude&&await window.claude.use("downloads")}catch(e){}
    if(dl){try{await dl.save({filename:name,data:html});toast("Label file saved. Open it to print.")}catch(err){if(err&&err.code!=="declined")toast("Couldn't save the label file here.")}return}
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast("Label file downloaded. Open it to print.");
  })();
}
/* --- printable bake sheet --- */
const BK_CSS=`.bk{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12px;line-height:1.35;padding:0}
.bk h1{font-size:22px;margin:0 0 2px}.bk .bk-sub{color:#444;margin:0 0 10px}
.bk h2{font-size:14px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid #000;padding-bottom:3px}
.bk table{width:100%;border-collapse:collapse}.bk th,.bk td{border:1px solid #888;padding:5px 7px;text-align:left;vertical-align:top}
.bk th{background:#eee;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
.bk td.n{text-align:right;font-weight:700;font-size:15px;width:60px}.bk td.c{width:28px;text-align:center;font-size:16px}
.bk .bk-sum{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}.bk .bk-sum span{border:1px solid #000;border-radius:99px;padding:2px 10px;font-weight:700}
.bk .bk-flag{font-weight:700;border:1px solid #000;padding:0 4px;margin-left:4px;font-size:10px}
.bk tr{break-inside:avoid}`;
function bakeSheetHTML(day){
  const live=DB.orders.filter(o=>o.status!=="cancelled"&&o.status!=="awaiting"&&o.status!=="completed"&&o.day===day).sort((a,b)=>DB.settings.times.indexOf(a.time)-DB.settings.times.indexOf(b.time)||a.createdAt-b.createdAt);
  const agg={};let cookies=0;const bySize={};let pick=0,del=0;
  live.forEach(o=>{Object.entries(o.items).forEach(([id,n])=>{agg[id]=(agg[id]||0)+n;cookies+=n});bySize[o.size]=(bySize[o.size]||0)+1;o.mode==="delivery"?del++:pick++});
  const rows=Object.entries(agg).sort((a,b)=>b[1]-a[1]);
  return `<div class="bk"><h1>Bake sheet · ${esc(fmtDay(day))}</h1><p class="bk-sub">${esc(DB.page.name||"Delidome")} · printed ${esc(fmtDT(Date.now()))}</p>
  <div class="bk-sum"><span>${cookies} cookies</span>${Object.entries(bySize).sort((a,b)=>a[0]-b[0]).map(([n,c])=>`<span>${c} × box of ${n}</span>`).join("")}<span>${pick} pickup</span><span>${del} delivery</span></div>
  <h2>Cookies to bake</h2>
  <table><thead><tr><th></th><th>Flavor</th><th style="text-align:right">Qty</th></tr></thead><tbody>${rows.map(([id,n])=>{const p=prod(id);return `<tr><td class="c">☐</td><td>${esc(p?p.name:"Removed flavor")}</td><td class="n">${n}</td></tr>`}).join("")||`<tr><td colspan="3">Nothing to bake.</td></tr>`}</tbody></table>
  <h2>Orders (${live.length})</h2>
  <table><thead><tr><th></th><th>Order</th><th>Time</th><th>Type</th><th>Box</th><th>Items</th></tr></thead><tbody>${live.map(o=>`<tr><td class="c">☐</td><td><b>${esc(o.code)}</b><br>${esc(o.customer.name)}${o.status==="review"?`<span class="bk-flag">CHECK PAYMENT</span>`:""}</td><td>${esc(o.time)}</td><td>${modeName(o)}</td><td>Box of ${o.size}${o.addons.length?`<br>+ ${o.addons.map(id=>{const a=DB.addons.find(x=>x.id===id);return esc(a?a.name:"Extra")}).join(", ")}`:""}</td><td>${Object.entries(o.items).map(([id,n])=>{const p=prod(id);return `${n} × ${esc(p?p.name:"Removed flavor")}`}).join("<br>")}${o.note?`<br><i>Note: ${esc(o.note)}</i>`:""}</td></tr>`).join("")||`<tr><td colspan="6">No orders.</td></tr>`}</tbody></table></div>`;
}
function printBake(day){
  if(!day){toast("No orders to bake yet");return}
  $("#printArea").innerHTML=`<style>${BK_CSS}</style>`+bakeSheetHTML(day);
  const st=document.createElement("style");st.id="pageStyle";st.textContent="@page{size:A4;margin:12mm}";document.head.appendChild(st);
  document.body.classList.add("print-labels");
  const done=()=>{document.body.classList.remove("print-labels");st.remove();$("#printArea").innerHTML="";removeEventListener("afterprint",done)};
  addEventListener("afterprint",done);
  try{window.print()}catch(e){done();toast("Printing isn't available here. Use Save file instead.")}
  setTimeout(()=>{if(document.body.classList.contains("print-labels"))done()},60000);
}
function downloadBake(day){
  if(!day){toast("No orders to bake yet");return}
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>Bake sheet</title><style>@page{size:A4;margin:12mm}body{margin:16px}${BK_CSS}</style></head><body>${bakeSheetHTML(day)}<script>onload=function(){setTimeout(function(){print()},400)}<\/script></body></html>`;
  const name=`delidome-bake-sheet-${day}.html`;
  (async()=>{
    let dl=null;try{dl=window.claude&&await window.claude.use("downloads")}catch(e){}
    if(dl){try{await dl.save({filename:name,data:html});toast("Bake sheet saved. Open it to print.")}catch(err){if(err&&err.code!=="declined")toast("Couldn't save the file here.")}return}
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([html],{type:"text/html"}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),4000);
    toast("Bake sheet downloaded. Open it to print.");
  })();
}
function fitLabel(){
  const w=$("#lblWrap"),l=w&&w.firstElementChild;if(!w||!l)return;
  const k=Math.min(1,(w.clientWidth-2)/384);l.style.transform=`scale(${k})`;l.style.transformOrigin=k<1?"top left":"top center";l.style.margin=k<1?"0":"0 auto";w.style.height=(576*k+2)+"px";
}
addEventListener("resize",()=>{if(A.tab==="labels")fitLabel()});
function lblOrder(){return A.lblPrev==="sample"?sampleOrder():(DB.orders.find(o=>o.id===A.lblPrev)||sampleOrder())}
function viewLabels(){
  if(!A.lbl)A.lbl={...DB.label};const L=A.lbl;
  const dirty=JSON.stringify(L)!==JSON.stringify(DB.label);
  const recent=DB.orders.slice(0,12);
  return head("Shipping labels","Set up your 4×6 in label, then print it from the Orders tab. Black and white prints best on thermal label printers.")+MOCK+`
  <div class="two">
    <section class="panel"><div class="stack" style="gap:16px">
      <div class="af">Label logo<div class="colin" style="flex-wrap:wrap"><label class="ghost mqbtn">${L.logo?"Replace logo":"Choose logo"}<input type="file" accept="image/*" hidden data-lbllogo></label>${L.logo?`<img class="lpthumb" style="max-height:44px;max-width:120px;background:#fff" src="${esc(L.logo)}" alt="Label logo"><button class="danger" type="button" data-lbllogorm>Remove</button>`:""}</div><p class="note" style="margin:0">Black-and-white logos print best. Shown at the top-left of the label.</p></div>
      <div class="af">QR code (bottom right)<input class="in" data-lbl="qr" maxlength="200" value="${esc(L.qr)}" placeholder="Link or text, e.g. https://wa.me/628123456789"><input class="in" data-lbl="qrCaption" maxlength="40" value="${esc(L.qrCaption)}" placeholder="Caption under the QR (e.g. Scan to chat with us)" style="margin-top:8px"><p class="note" style="margin:6px 0 0">Leave the link empty to hide the QR code.</p></div>
      <label class="af">Notes printed on every label<textarea class="in" rows="3" data-lbl="notes" maxlength="200" placeholder="e.g. Thank you for ordering!">${esc(L.notes)}</textarea></label>
      <label class="af" style="display:flex;flex-direction:row;align-items:center;gap:10px;font-size:14px;color:var(--ink)"><span class="sw"><input type="checkbox" data-lbl="warnOn" ${L.warnOn?"checked":""}><span></span></span> Show the black warning box on the label</label>
      <div class="af">Warning box text (leave line 2 empty to print only one line)<input class="in" data-lbl="warn1" maxlength="40" value="${esc(L.warn1)}" aria-label="Warning line 1"><input class="in" data-lbl="warn2" maxlength="40" value="${esc(L.warn2)}" aria-label="Warning line 2" style="margin-top:8px"></div>
      <button class="ghost" type="button" data-lblreset>Reset to default text</button>
      <div class="colin" style="flex-wrap:wrap;gap:12px"><button class="btn btn-blue" type="button" data-lblsave>Save label settings</button>${dirty?`<span class="lbl-unsaved">Unsaved changes</span>`:""}</div>
    </div></section>
    <section class="panel"><div class="phead"><div><h2>Preview (4×6 in)</h2></div></div>
      <label class="af" style="margin-bottom:12px">Preview with<select class="in" data-lblprev><option value="sample" ${A.lblPrev==="sample"?"selected":""}>Sample order</option>${recent.map(o=>`<option value="${o.id}" ${A.lblPrev===o.id?"selected":""}>${esc(o.code)} · ${esc(o.customer.name)}</option>`).join("")}</select></label>
      <div class="lblwrap" id="lblWrap">${labelHTML(lblOrder(),L)}</div>
      <div class="colin" style="margin-top:12px;flex-wrap:wrap"><button class="ghost" type="button" data-lblprint>Print this label</button><button class="ghost" type="button" data-lbldl>Download label file</button></div>
      <p class="note">To print many at once, tick orders in the Orders tab and press "Print labels". If the print window doesn't open in this viewer, use "Download label file" and open it to print.</p>
    </section>
  </div>`;
}
function lblRefresh(){const w=$("#lblWrap");if(!w)return;w.innerHTML=labelHTML(lblOrder(),A.lbl);fitLabel();
  const d=JSON.stringify(A.lbl)!==JSON.stringify(DB.label);let u=document.querySelector(".lbl-unsaved");
  if(d&&!u){const b=document.querySelector("[data-lblsave]");b&&b.insertAdjacentHTML("afterend",'<span class="lbl-unsaved">Unsaved changes</span>')}else if(!d&&u)u.remove()}
async function lblLogo(file){
  if(!/^image\//.test(file.type))throw new Error("That file isn't an image.");
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error("Couldn't read that image."));i.src=url});
    const k=Math.min(1,300/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*k)),h=Math.max(1,Math.round(img.naturalHeight*k));
    const c=document.createElement("canvas");c.width=w;c.height=h;const x=c.getContext("2d",{willReadFrequently:true});x.fillStyle="#fff";x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);
    const d=x.getImageData(0,0,w,h),px=d.data;for(let i=0;i<px.length;i+=4){const g=.299*px[i]+.587*px[i+1]+.114*px[i+2],v=g<140?0:g>215?255:g;px[i]=px[i+1]=px[i+2]=v}x.putImageData(d,0,0);
    return c.toDataURL("image/png");
  }finally{URL.revokeObjectURL(url)}
}
am.addEventListener("input",e=>{const el=e.target;
  if(el.dataset.lbl&&el.type!=="checkbox"&&A.lbl){A.lbl[el.dataset.lbl]=el.value;lblRefresh()}
  else if(el.dataset.sel!==undefined){}
});
am.addEventListener("change",async e=>{const el=e.target;
  if(el.dataset.lbl&&el.type==="checkbox"&&A.lbl){A.lbl[el.dataset.lbl]=el.checked;lblRefresh();return}
  if(el.dataset.lblprev!==undefined){A.lblPrev=el.value;lblRefresh();return}
  if(el.dataset.lbllogo!==undefined){const f=el.files[0];if(!f)return;try{A.lbl.logo=await lblLogo(f);renderAdmin();fitLabel()}catch(err){toast(err.message)}return}
  if(el.dataset.sel!==undefined){el.checked?A.sel.add(el.dataset.sel):A.sel.delete(el.dataset.sel);const b=document.querySelector("[data-printsel]");if(b){b.textContent=`Print labels (${A.sel.size})`;b.disabled=!A.sel.size}return}
  if(el.dataset.selall!==undefined){document.querySelectorAll("[data-sel]").forEach(c=>{c.checked=el.checked;el.checked?A.sel.add(c.dataset.sel):A.sel.delete(c.dataset.sel)});const b=document.querySelector("[data-printsel]");if(b){b.textContent=`Print labels (${A.sel.size})`;b.disabled=!A.sel.size}}
});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.lbllogorm!==undefined){A.lbl.logo="";renderAdmin();fitLabel()}
  else if(d.lblreset!==undefined){const df=defaultLabel();A.lbl.notes=df.notes;A.lbl.warn1=df.warn1;A.lbl.warn2=df.warn2;A.lbl.warnOn=true;renderAdmin();fitLabel();toast("Default text restored. Save to keep it.")}
  else if(d.lblsave!==undefined){const prev=DB.label;DB.label={...A.lbl};if(!saveDB()){DB.label=prev;toast("Not enough storage space. Try a smaller logo.")}else{toast("Label settings saved");renderAdmin();fitLabel()}}
  else if(d.lblprint!==undefined)printLabels([lblOrder()],A.lbl);
  else if(d.lbldl!==undefined)downloadLabels([lblOrder()],A.lbl);
});
$("#drawer").addEventListener("input",e=>{const el=e.target;if(el.dataset.ship&&A.openOrder){const o=DB.orders.find(x=>x.id===A.openOrder);if(o){o[el.dataset.ship]=el.value;saveSoon()}}});
$("#drawer").addEventListener("click",e=>{const b=e.target.closest("[data-printone]");if(b){const o=DB.orders.find(x=>x.id===b.dataset.printone);if(o)printLabels([o],DB.label)}});
am.addEventListener("dragover",e=>{const t=e.target.closest("[data-drop]");if(!t)return;e.preventDefault();t.classList.add("drag")});
am.addEventListener("dragleave",e=>{const t=e.target.closest("[data-drop]");if(t&&!t.contains(e.relatedTarget))t.classList.remove("drag")});
am.addEventListener("drop",e=>{const t=e.target.closest("[data-drop]");if(!t)return;e.preventDefault();t.classList.remove("drag");const f=e.dataTransfer.files[0];if(f)uploadPhoto(t.dataset.drop,f,t.querySelector(".upl"))});
am.addEventListener("submit",e=>{if(e.target.id==="saleForm"){e.preventDefault();createSale()}});
$("#anav").addEventListener("click",e=>{const b=e.target.closest("[data-tab]");if(b){A.tab=b.dataset.tab;closeDrawer();renderAdmin();if(matchMedia("(max-width:860px)").matches){const m=$("#amain");window.scrollTo(0,Math.max(0,m.getBoundingClientRect().top+window.scrollY-8))}else window.scrollTo(0,0)}});
$("#drawer").addEventListener("click",e=>{
  if(e.target.id==="drawer"||e.target.closest("[data-close]")){closeDrawer();return}
  const b=e.target.closest("[data-set-status]");if(b){const oo=DB.orders.find(x=>x.id===A.openOrder);if(oo&&b.dataset.setStatus==="review"&&oo.status==="review"){openCheckPay(oo.id);return}setOrderStatus(A.openOrder,b.dataset.setStatus);return}
  const o=DB.orders.find(x=>x.id===A.openOrder);if(!o)return;
  if(e.target.closest("[data-cpgo]")){openComplaint(o.id);return}
  if(e.target.closest("[data-rapprove-d]")){setOrderStatus(o.id,"awaiting",{reject:true,reason:(o.rejReq&&o.rejReq.reason)||""});return}
  if(e.target.closest("[data-rdeny-d]")){SBH.patchOrder(o.id,{rejReqReject:true}).then(()=>{toast("Kept. The order stays at Check payment.");renderAdmin();openOrder(o.id)}).catch(x=>toast(x.message));return}
  if(e.target.closest("[data-pay-ok],[data-pay-manual]"))setOrderStatus(o.id,"new");
  else if(e.target.closest("[data-pay-no]")){const r=($("#rejReason")||{}).value||"";setOrderStatus(o.id,"awaiting",{reject:true,reason:r.trim()})}
});

$("#modal").addEventListener("click",e=>{
  if((e.target.id==="modal"&&A.modal==="cats")||e.target.closest("[data-mclose]")){closeModal();return}
  const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.npremove!==undefined){A.np.img=null;A.np.cutout=false;A.np.tints=null;if(A.np.art==="photo")A.np.art=A.np.defArt;refreshNp()}
  else if(d.catadd!==undefined)addCat();
  else if(d.rvadd!==undefined)addAdminReview();
  else if(d.rvdel){armed(b,()=>{const p=prod(A.rvPid);p.reviews=p.reviews.filter(r=>r.id!==d.rvdel);saveDB();toast("Review deleted");renderAdminReviews();renderAdmin()})}
  else if(d.catdel){armed(b,()=>needOwner("delete a category").then(()=>{const id=d.catdel;DB.products.forEach(p=>{if(p.cat===id)p.cat=""});DB.categories=DB.categories.filter(c=>c.id!==id);if(A.pcat===id)A.pcat="all";saveDB();toast("Category deleted");renderCats();renderAdmin()}).catch(()=>{}))}
});
$("#modal").addEventListener("submit",e=>{if(e.target.id==="npForm"){e.preventDefault();saveNewFlavor()}});
$("#modal").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.id==="newCatName"){e.preventDefault();addCat()}});
$("#modal").addEventListener("change",async e=>{
  const el=e.target;
  if(el.id==="npCat"){$("#npNewCatWrap").hidden=el.value!=="__new";if(el.value==="__new")$("#npNewCat").focus();return}
  if(el.id==="npArt"){A.np.art=el.value;$("#npPrev").innerHTML=plateHTML(npProduct());return}
  if(el.id==="npTrack"){$("#npStockWrap").hidden=!el.checked;return}
  if(el.id==="npFile"){
    const f=el.files[0];if(!f)return;const lbl=el.closest(".upl");lbl.classList.add("busy");
    try{const r=await processImage(f);Object.assign(A.np,{img:r.img,cutout:r.cutout,tints:r.tints,art:"photo"});refreshNp();$("#npErr").hidden=true}
    catch(err){$("#npErr").textContent=err.message;$("#npErr").hidden=false}
    lbl.classList.remove("busy");el.value="";return;
  }
  if(el.dataset.rv){
    const box=el.closest("[data-rid]"),p=prod(A.rvPid),r=p&&p.reviews.find(x=>x.id===box.dataset.rid);if(!r)return;
    const f=el.dataset.rv;let v=el.value.trim();
    if(f==="stars")v=+el.value;
    else if(f==="text"?v.length<3:!v){el.value=r[f];toast(f==="text"?"The review can't be empty":"Username can't be empty");return}
    r[f]=v;saveDB();toast("Saved");$("#rvSum").innerHTML=rvSummary(p);renderAdmin();return;
  }
  if(el.dataset.catname){
    const c=DB.categories.find(x=>x.id===el.dataset.catname),v=el.value.trim(),err=$("#catErr");if(!c)return;
    if(!v){el.value=c.name;return}
    if(DB.categories.some(x=>x.id!==c.id&&x.name.toLowerCase()===v.toLowerCase())){el.value=c.name;err.textContent=`There's already a category called "${v}".`;err.hidden=false;return}
    err.hidden=true;c.name=v;saveDB();toast("Saved");renderAdmin();
  }
});

/* --- Badges (owner): design them, preview, save --- */
const BD={edit:null};
function bdSample(b){return `<div class="bdsample"><div class="pwrap">${plateHTML(DB.products.find(p=>p.status!=="hidden")||DB.products[0]||{id:"x",art:"bb"})}<div class="bdgs">${badgeHTML(b)}</div></div></div>`}
function viewBadges(){
  const B=DB.badges,E=BD.edit,sold=soldMap(),best=bestIds();
  const used=id=>DB.products.filter(p=>(p.badges||[]).includes(id)).length+(id==="best"?best.filter(x=>!(prod(x).badges||[]).includes("best")).length:0);
  const form=E?`<section class="panel"><h2>${E.isNew?"New badge":"Edit badge"}</h2><p class="sub">Nothing changes in the shop until you tap Save badge.</p>
    <div class="bdprev" id="bdPrev">${bdSample(E)}<div class="bdprev-big">${badgeHTML(E)}</div></div>
    <div class="grid2" style="margin-top:12px"><label class="af">Text (emoji welcome)<input class="in" id="bdText" maxlength="24" value="${esc(E.text)}" placeholder="🔥 Best seller"></label>
      <label class="af">Font<select class="in" id="bdFont">${Object.entries(BADGE_FONTS).map(([k,[l]])=>`<option value="${k}" ${E.font===k?"selected":""}>${l}</option>`).join("")}</select></label></div>
    <div class="grid3" style="margin-top:10px"><label class="af">Text colour<input type="color" id="bdColor" value="${E.color}"></label>
      <label class="af">Badge colour<input type="color" id="bdBg" value="${E.bg}"></label>
      <label class="af">Lively effect<select class="in" id="bdFx">${Object.entries(BADGE_FX).map(([k,l])=>`<option value="${k}" ${E.fx===k?"selected":""}>${l}</option>`).join("")}</select></label></div>
    <p class="err" id="bdErr" hidden></p>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-blue" type="button" data-bdsave>Save badge</button><button class="btn btn-ghost-blue" type="button" data-bdcancel>Cancel</button></div></section>`:"";
  return head("Badges","Small, eye-catching labels on flavor photos in the shop. Give flavors a badge from the Flavors tab.")+MOCK+`<div class="stack">${form}
    <section class="panel"><div class="phead"><div><h2>Your badges</h2><p class="sub">Up to 2 badges show on each flavor.</p></div>${E?"":`<button class="btn btn-blue btn-sm" type="button" data-bdnew>+ New badge</button>`}</div>
      <div style="display:grid;gap:10px;margin-top:10px">${B.list.length?B.list.map(b=>`<div class="pmcard bdrow"><div>${badgeHTML(b)}</div><span class="note" style="margin:0">${used(b.id)} flavor${used(b.id)===1?"":"s"}${b.id==="best"&&B.autoBest?" · automatic":""}</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="ghost" type="button" data-bdedit="${esc(b.id)}">Edit</button><button class="danger" type="button" data-bddel="${esc(b.id)}">Delete</button></div></div>`).join(""):`<div class="empty">No badges. Tap + New badge.</div>`}</div></section>
    <section class="panel"><h2>Best sellers</h2>
      <div style="display:flex;gap:10px;align-items:center;margin-top:10px"><label class="sw"><input type="checkbox" data-bdset="autoBest" ${B.autoBest?"checked":""}><span></span></label><span class="stlabel"><b>Give the "best" badge automatically</b><br><small style="color:var(--muted)">To the flavors bought most in the last 90 days.${B.list.some(x=>x.id==="best")?"":" (Needs a badge with the id \"best\": reset badges to get it back.)"}</small></span></div>
      <label class="af" style="max-width:260px;margin-top:10px">How many top flavors<input class="in" type="number" min="1" max="10" step="1" data-bdset="bestTop" value="${B.bestTop}"></label>
      <p class="note">Now: ${best.length?best.map(id=>`${esc(prod(id).name)} (${sold[id]})`).join(", "):"no paid orders yet"}</p></section>
    <section class="panel"><h2>Menu order in the shop</h2>
      <label class="af" style="max-width:420px;margin-top:8px">Sort flavors<select class="in" data-bdset="menuSort"><option value="popular" ${DB.settings.menuSort==="popular"?"selected":""}>Most picked first (out of stock always last)</option><option value="manual" ${DB.settings.menuSort==="manual"?"selected":""}>My order from the Flavors tab (out of stock always last)</option></select></label></section>
    <div><button class="danger" type="button" data-bdreset>Reset badges to the starter set</button></div></div>`;
}
function bdRead(){const E=BD.edit;if(!E)return;const v=id=>{const el=$("#"+id);return el?el.value:""};
  E.text=v("bdText");E.font=v("bdFont")||E.font;E.color=HEX6.test(v("bdColor"))?v("bdColor"):E.color;E.bg=HEX6.test(v("bdBg"))?v("bdBg"):E.bg;E.fx=v("bdFx")||E.fx;
  const pv=$("#bdPrev");if(pv)pv.innerHTML=bdSample(E)+`<div class="bdprev-big">${badgeHTML(E)}</div>`}
am.addEventListener("input",e=>{if(A.tab==="badges"&&/^bd/.test(e.target.id||""))bdRead()});
am.addEventListener("change",e=>{const el=e.target;if(A.tab!=="badges")return;if(/^bd/.test(el.id||""))return bdRead();
  const k=el.dataset.bdset;if(!k)return;
  if(k==="autoBest")DB.badges.autoBest=el.checked;
  else if(k==="bestTop")DB.badges.bestTop=Math.max(1,Math.min(10,Math.round(+el.value)||3));
  else if(k==="menuSort")DB.settings.menuSort=el.value==="manual"?"manual":"popular";
  saveDB();toast("Saved");renderAdmin()});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||A.tab!=="badges")return;const d=b.dataset;
  if(d.bdnew!==undefined){BD.edit={isNew:true,id:"b"+uid().slice(0,6),text:"⭐ Chef's pick",font:"display",color:"#FFFFFF",bg:"#000096",fx:"shine"};renderAdmin();scrollTo(0,0)}
  else if(d.bdedit){const x=DB.badges.list.find(y=>y.id===d.bdedit);if(x){BD.edit=Object.assign({},x);renderAdmin();scrollTo(0,0)}}
  else if(d.bdcancel!==undefined){BD.edit=null;renderAdmin()}
  else if(d.bdsave!==undefined){bdRead();const E=BD.edit,t=String(E.text||"").trim();
    if(!t){const er=$("#bdErr");er.textContent="Type the badge text.";er.hidden=false;return}
    const row={id:E.id,text:t.slice(0,24),font:BADGE_FONTS[E.font]?E.font:"display",color:E.color,bg:E.bg,fx:BADGE_FX[E.fx]?E.fx:"shine"};
    const i=DB.badges.list.findIndex(x=>x.id===E.id);if(i>=0)DB.badges.list[i]=row;else DB.badges.list.push(row);
    BD.edit=null;saveDB();renderAdmin();toast("Badge saved")}
  else if(d.bddel){armed(b,()=>{const id=d.bddel;DB.badges.list=DB.badges.list.filter(x=>x.id!==id);DB.products.forEach(p=>{if(p.badges){p.badges=p.badges.filter(x=>x!==id);if(!p.badges.length)delete p.badges}});if(BD.edit&&BD.edit.id===id)BD.edit=null;saveDB();renderAdmin();toast("Badge deleted")})}
  else if(d.bdreset!==undefined){armed(b,()=>{const keep=DB.badges;DB.badges=Object.assign(defaultBadges(),{autoBest:keep.autoBest,bestTop:keep.bestTop});const ids=DB.badges.list.map(x=>x.id);DB.products.forEach(p=>{if(p.badges){p.badges=p.badges.filter(x=>ids.includes(x));if(!p.badges.length)delete p.badges}});BD.edit=null;saveDB();renderAdmin();toast("Badges reset")})}
});

/* --- every colour picker also gets a hex code box (type #RRGGBB or pick) --- */
function hexify(){
  document.querySelectorAll('#adminView input[type=color]:not([data-hexed]),#modal input[type=color]:not([data-hexed])').forEach(c=>{
    c.dataset.hexed="1";
    const par=c.parentElement;
    if(par&&(par.classList.contains("colin")||par.classList.contains("bgcol"))&&par.querySelector("input.in"))return; // already has one
    const wrap=document.createElement("span");wrap.className="hexwrap";
    c.parentNode.insertBefore(wrap,c);wrap.appendChild(c);
    const t=document.createElement("input");
    Object.assign(t,{className:"in hexin",maxLength:7,value:c.value.toUpperCase(),placeholder:"#000000",spellcheck:false,autocomplete:"off"});
    t.setAttribute("aria-label","Hex colour code");t.setAttribute("inputmode","text");
    wrap.appendChild(t);
    const sync=()=>{if(document.activeElement!==t){t.value=c.value.toUpperCase();t.classList.remove("bad")}};
    c.addEventListener("input",sync);c.addEventListener("change",sync);
    t.addEventListener("input",e=>{e.stopPropagation();
      let v=t.value.trim();if(v&&v[0]!=="#")v="#"+v;
      if(/^#[0-9a-f]{3}$/i.test(v))v="#"+v.slice(1).split("").map(x=>x+x).join("");
      const good=HEX6.test(v);t.classList.toggle("bad",t.value.trim()!==""&&!good&&t.value.trim().replace("#","").length>=6);
      if(good&&c.value.toLowerCase()!==v.toLowerCase()){c.value=v.toLowerCase();c.dispatchEvent(new Event("input",{bubbles:true}));c.dispatchEvent(new Event("change",{bubbles:true}))}});
    t.addEventListener("change",e=>{e.stopPropagation();sync()});
    t.addEventListener("blur",()=>{if(!HEX6.test(t.value.trim().replace(/^([^#])/,"#$1"))){t.value=c.value.toUpperCase();t.classList.remove("bad")}});
  });
}
new MutationObserver(()=>hexify()).observe(document.body,{childList:true,subtree:true});

/* --- Customers + team --- */
const ROLE=()=>SBH.on?(SBH.role||"owner"):"owner";
const PERMS=[["dashboard","Dashboard","sales numbers (visitor numbers are for owners only)"],["orders","Orders","confirm payments, change status, edit orders"],["complaints","Complaints","reply and resolve"],
  ["customers","Customers","see, add and edit"],["labels","Shipping labels","print labels"],["products","Flavors & stock","edit flavors and stock (prices need the owner password)"],
  ["badges","Badges","design badges"],["boxes","Boxes & extras","sizes and extras (prices need the owner password)"],["sales","Flash sales",""],["coupons","Coupons",""],
  ["notify","Notifications","messages to all customers"],["design","Shop look","top banner, landing page, marquee, announcer"],["settings","Shop settings","settings and payment methods"]];
const PERM_PRESETS={Cashier:["orders","complaints","customers","labels"],Packer:["orders","labels"],Baker:["orders","products"],Manager:PERMS.map(p=>p[0]).filter(k=>k!=="settings")};
const TAB_PERM={dashboard:"dashboard",orders:"orders",complaints:"complaints",customers:"customers",labels:"labels",products:"products",badges:"badges",boxes:"boxes",
  sales:"sales",coupons:"coupons",notify:"notify",announcer:"design",hero:"design",landing:"design",marquee:"design",settings:"settings"};
const myPerms=()=>SBH.on?(SBH.perms||[]):PERMS.map(p=>p[0]);
const tabAllowed=t=>ROLE()==="owner"||(TAB_PERM[t]&&myPerms().includes(TAB_PERM[t]));
const CU={list:null,q:"",form:null,err:"",loading:false,stale:false};
const TM={list:null,err:"",loading:false};
function demoCustomers(){   // demo mode only: customers come from this browser's orders + the ones added by hand
  const m=new Map();
  (DB.customers||[]).forEach(c=>m.set(normPhone(c.phone),Object.assign({},c)));
  DB.orders.forEach(o=>{const k=normPhone(o.customer.phone);if(k&&!m.has(k))m.set(k,{id:"o"+k,name:o.customer.name,phone:o.customer.phone,email:o.customer.email||"",note:"",source:"order",createdAt:o.createdAt||0})});
  return [...m.values()].map(c=>{const os=DB.orders.filter(o=>normPhone(o.customer.phone)===normPhone(c.phone));
    return Object.assign({},c,{orders:os.length,spent:os.filter(o=>PAID_ST.includes(o.status)).reduce((a,o)=>a+(o.total||0)-((o.refund&&o.refund.amount)||0),0),lastOrder:os.reduce((a,o)=>Math.max(a,o.createdAt||0),0)||null})}).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
}
async function loadCustomers(){
  if(!SBH.on){CU.list=demoCustomers();CU.stale=false;return renderAdmin()}
  if(CU.loading)return;CU.loading=true;CU.stale=false;
  try{CU.list=await SBH.rpc("admin_customers",{});CU.err=""}catch(e){CU.err=e.message;if(CU.list===null)CU.list=[]}
  CU.loading=false;if(A.tab==="customers"&&!A.modal)renderAdmin();
}
function cuRows(){
  const q=CU.q.trim().toLowerCase(),qd=q.replace(/\D/g,"");
  const l=(CU.list||[]).filter(c=>!q||c.name.toLowerCase().includes(q)||(qd&&normPhone(c.phone).includes(normPhone(qd)))||String(c.email||"").toLowerCase().includes(q));
  if(!l.length)return `<div class="empty">${(CU.list||[]).length?"No customer matches that.":"No customers yet. They are added automatically when someone orders, or you can add one above."}</div>`;
  return l.map(c=>`<div class="pmcard" style="gap:6px"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><b style="font-size:16px">${esc(c.name)}</b>
    <span class="note" style="margin:0">${c.source==="manual"?"Added by hand":"From an order"}${c.orders?` · ${c.orders} order${c.orders>1?"s":""}`:""}${c.spent>0?` · ${money(c.spent)} paid`:""}</span></div>
    <div><a href="${esc(waLink({customer:{phone:c.phone}},""))}" target="_blank" rel="noopener">${esc(c.phone)}</a>${c.email?` · ${esc(c.email)}`:""}</div>
    ${c.note?`<div class="note" style="margin:0">${esc(c.note)}</div>`:""}
    <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="ghost" type="button" data-cuedit="${esc(c.id)}">Edit</button>${ROLE()==="owner"?`<button class="danger" type="button" data-cudel="${esc(c.id)}">Delete</button>`:""}</div></div>`).join("");
}
function viewCustomers(){
  const F=CU.form||{name:"",phone:"",email:"",note:""};
  return head("Customers","Everyone who ordered is saved here automatically (one entry per WhatsApp number). You can also add a customer yourself.")+MOCK+`<div class="stack">
    <section class="panel"><h2>${F.id?"Edit customer":"Add a customer"}</h2>
      <div class="grid2" style="margin-top:10px"><label class="af">Full name<input class="in" id="cuName" maxlength="80" value="${esc(F.name)}" autocomplete="off"></label>
        <label class="af">WhatsApp number<input class="in" id="cuPhone" type="tel" inputmode="tel" maxlength="24" value="${esc(F.phone)}" placeholder="0812 3456 7890" autocomplete="off"></label></div>
      <div class="grid2" style="margin-top:10px"><label class="af">Email (optional)<input class="in" id="cuEmail" type="email" maxlength="120" value="${esc(F.email)}" autocomplete="off"></label>
        <label class="af">Note (optional)<input class="in" id="cuNote" maxlength="500" value="${esc(F.note)}" autocomplete="off"></label></div>
      <p class="err" id="cuErr" ${CU.err?"":"hidden"}>${esc(CU.err)}</p>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-blue" type="button" data-cusave>${F.id?"Save changes":"Add customer"}</button>${F.id?`<button class="btn btn-ghost-blue" type="button" data-cucancel>Cancel</button>`:""}</div></section>
    <section class="panel"><div class="phead"><div><h2>All customers${CU.list?` (${CU.list.length})`:""}</h2></div></div>
      <label class="af" style="margin-top:8px">Search<input class="in" id="cuSearch" type="search" placeholder="Name, number or email" value="${esc(CU.q)}" autocomplete="off"></label>
      <div id="cuList" style="margin-top:10px;display:grid;gap:10px">${CU.list===null?`<div class="empty">Loading…</div>`:cuRows()}</div></section></div>`;
}
function cuErr(m){CU.err=m;const e=$("#cuErr");if(e){e.textContent=m;e.hidden=!m}}
async function cuSave(){
  const v=id=>$("#"+id).value.trim(),f={id:CU.form&&CU.form.id||undefined,name:v("cuName"),phone:v("cuPhone"),email:v("cuEmail"),note:v("cuNote")};
  CU.form=Object.assign({},CU.form,f);cuErr("");
  if(f.name.length<2)return cuErr("Please enter the customer's full name.");
  const n=normPhone(f.phone).length;if(n<7||n>14||!/^[0-9+()\s.-]{6,24}$/.test(f.phone))return cuErr("Please enter a valid WhatsApp number.");
  if(f.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email))return cuErr("That email address doesn't look right.");
  try{
    if(SBH.on)CU.list=await SBH.rpc("admin_customer_save",{p:f});
    else{
      const dup=demoCustomers().find(c=>normPhone(c.phone)===normPhone(f.phone)&&c.id!==f.id);if(dup)return cuErr("This WhatsApp number is already saved for "+dup.name+".");
      const row={id:f.id&&!/^o\d/.test(f.id)?f.id:uid(),name:f.name,phone:f.phone,email:f.email,note:f.note,source:"manual",createdAt:Date.now()};
      const i=DB.customers.findIndex(c=>c.id===f.id||normPhone(c.phone)===normPhone(f.phone));if(i>=0)DB.customers[i]=Object.assign({},DB.customers[i],row,{createdAt:DB.customers[i].createdAt});else DB.customers.unshift(row);
      saveDB();CU.list=demoCustomers();
    }
    CU.form=null;CU.err="";renderAdmin();toast("Customer saved");
  }catch(e){cuErr(e.message)}
}
async function loadTeam(){
  if(!SBH.on){TM.list=[];return renderAdmin()}
  if(TM.loading)return;TM.loading=true;
  try{TM.list=await SBH.rpc("admin_team_list",{});TM.err=""}catch(e){TM.err=e.message;if(TM.list===null)TM.list=[]}
  TM.loading=false;if(A.tab==="team"&&!A.modal)renderAdmin();
}
const TEAM_DOMAIN="team.delidome.local";
const permChips=m=>m.role==="owner"?`<span class="pchip own">Everything</span>`:((m.perms||[]).length?(m.perms||[]).map(k=>{const p=PERMS.find(x=>x[0]===k);return p?`<span class="pchip">${esc(p[1])}</span>`:""}).join(""):`<span class="pchip none">No access yet</span>`);
function tmFormHTML(){const F=TM.form,isNew=F.mode==="new";
  return `<section class="panel" id="tmForm"><h2>${isNew?"Add a team member":"Change "+esc(F.name||F.username||F.email)}</h2>
    ${isNew?`<p class="sub">They sign in on this team site with the username and password you set here. No email needed.</p>`:""}
    <div class="grid2" style="margin-top:10px"><label class="af">Name<input class="in" id="tmName" maxlength="80" value="${esc(F.name)}" autocomplete="off" placeholder="e.g. Sari"></label>
      <label class="af">Role name<input class="in" id="tmTitle" maxlength="40" value="${esc(F.title)}" list="tmTitles" autocomplete="off" placeholder="e.g. Cashier, Packer, Baker"><datalist id="tmTitles">${Object.keys(PERM_PRESETS).map(k=>`<option value="${k}">`).join("")}</datalist></label></div>
    ${isNew?`<div class="grid2" style="margin-top:10px"><label class="af">Username (to sign in)<input class="in" id="tmUser" maxlength="30" value="${esc(F.username)}" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="e.g. sari"></label>
      <label class="af">Password (8+ characters)<span class="pwrow"><input class="in" id="tmPass" type="password" maxlength="72" autocomplete="new-password" value="${esc(F.password)}"><button class="ghost" type="button" data-tmshow>Show</button></span></label></div>`
      :`<p class="note" style="margin:8px 0 0">Signs in as <b>${esc(F.username||F.email)}</b></p>`}
    <div class="seg" role="group" aria-label="Access level" style="margin-top:12px"><button type="button" data-tmlevel="staff" aria-pressed="${F.role!=="owner"}">Staff: pick what they can do</button><button type="button" data-tmlevel="owner" aria-pressed="${F.role==="owner"}">Owner: everything</button></div>
    ${F.role==="owner"?`<p class="note">Owners can do everything, including the team, the activity log and prices.</p>`:`
      <div class="tmpresets"><span class="lblx">Quick pick:</span>${Object.keys(PERM_PRESETS).map(k=>`<button class="fchip" type="button" data-tmpreset="${k}">${k}</button>`).join("")}<button class="fchip" type="button" data-tmpreset="">Clear</button></div>
      <div class="permgrid">${PERMS.map(([k,l,h])=>`<label class="permbox"><input type="checkbox" data-tmperm="${k}" ${F.perms.includes(k)?"checked":""}><span><b>${l}</b>${h?`<small>${h}</small>`:""}</span></label>`).join("")}</div>
      <p class="note">Deleting flavors, categories, box sizes or extras, and changing any price, always asks for the owner password.</p>`}
    <p class="err" id="tmErr" ${TM.err?"":"hidden"}>${esc(TM.err)}</p>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-blue" type="button" data-tmsave>${isNew?"Create login":"Save changes"}</button>${isNew?"":`<button class="btn btn-ghost-blue" type="button" data-tmcancel>Cancel</button>`}</div></section>`;
}
function viewTeam(){
  if(!SBH.on)return head("Team","Add staff who can handle orders.")+MOCK+`<section class="panel"><div class="empty">Team accounts work once the site is connected to Supabase.</div></section>`;
  if(!TM.form)TM.form={mode:"new",name:"",username:"",password:"",title:"",role:"staff",perms:PERM_PRESETS.Cashier.slice()};
  const me=(SBH.email||"").toLowerCase();
  const rows=(TM.list||[]).map(m=>{const self=m.email.toLowerCase()===me;return `<div class="pmcard tmrow"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;align-items:center"><b>${esc(m.name||m.username||m.email)}${self?" (you)":""}</b><span class="rolechip${m.role==="owner"?" own":""}">${m.role==="owner"?"Owner":esc(m.title||"Staff")}</span></div>
    <div class="note" style="margin:0">${m.username?`Username: <b>${esc(m.username)}</b>`:esc(m.email)}${m.login?"":" · <b style=\"color:var(--red)\">no login yet</b>"}</div>
    <div class="pchips">${permChips(m)}</div>
    ${self?"":`<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="ghost" type="button" data-tmedit="${esc(m.email)}">Change access</button>${m.login?`<button class="ghost" type="button" data-tmpw="${esc(m.email)}">New password</button>`:""}<button class="danger" type="button" data-tmdel="${esc(m.email)}">Remove</button></div>`}</div>`}).join("");
  return head("Team","Owners can do everything. Staff only see and do what you tick for them. Everything they do is in the Activity log.")+`<div class="stack">
    ${tmFormHTML()}
    <section class="panel"><h2>Team${TM.list?` (${TM.list.length})`:""}</h2><div style="margin-top:10px;display:grid;gap:10px">${TM.list===null?`<div class="empty">Loading…</div>`:rows}</div></section></div>`;
}
function tmErr(m){TM.err=m;const e=$("#tmErr");if(e){e.textContent=m;e.hidden=!m;if(m)e.scrollIntoView({block:"center"})}}
function tmRead(){const F=TM.form;if(!F)return;const v=id=>{const e=$("#"+id);return e?e.value:undefined};
  ["name","title"].forEach(k=>{const x=v("tm"+k[0].toUpperCase()+k.slice(1));if(x!==undefined)F[k]=x});
  const u=v("tmUser");if(u!==undefined)F.username=u;const pw=v("tmPass");if(pw!==undefined)F.password=pw;
  if(F.role!=="owner")F.perms=[...document.querySelectorAll("[data-tmperm]")].filter(c=>c.checked).map(c=>c.dataset.tmperm);}
async function tmCall(fn,args,ok){try{TM.list=await SBH.rpc(fn,args);TM.err="";TM.form=null;renderAdmin();if(ok)toast(ok);return true}catch(e){tmErr(e.message);return false}}
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||A.tab!=="team")return;const d=b.dataset;
  if(d.tmlevel){tmRead();TM.form.role=d.tmlevel;renderAdmin();$("#tmForm").scrollIntoView({block:"start"})}
  else if(d.tmpreset!==undefined){tmRead();TM.form.perms=(PERM_PRESETS[d.tmpreset]||[]).slice();if(d.tmpreset&&!TM.form.title)TM.form.title=d.tmpreset;renderAdmin();$("#tmForm").scrollIntoView({block:"start"})}
  else if(d.tmshow!==undefined){const i=$("#tmPass");i.type=i.type==="password"?"text":"password";b.textContent=i.type==="password"?"Show":"Hide"}
  else if(d.tmcancel!==undefined){TM.form=null;TM.err="";renderAdmin()}
  else if(d.tmsave!==undefined){tmRead();const F=TM.form;
    if(F.mode==="new"){const un=F.username.trim().toLowerCase();
      if(!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(un))return tmErr("Username: 3 to 30 letters or numbers (dots, dashes and _ are fine), no spaces.");
      if(F.password.length<8)return tmErr("Password: at least 8 characters.");
      tmCall("admin_team_create",{p:{username:un,name:F.name.trim(),password:F.password,title:F.title.trim(),role:F.role,perms:F.perms}},"Login created for "+un)}
    else tmCall("admin_team_set",{p:{email:F.email,name:F.name.trim(),title:F.title.trim(),role:F.role,perms:F.perms}},"Saved")}
  else if(d.tmedit){const m=(TM.list||[]).find(x=>x.email===d.tmedit);if(!m)return;TM.err="";
    TM.form={mode:"edit",email:m.email,username:m.username||"",name:m.name||"",title:m.title||"",role:m.role,perms:(m.perms||[]).slice(),password:""};renderAdmin();$("#tmForm").scrollIntoView({block:"start"})}
  else if(d.tmpw){const m=(TM.list||[]).find(x=>x.email===d.tmpw);
    pwPrompt({title:"New password for "+(m&&(m.name||m.username)||d.tmpw),text:"At least 8 characters. Tell them the new password yourself.",button:"Set password",autocomplete:"new-password",
      run:async pw=>{if(pw.length<8)return {ok:false,err:"Password: at least 8 characters."};try{TM.list=await SBH.rpc("admin_team_password",{p_email:d.tmpw,p_password:pw});return {ok:true}}catch(x){return {ok:false,err:x.message}}}})
      .then(()=>{renderAdmin();toast("Password changed")}).catch(()=>{})}
  else if(d.tmdel)armed(b,()=>tmCall("admin_team_remove",{p_email:d.tmdel},"Removed"));
});

/* --- Activity log (owner only) --- */
const LG={list:null,q:"",loading:false,more:true,qT:null,note:null};
async function loadLog(older){
  if(!SBH.on){LG.list=[];LG.more=false;return renderAdmin()}
  if(LG.loading)return;LG.loading=true;
  try{const before=older&&LG.list&&LG.list.length?LG.list[LG.list.length-1].at:null;
    const r=await SBH.rpc("admin_log_list",{p_before:before,p_q:LG.q});LG.list=older?(LG.list||[]).concat(r):r;LG.more=r.length>=200;LG.err=""}
  catch(e){LG.err=e.message;if(LG.list===null)LG.list=[]}
  LG.loading=false;if(A.tab==="log"&&!A.modal){const y=scrollY;renderAdmin();if(older)scrollTo(0,y)}
}
function logRows(){
  if(!LG.list)return `<div class="empty">Loading…</div>`;if(!LG.list.length)return `<div class="empty">${LG.q?"Nothing matches.":"Nothing yet."}</div>`;
  let day="";return LG.list.map(x=>{const d=new Date(x.at),dk=d.toDateString();const h=dk!==day?`<div class="lgday">${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})}</div>`:"";day=dk;
    return h+`<div class="lgrow"><span class="lgt">${d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}</span><div class="lgmain"><div><b>${esc(x.actor)}</b> <span class="rolechip${x.role==="Owner"?" own":""}">${esc(x.role)}</span></div>
      <div class="lga">${esc(x.action)}${x.detail?` <span>· ${esc(x.detail)}</span>`:""}</div>
      ${LG.note===x.id?`<div class="pwrow" style="margin-top:6px"><input class="in" id="lgNote" maxlength="300" value="${esc(x.note)}" placeholder="Your note"><button class="btn btn-blue btn-sm" type="button" data-lgnotesave="${x.id}">Save</button></div>`:x.note?`<div class="lgnote">📝 ${esc(x.note)}</div>`:""}</div>
      <div class="lgbtn"><button class="linkbtn sm" type="button" data-lgnote="${x.id}">${x.note?"Edit note":"Note"}</button><button class="linkbtn sm danger-t" type="button" data-lgdel="${x.id}">Delete</button></div></div>`}).join("");
}
function viewLog(){
  if(!SBH.on)return head("Activity","Everything the owner and staff do.")+MOCK+`<section class="panel"><div class="empty">The activity log works once the site is connected to Supabase.</div></section>`;
  return head("Activity","Everything the owner and staff did on the team site. Only owners can see this. Entries older than 3 months are deleted automatically.")+`<div class="stack">
    <section class="panel"><div class="pwrow"><input class="in" id="lgQ" type="search" placeholder="Search name, action, order code…" value="${esc(LG.q)}"><button class="ghost" type="button" data-lgreload>Refresh</button></div>
      ${LG.err?`<p class="err">${esc(LG.err)}</p>`:""}
      <div class="lglist" id="lgList">${logRows()}</div>
      ${LG.list&&LG.more?`<div style="margin-top:12px"><button class="ghost" type="button" data-lgmore>Load older</button></div>`:""}</section>
    <div><button class="danger" type="button" data-lgclear>Delete the whole log…</button></div></div>`;
}
am.addEventListener("input",e=>{if(e.target.id!=="lgQ")return;LG.q=e.target.value;clearTimeout(LG.qT);LG.qT=setTimeout(()=>{LG.list=null;loadLog().then(()=>{const q=$("#lgQ");if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}})},400)});
am.addEventListener("click",async e=>{const b=e.target.closest("button");if(!b||A.tab!=="log")return;const d=b.dataset;
  if(d.lgreload!==undefined){LG.list=null;renderAdmin();loadLog()}
  else if(d.lgmore!==undefined)loadLog(true);
  else if(d.lgnote){LG.note=+d.lgnote;const y=scrollY;renderAdmin();scrollTo(0,y);const i=$("#lgNote");i&&i.focus()}
  else if(d.lgnotesave){const id=+d.lgnotesave,v=$("#lgNote").value.trim();try{await SBH.rpc("admin_log_note",{p_id:id,p_note:v});const x=LG.list.find(y=>y.id===id);if(x)x.note=v;LG.note=null;const y=scrollY;renderAdmin();scrollTo(0,y);toast("Note saved")}catch(x){toast(x.message)}}
  else if(d.lgdel){armed(b,async()=>{try{await SBH.rpc("admin_log_delete",{p_ids:[+d.lgdel]});LG.list=LG.list.filter(y=>y.id!==+d.lgdel);const y=scrollY;renderAdmin();scrollTo(0,y);toast("Entry deleted")}catch(x){toast(x.message)}})}
  else if(d.lgclear!==undefined){pwPrompt({title:"Delete the whole activity log?",text:"This can't be undone. Type your own owner password to confirm.",button:"Delete everything",danger:true,
      run:async pw=>{try{return await SBH.rpc("admin_log_clear",{p_password:pw})}catch(x){return {ok:false,err:x.message}}}})
    .then(()=>{LG.list=null;renderAdmin();loadLog();toast("Activity log deleted")}).catch(()=>{})}
});

/* --- owner password prompt (used for deletes, price changes and clearing the log) --- */
function pwPrompt(o){
  return new Promise((resolve,reject)=>{
    const w=document.createElement("div");w.className="pwmodal";w.setAttribute("role","dialog");w.setAttribute("aria-modal","true");
    w.innerHTML=`<form class="pwcard" novalidate><h3>${esc(o.title)}</h3><p class="note">${esc(o.text||"")}</p>
      <label class="af">Password<input class="in" type="password" id="pwIn" autocomplete="${o.autocomplete||"current-password"}" maxlength="72"></label>
      <p class="err" id="pwErr" hidden></p>
      <div class="modal-actions"><button class="btn btn-ghost-blue" type="button" data-pwcancel>Cancel</button><button class="btn ${o.danger?"btn-red":"btn-blue"}" type="submit">${esc(o.button||"Confirm")}</button></div></form>`;
    document.body.appendChild(w);const inp=w.querySelector("#pwIn"),err=w.querySelector("#pwErr"),go=w.querySelector("button[type=submit]");setTimeout(()=>inp.focus(),30);
    const done=ok=>{w.remove();ok?resolve():reject(new Error("cancelled"))};
    w.addEventListener("click",e=>{if(e.target===w||e.target.closest("[data-pwcancel]"))done(false)});
    w.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();done(false)}});
    w.querySelector("form").addEventListener("submit",async e=>{e.preventDefault();const pw=inp.value;if(!pw){err.textContent="Type the password.";err.hidden=false;return}
      go.disabled=true;err.hidden=true;const r=await o.run(pw);go.disabled=false;
      if(r&&r.ok){done(true);return}err.textContent=(r&&r.err)||"That didn't work.";err.hidden=false;inp.select()});
  });
}
let SUDO_UNTIL=0;
function needOwner(what){
  if(!SBH.on||SUDO_UNTIL>Date.now()+15000)return Promise.resolve();
  return pwPrompt({title:"Owner password needed",text:`To ${what}, type the owner's password. It stays unlocked for 10 minutes.`,button:"Confirm",
    run:async pw=>{try{const r=await SBH.rpc("admin_sudo",{p_password:pw});if(r&&r.ok)SUDO_UNTIL=r.until;return r}catch(x){return {ok:false,err:x.message}}}});
}
window.needOwner=needOwner;
// price fields ask for the owner password before they change
const PRICE_K=/^(products:[^:]+:surcharge|sizes:[^:]+:price|addons:[^:]+:price|settings::deliveryFee|settings::samedayFee|settings::customPer)$/;
am.addEventListener("change",e=>{const el=e.target;if(!el.dataset||!el.dataset.k||!PRICE_K.test(el.dataset.k)||!SBH.on||SUDO_UNTIL>Date.now()+15000)return;
  const [coll,id,field]=el.dataset.k.split(":"),item=coll==="settings"?DB.settings:coll==="sizes"?DB.sizes.find(x=>String(x.n)===id):DB[coll].find(x=>x.id===id);
  if(!item)return;const old=item[field],nv=el.value;if(String(old)===String(Math.max(0,parseFloat(nv)||0)))return;
  e.stopImmediatePropagation();el.value=old;
  needOwner("change a price").then(()=>{el.value=nv;el.dispatchEvent(new Event("change",{bubbles:true}))}).catch(()=>toast("Price not changed"));
},true);

am.addEventListener("input",e=>{if(e.target.id==="cuSearch"){CU.q=e.target.value;const l=$("#cuList");if(l)l.innerHTML=cuRows()}});
am.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;const d=b.dataset;
  if(d.cusave!==undefined)cuSave();
  else if(d.cuedit){const c=(CU.list||[]).find(x=>x.id===d.cuedit);if(c){CU.form=Object.assign({},c);CU.err="";renderAdmin();scrollTo(0,0)}}
  else if(d.cucancel!==undefined){CU.form=null;CU.err="";renderAdmin()}
  else if(d.cudel){armed(b,async()=>{try{if(SBH.on)CU.list=await SBH.rpc("admin_customer_delete",{p_id:d.cudel});else{DB.customers=DB.customers.filter(c=>c.id!==d.cudel);saveDB();CU.list=demoCustomers()}renderAdmin();toast("Customer removed")}catch(x){toast(x.message)}})}
  else if(d.tmadd!==undefined){const em=$("#tmEmail").value.trim();if(!em)return tmErr("Enter the person's email.");tmCall("admin_team_set",{p_email:em,p_role:$("#tmRole").value,p_name:$("#tmName").value.trim()},"Added to the team")}
  else if(d.tmrole)tmCall("admin_team_set",{p_email:d.tmrole,p_role:d.to,p_name:((TM.list||[]).find(m=>m.email===d.tmrole)||{}).name||""},"Role changed");
  else if(d.tmdel)armed(b,()=>tmCall("admin_team_remove",{p_email:d.tmdel},"Removed"));
});

/* --- clock: countdowns + sale start/end --- */
function tickAdmin(now=Date.now()){
  if(A.tab==="announcer"&&document.getElementById("anPrev"))anTick(now);
  document.querySelectorAll("[data-cd]").forEach(el=>{const s=DB.sales.find(x=>x.id===el.dataset.cd);if(!s)return;const st=saleStatus(s,now);
    el.textContent=st==="live"?fmtDur(s.end-now):st==="scheduled"?fmtDur(s.start-now):new Date(s.end).toLocaleDateString("en-US",{month:"short",day:"numeric"})});
}
const sig = (now=Date.now()) => DB.sales.map(s=>saleStatus(s,now)).join();
let lastSig=sig();
setInterval(()=>{
  const now=Date.now(),s=sig(now);
  if(view==="store"){if(s!==lastSig)renderStore();else updateFlash(now)}
  else{const typing=document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);if(s!==lastSig&&!typing)renderAdmin();else tickAdmin(now)}
  lastSig=s;alScan();
  if(view==="admin"&&A.tab==="dashboard"&&A.dsig!==dashSig()){const typing=document.activeElement&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);if(!typing)renderAdmin()}
},1000);

/* --- owner alerts: popup + sound --- */
const AACK_KEY="delidome-aack-v1",ABOOT_KEY="delidome-aboot-v1";
let AACK=new Set();try{AACK=new Set(JSON.parse(localStorage.getItem(AACK_KEY)||"[]"))}catch(e){}
let ABOOT=Date.now();try{const v=+localStorage.getItem(ABOOT_KEY);if(v)ABOOT=v;else localStorage.setItem(ABOOT_KEY,String(ABOOT))}catch(e){}
let ALQ=[],AC=null,alRep=null;
const alSaveAck=()=>{try{localStorage.setItem(AACK_KEY,JSON.stringify([...AACK].slice(-400)))}catch(e){}};
["pointerdown","keydown","touchstart"].forEach(ev=>addEventListener(ev,()=>acx(),{passive:true}));
function acx(){try{if(!AC)AC=new (window.AudioContext||window.webkitAudioContext)();if(AC.state==="suspended")AC.resume()}catch(e){AC=null}return AC}
function tone(f,t,d,type,v,f2){const c=AC,o=c.createOscillator(),g=c.createGain(),T=c.currentTime+t;o.type=type;o.frequency.setValueAtTime(f,T);if(f2)o.frequency.exponentialRampToValueAtTime(f2,T+d);g.gain.setValueAtTime(0.0001,T);g.gain.linearRampToValueAtTime(v,T+.012);g.gain.exponentialRampToValueAtTime(.0001,T+d);o.connect(g);g.connect(c.destination);o.start(T);o.stop(T+d+.05)}
const SND={
  bell:v=>{tone(880,0,1.3,"sine",v);tone(1760,0,.9,"sine",v*.4);tone(2640,0,.5,"sine",v*.2)},
  chime:v=>[523,659,784,1047].forEach((f,i)=>tone(f,i*.14,.7,"triangle",v)),
  register:v=>{tone(1568,0,.12,"square",v*.35);tone(2093,.11,.6,"square",v*.35);tone(3136,.11,.4,"sine",v*.3)},
  door:v=>{tone(659,0,.7,"sine",v);tone(523,.45,1,"sine",v)},
  pop:v=>{tone(300,0,.18,"sine",v,900);tone(500,.2,.18,"sine",v,1200)},
  alarm:v=>[0,.26,.52,.78].forEach((t,i)=>tone(i%2?700:950,t,.22,"square",v*.3))
};
function alPlay(name){
  const a=DB.alerts,vol=Math.max(.05,Math.min(1,a.vol/100));
  if(name==="custom"&&a.custom){try{const au=new Audio(a.custom);au.volume=vol;au.play().catch(()=>{})}catch(e){}return}
  if(!acx())return;(SND[name]||SND.chime)(vol*.55);
}
function alEvents(){
  const ev=[];
  DB.orders.forEach(o=>{if(o.example)return;
    if(o.createdAt>=ABOOT)ev.push({type:"order",id:o.id,at:o.createdAt});
    if(o.proof&&o.proof.at>=ABOOT)ev.push({type:"proof",id:o.id,at:o.proof.at});
    if(o.complaint&&o.complaint.at>=ABOOT)ev.push({type:"complaint",id:o.id,at:o.complaint.at})});
  return ev.map(x=>({...x,key:x.type+"|"+x.id+"|"+x.at}));
}
function alAckAll(){alEvents().forEach(x=>AACK.add(x.key));alSaveAck();ALQ=ALQ.filter(x=>x.test);renderAlerts()}
const AL_META={order:["🍪","New order placed"],proof:["🧾","Payment proof submitted"],complaint:["⚠️","New customer complaint"]};
function alPush(x){
  if(ALQ.some(q=>q.key===x.key))return;ALQ.push(x);renderAlerts();alSound([x]);
  if(!DB.alerts.stay)setTimeout(()=>alDismiss(x.key),10000);
}
function alSound(list){
  const a=DB.alerts;if(!a.sound||!list.length)return;
  const pr={complaint:3,proof:2,order:1},top=list.reduce((m,x)=>(pr[x.type]||0)>(pr[m.type]||0)?x:m,list[0]);
  alPlay(top.test?a.ev.order.snd:a.ev[top.type].snd);
}
function alScan(){
  if(view!=="admin")return;const a=DB.alerts;
  if(a.on){const fresh=alEvents().filter(x=>!AACK.has(x.key)&&a.ev[x.type].on&&!ALQ.some(q=>q.key===x.key));
    if(fresh.length){fresh.sort((p,q)=>p.at-q.at).forEach(x=>{ALQ.push(x);if(!a.stay)setTimeout(()=>alDismiss(x.key),10000)});renderAlerts();alSound(fresh)}}
  const need=a.on&&a.sound&&a.repeat&&ALQ.length>0;
  if(need&&!alRep)alRep=setInterval(()=>{if(ALQ.length)alSound(ALQ);else{clearInterval(alRep);alRep=null}},20000);
  if(!need&&alRep){clearInterval(alRep);alRep=null}
}
function alDismiss(key){const q=ALQ.find(x=>x.key===key);if(!q)return;AACK.add(key);alSaveAck();ALQ=ALQ.filter(x=>x.key!==key);renderAlerts()}
const AL_BASE=document.title;
function renderAlerts(){
  const st=$("#alStack");if(!st)return;
  const money_=o=>o?money(o.total):"";
  const shown=ALQ.slice(-4).reverse();
  st.innerHTML=shown.map(x=>{const o=DB.orders.find(y=>y.id===x.id),m=AL_META[x.type]||AL_META.order,nm=o?(x.type==="proof"&&o.proof?o.proof.name:o.customer.name):"Sample customer";
    const line=x.type==="complaint"&&o&&o.complaint?o.complaint.reason:(o?money_(o):"$0.00");
    return `<div class="al-card ${x.type}" role="alert"><div class="al-t"><i aria-hidden="true">${m[0]}</i>${m[1]}</div><div class="al-b"><b>${o?esc(o.code):"DD-TEST"}</b> · ${esc(nm)} · ${esc(line)}<small>${fmtAgo(x.at)}${x.test?" · test alert":""}</small></div><div class="al-r">${o?`<button class="btn btn-blue btn-sm" type="button" data-alview="${x.key}">View</button>`:""}<button class="ghost" type="button" data-aldis="${x.key}">Dismiss</button></div></div>`}).join("")+(ALQ.length>1?`<button class="al-more" type="button" data-aldisall>${ALQ.length>4?`+${ALQ.length-4} more · `:""}Dismiss all</button>`:"");
  document.title=ALQ.length?`(${ALQ.length}) ${AL_BASE}`:AL_BASE;
}
$("#alStack").addEventListener("click",e=>{
  const v=e.target.closest("[data-alview]"),d=e.target.closest("[data-aldis]");
  if(e.target.closest("[data-aldisall]")){ALQ.slice().forEach(x=>{AACK.add(x.key)});alSaveAck();ALQ=[];renderAlerts();return}
  if(d){alDismiss(d.dataset.aldis);return}
  if(v){const x=ALQ.find(q=>q.key===v.dataset.alview);if(!x)return;alDismiss(x.key);
    if(x.type==="complaint"){A.tab="complaints";renderAdmin();openComplaint(x.id)}else{A.tab="orders";renderAdmin();openOrder(x.id)}}
});

/* --- routing between shop and admin --- */
let view=null;
function route(){
  const admin=location.hash==="#admin",next=admin?"admin":"store";
  if(next===view)return;
  const prev=view;view=next;
  $("#storeView").hidden=admin;$("#adminView").hidden=!admin;document.body.classList.toggle("in-store",!admin);
  if(admin){try{localStorage.setItem(STAFF_KEY,"1")}catch(e){}closeSheet();closeMO();
    if(SBH.on&&!SBH.adminReady()){SBH.enterAdmin();return}
    expireOrders();renderAdmin();window.scrollTo(0,0);alScan()}
  else{
    if(SBH.on&&(prev==="admin"||!SBH.loaded)){if(prev==="admin")SBH.leaveAdmin();else SBH.loadShop();return}
    trackVisit();closeDrawer();closeModal();closeReviews();expireOrders();sanitizeCart();renderBag();renderEditBar();renderStoreStatic();renderStore();if(location.hash==="#shop")window.scrollTo(0,0)}
}
addEventListener("hashchange",route);
{const so=$("#signOut");if(so)so.addEventListener("click",()=>SBH.signOut())}
// browsers refuse to open data: pictures in a new tab, so open them as a blob instead
document.addEventListener("click",e=>{const a=e.target.closest('a[href^="data:image/"]');if(!a)return;e.preventDefault();
  fetch(a.getAttribute("href")).then(r=>r.blob()).then(b=>window.open(URL.createObjectURL(b),"_blank","noopener")).catch(()=>toast("Couldn't open the picture"))});
addEventListener("storage",e=>{if(SBH.on)return;if(e.key===DB_KEY){loadDB();view=null;route()}else if(e.key===VIS_KEY)loadVis()});

if(!hadCart&&!SBH.on)S.box=["bb","bb","dc","rv"];
expireOrders();
route();
