/* RIBACOM Media Gallery Centre */
(function(){
 const admin=a=>['admin','super_admin'].includes(String(a?.currentUser?.roleKey||'').toLowerCase()); const approver=a=>['super_admin'].includes(String(a?.currentUser?.roleKey||'').toLowerCase());
 const e=v=>typeof esc==='function'?esc(v??''):String(v??'');
 RibacomApp.prototype.loadGallery=async function(all=false){
  let q=this.supabaseClient.from('gallery').select('*').order('created_at',{ascending:false});
  if(!(all&&admin(this)))q=q.eq('is_published',true).eq('approval_status','approved');
  const {data,error}=await q;if(error){this.toast(error.message,'error');return[]}return data||[];
 };
 RibacomApp.prototype.saveGalleryItem=async function(ev){
  ev.preventDefault();if(!admin(this))return this.toast('Administrator access required.','error');
  const title=document.getElementById('galTitle')?.value.trim(),caption=document.getElementById('galCaption')?.value.trim(),image_url=document.getElementById('galUrl')?.value.trim();
  if(!title||!image_url)return this.toast('Title and image URL are required.','error');
  const {error}=await this.supabaseClient.from('gallery').insert({title,caption,image_url,is_published:false,approval_status:'pending',created_by:this.currentUser.id,submitted_by:this.currentUser.id});
  if(error)return this.toast(error.message,'error');this.toast('Gallery item submitted for approval.','success');this.navigate('gallery-admin');
 };
 RibacomApp.prototype.publishGalleryItem=async function(id){
  if(!approver(this))return this.toast('President / Super Admin approval required.','error');
  const {error}=await this.supabaseClient.from('gallery').update({is_published:true,approval_status:'approved',approved_by:this.currentUser.id,approved_at:new Date().toISOString()}).eq('id',id);
  if(error)return this.toast(error.message,'error');this.toast('Gallery item published.','success');this.navigate('gallery-admin');
 };
 RibacomApp.prototype.unpublishGalleryItem=async function(id){
  if(!approver(this))return this.toast('President / Super Admin approval required.','error');
  const {error}=await this.supabaseClient.from('gallery').update({is_published:false}).eq('id',id);
  if(error)return this.toast(error.message,'error');this.navigate('gallery-admin');
 };
 RibacomApp.prototype.renderGalleryCentre=async function(){
  const rows=await this.loadGallery(false);
  return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Media</span><h2 class="text-2xl font-extrabold mt-1">Media Gallery</h2><p class="text-xs text-white/70 mt-1">Official community activities, events and memories.</p></div><div class="grid grid-cols-2 md:grid-cols-3 gap-4">'+(rows.length?rows.map(g=>'<article class="bg-white border rounded-2xl overflow-hidden"><img src="'+e(g.image_url)+'" alt="'+e(g.title)+'" loading="lazy" class="w-full aspect-square object-cover"><div class="p-3"><h3 class="font-extrabold text-ribacom-navy">'+e(g.title)+'</h3><p class="text-xs text-gray-500 mt-1">'+e(g.caption||'')+'</p><p class="text-[10px] text-gray-400 mt-2">'+e((g.created_at||'').slice(0,10))+'</p></div></article>').join(''):'<div class="col-span-full bg-white border rounded-2xl p-8 text-center text-sm text-gray-500">No published gallery items yet.</div>')+'</div></div>';
 };
 RibacomApp.prototype.renderGalleryAdmin=async function(){
  if(!admin(this))return '<div class="p-8 text-center text-red-600 font-bold">Administrator access required.</div>';
  const rows=await this.loadGallery(true);
  return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Administration</span><h2 class="text-2xl font-extrabold mt-1">Media Gallery Manager</h2></div><div class="bg-white border rounded-3xl p-5"><h3 class="font-extrabold text-ribacom-navy mb-4">Add Gallery Image</h3><form onsubmit="app.saveGalleryItem(event)" class="space-y-3"><input id="galTitle" required placeholder="Image title" class="w-full border rounded-xl p-3"><textarea id="galCaption" placeholder="Caption / description" class="w-full border rounded-xl p-3"></textarea><input id="galUrl" required placeholder="Image URL" class="w-full border rounded-xl p-3"><button class="bg-ribacom-green text-white rounded-xl px-5 py-3 font-extrabold">Submit Image</button></form></div><div class="grid md:grid-cols-2 gap-3">'+(rows.length?rows.map(g=>'<div class="bg-white border rounded-2xl p-3 flex gap-3"><img src="'+e(g.image_url)+'" class="w-20 h-20 rounded-xl object-cover"><div class="flex-1"><b>'+e(g.title)+'</b><div class="text-xs text-gray-500 mt-1">'+e(g.approval_status||'pending')+'</div>'+(g.is_published?'<button onclick="app.unpublishGalleryItem(\''+e(g.id)+'\')" class="text-red-600 text-xs font-bold mt-2">Unpublish</button>':'<button onclick="app.publishGalleryItem(\''+e(g.id)+'\')" class="bg-ribacom-green text-white rounded-xl px-3 py-1.5 text-xs font-bold mt-2">Approve & Publish</button>')+'</div></div>').join(''):'<div class="col-span-full text-center text-gray-500">No gallery items.</div>')+'</div></div>';
 };
 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='gallery'){this.currentView=v;const c=document.getElementById('appViewport');this.renderGalleryCentre().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  if(v==='gallery-admin'){this.currentView=v;const c=document.getElementById('appViewport');this.renderGalleryAdmin().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  return oldNav.call(this,v,p);
 };
})();