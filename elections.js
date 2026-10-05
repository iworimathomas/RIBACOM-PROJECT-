/* RIBACOM Elections & Voting System — integrated Digital Ecosystem module */
(function(){
  const managerRoles=['admin','super_admin','secretary_general','vice_president'];
  const isManager=()=>managerRoles.includes(window.app?.currentUser?.roleKey);

  RibacomApp.prototype.loadElections = async function(){
    if(!this.supabaseClient) return [];
    const {data,error}=await this.supabaseClient.from('elections').select('*').order('created_at',{ascending:false});
    if(error){this.toast('Unable to load elections: '+error.message,'error');return [];}
    return data||[];
  };

  RibacomApp.prototype.renderElectionsView = function(){
    return '<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">'+
      '<div class="flex flex-wrap items-center justify-between gap-4 mb-6">'+
      '<div><div class="text-ribacom-green text-xs font-black uppercase tracking-widest">RIBACOM Digital Ecosystem</div><h1 class="text-3xl font-black text-ribacom-navy">Elections & Voting</h1><p class="text-gray-600 text-sm mt-1">Secure member elections inside the existing RIBACOM ecosystem.</p></div>'+
      (isManager()?'<button onclick="app.renderElectionManager()" class="bg-ribacom-navy text-white px-4 py-2.5 rounded-xl font-bold text-sm"><i class="fa-solid fa-screwdriver-wrench mr-2"></i>Election Manager</button>':'')+
      '</div><div id="electionsList" class="grid md:grid-cols-2 gap-5"><div class="p-6 bg-white rounded-2xl shadow border text-sm text-gray-500">Loading elections…</div></div></div>';
  };

  RibacomApp.prototype.refreshElectionsView = async function(){
    const box=document.getElementById('electionsList'); if(!box)return;
    const elections=await this.loadElections();
    if(!elections.length){box.innerHTML='<div class="md:col-span-2 p-8 bg-white rounded-2xl shadow border text-center text-gray-500">No elections have been created yet.</div>';return;}
    box.innerHTML=elections.map(e=>{
      const open=e.status==='open';
      const action=open && this.currentUser?.memberId ? '<button onclick="app.openElectionVoting(\''+e.id+'\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl font-bold text-sm">Vote Now</button>' : '';
      return '<article class="bg-white rounded-2xl shadow border p-5"><div class="flex justify-between gap-3"><span class="text-xs font-black uppercase tracking-wider '+(open?'text-ribacom-green':'text-gray-500')+'">'+esc(e.status)+'</span><span class="text-xs text-gray-400">'+(e.ends_at?new Date(e.ends_at).toLocaleString():'No closing time')+'</span></div><h2 class="text-xl font-black text-ribacom-navy mt-2">'+esc(e.title)+'</h2><p class="text-sm text-gray-600 mt-2">'+esc(e.description||'')+'</p><div class="mt-4">'+action+'</div></article>';
    }).join('');
  };

  RibacomApp.prototype.openElectionVoting = async function(electionId){
    if(!this.currentUser?.memberId){this.toast('Please sign in as an approved member to vote.','warning');return;}
    const {data:e,error}=await this.supabaseClient.from('elections').select('*').eq('id',electionId).single();
    if(error||!e){this.toast('Election could not be loaded.','error');return;}
    if(e.status!=='open'||!e.starts_at||!e.ends_at||Date.now()<new Date(e.starts_at).getTime()||Date.now()>new Date(e.ends_at).getTime()){this.toast('This election is not currently open.','warning');return;}
    const {data:m}=await this.supabaseClient.from('members').select('id,full_name,status,membership_number').eq('id',this.currentUser.memberId).maybeSingle();
    if(!m||m.status!=='approved'){this.toast('Only approved RIBACOM members may vote.','warning');return;}
    const {data:positions}=await this.supabaseClient.from('election_positions').select('*').eq('election_id',electionId).order('display_order');
    const {data:candidates}=await this.supabaseClient.from('election_candidates').select('*').eq('election_id',electionId).eq('status','approved').order('display_order');
    const {data:existing}=await this.supabaseClient.from('election_ballots').select('id,submitted_at').eq('election_id',electionId).eq('voter_member_id',m.id).maybeSingle();
    if(existing?.submitted_at){this.toast('You have already voted in this election.','warning');return;}
    this.currentElectionVoting={election:e,positions:positions||[],candidates:candidates||[],member:m,ballot:existing};
    const container=document.getElementById('appViewport');
    container.innerHTML='<div class="max-w-4xl mx-auto px-4 py-8"><button onclick="app.navigate(\'elections\')" class="text-sm text-ribacom-green font-bold mb-4">← Back to Elections</button><div class="bg-white rounded-2xl shadow border p-6"><div class="text-xs font-black uppercase tracking-widest text-ribacom-green">Secure Ballot</div><h1 class="text-2xl font-black text-ribacom-navy mt-1">'+esc(e.title)+'</h1><p class="text-sm text-gray-600 mt-2">Vote once for each listed position. Your ballot cannot be submitted twice.</p><div id="ballotForm" class="mt-6 space-y-6">'+(positions||[]).map(p=>{const cs=(candidates||[]).filter(c=>c.position_id===p.id);return '<section class="border rounded-2xl p-4"><h2 class="font-black text-ribacom-navy">'+esc(p.title)+'</h2><p class="text-xs text-gray-500 mb-3">'+esc(p.description||'Select one candidate.')+'</p><div class="space-y-2">'+cs.map(c=>'<label class="flex items-start gap-3 p-3 border rounded-xl hover:border-ribacom-green cursor-pointer"><input type="radio" name="position-'+p.id+'" value="'+c.id+'" class="mt-1" required><span><strong>'+esc(c.full_name)+'</strong><span class="block text-xs text-gray-500 mt-1">'+esc(c.manifesto||'')+'</span></span></label>').join('')+'</div></section>';}).join('')+'</div><button onclick="app.submitElectionBallot(\''+electionId+'\')" class="mt-6 w-full bg-ribacom-green text-white py-3 rounded-xl font-black">Submit Secure Ballot</button></div></div>';
  };

  RibacomApp.prototype.submitElectionBallot = async function(electionId){
    const state=this.currentElectionVoting;if(!state)return;
    const choices={};
    for(const p of state.positions){
      const el=document.querySelector('input[name="position-'+p.id+'"]:checked');
      if(!el){this.toast('Please select a candidate for '+p.title+'.','warning');return;}
      choices[p.id]=el.value;
    }
    if(!confirm('Submit your RIBACOM election ballot? You will not be able to vote again in this election.'))return;
    const {data:ballot,error:be}=await this.supabaseClient.from('election_ballots').insert({election_id:electionId,voter_member_id:state.member.id}).select('id').single();
    if(be){this.toast(be.code==='23505'?'You have already voted in this election.':'Unable to create ballot: '+be.message,'error');return;}
    const rows=Object.entries(choices).map(([position_id,candidate_id])=>({ballot_id:ballot.id,position_id,candidate_id}));
    const {error:ve}=await this.supabaseClient.from('election_votes').insert(rows);
    if(ve){
      await this.supabaseClient.from('election_ballots').delete().eq('id',ballot.id);
      this.toast('Ballot was not submitted: '+ve.message,'error');return;
    }
    const {error:ue}=await this.supabaseClient.from('election_ballots').update({submitted_at:new Date().toISOString()}).eq('id',ballot.id);
    if(ue){this.toast('Vote was recorded but submission confirmation failed. Please contact the Secretariat.','error');return;}
    await this.supabaseClient.from('election_audit_logs').insert({election_id:electionId,actor_user_id:this.currentUser.id,action:'ballot_submitted',details:{positions:Object.keys(choices).length}});
    this.toast('Your ballot has been submitted successfully.','success');this.currentElectionVoting=null;this.navigate('elections');
  };

  RibacomApp.prototype.renderElectionManager = async function(){
    if(!isManager()){this.toast('Election manager access denied.','error');return;}
    const container=document.getElementById('appViewport');
    container.innerHTML='<div class="max-w-7xl mx-auto px-4 py-8"><button onclick="app.navigate(\'elections\')" class="text-sm text-ribacom-green font-bold mb-4">← Elections</button><div class="grid lg:grid-cols-3 gap-6"><div class="lg:col-span-2"><h1 class="text-2xl font-black text-ribacom-navy mb-4">Election Manager</h1><div id="managerElections" class="space-y-4">Loading…</div></div><div class="bg-white rounded-2xl shadow border p-5"><h2 class="font-black text-ribacom-navy mb-3">Create Election</h2><input id="newElectionTitle" class="w-full border rounded-xl p-3 text-sm mb-2" placeholder="Election title"><textarea id="newElectionDesc" class="w-full border rounded-xl p-3 text-sm mb-2" placeholder="Description"></textarea><label class="text-xs font-bold">Start<input id="newElectionStart" type="datetime-local" class="w-full border rounded-xl p-3 text-sm mb-2"></label><label class="text-xs font-bold">End<input id="newElectionEnd" type="datetime-local" class="w-full border rounded-xl p-3 text-sm mb-3"></label><button onclick="app.createElection()" class="w-full bg-ribacom-navy text-white py-3 rounded-xl font-bold">Create Draft Election</button></div></div></div>';
    await this.refreshElectionManager();
  };
  RibacomApp.prototype.refreshElectionManager=async function(){
    const box=document.getElementById('managerElections');if(!box)return;
    const elections=await this.loadElections();
    box.innerHTML=elections.map(e=>'<div class="bg-white rounded-2xl shadow border p-5"><div class="flex flex-wrap justify-between gap-2"><div><h2 class="font-black text-ribacom-navy">'+esc(e.title)+'</h2><p class="text-xs text-gray-500">'+esc(e.status)+' • '+(e.starts_at?new Date(e.starts_at).toLocaleString():'No start')+' → '+(e.ends_at?new Date(e.ends_at).toLocaleString():'No end')+'</p></div><div class="flex gap-2"><button onclick="app.setElectionStatus(\''+e.id+'\',\'open\')" class="px-3 py-2 rounded-lg bg-ribacom-green text-white text-xs font-bold">Open</button><button onclick="app.setElectionStatus(\''+e.id+'\',\'closed\')" class="px-3 py-2 rounded-lg bg-gray-700 text-white text-xs font-bold">Close</button></div></div><div class="mt-4 grid sm:grid-cols-2 gap-2"><button onclick="app.manageElectionDetails(\''+e.id+'\')" class="border rounded-xl px-3 py-2 text-sm font-bold">Positions & Candidates</button><button onclick="app.showElectionParticipation(\''+e.id+'\')" class="border rounded-xl px-3 py-2 text-sm font-bold">Results & Audit</button></div></div>').join('')||'<div class="bg-white rounded-xl p-6 text-gray-500">No elections yet.</div>';
  };
  RibacomApp.prototype.createElection=async function(){
    const title=document.getElementById('newElectionTitle')?.value.trim();if(!title){this.toast('Election title is required.','warning');return;}
    const {data,error}=await this.supabaseClient.from('elections').insert({title,description:document.getElementById('newElectionDesc').value.trim(),starts_at:document.getElementById('newElectionStart').value?new Date(document.getElementById('newElectionStart').value).toISOString():null,ends_at:document.getElementById('newElectionEnd').value?new Date(document.getElementById('newElectionEnd').value).toISOString():null,created_by:this.currentUser.id}).select().single();
    if(error){this.toast(error.message,'error');return;}await this.supabaseClient.from('election_audit_logs').insert({election_id:data.id,actor_user_id:this.currentUser.id,action:'election_created'});this.toast('Draft election created.','success');this.renderElectionManager();
  };
  RibacomApp.prototype.setElectionStatus=async function(id,status){
    const {data:e,error:loadError}=await this.supabaseClient.from('elections').select('*,election_positions(id),election_candidates(id,status)').eq('id',id).single();
    if(loadError||!e){this.toast('Election could not be loaded.','error');return;}
    if(status==='open'){
      if(!e.starts_at||!e.ends_at||new Date(e.ends_at)<=new Date(e.starts_at)){this.toast('Set a valid start and end time before opening the election.','warning');return;}
      if(new Date(e.ends_at)<=new Date()){this.toast('The election end time has already passed.','warning');return;}
      const positions=e.election_positions||[]; const candidates=(e.election_candidates||[]).filter(c=>c.status==='approved');
      if(!positions.length){this.toast('Add at least one election position before opening.','warning');return;}
      for(const p of positions){if(!candidates.some(c=>c.position_id===p.id)){this.toast('Every position must have at least one approved candidate.','warning');return;}}
    }
    const {error}=await this.supabaseClient.from('elections').update({status,updated_at:new Date().toISOString()}).eq('id',id);
    if(error){this.toast(error.message,'error');return;}
    await this.supabaseClient.from('election_audit_logs').insert({election_id:id,actor_user_id:this.currentUser.id,action:'status_changed',details:{status}});
    this.renderElectionManager();
  };
  RibacomApp.prototype.manageElectionDetails=async function(id){
    const {data:e}=await this.supabaseClient.from('elections').select('*').eq('id',id).single();
    const {data:p}=await this.supabaseClient.from('election_positions').select('*').eq('election_id',id).order('display_order');
    const {data:c}=await this.supabaseClient.from('election_candidates').select('*').eq('election_id',id).order('display_order');
    const box=document.getElementById('managerElections');box.innerHTML='<div class="bg-white rounded-2xl shadow border p-5"><button onclick="app.renderElectionManager()" class="text-sm text-ribacom-green font-bold mb-4">← Manager</button><h2 class="text-xl font-black text-ribacom-navy">'+esc(e.title)+'</h2><div class="grid md:grid-cols-2 gap-5 mt-5"><div><h3 class="font-black mb-2">Add Position</h3><input id="posTitle" class="w-full border rounded-xl p-3 mb-2" placeholder="Position e.g. President"><button onclick="app.addElectionPosition(\''+id+'\')" class="bg-ribacom-navy text-white px-4 py-2 rounded-xl font-bold">Add Position</button><div class="mt-4 space-y-2">'+(p||[]).map(x=>'<div class="border rounded-xl p-3"><strong>'+esc(x.title)+'</strong><div class="text-xs text-gray-500">ID: '+x.id+'</div></div>').join('')+'</div></div><div><h3 class="font-black mb-2">Add Candidate</h3><select id="candidatePosition" class="w-full border rounded-xl p-3 mb-2">'+(p||[]).map(x=>'<option value="'+x.id+'">'+esc(x.title)+'</option>').join('')+'</select><input id="candidateName" class="w-full border rounded-xl p-3 mb-2" placeholder="Candidate full name"><textarea id="candidateManifesto" class="w-full border rounded-xl p-3 mb-2" placeholder="Manifesto (optional)"></textarea><button onclick="app.addElectionCandidate(\''+id+'\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl font-bold">Add Candidate</button><div class="mt-4 space-y-2">'+(c||[]).map(x=>'<div class="border rounded-xl p-3"><strong>'+esc(x.full_name)+'</strong><div class="text-xs text-gray-500">'+esc((p||[]).find(z=>z.id===x.position_id)?.title||'Position')+'</div></div>').join('')+'</div></div></div></div>';
  };
  RibacomApp.prototype.addElectionPosition=async function(electionId){const title=document.getElementById('posTitle')?.value.trim();if(!title)return;const {error}=await this.supabaseClient.from('election_positions').insert({election_id:electionId,title});if(error)this.toast(error.message,'error');else this.toast('Position added.','success');this.manageElectionDetails(electionId);};
  RibacomApp.prototype.addElectionCandidate=async function(electionId){const position_id=document.getElementById('candidatePosition')?.value;const full_name=document.getElementById('candidateName')?.value.trim();if(!position_id||!full_name){this.toast('Select a position and enter the candidate name.','warning');return;}const {error}=await this.supabaseClient.from('election_candidates').insert({election_id:electionId,position_id,full_name,manifesto:document.getElementById('candidateManifesto').value.trim()});if(error)this.toast(error.message,'error');else this.toast('Candidate added.','success');this.manageElectionDetails(electionId);};
  RibacomApp.prototype.showElectionParticipation=async function(id){
    if(!isManager()){this.toast('Election dashboard access denied.','error');return;}
    const {data:e,error:ee}=await this.supabaseClient.from('elections').select('*').eq('id',id).single();
    if(ee||!e){this.toast('Election could not be loaded.','error');return;}
    const {count:eligible}=await this.supabaseClient.from('members').select('id',{count:'exact',head:true}).eq('status','approved');
    const {count:ballots}=await this.supabaseClient.from('election_ballots').select('id',{count:'exact',head:true}).eq('election_id',id).not('submitted_at','is',null);
    const {data:logs}=await this.supabaseClient.from('election_audit_logs').select('*').eq('election_id',id).order('created_at',{ascending:false}).limit(100);
    const {data:p}=await this.supabaseClient.from('election_positions').select('id,title').eq('election_id',id).order('display_order');
    const {data:v}=await this.supabaseClient.from('election_votes').select('candidate_id,position_id').in('position_id',(p||[]).map(x=>x.id));
    const participation=eligible?Math.round(((ballots||0)/eligible)*100):0;
    const container=document.getElementById('appViewport');
    container.innerHTML='<div class="max-w-7xl mx-auto px-4 py-8"><button onclick="app.renderElectionManager()" class="text-sm text-ribacom-green font-bold mb-4">← Election Manager</button><div class="flex flex-wrap justify-between gap-3 mb-6"><div><div class="text-xs font-black uppercase tracking-widest text-ribacom-green">RIBACOM Digital Ecosystem</div><h1 class="text-2xl font-black text-ribacom-navy">'+esc(e.title)+'</h1><p class="text-sm text-gray-500">Participation & Audit Dashboard</p></div><button onclick="app.showElectionParticipation(\''+id+'\')" class="border rounded-xl px-4 py-2 font-bold text-sm">Refresh</button></div><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-4"><div class="bg-white rounded-2xl border shadow p-5"><div class="text-xs uppercase font-bold text-gray-500">Eligible members</div><div class="text-3xl font-black mt-2">'+(eligible||0)+'</div></div><div class="bg-white rounded-2xl border shadow p-5"><div class="text-xs uppercase font-bold text-gray-500">Ballots submitted</div><div class="text-3xl font-black mt-2">'+(ballots||0)+'</div></div><div class="bg-white rounded-2xl border shadow p-5"><div class="text-xs uppercase font-bold text-gray-500">Participation</div><div class="text-3xl font-black mt-2">'+participation+'%</div></div><div class="bg-white rounded-2xl border shadow p-5"><div class="text-xs uppercase font-bold text-gray-500">Election status</div><div class="text-2xl font-black mt-2">'+esc(e.status)+'</div></div></div><div class="grid lg:grid-cols-2 gap-6 mt-6"><section class="bg-white rounded-2xl border shadow p-5"><h2 class="font-black text-ribacom-navy">Vote Activity</h2><div class="mt-4 space-y-3">'+(p||[]).map(x=>{const n=(v||[]).filter(z=>z.position_id===x.id).length;return '<div><div class="flex justify-between text-sm font-bold"><span>'+esc(x.title)+'</span><span>'+n+' vote(s)</span></div><div class="h-2 bg-gray-100 rounded-full mt-2 overflow-hidden"><div class="h-full bg-ribacom-green" style="width:'+Math.min(100,eligible?Math.round(n/eligible*100):0)+'%"></div></div></div>';}).join('')+'</div></section><section class="bg-white rounded-2xl border shadow p-5"><h2 class="font-black text-ribacom-navy">Audit History</h2><div class="mt-4 max-h-96 overflow-auto space-y-2">'+(logs||[]).map(l=>'<div class="border rounded-xl p-3"><div class="flex justify-between gap-2"><strong class="text-sm">'+esc(l.action)+'</strong><span class="text-xs text-gray-400">'+new Date(l.created_at).toLocaleString()+'</span></div><div class="text-xs text-gray-500 mt-1">'+esc(l.actor_user_id||'System')+'</div></div>').join('')+'</div></section></div><div class="mt-6 p-4 bg-gray-50 border rounded-xl text-xs text-gray-600">Participation statistics show counts only. Individual member voting choices are not displayed here. Audit records document election-management and ballot-submission events.</div></div>';
  };

  RibacomApp.prototype.showElectionResults=async function(id){
    const {data:e}=await this.supabaseClient.from('elections').select('*').eq('id',id).single();
    const {data:p}=await this.supabaseClient.from('election_positions').select('*').eq('election_id',id).order('display_order');
    const {data:c}=await this.supabaseClient.from('election_candidates').select('*').eq('election_id',id).order('display_order');
    const {data:v}=await this.supabaseClient.from('election_votes').select('candidate_id,position_id').in('position_id',(p||[]).map(x=>x.id));
    const counts={};(v||[]).forEach(x=>counts[x.candidate_id]=(counts[x.candidate_id]||0)+1);
    const box=document.getElementById('managerElections');box.innerHTML='<div class="bg-white rounded-2xl shadow border p-5"><button onclick="app.renderElectionManager()" class="text-sm text-ribacom-green font-bold mb-4">← Manager</button><h2 class="text-xl font-black text-ribacom-navy">'+esc(e.title)+' — Results</h2>'+(p||[]).map(x=>'<section class="mt-5"><h3 class="font-black">'+esc(x.title)+'</h3><div class="space-y-2 mt-2">'+(c||[]).filter(z=>z.position_id===x.id).map(z=>'<div class="flex justify-between border rounded-xl p-3"><span>'+esc(z.full_name)+'</span><strong>'+((counts[z.id]||0))+' vote(s)</strong></div>').join('')+'</div></section>').join('')+'<div class="mt-6 text-xs text-gray-500">Results are calculated from submitted ballots. Individual vote choices are not shown in the member-facing interface.</div></div>';
  };
})();