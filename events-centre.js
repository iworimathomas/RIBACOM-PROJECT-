/* RIBACOM Events & Meetings Centre */
(function(){
  const escv=v=>typeof esc==='function'?esc(v??''):String(v??'');
  const role=app=>String(app?.currentUser?.roleKey||'').toLowerCase();
  const executive=['super_admin','admin','president','vice_president','secretary_general','assistant_secretary_general','treasurer','welfare_officer','pro'];
  const canExecutive=app=>executive.includes(role(app));

  RibacomApp.prototype.renderEventsCentre=async function(){
    if(!this.supabaseClient) return '<div class="bg-white rounded-3xl border p-8 text-center text-red-600">Community calendar is temporarily unavailable.</div>';
    const {data,error}=await this.supabaseClient.from('events').select('*').eq('is_published',true).order('event_date',{ascending:true});
    if(error){this.toast(error.message,'error');return '<div class="bg-white rounded-3xl border p-8 text-center text-red-600">Unable to load community events.</div>'}
    const rows=(data||[]).filter(e=>e.event_date);
    const now=Date.now();
    const upcoming=rows.filter(e=>new Date(e.event_date).getTime()>=now);
    const past=rows.filter(e=>new Date(e.event_date).getTime()<now).reverse();
    const fmt=d=>{try{return new Date(d).toLocaleString(undefined,{weekday:'short',day:'2-digit',month:'short',year:'numeric',hour:'numeric',minute:'2-digit'})}catch(_){return String(d||'')}};
    const card=e=>'<article class="bg-white rounded-2xl border p-5 shadow-sm"><div class="text-[10px] uppercase font-black text-ribacom-green">RIBACOM Community Event</div><h3 class="text-lg font-extrabold text-ribacom-navy mt-1">'+escv(e.title)+'</h3><div class="mt-3 space-y-1 text-xs text-gray-600"><p><b>When:</b> '+escv(fmt(e.event_date))+'</p><p><b>Where:</b> '+escv(e.location||'The Gambia')+'</p>'+(e.organizer?'<p><b>Organizer:</b> '+escv(e.organizer)+'</p>':'')+'</div><p class="text-sm text-gray-600 mt-3 whitespace-pre-line">'+escv(e.description||'')+'</p></article>';
    return '<div class="max-w-6xl mx-auto space-y-6 animate-fadeIn"><section class="bg-ribacom-navy text-white rounded-3xl p-7 sm:p-9 border-b-4 border-ribacom-gold"><div class="flex flex-wrap items-start justify-between gap-5"><div><span class="text-[10px] font-black uppercase tracking-widest text-ribacom-gold">RIBACOM Community Calendar</span><h2 class="text-3xl font-extrabold mt-2">Events & Meetings</h2><p class="text-sm text-gray-200 mt-2">Official community meetings, activities and approved events.</p></div>'+(canExecutive(this)?'<button onclick="app.navigate(\'executive-work\')" class="bg-ribacom-gold text-ribacom-navy px-4 py-2 rounded-xl text-xs font-extrabold">Executive Work Centre</button>':'')+'</div></section><section class="bg-white rounded-3xl border p-5"><div class="grid md:grid-cols-2 gap-4"><div><div class="text-[10px] font-black uppercase text-ribacom-green">Standing Meeting</div><h3 class="font-extrabold text-ribacom-navy mt-1">RIBACOM General Meeting</h3><p class="text-sm text-gray-600 mt-2">Every last Sunday of the month at 4:00 p.m.</p><p class="text-xs text-gray-500 mt-1">Agricultural Hall, Opposite St. Charles, Tabokoto Road, The Gambia.</p></div><div><div class="text-[10px] font-black uppercase text-ribacom-green">Official Calendar</div><p class="text-sm text-gray-600 mt-2">Only approved and published events appear in the public calendar.</p><p class="text-xs text-gray-500 mt-1">Executive submissions remain private until Presidential / Super Admin approval.</p></div></div></section><section><div class="flex items-end justify-between mb-3"><div><span class="text-[10px] font-black uppercase text-ribacom-green">Upcoming</span><h3 class="text-2xl font-extrabold text-ribacom-navy">Next Community Activities</h3></div><span class="text-xs text-gray-500">'+upcoming.length+' upcoming</span></div><div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">'+(upcoming.length?upcoming.map(card).join(''):'<div class="bg-white rounded-2xl border p-6 text-sm text-gray-500">No upcoming approved events are currently scheduled.</div>')+'</div></section>'+(past.length?'<section><h3 class="text-xl font-extrabold text-ribacom-navy mb-3">Recent Past Events</h3><div class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">'+past.slice(0,6).map(card).join('')+'</div></section>':'')+'</div>';
  };

  const oldNav=RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate=function(v,p=null){
    if(v==='events'){
      this.currentView=v;
      try{localStorage.setItem('ribacom_last_view',v)}catch(_){}
      const c=document.getElementById('appViewport');
      this.renderEventsCentre().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI()});
      return;
    }
    return oldNav.call(this,v,p);
  };
})();