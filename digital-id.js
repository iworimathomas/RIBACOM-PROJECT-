/* RIBACOM D4 — Digital ID administration module */
(function () {
  function admin(app) { return !!app?.currentUser && ['admin','super_admin'].includes(app.currentUser.roleKey); }
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function idNumber() { return `RBC-ID-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; }
  function qr(member, number) { return `RIBACOM-GAMBIA|ID:${number}|MEMBER:${member.id}|NAME:${member.full_name || member.fullName}`; }

  RibacomApp.prototype.createDigitalId = async function(memberId) {
    if (!admin(this)) return this.toast('Administrator access required.','error');
    const member = this.db.members.find(m => m.id === memberId);
    if (!member) return this.toast('Member not found.','error');
    if (member.status !== 'approved') return this.toast('Only approved members can receive a Digital ID.','warning');
    if (this.db.digitalIds.some(x => x.memberId === memberId || x.member_id === memberId)) return this.toast('This member already has a Digital ID.','warning');
    const number = idNumber(), issued = new Date(), expiry = new Date(issued); expiry.setFullYear(expiry.getFullYear()+1);
    const {error} = await this.supabaseClient.from('digital_ids').insert({member_id:memberId,id_card_number:number,qr_code_data:qr(member,number),status:'active',issued_at:issued.toISOString(),expires_at:expiry.toISOString()});
    if (error) return this.toast(error.message,'error');
    await this.loadCloudData(); this.toast('Digital ID issued successfully.','success'); this.navigate('admin-digital-ids');
  };

  RibacomApp.prototype.updateDigitalId = async function(id) {
    if (!admin(this)) return;
    const row = this.db.digitalIds.find(x=>x.id===id); if (!row) return;
    const number = prompt('Digital ID number:', row.idCardNumber); if (!number || number.trim()===row.idCardNumber) return;
    const {data: member} = await this.supabaseClient.from('members').select('id,full_name').eq('id',row.memberId || row.member_id).maybeSingle();
    const patch = {id_card_number:number.trim(), qr_code_data:qr(member || {id:row.memberId,full_name:''},number.trim())};
    const {error} = await this.supabaseClient.from('digital_ids').update(patch).eq('id',id);
    if (error) return this.toast(error.message,'error');
    await this.loadCloudData(); this.toast('Digital ID updated.','success'); this.navigate('admin-digital-ids');
  };

  RibacomApp.prototype.changeDigitalIdStatus = async function(id,status) {
    if (!admin(this)) return;
    if (!['active','suspended','revoked','expired'].includes(status)) return;
    const {error}=await this.supabaseClient.from('digital_ids').update({status}).eq('id',id);
    if(error)return this.toast(error.message,'error');
    await this.loadCloudData(); this.toast(`Digital ID ${status}.`,'success'); this.navigate('admin-digital-ids');
  };

  RibacomApp.prototype.renewDigitalId = async function(id) {
    if (!admin(this)) return;
    const row=this.db.digitalIds.find(x=>x.id===id); if(!row)return;
    const base=new Date(Math.max(Date.now(), row.expires_at ? new Date(row.expires_at).getTime() : Date.now()));
    base.setFullYear(base.getFullYear()+1);
    const {error}=await this.supabaseClient.from('digital_ids').update({expires_at:base.toISOString(),status:'active'}).eq('id',id);
    if(error)return this.toast(error.message,'error');
    await this.loadCloudData(); this.toast('Digital ID renewed for one year.','success'); this.navigate('admin-digital-ids');
  };

  RibacomApp.prototype.renderAdminDigitalIdsView = function() {
    if (!admin(this)) return '<div class="bg-white p-6 rounded-2xl">Administrator access required.</div>';
    const ids=this.db.digitalIds||[];
    const eligible=(this.db.members||[]).filter(m=>m.status==='approved'&&!ids.some(i=>i.memberId===m.id||i.member_id===m.id));
    const rows=ids.map(x=>{const m=(this.db.members||[]).find(z=>z.id===(x.memberId || x.member_id))||{}; return `<tr class="border-b"><td class="p-3 font-bold">${esc(m.fullName)}</td><td class="p-3 text-ribacom-green font-bold">${esc(x.idCardNumber)}</td><td class="p-3">${esc(x.status)}</td><td class="p-3">${esc(x.expires_at?.slice(0,10)||'—')}</td><td class="p-3 text-right whitespace-nowrap"><button onclick="app.updateDigitalId('${x.id}')" class="px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold">Edit</button> <button onclick="app.renewDigitalId('${x.id}')" class="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Renew</button> <button onclick="app.changeDigitalIdStatus('${x.id}','${x.status==='active'?'suspended':'active'}')" class="px-2 py-1 rounded bg-slate-100 text-xs font-bold">${x.status==='active'?'Suspend':'Activate'}</button> <button onclick="app.changeDigitalIdStatus('${x.id}','revoked')" class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold">Revoke</button></td></tr>`}).join('');
    return `<div class="space-y-5 animate-fadeIn"><div class="flex items-center justify-between gap-3"><div><h2 class="text-2xl font-extrabold text-ribacom-navy">Digital ID Administration</h2><p class="text-xs text-gray-500">Issue, edit, renew, activate, suspend and revoke official RIBACOM Digital IDs.</p></div><button onclick="app.navigate('admin-dashboard')" class="px-4 py-2 rounded-xl bg-ribacom-navy text-white text-xs font-bold">Back</button></div><div class="bg-white rounded-3xl p-5 card-shadow"><h3 class="font-extrabold mb-3">Approved Members Awaiting ID</h3>${eligible.length?eligible.map(m=>`<div class="flex items-center justify-between gap-3 border rounded-xl p-3 mb-2"><div><b>${esc(m.fullName)}</b><div class="text-[11px] text-gray-500">${esc(m.membershipNo||'No membership number')}</div></div><button onclick="app.createDigitalId('${m.id}')" class="bg-ribacom-green text-white px-3 py-2 rounded-lg text-xs font-bold">Issue ID</button></div>`).join(''):'<p class="text-xs text-gray-500">No approved members are waiting for a Digital ID.</p>'}</div><div class="bg-white rounded-3xl p-5 card-shadow overflow-x-auto"><h3 class="font-extrabold mb-3">Issued Digital IDs</h3><table class="w-full text-left text-xs"><thead><tr class="bg-gray-50"><th class="p-3">Member</th><th class="p-3">ID Number</th><th class="p-3">Status</th><th class="p-3">Expiry</th><th class="p-3 text-right">Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="p-6 text-center text-gray-500">No Digital IDs issued yet.</td></tr>'}</tbody></table></div></div>`;
  };
})();
