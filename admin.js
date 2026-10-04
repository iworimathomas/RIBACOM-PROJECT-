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
    const body=fields.map(([k,l])=>`<label class="block text-xs font-bold text-gray-700 mb-2">${esc(l)}<input id="adm_${k}" value="${esc(existing?.[k])}" class="mt-1 w-full border rounded-xl px-3 py-2 text-sm" ${k.includes('biography')||k==='content'||k==='description'||k==='instructions'||k==='body_content'?'':'type="text"'}></label>`).join('');
    const modal=document.createElement('div'); modal.id='ribacomAdminEditor'; modal.className='fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4'; modal.innerHTML=`<div class="bg-white rounded-3xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto"><div class="flex justify-between items-center mb-4"><h3 class="font-extrabold text-lg text-ribacom-navy">${esc(title)}</h3><button onclick="document.getElementById('ribacomAdminEditor')?.remove()" class="text-xl">×</button></div>${body}<div class="flex gap-2 mt-4"><button onclick="app.saveAdminEditor('${type}','${id}')" class="flex-1 bg-ribacom-green text-white py-2.5 rounded-xl font-bold">Save</button><button onclick="document.getElementById('ribacomAdminEditor')?.remove()" class="px-5 bg-gray-100 rounded-xl font-bold">Cancel</button></div></div>`;
    document.body.appendChild(modal);
  };

  RibacomApp.prototype.saveAdminEditor = async function(type,id='') {
    if(!isAdmin(this)) return;
    const schemas={leadership:['name','position','photo_url','biography','phone','email'],advisers:['name','category','photo_url','biography','phone'],announcements:['title','content'],events:['title','description','event_date','location','image_url','organizer'],publications:['title','description','file_url','category','publication_date'],youth_content:['section_title','body_content','image_url'],payment_settings:['method_name','account_name','account_number','bank_name','instructions']};
    const data={}; (schemas[type]||[]).forEach(k=>data[k]=val('adm_'+k));
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
    return `<div class="space-y-6 animate-fadeIn"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><div class="flex flex-wrap justify-between gap-4"><div><span class="text-ribacom-gold text-xs font-bold uppercase">RIBACOM Administration</span><h2 class="text-2xl font-extrabold mt-1">Control Centre</h2><p class="text-xs text-gray-300 mt-1">Manage the live Supabase records used by the public application.</p></div><button onclick="app.navigate('admin-digital-ids')" class="bg-ribacom-gold text-ribacom-navy px-4 py-2 rounded-xl text-xs font-extrabold">Digital IDs</button></div></div><div class="grid grid-cols-2 md:grid-cols-4 gap-3">${[['Members',counts.members],['Digital IDs',counts.ids],['Welfare',counts.welfare],['Leadership',counts.leaders]].map(x=>`<div class="bg-white rounded-2xl p-4 card-shadow"><div class="text-[10px] text-gray-500 uppercase font-bold">${x[0]}</div><div class="text-2xl font-extrabold text-ribacom-navy">${x[1]}</div></div>`).join('')}</div><div class="bg-white rounded-3xl p-5 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-3">Member Applications</h3><div class="overflow-x-auto"><table class="w-full text-left text-xs"><thead><tr class="bg-gray-50"><th class="p-2">Name</th><th class="p-2">Category</th><th class="p-2">Status</th><th class="p-2">Actions</th></tr></thead><tbody>${(this.db.members||[]).map(m=>`<tr class="border-b"><td class="p-2 font-bold">${esc(m.fullName)}</td><td class="p-2">${esc(m.category)}</td><td class="p-2">${esc(m.status)}</td><td class="p-2 whitespace-nowrap">${m.status==='pending'?`<button onclick="app.approveMember('${m.id}')" class="text-emerald-600 font-bold mr-2">Approve</button><button onclick="app.rejectMember('${m.id}')" class="text-amber-600 font-bold mr-2">Reject</button>`:''}${m.status==='approved'?`<button onclick="app.suspendMember('${m.id}')" class="text-amber-600 font-bold mr-2">Suspend</button>`:''}<button onclick="app.openMemberEditor('${m.id}')" class="text-blue-600 font-bold mr-2">Edit</button><button onclick="app.deleteMember('${m.id}')" class="text-red-600 font-bold">Delete</button></td></tr>`).join('')||'<tr><td colspan="4" class="p-4 text-center">No members.</td></tr>'}</tbody></table></div></div>${section('Leadership','leadership',this.db.leadership||[])}${section('Advisers','advisers',this.db.advisers||[])}${section('Announcements','announcements',this.db.announcements||[])}${section('Events','events',this.db.events||[])}${section('Publications','publications',this.db.publications||[])}${section('Youth Content','youth_content',this.db.youth?.id?[this.db.youth]:this.db.youth? [this.db.youth]:[])}${section('Payment Settings','payment_settings',this.db.paymentSettings||[])}</div>`;
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
