// Aravali Task Tracker server. No npm install needed (Node 18+).
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const PORT=process.env.PORT||3000,DIR=process.env.DATA_DIR||path.join(__dirname,'data');
const FILE=path.join(DIR,'db.json'),PH=path.join(DIR,'photos'),SF=path.join(DIR,'secret.txt'),OUT=3;
fs.mkdirSync(PH,{recursive:true});
const rid=()=>crypto.randomBytes(4).toString('hex');
let SECRET;try{SECRET=fs.readFileSync(SF,'utf8')}catch(e){SECRET=crypto.randomBytes(32).toString('hex');fs.writeFileSync(SF,SECRET)}
function seed(){const users=[{id:'owner',name:'Owner',pw:'owner123',role:'owner',outlet:-1}],tasks=[];
 for(let i=0;i<OUT;i++){users.push({id:'manager'+(i+1),name:'Manager '+(i+1),pw:'mgr123',role:'manager',outlet:i});
  ['Kitchen hygiene check','Cash counter and stock check'].forEach(t=>tasks.push({id:rid(),title:t,to:'manager'+(i+1),outlet:i}));
  [1,2].forEach(k=>{const id='emp'+(i*2+k);users.push({id,name:'Employee '+(i*2+k),pw:'emp123',role:'employee',outlet:i});
   ['Table setup before opening','Service station ready','Closing clean-up'].forEach(t=>tasks.push({id:rid(),title:t,to:id,outlet:i}))})}
 return {users,tasks,done:{},att:{}}}
let D;try{D=JSON.parse(fs.readFileSync(FILE,'utf8'))}catch(e){D=seed();save()}
function save(){const t=FILE+'.tmp';fs.writeFileSync(t,JSON.stringify(D));fs.renameSync(t,FILE)}
const sign=s=>crypto.createHmac('sha256',SECRET).update(s).digest('base64url');
const mk=id=>{const b=Buffer.from(JSON.stringify({id,exp:Date.now()+30*864e5})).toString('base64url');return b+'.'+sign(b)};
function who(tok){try{const[b,s]=String(tok).split('.');if(!s)return null;const e=sign(b);
 if(e.length!==s.length||!crypto.timingSafeEqual(Buffer.from(e),Buffer.from(s)))return null;
 const p=JSON.parse(Buffer.from(b,'base64url'));return p.exp>Date.now()?D.users.find(x=>x.id===p.id)||null:null}catch(e){return null}}
const okId=s=>typeof s==='string'&&/^[a-z0-9_]{2,30}$/.test(s),str=(s,n)=>String(s==null?'':s).slice(0,n);
function view(u,tok){
 const pwOk=x=>u.role==='owner'||x.id===u.id||(u.role==='manager'&&x.role==='employee');
 const users=(u.role==='owner'?D.users:D.users.filter(x=>x.role!=='owner'&&x.outlet===u.outlet)).map(x=>({id:x.id,name:x.name,role:x.role,outlet:x.outlet,...(pwOk(x)?{pw:x.pw}:{})}));
 const ids=new Set(users.map(x=>x.id)),tasks=D.tasks.filter(t=>u.role==='owner'||(u.role==='manager'?ids.has(t.to):t.to===u.id)),tids=new Set(tasks.map(t=>t.id)),done={},att={};
 for(const[k,r]of Object.entries(D.done))if(tids.has(k.split('|')[0]))done[k]={uid:r.uid,at:r.at,fo:r.fo,fm:r.fm,ph:'/photo?k='+encodeURIComponent(k)+'&t='+tok};
 for(const[k,a]of Object.entries(D.att))if(ids.has(k.split('|')[0]))att[k]=a;
 return {db:{users,tasks,done,att},me:users.find(x=>x.id===u.id)}}
