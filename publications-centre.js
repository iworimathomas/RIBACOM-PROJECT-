/* RIBACOM Publications & Documents Centre */
(function(){
 const admin=a=>['admin','super_admin'].includes(a?.currentUser?.roleKey);
 const e=v=>typeof esc==='function'?esc(v??''):String(v??'');
 RibacomApp.prototype.loadPublications=async function(all=false){
  let q=this.supabaseClient.from('publications').select('*').order('publication_date',{ascending:false});
  if(!(all&&admin(this)))q=q.eq('is_published',true).eq('approval_status','approved');
  const {data,error}=await q;if(error){this.toast(error.message,'error');return[]}return data||[];
 };
 RibacomApp.prototype.savePublication=async function(ev){
  ev.preventDefault();if(!admin(this))return this.toast('Administrator access required.','error');
  const title=document.getElementById('pubTitle')?.value.trim(),description=document.getElementById('pubDesc')?.value.trim(),file_url=document.getElementById('pubUrl')?.value.trim();
  if(!title||!file_url)return this.toast('Title and document link are required.','error');
  const {error}=await this.supabaseClient.from('publications').insert({title,description,file_url,category:document.getElementById('pubCat').value,publication_date:document.getElementById('pubDate').value||new Date().toISOString().slice(0,10),is_published:false,approval_status:'pending',submitted_by:this.currentUser.id});
  if(error)return this.toast(error.message,'error');this.toast('Publication submitted for approval.','success');this.navigate('publications-admin');
 };
 RibacomApp.prototype.publishPublication=async function(id){
  if(!admin(this))return this.toast('Administrator access required.','error');
  const {error}=await this.supabaseClient.from('publications').update({is_published:true,approval_status:'approved',approved_by:this.currentUser.id,approved_at:new Date().toISOString()}).eq('id',id);
  if(error)return this.toast(error.message,'error');this.toast('Publication approved.','success');this.navigate('publications-admin');
 };
 RibacomApp.prototype.unpublishPublication=async function(id){
  if(!admin(this))return this.toast('Administrator access required.','error');
  const {error}=await this.supabaseClient.from('publications').update({is_published:false}).eq('id',id);
  if(error)return this.toast(error.message,'error');this.navigate('publications-admin');
 };
 RibacomApp.prototype.renderPublications=async function(){
  const rows=await this.loadPublications(false);
  return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Official Documents</span><h2 class="text-2xl font-extrabold mt-1">Publications & Documents</h2><p class="text-xs text-white/70 mt-1">Official constitutions, reports, circulars, notices and community publications.</p></div><div class="grid md:grid-cols-2 gap-4">'+(rows.length?rows.map(p=>'<article class="bg-white border rounded-3xl p-5"><div class="text-[10px] uppercase font-black text-ribacom-green">'+e(p.category||'Document')+'</div><h3 class="text-lg font-extrabold text-ribacom-navy mt-1">'+e(p.title)+'</h3><p class="text-sm text-gray-600 mt-2">'+e(p.description||'')+'</p><div class="text-[10px] text-gray-400 mt-3">'+e(p.publication_date||'')+'</div><a href="'+e(p.file_url)+'" target="_blank" rel="noopener" class="inline-block mt-4 bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-bold">Open Document</a></article>').join(''):'<div class="bg-white border rounded-2xl p-8 text-center text-sm text-gray-500 md:col-span-2">No published documents yet.</div>')+'</div></div>';
 };
 RibacomApp.prototype.renderPublicationsAdmin=async function(){
  if(!admin(this))return '<div class="p-8 text-center text-red-600 font-bold">Administrator access required.</div>';
  const rows=await this.loadPublications(true);
  return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Administration</span><h2 class="text-2xl font-extrabold mt-1">Publications Manager</h2></div><div class="bg-white border rounded-3xl p-5"><h3 class="font-extrabold text-ribacom-navy mb-4">Add Official Document</h3><form onsubmit="app.savePublication(event)" class="space-y-3"><input id="pubTitle" required placeholder="Document title" class="w-full border rounded-xl p-3"><textarea id="pubDesc" placeholder="Description" class="w-full border rounded-xl p-3"></textarea><select id="pubCat" class="w-full border rounded-xl p-3"><option>Constitution</option><option>Policy</option><option>Report</option><option>Circular</option><option>Notice</option><option>Publication</option><option>Other</option></select><input id="pubDate" type="date" class="w-full border rounded-xl p-3"><input id="pubUrl" required placeholder="Document URL" class="w-full border rounded-xl p-3"><button class="bg-ribacom-green text-white rounded-xl px-5 py-3 font-extrabold">Submit Document</button></form></div><div class="space-y-3">'+(rows.length?rows.map(p=>'<div class="bg-white border rounded-2xl p-4 flex flex-wrap justify-between gap-3"><div><b>'+e(p.title)+'</b><div class="text-xs text-gray-500">'+e(p.category)+' • '+e(p.approval_status||'pending')+'</div></div>'+(p.is_published?'<button onclick="app.unpublishPublication(\''+e(p.id)+'\')" class="text-red-600 text-xs font-bold">Unpublish</button>':'<button onclick="app.publishPublication(\''+e(p.id)+'\')" class="bg-ribacom-green text-white rounded-xl px-4 py-2 text-xs font-bold">Approve & Publish</button>')+'</div>').join(''):'<div class="text-center text-gray-500">No documents.</div>')+'</div></div>';
 };
 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='publications'){this.currentView=v;const c=document.getElementById('appViewport');this.renderPublications().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  if(v==='publications-admin'){this.currentView=v;const c=document.getElementById('appViewport');this.renderPublicationsAdmin().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  return oldNav.call(this,v,p);
 };
})();