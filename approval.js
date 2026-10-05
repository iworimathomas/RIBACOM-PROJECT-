/* RIBACOM Presidential Approval Centre */
(function(){
  const APPROVER=['super_admin','admin'];
  const EXEC=['treasurer','secretary_general','welfare_officer','pro','vice_president','assistant_secretary_general'];
  const canApprove=app=>APPROVER.includes(app?.currentUser?.roleKey);
  const canSubmit=app=>APPROVER.concat(EXEC).includes(app?.currentUser?.roleKey);
  const escv=v=>typeof esc==='function'?esc(v??''):String(v??'');
  const tableMap={
    announcement:'announcements',
    event:'events',
    gallery:'gallery',
    publication:'publications'
  };
  const typeLabel={announcement:'News / Announcement',event:'Event',gallery:'Gallery',publication:'Publication'};

  RibacomApp.prototype.approvalRows=async function(){
    if(!this.supabaseClient||!this.currentUser||!canSubmit(this)) return [];
    const {data,error}=await this.supabaseClient.from('approval_requests').select('*').order('submitted_at',{ascending:false});
    if(error){this.toast(error.message,'error');return []}
    return data||[];
  };

  RibacomApp.prototype.reviewApproval=async function(row,decision){
    if(!canApprove(this)) return this.toast('President / Super Admin approval required.','error');
    let comment='';
    if(decision==='rejected'){
      comment=prompt('Reason for rejection (required):','')||'';
      if(!comment.trim()) return this.toast('Please provide a rejection reason.','warning');
    }
    const table=tableMap[row.content_type];
    if(!table) return this.toast('Unsupported approval type.','error');
    const patch=decision==='approved'
      ? {is_published:true,approval_status:'approved',approved_by:this.currentUser.id,approved_at:new Date().toISOString(),approval_comment:null}
      : {is_published:false,approval_status:'rejected',approved_by:this.currentUser.id,approved_at:new Date().toISOString(),approval_comment:comment.trim()};
    const {error:e1}=await this.supabaseClient.from(table).update(patch).eq('id',row.content_id);
    if(e1) return this.toast(e1.message,'error');
    const {error:e2}=await this.supabaseClient.from('approval_requests').update({
      status:decision,reviewed_by:this.currentUser.id,reviewed_at:new Date().toISOString(),reviewer_comment:comment.trim()||null
    }).eq('id',row.id);
    if(e2) return this.toast(e2.message,'error');
    if(row.content_type==='publication'){
      const {data:pub}=await this.supabaseClient.from('publications').select('source_type,source_id').eq('id',row.content_id).maybeSingle();
      if(pub?.source_type==='election_results'&&pub?.source_id){
        await this.supabaseClient.from('elections').update({
          results_publication_status:decision==='approved'?'approved':'rejected',
          results_published_at:decision==='approved'?new Date().toISOString():null,
          results_published_by:decision==='approved'?this.currentUser.id:null,
          updated_at:new Date().toISOString()
        }).eq('id',pub.source_id);
        await this.supabaseClient.from('election_audit_logs').insert({
          election_id:pub.source_id,actor_user_id:this.currentUser.id,
          action:decision==='approved'?'results_publication_approved':'results_publication_rejected',
          details:{publication_id:row.content_id,reviewer_comment:comment.trim()||null}
        });
      }
    }
    this.toast(decision==='approved'?'Approved and published.':'Rejected and returned to the executive.','success');
    this.navigate('approval-center');
  };

  RibacomApp.prototype.renderApprovalCenter=async function(){
    if(!this.currentUser) return '<div class="bg-white rounded-3xl border p-8 text-center">Please sign in.</div>';
    if(!canSubmit(this)) return '<div class="bg-white rounded-3xl border p-8 text-center text-red-600 font-bold">Executive access required.</div>';
    const rows=await this.approvalRows();
    const pending=rows.filter(r=>r.status==='pending');
    const mine=rows.filter(r=>r.submitted_by===this.currentUser.id);
    const cards=rows.length?rows.map(r=>{
      const mineFlag=r.submitted_by===this.currentUser.id;
      const action=canApprove(this)&&r.status==='pending'
        ? '<div class="flex gap-2 mt-3"><button onclick="app.reviewApproval('+JSON.stringify(r).replace(/"/g,'&quot;')+',\'approved\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-extrabold">Approve & Publish</button><button onclick="app.reviewApproval('+JSON.stringify(r).replace(/"/g,'&quot;')+',\'rejected\')" class="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold">Reject</button></div>'
        : '';
      const badge=r.status==='approved'?'bg-emerald-100 text-emerald-700':r.status==='rejected'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700';
      return '<div class="bg-white rounded-2xl border p-4"><div class="flex flex-wrap justify-between gap-2"><div><span class="text-[10px] font-black uppercase text-ribacom-green">'+escv(typeLabel[r.content_type]||r.content_type)+'</span><h3 class="font-extrabold text-ribacom-navy">'+escv(r.title)+'</h3></div><span class="px-2 py-1 rounded-full text-[10px] font-bold '+badge+'">'+escv(r.status)+'</span></div><p class="text-xs text-gray-500 mt-2">Submitted '+escv((r.submitted_at||'').slice(0,10))+(mineFlag?' • Submitted by you':'')+'</p>'+(r.reviewer_comment?'<p class="mt-2 text-xs bg-gray-50 rounded-xl p-3"><b>President comment:</b> '+escv(r.reviewer_comment)+'</p>':'')+action+'</div>'
    }).join(''):'<div class="bg-white rounded-2xl border p-8 text-center text-sm text-gray-500">No approval requests yet.</div>';
    return '<div class="max-w-5xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] font-black uppercase text-ribacom-gold">RIBACOM Governance</span><h2 class="text-2xl font-extrabold mt-1">'+(canApprove(this)?'Presidential Approval Centre':'My Submissions')+'</h2><p class="text-xs text-gray-300 mt-1">'+(canApprove(this)?'No executive publication becomes public until you approve it.':'Submit official work for President / Super Admin approval before publication.')+'</p></div><div class="grid grid-cols-2 gap-3"><div class="bg-white border rounded-2xl p-4"><small>PENDING</small><div class="text-2xl font-extrabold text-amber-600">'+pending.length+'</div></div><div class="bg-white border rounded-2xl p-4"><small>MY SUBMISSIONS</small><div class="text-2xl font-extrabold">'+mine.length+'</div></div></div><div class="space-y-3">'+cards+'</div></div>';
  };

  RibacomApp.prototype.submitExecutiveWork=async function(type,e){
    e.preventDefault();
    if(!canSubmit(this)) return this.toast('Executive access required.','error');
    const form=e.currentTarget;
    const val=sel=>form.querySelector(sel)?.value?.trim()||'';
    let payload={};
    if(type==='announcement') payload={title:val('#ew_title'),content:val('#ew_content'),author_id:this.currentUser.id,submitted_by:this.currentUser.id,is_published:false,approval_status:'pending'};
    if(type==='event') payload={title:val('#ew_title'),description:val('#ew_content'),event_date:form.querySelector('[name="ew_date"]')?.value || form.querySelector('#ew_date')?.value||new Date().toISOString(),location:val('#ew_location'),organizer:val('#ew_organizer')||'RIBACOM Executive Body',submitted_by:this.currentUser.id,is_published:false,approval_status:'pending'};
    if(type==='publication') payload={title:val('#ew_title'),description:val('#ew_content'),file_url:val('#ew_url'),category:form.querySelector('[name="ew_category"]')?.value || form.querySelector('#ew_category')?.value||'general',publication_date:form.querySelector('#ew_date')?.value||new Date().toISOString().slice(0,10),submitted_by:this.currentUser.id,is_published:false,approval_status:'pending'};
    if(type==='gallery') payload={title:val('#ew_title'),caption:val('#ew_content'),image_url:val('#ew_url'),created_by:this.currentUser.id,submitted_by:this.currentUser.id,is_published:false,approval_status:'pending'};
    if(!payload.title) return this.toast('Please enter a title.','warning');
    const table=tableMap[type];
    const {data:created,error}=await this.supabaseClient.from(table).insert(payload).select('id,title').single();
    if(error) return this.toast(error.message,'error');
    const {error:approvalError}=await this.supabaseClient.from('approval_requests').insert({
      content_type:type,
      content_id:created.id,
      title:created.title || payload.title,
      submitted_by:this.currentUser.id,
      status:'pending'
    });
    if(approvalError){
      console.error('Approval request creation failed:',approvalError);
      return this.toast('Content saved as unpublished, but the approval request could not be created: '+approvalError.message,'error');
    }
    this.toast('Submitted to the President for approval. It is not public yet.','success');
    this.navigate('approval-center');
  };

  RibacomApp.prototype.renderExecutiveWorkCenter=function(){
    if(!canSubmit(this)) return '<div class="bg-white rounded-3xl border p-8 text-center text-red-600 font-bold">Executive access required.</div>';
    return '<div class="max-w-5xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] font-black uppercase text-ribacom-gold">Executive Portal</span><h2 class="text-2xl font-extrabold mt-1">Create Official Work</h2><p class="text-xs text-gray-300 mt-1">All official content goes to the President for approval before publication.</p></div><div class="grid sm:grid-cols-2 gap-4">
<form onsubmit="app.submitExecutiveWork('announcement',event)" class="bg-white border rounded-2xl p-5 space-y-3"><h3 class="font-extrabold text-ribacom-navy">News / Announcement</h3><input name="ew_title" id="ew_title" required placeholder="Title" class="w-full border rounded-xl p-2.5"><textarea name="ew_content" id="ew_content" required placeholder="Official content" class="w-full border rounded-xl p-2.5 h-28"></textarea><button class="w-full bg-ribacom-green text-white rounded-xl py-2.5 font-bold">Submit for Approval</button></form>
<form onsubmit="app.submitExecutiveWork('event',event)" class="bg-white border rounded-2xl p-5 space-y-3"><h3 class="font-extrabold text-ribacom-navy">Event / Meeting</h3><input id="ew_title" required placeholder="Event title" class="w-full border rounded-xl p-2.5"><input name="ew_date" id="ew_date" type="datetime-local" required class="w-full border rounded-xl p-2.5"><input name="ew_location" id="ew_location" required placeholder="Location" class="w-full border rounded-xl p-2.5"><textarea id="ew_content" required placeholder="Description" class="w-full border rounded-xl p-2.5 h-24"></textarea><input name="ew_organizer" id="ew_organizer" placeholder="Organizer" class="w-full border rounded-xl p-2.5"><button class="w-full bg-ribacom-green text-white rounded-xl py-2.5 font-bold">Submit for Approval</button></form>
<form onsubmit="app.submitExecutiveWork('publication',event)" class="bg-white border rounded-2xl p-5 space-y-3"><h3 class="font-extrabold text-ribacom-navy">Publication</h3><input id="ew_title" required placeholder="Publication title" class="w-full border rounded-xl p-2.5"><input name="ew_url" id="ew_url" required placeholder="Document URL" class="w-full border rounded-xl p-2.5"><select name="ew_category" id="ew_category" class="w-full border rounded-xl p-2.5"><option value="general">General</option><option value="notice">Notice</option><option value="report">Report</option><option value="meeting">Meeting</option><option value="election">Election</option></select><textarea id="ew_content" placeholder="Description" class="w-full border rounded-xl p-2.5 h-24"></textarea><button class="w-full bg-ribacom-green text-white rounded-xl py-2.5 font-bold">Submit for Approval</button></form>
<form onsubmit="app.submitExecutiveWork('gallery',event)" class="bg-white border rounded-2xl p-5 space-y-3"><h3 class="font-extrabold text-ribacom-navy">Gallery</h3><input id="ew_title" required placeholder="Photo title" class="w-full border rounded-xl p-2.5"><input id="ew_url" required placeholder="Image URL" class="w-full border rounded-xl p-2.5"><textarea id="ew_content" placeholder="Caption" class="w-full border rounded-xl p-2.5 h-24"></textarea><button class="w-full bg-ribacom-green text-white rounded-xl py-2.5 font-bold">Submit for Approval</button></form>
</div></div>';
  };

  const oldNav=RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate=function(v,p=null){
    if(v==='executive-work'){this.currentView=v;const c=document.getElementById('appViewport');if(c)c.innerHTML=this.renderExecutiveWorkCenter();this.updateAuthHeaderUI();return}
    if(v==='approval-center'){
      this.currentView=v;
      const c=document.getElementById('appViewport');
      this.renderApprovalCenter().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI()});
      return;
    }
    return oldNav.call(this,v,p);
  };

  const oldUpdate=RibacomApp.prototype.updateAuthHeaderUI;
  RibacomApp.prototype.updateAuthHeaderUI=function(){
    const result=oldUpdate?oldUpdate.call(this):undefined;
    setTimeout(()=>{
      const role=this.currentUser?.roleKey;
      let b=document.getElementById('ribacomApprovalBtn');
      if(!b){
        const footer=document.querySelector('footer .max-w-7xl');
        if(footer){
          const blocks=footer.querySelectorAll(':scope > div');
          const target=blocks[3];
          if(target){
            b=document.createElement('button');
            b.id='ribacomApprovalBtn';
            b.className='w-full mt-2 bg-white/10 hover:bg-white/20 text-white font-semibold py-2 px-3 rounded-lg transition text-xs flex items-center justify-center gap-2 border border-ribacom-gold/40';
            b.onclick=()=>this.navigate(canApprove(this)?'approval-center':'executive-work');
            target.appendChild(b);
          }
        }
      }
      if(b){
        const show=canSubmit(this);
        b.classList.toggle('hidden',!show);
        b.innerHTML=canApprove(this)?'<i class="fa-solid fa-check-double text-ribacom-gold"></i> Presidential Approval Centre':'<i class="fa-solid fa-pen-to-square text-ribacom-gold"></i> Executive Work Centre';
      }
    },0);
    return result;
  };
})();