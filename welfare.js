/* RIBACOM D6 — welfare workflow. Amounts follow the Master Constitution settings. */
(function(){
  const fallbackAmounts={wedding:1000,birth:500,loss_parent:1500,loss_spouse:1500,loss_child:1500,other:0};
  const getAmounts=()=>({wedding:Number(app?.db?.welfareSettings?.wedding?.amount||fallbackAmounts.wedding),birth:Number(app?.db?.welfareSettings?.birth?.amount||fallbackAmounts.birth),loss_parent:Number(app?.db?.welfareSettings?.loss_parent?.amount||fallbackAmounts.loss_parent),loss_spouse:Number(app?.db?.welfareSettings?.loss_spouse?.amount||fallbackAmounts.loss_spouse),loss_child:Number(app?.db?.welfareSettings?.loss_child?.amount||fallbackAmounts.loss_child),other:0});
  const amounts=new Proxy({}, {get:(t,k)=>getAmounts()[k]});
  const labels={wedding:'Wedding',birth:'Birth',loss_parent:'Loss of Parent',loss_spouse:'Loss of Spouse',loss_child:'Loss of Child',other:'Other'};
  window.RIBACOM_WELFARE_AMOUNTS=amounts;

  RibacomApp.prototype.handleWelfareSubmit = async function(e){
    e.preventDefault();
    if(!this.supabaseClient || !this.currentUser) return this.toast('Please sign in as a member first.','warning');
    const {data:member,error:memberError}=await this.supabaseClient.from('members').select('id,status').eq('user_id',this.currentUser.id).maybeSingle();
    if(memberError) return this.toast(memberError.message,'error');
    if(!member) return this.toast('Your RIBACOM member record could not be found. Please complete membership registration.','warning');
    if(String(member.status||'').toLowerCase()!=='approved') return this.toast('Only approved RIBACOM members can submit welfare requests.','warning');
    const category=document.getElementById('w_type')?.value || 'other';
    const description=(document.getElementById('w_desc')?.value || '').trim();
    if(!description) return this.toast('Please describe the welfare request.','warning');
    const amount=amounts[category] ?? 0;
    const {error}=await this.supabaseClient.from('welfare_requests').insert({member_id:member.id,category,amount_requested:amount,description,status:'pending'});
    if(error) return this.toast(error.message,'error');
    await this.loadCloudData();
    this.toast('Welfare request submitted for Executive review.','success');
    this.navigate('welfare');
  };

  RibacomApp.prototype.updateWelfareStatus = async function(id,status,approvedAmount=null,notes=''){
    if(!['admin','super_admin'].includes(this.currentUser?.roleKey)) return this.toast('Administrator access required.','error');
    const patch={status,admin_notes:notes||null};
    if(approvedAmount!==null && approvedAmount!=='') patch.approved_amount=Number(approvedAmount);
    if(status==='paid' && !patch.approved_amount){
      const row=(this.db.welfareRequests||[]).find(x=>x.id===id); if(row) patch.approved_amount=row.amount_requested;
    }
    const {error}=await this.supabaseClient.from('welfare_requests').update(patch).eq('id',id);
    if(error) return this.toast(error.message,'error');
    await this.loadCloudData(); this.toast(`Welfare request marked ${status}.`,'success'); this.navigate('admin-dashboard');
  };

  RibacomApp.prototype.renderWelfareView = function(){
    const u=this.currentUser||{};
    if(!u.id) return '<div class="bg-white rounded-3xl border p-8 text-center"><h2 class="font-extrabold text-ribacom-navy">Welfare Centre</h2><p class="mt-2 text-gray-600">Please sign in to access welfare services.</p><button onclick="app.openLoginModal()" class="mt-4 bg-ribacom-green text-white px-5 py-2 rounded-xl font-bold">Sign In</button></div>';
    const member=(this.db.members||[]).find(m=>m.id===u.memberId)||{};
    const approved=String(member.status||u.status||'').toLowerCase()==='approved';
    const rows=(this.db.welfareRequests||[]).filter(r=>r.member_id===member.id||r.memberId===member.id);
    const benefitCards=Object.entries(labels).filter(([k])=>k!=='other').map(([k,v])=>'<div class="bg-gray-50 rounded-xl p-3"><b>'+v+'</b><div class="text-ribacom-green font-extrabold mt-1">D'+Number(amounts[k]||0).toLocaleString()+'</div></div>').join('');
    const history=rows.length?rows.map(r=>'<div class="border rounded-xl p-3"><div class="flex justify-between gap-3"><b>'+((labels[r.category])||r.category||'Welfare')+'</b><span class="text-xs font-bold">'+(r.status||'pending')+'</span></div><p class="text-xs text-gray-600 mt-1">'+(r.description||'')+'</p><div class="text-xs mt-2">Requested: D'+Number(r.amount_requested||0).toLocaleString()+'</div></div>').join(''):'<p class="text-sm text-gray-500">No welfare requests submitted yet.</p>';
    return '<div class="max-w-4xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><h2 class="text-2xl font-extrabold">RIBACOM Welfare Centre</h2><p class="text-sm opacity-90 mt-1">Member welfare support under the RIBACOM welfare rules.</p><div class="mt-3 text-xs">Membership status: <b>'+ (member.status||u.status||'Unknown') +'</b></div></div>'+this.renderWelfareD6Summary()+(approved?'<div class="bg-white rounded-3xl p-6 border"><h3 class="font-extrabold text-ribacom-navy">Submit Welfare Request</h3><form onsubmit="app.handleWelfareSubmit(event)" class="mt-4 space-y-4"><select id="w_type" class="w-full border rounded-xl px-4 py-3" required><option value="">Select benefit type</option>'+Object.entries(labels).map(([k,v])=>'<option value="'+k+'">'+v+(k!=='other'?' — up to D'+Number(amounts[k]||0).toLocaleString():'')+'</option>').join('')+'</select><textarea id="w_desc" rows="4" class="w-full border rounded-xl px-4 py-3" placeholder="Describe your welfare request..." required></textarea><button class="bg-ribacom-green text-white px-5 py-3 rounded-xl font-bold">Submit Welfare Request</button></form></div>':'<div class="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900">Welfare requests are available only after your membership has been approved.</div>')+'<div class="bg-white rounded-3xl p-6 border"><h3 class="font-extrabold text-ribacom-navy">My Welfare Requests</h3><div class="mt-4 space-y-3">'+history+'</div></div></div>';
  };

  RibacomApp.prototype.renderWelfareD6Summary = function(){
    const rows=this.db.welfareRequests||[];
    return `<div class="bg-white rounded-2xl p-4 border"><h3 class="font-extrabold text-ribacom-navy">Welfare Benefits</h3><div class="grid grid-cols-2 gap-2 mt-3 text-xs">${Object.entries(amounts).filter(([k])=>k!=='other').map(([k,v])=>`<div class="bg-gray-50 rounded-xl p-3"><b>${labels[k]}</b><div class="text-ribacom-green font-extrabold mt-1">Up to D${v.toLocaleString()}</div></div>`).join('')}</div><p class="text-[10px] text-gray-500 mt-3">Final approval and payment remain subject to the applicable RIBACOM rules and Executive review.</p></div>`;
  };
})();
