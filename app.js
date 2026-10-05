// Empty in-memory UI cache; Supabase is the authoritative data source.
        class RibacomApp {
            constructor() {
                this.db = {members:[],digitalIds:[],leadership:[],advisers:[],constitution:[],announcements:[],events:[],gallery:[],publications:[],youth:{title:'RIBACOM Youth',content:'',image:''},paymentSettings:[],welfareRequests:[],about:{name:window.RIBACOM_CONFIG.orgName,displayName:window.RIBACOM_CONFIG.orgName,motto:window.RIBACOM_CONFIG.motto}};
                this.currentUser = null;
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
                this.testDigitalId={
                    id:'TEST-DIGITAL-ID-001',
                    memberId:this.testMember.id,
                    membership_number:this.testMember.membership_number,
                    status:'active',
                    issue_date:new Date().toISOString(),
                    expiry_date:new Date(Date.now()+365*24*60*60*1000).toISOString()
                };
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
                    const [about, leadership, advisers, constitution, announcements, events, gallery, publications, youth, payments] = await Promise.all([
                        q('ribacom_about_content', {limit:1}),
                        q('leadership', {order:'display_order'}),
                        q('advisers', {order:'created_at', ascending:false}),
                        q('constitution', {order:'chapter_number'}),
                        q('announcements', {order:'created_at', ascending:false}),
                        q('events', {order:'event_date'}),
                        q('gallery', {order:'created_at', ascending:false}),
                        q('publications', {order:'publication_date', ascending:false}),
                        q('youth_content', {order:'created_at', ascending:false}),
                        q('payment_settings', {order:'method_name'})
                    ]);
                    const members = this.currentUser?.roleKey && ['admin','super_admin'].includes(this.currentUser.roleKey)
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
                    if (constitution.length) {
                        const grouped = {};
                        constitution.forEach(x => { const k=x.chapter_number; if(!grouped[k]) grouped[k]={chapter:k,title:x.chapter_title,articles:[]}; grouped[k].articles.push({id:x.id,chapter_number:x.chapter_number,chapter_title:x.chapter_title,number:x.article_number,title:x.article_title,content:x.content,is_published:x.is_published}); });
                        this.db.constitution = Object.values(grouped);
                    } else this.db.constitution = [];
                    this.db.members = members.map(x => ({...x, membershipNo:x.membership_number, fullName:x.full_name, stateOfOrigin:x.state_of_origin, photo:x.photo_url, issueDate:x.created_at?.slice(0,10)}));
                    this.db.welfareRequests = welfare.map(x => ({...x, memberName:x.member_id, type:x.category, amount:x.approved_amount ?? x.amount_requested, date:x.created_at?.slice(0,10)}));
                    this.db.digitalIds = digitalIds.map(x => ({...x, idCardNumber:x.id_card_number, memberId:x.member_id, qrCodeData:x.qr_code_data}));
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
                    case 'admin-digital-ids':
                        if (!this.currentUser || !['admin','super_admin'].includes(this.currentUser.roleKey)) {
                            this.toast('Access denied. Administrator privileges required.', 'error');
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = this.renderAdminDigitalIdsView();
                        break;
                    case 'admin-dashboard':
                        if (!this.currentUser || (this.currentUser.role !== 'Admin' && this.currentUser.role !== 'Super Admin')) {
                            this.toast('Access denied. Administrator privileges required.', 'error');
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = this.renderAdminDashboardView();
                        break;
                    default:
                        container.innerHTML = this.renderHomeView();
                }

                this.updateAuthHeaderUI();
            }

            renderMembersView() {
                const isAdmin=['admin','super_admin'].includes(this.currentUser?.roleKey);
                const records=isAdmin ? this.db.members : this.db.members.filter(m=>m.id===this.currentUser?.memberId);
                return `
                    <div class="space-y-6 animate-fadeIn">
                        <div class="text-center">
                            <span class="text-[10px] font-extrabold uppercase tracking-widest text-ribacom-green">RIBACOM Members</span>
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Members Directory</h2>
                            <p class="text-xs text-gray-500 mt-1">${isAdmin?'Administrator view — complete member records.':'Your membership record — private to your account.'}</p>
                        </div>
                        <div class="bg-white rounded-3xl border border-gray-100 card-shadow overflow-hidden">
                            <div class="p-4 bg-gray-50 border-b flex items-center justify-between">
                                <span class="text-sm font-extrabold text-ribacom-navy">${records.length} record${records.length===1?'':'s'}</span>
                                ${!isAdmin?'<button onclick="app.navigate(\'member-dashboard\')" class="text-xs font-bold text-ribacom-green">Open My Dashboard</button>':''}
                            </div>
                            <div class="divide-y">
                                ${records.length?records.map(m=>`
                                    <div class="p-4 flex items-center gap-3">
                                        <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            ${m.photo_url?'<img src="'+m.photo_url+'" class="w-full h-full object-cover" alt="Member">':'<i class="fa-solid fa-user text-ribacom-green"></i>'}
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div class="font-extrabold text-sm text-ribacom-navy">${m.full_name||'Member'}</div>
                                            <div class="text-[11px] text-gray-500">${m.state_of_origin||'—'} • ${m.category||'member'}</div>
                                            <div class="text-[11px] mt-1"><span class="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold">${m.status||'pending'}</span></div>
                                        </div>
                                    </div>`).join(''):'<div class="p-8 text-center text-sm text-gray-500">No membership record found.</div>'}
                            </div>
                        </div>
                    </div>`;
            }

            renderMemberDashboardView() {
                const m=this.db.members.find(x=>x.id===this.currentUser?.memberId)||{};
                const status=(m.status||this.currentUser?.status||'pending').toLowerCase();
                const statusClass=status==='approved'?'bg-emerald-50 text-emerald-700':status==='rejected'?'bg-red-50 text-red-700':'bg-amber-50 text-amber-700';
                return `
                    <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6 sm:p-8">
                            <div class="flex items-center gap-4">
                                <div class="w-16 h-16 rounded-full bg-white/10 border border-white/20 overflow-hidden flex items-center justify-center">
                                    ${m.photo_url?'<img src="'+m.photo_url+'" class="w-full h-full object-cover" alt="Profile">':'<i class="fa-solid fa-user text-2xl text-ribacom-gold"></i>'}
                                </div>
                                <div><p class="text-xs text-gray-300">RIBACOM MEMBER PORTAL</p><h2 class="text-xl font-extrabold">${this.currentUser?.fullName||'Member'}</h2><p class="text-xs text-gray-300">${this.currentUser?.email||''}</p></div>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Status</p><span class="inline-block mt-2 px-2 py-1 rounded-full text-xs font-extrabold ${statusClass}">${status}</span></div>
                            <div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Category</p><p class="font-extrabold text-sm mt-2">${m.category||'—'}</p></div>
                            <div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Origin</p><p class="font-extrabold text-sm mt-2">${m.state_of_origin||'—'}</p></div>
                            <div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Membership No.</p><p class="font-extrabold text-sm mt-2">${m.membership_number||'Pending'}</p></div>
                        </div>
                        <div class="bg-white rounded-3xl border border-gray-100 card-shadow p-5 sm:p-7">
                            <h3 class="font-extrabold text-ribacom-navy mb-4">My Membership Profile</h3>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                <div><span class="text-[10px] uppercase text-gray-400 font-bold">Phone</span><p class="font-semibold">${m.phone||'—'}</p></div>
                                <div><span class="text-[10px] uppercase text-gray-400 font-bold">Email</span><p class="font-semibold break-all">${m.email||this.currentUser?.email||'—'}</p></div>
                                <div><span class="text-[10px] uppercase text-gray-400 font-bold">LGA</span><p class="font-semibold">${m.lga||'—'}</p></div>
                                <div><span class="text-[10px] uppercase text-gray-400 font-bold">Address</span><p class="font-semibold">${m.address||'—'}</p></div>
                                <div><span class="text-[10px] uppercase text-gray-400 font-bold">Nationality</span><p class="font-semibold">${m.nationality||'Nigerian'}</p></div>
                                <div><span class="text-[10px] uppercase text-gray-400 font-bold">Application</span><p class="font-semibold">Pending Secretariat review unless marked approved.</p></div>
                            </div>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            ${status==='approved'?'<button onclick="app.navigate(\'digital-id\')" class="bg-ribacom-green text-white px-4 py-2.5 rounded-xl text-xs font-extrabold"><i class="fa-solid fa-id-card mr-1"></i> Digital ID</button>':'<button onclick="app.toast(\'Digital ID becomes available after membership approval.\',\'warning\')" class="bg-gray-100 text-gray-500 px-4 py-2.5 rounded-xl text-xs font-extrabold"><i class="fa-solid fa-lock mr-1"></i> Digital ID after Approval</button>'}
                            <button onclick="app.navigate('welfare')" class="bg-ribacom-gold text-ribacom-navy px-4 py-2.5 rounded-xl text-xs font-extrabold"><i class="fa-solid fa-hand-holding-heart mr-1"></i> Welfare</button>
                            <button onclick="app.navigate('members')" class="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-extrabold">My Record</button>
                        </div>iv>
                    </div>`;
            }

            renderHomeView() {
                const announcements = this.db.announcements.slice(0, 3);
                const events = this.db.events.slice(0, 2);
                const leaders = this.db.leadership.slice(0, 4);

                return `
                    <div class="space-y-8 animate-fadeIn">
                        <!-- Hero Banner -->
                        <div class="relative rounded-3xl overflow-hidden ribacom-header-gradient text-white p-6 sm:p-10 shadow-2xl border border-ribacom-gold/20">
                            <div class="absolute -right-10 -bottom-10 opacity-10 text-[200px] pointer-events-none">
                                <i class="fa-solid fa-shield-halved"></i>
                            </div>
                            <div class="relative z-10 max-w-2xl space-y-4">
                                <div class="inline-flex items-center gap-2 bg-ribacom-gold/20 text-ribacom-gold border border-ribacom-gold/40 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                    <i class="fa-solid fa-star text-[10px]"></i> Official Community Platform
                                </div>
                                <h2 class="text-2xl sm:text-4xl font-extrabold leading-tight">
                                    Rivers & Bayelsa Citizens in Diaspora, <span class="text-ribacom-gold">The Gambia</span>
                                </h2>
                                <p class="text-xs sm:text-sm text-gray-200 leading-relaxed">
                                    Promoting unity, welfare support, cultural heritage, and solidarity among all sons, daughters, and associates of Rivers and Bayelsa States.
                                </p>
                                <div class="p-3 bg-white/10 rounded-xl border border-white/10 text-xs flex items-center justify-between">
                                    <div>
                                        <span class="text-ribacom-gold font-bold block">OFFICIAL MOTTO</span>
                                        <span class="font-extrabold tracking-wider text-sm">TRUTH • UNITY • SERVICE</span>
                                    </div>
                                    <i class="fa-solid fa-handshake-angle text-2xl text-ribacom-gold opacity-80"></i>
                                </div>
                                <div class="pt-2 flex flex-wrap gap-3">
                                    <button onclick="app.navigate('membership')" class="bg-ribacom-gold text-ribacom-navy hover:bg-yellow-400 font-extrabold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow-lg transition flex items-center gap-2">
                                        <i class="fa-solid fa-user-plus"></i> Join RIBACOM Today
                                    </button>
                                    <button onclick="app.navigate('about')" class="bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-2.5 rounded-xl text-xs sm:text-sm border border-white/20 transition flex items-center gap-2">
                                        <i class="fa-solid fa-circle-info"></i> Learn More
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Quick Key Info Cards -->
                        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow flex items-center space-x-3">
                                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-ribacom-green flex items-center justify-center text-lg flex-shrink-0">
                                    <i class="fa-solid fa-users"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-500 uppercase font-semibold">Active Members</p>
                                    <h4 class="font-extrabold text-base text-gray-800">${this.db.members.length}+ Members</h4>
                                </div>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow flex items-center space-x-3">
                                <div class="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-lg flex-shrink-0">
                                    <i class="fa-solid fa-hand-holding-heart"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-500 uppercase font-semibold">Welfare Benefits</p>
                                    <h4 class="font-extrabold text-base text-gray-800">Up to D1,500</h4>
                                </div>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow flex items-center space-x-3">
                                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg flex-shrink-0">
                                    <i class="fa-solid fa-coins"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-500 uppercase font-semibold">Monthly Dues</p>
                                    <h4 class="font-extrabold text-base text-gray-800">D50 / Month</h4>
                                </div>
                            </div>
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow flex items-center space-x-3">
                                <div class="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center text-lg flex-shrink-0">
                                    <i class="fa-solid fa-calendar-check"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] text-gray-500 uppercase font-semibold">Congress Meeting</p>
                                    <h4 class="font-extrabold text-xs text-gray-800">Last Sun @ 4PM</h4>
                                </div>
                            </div>
                        </div>

                        <!-- Announcements & Events Grid -->
                        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <!-- Announcements Column -->
                            <div class="lg:col-span-2 space-y-4">
                                <div class="flex items-center justify-between">
                                    <h3 class="font-extrabold text-lg text-gray-800 flex items-center gap-2">
                                        <i class="fa-solid fa-bullhorn text-ribacom-green"></i> Latest Announcements
                                    </h3>
                                    <button onclick="app.navigate('announcements')" class="text-xs text-ribacom-green font-bold hover:underline">View All</button>
                                </div>

                                <div class="space-y-3">
                                    ${announcements.map(ann => `
                                        <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow hover:border-ribacom-green/30 transition space-y-2">
                                            <div class="flex items-center justify-between text-xs">
                                                <span class="bg-emerald-50 text-ribacom-green font-bold px-2 py-0.5 rounded-md">${ann.category}</span>
                                                <span class="text-gray-400"><i class="fa-regular fa-clock mr-1"></i>${ann.date}</span>
                                            </div>
                                            <h4 class="font-bold text-gray-800 text-sm">${ann.title}</h4>
                                            <p class="text-xs text-gray-600 line-clamp-2">${ann.content}</p>
                                            <div class="text-[11px] text-gray-400 pt-1 border-t border-gray-50">
                                                Issued by: <strong>${ann.author}</strong>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>

                            <!-- Upcoming Events Column -->
                            <div class="space-y-4">
                                <div class="flex items-center justify-between">
                                    <h3 class="font-extrabold text-lg text-gray-800 flex items-center gap-2">
                                        <i class="fa-solid fa-calendar-day text-ribacom-gold"></i> Key Events
                                    </h3>
                                    <button onclick="app.navigate('events')" class="text-xs text-ribacom-green font-bold hover:underline">View All</button>
                                </div>

                                <div class="space-y-3">
                                    ${events.map(evt => `
                                        <div class="bg-white rounded-2xl border border-gray-100 card-shadow overflow-hidden">
                                            <img src="${evt.image}" alt="${evt.title}" class="w-full h-28 object-cover">
                                            <div class="p-3 space-y-1.5">
                                                <span class="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">${evt.status}</span>
                                                <h4 class="font-bold text-xs text-gray-800">${evt.title}</h4>
                                                <p class="text-[11px] text-gray-500"><i class="fa-regular fa-clock mr-1 text-ribacom-green"></i> ${evt.date} @ ${evt.time}</p>
                                                <p class="text-[11px] text-gray-500"><i class="fa-solid fa-location-dot mr-1 text-red-500"></i> ${evt.location}</p>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                        </div>

                        <!-- Executive Leadership Teaser -->
                        <div class="space-y-4 pt-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="font-extrabold text-lg text-gray-800">Executive Leadership</h3>
                                    <p class="text-xs text-gray-500">Serving the Rivers & Bayelsa Diaspora in The Gambia</p>
                                </div>
                                <button onclick="app.navigate('leadership')" class="text-xs text-ribacom-green font-bold hover:underline">Full Executive Roster &rarr;</button>
                            </div>

                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                ${leaders.map(l => `
                                    <div class="bg-white p-3 rounded-2xl border border-gray-100 card-shadow text-center space-y-2">
                                        <img src="${l.photo}" class="w-16 h-16 rounded-full object-cover mx-auto ring-2 ring-ribacom-gold/50 shadow-md">
                                        <div>
                                            <h4 class="font-bold text-xs text-gray-800 truncate">${l.name}</h4>
                                            <p class="text-[10px] text-ribacom-green font-semibold uppercase">${l.position}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }

            renderAboutView() {
                const a = this.db.about;
                return `
                    <div class="space-y-8 animate-fadeIn max-w-4xl mx-auto">
                        <div class="text-center space-y-2">
                            <span class="bg-ribacom-green/10 text-ribacom-green font-bold text-xs px-3 py-1 rounded-full uppercase">Official Identity</span>
                            <h2 class="text-2xl sm:text-3xl font-extrabold text-ribacom-navy">${a.displayName}</h2>
                            <p class="text-ribacom-gold font-extrabold tracking-widest text-sm">MOTTO: ${a.motto}</p>
                        </div>

                        <div class="bg-white p-6 sm:p-8 rounded-3xl border border-gray-100 card-shadow space-y-6">
                            <div>
                                <h3 class="text-lg font-bold text-ribacom-navy border-b pb-2 mb-3 flex items-center gap-2">
                                    <i class="fa-solid fa-landmark text-ribacom-green"></i> History & Background
                                </h3>
                                <p class="text-xs sm:text-sm text-gray-600 leading-relaxed">${a.history}</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div class="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100 space-y-2">
                                    <h4 class="font-bold text-ribacom-green text-sm flex items-center gap-2"><i class="fa-solid fa-eye"></i> Our Vision</h4>
                                    <p class="text-xs text-gray-700 leading-relaxed">${a.vision}</p>
                                </div>
                                <div class="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 space-y-2">
                                    <h4 class="font-bold text-ribacom-navy text-sm flex items-center gap-2"><i class="fa-solid fa-bullseye"></i> Our Mission</h4>
                                    <p class="text-xs text-gray-700 leading-relaxed">${a.mission}</p>
                                </div>
                            </div>

                            <div>
                                <h3 class="text-lg font-bold text-ribacom-navy border-b pb-2 mb-3 flex items-center gap-2">
                                    <i class="fa-solid fa-gem text-ribacom-gold"></i> Core Values
                                </h3>
                                <div class="flex flex-wrap gap-2">
                                    ${a.coreValues.map(v => `<span class="bg-ribacom-navy text-white text-xs font-semibold px-3 py-1.5 rounded-lg">${v}</span>`).join('')}
                                </div>
                            </div>

                            <div class="p-4 bg-gray-50 rounded-2xl border border-gray-200 text-xs space-y-2">
                                <p><strong>General Meeting Schedule:</strong> ${a.generalMeeting}</p>
                                <p><strong>Official Secretariat Address:</strong> ${a.address}</p>
                                <p><strong>Contact Helpline:</strong> ${a.contactPhone}</p>
                            </div>
                        </div>
                    </div>
                `;
            }

            renderLeadershipView() {
                const fallbackExecutives = [
                    {position:'Chairman / President', name:'Iworima M. Thomas', phone:'', photo:'https://ui-avatars.com/api/?name=Iworima+M+Thomas&background=0b3b60&color=fff', bio:'Chairman and President of Rivers Bayelsa Community in Diaspora The Gambia (RIBACOM).'},
                    {position:'Vice Chairman / Vice President', name:'Odika Nnenne', phone:'', photo:'https://ui-avatars.com/api/?name=Odika+Nnenne&background=0b3b60&color=fff', bio:'Vice Chairman / Vice President of RIBACOM.'},
                    {position:'Secretary General', name:'Juliet Ejila', phone:'', photo:'https://ui-avatars.com/api/?name=Juliet+Ejila&background=0b3b60&color=fff', bio:'Secretary General responsible for administration and official records.'},
                    {position:'Assistant Secretary General', name:'To be updated', phone:'', photo:'https://ui-avatars.com/api/?name=Assistant+Secretary+General&background=0b3b60&color=fff', bio:'Assistant Secretary General. Name and profile will be updated when officially supplied.'},
                    {position:'Treasurer', name:'Ruth Doubra Julius', phone:'', photo:'https://ui-avatars.com/api/?name=Ruth+Doubra+Julius&background=0b3b60&color=fff', bio:'Treasurer responsible for community financial administration.'},
                    {position:'Public Relations Officer', name:'Uche Destiny Chikezie', phone:'', photo:'https://ui-avatars.com/api/?name=Uche+Destiny+Chikezie&background=0b3b60&color=fff', bio:'Public Relations Officer responsible for communication and public information.'},
                    {position:'Welfare Officer / Provost', name:'Emeka Thank God Elechi', phone:'', photo:'https://ui-avatars.com/api/?name=Emeka+Thank+God+Elechi&background=0b3b60&color=fff', bio:'Welfare Officer / Provost responsible for member welfare and community support.'}
                ];
                const fallbackAdvisers = [
                    {position:'Special Adviser — Legal Affairs', name:'To be updated', photo:'https://ui-avatars.com/api/?name=Legal+Affairs&background=0b3b60&color=fff', bio:'Special Adviser on Legal Affairs.'},
                    {position:'Special Adviser — Protocol', name:'To be updated', photo:'https://ui-avatars.com/api/?name=Protocol&background=0b3b60&color=fff', bio:'Special Adviser on Protocol.'},
                    {position:'Special Adviser — Youth Affairs', name:'To be updated', photo:'https://ui-avatars.com/api/?name=Youth+Affairs&background=0b3b60&color=fff', bio:'Special Adviser on Youth Affairs.'},
                    {position:'Special Adviser — Cultural Affairs', name:'To be updated', photo:'https://ui-avatars.com/api/?name=Cultural+Affairs&background=0b3b60&color=fff', bio:'Special Adviser on Cultural Affairs.'}
                ];
                const executives = (this.db.leadership && this.db.leadership.length)
                    ? [...this.db.leadership].sort((a,b)=>(a.order||0)-(b.order||0))
                    : fallbackExecutives;
                const advisers = (this.db.advisers && this.db.advisers.length)
                    ? this.db.advisers
                    : fallbackAdvisers;

                const card = (person, adviser=false) => `
                    <div class="bg-white rounded-3xl border border-gray-100 card-shadow overflow-hidden">
                        <div class="p-5 sm:p-6 text-center space-y-3">
                            <img src="${person.photo || person.photo_url || 'https://ui-avatars.com/api/?name=RIBACOM&background=0b3b60&color=fff'}"
                                 class="w-24 h-24 rounded-full object-cover mx-auto ring-4 ring-ribacom-gold/40 shadow-lg"
                                 onerror="this.src='https://ui-avatars.com/api/?name=RIBACOM&background=0b3b60&color=fff'">
                            <div>
                                <span class="inline-block bg-ribacom-green/10 text-ribacom-green text-[10px] font-bold px-2.5 py-1 rounded-full uppercase">
                                    ${person.position || (adviser ? 'Special Adviser' : 'Executive Member')}
                                </span>
                                <h3 class="font-extrabold text-base text-gray-800 mt-2">${person.name || 'To be updated'}</h3>
                            </div>
                            <p class="text-xs text-gray-500 leading-relaxed">${person.bio || person.biography || 'RIBACOM community leadership profile.'}</p>
                        </div>
                        ${!adviser && person.phone ? `
                        <div class="bg-gray-50 p-3 text-center border-t border-gray-100 text-xs text-gray-600 font-medium">
                            <i class="fa-solid fa-phone text-ribacom-green mr-1"></i> ${person.phone}
                        </div>` : ''}
                    </div>`;

                return `
                    <div class="space-y-8 animate-fadeIn">
                        <div class="text-center max-w-3xl mx-auto space-y-2">
                            <span class="inline-block bg-ribacom-green/10 text-ribacom-green font-bold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider">Official Community Leadership</span>
                            <h2 class="text-2xl sm:text-3xl font-extrabold text-ribacom-navy">RIBACOM Community Leadership</h2>
                            <p class="text-xs sm:text-sm text-gray-600 leading-relaxed">The elected executive leadership and four special advisers serving Rivers Bayelsa Community The Gambia.</p>
                            <p class="text-[11px] text-ribacom-gold font-bold tracking-widest uppercase">TRUTH • UNITY • SERVICE</p>
                        </div>

                        <section class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="text-lg font-extrabold text-ribacom-navy">Executive Members</h3>
                                    <p class="text-xs text-gray-500">Seven executive positions of the RIBACOM governing structure.</p>
                                </div>
                                <span class="bg-ribacom-navy text-white text-[10px] font-bold px-2.5 py-1 rounded-full">7 POSITIONS</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                                ${executives.map(p => card(p, false)).join('')}
                            </div>
                        </section>

                        <section class="space-y-4 pt-2">
                            <div class="flex items-center justify-between">
                                <div>
                                    <h3 class="text-lg font-extrabold text-ribacom-navy">Four Special Advisers</h3>
                                    <p class="text-xs text-gray-500">Advisory support in legal, protocol, youth and cultural affairs.</p>
                                </div>
                                <span class="bg-ribacom-gold text-ribacom-navy text-[10px] font-bold px-2.5 py-1 rounded-full">4 ADVISERS</span>
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                                ${advisers.slice(0,4).map(p => card(p, true)).join('')}
                            </div>
                        </section>

                        <div class="bg-ribacom-navy text-white rounded-3xl p-5 sm:p-6 text-center shadow-xl">
                            <p class="text-xs text-gray-200">Leadership information is maintained as an official community record and may be updated by authorized administrators.</p>
                        </div>
                    </div>
                `;
            }

            renderConstitutionView() {
                return `
                    <div class="space-y-6 animate-fadeIn max-w-4xl mx-auto">
                        <div class="bg-ribacom-navy text-white p-6 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
                            <div>
                                <span class="text-ribacom-gold text-xs font-bold uppercase tracking-wider">Supreme Governing Document</span>
                                <h2 class="text-2xl font-extrabold">Master Constitution</h2>
                                <p class="text-xs text-gray-300 mt-1">Contains 13 Chapters & 97 Articles governing RIBACOM The Gambia</p>
                            </div>
                            <button onclick="app.toast('Downloading PDF Constitution...', 'info')" class="bg-ribacom-gold text-ribacom-navy hover:bg-yellow-400 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow transition flex-shrink-0">
                                <i class="fa-solid fa-file-pdf"></i> Download Official PDF
                            </button>
                        </div>

                        <div class="space-y-4">
                            ${this.db.constitution.map(chap => `
                                <div class="bg-white rounded-2xl border border-gray-200 card-shadow overflow-hidden">
                                    <div class="bg-gray-50 p-4 font-bold text-ribacom-navy text-sm border-b border-gray-200 flex justify-between items-center">
                                        <span>${chap.title}</span>
                                        <span class="text-xs bg-ribacom-green text-white px-2 py-0.5 rounded">${chap.articles.length} Articles</span>
                                    </div>
                                    <div class="p-4 space-y-3">
                                        ${chap.articles.map(art => `
                                            <div class="p-3 rounded-xl bg-gray-50/60 border border-gray-100 space-y-1">
                                                <h4 class="font-bold text-xs text-ribacom-green">${art.title}</h4>
                                                <p class="text-xs text-gray-600 leading-relaxed">${art.content}</p>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            renderMembershipView() {
                return `
                    <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn">
                        <div class="text-center space-y-2">
                            <span class="inline-flex items-center gap-2 bg-emerald-50 text-ribacom-green px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider">
                                <i class="fa-solid fa-user-plus"></i> RIBACOM Membership
                            </span>
                            <h2 class="text-2xl sm:text-3xl font-extrabold text-ribacom-navy">Membership Application</h2>
                            <p class="text-xs sm:text-sm text-gray-600">Complete the form below. Your application will remain <strong>Pending</strong> until reviewed by the RIBACOM Secretariat.</p>
                        </div>

                        <div class="bg-white p-5 sm:p-8 rounded-3xl border border-gray-100 card-shadow">
                            <form onsubmit="app.handleMembershipSubmit(event)" class="space-y-7">
                                <section class="space-y-4">
                                    <div class="flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-id-card text-ribacom-green"></i><h3 class="font-extrabold text-ribacom-navy">1. Personal Information</h3></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">Full Name *</label><input required id="m_fullName" class="form-input" placeholder="Full legal name"></div>
                                        <div><label class="form-label">Previous / Other Name</label><input id="m_otherName" class="form-input" placeholder="Maiden or former name, if applicable"></div>
                                        <div><label class="form-label">Date of Birth</label><input type="date" id="m_dob" class="form-input"></div>
                                        <div><label class="form-label">Gender</label><select id="m_gender" class="form-input"><option value="">Select</option><option>Male</option><option>Female</option><option>Other</option></select></div>
                                        <div><label class="form-label">Nationality *</label><input required id="m_nationality" value="Nigerian" class="form-input"></div>
                                        <div><label class="form-label">Marital Status</label><select id="m_marital" class="form-input"><option value="">Select</option><option>Single</option><option>Married</option><option>Separated</option><option>Divorced</option><option>Widowed</option></select></div>
                                        <div><label class="form-label">Passport / National ID Number</label><input id="m_idNumber" class="form-input" placeholder="Optional"></div>
                                        <div><label class="form-label">Passport Photograph URL</label><input type="url" id="m_photo" class="form-input" placeholder="https://..."></div>
                                    </div>
                                </section>

                                <section class="space-y-4">
                                    <div class="flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-map-location-dot text-ribacom-green"></i><h3 class="font-extrabold text-ribacom-navy">2. Rivers / Bayelsa Origin & Membership</h3></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">State of Origin *</label><select required id="m_state" class="form-input"><option value="Rivers State">Rivers State</option><option value="Bayelsa State">Bayelsa State</option><option value="Other / Associate">Associate (Other State/Nationality)</option></select></div>
                                        <div><label class="form-label">L.G.A</label><input id="m_lga" class="form-input" placeholder="Local Government Area"></div>
                                        <div><label class="form-label">Town / Community</label><input id="m_originCommunity" class="form-input" placeholder="Town, village or community"></div>
                                        <div><label class="form-label">Clan / Ward</label><input id="m_clanWard" class="form-input" placeholder="Clan or ward"></div>
                                        <div><label class="form-label">Membership Category *</label><select required id="m_category" class="form-input"><option value="Regular Member">Regular Member — by birth/ancestry</option><option value="Associate Member">Associate Member — by marriage/affiliation</option></select></div>
                                        <div><label class="form-label">Previous Community Association</label><input id="m_previousAssociation" class="form-input" placeholder="If applicable"></div>
                                    </div>
                                </section>

                                <section class="space-y-4">
                                    <div class="flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-house-user text-ribacom-green"></i><h3 class="font-extrabold text-ribacom-navy">3. Contact & Residence in The Gambia</h3></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">Phone / WhatsApp *</label><input required type="tel" id="m_phone" class="form-input" placeholder="+220 ..."></div>
                                        <div><label class="form-label">Email Address *</label><input required type="email" id="m_email" class="form-input" placeholder="name@example.com"></div>
                                    </div>
                                    <div><label class="form-label">Gambia Residential Address *</label><input required id="m_address" class="form-input" placeholder="Area, street, compound, etc."></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">Emergency Contact Name</label><input id="m_emergencyName" class="form-input"></div>
                                        <div><label class="form-label">Emergency Contact Phone</label><input type="tel" id="m_emergencyPhone" class="form-input"></div>
                                    </div>
                                </section>

                                <section class="space-y-4">
                                    <div class="flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-people-roof text-ribacom-green"></i><h3 class="font-extrabold text-ribacom-navy">4. Family & Next of Kin</h3></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">Spouse Name</label><input id="m_spouse" class="form-input"></div>
                                        <div><label class="form-label">Number of Children</label><input type="number" min="0" id="m_children" class="form-input" placeholder="0"></div>
                                        <div><label class="form-label">Next of Kin</label><input id="m_nextOfKin" class="form-input"></div>
                                        <div><label class="form-label">Next of Kin Phone</label><input type="tel" id="m_nextOfKinPhone" class="form-input"></div>
                                    </div>
                                </section>

                                <section class="space-y-4">
                                    <div class="flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-briefcase text-ribacom-green"></i><h3 class="font-extrabold text-ribacom-navy">5. Occupation & Skills</h3></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">Occupation / Profession</label><input id="m_occupation" class="form-input"></div>
                                        <div><label class="form-label">Employer / Business</label><input id="m_employer" class="form-input"></div>
                                    </div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">Work Address</label><input id="m_workAddress" class="form-input"></div>
                                        <div><label class="form-label">Skills / Expertise</label><input id="m_skills" class="form-input" placeholder="e.g. ICT, accounting, construction"></div>
                                    </div>
                                </section>

                                <section class="space-y-4">
                                    <div class="flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-handshake-angle text-ribacom-green"></i><h3 class="font-extrabold text-ribacom-navy">6. Community Participation</h3></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                                        <label class="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border"><input type="checkbox" id="m_welfareInterest"> Welfare activities</label>
                                        <label class="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border"><input type="checkbox" id="m_youthInterest"> Youth activities</label>
                                        <label class="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border"><input type="checkbox" id="m_culturalInterest"> Cultural activities</label>
                                        <label class="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border"><input type="checkbox" id="m_volunteer"> Volunteer / service</label>
                                    </div>
                                </section>

                                <section class="space-y-4">
                                    <div class="flex items-center gap-2 border-b pb-2"><i class="fa-solid fa-lock text-ribacom-green"></i><h3 class="font-extrabold text-ribacom-navy">7. Account & Declaration</h3></div>
                                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div><label class="form-label">Password *</label><input type="password" required minlength="8" id="m_password" class="form-input" placeholder="At least 8 characters"></div>
                                        <div><label class="form-label">Confirm Password *</label><input type="password" required minlength="8" id="m_passwordConfirm" class="form-input"></div>
                                    </div>
                                    <label class="flex gap-3 text-xs text-gray-600"><input type="checkbox" required id="m_constitutionConsent" class="mt-0.5"> I agree to abide by the RIBACOM Constitution and lawful decisions of the Community.</label>
                                    <label class="flex gap-3 text-xs text-gray-600"><input type="checkbox" required id="m_declaration" class="mt-0.5"> I declare that the information supplied in this application is true and correct to the best of my knowledge.</label>
                                </section>

                                <div class="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
                                    <p class="font-extrabold"><i class="fa-solid fa-coins mr-1"></i> Monthly Dues</p>
                                    <p>RIBACOM membership dues are <strong>D50 per month</strong>. Your application is submitted as <strong>Pending</strong> for Secretariat review. Approval is required before full member benefits and Digital ID issuance.</p>
                                </div>
                                <button type="submit" class="w-full bg-ribacom-green hover:bg-emerald-700 text-white font-extrabold py-3.5 rounded-xl text-sm shadow-lg transition"><i class="fa-solid fa-paper-plane mr-2"></i> Submit Membership Application</button>
                            </form>
                        </div>
                    </div>
                    <style>
                        .form-label{display:block;font-size:.7rem;font-weight:800;color:#374151;text-transform:uppercase;margin-bottom:.25rem}
                        .form-input{width:100%;padding:.6rem .75rem;border:1px solid #e5e7eb;border-radius:.75rem;font-size:.875rem;outline:none}
                        .form-input:focus{box-shadow:0 0 0 2px rgba(16,185,129,.25);border-color:#10b981}
                    </style>
                `;
            }

            renderDigitalIdView() {
                const member = this.currentUser?.memberId ? this.db.members.find(m => m.id === this.currentUser.memberId) : null;
                const id = member ? this.db.digitalIds.find(x => x.memberId === member.id) : null;
                if (!this.currentUser || !member) return `<div class="max-w-xl mx-auto bg-white rounded-3xl p-8 text-center card-shadow"><h2 class="font-extrabold text-xl text-ribacom-navy">Digital Membership ID</h2><p class="text-sm text-gray-500 mt-2">Please sign in to view your Digital ID.</p><button onclick="app.openLoginModal()" class="mt-4 bg-ribacom-green text-white px-5 py-2.5 rounded-xl font-bold">Sign In</button></div>`;
                if (member.status !== 'approved') return `<div class="max-w-xl mx-auto bg-white rounded-3xl p-8 text-center card-shadow"><div class="w-16 h-16 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-2xl"><i class="fa-solid fa-hourglass-half"></i></div><h2 class="font-extrabold text-xl text-ribacom-navy mt-4">Digital ID Not Yet Issued</h2><p class="text-sm text-gray-500 mt-2">Your membership is currently <strong>${member.status || 'pending'}</strong>. A Digital ID becomes available after Secretariat approval and issuance.</p></div>`;
                if (!id || id.status !== 'active') return `<div class="max-w-xl mx-auto bg-white rounded-3xl p-8 text-center card-shadow"><div class="w-16 h-16 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-2xl"><i class="fa-solid fa-id-card"></i></div><h2 class="font-extrabold text-xl text-ribacom-navy mt-4">Digital ID Pending</h2><p class="text-sm text-gray-500 mt-2">Your membership is approved, but the Digital ID has not been issued or is not currently active.</p></div>`;
                const expires = id.expires_at || 'Perpetual';
                const qrData = id.qrCodeData || `RIBACOM-GAMBIA|ID:${id.idCardNumber}|MEMBER:${member.id}|NAME:${member.fullName}`;
                return `
                    <div class="max-w-md mx-auto space-y-6 animate-fadeIn">
                        <div class="text-center space-y-1"><span class="bg-ribacom-gold/20 text-ribacom-navy font-bold text-[10px] px-2.5 py-0.5 rounded-full uppercase">Official Identity</span><h2 class="text-xl font-extrabold text-ribacom-navy">Digital Membership ID Card</h2><p class="text-xs text-gray-500">Issued from the RIBACOM membership system.</p></div>
                        <div id="digitalIdCard" class="relative rounded-3xl overflow-hidden shadow-2xl border-2 border-ribacom-gold/60 text-white bg-gradient-to-br from-ribacom-navy via-slate-900 to-ribacom-green p-6 space-y-4">
                            <div class="flex items-center justify-between border-b border-white/20 pb-3"><div><h3 class="font-extrabold text-xs tracking-wider">RIVERS BAYELSA COMMUNITY THE GAMBIA</h3><p class="text-[9px] text-ribacom-gold tracking-widest font-semibold">RIBACOM • TRUTH • UNITY • SERVICE</p></div><span class="text-[9px] bg-emerald-500 text-white font-extrabold px-2 py-0.5 rounded-full uppercase">${id.status}</span></div>
                            <div class="flex items-center space-x-4 py-2"><img src="${member.photo || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=300&auto=format&fit=crop'}" class="w-20 h-20 rounded-2xl object-cover ring-2 ring-ribacom-gold shadow-md flex-shrink-0"><div class="space-y-1 overflow-hidden"><h4 class="font-extrabold text-base truncate">${member.fullName}</h4><p class="text-xs text-ribacom-gold font-bold">${id.idCardNumber}</p><p class="text-[11px] text-gray-300">${member.category || 'Regular Member'}</p><p class="text-[10px] text-gray-400">${member.stateOfOrigin || 'Nigerian'}</p></div></div>
                            <div class="pt-3 border-t border-white/20 flex items-center justify-between"><div class="space-y-0.5"><p class="text-[9px] text-gray-400">ISSUED: <span class="text-white font-medium">${id.issued_at?.slice(0,10) || '—'}</span></p><p class="text-[9px] text-gray-400">EXPIRES: <span class="text-ribacom-gold font-medium">${expires}</span></p></div><div id="qrcode" class="p-1.5 bg-white rounded-lg shadow-md"></div></div>
                        </div>
                        <div class="flex gap-3"><button onclick="window.print()" class="flex-1 bg-ribacom-navy text-white font-bold py-2.5 rounded-xl text-xs"><i class="fa-solid fa-print"></i> Print ID Card</button><button onclick="app.copyDigitalId('${id.idCardNumber}')" class="flex-1 bg-ribacom-green text-white font-bold py-2.5 rounded-xl text-xs"><i class="fa-solid fa-copy"></i> Copy ID No.</button></div>
                    </div>`;
            }

            generateQRCode() {
                const qrContainer = document.getElementById("qrcode"); if (!qrContainer || typeof QRCode === 'undefined') return;
                qrContainer.innerHTML = "";
                const member = this.currentUser?.memberId ? this.db.members.find(m => m.id === this.currentUser.memberId) : null;
                const id = member ? this.db.digitalIds.find(x => x.memberId === member.id) : null; if (!id) return;
                new QRCode(qrContainer,{text:id.qrCodeData || `RIBACOM-GAMBIA|ID:${id.idCardNumber}|MEMBER:${member.id}|NAME:${member.fullName}`,width:64,height:64,colorDark:'#0A2540',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.H});
            }

            renderWelfareView() {
                return `
                    <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                        <div class="text-center space-y-1">
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Welfare Scheme & Benefits</h2>
                            <p class="text-xs text-gray-600">Official assistance framework for members during key life events.</p>
                        </div>

                        <!-- Approved Benefits Tier Banner -->
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow text-center space-y-1">
                                <div class="w-10 h-10 rounded-full bg-pink-100 text-pink-600 flex items-center justify-center mx-auto text-base">
                                    <i class="fa-solid fa-rings-wedding"></i>
                                </div>
                                <h4 class="font-bold text-xs text-gray-800">Wedding Benefit</h4>
                                <p class="text-lg font-extrabold text-ribacom-green">D1,000</p>
                            </div>

                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow text-center space-y-1">
                                <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-base">
                                    <i class="fa-solid fa-baby"></i>
                                </div>
                                <h4 class="font-bold text-xs text-gray-800">Child Birth</h4>
                                <p class="text-lg font-extrabold text-ribacom-green">D500</p>
                            </div>

                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow text-center space-y-1">
                                <div class="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto text-base">
                                    <i class="fa-solid fa-ribbon"></i>
                                </div>
                                <h4 class="font-bold text-xs text-gray-800">Bereavement</h4>
                                <p class="text-lg font-extrabold text-ribacom-green">D1,500</p>
                                <p class="text-[9px] text-gray-400">Parent / Spouse / Child</p>
                            </div>
                        </div>

                        <!-- Application Form -->
                        <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-4">
                            <h3 class="font-bold text-base text-ribacom-navy flex items-center gap-2">
                                <i class="fa-solid fa-paper-plane text-ribacom-green"></i> Submit Welfare Claim / Application
                            </h3>
                            <form onsubmit="app.handleWelfareSubmit(event)" class="space-y-4">
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Category *</label>
                                        <select required id="w_type" class="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-ribacom-green outline-none">
                                            <option value="Wedding">Wedding Celebration (D1,000)</option>
                                            <option value="Birth">Child Birth (D500)</option>
                                            <option value="Bereavement">Bereavement (D1,500)</option>
                                            <option value="Emergency">Other Special Welfare</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Your Full Name / ID</label>
                                        <input type="text" required id="w_memberName" placeholder="Name or Membership No" class="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-ribacom-green outline-none">
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase mb-1">Description / Claim Details *</label>
                                    <textarea required id="w_desc" rows="3" placeholder="Provide background information, dates, and documentation references..." class="w-full px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-ribacom-green outline-none"></textarea>
                                </div>

                                <button type="submit" class="w-full bg-ribacom-navy hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-sm transition shadow">
                                    Submit Claim to Welfare Officer
                                </button>
                            </form>
                        </div>
                    </div>
                `;
            }

            renderEventsView() {
                return `
                    <div class="space-y-6 animate-fadeIn">
                        <div class="text-center max-w-2xl mx-auto space-y-1">
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Community Events & Meetings</h2>
                            <p class="text-xs text-gray-600">Stay informed on general congress meetings, galas, and community outreach.</p>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            ${this.db.events.map(evt => `
                                <div class="bg-white rounded-3xl border border-gray-100 card-shadow overflow-hidden flex flex-col justify-between">
                                    <div>
                                        <img src="${evt.image}" class="w-full h-44 object-cover">
                                        <div class="p-5 space-y-2">
                                            <div class="flex items-center justify-between">
                                                <span class="bg-amber-100 text-amber-800 font-bold text-[10px] px-2.5 py-0.5 rounded-full">${evt.status}</span>
                                                <span class="text-xs text-gray-400 font-semibold"><i class="fa-regular fa-clock text-ribacom-green mr-1"></i>${evt.date} @ ${evt.time}</span>
                                            </div>
                                            <h3 class="font-extrabold text-base text-gray-800">${evt.title}</h3>
                                            <p class="text-xs text-gray-600 leading-relaxed">${evt.description}</p>
                                        </div>
                                    </div>
                                    <div class="bg-gray-50 p-4 border-t border-gray-100 text-xs text-gray-600 flex items-center justify-between">
                                        <span><i class="fa-solid fa-location-dot text-red-500 mr-1"></i> ${evt.location}</span>
                                        <button onclick="app.toast('Event added to device calendar!', 'success')" class="text-ribacom-green font-bold hover:underline">Add to Calendar</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            renderAnnouncementsView() {
                return `
                    <div class="space-y-6 animate-fadeIn max-w-3xl mx-auto">
                        <div class="text-center space-y-1">
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Official Bulletins & Notices</h2>
                            <p class="text-xs text-gray-600">Official circulars released by the Executive Council.</p>
                        </div>

                        <div class="space-y-4">
                            ${this.db.announcements.map(a => `
                                <div class="bg-white p-5 rounded-3xl border border-gray-100 card-shadow space-y-3">
                                    <div class="flex items-center justify-between">
                                        <span class="bg-ribacom-green/10 text-ribacom-green font-bold text-xs px-3 py-1 rounded-full">${a.category}</span>
                                        <span class="text-xs text-gray-400">${a.date}</span>
                                    </div>
                                    <h3 class="font-bold text-base text-gray-800">${a.title}</h3>
                                    <p class="text-xs sm:text-sm text-gray-600 leading-relaxed">${a.content}</p>
                                    <div class="pt-3 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-between">
                                        <span>Issued by: <strong>${a.author}</strong></span>
                                        <button onclick="app.toast('Notice copied to clipboard', 'info')" class="hover:text-ribacom-green"><i class="fa-regular fa-copy"></i> Copy</button>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            renderPublicationsView() {
                return `
                    <div class="space-y-6 animate-fadeIn max-w-3xl mx-auto">
                        <div class="text-center space-y-1">
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Official Publications & Documents</h2>
                            <p class="text-xs text-gray-600">Access approved policy documents, election guidelines, and official reports.</p>
                        </div>

                        <div class="space-y-3">
                            ${this.db.publications.map(p => `
                                <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow flex items-center justify-between gap-4">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center text-lg flex-shrink-0">
                                            <i class="fa-solid fa-file-pdf"></i>
                                        </div>
                                        <div>
                                            <h4 class="font-bold text-sm text-gray-800">${p.title}</h4>
                                            <p class="text-xs text-gray-500">${p.description}</p>
                                        </div>
                                    </div>
                                    <button onclick="app.toast('Opening publication document...', 'info')" class="bg-gray-100 hover:bg-ribacom-green hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition flex-shrink-0">
                                        View
                                    </button>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            renderGalleryView() {
                return `
                    <div class="space-y-6 animate-fadeIn">
                        <div class="text-center max-w-2xl mx-auto space-y-1">
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Community Photo Gallery</h2>
                            <p class="text-xs text-gray-600">Highlights from congresses, cultural dances, and community gatherings.</p>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            ${this.db.gallery.map(g => `
                                <div class="bg-white rounded-2xl overflow-hidden border border-gray-100 card-shadow space-y-2">
                                    <img src="${g.image_url}" class="w-full h-48 object-cover hover:scale-105 transition duration-300">
                                    <div class="p-3">
                                        <h4 class="font-bold text-xs text-gray-800">${g.title}</h4>
                                        <p class="text-[11px] text-gray-500">${g.caption}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            renderYouthView() {
                const y = this.db.youth;
                return `
                    <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                        <div class="bg-gradient-to-r from-ribacom-navy to-ribacom-green text-white p-8 rounded-3xl shadow-xl space-y-3">
                            <span class="bg-ribacom-gold text-ribacom-navy font-black text-[10px] px-2.5 py-1 rounded-full uppercase">Youth Wing</span>
                            <h2 class="text-2xl font-extrabold">${y.title}</h2>
                            <p class="text-xs text-gray-200 leading-relaxed">${y.content}</p>
                            <div class="pt-2">
                                <span class="text-xs text-ribacom-gold font-bold"><i class="fa-solid fa-user-shield mr-1"></i> Leadership: ${y.leader}</span>
                            </div>
                        </div>

                        <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-3">
                            <h3 class="font-bold text-base text-gray-800">Youth Initiatives & Projects</h3>
                            <ul class="space-y-2">
                                ${y.activities.map(act => `
                                    <li class="p-3 bg-gray-50 rounded-xl text-xs font-semibold text-gray-700 flex items-center gap-2">
                                        <i class="fa-solid fa-check text-ribacom-green"></i> ${act}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            }

            renderAdvisersView() {
                return `
                    <div class="space-y-6 animate-fadeIn max-w-3xl mx-auto">
                        <div class="text-center space-y-1">
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Council of Advisers</h2>
                            <p class="text-xs text-gray-600">Elders and patrons providing legal, cultural, and strategic counsel.</p>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            ${this.db.advisers.map(adv => `
                                <div class="bg-white p-5 rounded-3xl border border-gray-100 card-shadow flex items-center space-x-4">
                                    <img src="${adv.photo}" class="w-16 h-16 rounded-2xl object-cover ring-2 ring-ribacom-gold">
                                    <div>
                                        <span class="bg-amber-100 text-amber-800 font-bold text-[10px] px-2 py-0.5 rounded">${adv.category}</span>
                                        <h4 class="font-bold text-sm text-gray-800 mt-1">${adv.name}</h4>
                                        <p class="text-xs text-gray-500">${adv.bio}</p>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            renderContactView() {
                const a = this.db.about;
                return `
                    <div class="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                        <div class="text-center space-y-1">
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Contact Secretariat</h2>
                            <p class="text-xs text-gray-600">Reach out to the executive council for inquiries or assistance.</p>
                        </div>

                        <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-4">
                            <div class="space-y-3 text-xs">
                                <p class="flex items-center gap-3"><i class="fa-solid fa-location-dot text-ribacom-green text-lg"></i> <span><strong>Secretariat Address:</strong> ${a.address}</span></p>
                                <p class="flex items-center gap-3"><i class="fa-solid fa-phone text-ribacom-green text-lg"></i> <span><strong>Helpline:</strong> ${a.contactPhone}</span></p>
                                <p class="flex items-center gap-3"><i class="fa-solid fa-envelope text-ribacom-green text-lg"></i> <span><strong>Email:</strong> ${a.contactEmail}</span></p>
                            </div>

                            <hr class="border-gray-100">

                            <form onsubmit="app.toast('Message sent to Secretariat!', 'success'); event.preventDefault();" class="space-y-3">
                                <input type="text" required placeholder="Your Name" class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-ribacom-green outline-none">
                                <input type="email" required placeholder="Your Email" class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-ribacom-green outline-none">
                                <textarea required rows="3" placeholder="Message content..." class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-ribacom-green outline-none"></textarea>
                                <button type="submit" class="w-full bg-ribacom-green hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
                                    Send Message
                                </button>
                            </form>
                        </div>
                    </div>
                `;
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
                const address=val('m_address'), photo=val('m_photo')||null, password=val('m_password'), confirm=val('m_passwordConfirm');
                if(password.length<8){this.toast('Create a password of at least 8 characters.','warning');return;}
                if(password!==confirm){this.toast('Passwords do not match.','warning');return;}

                const applicationDetails={
                    previous_name:val('m_otherName'), date_of_birth:val('m_dob'), gender:val('m_gender'),
                    nationality:val('m_nationality')||'Nigerian', passport_or_id:val('m_idNumber'),
                    origin_community:val('m_originCommunity'), clan_ward:val('m_clanWard'),
                    previous_association:val('m_previousAssociation'), emergency_contact_name:val('m_emergencyName'),
                    emergency_contact_phone:val('m_emergencyPhone'), spouse_name:val('m_spouse'),
                    children_count:Number(val('m_children')||0), next_of_kin:val('m_nextOfKin'),
                    next_of_kin_phone:val('m_nextOfKinPhone'), occupation:val('m_occupation'),
                    employer_business:val('m_employer'), work_address:val('m_workAddress'), skills:val('m_skills'),
                    interests:{welfare:checked('m_welfareInterest'),youth:checked('m_youthInterest'),cultural:checked('m_culturalInterest'),volunteer:checked('m_volunteer')},
                    constitution_consent:checked('m_constitutionConsent'), information_declaration:checked('m_declaration'),
                    application_status:'pending', monthly_dues:'D50'
                };

                this.toast('Creating your secure RIBACOM account...','info');
                const {data:authData,error:authError}=await this.supabaseClient.auth.signUp({
                    email,password,options:{data:{full_name:fullName,phone,application_details:applicationDetails}}
                });
                if(authError){this.toast(authError.message,'error');return;}
                const user=authData?.user;
                if(!user){this.toast('Account creation did not return a user. Please try again.','error');return;}
                const {error:profileError}=await this.supabaseClient.from('profiles').upsert({id:user.id,email,full_name:fullName,phone},{onConflict:'id'});
                if(profileError) console.warn('Profile sync:',profileError.message);

                if(!authData.session){
                    this.toast('Application saved with your account. Please verify your email, then sign in.','success');
                    this.openLoginModal();
                    return;
                }

                const {error}=await this.supabaseClient.from('members').upsert({
                    user_id:user.id,full_name:fullName,email,phone,
                    state_of_origin:state==='Other / Associate'?'Other':state,lga,address,
                    photo_url:photo,nationality:applicationDetails.nationality,category,status:'pending'
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
                const displayRole = role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'visitor' ? 'Visitor' : 'Member';
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
                this.navigate(['super_admin','admin'].includes(role) ? 'admin-dashboard' : 'member-dashboard');
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
                    role: role === 'super_admin' ? 'Super Admin' : role === 'admin' ? 'Admin' : role === 'visitor' ? 'Visitor' : 'Member',
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
                    if (this.currentUser.role.includes('Admin')) {
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
                        <button onclick="app.handleAuthAction()" class="bg-white/10 hover:bg-white/20 text-white font-bold px-3 py-1.5 rounded-lg text-xs transition border border-white/20">
                            Portal
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
                document.getElementById('authModal').classList.remove('hidden');
            }

            closeAuthModal() {
                document.getElementById('authModal').classList.add('hidden');
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