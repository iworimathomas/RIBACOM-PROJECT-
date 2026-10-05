/* RIBACOM D4 — Administration and CRUD module */
(function () {
  const isAdmin = a => !!a?.currentUser && ['admin','super_admin'].includes(a.currentUser.roleKey);
  const esc = v => String(v ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const val = id => document.getElementById(id)?.value?.trim() || '';

  RibacomApp.prototype.adminRefresh = async function(view='admin-dashboard') { await this.loadCloudData(); this.navigate(view); };

  RibacomApp.prototype.openAdminEditor = function(type,id='') {
    if(!isAdmin(this)) return this.toast('Administrator access required.','error');
    const existing = id ? (this.db[type]||[]).find(x=>x.id===id) : null;
    const title = id ? `Edit ${type}` : `Add ${type}`;
    const fields = {
      leadership:[['name','Name'],['position','Position'],['photo_url','Photo URL'],['biography','Biography'],['phone','Phone'],['email','Email']],
      advisers:[['name','Name'],['category','Category'],['photo_url','Photo URL'],['biography','Biography'],['phone','Phone']],
      announcements:[['title','Title'],['content','Content']],
      events:[['title','Title'],['description','Description'],['event_date','Date & time'],['location','Location'],['image_url','Image URL'],['organizer','Organizer']],
      publications:[['title','Title'],['description','Description'],['file_url','Document URL'],['category','Category'],['publication_date','Publication date']],
      youth_content:[['section_title','Section title'],['body_content','Body content'],['image_url','Image URL']],
      payment_settings:[['method_name','Method'],['account_name','Account name'],['account_number','Account number'],['bank_name','Bank name'],['instructions','Instructions']]
    }[type]||[];
    const body=fields.map(([k,l])=>`<label class="block text-xs font-bold text-gray-700 mb-2">${esc(l)}<input id="adm_${k}" value="${esc(existing?.[k])}" class="mt-1 w-full border rounded-xl px-3 py-2 text-sm" ${k.includes('biography')||k==='content'||k==='description'||k==='instructions'||k==='body_content'?'':'type="text"'}></label>`).join('')+
      ((type==='leadership'||type==='advisers') ? `<div class="mt-1 mb-3"><label class="block text-xs font-bold text-gray-700">Upload photo directly from phone<input id="adm_photo_file" type="file" accept="image/*" class="mt-1 w-full border rounded-xl px-3 py-2 text-sm bg-white"></label><p class="text-[10px] text-gray-500 mt-1">Choose a photo from your phone. It will be uploaded to RIBACOM Supabase Storage and saved automatically.</p></div>` : '');
    const modal=document.createElement('div'); modal.id='ribacomAdminEditor'; modal.className='fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4'; modal.innerHTML=`<div class="bg-white rounded-3xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto"><div class="flex justify-between items-center mb-4"><h3 class="font-extrabold text-lg text-ribacom-navy">${esc(title)}</h3><button onclick="document.getElementById('ribacomAdminEditor')?.remove()" class="text-xl">×</button></div>${body}<div class="flex gap-2 mt-4"><button onclick="app.saveAdminEditor('${type}','${id}')" class="flex-1 bg-ribacom-green text-white py-2.5 rounded-xl font-bold">Save</button><button onclick="document.getElementById('ribacomAdminEditor')?.remove()" class="px-5 bg-gray-100 rounded-xl font-bold">Cancel</button></div></div>`;
    document.body.appendChild(modal);
  };

  RibacomApp.prototype.uploadAdminPhoto = async function(type,id='') {
    const input=document.getElementById('adm_photo_file');
    const file=input?.files?.[0];
    if(!file) return '';
    if(!this.supabaseClient) throw new Error('Supabase is not connected.');
    if(!file.type.startsWith('image/')) throw new Error('Please select an image file.');
    if(file.size > 5*1024*1024) throw new Error('Photo must be 5 MB or smaller.');
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'') || 'jpg';
    const folder=type==='leadership'?'leadership':'advisers';
    const path=`${folder}/${id||crypto.randomUUID()}-${Date.now()}.${ext}`;
    const {data,error}=await this.supabaseClient.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:true,cacheControl:'3600'});
    if(error) throw error;
    return this.supabaseClient.storage.from('avatars').getPublicUrl(data.path).data.publicUrl;
  };

  RibacomApp.prototype.saveAdminEditor = async function(type,id='') {
    if(!isAdmin(this)) return;
    const schemas={leadership:['name','position','photo_url','biography','phone','email'],advisers:['name','category','photo_url','biography','phone'],announcements:['title','content'],events:['title','description','event_date','location','image_url','organizer'],publications:['title','description','file_url','category','publication_date'],youth_content:['section_title','body_content','image_url'],payment_settings:['method_name','account_name','account_number','bank_name','instructions']};
    const data={}; (schemas[type]||[]).forEach(k=>data[k]=val('adm_'+k));
    if(type==='leadership'||type==='advisers'){
      try {
        const uploadedPhoto=await this.uploadAdminPhoto(type,id);
        if(uploadedPhoto) data.photo_url=uploadedPhoto;
      } catch(e) { return this.toast(e.message,'error'); }
    }
    if(type==='leadership') data.display_order=Number(data.display_order||0),data.is_active=true;
    if(type==='advisers') data.is_active=true;
    if(['announcements','events','publications'].includes(type)) data.is_published=true;
    if(type==='payment_settings') data.is_active=true;
    if(type==='publications' && !data.publication_date) data.publication_date=new Date().toISOString().slice(0,10);
    if(type==='events' && !data.event_date) data.event_date=new Date().toISOString();
    if(type==='announcements') data.author_id=this.currentUser.id;
    let result;
    if(id) result=await this.supabaseClient.from(type).update(data).eq('id',id);
    else result=await this.supabaseClient.from(type).insert(data);
    if(result.error) return this.toast(result.error.message,'error');
    document.getElementById('ribacomAdminEditor')?.remove(); this.toast(`${type} saved successfully.`,'success'); await this.adminRefresh();
  };

  RibacomApp.prototype.saveWelfareSetting = async function(key) {
    if(!isAdmin(this)) return;
    const input=document.getElementById('wfs_'+key);
    const amount=Number(input?.value);
    if(!Number.isFinite(amount) || amount<0) return this.toast('Enter a valid non-negative amount.','error');
    const {error}=await this.supabaseClient.from('welfare_settings').update({amount,updated_at:new Date().toISOString()}).eq('setting_key',key);
    if(error) return this.toast(error.message,'error');
    this.toast('Financial setting updated.','success');
    await this.adminRefresh();
  };

  RibacomApp.prototype.renderWelfareFinancialSettings = function() {
    const s=this.db.welfareSettings||{};
    const rows=[
      ['membership_application_fee','Membership Application Form Fee',false],
      ['monthly_dues','Monthly Membership Dues',false],
      ['welfare_levy','Welfare Levy',false],
      ['wedding','Wedding Benefit',true],
      ['birth','Birthday Benefit',true],
      ['loss_parent','Loss of Parent Benefit',true],
      ['loss_spouse','Loss of Spouse Benefit',true],
      ['loss_child','Loss of Child Benefit',true]
    ];
    return '<div class="bg-white rounded-3xl p-5 card-shadow"><div class="flex flex-wrap items-center justify-between gap-3 mb-4"><div><h3 class="font-extrabold text-ribacom-navy">Welfare & Financial Settings</h3><p class="text-xs text-gray-500 mt-1">All amounts are in Gambian Dalasis (D). Welfare benefits are maximum limits.</p></div><span class="text-[10px] font-extrabold uppercase bg-emerald-50 text-ribacom-green px-3 py-1 rounded-full">Supabase controlled</span></div><div class="space-y-3">'+rows.map(([key,label,max])=>'<div class="border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3"><div class="flex-1"><div class="text-sm font-extrabold text-gray-800">'+esc(label)+'</div><div class="text-[10px] text-gray-500">'+(max?'Maximum benefit':'Fixed amount')+' • Gambian Dalasi (D)</div></div><div class="flex items-center gap-2"><span class="font-extrabold text-gray-500">D</span><input id="wfs_'+key+'" type="number" min="0" step="1" value="'+Number(s[key]?.amount||0)+'" class="w-32 border rounded-xl px-3 py-2 text-sm font-bold"><button onclick="app.saveWelfareSetting(\''+key+'\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-extrabold">Save</button></div></div>').join('')+'</div></div>';
  };

  RibacomApp.prototype.deleteAdminRecord = async function(table,id) {
    if(!isAdmin(this)) return;
    if(!confirm(`Delete this ${table} record? This cannot be undone.`)) return;
    const {error}=await this.supabaseClient.from(table).delete().eq('id',id); if(error)return this.toast(error.message,'error');
    this.toast('Record deleted.','success'); await this.adminRefresh();
  };

  RibacomApp.prototype.renderAdminDashboardView = function() {
    if(!isAdmin(this)) return '<div class="bg-white p-6 rounded-2xl">Administrator access required.</div>';
    const counts={members:(this.db.members||[]).length,ids:(this.db.digitalIds||[]).length,welfare:(this.db.welfareRequests||[]).length,leaders:(this.db.leadership||[]).length};
    const section=(title,table,items,fields)=>`<div class="bg-white rounded-3xl p-5 card-shadow"><div class="flex items-center justify-between mb-3"><h3 class="font-extrabold text-ribacom-navy">${title}</h3><button onclick="app.openAdminEditor('${table}')" class="bg-ribacom-green text-white px-3 py-2 rounded-xl text-xs font-bold">Add</button></div><div class="space-y-2">${items.slice(0,6).map(x=>`<div class="border rounded-xl p-3 flex items-center justify-between gap-2"><div><b class="text-sm">${esc(x.name||x.title||x.section_title||x.method_name)}</b><div class="text-[10px] text-gray-500">${esc(x.position||x.category||x.location||'')}</div></div><div class="whitespace-nowrap"><button onclick="app.openAdminEditor('${table}','${x.id}')" class="text-blue-600 text-xs font-bold mr-2">Edit</button><button onclick="app.deleteAdminRecord('${table}','${x.id}')" class="text-red-600 text-xs font-bold">Delete</button></div></div>`).join('')||'<p class="text-xs text-gray-500">No records yet.</p>'}</div></div>`;
    return `<div class="space-y-6 animate-fadeIn"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><div class="flex flex-wrap justify-between gap-4"><div><span class="text-ribacom-gold text-xs font-bold uppercase">RIBACOM Administration</span><h2 class="text-2xl font-extrabold mt-1">Control Centre</h2><p class="text-xs text-gray-300 mt-1">Manage the live Supabase records used by the public application.</p></div><div class="flex flex-wrap gap-2"><button onclick="app.navigate('admin-digital-ids')" class="bg-ribacom-gold text-ribacom-navy px-4 py-2 rounded-xl text-xs font-extrabold">Digital IDs</button><button onclick="app.openMembershipApplications()" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-extrabold"><i class="fa-solid fa-file-circle-check mr-1"></i> Membership Applications</button><button onclick="app.openExecutiveAccounts()" class="bg-white text-ribacom-navy px-4 py-2 rounded-xl text-xs font-extrabold"><i class="fa-solid fa-user-shield mr-1"></i> Executive Account Management</button></div></div></div><div class="grid grid-cols-2 md:grid-cols-4 gap-3">${[['Members',counts.members],['Digital IDs',counts.ids],['Welfare',counts.welfare],['Leadership',counts.leaders]].map(x=>`<div class="bg-white rounded-2xl p-4 card-shadow"><div class="text-[10px] text-gray-500 uppercase font-bold">${x[0]}</div><div class="text-2xl font-extrabold text-ribacom-navy">${x[1]}</div></div>`).join('')}</div><div class="bg-white rounded-3xl p-5 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-3">Member Applications</h3><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="bg-gray-50"><th class="p-2">Name</th><th class="p-2">Category</th><th class="p-2">Status</th><th class="p-2">Actions</th></tr></thead><tbody>${(this.db.members||[]).map(m=>`<tr class="border-b"><td class="p-2 font-bold">${esc(m.fullName)}</td><td class="p-2">${esc(m.category)}</td><td class="p-2">${esc(m.status)}</td><td class="p-2 whitespace-nowrap">${m.status==='pending'?`<button onclick="app.approveMember('${m.id}')" class="text-emerald-600 font-bold mr-2">Approve</button><button onclick="app.rejectMember('${m.id}')" class="text-amber-600 font-bold mr-2">Reject</button>`:''}${m.status==='approved'?`<button onclick="app.suspendMember('${m.id}')" class="text-amber-600 font-bold mr-2">Suspend</button>`:''}<button onclick="app.openMemberEditor('${m.id}')" class="text-blue-600 font-bold mr-2">Edit</button><button onclick="app.deleteMember('${m.id}')" class="text-red-600 font-bold">Delete</button></td></tr>`).join('')||'<tr><td colspan="4" class="p-4 text-center">No members.</td></tr>'}</tbody></table></div></div>${section('Leadership','leadership',this.db.leadership||[])}${section('Advisers','advisers',this.db.advisers||[])}${section('Announcements','announcements',this.db.announcements||[])}${section('Events','events',this.db.events||[])}${section('Publications','publications',this.db.publications||[])}${section('Youth Content','youth_content',this.db.youth?.id?[this.db.youth]:this.db.youth? [this.db.youth]:[])}${section('Payment Settings','payment_settings',this.db.paymentSettings||[])}${this.renderWelfareFinancialSettings()}</div>`;
  };

  RibacomApp.prototype.openMemberEditor = function(id) {
    if(!isAdmin(this)) return;
    const m=(this.db.members||[]).find(x=>x.id===id); if(!m)return;
    const modal=document.createElement('div'); modal.id='ribacomMemberEditor'; modal.className='fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML=`<div class="bg-white rounded-3xl max-w-lg w-full p-5"><h3 class="font-extrabold text-lg text-ribacom-navy mb-4">Edit Member</h3><label class="block text-xs font-bold mb-2">Full name<input id="me_name" value="${esc(m.fullName)}" class="mt-1 w-full border rounded-xl px-3 py-2"></label><label class="block text-xs font-bold mb-2">Phone<input id="me_phone" value="${esc(m.phone)}" class="mt-1 w-full border rounded-xl px-3 py-2"></label><label class="block text-xs font-bold mb-2">LGA<input id="me_lga" value="${esc(m.lga)}" class="mt-1 w-full border rounded-xl px-3 py-2"></label><label class="block text-xs font-bold mb-2">Address<input id="me_address" value="${esc(m.address)}" class="mt-1 w-full border rounded-xl px-3 py-2"></label><label class="block text-xs font-bold mb-4">State of origin<select id="me_state" class="mt-1 w-full border rounded-xl px-3 py-2"><option>Rivers</option><option>Bayelsa</option><option>Other</option></select></label><div class="flex gap-2"><button onclick="app.saveMemberEditor('${id}')" class="flex-1 bg-ribacom-green text-white py-2.5 rounded-xl font-bold">Save</button><button onclick="document.getElementById('ribacomMemberEditor')?.remove()" class="px-5 bg-gray-100 rounded-xl font-bold">Cancel</button></div></div>`;
    document.body.appendChild(modal); document.getElementById('me_state').value=m.stateOfOrigin||'Rivers';
  };
  RibacomApp.prototype.saveMemberEditor = async function(id) {
    if(!isAdmin(this))return; const patch={full_name:val('me_name'),phone:val('me_phone'),lga:val('me_lga'),address:val('me_address'),state_of_origin:val('me_state'),updated_at:new Date().toISOString()};
    const {error}=await this.supabaseClient.from('members').update(patch).eq('id',id); if(error)return this.toast(error.message,'error'); document.getElementById('ribacomMemberEditor')?.remove(); this.toast('Member updated.','success'); await this.adminRefresh();
  };
})();
/* D6 admin enhancements */
(function(){
  RibacomApp.prototype.approveWelfare = async function(id){
    return this.updateWelfareStatus(id,'approved');
  };
  RibacomApp.prototype.rejectWelfare = async function(id){
    return this.updateWelfareStatus(id,'rejected');
  };
})();
/* Executive Account Management — secure invitation workflow */
(function(){
  const execRoles=[
    ['super_admin','President / Super Admin'],
    ['vice_president','Vice President'],
    ['secretary_general','Secretary General'],
    ['assistant_secretary_general','Assistant Secretary General'],
    ['treasurer','Treasurer'],
    ['welfare_officer','Welfare Officer / Provost'],
    ['pro','Public Relations Officer']
  ];
  RibacomApp.prototype.openExecutiveAccounts = async function(){
    if(!['admin','super_admin'].includes(this.currentUser?.roleKey)) return this.toast('Administrator access required.','error');
    const {data,error}=await this.supabaseClient.from('executive_accounts').select('*').order('created_at',{ascending:false});
    if(error) return this.toast(error.message,'error');
    const rows=data||[], roleLabel=r=>execRoles.find(x=>x[0]===r)?.[1]||r||'Not set';
    const modal=document.createElement('div'); modal.id='ribacomExecutiveAccounts';
    modal.className='fixed inset-0 z-[110] bg-black/60 flex items-center justify-center p-4';
    modal.innerHTML=`<div class="bg-white rounded-3xl max-w-3xl w-full p-5 max-h-[92vh] overflow-y-auto">
      <div class="flex items-start justify-between gap-3 mb-4"><div><h3 class="font-extrabold text-xl text-ribacom-navy">Executive Account Management</h3><p class="text-xs text-gray-500 mt-1">Securely invite executives. Passwords are never entered or stored by RIBACOM.</p></div><button onclick="document.getElementById('ribacomExecutiveAccounts')?.remove()" class="text-xl text-gray-500">×</button></div>
      <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs text-emerald-800 mb-4"><b>Secure setup:</b> The invitation is sent by the protected Supabase Auth service. The executive creates their own password from the email invitation.</div>
      <form onsubmit="app.createExecutiveAccount(event)" class="grid md:grid-cols-2 gap-3 border rounded-2xl p-4 mb-5">
        <label class="text-xs font-bold">Executive Name<input id="exa_name" required class="mt-1 w-full border rounded-xl px-3 py-2"></label>
        <label class="text-xs font-bold">Email<input id="exa_email" type="email" required class="mt-1 w-full border rounded-xl px-3 py-2"></label>
        <label class="text-xs font-bold">Phone<input id="exa_phone" class="mt-1 w-full border rounded-xl px-3 py-2"></label>
        <label class="text-xs font-bold">RIBACOM Login ID<input id="exa_login" required placeholder="RIBACOM-SG" class="mt-1 w-full border rounded-xl px-3 py-2 uppercase"></label>
        <label class="text-xs font-bold md:col-span-2">Executive Role<select id="exa_role" required class="mt-1 w-full border rounded-xl px-3 py-2">${execRoles.map(x=>`<option value="${x[0]}">${x[1]}</option>`).join('')}</select></label>
        <button id="exa_submit" class="md:col-span-2 bg-ribacom-green text-white rounded-xl py-2.5 font-extrabold">Create & Send Secure Invitation</button>
      </form>
      <div class="space-y-2">${rows.map(x=>`<div class="border rounded-2xl p-3"><div class="flex flex-wrap justify-between gap-2"><div><b class="text-sm text-ribacom-navy">${esc(x.full_name)}</b><div class="text-xs text-gray-500">${esc(roleLabel(x.role))} • ${esc(x.login_id)}</div><div class="text-xs text-gray-500">${esc(x.email)} ${x.phone?'• '+esc(x.phone):''}</div></div><span class="text-[10px] font-extrabold px-2 py-1 rounded-full ${x.is_active?'bg-emerald-50 text-emerald-700':'bg-gray-100 text-gray-500'}">${x.is_active?'ACTIVE':'INACTIVE'} • ${x.auth_user_id?'INVITED / AUTH LINKED':'NOT INVITED'}</span></div></div>`).join('')||'<p class="text-xs text-gray-500 text-center py-5">No executive account records yet.</p>'}</div>
    </div>`;
    document.body.appendChild(modal);
  };
  RibacomApp.prototype.createExecutiveAccount = async function(e){
    e.preventDefault();
    if(!['admin','super_admin'].includes(this.currentUser?.roleKey)) return this.toast('Administrator access required.','error');
    const btn=document.getElementById('exa_submit'); if(btn){btn.disabled=true;btn.textContent='Sending secure invitation…';}
    const payload={login_id:document.getElementById('exa_login')?.value.trim().toUpperCase(),full_name:document.getElementById('exa_name')?.value.trim(),email:document.getElementById('exa_email')?.value.trim(),phone:document.getElementById('exa_phone')?.value.trim()||null,role:document.getElementById('exa_role')?.value};
    try{
      const {data,error}=await this.supabaseClient.functions.invoke('executive-account-invite',{body:payload});
      if(error) throw error; if(data?.error) throw new Error(data.error);
      this.toast('Secure invitation sent. The executive must use the email link to create their password.','success');
      await this.openExecutiveAccounts();
    }catch(err){
      let msg=err?.message||'Secure invitation failed.';
      try{if(err?.context?.body){const b=typeof err.context.body==='string'?JSON.parse(err.context.body):err.context.body;msg=b?.error||msg;}}catch(_){}
      this.toast(msg,'error');
    }finally{if(btn){btn.disabled=false;btn.textContent='Create & Send Secure Invitation';}}
  };
})();