function merge(u,c){
 const isO=u.role==='owner',isM=u.role==='manager',tgt=x=>isO?x.role!=='owner':(isM&&x.role==='employee'&&x.outlet===u.outlet);
 if(isO||isM){
  const seen=new Set(D.users.filter(x=>!tgt(x)).map(x=>x.id)),nu=[];
  (c.users||[]).forEach(x=>{if(!x||!okId(x.id)||seen.has(x.id))return;
   const role=isO&&x.role==='manager'?'manager':'employee',outlet=isO?x.outlet:u.outlet;
   if(!Number.isInteger(outlet)||outlet<0||outlet>=OUT)return;
   const old=D.users.find(y=>y.id===x.id),pw=typeof x.pw==='string'&&x.pw.length>=4?str(x.pw,60):(old&&old.pw);if(!pw)return;
   seen.add(x.id);nu.push({id:x.id,name:str(x.name,60)||x.id,pw,role,outlet})});
  D.users=D.users.filter(x=>!tgt(x)).concat(nu);
  const ids=new Set(D.users.map(x=>x.id)),tt=t=>{const x=D.users.find(y=>y.id===t.to);return !!x&&tgt(x)};
  const keep=D.tasks.filter(t=>ids.has(t.to)&&!tt(t)),sT=new Set(keep.map(t=>t.id));
  (c.tasks||[]).forEach(t=>{if(!t||typeof t.id!=='string'||sT.has(t.id)||!tt(t))return;
   sT.add(t.id);keep.push({id:str(t.id,30),title:str(t.title,100),to:t.to,outlet:D.users.find(y=>y.id===t.to).outlet})});
  D.tasks=keep;
  Object.entries(c.att||{}).forEach(([k,a])=>{const[i,d]=k.split('|'),x=D.users.find(y=>y.id===i);
   if(x&&tgt(x)&&/^\d{4}-\d\d-\d\d$/.test(d)&&a&&(a.st==='A'||a.st==='P'))
    D.att[k]={st:a.st,in:Number.isFinite(a.in)?a.in:null,out:Number.isFinite(a.out)?a.out:null,late:a.late?1:0}})}
 Object.entries(c.done||{}).forEach(([k,r])=>{const[tid,d]=k.split('|'),t=D.tasks.find(x=>x.id===tid);if(!t||!r)return;const e=D.done[k];
  if(e){const x=D.users.find(y=>y.id===t.to);if(isO)e.fo=str(r.fo,300);else if(isM&&x&&tgt(x))e.fm=str(r.fm,300);return}
  if(t.to!==u.id||typeof r.ph!=='string'||!/^data:image\/jpeg;base64,/.test(r.ph)||r.ph.length>700000)return;
  if(!(Math.abs(Date.parse(d)-Date.now())<2*864e5))return;
  const f=rid()+rid()+'.jpg';fs.writeFileSync(path.join(PH,f),Buffer.from(r.ph.split(',')[1],'base64'));
  D.done[k]={uid:u.id,at:new Date().toISOString(),ph:f,fo:'',fm:''}});
 const lim=Date.now()-30*864e5;for(const[k,r]of Object.entries(D.done))if(Date.parse(r.at)<lim){try{fs.unlinkSync(path.join(PH,r.ph))}catch(e){}delete D.done[k]}
 save()}
const fails={};
function body(req){return new Promise((ok,no)=>{let n=0,b=[];req.on('data',c=>{n+=c.length;if(n>8e6){no(new Error('big'));req.destroy()}else b.push(c)});
 req.on('end',()=>{try{ok(JSON.parse(Buffer.concat(b).toString()||'{}'))}catch(e){no(e)}})})}
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://x'),send=(c,o,t='application/json')=>{res.writeHead(c,{'Content-Type':t,'Cache-Control':'no-store'});res.end(typeof o==='string'||Buffer.isBuffer(o)?o:JSON.stringify(o))};
 try{
  if(req.method==='GET'&&(url.pathname==='/'||url.pathname==='/index.html'))return send(200,fs.readFileSync(path.join(__dirname,'public','index.html')),'text/html; charset=utf-8');
  if(url.pathname==='/photo'){const tok=url.searchParams.get('t'),u=who(tok),k=url.searchParams.get('k');
   if(!u||!view(u,tok).db.done[k])return send(404,{error:'Not found'});
   res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'private, max-age=86400'});return res.end(fs.readFileSync(path.join(PH,path.basename(D.done[k].ph))))}
  if(!url.pathname.startsWith('/api/'))return send(404,{error:'Not found'});
  const b=['POST','PUT'].includes(req.method)?await body(req):{};
  if(url.pathname==='/api/login'){const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress).split(',')[0].trim(),now=Date.now();
   fails[ip]=(fails[ip]||[]).filter(t=>now-t<6e5);if(fails[ip].length>=10)return send(429,{error:'Too many attempts. Wait 10 minutes.'});
   const u=D.users.find(x=>x.id===String(b.id||'').toLowerCase()&&x.pw===b.pw);
   if(!u){fails[ip].push(now);return send(401,{error:'Wrong ID or password.'})}return send(200,{token:mk(u.id)})}
  const tok=(req.headers.authorization||'').slice(7),u=who(tok);if(!u)return send(401,{error:'Sign in again.'});
  if(url.pathname==='/api/db'){if(req.method==='PUT')merge(u,b.db||{});return send(200,view(u,tok))}
  if(url.pathname==='/api/password'&&req.method==='POST'){if(typeof b.pw!=='string'||b.pw.length<4)return send(400,{error:'Use at least 4 characters.'});u.pw=b.pw.slice(0,60);save();return send(200,{ok:1})}
  send(404,{error:'Not found'})
 }catch(e){send(500,{error:'Server error'})}
}).listen(PORT,()=>console.log('Aravali Task Tracker running on port '+PORT));
