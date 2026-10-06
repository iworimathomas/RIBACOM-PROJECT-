/* RIBACOM D6 — membership workflow. Supabase is authoritative. */
(function(){
  const regular = 'regular';
  const associate = 'associate';
  function clean(v){ return String(v ?? '').trim(); }
  function normalizeCategory(v){
    const s=String(v ?? '').trim().toLowerCase();
    if(s.includes('associate')) return associate;
    return regular;
  }
  function displayCategory(v){
    return normalizeCategory(v)===associate ? 'Associate Member' : 'Regular Member';
  }
  function normalizeStatus(v){
    const s=String(v ?? '').trim().toLowerCase().replace(/[- ]+/g,'_');
    return s || 'pending';
  }
  function displayStatus(v){
    const labels={pending:'Pending',under_review:'Under Review',approved:'Approved',rejected:'Rejected',suspended:'Suspended',active:'Active'};
    const s=normalizeStatus(v);
    return labels[s] || String(v ?? 'Pending').replace(/[_-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
  }
  window.RIBACOM_MEMBERSHIP_CATEGORIES = { regular, associate };

  RibacomApp.prototype.handleMembershipSubmit = async function(e){
    e.preventDefault();
    if(!this.supabaseClient) return this.toast('Supabase is not connected.','error');
    const val=id=>document.getElementById(id)?.value?.trim()||'';
    const checked=id=>!!document.getElementById(id)?.checked;
    const fullName=val('m_fullName'), phone=val('m_phone'), email=val('m_email').toLowerCase();
    const password=val('m_password'), confirm=val('m_passwordConfirm');
    const stateRaw=val('m_state'), lga=val('m_lga'), address=val('m_address'), photo=val('m_photo');
    const photoFile=document.getElementById('m_photo_file')?.files?.[0];
    if(photoFile){
      if(!photoFile.type.startsWith('image/')) return this.toast('Please select an image file.','warning');
      if(photoFile.size>5*1024*1024) return this.toast('Photo must be 5 MB or smaller.','warning');
    }
    if(!fullName||!phone||!email||!address||password.length<8) return this.toast('Please complete all required fields.','warning');
    if(password!==confirm) return this.toast('Passwords do not match.','warning');
    if(!checked('m_constitutionConsent') || !checked('m_declaration')) return this.toast('Please accept the Constitution consent and declaration before submitting.','warning');

    const state=stateRaw==='Rivers State'?'Rivers':stateRaw==='Bayelsa State'?'Bayelsa':'Other';
    const category=normalizeCategory(val('m_category'));
    const details={
      previous_name:val('m_otherName'),date_of_birth:val('m_dob'),gender:val('m_gender'),
      nationality:val('m_nationality')||'Nigerian',passport_or_id:val('m_idNumber'),
      origin_community:val('m_originCommunity'),clan_ward:val('m_clanWard'),
      previous_association:val('m_previousAssociation'),emergency_contact_name:val('m_emergencyName'),
      emergency_contact_phone:val('m_emergencyPhone'),spouse_name:val('m_spouse'),
      children_count:Number(val('m_children')||0),next_of_kin:val('m_nextOfKin'),
      next_of_kin_phone:val('m_nextOfKinPhone'),occupation:val('m_occupation'),
      employer_business:val('m_employer'),work_address:val('m_workAddress'),skills:val('m_skills'),
      interests:{welfare:checked('m_welfareInterest'),youth:checked('m_youthInterest'),cultural:checked('m_culturalInterest'),volunteer:checked('m_volunteer')},
      constitution_consent:checked('m_constitutionConsent'),information_declaration:checked('m_declaration'),
      application_status:'pending',monthly_dues:'D50'
    };

    let uploadedPhotoUrl=photo||null;
    if(photoFile){
      const ext=(photoFile.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      const path=`memberships/${crypto.randomUUID()}-${Date.now()}.${ext}`;
      const {data:up,error:upError}=await this.supabaseClient.storage.from('avatars').upload(path,photoFile,{contentType:photoFile.type,upsert:false,cacheControl:'3600'});
      if(upError) return this.toast('Photo upload failed: '+upError.message,'error');
      uploadedPhotoUrl=this.supabaseClient.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl;
    }
    this.toast('Creating your RIBACOM account…','info');
    const {data:authData,error:authError}=await this.supabaseClient.auth.signUp({
      email,password,options:{data:{full_name:fullName,phone,application_details:details}}
    });
    if(authError) return this.toast(authError.message,'error');
    const user=authData?.user;
    if(!user) return this.toast('Account creation did not return a user.','error');

    const {error:profileError}=await this.supabaseClient.from('profiles').upsert({id:user.id,email,full_name:fullName,phone},{onConflict:'id'});
    if(profileError) console.warn('Profile upsert:',profileError.message);

    // Save the complete application first. This is the authoritative application record.
    // RLS permits this insert for anon/authenticated users only when the declaration is accepted.
    const applicationPayload={
      user_id:user.id,full_name:fullName,date_of_birth:details.date_of_birth,gender:details.gender,
      nationality:details.nationality,place_of_birth:val('m_placeOfBirth'),state_of_origin:state,lga,
      town_village:val('m_townVillage'),community_clan:details.origin_community,phone,whatsapp:phone,email,
      current_address:address,area_location:val('m_areaLocation'),occupation:details.occupation,
      employer_business:details.employer_business,nigerian_passport_number:details.passport_or_id,
      membership_category:category,
      rivers_bayelsa_connection:state, father_name:val('m_fatherName'),mother_name:val('m_motherName'),
      spouse_name:details.spouse_name,date_of_arrival_gambia:val('m_arrivalGambia'),
      next_of_kin_name:details.next_of_kin,next_of_kin_relationship:val('m_nextOfKinRelationship'),
      next_of_kin_phone:details.next_of_kin_phone,emergency_contact_name:details.emergency_contact_name,
      emergency_contact_phone:details.emergency_contact_phone,preferred_contact_method:val('m_contactMethod')||'WhatsApp',
      photo_url:uploadedPhotoUrl,declaration_accepted:true,digital_signature:fullName,status:'pending',
      medical_emergency_information:val('m_medicalEmergency'),national_id_number:details.passport_or_id,
      proof_of_nigerian_origin_url:val('m_proofOfOrigin')
    };
    const {error:applicationError}=await this.supabaseClient.from('membership_applications').insert(applicationPayload);
    if(applicationError){
      this.toast('Application could not be saved: '+applicationError.message,'error');
      return;
    }

    // A membership row is created only after authentication is established.
    // The public/anon application path must not attempt the protected members INSERT policy.
    if(!authData.session){
      this.toast('Application saved successfully. Verify your email, then sign in. Your application remains pending Secretariat approval.','success');
      this.openLoginModal();
      return;
    }

    // Create the pending member row only when the authenticated session is available.
    // The membership application remains the authoritative record until Secretariat approval.
    const memberPayload={user_id:user.id,full_name:fullName,email,phone,state_of_origin:state,lga,address,photo_url:uploadedPhotoUrl,nationality:details.nationality,category,status:'pending'};
    const {error:memberError}=await this.supabaseClient.from('members').upsert(memberPayload,{onConflict:'user_id'});
    if(memberError){
      // Do not fail the application after the authoritative application row was saved.
      console.warn('Pending member sync:',memberError.message);
      this.toast('Application saved. Your member profile will be synchronized after verification.','success');
    }

    await this.hydrateCurrentUser(user); await this.loadCloudData();
    this.toast('Membership application submitted for Secretariat approval.','success');
    this.navigate('member-dashboard');
  };

  // Complete the Secretariat approval chain: application -> member -> membership number -> Digital ID.
  // This method is intentionally kept in the membership module so admin approval cannot
  // silently call a missing function and leave the application/member records out of sync.
  RibacomApp.prototype.approveMembershipApplication = async function(applicationId){
    if(!['admin','super_admin'].includes(String(this.currentUser?.roleKey||'').toLowerCase())) return this.toast('President / Super Admin or Admin approval required.','error');
    if(!this.supabaseClient) return this.toast('Supabase connection is unavailable.','error');
    const {data:application,error:applicationError}=await this.supabaseClient
      .from('membership_applications').select('*').eq('id',applicationId).maybeSingle();
    if(applicationError) return this.toast(applicationError.message,'error');
    if(!application) return this.toast('Membership application not found.','error');
    if(['approved','rejected','suspended'].includes(String(application.status||'').toLowerCase()) && application.status!=='approved')
      return this.toast('This application has already been decided.','warning');

    let member=null;
    const {data:existingMember,error:memberLookupError}=await this.supabaseClient
      .from('members').select('*').eq('user_id',application.user_id).maybeSingle();
    if(memberLookupError) return this.toast(memberLookupError.message,'error');
    member=existingMember;

    const category=String(application.membership_category||'regular').toLowerCase().includes('associate')?'associate':'regular';
    let membershipNumber=member?.membership_number||null;
    if(!membershipNumber){
      for(let attempt=0;attempt<12;attempt++){
        const candidate='RBC-GM-'+new Date().getFullYear()+'-'+String(Date.now()).slice(-6)+(attempt?'-'+attempt:'');
        const {data:conflict,error:checkError}=await this.supabaseClient.from('members').select('id').eq('membership_number',candidate).maybeSingle();
        if(checkError) return this.toast(checkError.message,'error');
        if(!conflict){membershipNumber=candidate;break;}
      }
    }
    if(!membershipNumber) return this.toast('Unable to generate a unique membership number.','error');

    const memberPayload={
      user_id:application.user_id,
      full_name:application.full_name,
      email:application.email,
      phone:application.phone,
      date_of_birth:application.date_of_birth||null,
      gender:application.gender||null,
      address:application.current_address||null,
      nationality:application.nationality||'Nigerian',
      state_of_origin:application.state_of_origin||null,
      lga:application.lga||null,
      rivers_bayelsa_connection:application.rivers_bayelsa_connection||null,
      category,
      status:'approved',
      dues_paid_until:null,
      membership_number:membershipNumber,
      photo_url:application.photo_url||null,
      emergency_contact_name:application.emergency_contact_name||null,
      emergency_contact_phone:application.emergency_contact_phone||null,
      updated_at:new Date().toISOString()
    };
    const {data:upsertedMember,error:memberError}=await this.supabaseClient
      .from('members').upsert(memberPayload,{onConflict:'user_id'}).select('*').maybeSingle();
    if(memberError) return this.toast('Member approval failed: '+memberError.message,'error');
    member=upsertedMember;

    const now=new Date().toISOString();
    const {error:applicationUpdateError}=await this.supabaseClient.from('membership_applications').update({
      status:'approved',reviewed_by:this.currentUser.id,reviewed_at:now,updated_at:now
    }).eq('id',applicationId);
    if(applicationUpdateError) return this.toast('Member was approved, but application synchronization failed: '+applicationUpdateError.message,'error');

    // Notify the applicant through the protected notification centre.
    const {error:notificationError}=await this.supabaseClient.from('notifications').insert({
      user_id:application.user_id,
      title:'Membership application approved',
      message:'Congratulations. Your RIBACOM membership application has been approved by the Secretariat. Your membership record and Digital ID are now being finalized.',
      type:'membership',
      link_route:'member-dashboard',
      is_read:false
    });
    if(notificationError) console.warn('Approval notification:',notificationError.message);

    await this.loadCloudData();
    const existingId=(this.db.digitalIds||[]).find(x=>x.memberId===member.id||x.member_id===member.id);
    if(!existingId && typeof this.createDigitalId==='function'){
      await this.createDigitalId(member.id);
    } else if(existingId){
      this.toast('Application approved. Digital ID is already available.','success');
      this.navigate('member-dashboard');
    } else {
      this.toast('Application approved and member record created, but Digital ID service is unavailable.','warning');
      this.navigate('admin-members');
    }
  };

  RibacomApp.prototype.renderMemberDashboardView = function(){
    const u=this.currentUser||{};
    const member=(this.db.members||[]).find(m=>m.id===u.memberId)||{};
    const application=((this.db.membershipApplications||[]).filter(a=>a.user_id===u.id).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0))[0])||{};
    const digital=(this.db.digitalIds||[]).find(d=>d.memberId===u.memberId||d.member_id===u.memberId||d.user_id===u.id||d.userId===u.id)||null;
    const status=String(member.status||application.status||u.status||'pending').toLowerCase();
    const statusLabel=status.charAt(0).toUpperCase()+status.slice(1);
    const badge=status==='approved'?'bg-emerald-100 text-emerald-800':status==='rejected'?'bg-red-100 text-red-800':status==='suspended'?'bg-amber-100 text-amber-800':'bg-blue-100 text-blue-800';
    const escv=v=>typeof esc==='function'?esc(v):String(v??'');
    const displayCat=v=>String(v||'regular').toLowerCase().includes('associate')?'Associate Member':'Regular Member';
    const notifications=Array.isArray(this.db.notifications)?this.db.notifications:[];
    const financeRows=(this.db.financeTransactions||[]).filter(x=>x.memberId===u.memberId||x.member_id===u.memberId);
    const confirmedIncome=financeRows.filter(x=>String(x.direction||'').toLowerCase()==='income' && String(x.status||'confirmed').toLowerCase()!=='voided');
    const duesRows=confirmedIncome.filter(x=>['monthly_dues','welfare_levy','registration'].includes(String(x.category||'').toLowerCase()));
    const settingsByKey=Object.fromEntries(Object.entries(this.db.welfareSettings||{}).map(([k,v])=>[k,Number(v?.amount||0)]));
    const monthlyDue=settingsByKey.monthly_dues||50, welfareLevy=settingsByKey.welfare_levy||200, registrationFee=settingsByKey.membership_application_fee||100;
    const startDate=new Date(member.created_at||application.created_at||Date.now()); startDate.setDate(1);
    const nowDate=new Date(); const monthsDue=Math.max(1,(nowDate.getFullYear()-startDate.getFullYear())*12+(nowDate.getMonth()-startDate.getMonth())+1);
    const expected={registration:registrationFee,monthly_dues:monthlyDue*monthsDue,welfare_levy:welfareLevy*monthsDue};
    const paid={registration:0,monthly_dues:0,welfare_levy:0};
    duesRows.forEach(x=>{const k=String(x.category||'').toLowerCase(); if(paid[k]!==undefined) paid[k]+=Number(x.amount||0);});
    const outstanding=status==='approved'?Object.keys(expected).reduce((s,k)=>s+Math.max(0,expected[k]-paid[k]),0):0;
    const duesPaid=duesRows.reduce((s,x)=>s+Number(x.amount||0),0);
    const welfareRows=(this.db.welfareRequests||[]).filter(x=>x.memberId===u.memberId||x.member_id===u.memberId).sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0);
    const latestWelfare=welfareRows[0]||null;
    const paymentSettings=(this.db.paymentSettings||[]).filter(x=>x.is_active!==false);
    const financeHtml='<div class="bg-white rounded-3xl p-6 card-shadow"><div class="flex flex-wrap items-start justify-between gap-3"><div><h3 class="font-extrabold text-ribacom-navy">Dues & Payment Record</h3><p class="text-xs text-gray-500 mt-1">Official payments recorded by the RIBACOM Finance Centre.</p></div><div class="flex flex-wrap gap-2"><span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">D'+duesPaid.toLocaleString()+' recorded</span><span class="px-3 py-1 rounded-full '+(outstanding>0?'bg-amber-100 text-amber-800':'bg-emerald-100 text-emerald-800')+' text-xs font-extrabold">D'+outstanding.toLocaleString()+' outstanding</span></div></div>'+(duesRows.length?'<div class="mt-4 space-y-2">'+duesRows.slice(0,8).map(x=>'<div class="flex flex-wrap justify-between gap-2 border-b py-2 text-xs"><span>'+escv(x.category)+'</span><b>D'+Number(x.amount||0).toLocaleString()+' · '+escv(String(x.created_at||'').slice(0,10))+'</b></div>').join('')+'</div>':'<div class="mt-4 grid sm:grid-cols-3 gap-2 text-xs">'+[['Registration',expected.registration,paid.registration],['Monthly Dues',expected.monthly_dues,paid.monthly_dues],['Welfare Levy',expected.welfare_levy,paid.welfare_levy]].map(x=>'<div class="border rounded-xl p-3"><span class="text-gray-500">'+x[0]+'</span><p class="font-bold mt-1">D'+x[2].toLocaleString()+' / D'+x[1].toLocaleString()+'</p></div>').join('')+'</div>')+(paymentSettings.length?'<div class="mt-5 pt-4 border-t"><p class="text-xs font-extrabold text-ribacom-navy mb-2">Available Payment Methods</p>'+paymentSettings.map(x=>'<div class="text-xs text-gray-600 mb-2"><b>'+escv(x.method_name)+'</b> · '+escv(x.account_name)+' · '+escv(x.account_number)+(x.bank_name?' · '+escv(x.bank_name):'')+'</div>').join('')+'</div>':'')+'</div>';
    const unreadNotifications=notifications.filter(n=>!n.is_read).length;
    const digitalHtml=digital ? '<div class="mt-4 space-y-3 text-sm"><div><span class="text-gray-500">ID Number</span><p class="font-extrabold text-ribacom-green">'+escv(digital.idCardNumber||digital.id_card_number)+'</p></div><div class="flex justify-between"><span class="text-gray-500">Status</span><b>'+escv(digital.status||'active')+'</b></div><div class="flex justify-between"><span class="text-gray-500">Expiry</span><b>'+escv((digital.expires_at||digital.expiresAt||'').slice(0,10)||'Perpetual')+'</b></div></div>' : '<p class="mt-4 text-sm text-gray-500">Your Digital ID will appear here after your membership is approved and the ID is issued.</p>';
    return '<div class="space-y-6 animate-fadeIn">'+
      '<div class="bg-ribacom-navy text-white rounded-3xl p-6 shadow-xl"><div class="flex flex-wrap items-center justify-between gap-4"><div><p class="text-xs uppercase tracking-widest text-white/60 font-bold">RIBACOM Member Portal</p><h2 class="text-2xl font-extrabold mt-1">Welcome, '+escv(u.fullName||member.fullName||'Member')+'</h2><p class="text-xs text-white/70 mt-1">Your membership information is connected to the RIBACOM Supabase database.</p></div><button onclick="app.navigate(\'home\')" class="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-xs font-bold">Public Home</button></div></div>'+
      '<div class="grid md:grid-cols-4 gap-4"><div class="bg-white rounded-2xl p-5 card-shadow"><p class="text-[11px] uppercase font-bold text-gray-400">Membership Status</p><div class="mt-3 inline-flex px-3 py-1 rounded-full text-xs font-extrabold '+badge+'">'+escv(statusLabel)+'</div></div>'+
      '<div class="bg-white rounded-2xl p-5 card-shadow"><p class="text-[11px] uppercase font-bold text-gray-400">Membership Number</p><p class="mt-3 text-lg font-extrabold text-ribacom-green">'+escv(member.membershipNo||member.membership_number||'Not issued')+'</p></div>'+
      '<div class="bg-white rounded-2xl p-5 card-shadow"><p class="text-[11px] uppercase font-bold text-gray-400">Digital ID</p><p class="mt-3 text-lg font-extrabold text-ribacom-navy">'+(digital?escv(digital.idCardNumber||digital.id_card_number):'Not issued')+'</p></div>'+
      '<button onclick="app.navigate(\'notifications\')" class="bg-white rounded-2xl p-5 card-shadow text-left hover:border-ribacom-green border border-transparent transition"><p class="text-[11px] uppercase font-bold text-gray-400">Notifications</p><p class="mt-3 text-lg font-extrabold '+(unreadNotifications?'text-ribacom-green':'text-gray-500')+'">'+unreadNotifications+' unread</p><p class="text-[11px] text-gray-500 mt-1">Open notification centre →</p></button></div>'+
      '<div class="grid lg:grid-cols-2 gap-5"><div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy">My Membership Application</h3><div class="mt-4 space-y-3 text-sm"><div class="flex justify-between gap-4"><span class="text-gray-500">Applicant</span><b>'+escv(application.full_name||member.fullName||u.fullName)+'</b></div><div class="flex justify-between gap-4"><span class="text-gray-500">Category</span><b>'+displayCat(application.membership_category||member.category||'regular')+'</b></div><div class="flex justify-between gap-4"><span class="text-gray-500">Application status</span><b>'+escv(statusLabel)+'</b></div></div></div>'+
      '<div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy">My Digital Identity</h3>'+digitalHtml+'</div></div>'+
      financeHtml+
      '<div class="bg-white rounded-3xl p-6 card-shadow"><h3 class="font-extrabold text-ribacom-navy mb-4">Member Services & Community</h3><div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">'+
      '<button onclick="app.navigate(\'member-profile\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">👤</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">My Profile</p></button>'+
      '<button onclick="app.navigate(\'digital-id\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">🪪</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Digital ID</p></button>'+
      '<button onclick="app.navigate(\'notifications\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">🔔</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Notifications</p></button>'+
      '<button onclick="app.navigate(\'announcements\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">📰</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">News</p></button>'+
      '<button onclick="app.navigate(\'events\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">📅</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Events</p></button>'+
      '<button onclick="app.navigate(\'publications\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">📚</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Publications</p></button>'+
      '<button onclick="app.navigate(\'gallery\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">🖼️</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Gallery</p></button>'+
      '<button onclick="app.navigate(\'welfare\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">🤝</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Welfare</p></button>'+'<div class="col-span-2 sm:col-span-1 p-4 rounded-2xl bg-gray-50 border"><span class="text-xl">🤝</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Latest Welfare</p><p class="text-[11px] text-gray-500 mt-1">'+(latestWelfare?escv(String(latestWelfare.status||'pending')):'No request')+'</p></div>'+
      '<button onclick="app.navigate(\'constitution\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">📜</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Constitution</p></button>'+
      '<button onclick="app.navigate(\'leadership\')" class="p-4 rounded-2xl bg-gray-50 hover:bg-gray-100 text-left"><span class="text-xl">🏛️</span><p class="mt-2 text-xs font-extrabold text-ribacom-navy">Leadership</p></button>'+
      '</div><div class="mt-4 flex flex-wrap gap-3"><button onclick="app.navigate(\'youth\')" class="bg-gray-100 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold">Youth Wing</button><button onclick="app.navigate(\'home\')" class="bg-ribacom-navy text-white px-4 py-2 rounded-xl text-xs font-bold">Back Home</button></div></div>'+
      '</div>';
  };

  RibacomApp.prototype.updateOwnMemberProfile = async function(patch){
    if(!this.supabaseClient || !this.currentUser?.memberId) return this.toast('Sign in to update your membership profile.','warning');
    const allowed={};
    ['full_name','phone','photo_url','address','lga','emergency_contact_name','emergency_contact_phone'].forEach(k=>{if(patch[k]!==undefined) allowed[k]=clean(patch[k])||null;});
    const {error}=await this.supabaseClient.from('members').update(allowed).eq('id',this.currentUser.memberId);
    if(error) return this.toast(error.message,'error');
    await this.loadCloudData();
    this.toast('Membership profile updated.','success');
    this.navigate('member-dashboard');
  };
  RibacomApp.prototype.renderMembershipReviewD7 = async function(){
    const role=String(this.currentUser?.roleKey||'').toLowerCase();
    if(!['super_admin','admin'].includes(role)){
      return '<div class="bg-white rounded-3xl border p-8 text-center text-red-600 font-bold">Super Admin access required.</div>';
    }
    if(!this.supabaseClient) return '<div class="bg-white rounded-3xl border p-8 text-center">Supabase connection unavailable.</div>';
    const {data:apps,error}=await this.supabaseClient.from('membership_applications').select('*').in('status',['pending','under_review']).order('created_at',{ascending:false});
    if(error) return '<div class="bg-white rounded-3xl border p-8 text-red-600">'+esc(error.message)+'</div>';
    const rows=apps||[];
    const cards=rows.length?rows.map(a=>{
      const safe=JSON.stringify(a).replace(/"/g,'&quot;');
      return '<div class="bg-white rounded-2xl border p-5"><div class="flex flex-wrap justify-between gap-3"><div><span class="text-[10px] font-black uppercase text-ribacom-green">Membership Application</span><h3 class="font-extrabold text-ribacom-navy mt-1">'+esc(a.full_name||'Applicant')+'</h3></div><span class="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">'+esc(displayStatus(a.status))+'</span></div><div class="grid sm:grid-cols-2 gap-3 mt-4 text-xs"><div><span class="text-gray-400">Email</span><p class="font-semibold">'+esc(a.email||'—')+'</p></div><div><span class="text-gray-400">Phone</span><p class="font-semibold">'+esc(a.phone||'—')+'</p></div><div><span class="text-gray-400">Category</span><p class="font-semibold">'+esc(displayCategory(a.membership_category))+'</p></div><div><span class="text-gray-400">Submitted</span><p class="font-semibold">'+esc(String(a.created_at||'').slice(0,10))+'</p></div></div><div class="mt-4 flex flex-wrap gap-2"><button onclick="app.reviewMembershipFromAdmin('+safe+')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-extrabold">Review / Approve</button><button onclick="app.rejectMembershipApplication('+JSON.stringify(a.id).replace(/"/g,'&quot;')+')" class="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold">Reject</button></div></div>';
    }).join(''):'<div class="bg-white rounded-2xl border p-8 text-center text-sm text-gray-500">No pending membership applications.</div>';
    return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] font-black uppercase text-ribacom-gold">Membership Administration</span><h2 class="text-2xl font-extrabold mt-1">Application Review</h2><p class="text-xs text-gray-300 mt-1">'+rows.length+' application(s) awaiting action.</p></div><div class="space-y-3">'+cards+'</div></div>';
  };

  RibacomApp.prototype.reviewMembershipFromAdmin = function(application){
    if(!application?.id) return this.toast('Application not found.','error');
    if(confirm('Approve this membership application?')) return this.approveMembershipApplication(application.id);
  };

  RibacomApp.prototype.rejectMembershipApplication = async function(applicationId){
    const role=String(this.currentUser?.roleKey||'').toLowerCase();
    if(!['super_admin','admin'].includes(role)) return this.toast('Super Admin approval required.','error');
    const reason=prompt('Reason for rejection:','')||'';
    if(!reason.trim()) return this.toast('A rejection reason is required.','warning');
    const {data:application,error:applicationLookupError}=await this.supabaseClient.from('membership_applications').select('id,user_id').eq('id',applicationId).maybeSingle();
    if(applicationLookupError) return this.toast(applicationLookupError.message,'error');
    if(!application) return this.toast('Membership application not found.','error');
    const {error}=await this.supabaseClient.from('membership_applications').update({
      status:'rejected',reviewed_by:this.currentUser.id,reviewed_at:new Date().toISOString(),admin_notes:reason.trim()
    }).eq('id',applicationId).in('status',['pending','under_review']);
    if(error) return this.toast(error.message,'error');
    const {error:notificationError}=await this.supabaseClient.from('notifications').insert({
      user_id:application.user_id,
      title:'Membership application update',
      message:'Your RIBACOM membership application was not approved. Reason: '+reason.trim(),
      type:'membership',
      link_route:'member-dashboard',
      is_read:false
    });
    if(notificationError) console.warn('Rejection notification:',notificationError.message);
    this.toast('Membership application rejected.','success');
    this.navigate('admin-members');
  };

})();
