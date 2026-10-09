/* RIBACOM Member Profile & Digital Identity Centre */
(function(){
  RibacomApp.prototype.renderMemberProfile = async function(){
    if(!this.currentUser) return '<div class="p-8 text-center">Please sign in.</div>';
    let m=(this.db.members||[]).find(x=>x.id===this.currentUser.memberId)||{};
    let a=(this.db.membershipApplications||[]).filter(x=>(x.user_id||x.userId)===this.currentUser.id).sort((x,y)=>new Date(y.created_at||0)-new Date(x.created_at||0))[0]||{};
    let d=(this.db.digitalIds||[]).find(x=>(x.memberId||x.member_id)===m.id)||null;
    // Load the signed-in member's own records directly, so this page does not depend on stale startup cache.
    if(this.supabaseClient && this.currentUser.id && !this.testMode){
      try {
        let mr=await this.supabaseClient.from('members').select('*').eq('user_id',this.currentUser.id).maybeSingle();
        // Some older RIBACOM records may be linked by the authenticated email rather than auth user id.
        // Only search the signed-in user's own email; never attach another member's record.
        if(!mr.data && this.currentUser.email){
          const byEmail=await this.supabaseClient.from('members').select('*').ilike('email',this.currentUser.email).maybeSingle();
          if(byEmail.data) mr=byEmail;
        }
        if(mr.data){
          m={...mr.data,fullName:mr.data.full_name||'',membershipNo:mr.data.membership_number||'',stateOfOrigin:mr.data.state_of_origin||'',photoUrl:mr.data.photo_url||'',emergencyContactName:mr.data.emergency_contact_name||'',emergencyContactPhone:mr.data.emergency_contact_phone||''};
          this.currentUser.memberId=m.id;
          this.db.members=[...(this.db.members||[]).filter(x=>x.id!==m.id),m];
          const dr=await this.supabaseClient.from('digital_ids').select('*').eq('member_id',m.id).maybeSingle();
          if(dr.data){d={...dr.data,memberId:dr.data.member_id,idCardNumber:dr.data.id_card_number,expiresAt:dr.data.expires_at};this.db.digitalIds=[...(this.db.digitalIds||[]).filter(x=>(x.memberId||x.member_id)!==m.id),d];}
          else d=null;
        }
        let ar=await this.supabaseClient.from('membership_applications').select('*').eq('user_id',this.currentUser.id).order('created_at',{ascending:false}).limit(1).maybeSingle();
        if(!ar.data && this.currentUser.email){
          const byEmail=await this.supabaseClient.from('membership_applications').select('*').ilike('email',this.currentUser.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
          if(byEmail.data) ar=byEmail;
        }
        if(ar.data)a=ar.data;
      } catch(err){console.warn('Member profile refresh failed:',err);}
    }
    const e=v=>typeof esc==='function'?esc(v):String(v??'—');
    const f=(l,v)=>'<div class="bg-gray-50 rounded-xl p-3"><div class="text-[10px] uppercase font-bold text-gray-400">'+l+'</div><div class="text-sm font-semibold mt-1 break-words">'+e(v||'—')+'</div></div>';
    return '<div class="max-w-5xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><div class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Member Centre</div><h2 class="text-2xl font-extrabold mt-1">My Profile & Digital Identity</h2><p class="text-xs text-white/70 mt-1">Your official membership information.</p></div>'+
    '<div class="bg-white rounded-3xl p-6 card-shadow"><div class="flex flex-wrap gap-4 items-center"><div class="w-24 h-24 rounded-2xl bg-gray-100 overflow-hidden border">'+(m.photoUrl?'<img src="'+e(m.photoUrl)+'" class="w-full h-full object-cover">':'<div class="w-full h-full flex items-center justify-center text-gray-400"><i class="fa-solid fa-user text-3xl"></i></div>')+'</div><div><h3 class="text-xl font-extrabold text-ribacom-navy">'+e(m.fullName||a.full_name)+'</h3><p class="text-sm text-gray-500">'+e(m.email||a.email)+'</p><p class="text-sm text-gray-500">'+e(m.phone||a.phone)+'</p></div></div></div>'+
    '<div class="grid md:grid-cols-3 gap-3">'+f('Membership Number',m.membershipNo||m.membership_number)+f('Membership Status',m.status||a.status)+f('Category',a.membership_category||m.category)+f('Email Address',m.email||a.email||this.currentUser.email)+f('Phone Number',m.phone||a.phone||this.currentUser.phone)+f('Date of Birth',m.date_of_birth||a.date_of_birth)+f('Gender',m.gender||a.gender)+f('State of Origin',m.stateOfOrigin||m.state_of_origin||a.state_of_origin)+f('LGA',m.lga||a.lga)+f('Nationality',m.nationality||a.nationality)+f('Date of Arrival',a.date_of_arrival_gambia)+f('Town / Village',a.town_village)+f('Occupation',a.occupation)+f('Employer / Business',a.employer_business)+f('Residential Address',m.address||a.current_address)+f('Area / Location',a.area_location)+f('Community Connection',m.rivers_bayelsa_connection||a.rivers_bayelsa_connection)+f('Emergency Contact Name',m.emergencyContactName||m.emergency_contact_name||a.emergency_contact_name)+f('Emergency Contact Phone',m.emergencyContactPhone||m.emergency_contact_phone||a.emergency_contact_phone)+'</div>'+
    '<div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-3">Digital Identity</h3>'+(d?'<div class="grid md:grid-cols-3 gap-3">'+f('ID Card Number',d.idCardNumber||d.id_card_number)+f('Status',d.status)+f('Expiry',(d.expiresAt||d.expires_at||'').slice(0,10))+'</div><div class="mt-4"><button onclick="app.navigate(\'digital-id\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-bold">Open Digital ID</button></div>':'<p class="text-sm text-gray-500">Digital ID will appear after membership approval.</p>')+'</div>'+
    '<div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-3">Profile Photograph</h3><p class="text-sm text-gray-500 mb-3">Upload a clear face photo from your phone. It will be saved to your member profile and displayed automatically on your Digital ID.</p><label for="mp_photo_file" class="flex min-h-14 w-full cursor-pointer items-center justify-center gap-3 rounded-xl border-2 border-dashed border-emerald-600 bg-emerald-50 px-4 py-4 text-center font-extrabold text-emerald-800"><span class="text-2xl">📷</span><span>Choose Photo from Device</span></label><input id="mp_photo_file" type="file" accept="image/*" capture="user" onchange="app.uploadMemberProfilePhoto(this)" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0)" aria-label="Choose profile photograph"><p class="text-xs text-gray-500 mt-2">JPG or PNG, maximum 5 MB.</p></div><div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-3">Edit My Contact Details</h3><form onsubmit="event.preventDefault();app.saveMemberProfileFromView()" class="grid md:grid-cols-2 gap-3">'+
    '<label class="text-xs font-bold text-gray-600">Full Name<input id="mp_full_name" value="'+e(m.fullName||m.full_name||a.full_name)+'" class="mt-1 w-full border rounded-xl p-3 text-sm"></label>'+
    '<label class="text-xs font-bold text-gray-600">Phone<input id="mp_phone" value="'+e(m.phone||a.phone)+'" class="mt-1 w-full border rounded-xl p-3 text-sm"></label>'+
    '<label class="text-xs font-bold text-gray-600">Address<input id="mp_address" value="'+e(m.address||a.current_address)+'" class="mt-1 w-full border rounded-xl p-3 text-sm"></label>'+
    '<label class="text-xs font-bold text-gray-600">LGA<input id="mp_lga" value="'+e(m.lga)+'" class="mt-1 w-full border rounded-xl p-3 text-sm"></label>'+
    '<label class="text-xs font-bold text-gray-600">Emergency Contact Name<input id="mp_emergency_name" value="'+e(m.emergencyContactName||m.emergency_contact_name)+'" class="mt-1 w-full border rounded-xl p-3 text-sm"></label>'+
    '<label class="text-xs font-bold text-gray-600">Emergency Contact Phone<input id="mp_emergency_phone" value="'+e(m.emergencyContactPhone||m.emergency_contact_phone)+'" class="mt-1 w-full border rounded-xl p-3 text-sm"></label>'+
    '<div class="md:col-span-2 flex flex-wrap gap-2"><button class="bg-ribacom-green text-white px-5 py-3 rounded-xl text-sm font-bold">Save Changes</button><button type="button" onclick="app.navigate(\'member-dashboard\')" class="bg-gray-100 px-5 py-3 rounded-xl text-sm font-bold">Cancel</button></div></form><p class="text-[11px] text-gray-400 mt-3">Membership number, status, category, role and official identity fields are protected and cannot be changed here.</p></div>'+
    '<div class="flex flex-wrap gap-2"><button onclick="app.navigate(\'member-dashboard\')" class="bg-ribacom-navy text-white px-4 py-2 rounded-xl text-xs font-bold">Member Dashboard</button><button onclick="app.navigate(\'home\')" class="bg-gray-100 px-4 py-2 rounded-xl text-xs font-bold">Home</button></div></div>';
  };
  RibacomApp.prototype.uploadMemberProfilePhoto = async function(input){
    const file=input?.files?.[0]; if(!file) return;
    if(!file.type?.startsWith('image/')) { this.toast('Please choose an image file.','warning'); input.value=''; return; }
    if(file.size>5*1024*1024) { this.toast('Photo must be 5 MB or smaller.','warning'); input.value=''; return; }
    if(!this.supabaseClient || !this.currentUser?.id) { this.toast('Please sign in again before uploading your photo.','error'); return; }
    try {
      const {data:memberResult,error:memberError}=await this.supabaseClient.from('members').select('id,photo_url').eq('user_id',this.currentUser.id).maybeSingle();
      if(memberError) throw memberError;
      if(!memberResult?.id) throw new Error('Your member record is not linked to this login yet.');
      const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      const path='member-id-photos/'+this.currentUser.id+'/'+Date.now()+'.'+ext;
      const {data:up,error:upError}=await this.supabaseClient.storage.from('avatars').upload(path,file,{contentType:file.type,upsert:true,cacheControl:'3600'});
      if(upError) throw upError;
      const photoUrl=this.supabaseClient.storage.from('avatars').getPublicUrl(up.path).data.publicUrl;
      if(!photoUrl) throw new Error('Could not create a photo URL.');
      const {error:updateError}=await this.supabaseClient.from('members').update({photo_url:photoUrl}).eq('id',memberResult.id);
      if(updateError) throw updateError;
      await this.loadCloudData();
      this.toast('Profile photo saved. It will appear on your profile and Digital ID.','success');
      this.navigate('member-profile');
    } catch(err) {
      console.error('[RIBACOM profile photo]',err);
      this.toast('Photo upload failed: '+(err?.message||'Please try again.'),'error');
    } finally { input.value=''; }
  };
  RibacomApp.prototype.saveMemberProfileFromView = async function(){
    const val=id=>document.getElementById(id)?.value||'';
    return this.updateOwnMemberProfile({
      full_name:val('mp_full_name'),
      phone:val('mp_phone'),
      photo_url:undefined,
      address:val('mp_address'),
      lga:val('mp_lga'),
      emergency_contact_name:val('mp_emergency_name'),
      emergency_contact_phone:val('mp_emergency_phone')
    });
  };
  const oldNav=RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate=function(v,p=null){
    if(v==='member-profile'){
      this.currentView=v; const c=document.getElementById('appViewport');
      Promise.resolve(this.renderMemberProfile()).then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()}); return;
    }
    return oldNav.call(this,v,p);
  };
})();