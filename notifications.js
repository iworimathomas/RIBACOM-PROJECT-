/* RIBACOM Member Notifications Centre */
(function(){
  const e=v=>typeof esc==='function'?esc(v):String(v??'');
  RibacomApp.prototype.loadNotifications=async function(){
    if(!this.currentUser?.id||!this.supabaseClient)return[];
    const {data,error}=await this.supabaseClient.from('notifications').select('*').eq('user_id',this.currentUser.id).order('created_at',{ascending:false}).limit(50);
    if(error){console.warn('Notifications:',error.message);return[]}
    return data||[];
  };
  RibacomApp.prototype.markNotificationRead=async function(id){
    if(!this.currentUser?.id)return;
    const {error}=await this.supabaseClient.from('notifications').update({is_read:true}).eq('id',id).eq('user_id',this.currentUser.id);
    if(error)return this.toast(error.message,'error');
    this.navigate('notifications');
  };
  RibacomApp.prototype.markAllNotificationsRead=async function(){
    if(!this.currentUser?.id)return;
    const {error}=await this.supabaseClient.from('notifications').update({is_read:true}).eq('user_id',this.currentUser.id).eq('is_read',false);
    if(error)return this.toast(error.message,'error');
    this.navigate('notifications');
  };
  RibacomApp.prototype.sendMemberNotification = async function(userId,title,message,type='general',linkRoute=null){
    const role=String(this.currentUser?.roleKey||'').toLowerCase();
    if(!['admin','super_admin','secretary_general','vice_president','treasurer','welfare_officer','pro'].includes(role)) return this.toast('Authorized executive access required.','error');
    if(!userId||!String(title||'').trim()||!String(message||'').trim()) return this.toast('Recipient, title and message are required.','warning');
    const {error}=await this.supabaseClient.from('notifications').insert({
      user_id:userId,title:String(title).trim(),message:String(message).trim(),type:String(type||'general').trim(),
      link_route:linkRoute||null,is_read:false
    });
    if(error) return this.toast(error.message,'error');
    this.toast('Notification sent.','success');
  };

  RibacomApp.prototype.broadcastMemberNotification = async function(title,message,type='announcement',linkRoute=null){
    const role=String(this.currentUser?.roleKey||'').toLowerCase();
    if(!['admin','super_admin','secretary_general','vice_president','treasurer','welfare_officer','pro'].includes(role)) return this.toast('Authorized executive access required.','error');
    if(!String(title||'').trim()||!String(message||'').trim()) return this.toast('Title and message are required.','warning');
    const {data:members,error}=await this.supabaseClient.from('members').select('user_id').not('user_id','is',null);
    if(error) return this.toast(error.message,'error');
    const rows=(members||[]).filter(m=>m.user_id).map(m=>({
      user_id:m.user_id,title:String(title).trim(),message:String(message).trim(),type:String(type||'announcement').trim(),
      link_route:linkRoute||null,is_read:false
    }));
    if(!rows.length) return this.toast('No linked member accounts were found.','warning');
    const {error:insertError}=await this.supabaseClient.from('notifications').insert(rows);
    if(insertError) return this.toast(insertError.message,'error');
    this.toast('Notification broadcast to '+rows.length+' member account(s).','success');
  };

  RibacomApp.prototype.renderNotificationsView=async function(){ return this.renderNotifications(); };
  RibacomApp.prototype.renderNotifications=async function(){
    if(!this.currentUser)return '<div class="bg-white rounded-3xl p-8 text-center">Please sign in to view notifications.</div>';
    const rows=await this.loadNotifications(), unread=rows.filter(x=>!x.is_read).length;
    return '<div class="max-w-4xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6"><div class="flex items-center gap-3"><img src="https://raw.githubusercontent.com/iworimathomas/RIBACOM-PROJECT-/main/ribacom-official-logo.jpg" alt="Official RIBACOM Crest" class="w-12 h-12 rounded-full bg-white p-1 object-cover"><div class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Member Centre</div></div><div class="flex flex-wrap justify-between gap-3 items-center"><div><h2 class="text-2xl font-extrabold mt-1">Notifications</h2><p class="text-xs text-white/70">'+unread+' unread notification'+(unread===1?'':'s')+'</p></div>'+(unread?'<button onclick="app.markAllNotificationsRead()" class="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-xs font-bold">Mark all read</button>':'')+'</div></div><div class="space-y-3">'+(rows.length?rows.map(n=>'<div class="bg-white rounded-2xl border p-4 '+(!n.is_read?'border-l-4 border-l-ribacom-gold':'')+'"><div class="flex justify-between gap-3"><div><span class="text-[10px] uppercase font-black text-ribacom-green">'+e(n.type)+'</span><h3 class="font-extrabold text-ribacom-navy">'+e(n.title)+'</h3><p class="text-sm text-gray-600 mt-1">'+e(n.message)+'</p><p class="text-[10px] text-gray-400 mt-2">'+e(n.created_at?.slice(0,16).replace('T',' '))+'</p></div>'+(!n.is_read?'<button onclick="app.markNotificationRead(\''+e(n.id)+'\')" class="text-xs font-bold text-ribacom-green whitespace-nowrap">Mark read</button>':'')+'</div>'+(n.link_route?'<button onclick="app.navigate(\''+e(n.link_route)+'\')" class="mt-3 text-xs font-bold text-ribacom-navy">Open related section →</button>':'')+'</div>').join(''):'<div class="bg-white border rounded-2xl p-8 text-center text-sm text-gray-500">No notifications yet.</div>')+'</div></div>';
  };
  const oldNav=RibacomApp.prototype.navigate;
  RibacomApp.prototype.navigate=function(v,p=null){
    if(v==='notifications'){this.currentView=v;const c=document.getElementById('appViewport');this.renderNotifications().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
    return oldNav.call(this,v,p);
  };
})();