/* RIBACOM Leadership & Governance Centre */
(function(){
 const admin=a=>['admin','super_admin'].includes(a?.currentUser?.roleKey);
 const e=v=>typeof esc==='function'?esc(v??''):String(v??'');
 RibacomApp.prototype.loadLeadershipCentre=async function(){
  const [l,a]=await Promise.all([
   this.supabaseClient.from('leadership').select('*').eq('is_active',true).order('display_order').order('created_at'),
   this.supabaseClient.from('advisers').select('*').eq('is_active',true).order('display_order').order('created_at')
  ]);
  if(l.error||a.error){this.toast(l.error?.message||a.error?.message,'error');return{leadership:[],advisers:[]}}
  return{leadership:l.data||[],advisers:a.data||[]};
 };
 RibacomApp.prototype.renderLeadershipCentre=async function(){
  const d=await this.loadLeadershipCentre();
  if((!d.leadership||!d.leadership.length) && Array.isArray(this.db?.leadership) && this.db.leadership.length){
    d.leadership=this.db.leadership.filter(x=>x.is_active!==false);
  }
  const required=['President','Vice President','Secretary General','Assistant Secretary General','Treasurer','Public Relations Officer','Welfare Officer / Provost'];
  const existing=new Set(d.leadership.map(x=>String(x.position||'').trim().toLowerCase()));
  const vacancies=required.filter(x=>!existing.has(x.toLowerCase())).map(position=>({name:'Position Vacant',position,biography:'This constitutional executive position is currently vacant.',is_vacant:true}));
  const roster=[...d.leadership,...vacancies].sort((a,b)=>{const ai=required.indexOf(a.position),bi=required.indexOf(b.position);return (ai<0?999:ai)-(bi<0?999:bi) || Number(a.display_order||0)-Number(b.display_order||0);});
  const card=x=>'<article class="bg-white border rounded-3xl overflow-hidden shadow-sm"><div class="h-48 bg-gray-100">'+(x.photo_url&&!x.is_vacant?'<img src="'+e(x.photo_url)+'" class="w-full h-full object-cover" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none';this.parentElement.innerHTML='<div class=\"h-full flex items-center justify-center text-gray-300\"><i class=\"fa-solid fa-user-tie text-5xl\"></i></div>'">':'<div class="h-full flex items-center justify-center text-gray-300"><i class="fa-solid fa-user-tie text-5xl"></i></div>')+'</div><div class="p-5"><div class="text-[10px] uppercase font-black text-ribacom-green">'+e(x.category||x.position||'Leadership')+'</div><h3 class="text-lg font-extrabold text-ribacom-navy mt-1">'+e(x.name)+'</h3>'+(x.position?'<p class="text-sm font-bold text-ribacom-gold mt-1">'+e(x.position)+'</p>':'')+'<p class="text-sm text-gray-600 whitespace-pre-line mt-3">'+e(x.biography||'')+'</p>'+(x.phone?'<p class="text-xs text-gray-500 mt-3">📞 '+e(x.phone)+'</p>':'')+(x.email?'<p class="text-xs text-gray-500 mt-1">✉ '+e(x.email)+'</p>':'')+'</div></article>';
  return '<div class="max-w-6xl mx-auto space-y-6"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Governance</span><h2 class="text-2xl font-extrabold mt-1">Leadership & Governance</h2><p class="text-xs text-white/70 mt-1">Official leadership, advisers and governance information.</p></div><section><h3 class="text-xl font-extrabold text-ribacom-navy mb-3">Executive Leadership</h3><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">'+(roster.length?roster.map(card).join(''):'<div class="bg-white border rounded-2xl p-8 text-gray-500">Leadership profiles will appear here.</div>')+'</div></section><section><h3 class="text-xl font-extrabold text-ribacom-navy mb-3">Advisers & Governance</h3><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">'+(d.advisers.length?d.advisers.map(card).join(''):'<div class="bg-white border rounded-2xl p-8 text-gray-500">Adviser profiles will appear here.</div>')+'</div></section></div>';
 };
 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='leadership'||v==='leadership-centre'){this.currentView='leadership';const c=document.getElementById('appViewport');this.renderLeadershipCentre().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  return oldNav.call(this,v,p);
 };
})();