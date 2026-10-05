/* RIBACOM Member Profile & Digital Identity Centre */
(function(){
  RibacomApp.prototype.renderMemberProfile = async function(){
    if(!this.currentUser) return '<div class="p-8 text-center">Please sign in.</div>';
    const m=(this.db.members||[]).find(x=>x.id===this.currentUser.memberId)||{};
    const a=(this.db.membershipApplications||[]).filter(x=>x.user_id===this.currentUser.id).sort((x,y)=>new Date(y.created_at||0)-new Date(x.created_at||0))[0]||{};
    const d=(this.db.digitalIds||[]).find(x=>x.memberId===m.id||x.member_id===m.id)||null;
    const e=v=>typeof esc==='function'?esc(v):String(v??'—');
    const f=(l,v)=>'<div class="bg-gray-50 rounded-xl p-3"><div class="text-[10px] uppercase font-bold text-gray-400">'+l+'</div><div class="text-sm font-semibold mt-1 break-words">'+e(v||'—')+'</div></div>';
    return '<div class="max-w-5xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><div class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Member Centre</div><h2 class="text-2xl font-extrabold mt-1">My Profile & Digital Identity</h2><p class="text-xs text-white/70 mt-1">Your official membership information.</p></div>'+
    '<div class="bg-white rounded-3xl p-6 card-shadow"><div class="flex flex-wrap gap-4 items-center"><div class="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden border">'+(m.photoUrl?'<img src="'+e(m.photoUrl)+'" class="w-full h-full object-cover">':'<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fa-solid fa-user text-3xl"></i></div>')+'</div><div><h3 class="text-xl font-extrabold text-ribacom-navy">'+e(m.fullName||a.full_name)+'</h3><p class="text-sm text-gray-500">'+e(m.email||a.email)+'</p><p class="text-sm text-gray-500">'+e(m.phone||a.phone)+'</p></div></div></div>'+
    '<div class="grid md:grid-cols-3 gap-3">'+f('Membership Number',m.membershipNo||m.membership_number)+f('Status',m.status)+f('Category',a.membership_category||m.category)+f('State of Origin',m.stateOfOrigin||m.state_of_origin)+f('LGA',m.lga)+f('Nationality',m.nationality)+'</div>'+
    '<div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-3">Digital Identity</h3>'+(d?'<div class="grid md:grid-cols-3 gap-3">'+f('ID Card Number',d.idCardNumber||d.id_card_number)+f('Status',d.status)+f('Expiry',(d.expiresAt||d.expires_at||'').slice(0,10))+'</div><div class="mt-4"><button onclick="app.navigate(\'digital-id\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-bold">Open Digital ID</button></div>':'<p class="text-sm text-gray-500">Digital ID will appear after membership approval.</p>')+'</div>'+
    '<div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-3">Contact Information</h3><div class="grid md:grid-cols-2 gap-3">'+f('Address',m.address||a.current_address)+f('Emergency Contact',m.emergencyContactName||m.emergency_contact_name)+f('Emergency Phone',m.emergencyContactPhone||m.emergency_contact_phone)+f('LGA',m.lga)+'</div><p class="text-[11px] text-gray-400 mt-3">For changes to official identity or origin information, contact the RIBACOM Secretariat.</p></div>'+
    '<div class="flex flex-wrap gap-2"><button onclick="app.navigate(\'member-dashboard\')" class="bg-ribacom-navy text-white px-4 py-2 rounded-xl text-xs font-bold">Member Dashboard</button><button onclick="app.navigate(\'home\')" class="bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold">Home</button></div></div>';
  };
  const oldNav=RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate=function(v,p=null){
    if(v==='member-profile'){
      this.currentView=v; const c=document.getElementById('appViewport');
      Promise.resolve(this.renderMemberProfile()).then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()}); return;
    }
    return oldNav.call(this,v,p);
  };
})();