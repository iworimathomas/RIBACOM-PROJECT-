/* RIBACOM D4 — Digital ID administration module */
(function () {
  function admin(app) { return !!app?.currentUser && String(app.currentUser.email||'').toLowerCase()==='iworimathomas@ymail.com' && app.currentUser.roleKey === 'super_admin'; }
  function esc(v) { return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
  function idNumber() { return `RBC-ID-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,8).toUpperCase()}`; }
  async function nextUniqueIdNumber(app) {
    for (let i=0;i<8;i++) {
      const candidate=idNumber();
      if (!app.supabaseClient) return candidate;
      const {data,error}=await app.supabaseClient.from('digital_ids').select('id').eq('id_card_number',candidate).maybeSingle();
      if (!error && !data) return candidate;
    }
    throw new Error('Unable to generate a unique Digital ID number. Please try again.');
  }
  function qr(member, number) { return `RIBACOM-GAMBIA|ID:${number}`; }

  RibacomApp.prototype.createDigitalId = async function(memberId) {
    if (String(this.currentUser?.roleKey||'').toLowerCase()!=='super_admin') return this.toast('President / Super Admin access required.','error');
    const {data:member,error:memberError}=await this.supabaseClient.from('members').select('*').eq('id',memberId).maybeSingle();
    if(memberError) return this.toast(memberError.message,'error');
    if(!member) return this.toast('Member not found.','error');
    if(String(member.status||'').toLowerCase()!=='approved') return this.toast('Only approved members can receive a Digital ID.','warning');
    const {data:existing,error:existingError}=await this.supabaseClient.from('digital_ids').select('id').eq('member_id',memberId).maybeSingle();
    if(existingError) return this.toast(existingError.message,'error');
    if(existing) return this.toast('This member already has a Digital ID.','warning');
    const number = await nextUniqueIdNumber(this), issued = new Date(), expiry = new Date(issued); expiry.setFullYear(expiry.getFullYear()+1);
    const {error} = await this.supabaseClient.from('digital_ids').insert({member_id:memberId,id_card_number:number,qr_code_data:qr(member,number),status:'active',issued_at:issued.toISOString(),expires_at:expiry.toISOString()});
    if (error) return this.toast(error.message,'error');

    const {error:notificationError}=await this.supabaseClient.from('notifications').insert({
      user_id:member.user_id,
      title:'Digital ID issued',
      message:'Your official RIBACOM Digital ID has been issued. Open your Member Dashboard to view your membership and Digital ID.',
      type:'digital_id',
      link_route:'digital-id',
      is_read:false
    });
    if(notificationError) console.warn('Digital ID notification:',notificationError.message);

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

  RibacomApp.prototype.verifyDigitalId = async function(idNumber) {
    const number=String(idNumber||'').trim();
    if(!number) return {valid:false,message:'Enter a Digital ID number.'};
    const {data,error}=await this.supabaseClient.from('digital_ids').select('id,id_card_number,status,expires_at,member_id').eq('id_card_number',number).maybeSingle();
    if(error) return {valid:false,message:error.message};
    if(!data) return {valid:false,message:'Digital ID not found.'};
    const expired=data.expires_at && new Date(data.expires_at).getTime()<Date.now();
    if(data.status!=='active') return {valid:false,message:`Digital ID status: ${String(data.status||'unknown')}.`};
    if(expired) return {valid:false,message:'Digital ID has expired.'};
    return {valid:true,id:data.id,idCardNumber:data.id_card_number,status:'active',expiresAt:data.expires_at};
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

  RibacomApp.prototype.renderDigitalIdView = function() {
    const currentMember=(this.db.members||[]).find(m => m.id===this.currentUser?.memberId || m.user_id===this.currentUser?.id);
    const mine=(this.db.digitalIds||[]).find(x => (x.memberId || x.member_id) === (currentMember?.id || this.currentUser?.memberId));
    const member=mine ? (this.db.members||[]).find(m => m.id === (mine.memberId || mine.member_id)) : currentMember;
    const idNumber=mine ? (mine.idCardNumber || mine.id_card_number || 'Pending') : '';
    const expiry=mine ? ((mine.expires_at || mine.expiresAt || '').slice(0,10) || '—') : '—';
    const status=String(mine?.status || 'active').toUpperCase();
    const photo=member?.photo_url || member?.profile_photo_url || member?.photo || member?.avatar_url || '';
    const memberName=member?.fullName || member?.full_name || this.currentUser?.fullName || this.currentUser?.full_name || 'RIBACOM Member';
    const category=member?.category || member?.membership_category || member?.member_type || 'Regular Member';
    const since=(member?.approved_at || member?.created_at || mine?.issued_at || mine?.issuedAt || '').slice(0,10) || '—';
    const state=member?.state_of_origin || member?.state || '—';
    const lga=member?.lga || member?.local_government_area || '—';
    const card=mine ? `
      <div class="ribacom-id-stack space-y-5">
        <article class="ribacom-id-card ribacom-id-front" aria-label="Front of RIBACOM Digital ID">
          <div class="ribacom-id-topline"></div>
          <div class="ribacom-id-front-head">
            <img src="/ribacom-official-logo.svg" alt="Official RIBACOM Crest" class="ribacom-id-crest">
            <div class="ribacom-id-brand"><div class="ribacom-id-org">RIVERS BAYELSA COMMUNITY</div><div class="ribacom-id-sub">IN DIASPORA — THE GAMBIA</div><div class="ribacom-id-acronym">RIBACOM</div><div class="ribacom-id-motto">TRUTH • UNITY • SERVICE</div></div>
          </div>
          <div class="ribacom-id-front-body">
            <div class="ribacom-id-details">
              <div class="ribacom-id-field"><span>MEMBER NAME</span><strong>${esc(memberName)}</strong></div>
              <div class="ribacom-id-field"><span>MEMBERSHIP ID</span><strong class="ribacom-id-number">${esc(idNumber)}</strong></div>
              <div class="ribacom-id-field"><span>MEMBER SINCE</span><strong>${esc(since)}</strong></div>
              <div class="ribacom-id-field"><span>CATEGORY</span><strong class="ribacom-id-category">${esc(category)}</strong></div>
              <div class="ribacom-id-field"><span>STATE OF ORIGIN</span><strong>${esc(state)}</strong></div>
              <div class="ribacom-id-field"><span>LGA</span><strong>${esc(lga)}</strong></div>
            </div>
            <div class="ribacom-id-photo-wrap">${photo ? `<img class="ribacom-id-photo" src="${esc(photo)}" alt="Member photograph" onerror="this.style.display='none'">` : '<div class="ribacom-id-photo ribacom-id-no-photo"><i class="fa-solid fa-user"></i><span>MEMBER PHOTO</span></div>'}<div class="ribacom-id-active">${esc(status)}</div></div>
            <div class="ribacom-id-qr-wrap"><div id="ribacomDigitalIdQr" class="ribacom-id-qr"></div><span>SCAN TO VERIFY</span></div>
          </div>
          <div class="ribacom-id-ribbon"><span>TRUTH</span><b>•</b><span>UNITY</span><b>•</b><span>SERVICE</span></div>
          <div class="ribacom-id-foot"><span>OFFICIAL DIGITAL MEMBERSHIP ID</span><span>VALID UNTIL: ${esc(expiry)}</span></div>
        </article>
        <article class="ribacom-id-card ribacom-id-back" aria-label="Back of RIBACOM Digital ID">
          <div class="ribacom-id-back-left"><img src="/ribacom-official-logo.svg" alt="Official RIBACOM Crest" class="ribacom-id-back-crest"><strong>RIBACOM</strong><span>RIVERS BAYELSA COMMUNITY<br>IN DIASPORA — THE GAMBIA</span><em>TRUTH • UNITY • SERVICE</em></div>
          <div class="ribacom-id-back-main">
            <div class="ribacom-id-back-title">THIS CARD CERTIFIES THAT</div>
            <p>The bearer identified on the front of this card is a registered member of Rivers Bayelsa Community in Diaspora – The Gambia (RIBACOM), subject to the community constitution, rules and regulations.</p>
            <ol><li>This card is non-transferable.</li><li>It remains the property of RIBACOM.</li><li>It must be presented upon request by an authorised officer.</li><li>If found, please return it to the RIBACOM Secretariat.</li></ol>
            <div class="ribacom-id-contact-title">OFFICIAL CONTACT</div>
            <div class="ribacom-id-contact"><span><i class="fa-solid fa-envelope"></i> ribacomgambia@gmail.com</span><span><i class="fa-solid fa-phone"></i> +220 77 991 1397</span><span><i class="fa-solid fa-globe"></i> ribacomgambia.vercel.app</span></div>
            <div class="ribacom-id-back-bottom"><span>ISSUED: ${esc((mine.issued_at || mine.issuedAt || '').slice(0,10) || since)}</span><span>VALID UNTIL: ${esc(expiry)}</span></div>
          </div>
        </article>
        <div class="flex flex-wrap gap-2 justify-end print:hidden"><button onclick="window.print()" class="bg-ribacom-navy text-white px-4 py-3 rounded-xl text-sm font-bold"><i class="fa-solid fa-print mr-2"></i>Print / Save ID</button></div>
      </div>` : `
      <div class="bg-white rounded-3xl p-7 text-center border border-dashed border-gray-300"><img src="/ribacom-official-logo.svg" alt="Official RIBACOM Crest" class="w-20 h-20 object-contain mx-auto mb-4"><h3 class="text-lg font-extrabold text-ribacom-navy">Your Digital ID is not available yet</h3><p class="text-sm text-gray-500 mt-2">Your Digital ID will appear here after your membership has been approved and the ID has been issued by RIBACOM.</p></div>`;
    return `
      <div class="max-w-6xl mx-auto space-y-5 animate-fadeIn">
        <div class="flex items-center justify-between gap-3 print:hidden">
          <div><h2 class="text-2xl font-extrabold text-ribacom-navy">Digital Identity</h2><p class="text-xs text-gray-500">Your official RIBACOM membership card. Keep your member details secure.</p></div>
          <button onclick="app.navigate('home')" class="px-4 py-2 rounded-xl bg-ribacom-navy text-white text-xs font-bold">Back</button>
        </div>
        ${card}
        <div class="bg-white rounded-3xl p-5 card-shadow print:hidden">
          <div class="flex items-center gap-3 mb-2"><i class="fa-solid fa-shield-halved text-ribacom-green"></i><h3 class="font-extrabold">Verify a RIBACOM Digital ID</h3></div>
          <p class="text-xs text-gray-500 mb-4">Enter the ID number printed on the card to check whether it is active and valid.</p>
          <form onsubmit="event.preventDefault(); app.verifyDigitalIdFromView();" class="flex flex-col sm:flex-row gap-2"><input id="ribacomDigitalIdVerifyInput" class="flex-1 border rounded-xl px-4 py-3 text-sm" placeholder="e.g. RBC-ID-2026-ABC123" autocomplete="off"><button type="submit" class="bg-ribacom-green text-white px-5 py-3 rounded-xl text-sm font-bold">Verify ID</button></form>
          <div id="ribacomDigitalIdVerifyResult" class="mt-4 hidden"></div>
        </div>
      </div>`;
  };

  RibacomApp.prototype.renderDigitalIdQr = function() {
    const box=document.getElementById('ribacomDigitalIdQr');
    if(!box || typeof QRCode==='undefined') return;
    const currentMember=(this.db.members||[]).find(m => m.id===this.currentUser?.memberId || m.user_id===this.currentUser?.id);
    const mine=(this.db.digitalIds||[]).find(x => (x.memberId || x.member_id) === (currentMember?.id || this.currentUser?.memberId));
    if(!mine) return;
    const data=mine.qrCodeData || mine.qr_code_data || ('RIBACOM-GAMBIA|ID:'+(mine.idCardNumber || mine.id_card_number));
    box.innerHTML='';
    new QRCode(box,{text:data,width:100,height:100,colorDark:'#0a2540',colorLight:'#ffffff'});
  };

  RibacomApp.prototype.verifyDigitalIdFromView = async function() {
    const input=document.getElementById('ribacomDigitalIdVerifyInput');
    const result=document.getElementById('ribacomDigitalIdVerifyResult');
    if(!input || !result) return;
    result.className='mt-4 rounded-xl border p-4 text-sm';
    result.textContent='Checking Digital ID…';
    result.classList.remove('hidden');
    const check=await this.verifyDigitalId(input.value);
    if(check.valid){
      result.className='mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800';
      result.innerHTML='<strong><i class="fa-solid fa-circle-check mr-1"></i> Digital ID is valid and active.</strong><div class="text-xs mt-1">ID: '+esc(check.idCardNumber)+' • Expires: '+esc((check.expiresAt||'').slice(0,10)||'—')+'</div>';
    }else{
      result.className='mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800';
      result.innerHTML='<strong><i class="fa-solid fa-circle-xmark mr-1"></i> Verification failed.</strong><div class="text-xs mt-1">'+esc(check.message||'Digital ID could not be verified.')+'</div>';
    }
  };

  const previousDigitalIdNav = RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate = function(view, params=null) {
    if(view === 'digital-id') {
      this.currentView=view;
      const container=document.getElementById('appViewport');
      if(container) { container.innerHTML=this.renderDigitalIdView(); setTimeout(()=>this.renderDigitalIdQr(),0); }
      this.updateAuthHeaderUI();
      return;
    }
    return previousDigitalIdNav.call(this, view, params);
  };

})();
