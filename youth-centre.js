/* RIBACOM Youth Wing & Community Engagement Centre */
(function(){
 const canAdmin=a=>['admin','super_admin'].includes(String(a?.currentUser?.roleKey||'').toLowerCase());
 const e=v=>typeof esc==='function'?esc(v??''):String(v??'');

 RibacomApp.prototype.renderYouthCentre=async function(admin=false){
  if(admin&&!canAdmin(this)) return '<div class="bg-white rounded-3xl border p-8 text-center text-red-600 font-bold">Admin access required.</div>';
  const rows=Array.isArray(this.db.youth)?this.db.youth:(this.db.youth?[this.db.youth]:[]);
  if(!admin){
   const cards=rows.length?rows.map(y=>'<article class="bg-white border rounded-3xl p-6 card-shadow"><h3 class="text-xl font-extrabold text-ribacom-navy">'+e(y.section_title||'Youth Development')+'</h3><p class="text-sm text-gray-700 whitespace-pre-line mt-3">'+e(y.body_content||'')+'</p>'+(y.image_url?'<img src="'+e(y.image_url)+'" alt="RIBACOM Youth" class="mt-4 w-full max-h-72 object-cover rounded-2xl">':'')+'</article>').join(''):'<div class="bg-white border rounded-3xl p-8 text-center text-sm text-gray-500">Youth programmes and community initiatives will be published here.</div>';
   return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-7 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Community Engagement</span><h2 class="text-3xl font-extrabold mt-1">Youth Wing</h2><p class="text-sm text-white/70 mt-2">Youth development, volunteering, culture, leadership and community participation.</p></div><div class="grid md:grid-cols-2 gap-4">'+cards+'</div><div class="bg-white rounded-3xl border p-6"><h3 class="font-extrabold text-ribacom-navy">Get Involved</h3><p class="text-sm text-gray-600 mt-2">Members can participate in approved youth programmes, community service, cultural activities and volunteering opportunities.</p><div class="mt-4 flex flex-wrap gap-2"><button onclick="app.navigate(\'member-profile\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-bold">My Profile</button><button onclick="app.navigate(\'events\')" class="bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold">Community Events</button></div></div></div>';
  }
  const latest=rows[0]||{};
  return '<div class="max-w-5xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><span class="text-[10px] uppercase font-black text-ribacom-gold">Administration</span><h2 class="text-2xl font-extrabold">Youth Content Management</h2></div><form onsubmit="event.preventDefault();app.saveYouthContent()" class="bg-white rounded-3xl border p-6 space-y-4"><label class="block text-xs font-bold text-gray-600">Section Title<input id="yc_title" value="'+e(latest.section_title||'Youth Development')+'" class="mt-1 w-full border rounded-xl p-3 text-sm" required></label><label class="block text-xs font-bold text-gray-600">Content<textarea id="yc_body" rows="8" class="mt-1 w-full border rounded-xl p-3 text-sm" required>'+e(latest.body_content||'')+'</textarea></label><label class="block text-xs font-bold text-gray-600">Image URL<input id="yc_image" value="'+e(latest.image_url||'')+'" class="mt-1 w-full border rounded-xl p-3 text-sm" placeholder="https://..."></label><button class="bg-ribacom-green text-white px-5 py-3 rounded-xl text-sm font-bold">Save Youth Content</button></form></div>';
 };

 RibacomApp.prototype.saveYouthContent=async function(){
  if(!canAdmin(this)) return this.toast('Admin access required.','error');
  if(!this.supabaseClient) return this.toast('Supabase connection unavailable.','error');
  const title=document.getElementById('yc_title')?.value?.trim()||'Youth Development';
  const body=document.getElementById('yc_body')?.value?.trim()||'';
  const image=document.getElementById('yc_image')?.value?.trim()||null;
  if(!body) return this.toast('Youth content cannot be empty.','warning');
  const {data:existing,error:lookupError}=await this.supabaseClient.from('youth_content').select('id').order('updated_at',{ascending:false}).limit(1).maybeSingle();
  if(lookupError) return this.toast(lookupError.message,'error');
  const payload={section_title:title,body_content:body,image_url:image,updated_at:new Date().toISOString()};
  const result=existing?.id?await this.supabaseClient.from('youth_content').update(payload).eq('id',existing.id):await this.supabaseClient.from('youth_content').insert(payload);
  if(result.error) return this.toast(result.error.message,'error');
  await this.loadCloudData();
  this.toast('Youth content updated.','success');
  this.navigate('youth');
 };

 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='youth'||v==='youth-centre'||v==='admin-youth'){
   const admin=v==='admin-youth';
   if(admin&&!canAdmin(this)) return this.toast('You are not authorized to access Youth administration.','error');
   this.currentView=v;
   const c=document.getElementById('appViewport');
   Promise.resolve(this.renderYouthCentre(admin)).then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});
   return;
  }
  return oldNav.call(this,v,p);
 };
})();