/* RIBACOM Secretariat Management Centre */
(function(){
  const ROLES=['super_admin','admin','secretary_general','assistant_secretary_general','welfare_officer','treasurer','vice_president','pro'];
  const canUse=app=>ROLES.includes(app?.currentUser?.roleKey);
  const escv=v=>typeof esc==='function'?esc(v??''):String(v??'');
  const fmt=d=>d?new Date(d).toLocaleString(): '—';
  const label=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,m=>m.toUpperCase());

  RibacomApp.prototype.syncSecretariatCases=async function(){
    if(!canUse(this)||!this.supabaseClient) return;
    const [apps,welfare]=await Promise.all([
      this.supabaseClient.from('membership_applications').select('id,full_name,status,user_id,created_at').in('status',['pending','under_review']),
      this.supabaseClient.from('welfare_requests').select('id,member_id,category,status,description,created_at').in('status',['pending','under_review'])
    ]);
    if(apps.error||welfare.error) return;
    for(const a of (apps.data||[])){
      await this.supabaseClient.from('secretariat_cases').upsert({
        case_type:'membership_application',source_type:'membership_application',source_id:a.id,
        title:'Membership Application — '+(a.full_name||'Applicant'),
        description:'Membership application awaiting Secretariat processing.',
        priority:'normal',status:a.status==='under_review'?'under_review':'new',submitted_by:a.user_id||null,
        updated_at:new Date().toISOString()
      },{onConflict:'source_type,source_id'});
    }
    for(const w of (welfare.data||[])){
      await this.supabaseClient.from('secretariat_cases').upsert({
        case_type:'welfare_request',source_type:'welfare_request',source_id:w.id,
        title:'Welfare Request — '+label(w.category),
        description:w.description||'Welfare request awaiting Secretariat processing.',
        priority:'high',status:w.status==='under_review'?'under_review':'new',
        updated_at:new Date().toISOString()
      },{onConflict:'source_type,source_id'});
    }
  };

  RibacomApp.prototype.secretariatCases=async function(){
    if(!canUse(this)) return [];
    await this.syncSecretariatCases();
    const {data,error}=await this.supabaseClient.from('secretariat_cases').select('*').order('updated_at',{ascending:false});
    if(error){this.toast(error.message,'error');return []}
    return data||[];
  };

  RibacomApp.prototype.updateSecretariatCase=async function(id,status,priority){
    if(!canUse(this)) return this.toast('Secretariat access required.','error');
    const {data:row,error:getErr}=await this.supabaseClient.from('secretariat_cases').select('status').eq('id',id).maybeSingle();
    if(getErr||!row) return this.toast(getErr?.message||'Case not found.','error');
    const patch={status,priority,updated_at:new Date().toISOString()};
    if(status==='completed'||status==='closed') patch.due_at=null;
    const {error}=await this.supabaseClient.from('secretariat_cases').update(patch).eq('id',id);
    if(error) return this.toast(error.message,'error');
    await this.supabaseClient.from('secretariat_case_actions').insert({
      case_id:id,action_type:'status_update',note:'Secretariat case updated.',
      from_status:row.status,to_status:status,actor_id:this.currentUser.id
    });
    this.toast('Secretariat case updated.','success');
    this.navigate('secretariat');
  };

  RibacomApp.prototype.secretariatExecutives=async function(){
    if(!canUse(this)||!this.supabaseClient) return [];
    const roles=['super_admin','secretary_general','assistant_secretary_general','welfare_officer','treasurer','vice_president','pro'];
    const {data,error}=await this.supabaseClient.from('profiles').select('id,full_name,role').in('role',roles).order('full_name');
    if(error) return [];
    return data||[];
  };

  RibacomApp.prototype.assignSecretariatCase=async function(id,assigneeId){
    if(!canUse(this)) return this.toast('Secretariat access required.','error');
    const {data:target,error:targetError}=await this.supabaseClient.from('profiles').select('id,full_name,role').eq('id',assigneeId).maybeSingle();
    if(targetError||!target) return this.toast('Selected executive could not be verified.','error');
    const {data:row,error:getErr}=await this.supabaseClient.from('secretariat_cases').select('assigned_to').eq('id',id).maybeSingle();
    if(getErr||!row) return this.toast(getErr?.message||'Case not found.','error');
    const {error}=await this.supabaseClient.from('secretariat_cases').update({assigned_to:assigneeId,updated_at:new Date().toISOString()}).eq('id',id);
    if(error) return this.toast(error.message,'error');
    await this.supabaseClient.from('secretariat_case_actions').insert({case_id:id,action_type:'assignment',note:'Case assigned to '+(target.full_name||'executive member')+'.',actor_id:this.currentUser.id});
    if(typeof this.sendMemberNotification==='function') await this.sendMemberNotification(assigneeId,'Secretariat Case Assigned','A RIBACOM Secretariat case has been assigned to you.','secretariat','secretariat');
    this.toast('Case assigned successfully.','success');
    this.navigate('secretariat');
  };

  // One-press approval from the Secretariat application card.
  // The existing membership approval routine performs the database workflow and enforces Super Admin permissions.
  RibacomApp.prototype.approveSecretariatMembershipCase=async function(caseId,applicationId){
    if(String(this.currentUser?.roleKey||'').toLowerCase()!=='super_admin')
      return this.toast('Only the President / Super Admin can approve membership applications.','error');
    if(!this.supabaseClient||typeof this.approveMembershipApplication!=='function')
      return this.toast('Membership approval service is unavailable.','error');
    if(!confirm('Approve this membership application now? This will create/update the member record, assign a membership number and attempt to issue a Digital ID.')) return;
    await this.approveMembershipApplication(applicationId);
    // Confirm the authoritative application state before closing its Secretariat case.
    const {data:application,error}=await this.supabaseClient.from('membership_applications').select('status').eq('id',applicationId).maybeSingle();
    if(error) return this.toast('Please verify the application status: '+error.message,'warning');
    if(String(application?.status||'').toLowerCase()!=='approved') return;
    const {data:caseRow}=await this.supabaseClient.from('secretariat_cases').select('status').eq('id',caseId).maybeSingle();
    const {error:caseError}=await this.supabaseClient.from('secretariat_cases').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',caseId);
    if(caseError) console.warn('Application approved, but Secretariat case update failed:',caseError.message);
    else await this.supabaseClient.from('secretariat_case_actions').insert({
      case_id:caseId,action_type:'membership_approved',note:'Membership application approved from the Secretariat Management Centre.',
      from_status:caseRow?.status||null,to_status:'completed',actor_id:this.currentUser.id
    });
    this.toast('Membership application approved.','success');
    this.navigate('secretariat');
  };

  RibacomApp.prototype.addSecretariatNote=async function(id){
    if(!canUse(this)) return;
    const note=prompt('Add Secretariat note:','');
    if(!note||!note.trim()) return;
    const {error}=await this.supabaseClient.from('secretariat_case_actions').insert({
      case_id:id,action_type:'note',note:note.trim(),actor_id:this.currentUser.id
    });
    if(error) return this.toast(error.message,'error');
    this.toast('Note recorded.','success');
    this.navigate('secretariat');
  };

  RibacomApp.prototype.renderSecretariat=async function(){
    if(!this.currentUser) return '<div class="bg-white rounded-3xl border p-8 text-center">Please sign in.</div>';
    if(!canUse(this)) return '<div class="bg-white rounded-3xl border p-8 text-center text-red-600 font-bold">Secretariat access required.</div>';
    const [rows,executives]=await Promise.all([this.secretariatCases(),this.secretariatExecutives()]);
    const counts={new:0,under_review:0,awaiting_information:0,completed:0};
    rows.forEach(r=>{if(counts[r.status]!==undefined)counts[r.status]++});
    const cards=rows.length?rows.map(r=>{
      const badge=r.status==='new'?'bg-blue-100 text-blue-700':r.status==='under_review'?'bg-amber-100 text-amber-700':r.status==='completed'?'bg-emerald-100 text-emerald-700':'bg-gray-100 text-gray-700';
      const pri=r.priority==='urgent'?'text-red-600':r.priority==='high'?'text-orange-600':'text-gray-500';
      return '<div class="bg-white border rounded-2xl p-4 shadow-sm"><div class="flex flex-wrap justify-between gap-2"><div><span class="text-[10px] font-black uppercase text-ribacom-green">'+escv(label(r.case_type))+'</span><h3 class="font-extrabold text-ribacom-navy">'+escv(r.title)+'</h3></div><span class="px-2 py-1 rounded-full text-[10px] font-bold '+badge+'">'+escv(label(r.status))+'</span></div><p class="text-xs text-gray-500 mt-2">'+escv(r.description||'')+'</p><div class="flex flex-wrap items-center gap-2 mt-3 text-[11px]"><span class="'+pri+' font-bold">Priority: '+escv(label(r.priority))+'</span><span class="text-gray-400">Updated: '+escv(fmt(r.updated_at))+'</span></div><div class="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3"><select onchange="app.updateSecretariatCase('+JSON.stringify(r.id)+',this.value,'+JSON.stringify(r.priority)+')" class="border rounded-xl p-2 text-xs"><option value="new" '+(r.status==='new'?'selected':'')+'>New</option><option value="under_review" '+(r.status==='under_review'?'selected':'')+'>Under Review</option><option value="awaiting_information" '+(r.status==='awaiting_information'?'selected':'')+'>Awaiting Information</option><option value="completed" '+(r.status==='completed'?'selected':'')+'>Completed</option><option value="closed" '+(r.status==='closed'?'selected':'')+'>Closed</option></select><select onchange="app.assignSecretariatCase('+JSON.stringify(r.id)+',this.value)" class="border rounded-xl p-2 text-xs"><option value="">Assign to...</option>'+executives.map(e=>'<option value="'+escv(e.id)+'" '+(r.assigned_to===e.id?'selected':'')+'>'+escv((e.full_name||'Executive')+' — '+label(e.role))+'</option>').join('')+'</select><select onchange="app.updateSecretariatCase('+JSON.stringify(r.id)+','+JSON.stringify(r.status)+',this.value)" class="border rounded-xl p-2 text-xs"><option value="low" '+(r.priority==='low'?'selected':'')+'>Low</option><option value="normal" '+(r.priority==='normal'?'selected':'')+'>Normal</option><option value="high" '+(r.priority==='high'?'selected':'')+'>High</option><option value="urgent" '+(r.priority==='urgent'?'selected':'')+'>Urgent</option></select><button onclick="app.addSecretariatNote('+JSON.stringify(r.id)+')" class="bg-ribacom-navy text-white rounded-xl p-2 text-xs font-bold">Add Note</button>'+(r.case_type==='membership_application'&&String(this.currentUser?.roleKey||'').toLowerCase()==='super_admin'?'<button onclick="app.approveSecretariatMembershipCase('+JSON.stringify(r.id)+','+JSON.stringify(r.source_id)+')" class="sm:col-span-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl p-3 text-sm font-extrabold shadow-sm"><i class="fa-solid fa-check-circle mr-2"></i>Approve Membership</button>':'')+'</div></div>';
    }).join(''):'<div class="bg-white border rounded-2xl p-8 text-center text-sm text-gray-500">No active Secretariat cases.</div>';
    return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] font-black uppercase text-ribacom-gold">RIBACOM Administration</span><h2 class="text-2xl font-extrabold mt-1">Secretariat Management Centre</h2><p class="text-xs text-gray-300 mt-1">Central inbox for membership and welfare matters, with status tracking and an administrative action trail.</p></div><div class="grid grid-cols-2 md:grid-cols-4 gap-3"><div class="bg-white border rounded-2xl p-4"><small>NEW</small><div class="text-2xl font-extrabold text-blue-600">'+counts.new+'</div></div><div class="bg-white border rounded-2xl p-4"><small>UNDER REVIEW</small><div class="text-2xl font-extrabold text-amber-600">'+counts.under_review+'</div></div><div class="bg-white border rounded-2xl p-4"><small>AWAITING INFO</small><div class="text-2xl font-extrabold">'+counts.awaiting_information+'</div></div><div class="bg-white border rounded-2xl p-4"><small>COMPLETED</small><div class="text-2xl font-extrabold text-emerald-600">'+counts.completed+'</div></div></div><div class="space-y-3">'+cards+'</div></div>';
  };

  const oldNav=RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate=function(v,p=null){
    if(v==='secretariat'){
      this.currentView=v;
      const c=document.getElementById('appViewport');
      this.renderSecretariat().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI()});
      return;
    }
    return oldNav.call(this,v,p);
  };

  const oldUpdate=RibacomApp.prototype.updateAuthHeaderUI;
  RibacomApp.prototype.updateAuthHeaderUI=function(){
    const result=oldUpdate?oldUpdate.call(this):undefined;
    setTimeout(()=>{
      if(!canUse(this)) return;
      let b=document.getElementById('ribacomSecretariatBtn');
      if(!b){
        const footer=document.querySelector('footer .max-w-7xl');
        if(footer){
          const blocks=footer.querySelectorAll(':scope > div');
          const target=blocks[3];
          if(target){
            b=document.createElement('button');
            b.id='ribacomSecretariatBtn';
            b.className='w-full mt-2 bg-ribacom-green hover:bg-emerald-700 text-white font-semibold py-2 px-3 rounded-lg transition text-xs flex items-center justify-center gap-2';
            b.onclick=()=>this.navigate('secretariat');
            b.innerHTML='<i class="fa-solid fa-folder-open text-ribacom-gold"></i> Secretariat Management';
            target.appendChild(b);
          }
        }
      }
    },0);
    return result;
  };
})();