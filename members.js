/* RIBACOM D6 — membership workflow. Supabase is authoritative. */
(function(){
  const regular = 'regular';
  const associate = 'associate';
  function clean(v){ return String(v ?? '').trim(); }
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

    const state=stateRaw==='Rivers State'?'Rivers':stateRaw==='Bayelsa State'?'Bayelsa':'Other';
    const category=val('m_category').toLowerCase().includes('associate')?'associate':'regular';
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

    // Create the membership record even when Supabase requires email verification.
    // This keeps the application in Pending status instead of losing the application.
    const memberPayload={user_id:user.id,full_name:fullName,email,phone,state_of_origin:state,lga,address,photo_url:uploadedPhotoUrl,nationality:details.nationality,category,status:'pending'};
    const {error:memberError}=await this.supabaseClient.from('members').upsert(memberPayload,{onConflict:'user_id'});
    if(memberError){
      this.toast(memberError.message,'error');
      return;
    }

    if(!authData.session){
      this.toast('Account created and membership application saved. Verify your email, then sign in. Your membership remains pending Secretariat approval.','success');
      this.openLoginModal(); return;
    }
    await this.hydrateCurrentUser(user); await this.loadCloudData();
    this.toast('Membership application submitted for Secretariat approval.','success');
    this.navigate('member-dashboard');
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
})();
