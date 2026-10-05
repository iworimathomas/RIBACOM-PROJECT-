/* RIBACOM News & Announcements Centre */
(function(){
 const admin=a=>['admin','super_admin'].includes(a?.currentUser?.roleKey);
 const e=v=>typeof esc==='function'?esc(v??''):String(v??'');
 RibacomApp.prototype.loadAnnouncements=async function(all=false){
   const q=this.supabaseClient.from('announcements').select('*').order('created_at',{ascending:false});
   const {data,error}=await (all&&admin(this)?q:q.eq('is_published',true).eq('approval_status','approved'));
   if(error){this.toast(error.message,'error');return[]} return data||[];
 };
 RibacomApp.prototype.saveAnnouncement=async function(ev){
   ev.preventDefault(); if(!admin(this))return this.toast('Administrator access required.','error');
   const title=document.getElementById('anTitle')?.value.trim(),content=document.getElementById('anContent')?.value.trim(),image_url=document.getElementById('anImage')?.value.trim()||null;
   if(!title||!content)return this.toast('Title and announcement content are required.','error');
   const {error}=await this.supabaseClient.from('announcements').insert({title,content,image_url,is_published:false,approval_status:'pending',author_id:this.currentUser.id,submitted_by:this.currentUser.id});
   if(error)return this.toast(error.message,'error');
   this.toast('Announcement submitted for approval.','success');this.navigate('news-admin');
 };
 RibacomApp.prototype.publishAnnouncement=async function(id){
   if(!admin(this))return this.toast('Administrator access required.','error');
   const {error}=await this.supabaseClient.from('announcements').update({is_published:true,approval_status:'approved',approved_by:this.currentUser.id,approved_at:new Date().toISOString()}).eq('id',id);
   if(error)return this.toast(error.message,'error');this.toast('Announcement published.','success');this.navigate('news-admin');
 };
 RibacomApp.prototype.unpublishAnnouncement=async function(id){
   if(!admin(this))return this.toast('Administrator access required.','error');
   const {error}=await this.supabaseClient.from('announcements').update({is_published:false}).eq('id',id);
   if(error)return this.toast(error.message,'error');this.navigate('news-admin');
 };
 RibacomApp.prototype.renderNews=async function(){
   const rows=await this.loadAnnouncements(false);
   return '<div class="max-w-5xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Official Information</span><h2 class="text-2xl font-extrabold mt-1">News & Announcements</h2><p class="text-xs text-white/70 mt-1">Official updates from the Rivers Bayelsa Community in Diaspora The Gambia.</p></div><div class="space-y-4">'+(rows.length?rows.map(a=>'<article class="bg-white border rounded-3xl overflow-hidden">'+(a.image_url?'<img src="'+e(a.image_url)+'" class="w-full max-h-72 object-cover">':'')+'<div class="p-5"><div class="text-[10px] uppercase font-black text-ribacom-green">'+e((a.created_at||'').slice(0,10))+'</div><h3 class="text-xl font-extrabold text-ribacom-navy mt-1">'+e(a.title)+'</h3><p class="text-sm text-gray-600 whitespace-pre-line mt-3">'+e(a.content)+'</p></div></article>').join(''):'<div class="bg-white border rounded-2xl p-8 text-center text-sm text-gray-500">No published announcements yet.</div>')+'</div></div>';
 };
 RibacomApp.prototype.renderNewsAdmin=async function(){
   if(!admin(this))return '<div class="p-8 text-center text-red-600 font-bold">Administrator access required.</div>';
   const rows=await this.loadAnnouncements(true);
   return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Administration</span><h2 class="text-2xl font-extrabold mt-1">News & Announcements Manager</h2></div><div class="bg-white border rounded-3xl p-5"><h3 class="font-extrabold text-ribacom-navy mb-4">Publish New Announcement</h3><form onsubmit="app.saveAnnouncement(event)" class="space-y-3"><input id="anTitle" required placeholder="Announcement title" class="w-full border rounded-xl p-3"><textarea id="anContent" required rows="6" placeholder="Announcement content" class="w-full border rounded-xl p-3"></textarea><input id="anImage" placeholder="Optional image URL" class="w-full border rounded-xl p-3"><button class="bg-ribacom-green text-white rounded-xl px-5 py-3 font-extrabold">Submit Announcement</button></form></div><div class="space-y-3">'+(rows.length?rows.map(a=>'<div class="bg-white border rounded-2xl p-4"><div class="flex flex-wrap justify-between gap-2"><div><b>'+e(a.title)+'</b><div class="text-xs text-gray-500 mt-1">Status: '+e(a.approval_status||'pending')+' • '+e((a.created_at||'').slice(0,10))+'</div></div>'+(a.is_published?'<button onclick="app.unpublishAnnouncement(\''+e(a.id)+'\')" class="text-red-600 font-bold text-xs">Unpublish</button>':'<button onclick="app.publishAnnouncement(\''+e(a.id)+'\')" class="bg-ribacom-green text-white rounded-xl px-4 py-2 text-xs font-bold">Approve & Publish</button>')+'</div></div>').join(''):'<div class="text-center text-gray-500">No announcements.</div>')+'</div></div>';
 };
 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='news'){this.currentView=v;const c=document.getElementById('appViewport');this.renderNews().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  if(v==='news-admin'){this.currentView=v;const c=document.getElementById('appViewport');this.renderNewsAdmin().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  return oldNav.call(this,v,p);
 };
})();