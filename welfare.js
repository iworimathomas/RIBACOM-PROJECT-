/* RIBACOM D6 — welfare workflow. Amounts follow the Master Constitution settings. */
(function(){
  const fallbackAmounts={wedding:10000,birth:5000,loss_parent:15000,loss_spouse:15000,loss_child:15000,other:0};
  const getAmounts=()=>({wedding:Number(app?.db?.welfareSettings?.wedding?.amount||fallbackAmounts.wedding),birth:Number(app?.db?.welfareSettings?.birth?.amount||fallbackAmounts.birth),loss_parent:Number(app?.db?.welfareSettings?.loss_parent?.amount||fallbackAmounts.loss_parent),loss_spouse:Number(app?.db?.welfareSettings?.loss_spouse?.amount||fallbackAmounts.loss_spouse),loss_child:Number(app?.db?.welfareSettings?.loss_child?.amount||fallbackAmounts.loss_child),other:0});
  const amounts=new Proxy({}, {get:(t,k)=>getAmounts()[k]});
  const labels={wedding:'Wedding',birth:'Birth',loss_parent:'Loss of Parent',loss_spouse:'Loss of Spouse',loss_child:'Loss of Child',other:'Other'};
  window.RIBACOM_WELFARE_AMOUNTS=amounts;

  RibacomApp.prototype.handleWelfareSubmit = async function(e){
    e.preventDefault();
    if(!this.supabaseClient || !this.currentUser?.memberId) return this.toast('Please sign in as a member first.','warning');
    const category=document.getElementById('w_type')?.value || 'other';
    const description=(document.getElementById('w_desc')?.value || '').trim();
    if(!description) return this.toast('Please describe the welfare request.','warning');
    const amount=amounts[category] ?? 0;
    const {error}=await this.supabaseClient.from('welfare_requests').insert({member_id:this.currentUser.memberId,category,amount_requested:amount,description,status:'pending'});
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

  RibacomApp.prototype.renderWelfareD6Summary = function(){
    const rows=this.db.welfareRequests||[];
    return `<div class="bg-white rounded-2xl p-4 border"><h3 class="font-extrabold text-ribacom-navy">Welfare Benefits</h3><div class="grid grid-cols-2 gap-2 mt-3 text-xs">${Object.entries(amounts).filter(([k])=>k!=='other').map(([k,v])=>`<div class="bg-gray-50 rounded-xl p-3"><b>${labels[k]}</b><div class="text-ribacom-green font-extrabold mt-1">Up to D${v.toLocaleString()}</div></div>`).join('')}</div><p class="text-[10px] text-gray-500 mt-3">Final approval and payment remain subject to the applicable RIBACOM rules and Executive review.</p></div>`;
  };
})();
