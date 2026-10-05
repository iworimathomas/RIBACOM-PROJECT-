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
  return '<div class="max-w-6xl mx-auto space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-6 border-b-4 border-ribacom-gold"><span class="text-[10px] uppercase font-black text-ribacom-gold">RIBACOM Official Governance</span><h2 class="text-2xl font-extrabold mt-1">Constitution & Governance</h2><p class="text-xs text-white/70 mt-1">Master Constitution — 13 Chapters / 97 Articles.</p></div><div class="flex flex-wrap gap-2">'+(nav||'<span class="text-sm text-gray-500">No published constitution content is currently available.</span>')+'</div><div class="space-y-4">'+body+'</div></div>';
 };
 const oldNav=RibacomApp.prototype.navigate;
 RibacomApp.prototype.navigate=function(v,p=null){
  if(v==='constitution-centre'){this.currentView=v;const c=document.getElementById('appViewport');this.renderConstitutionCentre().then(h=>{if(c)c.innerHTML=h;this.updateAuthHeaderUI&&this.updateAuthHeaderUI()});return}
  return oldNav.call(this,v,p);
 };
})();