/* Membership application review centre */
(function(){
  RibacomApp.prototype.openMembershipApplications = async function(){
    if(!['admin','super_admin'].includes(this.currentUser?.roleKey)) return this.toast('Administrator access required.','error');
    const {data,error}=await this.supabaseClient.from('membership_applications').select('*').order('created_at',{ascending:false});
    if(error) return this.toast(error.message,'error');
    const esc2=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const rows=data||[];
    const modal=document.createElement('div'); modal.id='ribacomApplications'; modal.className='fixed inset-0 z-[115] bg-black/60 flex items-center justify-center p-4';
    modal.innerHTML=`<div class="bg-white rounded-3xl max-w-5xl w-full max-h-[92vh] overflow-y-auto p-5"><div class="flex justify-between items-center mb-4"><div><h3 class="text-xl font-extrabold text-ribacom-navy">Membership Applications</h3><p class="text-xs text-gray-500">Review applications before issuing membership and Digital ID.</p></div><button onclick="document.getElementById('ribacomApplications')?.remove()" class="text-xl">×</button></div><div class="space-y-3">${rows.map(a=>`<div class="border rounded-2xl p-4"><div class="flex flex-wrap justify-between gap-3"><div><div class="font-extrabold text-ribacom-navy">${esc2(a.full_name)}</div><div class="text-xs text-gray-500">${esc2(a.membership_category)} • ${esc2(a.state_of_origin)} • ${esc2(a.lga)}</div><div class="text-xs text-gray-500">${esc2(a.email)} • ${esc2(a.phone)}</div><div class="text-xs text-gray-500 mt-1">${esc2(a.current_address||'')} </div></div><span class="text-[10px] font-extrabold uppercase px-2 py-1 rounded-full ${a.status==='approved'?'bg-emerald-50 text-emerald-700':a.status==='rejected'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700'}">${esc2(a.status)}</span></div><div class="flex flex-wrap gap-2 mt-3">${a.photo_url?`<a href="${esc2(a.photo_url)}" target="_blank" class="text-xs text-blue-600 font-bold">View Photo</a>`:''}${a.status==='pending'||a.status==='under_review'?`<button onclick="app.approveMembershipApplication('${a.id}')" class="bg-ribacom-green text-white px-3 py-2 rounded-xl text-xs font-bold">Approve & Create Membership</button><button onclick="app.rejectMembershipApplication('${a.id}')" class="bg-red-50 text-red-700 px-3 py-2 rounded-xl text-xs font-bold">Reject</button>`:''}</div></div>`).join('')||'<p class="text-sm text-gray-500 text-center py-8">No membership applications.</p>'}</div></div>`;
    document.body.appendChild(modal);
  };
  RibacomApp.prototype.approveMembershipApplication = async function(id){
    if(!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
    const {data:a,error:ae}=await this.supabaseClient.from('membership_applications').select('*').eq('id',id).maybeSingle();
    if(ae||!a) return this.toast(ae?.message||'Application not found.','error');
    if(!['pending','under_review'].includes(a.status)) return this.toast('This application has already been reviewed.','warning');
    const {data:existing}=await this.supabaseClient.from('members').select('id,membership_number').eq('user_id',a.user_id).maybeSingle();
    let membershipNumber=existing?.membership_number||null;
    if(!membershipNumber){
      for(let i=0;i<8;i++){
        const candidate=`RBC-GM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}${i?'-'+i:''}`;
        const {data:conflict,error:ce}=await this.supabaseClient.from('members').select('id').eq('membership_number',candidate).maybeSingle();
        if(ce) return this.toast(ce.message,'error');
        if(!conflict){ membershipNumber=candidate; break; }
      }
      if(!membershipNumber) return this.toast('Unable to generate a unique membership number. Please try again.','error');
    }
    const {data:m,error:me}=await this.supabaseClient.from('members').upsert({user_id:a.user_id,membership_number:membershipNumber,full_name:a.full_name,email:a.email,phone:a.phone,photo_url:a.photo_url,date_of_birth:a.date_of_birth,gender:a.gender,address:a.current_address,nationality:a.nationality||'Nigerian',state_of_origin:['Rivers','Bayelsa'].includes(a.state_of_origin)?a.state_of_origin:'Other',lga:a.lga,rivers_bayelsa_connection:a.rivers_bayelsa_connection,category:(a.membership_category||'').toLowerCase().includes('associate')?'associate':'regular',status:'approved',emergency_contact_name:a.emergency_contact_name,emergency_contact_phone:a.emergency_contact_phone,updated_at:new Date().toISOString()},{onConflict:'user_id'}).select().maybeSingle();
    if(me){this.toast(me.message,'error');return;}
    const memberId=m?.id||existing?.id;
    const issuedAt=new Date();
    const expiresAt=new Date(issuedAt); expiresAt.setFullYear(expiresAt.getFullYear()+1);
    const qr=`RIBACOM-GAMBIA|ID:${membershipNumber}|MEMBER:${memberId}|NAME:${a.full_name}`;
    const {data:existingDigitalId,error:deRead}=await this.supabaseClient.from('digital_ids').select('id,id_card_number,status,issued_at,expires_at').eq('member_id',memberId).maybeSingle();
    if(deRead){this.toast(deRead.message,'error');return;}
    const digitalPayload={member_id:memberId,id_card_number:membershipNumber,qr_code_data:qr,status:'active',issued_at:existingDigitalId?.issued_at||issuedAt.toISOString(),expires_at:expiresAt.toISOString()};
    const {error:de}=await this.supabaseClient.from('digital_ids').upsert(digitalPayload,{onConflict:'member_id'});
    if(de){this.toast(de.message,'error');return;}
    const {error:rv}=await this.supabaseClient.from('membership_applications').update({status:'approved',reviewed_by:this.currentUser.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
    if(rv){this.toast(rv.message,'error');return;}
    await this.loadCloudData(); this.toast(`Application approved. Membership ${membershipNumber} and Digital ID issued.`,'success'); await this.openMembershipApplications();
  };
  RibacomApp.prototype.rejectMembershipApplication = async function(id){
    if(!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
    const note=prompt('Reason for rejection (optional):')||null;
    const {error}=await this.supabaseClient.from('membership_applications').update({status:'rejected',admin_notes:note,reviewed_by:this.currentUser.id,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',id);
    if(error) return this.toast(error.message,'error'); this.toast('Membership application rejected.','warning'); await this.openMembershipApplications();
  };
})();
