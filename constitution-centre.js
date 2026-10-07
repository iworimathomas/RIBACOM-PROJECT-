/* RIBACOM Constitution & Governance Centre */
(function(){
 const e=v=>typeof esc==='function'?esc(v??''):String(v??'');
 RibacomApp.prototype.renderConstitutionCentre=async function(){
  const {data,error}=await this.supabaseClient.from('constitution').select('*').eq('is_published',true).order('chapter_number').order('article_number');
  if(error)return '<div class="bg-white rounded-2xl p-6 text-red-600">'+e(error.message)+'</div>';
  const rows=data||[], chapters={};
  rows.forEach(a=>(chapters[a.chapter_number]??={title:a.chapter_title,articles:[]}).articles.push(a));
  const nav=Object.entries(chapters).map(([n,c])=>'<button onclick="document.getElementById(\'chapter-'+n+'\')?.scrollIntoView({behavior:\'smooth\'})" class="text-left text-xs font-bold px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200">Chapter '+n+'</button>').join('');
  const body=Object.entries(chapters).map(([n,c])=>'<section id="chapter-'+n+'" class="bg-white border rounded-3xl p-5 scroll-mt-4"><h3 class="text-xl font-extrabold text-ribacom-navy">Chapter '+n+': '+e(c.title)+'</h3><div class="mt-4 space-y-5">'+c.articles.map(a=>'<article class="border-l-4 border-ribacom-gold pl-4"><h4 class="font-extrabold text-ribacom-navy">Article '+e(a.article_number)+': '+e(a.article_title)+'</h4><div class="text-sm text-gray-700 whitespace-pre-line mt-2">'+e(a.content)+'</div></article>').join('')+'</div></section>').join('');
  const adoption=`
   <section id="adoption" class="bg-white border-2 border-ribacom-gold rounded-3xl p-6 scroll-mt-4">
    <div class="text-[10px] uppercase font-black text-ribacom-green">Official Adoption Record</div>
    <h3 class="text-2xl font-extrabold text-ribacom-navy mt-1">Constitutional Consent, Approval & Adoption</h3>
    <p class="text-sm text-gray-700 mt-3">This Constitution was considered and adopted by the General Meeting of RIVERS BAYELSA COMMUNITY IN DIASPORA – THE GAMBIA (RIBACOM).</p>
    <div class="grid md:grid-cols-3 gap-3 mt-5">
      <div class="border rounded-xl p-4 bg-gray-50"><div class="text-[10px] uppercase font-bold text-gray-500">Date of Adoption</div><div class="font-extrabold text-ribacom-navy mt-1">27 August 2026</div></div>
      <div class="border rounded-xl p-4 bg-gray-50 md:col-span-2"><div class="text-[10px] uppercase font-bold text-gray-500">Place / Venue</div><div class="font-extrabold text-ribacom-navy mt-1">Agricultural Hall opposite St Charles Tabokoto Road</div></div>
    </div>
    <div class="mt-6"><h4 class="font-extrabold text-ribacom-navy">Executive Committee</h4><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
      <div class="border rounded-xl p-3"><b>Iworima M. Thomas</b><div class="text-xs text-gray-500">Chairman</div></div>
      <div class="border rounded-xl p-3"><b>Odika Nnenne</b><div class="text-xs text-gray-500">Vice-Chair</div></div>
      <div class="border rounded-xl p-3"><b>Juliet Ejila</b><div class="text-xs text-gray-500">Secretary General</div></div>
      <div class="border rounded-xl p-3"><b>Ruth Doubra Julius</b><div class="text-xs text-gray-500">Treasurer</div></div>
      <div class="border rounded-xl p-3"><b>Uche Destiny Chikezie</b><div class="text-xs text-gray-500">Public Relations Officer</div></div>
      <div class="border rounded-xl p-3"><b>Emeka Thank God Elechi</b><div class="text-xs text-gray-500">Welfare Officer / Provost</div></div>
      <div class="border rounded-xl p-3"><b>Assistant Secretary General</b><div class="text-xs text-gray-500">Name not yet recorded in the current leadership register</div></div>
    </div></div>
    <div class="mt-6"><h4 class="font-extrabold text-ribacom-navy">Executive Signatures</h4><div class="grid md:grid-cols-3 gap-4 mt-3">
      <div class="border rounded-xl p-4"><b>Chairman</b><p class="text-sm mt-2">Name: Iworima M. Thomas</p><p class="text-sm mt-3">Signature: __________________</p><p class="text-sm mt-2">Date: __________________</p></div>
      <div class="border rounded-xl p-4"><b>Secretary General</b><p class="text-sm mt-2">Name: Juliet Ejila</p><p class="text-sm mt-3">Signature: __________________</p><p class="text-sm mt-2">Date: __________________</p></div>
      <div class="border rounded-xl p-4"><b>Treasurer</b><p class="text-sm mt-2">Name: Ruth Doubra Julius</p><p class="text-sm mt-3">Signature: __________________</p><p class="text-sm mt-2">Date: __________________</p></div>
    </div></div>
    <div class="mt-6 border-t pt-5"><h4 class="font-extrabold text-ribacom-navy">Witness / Authorized Representative</h4><p class="text-sm mt-2">Name: ____________________________________</p><p class="text-sm mt-2">Position: __________________________________</p><p class="text-sm mt-2">Signature: _________________________________</p><p class="text-sm mt-2">Date: _____________________________________</p></div>
    <div class="mt-6 border-t pt-5"><h4 class="font-extrabold text-ribacom-navy">Official Seal</h4><div class="mt-4 flex flex-col items-center"><img src="/ribacom-official-stamp.webp" alt="RIBACOM Official Stamp" class="w-56 h-56 object-contain rounded-full border border-gray-200 bg-white shadow-sm"><p class="text-xs text-gray-500 mt-3 text-center">RIBACOM Official Stamp / Common Seal</p></div></div>
   </section>`;

  return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Official Governance</span><h2 class="text-2xl font-extrabold mt-1">Constitution & Governance</h2><p class="text-xs text-white/70 mt-1">Master Constitution — 13 Chapters / 97 Articles.</p></div><div class="flex flex-wrap gap-2">'+(nav||'<span class="text-sm text-gray-500">No published constitution content is currently available.</span>')+'</div><div class="space-y-4">'+body+'</div>'+adoption+'</div>';
 };
  RibacomApp.prototype.renderGovernanceOverview=async function(){
    const {data:leaders=[]}=await this.supabaseClient.from('leadership').select('name,position,photo_url,is_active,display_order').eq('is_active',true).order('display_order').order('created_at');
    const {data:advisers=[]}=await this.supabaseClient.from('advisers').select('name,category,photo_url,is_active').eq('is_active',true).order('created_at');
    const roleNames=['President / Chairman','Vice President','Secretary General','Assistant Secretary General','Treasurer','Public Relations Officer','Welfare Officer / Provost'];
    const bodies=[['General Assembly','Highest membership body and principal decision-making forum.'],['Executive Committee','Seven executive offices responsible for day-to-day administration.'],['Standing Oversight Committee','Legal, Protocol, Youth and Cultural advisers supporting oversight and institutional guidance.'],['Board of Patrons','Patronage and institutional support for the Community.'],['Council of Elders','Senior members providing continuity, wisdom and community guidance.']];
    const roleCards=roleNames.map(x=>'<div class="border rounded-xl p-3 bg-gray-50"><b>'+e(x)+'</b></div>').join('');
    const leaderCards=(leaders||[]).map(x=>'<div class="border rounded-xl p-3"><b>'+e(x.name)+'</b><div class="text-xs text-ribacom-green mt-1">'+e(x.position)+'</div></div>').join('');
    const adviserCards=(advisers||[]).map(x=>'<div class="border rounded-xl p-3"><b>'+e(x.name)+'</b><div class="text-xs text-gray-500 mt-1">'+e(x.category)+'</div></div>').join('');
    return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Official Governance</span><h2 class="text-2xl font-extrabold mt-1">Constitution & Governance Centre</h2><p class="text-xs text-white/70 mt-1">The Constitution is the authoritative governance framework. Leadership records identify the current office holders.</p></div><section class="bg-white border rounded-3xl p-5"><h3 class="font-extrabold text-ribacom-navy">Executive Structure</h3><div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">'+roleCards+'</div></section><section class="bg-white border rounded-3xl p-5"><h3 class="font-extrabold text-ribacom-navy">Governance Bodies</h3><div class="grid md:grid-cols-2 gap-3 mt-4">'+bodies.map(x=>'<div class="border rounded-xl p-4"><b>'+e(x[0])+'</b><p class="text-xs text-gray-500 mt-1">'+e(x[1])+'</p></div>').join('')+'</div></section><section class="bg-white border rounded-3xl p-5"><h3 class="font-extrabold text-ribacom-navy">Current Leadership</h3><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">'+(leaderCards||'<span class="text-sm text-gray-500">No active leadership records.</span>')+'</div></section><section class="bg-white border rounded-3xl p-5"><h3 class="font-extrabold text-ribacom-navy">Advisers</h3><div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4">'+(adviserCards||'<span class="text-sm text-gray-500">No active adviser records.</span>')+'</div></section><div class="flex flex-wrap gap-2"><button onclick="app.navigate(\'constitution-centre\')" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-bold">Read Constitution</button><button onclick="app.navigate(\'leadership-centre\')" class="bg-ribacom-navy text-white px-4 py-2 rounded-xl text-xs font-bold">Leadership Centre</button></div></div>';
  };
 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='governance-centre'){this.currentView=v;const c=document.getElementById('appViewport');this.renderGovernanceOverview().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  if(v==='constitution'||v==='constitution-centre'){this.currentView='constitution';const c=document.getElementById('appViewport');this.renderConstitutionCentre().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  return oldNav.call(this,v,p);
 };
})();