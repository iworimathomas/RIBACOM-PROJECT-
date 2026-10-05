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

  const oldNav=RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate=function(v,p=null){
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
            b.onclick=()=>this.navigate('approval-center');
            target.appendChild(b);
          }
        }
      }
      if(b){
        const show=canSubmit(this);
        b.classList.toggle('hidden',!show);
        b.innerHTML=canApprove(this)?'<i class="fa-solid fa-check-double text-ribacom-gold"></i> Presidential Approval Centre':'<i class="fa-solid fa-paper-plane text-ribacom-gold"></i> My Approval Submissions';
      }
    },0);
    return result;
  };
})();