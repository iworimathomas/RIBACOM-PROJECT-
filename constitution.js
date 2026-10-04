/* D5 Constitution management helpers. The authoritative 13-Chapter/97-Article text is edited in Supabase. */
(function(){
  const admin=a=>['admin','super_admin'].includes(a?.currentUser?.roleKey);
  const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get=id=>document.getElementById(id)?.value||'';
  RibacomApp.prototype.renderAdminConstitutionD5=function(){
    if(!admin(this)) return '<div class="p-5 bg-white rounded-2xl">Administrator access required.</div>';
    const rows=this.db.constitution||[];
    return `<div class="space-y-5"><div class="bg-ribacom-navy text-white rounded-3xl p-5"><h2 class="text-xl font-extrabold">Constitution Management</h2><p class="text-xs text-gray-300 mt-1">Master Constitution: 13 Chapters / 97 Articles. Edit existing articles or add new records in Supabase.</p></div><div class="flex justify-end"><button onclick="app.openConstitutionEditor()" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-bold">Add Article</button></div><div class="bg-white rounded-3xl p-4 overflow-x-auto"><table class="w-full text-xs"><thead><tr class="bg-gray-50"><th class="p-2 text-left">Chapter</th><th class="p-2 text-left">Article</th><th class="p-2 text-left">Title</th><th class="p-2">Published</th><th class="p-2">Actions</th></tr></thead><tbody>${rows.flatMap(ch=>ch.articles.map(a=>({chapter:ch.chapter,title:ch.title,...a}))).map(a=>`<tr class="border-b"><td class="p-2">${a.chapter}</td><td class="p-2">${a.number}</td><td class="p-2 font-bold">${esc(a.title)}</td><td class="p-2">—</td><td class="p-2 whitespace-nowrap"><button class="text-blue-600 font-bold mr-2" onclick="app.openConstitutionEditor('${a.id||''}')">Edit</button>${a.id?`<button class="text-red-600 font-bold" onclick="app.deleteConstitutionArticle('${a.id}')">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" class="p-6 text-center text-gray-500">No constitution records have been published yet.</td></tr>'}</tbody></table></div></div>`;
  };
  RibacomApp.prototype.openConstitutionEditor=function(id=''){
    if(!admin(this)) return;
    let row=null; for(const ch of (this.db.constitution||[])) row=row||ch.articles.find(a=>a.id===id);
    const chapter=row?.chapter_number||'';
    const chapterTitle=row?.chapter_title||'';
    const modal=document.createElement('div'); modal.id='constitutionEditor'; modal.className='fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-4';
    modal.innerHTML=`<div class="bg-white rounded-3xl max-w-2xl w-full p-5 max-h-[92vh] overflow-y-auto"><h3 class="text-lg font-extrabold text-ribacom-navy mb-4">${id?'Edit':'Add'} Constitution Article</h3><div class="grid grid-cols-2 gap-3"><label class="text-xs font-bold">Chapter number<input id="ce_ch" type="number" value="${esc(chapter)}" class="mt-1 w-full border rounded-xl px-3 py-2"></label><label class="text-xs font-bold">Article number<input id="ce_ar" type="number" value="${esc(row?.number||'')}" class="mt-1 w-full border rounded-xl px-3 py-2"></label></div><label class="block text-xs font-bold mt-3">Chapter title<input id="ce_ct" value="${esc(chapterTitle)}" class="mt-1 w-full border rounded-xl px-3 py-2"></label><label class="block text-xs font-bold mt-3">Article title<input id="ce_at" value="${esc(row?.title||'')}" class="mt-1 w-full border rounded-xl px-3 py-2"></label><label class="block text-xs font-bold mt-3">Content<textarea id="ce_body" rows="10" class="mt-1 w-full border rounded-xl px-3 py-2">${esc(row?.content||'')}</textarea></label><label class="flex items-center gap-2 text-xs font-bold mt-3"><input id="ce_pub" type="checkbox" checked> Published</label><div class="flex gap-2 mt-4"><button onclick="app.saveConstitutionArticle('${id}')" class="flex-1 bg-ribacom-green text-white py-2.5 rounded-xl font-bold">Save</button><button onclick="document.getElementById('constitutionEditor')?.remove()" class="px-5 bg-gray-100 rounded-xl font-bold">Cancel</button></div></div>`;
    document.body.appendChild(modal);
  };
  RibacomApp.prototype.saveConstitutionArticle=async function(id=''){
    if(!admin(this))return;
    const payload={chapter_number:Number(get('ce_ch')),chapter_title:get('ce_ct').trim(),article_number:Number(get('ce_ar')),article_title:get('ce_at').trim(),content:get('ce_body').trim(),is_published:document.getElementById('ce_pub')?.checked!==false,updated_at:new Date().toISOString()};
    if(!payload.chapter_number||!payload.article_number||!payload.chapter_title||!payload.article_title||!payload.content)return this.toast('Complete all constitution fields.','warning');
    let q=id?this.supabaseClient.from('constitution').update(payload).eq('id',id):this.supabaseClient.from('constitution').insert(payload);
    const {error}=await q;if(error)return this.toast(error.message,'error');document.getElementById('constitutionEditor')?.remove();await this.adminRefresh();this.toast('Constitution article saved.','success');
  };
  RibacomApp.prototype.deleteConstitutionArticle=async function(id){if(!admin(this))return;if(!confirm('Delete this constitution article?'))return;const {error}=await this.supabaseClient.from('constitution').delete().eq('id',id);if(error)return this.toast(error.message,'error');await this.adminRefresh();this.toast('Article deleted.','info');};
})();
