/* RIBACOM D4 — system verification */
(function(){
  const admin=a=>!!a?.currentUser&&['admin','super_admin'].includes(a.currentUser.roleKey);
  RibacomApp.prototype.runSystemVerification=async function(){
    if(!admin(this))return this.toast('Administrator access required.','error');
    const tables=['profiles','members','digital_ids','leadership','advisers','constitution','announcements','events','gallery','publications','youth_content','welfare_requests','payment_settings','ribacom_about_content','ribacom_content'];
    const results=[];
    for(const t of tables){const {error}=await this.supabaseClient.from(t).select('*',{count:'exact',head:true});results.push({table:t,ok:!error,error:error?.message||''});}
    const modal=document.createElement('div'); modal.id='ribacomSystemCheck'; modal.className='fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML=`<div class="bg-white rounded-3xl max-w-2xl w-full p-5 max-h-[90vh] overflow-y-auto"><div class="flex justify-between items-center mb-4"><div><h3 class="font-extrabold text-lg text-ribacom-navy">System Verification</h3><p class="text-xs text-gray-500">Live Supabase connectivity and table access check.</p></div><button onclick="document.getElementById('ribacomSystemCheck')?.remove()" class="text-xl">×</button></div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${results.map(r=>`<div class="border rounded-xl p-3"><div class="font-bold text-xs">${r.table}</div><div class="text-[11px] ${r.ok?'text-emerald-600':'text-red-600'}">${r.ok?'✓ Accessible':'✕ '+r.error}</div></div>`).join('')}</div></div>`;
    document.body.appendChild(modal);
  };
})();
