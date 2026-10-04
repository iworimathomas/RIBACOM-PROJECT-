/* RIBACOM D6 — membership workflow. Supabase is authoritative. */
(function(){
  const regular = 'regular';
  const associate = 'associate';
  function clean(v){ return String(v ?? '').trim(); }
  window.RIBACOM_MEMBERSHIP_CATEGORIES = { regular, associate };

  RibacomApp.prototype.handleMembershipSubmit = async function(e){
    e.preventDefault();
    if(!this.supabaseClient){ return this.toast('Supabase is not connected.','error'); }
    const fullName=clean(document.getElementById('m_fullName')?.value);
    const phone=clean(document.getElementById('m_phone')?.value);
    const email=clean(document.getElementById('m_email')?.value).toLowerCase();
    const password=document.getElementById('m_password')?.value || '';
    const stateRaw=clean(document.getElementById('m_state')?.value);
    const lga=clean(document.getElementById('m_lga')?.value);
    const address=clean(document.getElementById('m_address')?.value);
    const photo=clean(document.getElementById('m_photo')?.value);
    const categoryRaw=clean(document.getElementById('m_category')?.value);
    const state = stateRaw === 'Rivers State' ? 'Rivers' : stateRaw === 'Bayelsa State' ? 'Bayelsa' : 'Other';
    const category = categoryRaw.toLowerCase().includes('associate') ? associate : regular;
    if(!fullName || !phone || !email || password.length < 8 || !address) return this.toast('Please complete all required fields.','warning');

    this.toast('Creating your RIBACOM account…','info');
    const {data:authData,error:authError}=await this.supabaseClient.auth.signUp({email,password,options:{data:{full_name:fullName,phone}}});
    if(authError) return this.toast(authError.message,'error');
    const user=authData?.user;
    if(!user) return this.toast('Account creation did not return a user.','error');

    const {error:profileError}=await this.supabaseClient.from('profiles').upsert({id:user.id,email,full_name:fullName,phone},{onConflict:'id'});
    if(profileError) console.warn('Profile upsert:',profileError.message);

    const memberPayload={user_id:user.id,full_name:fullName,email,phone,state_of_origin:state,lga,address,photo_url:photo||null,nationality:'Nigerian',category,status:'pending'};
    const {error:memberError}=await this.supabaseClient.from('members').upsert(memberPayload,{onConflict:'user_id'});
    if(memberError) return this.toast(memberError.message,'error');

    if(!authData.session){
      this.toast('Account created. Verify your email, then sign in. Your membership is pending Secretariat approval.','success');
      this.openLoginModal();
      return;
    }
    await this.hydrateCurrentUser(user);
    await this.loadCloudData();
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
