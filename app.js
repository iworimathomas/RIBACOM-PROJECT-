// Empty in-memory UI cache; Supabase is the authoritative data source.
        class RibacomApp {
            constructor() {
                this.db = {members:[],digitalIds:[],membershipApplications:[],financeTransactions:[],leadership:[],advisers:[],constitution:[],announcements:[],events:[],gallery:[],publications:[],youth:{title:'RIBACOM Youth',content:'',image:''},paymentSettings:[],welfareRequests:[],welfareSettings:{},about:{name:window.RIBACOM_CONFIG.orgName,displayName:window.RIBACOM_CONFIG.orgName,motto:window.RIBACOM_CONFIG.motto}};
                this.currentUser = null;
                this.loginMode = 'member';
                this.currentView = 'home';
                this.supabaseClient = null;
                this.cloudMode = false;
                this.testMode=false;
                this.testMember=null;
                this.testDigitalId=null;
                this.initTestMode();
                this.initSupabase();
                this.restoreSupabaseSession().then(() => this.loadCloudData()).then(() => this.navigate(this.currentView));
            }

            initTestMode() {
                const params = new URLSearchParams(window.location.search);
                this.testMode = params.get('test') === '1';
                if (!this.testMode) return;
                this.testMember = {
                    id:'TEST-RIBACOM-001',
                    full_name:'RIBACOM Test Member',
                    email:'test-member@ribacom.test',
                    phone:'+220 000 0000',
                    nationality:'Nigerian',
                    state_of_origin:'Rivers',
                    lga:'Test LGA',
                    category:'Regular Member',
                    status:'pending',
                    membership_number:'',
                    photo_url:'',
                    address:'TEST MODE — no real member data',
                    created_at:new Date().toISOString()
                };
                this.testDigitalId = null;
                if (this.testMode) {
                    this.db.members = [this.testMember];
                    this.db.digitalIds = [];
                }
                if (this.testMode) this.currentUser={id:'TEST-USER-001',memberId:'TEST-RIBACOM-001',roleKey:'member',email:'test-member@ribacom.test',full_name:'RIBACOM Test Member'};
            }

            getTestMember() {
                if (!this.testMode) return null;
                if (this.testDigitalId) this.testMember.status='approved';
                return this.testMember;
            }

            runTestApproval() {
                if (!this.testMode) return;
                this.testMember.status='approved';
                this.testMember.membership_number='RBC-TEST-0001';
                this.testMember.membershipNo=this.testMember.membership_number;
                this.testMember.fullName=this.testMember.full_name;
                this.testMember.stateOfOrigin=this.testMember.state_of_origin;
                this.testDigitalId={
                    id:'TEST-DIGITAL-ID-001',
                    memberId:this.testMember.id,
                    idCardNumber:'RBC-ID-TEST-0001',
                    qrCodeData:`RIBACOM-GAMBIA|ID:RBC-ID-TEST-0001|MEMBER:${this.testMember.id}|NAME:${this.testMember.full_name}`,
                    status:'active',
                    issued_at:new Date().toISOString(),
                    expires_at:new Date(Date.now()+365*24*60*60*1000).toISOString()
                };
                this.db.members=[this.testMember];
                this.db.digitalIds=[this.testDigitalId];
                this.toast('TEST MODE: Membership approved and Digital ID generated. No real database record was changed.','success');
                this.navigate('digital-id');
            }

            renderTestModeBanner() {
                if (!this.testMode) return '';
                const m=this.getTestMember();
                const id=this.testDigitalId;
                return '<div class="mx-4 mt-3 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 px-4 py-4 text-xs font-bold">'+
                    '<div class="flex flex-wrap items-center justify-between gap-3"><div><i class="fa-solid fa-flask mr-1"></i> TEST MODE — RIBACOM test data only. No real member records are being changed.'+
                    '<div class="mt-1 font-normal">Status: <strong>'+esc(m?.status||'pending')+'</strong> • Membership No.: <strong>'+esc(m?.membership_number||'Not issued')+'</strong></div></div>'+
                    (!id?'<button onclick="app.runTestApproval()" class="bg-ribacom-green text-white px-4 py-2 rounded-xl text-xs font-extrabold">Run Approval + Digital ID Test</button>':'<button onclick="app.navigate(\'member-dashboard\')" class="bg-ribacom-navy text-white px-4 py-2 rounded-xl text-xs font-extrabold">Open Test Member Dashboard</button>')+
                    '</div></div>';
            }

            loadInitialDB() { return this.db; }

            saveDB() { /* Supabase is the authoritative database. */ }

            initSupabase() {
                const url = window.RIBACOM_CONFIG?.supabaseUrl;
                const key = window.RIBACOM_CONFIG?.supabaseKey;
                if (url && key && window.supabase) {
                    try {
                        this.supabaseClient = window.supabase.createClient(url, key);
                        this.cloudMode = true;
                        document.getElementById('backendStatusBadge').innerText = "Supabase Cloud";
                        document.getElementById('backendStatusBadge').className = "text-emerald-400 font-bold hidden sm:inline";
                    } catch(e) {
                        console.warn("Supabase init error:", e);
                    }
                }
            }

            async loadCloudData() {
                if (this.testMode) return;
                if (!this.supabaseClient) return;
                const q = async (table, options = {}) => {
                    let query = this.supabaseClient.from(table).select(options.select || '*');
                    if (options.order) query = query.order(options.order, { ascending: options.ascending !== false });
                    if (options.limit) query = query.limit(options.limit);
                    const { data, error } = await query;
                    if (error) { console.warn('RIBACOM cloud read failed:', table, error.message); return []; }
                    return data || [];
                };
                try {
                    const [about, leadership, advisers, constitution, announcements, events, gallery, publications, youth, payments, welfareSettings, membershipApplications, financeTransactions] = await Promise.all([
                        q('ribacom_about_content', {limit:1}),
                        q('leadership', {order:'display_order'}),
                        q('advisers', {order:'created_at', ascending:false}),
                        q('constitution', {order:'chapter_number'}),
                        q('announcements', {order:'created_at', ascending:false}),
                        q('events', {order:'event_date'}),
                        q('gallery', {order:'created_at', ascending:false}),
                        q('publications', {order:'publication_date', ascending:false}),
                        q('youth_content', {order:'created_at', ascending:false}),
                        q('payment_settings', {order:'method_name'}),
                        q('welfare_settings', {order:'setting_key'}),
                        this.currentUser?.memberId ? q('membership_applications', {order:'created_at', ascending:false}) : Promise.resolve([]),
                        this.currentUser?.memberId ? q('finance_transactions', {order:'created_at', ascending:false}) : Promise.resolve([])
                    ]);
                    const members = this.currentUser?.roleKey && ['admin','super_admin','treasurer'].includes(this.currentUser.roleKey)
                        ? await q('members', {order:'created_at', ascending:false})
                        : (this.currentUser?.memberId ? await q('members') : []);
                    const welfare = this.currentUser?.roleKey && ['admin','super_admin'].includes(this.currentUser.roleKey)
                        ? await q('welfare_requests', {order:'created_at', ascending:false})
                        : (this.currentUser?.memberId ? await q('welfare_requests', {order:'created_at', ascending:false}) : []);
                    const digitalIds = this.currentUser?.roleKey && ['admin','super_admin'].includes(this.currentUser.roleKey)
                        ? await q('digital_ids', {order:'created_at', ascending:false})
                        : (this.currentUser?.memberId ? await q('digital_ids') : []);
                    this.db.about = about[0] ? {
                        name: about[0].org_name, displayName: about[0].org_name, motto: about[0].motto,
                        history: about[0].history || '', vision: about[0].vision || '', mission: about[0].mission || '',
                        coreValues: about[0].core_values || [], contactPhone: about[0].contact_phone || '',
                        contactEmail: about[0].contact_email || '', address: about[0].address || ''
                    } : {name:window.RIBACOM_CONFIG.orgName,displayName:window.RIBACOM_CONFIG.orgName,motto:window.RIBACOM_CONFIG.motto,history:'',vision:'',mission:'',coreValues:[],contactPhone:'',contactEmail:'',address:''};
                    this.db.leadership = leadership.map(x => ({...x, photo:x.photo_url, bio:x.biography, order:x.display_order}));
                    this.db.advisers = advisers.map(x => ({...x, photo:x.photo_url, bio:x.biography}));
                    this.db.announcements = announcements.map(x => ({...x, date:x.created_at?.slice(0,10), author:x.author_id || 'RIBACOM Secretariat'}));
                    this.db.events = events.map(x => ({...x, date:x.event_date?.slice(0,10), time:x.event_date?.slice(11,16), description:x.description, image:x.image_url}));
                    this.db.gallery = gallery.map(x => ({...x}));
                    this.db.publications = publications.map(x => ({...x, date:x.publication_date}));
                    this.db.youth = youth[0] ? {title:youth[0].section_title, content:youth[0].body_content, image:youth[0].image_url} : {title:'RIBACOM Youth',content:'',image:''};
                    this.db.paymentSettings = payments.map(x => ({...x, method:x.method_name, accountNo:x.account_number, accountName:x.account_name, active:x.is_active}));
                    this.db.welfareSettings = Object.fromEntries(welfareSettings.map(x => [x.setting_key, x]));
                    if (constitution.length) {
                        const grouped = {};
                        constitution.forEach(x => { const k=x.chapter_number; if(!grouped[k]) grouped[k]={chapter:k,title:x.chapter_title,articles:[]}; grouped[k].articles.push({id:x.id,chapter_number:x.chapter_number,chapter_title:x.chapter_title,number:x.article_number,title:x.article_title,content:x.content,is_published:x.is_published}); });
                        this.db.constitution = Object.values(grouped);
                    } else this.db.constitution = [];
                    this.db.members = members.map(x => ({...x, membershipNo:x.membership_number, fullName:x.full_name, stateOfOrigin:x.state_of_origin, photo:x.photo_url, issueDate:x.created_at?.slice(0,10)}));
                    this.db.welfareRequests = welfare.map(x => ({...x, memberName:x.member_id, type:x.category, amount:x.approved_amount ?? x.amount_requested, date:x.created_at?.slice(0,10)}));
                    this.db.digitalIds = digitalIds.map(x => ({...x, idCardNumber:x.id_card_number, memberId:x.member_id, qrCodeData:x.qr_code_data}));
                    this.db.membershipApplications = membershipApplications.filter(x=>!this.currentUser?.memberId || x.user_id===this.currentUser.id);
                    this.db.financeTransactions = financeTransactions.filter(x=>!this.currentUser?.memberId || x.member_id===this.currentUser.memberId);
                    this.cloudDataLoaded = true;
                } catch (e) { console.warn('RIBACOM cloud sync failed:', e); }
            }

            navigate(viewId, params = null) {
                this.currentView = viewId;
                const container = document.getElementById('appViewport');
                window.scrollTo({ top: 0, behavior: 'smooth' });

                // Update mobile bottom nav highlights
                document.querySelectorAll('.mobile-nav-item').forEach(el => {
                    if (el.dataset.view === viewId) {
                        el.classList.add('text-ribacom-green', 'font-bold');
                        el.classList.remove('text-gray-600');
                    } else {
                        el.classList.remove('text-ribacom-green', 'font-bold');
                        el.classList.add('text-gray-600');
                    }
                });

                // Render specific view
                switch(viewId) {
                    case 'home':
                        container.innerHTML = this.renderTestModeBanner()+this.renderHomeView();
                        break;
                    case 'about':
                        container.innerHTML = this.renderAboutView();
                        break;
                    case 'leadership':
                        container.innerHTML = this.renderLeadershipView();
                        break;
                    case 'constitution':
                        container.innerHTML = this.renderConstitutionView();
                        break;
                    case 'membership':
                        container.innerHTML = this.renderMembershipView();
                        break;
                    case 'members':
                        if (!this.currentUser) {
                            this.toast('Please log in to access the members directory.', 'warning');
                            this.openLoginModal();
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = this.renderMembersView();
                        break;
                    case 'digital-id':
                        container.innerHTML = this.renderDigitalIdView();
                        setTimeout(() => this.generateQRCode(), 100);
                        break;
                    case 'welfare':
                        container.innerHTML = this.renderWelfareView();
                        break;
                    case 'events':
                        container.innerHTML = this.renderEventsView();
                        break;
                    case 'announcements':
                        container.innerHTML = this.renderAnnouncementsView();
                        break;
                    case 'publications':
                        container.innerHTML = this.renderPublicationsView();
                        break;
                    case 'gallery':
                        container.innerHTML = this.renderGalleryView();
                        break;
                    case 'youth':
                        container.innerHTML = this.renderYouthView();
                        break;
                    case 'advisers':
                        container.innerHTML = this.renderAdvisersView();
                        break;
                    case 'contact':
                        container.innerHTML = this.renderContactView();
                        break;
                    case 'member-dashboard':
                        if (!this.currentUser) {
                            this.toast('Please log in to access your portal.', 'warning');
                            this.openLoginModal();
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = this.renderMemberDashboardView();
                        break;
                    default:
                        container.innerHTML = this.renderHomeView();
                        break;
                }
            }

            renderMemberDashboardView() {
                const u = this.currentUser;
                return `
                    <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                        <!-- Profile Header -->
                        <div class="bg-ribacom-navy text-white p-6 rounded-3xl shadow-xl flex items-center space-x-4 border border-ribacom-gold/30">
                            <img src="${u.photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop'}" class="w-16 h-16 rounded-2xl object-cover ring-2 ring-ribacom-gold">
                            <div>
                                <span class="bg-ribacom-gold text-ribacom-navy font-black text-[10px] px-2 py-0.5 rounded uppercase">${u.role || 'Member'}</span>
                                <h2 class="text-xl font-extrabold mt-1">${u.fullName}</h2>
                                <p class="text-xs text-ribacom-gold font-bold">${u.membershipNo || 'RBC-GM-2026-001'}</p>
                            </div>
                        </div>

                        <!-- Payment & Dues Calculator Widget -->
                        <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-4">
                            <h3 class="font-bold text-base text-ribacom-navy flex items-center gap-2">
                                <i class="fa-solid fa-calculator text-ribacom-green"></i> Dues & Welfare Levy Calculator
                            </h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 p-4 rounded-2xl">
                                <div>
                                    <label class="block text-xs font-bold text-gray-600 mb-1">Months to Pay Dues (D50/mo)</label>
                                    <input type="number" id="calcMonths" value="1" min="1" max="12" oninput="app.calculateDuesTotal()" class="w-full px-3 py-1.5 border rounded-lg text-sm">
                                </div>
                                <div>
                                    <p class="text-xs font-bold text-gray-600 mb-1">Total Payment Due</p>
                                    <p id="calcTotal" class="text-2xl font-extrabold text-ribacom-green">D50</p>
                                </div>
                            </div>

                            <div class="border-t pt-4 space-y-2">
                                <h4 class="font-bold text-xs text-gray-700">Official Payment Gateways:</h4>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                    ${this.db.paymentSettings.map(p => `
                                        <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                                            <p class="font-bold text-ribacom-navy">${p.method}</p>
                                            <p class="text-gray-600">${p.accountNo} (${p.accountName})</p>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            calculateDuesTotal() {
                const months = parseInt(document.getElementById('calcMonths')?.value || 1);
                const total = months * 50;
                const target = document.getElementById('calcTotal');
                if (target) target.innerText = `D${total}`;
            }

            renderAdminDashboardView() {
                return `
                    <div class="space-y-8 animate-fadeIn">
                        <!-- Admin Banner -->
                        <div class="bg-ribacom-navy text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 border-b-4 border-ribacom-gold">
                            <div>
                                <span class="bg-ribacom-gold text-ribacom-navy font-extrabold text-[10px] px-2.5 py-0.5 rounded uppercase">Secretariat Command Center</span>
                                <h2 class="text-2xl font-extrabold mt-1">Management Portal</h2>
                                <p class="text-xs text-gray-300">Full control over members, applications, welfare claims, publications, and organization content.</p>
                            </div>
                            <div class="flex gap-2">
                                <button onclick="app.runSystemVerification()" class="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-2 rounded-xl text-xs border border-white/20">
                                    <i class="fa-solid fa-shield-halved text-ribacom-gold"></i> System Verification
                                </button>
                                <button onclick="app.navigate('admin-digital-ids')" class="bg-ribacom-gold text-ribacom-navy font-bold px-3 py-2 rounded-xl text-xs"><i class="fa-solid fa-id-card"></i> Digital IDs</button>
                            </div>
                        </div>

                        <!-- Stat Cards Overview -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow space-y-1">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Total Members</p>
                                <h3 class="text-2xl font-extrabold text-ribacom-navy">${this.db.members.length}</h3>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow space-y-1">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Welfare Requests</p>
                                <h3 class="text-2xl font-extrabold text-ribacom-green">${this.db.welfareRequests.length}</h3>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow space-y-1">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Announcements</p>
                                <h3 class="text-2xl font-extrabold text-amber-600">${this.db.announcements.length}</h3>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow space-y-1">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Events Scheduled</p>
                                <h3 class="text-2xl font-extrabold text-purple-600">${this.db.events.length}</h3>
                            </div>
                        </div>

                        <!-- Admin Management Modules Grid -->
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <!-- Members & Welfare Admin Panel -->
                            <div class="lg:col-span-2 space-y-6">
                                <!-- Members Table -->
                                <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-4">
                                    <div class="flex items-center justify-between">
                                        <h3 class="font-bold text-base text-gray-800">Member Directory & Approvals</h3>
                                        <span class="text-xs bg-emerald-100 text-ribacom-green font-bold px-2.5 py-0.5 rounded-full">${this.db.members.length} Registered</span>
                                    </div>

                                    <div class="overflow-x-auto">
                                        <table class="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr class="bg-gray-50 text-gray-500 uppercase font-semibold">
                                                    <th class="p-2">Member</th>
                                                    <th class="p-2">Membership No</th>
                                                    <th class="p-2">Category</th>
                                                    <th class="p-2">Status</th>
                                                    <th class="p-2 text-right">Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-gray-100">
                                                ${this.db.members.map(m => `
                                                    <tr>
                                                        <td class="p-2 font-bold text-gray-800">${m.fullName}</td>
                                                        <td class="p-2 text-ribacom-green font-semibold">${m.membershipNo}</td>
                                                        <td class="p-2">${m.category}</td>
                                                        <td class="p-2"><span class="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] font-bold">${m.status}</span></td>
                                                        <td class="p-2 text-right">
                                                            ${m.status==='pending'?`<button onclick="app.approveMember('${m.id}')" class="text-emerald-600 font-bold text-[11px] mr-2">Approve</button><button onclick="app.rejectMember('${m.id}')" class="text-amber-600 font-bold text-[11px] mr-2">Reject</button>`:''}${m.status==='approved'?`<button onclick="app.suspendMember('${m.id}')" class="text-amber-600 font-bold text-[11px] mr-2">Suspend</button>`:''}<button onclick="app.deleteMember('${m.id}')" class="text-red-500 hover:text-red-700 font-bold text-[11px]">Delete</button>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                <!-- Welfare Management Table -->
                                <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-4">
                                    <h3 class="font-bold text-base text-gray-800">Welfare Requests Management</h3>
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-left text-xs border-collapse">
                                            <thead>
                                                <tr class="bg-gray-50 text-gray-500 uppercase font-semibold">
                                                    <th class="p-2">Claimant</th>
                                                    <th class="p-2">Type</th>
                                                    <th class="p-2">Amount</th>
                                                    <th class="p-2">Status</th>
                                                    <th class="p-2 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody class="divide-y divide-gray-100">
                                                ${this.db.welfareRequests.map(w => `
                                                    <tr>
                                                        <td class="p-2 font-bold">${w.memberName}</td>
                                                        <td class="p-2">${w.type}</td>
                                                        <td class="p-2 font-bold text-ribacom-green">D${w.amount}</td>
                                                        <td class="p-2"><span class="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[10px] font-bold">${w.status}</span></td>
                                                        <td class="p-2 text-right">
                                                            <div class="flex gap-1 justify-end flex-wrap"><button onclick="app.updateWelfareStatus('${w.id}','under_review')" class="bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold">Review</button><button onclick="app.updateWelfareStatus('${w.id}','approved')" class="bg-ribacom-green text-white px-2 py-1 rounded text-[10px] font-bold">Approve</button><button onclick="app.updateWelfareStatus('${w.id}','rejected')" class="bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold">Reject</button><button onclick="app.updateWelfareStatus('${w.id}','paid')" class="bg-ribacom-navy text-white px-2 py-1 rounded text-[10px] font-bold">Paid</button></div>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>

                            <!-- Content Creation Side Panel -->
                            <div class="space-y-6">
                                <!-- Quick Announcement Publisher -->
                                <div class="bg-white p-5 rounded-3xl border border-gray-100 card-shadow space-y-3">
                                    <h3 class="font-bold text-sm text-gray-800">Post New Announcement</h3>
                                    <form onsubmit="app.handleAdminPostAnnouncement(event)" class="space-y-3">
                                        <input type="text" required id="admin_ann_title" placeholder="Notice Title" class="w-full px-3 py-1.5 border rounded-lg text-xs outline-none">
                                        <select id="admin_ann_cat" class="w-full px-3 py-1.5 border rounded-lg text-xs outline-none">
                                            <option value="General">General Notice</option>
                                            <option value="Meeting">Meeting Bulletin</option>
                                            <option value="Urgent">Urgent Alert</option>
                                        </select>
                                        <textarea required id="admin_ann_content" rows="2" placeholder="Notice text..." class="w-full px-3 py-1.5 border rounded-lg text-xs outline-none"></textarea>
                                        <button type="submit" class="w-full bg-ribacom-navy text-white font-bold py-2 rounded-lg text-xs hover:bg-slate-800 transition">
                                            Publish Notice
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }

            async handleMembershipSubmit(e) {
                e.preventDefault();
                if (!this.supabaseClient) { this.toast('Supabase is not connected.', 'error'); return; }
                const val = id => document.getElementById(id)?.value?.trim() || '';
                const checked = id => !!document.getElementById(id)?.checked;
                const fullName=val('m_fullName'), phone=val('m_phone'), email=val('m_email').toLowerCase();
                const state=val('m_state'), lga=val('m_lga'), category=val('m_category').startsWith('Associate')?'associate':'regular';
                const address=val('m_address'), password=val('m_password'), confirm=val('m_passwordConfirm');
                const photoInput=document.getElementById('m_photo_file');
                if(password.length<8){this.toast('Create a password of at least 8 characters.','warning');return;}
                if(password!==confirm){this.toast('Passwords do not match.','warning');return;}
                if(!checked('m_declaration')){this.toast('Please accept the declaration before submitting.','warning');return;}

                let photo=null;
                const photoFile=photoInput?.files?.[0];
                if(photoFile){
                    if(!photoFile.type.startsWith('image/')){this.toast('Please select a valid image file.','warning');return;}
                    if(photoFile.size>5*1024*1024){this.toast('Passport photograph must be 5 MB or smaller.','warning');return;}
                    const ext=(photoFile.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
                    const path=`memberships/application-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
                    const up=await this.supabaseClient.storage.from('avatars').upload(path,photoFile,{contentType:photoFile.type,upsert:false,cacheControl:'31536000'});
                    if(up.error){this.toast(up.error.message,'error');return;}
                    photo=this.supabaseClient.storage.from('avatars').getPublicUrl(up.data.path).data.publicUrl;
                }

                const applicationDetails={
                    previous_name:val('m_otherName'), date_of_birth:val('m_dob')||null, gender:val('m_gender')||null,
                    nationality:val('m_nationality')||'Nigerian', passport_or_id:val('m_idNumber'),
                    origin_community:val('m_originCommunity'), clan_ward:val('m_clanWard'),
                    previous_association:val('m_previousAssociation'), emergency_contact_name:val('m_emergencyName'),
                    emergency_contact_phone:val('m_emergencyPhone'), spouse_name:val('m_spouse'),
                    children_count:Number(val('m_children')||0), next_of_kin:val('m_nextOfKin'),
                    next_of_kin_phone:val('m_nextOfKinPhone'), occupation:val('m_occupation'),
                    employer_business:val('m_employer'), work_address:val('m_workAddress'), skills:val('m_skills'),
                    interests:{welfare:checked('m_welfareInterest'),youth:checked('m_youthInterest'),cultural:checked('m_culturalInterest'),volunteer:checked('m_volunteer')},
                    constitution_consent:checked('m_constitutionConsent'), information_declaration:checked('m_declaration')
                };

                this.toast('Creating your secure RIBACOM account...','info');
                const {data:authData,error:authError}=await this.supabaseClient.auth.signUp({
                    email,password,options:{data:{full_name:fullName,phone,application_details:applicationDetails}}
                });
                if(authError){this.toast(authError.message,'error');return;}
                const user=authData?.user;
                if(!user){this.toast('Account creation did not return a user. Please try again.','error');return;}

                const {error:applicationError}=await this.supabaseClient.from('membership_applications').insert({
                    user_id:user.id,full_name:fullName,date_of_birth:applicationDetails.date_of_birth,gender:applicationDetails.gender,
                    nationality:applicationDetails.nationality,state_of_origin:state==='Other / Associate'?'Other':state.replace(' State',''),
                    lga,town_village:applicationDetails.origin_community,community_clan:applicationDetails.clan_ward,
                    phone,whatsapp:phone,email,current_address:address,occupation:applicationDetails.occupation,
                    employer_business:applicationDetails.employer_business,nigerian_passport_number:applicationDetails.passport_or_id,
                    membership_category:category==='associate'?'Associate Member':'Regular Member',
                    rivers_bayelsa_connection:state,spouse_name:applicationDetails.spouse_name,
                    next_of_kin_name:applicationDetails.next_of_kin,next_of_kin_phone:applicationDetails.next_of_kin_phone,
                    emergency_contact_name:applicationDetails.emergency_contact_name,emergency_contact_phone:applicationDetails.emergency_contact_phone,
                    photo_url:photo,declaration_accepted:true,digital_signature:fullName,status:'pending'
                });
                if(applicationError){this.toast(applicationError.message,'error');return;}

                const {error:profileError}=await this.supabaseClient.from('profiles').upsert({id:user.id,email,full_name:fullName,phone},{onConflict:'id'});
                if(profileError) console.warn('Profile sync:',profileError.message);

                if(!authData.session){
                    this.toast('Application submitted. Please verify your email, then sign in. The Secretariat will review your application.','success');
                    this.openLoginModal();
                    return;
                }

                const {error}=await this.supabaseClient.from('members').upsert({
                    user_id:user.id,full_name:fullName,email,phone,
                    state_of_origin:state==='Other / Associate'?'Other':state.replace(' State',''),lga,address,
                    photo_url:photo,nationality:applicationDetails.nationality,category,status:'pending',
                    date_of_birth:applicationDetails.date_of_birth,gender:applicationDetails.gender,
                    emergency_contact_name:applicationDetails.emergency_contact_name,emergency_contact_phone:applicationDetails.emergency_contact_phone
                },{onConflict:'user_id'});
                if(error){this.toast(error.message,'error');return;}
                await this.hydrateCurrentUser(user);
                this.toast('Membership application submitted for Secretariat approval.','success');
                await this.loadCloudData();
                this.navigate('member-dashboard');
            }
            async handleWelfareSubmit(e) {
                e.preventDefault();
                if (!this.supabaseClient || !this.currentUser?.memberId) { this.toast('Please sign in as an approved member first.', 'warning'); return; }
                const type = document.getElementById('w_type').value;
                const categoryMap = {Wedding:'wedding',Birth:'birth',Bereavement:'loss_parent',Other:'other'};
                const category = categoryMap[type] || type.toLowerCase().replace(/\\s+/g,'_');
                const amount = type === 'Wedding' ? 1000 : type === 'Bereavement' ? 1500 : 500;
                const description = document.getElementById('w_desc').value.trim();
                const { error } = await this.supabaseClient.from('welfare_requests').insert({member_id:this.currentUser.memberId,category,amount_requested:amount,description,status:'pending'});
                if (error) { this.toast(error.message, 'error'); return; }
                this.toast('Welfare request submitted to the Executive Council.', 'success');
                await this.loadCloudData();
                this.navigate('welfare');
            }

            async handleAdminPostAnnouncement(e) {
                e.preventDefault();
                if (!this.supabaseClient || !['admin','super_admin'].includes(this.currentUser?.roleKey)) { this.toast('Administrator access required.', 'error'); return; }
                const { error } = await this.supabaseClient.from('announcements').insert({title:document.getElementById('admin_ann_title').value.trim(),content:document.getElementById('admin_ann_content').value.trim(),is_published:true,author_id:this.currentUser.id});
                if (error) { this.toast(error.message, 'error'); return; }
                this.toast('Announcement published to Supabase.', 'success');
                await this.loadCloudData();
                this.navigate('admin-dashboard');
            }

            async deleteMember(id) {
                if (!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
                const { error } = await this.supabaseClient.from('members').delete().eq('id', id);
                if (error) { this.toast(error.message, 'error'); return; }
                await this.loadCloudData(); this.toast('Member record deleted.', 'info'); this.navigate('admin-dashboard');
            }

            async approveWelfare(id) {
                if (!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
                const { error } = await this.supabaseClient.from('welfare_requests').update({status:'approved',approved_amount:this.db.welfareRequests.find(x=>x.id===id)?.amount || null}).eq('id',id);
                if (error) { this.toast(error.message, 'error'); return; }
                await this.loadCloudData(); this.toast('Welfare request approved.', 'success'); this.navigate('admin-dashboard');
            }

            async handleLogin(e) {
                e.preventDefault();
                const email = document.getElementById('loginEmail').value.trim();
                const password = document.getElementById('loginPassword').value;

                if (!email || !password) {
                    this.toast('Enter your email and password.', 'warning');
                    return;
                }

                if (!this.supabaseClient) {
                    this.toast('Supabase is not connected. Please check the connection.', 'error');
                    return;
                }

                this.toast('Signing in securely...', 'info');
                const { data, error } = await this.supabaseClient.auth.signInWithPassword({ email, password });
                if (error || !data?.user) {
                    console.error('RIBACOM login error:', error);
                    this.toast(error?.message || 'Login failed. Check your credentials.', 'error');
                    return;
                }

                const user = data.user;
                const [{ data: profile }, { data: member }] = await Promise.all([
                    this.supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                    this.supabaseClient.from('members').select('*').eq('user_id', user.id).maybeSingle()
                ]);

                const role = profile?.role || 'member';
                if (this.loginMode === 'treasurer' && role !== 'treasurer') {
                    await this.supabaseClient.auth.signOut();
                    this.toast('This login is reserved for the RIBACOM Treasurer account.', 'error');
                    return;
                }
                const displayRole = role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'treasurer' ? 'Treasurer' : role === 'visitor' ? 'Visitor' : 'Member';
                this.currentUser = {
                    id: user.id,
                    userId: user.id,
                    email: user.email,
                    fullName: profile?.full_name || member?.full_name || user.email,
                    phone: profile?.phone || member?.phone || '',
                    role: displayRole,
                    roleKey: role,
                    membershipNumber: member?.membership_number || '',
                    memberId: member?.id || null,
                    status: member?.status || null,
                    photoUrl: profile?.avatar_url || member?.photo_url || ''
                };

                this.closeAuthModal();
                this.updateAuthHeaderUI();
                this.toast(`Welcome back, ${this.currentUser.fullName}`, 'success');
                this.navigate(role === 'treasurer' ? 'treasurer-dashboard' : (['super_admin','admin'].includes(role) ? 'admin-dashboard' : 'member-dashboard'));
            }

            async restoreSupabaseSession() {
                if (!this.supabaseClient) return;
                try {
                    const { data } = await this.supabaseClient.auth.getSession();
                    if (!data?.session?.user) return;
                    await this.hydrateCurrentUser(data.session.user);
                } catch (error) {
                    console.warn('Session restore failed:', error);
                }
            }

            async hydrateCurrentUser(user) {
                if (!user || !this.supabaseClient) return;
                const [{ data: profile }, { data: member }] = await Promise.all([
                    this.supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                    this.supabaseClient.from('members').select('*').eq('user_id', user.id).maybeSingle()
                ]);
                const role = profile?.role || 'member';
                this.currentUser = {
                    id: user.id,
                    userId: user.id,
                    email: user.email,
                    fullName: profile?.full_name || member?.full_name || user.email,
                    phone: profile?.phone || member?.phone || '',
                    role: role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'treasurer' ? 'Treasurer' : role === 'visitor' ? 'Visitor' : 'Member',
                    roleKey: role,
                    membershipNumber: member?.membership_number || '',
                    memberId: member?.id || null,
                    status: member?.status || null,
                    photoUrl: profile?.avatar_url || member?.photo_url || ''
                };
                this.updateAuthHeaderUI();
            }

            async logout() {
                if (this.supabaseClient) {
                    const { error } = await this.supabaseClient.auth.signOut();
                    if (error) console.warn('Supabase logout error:', error);
                }
                this.currentUser = null;
                this.updateAuthHeaderUI();
                this.toast('Logged out successfully', 'info');
                this.navigate('home');
            }

            handleAuthAction() {
                if (this.currentUser) {
                    if (this.currentUser.roleKey === 'treasurer') {
                        this.navigate('treasurer-dashboard');
                    } else if (this.currentUser.role.includes('Admin')) {
                        this.navigate('admin-dashboard');
                    } else {
                        this.navigate('member-dashboard');
                    }
                } else {
                    this.openLoginModal();
                }
            }

            updateAuthHeaderUI() {
                const container = document.getElementById('authButtonsContainer');
                const miniStatus = document.getElementById('userMiniStatus');
                const idBtn = document.getElementById('digitalIdQuickBtn');
                const mobileProfile = document.getElementById('mobileProfileCard');
                const mobileFooter = document.getElementById('mobileDrawerFooter');

                if (this.currentUser) {
                    miniStatus.innerText = this.currentUser.fullName;
                    if (idBtn) idBtn.classList.remove('hidden');

                    if (mobileProfile) {
                        mobileProfile.classList.remove('hidden');
                        document.getElementById('mobileUserName').innerText = this.currentUser.fullName;
                        document.getElementById('mobileUserRole').innerText = this.currentUser.role || 'Member';
                    }

                    container.innerHTML = `
                        <button onclick="app.handleAuthAction()" title="${esc(this.currentUser?.fullName||'Member Portal')}" class="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition border border-white/20 max-w-[180px] truncate">
                            ${esc(this.currentUser?.fullName||'Member Portal')}
                        </button>
                        <button onclick="app.logout()" class="text-gray-300 hover:text-white p-1.5 text-xs">
                            <i class="fa-solid fa-right-from-bracket"></i>
                        </button>
                    `;

                    if (mobileFooter) {
                        mobileFooter.innerHTML = `
                            <button onclick="app.logout(); app.toggleMobileDrawer();" class="w-full bg-red-600/80 hover:bg-red-700 text-white font-bold py-2 rounded-xl text-xs transition">
                                Sign Out
                            </button>
                        `;
                    }
                } else {
                    miniStatus.innerText = "Guest User";
                    if (idBtn) idBtn.classList.add('hidden');
                    if (mobileProfile) mobileProfile.classList.add('hidden');

                    container.innerHTML = `
                        <button onclick="app.openLoginModal()" class="bg-ribacom-gold hover:bg-yellow-400 text-ribacom-navy font-extrabold px-3.5 py-1.5 rounded-lg text-xs transition shadow-sm">
                            Member Login
                        </button>
                    `;

                    if (mobileFooter) {
                        mobileFooter.innerHTML = `
                            <button onclick="app.openLoginModal(); app.toggleMobileDrawer();" class="w-full bg-ribacom-gold text-ribacom-navy font-bold py-2 rounded-xl text-xs transition">
                                Member Login / Portal
                            </button>
                        `;
                    }
                }
            }

            openLoginModal() {
                this.loginMode = 'member';
                document.getElementById('authModalTitle').innerText = 'Member Login';
                document.getElementById('registerPrompt').classList.remove('hidden');
                document.getElementById('authModal').classList.remove('hidden');
                this.switchAuthTab('login');
            }

            openTreasurerLoginModal() {
                this.loginMode = 'treasurer';
                document.getElementById('authModalTitle').innerText = 'Treasurer Login';
                document.getElementById('registerPrompt').classList.add('hidden');
                document.getElementById('authModal').classList.remove('hidden');
                this.switchAuthTab('login');
            }

            closeAuthModal() {
                document.getElementById('authModal').classList.add('hidden');
                this.loginMode = 'member';
            }

            switchAuthTab(tab) {
                const loginForm = document.getElementById('loginForm');
                const regPrompt = document.getElementById('registerPrompt');
                const tLogin = document.getElementById('tabLoginBtn');
                const tReg = document.getElementById('tabRegisterBtn');

                if (tab === 'login') {
                    loginForm.classList.remove('hidden');
                    regPrompt.classList.add('hidden');
                    tLogin.className = "flex-1 py-2 text-center text-sm font-bold border-b-2 border-ribacom-green text-ribacom-green";
                    tReg.className = "flex-1 py-2 text-center text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700";
                } else {
                    loginForm.classList.add('hidden');
                    regPrompt.classList.remove('hidden');
                    tReg.className = "flex-1 py-2 text-center text-sm font-bold border-b-2 border-ribacom-green text-ribacom-green";
                    tLogin.className = "flex-1 py-2 text-center text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700";
                }
            }

            toggleMobileDrawer() {
                const drawer = document.getElementById('mobileDrawer');
                drawer.classList.toggle('hidden');
            }

            async approveMember(id) { return this.setMemberStatus(id,'approved'); }
            async rejectMember(id) { return this.setMemberStatus(id,'rejected'); }
            async suspendMember(id) { return this.setMemberStatus(id,'suspended'); }
            async setMemberStatus(id,status) {
                if (!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
                const member=this.db.members.find(m=>m.id===id);
                if(!member){this.toast('Member record not found.','error');return;}
                const patch={status,updated_at:new Date().toISOString()};
                if(status==='approved'){
                    const currentNo=member.membershipNo||member.membership_number;
                    if(!currentNo) patch.membership_number=`RBC-GM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
                }
                const {data,error}=await this.supabaseClient.from('members').update(patch).eq('id',id).select().maybeSingle();
                if(error){this.toast(error.message,'error');return;}
                await this.loadCloudData();
                if(status==='approved'){
                    const approvedMember=this.db.members.find(m=>m.id===id);
                    const existingId=this.db.digitalIds.find(x=>x.memberId===id);
                    if(approvedMember && !existingId){
                        await this.createDigitalId(id);
                    } else {
                        this.toast('Application approved. Digital ID is already available.','success');
                        this.navigate('admin-members');
                    }
                } else if(status==='rejected'){
                    this.toast('Membership application rejected.','warning');
                    this.navigate('admin-members');
                } else if(status==='suspended'){
                    this.toast('Membership suspended.','warning');
                    this.navigate('admin-members');
                } else {
                    this.toast(`Member status changed to ${status}.`,'success');
                    this.navigate('admin-members');
                }
            }
            async createDigitalId(memberId) {
                if (!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
                const member=this.db.members.find(m=>m.id===memberId); if(!member){this.toast('Member not found.','error');return;}
                if(member.status!=='approved'){this.toast('Only approved members can receive a Digital ID.','warning');return;}
                const existing=this.db.digitalIds.find(x=>x.memberId===memberId); if(existing){this.toast('This member already has a Digital ID. Use edit/renew instead.','warning');return;}
                const idCardNumber=`RBC-GM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
                const qr=`RIBACOM-GAMBIA|ID:${idCardNumber}|MEMBER:${memberId}|NAME:${member.fullName}`;
                const expiry=new Date(); expiry.setFullYear(expiry.getFullYear()+1); const {error}=await this.supabaseClient.from('digital_ids').insert({member_id:memberId,id_card_number:idCardNumber,qr_code_data:qr,status:'active',issued_at:new Date().toISOString(),expires_at:expiry.toISOString()});
                if(error){this.toast(error.message,'error');return;} await this.loadCloudData(); this.toast('Digital ID issued successfully.','success'); this.navigate('admin-digital-ids');
            }
            async changeDigitalIdStatus(id,status) {
                if (!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
                const {error}=await this.supabaseClient.from('digital_ids').update({status}).eq('id',id); if(error){this.toast(error.message,'error');return;} await this.loadCloudData(); this.navigate('admin-digital-ids');
            }
            async renewDigitalId(id) {
                if (!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
                const existing=this.db.digitalIds.find(x=>x.id===id); if(!existing)return;
                const base=new Date(Math.max(Date.now(), existing.expires_at ? new Date(existing.expires_at).getTime() : Date.now())); base.setFullYear(base.getFullYear()+1);
                const {error}=await this.supabaseClient.from('digital_ids').update({expires_at:base.toISOString(),status:'active'}).eq('id',id); if(error){this.toast(error.message,'error');return;} await this.loadCloudData(); this.toast('Digital ID renewed for one year.','success'); this.navigate('admin-digital-ids');
            }
            async deleteDigitalId(id) {
                if (!['admin','super_admin'].includes(this.currentUser?.roleKey)) return;
                const {error}=await this.supabaseClient.from('digital_ids').delete().eq('id',id); if(error){this.toast(error.message,'error');return;} await this.loadCloudData(); this.toast('Digital ID record deleted.','info'); this.navigate('admin-digital-ids');
            }
            copyDigitalId(number){ navigator.clipboard?.writeText(number).then(()=>this.toast('Digital ID number copied.','success')).catch(()=>this.toast(number,'info')); }
            renderAdminDigitalIdsView() {
                const rows=this.db.digitalIds.map(id=>{const m=this.db.members.find(x=>x.id===id.memberId)||{}; return `<tr class="border-b border-gray-100"><td class="p-3 font-bold">${m.fullName||'Unknown'}</td><td class="p-3 text-ribacom-green font-bold">${id.idCardNumber}</td><td class="p-3">${id.status}</td><td class="p-3">${id.expires_at?.slice(0,10)||'Perpetual'}</td><td class="p-3 text-right space-x-1"><button onclick="app.changeDigitalIdStatus('${id.id}','${id.status==='active'?'suspended':'active'}')" class="px-2 py-1 rounded bg-slate-100 text-xs font-bold">${id.status==='active'?'Suspend':'Activate'}</button><button onclick="app.renewDigitalId('${id.id}')" class="px-2 py-1 rounded bg-emerald-100 text-emerald-700 text-xs font-bold">Renew</button><button onclick="app.changeDigitalIdStatus('${id.id}','revoked')" class="px-2 py-1 rounded bg-red-100 text-red-700 text-xs font-bold">Revoke</button></td></tr>`}).join('');
                const eligible=this.db.members.filter(m=>m.status==='approved' && !this.db.digitalIds.some(id=>id.memberId===m.id));
                return `<div class="space-y-6 animate-fadeIn"><div class="flex items-center justify-between"><div><h2 class="text-2xl font-extrabold text-ribacom-navy">Digital ID Administration</h2><p class="text-xs text-gray-500">Issue and manage official RIBACOM Digital IDs.</p></div><button onclick="app.navigate('admin-dashboard')" class="px-4 py-2 rounded-xl bg-ribacom-navy text-white text-xs font-bold">Back to Admin</button></div><div class="bg-white rounded-3xl p-5 card-shadow"><h3 class="font-extrabold mb-3">Approved Members Awaiting ID</h3>${eligible.length?`<div class="space-y-2">${eligible.map(m=>`<div class="flex items-center justify-between border rounded-xl p-3"><div><b>${m.fullName}</b><div class="text-[11px] text-gray-500">${m.membershipNo||'No membership number'}</div></div><button onclick="app.createDigitalId('${m.id}')" class="bg-ribacom-green text-white px-3 py-2 rounded-lg text-xs font-bold">Issue ID</button></div>`).join('')}</div>`:'<p class="text-xs text-gray-500">No approved members are waiting for a Digital ID.</p>'}</div><div class="bg-white rounded-3xl p-5 card-shadow overflow-x-auto"><h3 class="font-extrabold mb-3">Issued Digital IDs</h3><table class="w-full text-left text-xs"><thead><tr class="bg-gray-50"><th class="p-3">Member</th><th class="p-3">ID Number</th><th class="p-3">Status</th><th class="p-3">Expiry</th><th class="p-3 text-right">Actions</th></tr></thead><tbody>${rows||'<tr><td colspan="5" class="p-6 text-center text-gray-500">No Digital IDs issued yet.</td></tr>'}</tbody></table></div></div>`;
            }

            toast(message, type = 'info') {
                const container = document.getElementById('toastContainer');
                const t = document.createElement('div');
                let bg = 'bg-slate-900 text-white';
                if (type === 'success') bg = 'bg-ribacom-green text-white';
                if (type === 'error') bg = 'bg-red-600 text-white';
                if (type === 'warning') bg = 'bg-amber-500 text-white';

                t.className = `${bg} p-3.5 rounded-xl shadow-2xl text-xs font-semibold flex items-center justify-between gap-3 pointer-events-auto transition duration-300 transform translate-y-2`;
                t.innerHTML = `
                    <span>${message}</span>
                    <button onclick="this.parentElement.remove()" class="text-white/80 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
                `;
                container.appendChild(t);

                setTimeout(() => {
                    t.remove();
                }, 4000);
            }
        }

                // Shared HTML escaping helper used by all modular views.
        function esc(value) {
            return String(value ?? '').replace(/[&<>"']/g, ch => ({
                '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
            }[ch]));
        }

// Global Initialization
        let app;
        window.addEventListener('DOMContentLoaded', () => {
            app = new RibacomApp();
            app.navigate('home');
        });