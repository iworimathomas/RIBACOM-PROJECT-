/* RIBACOM Youth & Community Development Centre */
(function(){
 const admin=a=>['admin','super_admin'].includes(a?.currentUser?.roleKey);
 const e=v=>typeof esc==='function'?esc(v??''):String(v??'');
 RibacomApp.prototype.loadYouthContent=async function(){
  const {data,error}=await this.supabaseClient.from('youth_content').select('*').limit(1).maybeSingle();
  if(error){this.toast(error.message,'error');return null} return data;
 };
 RibacomApp.prototype.renderYouthCentre=async function(){
  const y=await this.loadYouthContent();
  const title=y?.title||'RIBACOM Youth & Community Development';
  const intro=y?.content||y?.description||'Empowering young people through leadership, skills, service, culture and community development.';
  return '<div class="max-w-5xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Development</span><h2 class="text-2xl font-extrabold mt-1">'+e(title)+'</h2><p class="text-xs text-white/70 mt-1">Youth participation, leadership and community development.</p></div><div class="bg-white border rounded-3xl p-6"><h3 class="text-xl font-extrabold text-ribacom-navy">Youth Programme</h3><p class="text-sm text-gray-700 whitespace-pre-line mt-3">'+e(intro)+'</p></div><div class="grid md:grid-cols-3 gap-4"><div class="bg-white border rounded-2xl p-5"><b>Leadership</b><p class="text-xs text-gray-500 mt-2">Develop responsible future community leaders.</p></div><div class="bg-white border rounded-2xl p-5"><b>Skills & Enterprise</b><p class="text-xs text-gray-500 mt-2">Support practical skills, entrepreneurship and employment readiness.</p></div><div class="bg-white border rounded-2xl p-5"><b>Service & Culture</b><p class="text-xs text-gray-500 mt-2">Promote service, heritage, unity and positive community participation.</p></div></div></div>';
 };
 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='youth-centre'){this.currentView=v;const c=document.getElementById('appViewport');this.renderYouthCentre().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  return oldNav.call(this,v,p);
 };
})();