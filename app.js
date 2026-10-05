// Empty in-memory UI cache; Supabase is the authoritative data source.
        class RibacomApp {
            constructor() {
                this.db = {members:[],digitalIds:[],membershipApplications:[],financeTransactions:[],leadership:[],advisers:[],constitution:[],announcements:[],events:[],gallery:[],publications:[],youth:{title:'RIBACOM Youth',content:'',image:''},paymentSettings:[],welfareRequests:[],welfareSettings:{},about:{name:window.RIBACOM_CONFIG.orgName,displayName:window.RIBACOM_CONFIG.orgName,motto:window.RIBACOM_CONFIG.motto}};
                this.currentUser = null;
                this.loginMode = 'member';
                this.currentView = 'home';
                this.pendingElectionResultsId = new URLSearchParams(window.location.search).get('election_results');
                if (this.pendingElectionResultsId) this.currentView = 'election-results';
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

            async restoreSupabaseSession() {
                if (!this.supabaseClient) return;
                try {
                    const { data, error } = await this.supabaseClient.auth.getSession();
                    if (error) throw error;
                    const user = data?.session?.user;
                    if (!user) {
                        this.currentUser = null;
                        return;
                    }

                    let profile = null;
                    let member = null;

                    const profileResult = await this.supabaseClient
                        .from('profiles')
                        .select('*')
                        .eq('id', user.id)
                        .maybeSingle();
                    if (!profileResult.error) profile = profileResult.data || null;

                    const memberResult = await this.supabaseClient
                        .from('members')
                        .select('*')
                        .eq('user_id', user.id)
                        .maybeSingle();
                    if (!memberResult.error) member = memberResult.data || null;

                    const role = String(profile?.role || (member ? 'member' : 'visitor')).toLowerCase();
                    const displayRoles = {
                        super_admin: 'Super Admin',
                        admin: 'Admin',
                        member: 'Member',
                        visitor: 'Visitor',
                        treasurer: 'Treasurer',
                        secretary_general: 'Secretary General',
                        welfare_officer: 'Welfare Officer',
                        pro: 'Public Relations Officer',
                        vice_president: 'Vice President',
                        assistant_secretary_general: 'Assistant Secretary General'
                    };

                    this.currentUser = {
                        id: user.id,
                        email: user.email || profile?.email || member?.email || '',
                        fullName: profile?.full_name || member?.full_name || user.email || 'RIBACOM User',
                        phone: profile?.phone || member?.phone || '',
                        role: displayRoles[role] || role,
                        roleKey: role,
                        membershipNumber: member?.membership_number || '',
                        memberId: member?.id || null,
                        status: member?.status || null,
                        category: member?.category || null,
                        photoUrl: profile?.avatar_url || member?.photo_url || '',
                        profile: profile || null,
                        member: member || null
                    };
                } catch (e) {
                    console.warn('RIBACOM session restore failed:', e);
                    this.currentUser = null;
                }
            }

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
                        (['admin','super_admin','president','vice_president','secretary_general','assistant_secretary_general'].includes(this.currentUser?.roleKey) || this.currentUser?.memberId) ? q('membership_applications', {order:'created_at', ascending:false}) : Promise.resolve([]),
                        (['admin','super_admin','treasurer'].includes(this.currentUser?.roleKey) || this.currentUser?.memberId) ? q('finance_transactions', {order:'created_at', ascending:false}) : Promise.resolve([])
                    ]);
                    const members = this.currentUser?.roleKey && ['admin','super_admin','treasurer','secretary_general','president','vice_president','assistant_secretary_general','welfare_officer'].includes(this.currentUser.roleKey)
                        ? await q('members', {order:'created_at', ascending:false})
                        : (this.currentUser?.memberId ? await q('members') : []);
                    const welfare = this.currentUser?.roleKey && ['admin','super_admin','welfare_officer','president','vice_president'].includes(this.currentUser.roleKey)
                        ? await q('welfare_requests', {order:'created_at', ascending:false})
                        : (this.currentUser?.memberId ? await q('welfare_requests', {order:'created_at', ascending:false}) : []);
                    const digitalIds = this.currentUser?.roleKey && ['admin','super_admin','president','vice_president'].includes(this.currentUser.roleKey)
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
                    this.db.eventAttendance = [];
                    if (this.currentUser?.memberId && this.supabaseClient) {
                        const {data:attendanceRows,error:attendanceError}=await this.supabaseClient.from('events_attendance').select('*').eq('member_id',this.currentUser.memberId);
                        if(!attendanceError) this.db.eventAttendance=attendanceRows||[];
                    }
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
                    case 'verify-membership':
                        container.innerHTML=this.renderMembershipVerificationView();
                        const vf=document.getElementById('verifyMembershipForm');
                        if(vf) vf.onsubmit=(e)=>{e.preventDefault();this.verifyMembershipId(document.getElementById('verifyMembershipId').value.trim());};
                        const initialVerify=document.getElementById('verifyMembershipId')?.value?.trim();
                        if(initialVerify) this.verifyMembershipId(initialVerify);
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
                    case 'ecosystem-activity':
                        if (!this.currentUser) { this.toast('Please log in to view your activity centre.', 'warning'); this.openLoginModal(); this.navigate('home'); return; }
                        container.innerHTML = this.renderEcosystemActivityView();
                        break;
                    case 'ecosystem-search':
                        if (!this.currentUser) { this.toast('Please log in to use Unified Ecosystem Search.', 'warning'); this.openLoginModal(); this.navigate('home'); return; }
                        container.innerHTML = this.renderEcosystemSearchView();
                        break;
                    case 'ecosystem-communication':
                        if (!this.currentUser) { this.toast('Please log in to access Communications.', 'warning'); this.openLoginModal(); this.navigate('home'); return; }
                        container.innerHTML = this.renderEcosystemCommunicationView();
                        break;
                    case 'election-results':
                        container.innerHTML = '<div class="p-8 text-center">Election results are loading.</div>';
                        if (typeof this.renderPublicElectionResults==='function') {
                            this.renderPublicElectionResults(this.pendingElectionResultsId).then(html => { container.innerHTML = html; });
                        }
                        break;
                    case 'elections':
                        if (!this.currentUser) { this.toast('Please log in to access RIBACOM Elections.', 'warning'); this.openLoginModal(); this.navigate('home'); return; }
                        container.innerHTML = this.renderElectionsView();
                        setTimeout(() => this.refreshElectionsView(), 50);
                        break;
                    case 'digital-ecosystem':
                        container.innerHTML = this.renderDigitalEcosystemView();
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
                        if (!this.currentUser || !['admin','super_admin'].includes(String(this.currentUser.roleKey || '').toLowerCase())) {
                            this.toast('Access denied. Administrator privileges required.', 'error');
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = this.renderAdminDashboardView();
                        break;
                    case 'treasurer-dashboard':
                        if (!this.currentUser || !['treasurer','admin','super_admin'].includes(this.currentUser.roleKey)) {
                            this.toast('Access denied. Treasurer privileges required.', 'error');
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = typeof this.renderTreasurerDashboardView==='function' ? this.renderTreasurerDashboardView() : this.renderFinanceView();
                        break;
                    case 'finance':
                        if (!this.currentUser) {
                            this.toast('Please log in to access Finance & Dues.', 'warning');
                            this.openLoginModal();
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = typeof this.renderFinanceView==='function' ? this.renderFinanceView() : '<div class="p-8 text-center">Finance module is loading.</div>';
                        break;
                    case 'approval-center':
                        if (!this.currentUser || !['admin','super_admin','president','vice_president','secretary_general','assistant_secretary_general','treasurer','welfare_officer','pro'].includes(this.currentUser.roleKey)) {
                            this.toast('Executive access required.', 'error');
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = typeof this.renderApprovalCenter==='function' ? this.renderApprovalCenter() : '<div class="p-8 text-center">Approval Centre is loading.</div>';
                        break;
                    case 'executive-work':
                        if (!this.currentUser || !['admin','super_admin','president','vice_president','secretary_general','assistant_secretary_general','treasurer','welfare_officer','pro'].includes(this.currentUser.roleKey)) {
                            this.toast('Executive access required.', 'error');
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = typeof this.renderExecutiveWorkCenter==='function' ? this.renderExecutiveWorkCenter() : '<div class="p-8 text-center">Executive Work Centre is loading.</div>';
                        break;
                    case 'admin-members':
                        if (!this.currentUser || !['admin','super_admin'].includes(this.currentUser.roleKey)) {
                            this.toast('Access denied. Administrator privileges required.', 'error');
                            this.navigate('home');
                            return;
                        }
                        container.innerHTML = typeof this.renderAdminMembersView==='function' ? this.renderAdminMembersView() : this.renderMembersView();
                        break;
                    default:
                        container.innerHTML = this.renderHomeView();
                }

                this.updateAuthHeaderUI();
            }

            async getEventAttendance(eventId) {
                if (!this.supabaseClient || !eventId) return [];
                const {data,error}=await this.supabaseClient.from('events_attendance').select('*').eq('event_id',eventId).order('registered_at',{ascending:true});
                if(error){console.warn('Attendance read failed:',error.message);return [];}
                return data||[];
            }

            async registerForEvent(eventId) {
                if(!this.currentUser?.memberId) { this.toast('Please log in as an approved member to register.','warning'); this.openLoginModal(); return; }
                const member=this.db.members.find(m=>m.id===this.currentUser.memberId);
                if(member && member.status!=='approved') { this.toast('Only approved members can register for events.','warning'); return; }
                const {error}=await this.supabaseClient.from('events_attendance').insert({event_id:eventId,member_id:this.currentUser.memberId,status:'registered'});
                if(error){
                    if(error.code==='23505') this.toast('You are already registered for this event.','info');
                    else this.toast('Registration failed: '+error.message,'error');
                    return;
                }
                this.toast('Event registration confirmed.','success');
                await this.loadCloudData();
                this.navigate('events');
            }

            async cancelEventRegistration(eventId) {
                if(!this.currentUser?.memberId) return;
                const {error}=await this.supabaseClient.from('events_attendance').update({status:'cancelled'}).eq('event_id',eventId).eq('member_id',this.currentUser.memberId);
                if(error){this.toast('Could not cancel registration: '+error.message,'error');return;}
                this.toast('Event registration cancelled.','success');
                this.navigate('events');
            }

            async openEventAttendanceManager(eventId) {
                if(!['admin','super_admin','secretary_general','vice_president','welfare_officer'].includes(this.currentUser?.roleKey)) { this.toast('Event manager access required.','error'); return; }
                const rows=await this.getEventAttendance(eventId);
                const event=this.db.events.find(x=>x.id===eventId);
                const members=this.db.members;
                const byId=Object.fromEntries(members.map(m=>[m.id,m]));
                const registered=rows.filter(r=>r.status!=='cancelled').length;
                const attended=rows.filter(r=>r.status==='attended').length;
                const rate=registered?Math.round(attended/registered*100):0;
                const container=document.getElementById('appViewport');
                container.innerHTML=`
                    <div class="max-w-6xl mx-auto space-y-5 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6">
                            <button onclick="app.navigate('events')" class="text-xs font-bold mb-3"><i class="fa-solid fa-arrow-left mr-1"></i> Back to Events</button>
                            <h2 class="text-2xl font-extrabold">Attendance Manager</h2>
                            <p class="text-sm text-gray-300 mt-1">${esc(event?.title||'Event')}</p>
                        </div>
                        <div class="grid grid-cols-3 gap-3">
                            <div class="bg-white rounded-2xl border p-4"><div class="text-[10px] uppercase font-bold text-gray-400">Registered</div><div class="text-2xl font-extrabold">${registered}</div></div>
                            <div class="bg-white rounded-2xl border p-4"><div class="text-[10px] uppercase font-bold text-gray-400">Attended</div><div class="text-2xl font-extrabold text-emerald-600">${attended}</div></div>
                            <div class="bg-white rounded-2xl border p-4"><div class="text-[10px] uppercase font-bold text-gray-400">Rate</div><div class="text-2xl font-extrabold text-ribacom-navy">${rate}%</div></div>
                        </div>
                        <div class="bg-white rounded-3xl border p-4 sm:p-6">
                            <div class="flex justify-between items-center mb-4"><h3 class="font-extrabold">Registered Members</h3><button onclick="app.openEventAttendanceManager('${eventId}')" class="text-xs font-bold bg-slate-100 px-3 py-2 rounded-xl">Refresh</button></div>
                            <div class="space-y-2">
                                ${rows.map(r=>{const m=byId[r.member_id]||{};return `<div class="border rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                                    <div><div class="font-bold text-sm">${esc(m.full_name||'Member')}</div><div class="text-[11px] text-gray-500">${esc(m.membership_number||'')} • ${esc(r.status)}</div></div>
                                    ${r.status==='registered'?'<button onclick="app.checkInEventMember(\''+eventId+'\',\''+r.member_id+'\')" class="bg-ribacom-green text-white px-3 py-2 rounded-xl text-xs font-extrabold">Check In</button>':r.status==='attended'?'<span class="text-xs font-bold text-emerald-700">✓ Checked in</span>':'<span class="text-xs text-gray-400">Cancelled</span>'}
                                </div>`}).join('')||'<p class="text-sm text-gray-500">No registrations yet.</p>'}
                            </div>
                        </div>
                    </div>`;
            }

            async checkInEventMember(eventId,memberId) {
                if(!['admin','super_admin','secretary_general','vice_president','welfare_officer'].includes(this.currentUser?.roleKey)) return;
                const {error}=await this.supabaseClient.from('events_attendance').update({status:'attended',checked_in_at:new Date().toISOString(),checked_in_by:this.currentUser.id}).eq('event_id',eventId).eq('member_id',memberId);
                if(error){this.toast('Check-in failed: '+error.message,'error');return;}
                this.toast('Member checked in successfully.','success');
                await this.openEventAttendanceManager(eventId);
            }

            renderEventsView() {
                const manager=['admin','super_admin','secretary_general','vice_president','welfare_officer'].includes(this.currentUser?.roleKey);
                const memberId=this.currentUser?.memberId;
                const events=[...this.db.events].sort((a,b)=>new Date(a.event_date||a.date||0)-new Date(b.event_date||b.date||0));
                return `
                    <div class="max-w-6xl mx-auto space-y-6 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6 sm:p-8">
                            <span class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ribacom-gold">RIBACOM DIGITAL ECOSYSTEM</span>
                            <h2 class="text-2xl sm:text-3xl font-extrabold mt-1">Events & Attendance</h2>
                            <p class="text-sm text-gray-300 mt-2">Meetings, programmes and community activities with digital registration and attendance tracking.</p>
                        </div>
                        ${events.length?'<div class="grid grid-cols-1 md:grid-cols-2 gap-5">'+events.map(e=>{
                            const mine=memberId&&this.db.eventAttendance?this.db.eventAttendance.find(r=>r.event_id===e.id&&r.member_id===memberId):null;
                            const when=e.event_date||e.date||'';
                            return `<article class="bg-white rounded-3xl border border-gray-100 card-shadow overflow-hidden">
                                ${e.image_url||e.image?'<img src="'+esc(e.image_url||e.image)+'" class="w-full h-44 object-cover" onerror="this.style.display=\'none\'">':''}
                                <div class="p-5">
                                    <div class="text-[10px] uppercase font-extrabold text-ribacom-green">${esc(when?new Date(when).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'Date to be announced')}</div>
                                    <h3 class="text-xl font-extrabold text-ribacom-navy mt-2">${esc(e.title||'RIBACOM Event')}</h3>
                                    <p class="text-sm text-gray-600 mt-2">${esc(e.description||'')}</p>
                                    ${e.location?'<div class="text-xs text-gray-500 mt-3"><i class="fa-solid fa-location-dot mr-1"></i>'+esc(e.location)+'</div>':''}
                                    <div class="flex flex-wrap gap-2 mt-4">
                                      ${memberId?(mine?.status==='registered'?'<button onclick="app.cancelEventRegistration(\''+e.id+'\')" class="bg-amber-100 text-amber-800 px-3 py-2 rounded-xl text-xs font-extrabold">Cancel Registration</button>':mine?.status==='attended'?'<span class="bg-emerald-100 text-emerald-800 px-3 py-2 rounded-xl text-xs font-extrabold">✓ Attended</span>':'<button onclick="app.registerForEvent(\''+e.id+'\')" class="bg-ribacom-green text-white px-3 py-2 rounded-xl text-xs font-extrabold">Register</button>'):'<button onclick="app.openLoginModal()" class="bg-ribacom-navy text-white px-3 py-2 rounded-xl text-xs font-extrabold">Login to Register</button>'}
                                      ${manager?'<button onclick="app.openEventAttendanceManager(\''+e.id+'\')" class="bg-slate-100 text-ribacom-navy px-3 py-2 rounded-xl text-xs font-extrabold">Attendance Manager</button>':''}
                                    </div>
                                </div>
                            </article>`;
                        }).join('')+'</div>':'<div class="bg-white rounded-3xl border p-8 text-center text-gray-500">No events have been published yet.</div>'}
                    </div>`;
            }

            renderMemberDashboardView() {
                const member = (this.db.members || []).find(x => x.id === this.currentUser?.memberId) || {};
                const application = (this.db.membershipApplications || []).find(x => x.user_id === this.currentUser?.id) || {};
                const status = String(member.status || application.status || 'pending').toLowerCase();
                const name = member.full_name || this.currentUser?.fullName || this.currentUser?.email || 'RIBACOM Member';
                const digitalId = (this.db.digitalIds || []).find(x => x.memberId === member.id || x.member_id === member.id);
                const payments = (this.db.financeTransactions || []).filter(x => x.status === 'confirmed' && (x.member_id === member.id || x.memberId === member.id));
                const paid = payments.filter(x => x.direction === 'income').reduce((n,x)=>n+Number(x.amount||0),0);
                const badge = status === 'approved' ? 'bg-emerald-50 text-emerald-700' : status === 'rejected' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700';
                const escv = v => this.esc ? this.esc(v) : String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
                return '<div class="max-w-5xl mx-auto space-y-5 animate-fadeIn">'+
                  '<div class="rounded-3xl ribacom-header-gradient text-white p-6"><div class="flex items-center gap-4"><div class="w-16 h-16 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">'+
                  (member.photo_url?'<img src="'+escv(member.photo_url)+'" class="w-full h-full object-cover" alt="Profile">':'<i class="fa-solid fa-user text-2xl text-ribacom-gold"></i>')+
                  '</div><div><p class="text-xs text-gray-300">RIBACOM MEMBER PORTAL</p><h2 class="text-xl font-extrabold">'+escv(name)+'</h2><p class="text-xs text-gray-300">'+escv(this.currentUser?.email||member.email||'')+'</p></div></div></div>'+
                  '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">'+
                  '<div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Membership</p><span class="inline-block mt-2 px-2 py-1 rounded-full text-xs font-extrabold '+badge+'">'+escv(status)+'</span></div>'+
                  '<div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Membership No.</p><p class="font-extrabold text-sm mt-2">'+escv(member.membership_number||'Pending')+'</p></div>'+
                  '<div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Category</p><p class="font-extrabold text-sm mt-2">'+escv(member.category||'—')+'</p></div>'+
                  '<div class="bg-white rounded-2xl p-4 border card-shadow"><p class="text-[10px] text-gray-500 uppercase">Confirmed Payments</p><p class="font-extrabold text-sm mt-2">D'+paid.toLocaleString()+'</p></div></div>'+
                  '<div class="bg-white rounded-3xl border card-shadow p-5"><h3 class="font-extrabold text-ribacom-navy mb-4">Application Status</h3><div class="grid sm:grid-cols-3 gap-4 text-sm"><div><span class="text-[10px] uppercase text-gray-400 font-bold">Submitted</span><p class="font-semibold mt-1">'+(application.created_at?new Date(application.created_at).toLocaleDateString():'—')+'</p></div><div><span class="text-[10px] uppercase text-gray-400 font-bold">Reviewed</span><p class="font-semibold mt-1">'+(application.reviewed_at?new Date(application.reviewed_at).toLocaleDateString():'Awaiting review')+'</p></div><div><span class="text-[10px] uppercase text-gray-400 font-bold">Admin Note</span><p class="font-semibold mt-1">'+escv(application.admin_notes||'No note')+'</p></div></div></div>'+
                  '<div class="bg-white rounded-3xl border card-shadow p-5"><h3 class="font-extrabold text-ribacom-navy mb-4">My Profile</h3><div class="grid sm:grid-cols-2 gap-3 text-sm">'+
                  '<p><b>Phone:</b> '+escv(member.phone||'—')+'</p><p><b>Email:</b> '+escv(member.email||this.currentUser?.email||'—')+'</p><p><b>State:</b> '+escv(member.state_of_origin||'—')+'</p><p><b>LGA:</b> '+escv(member.lga||'—')+'</p><p class="sm:col-span-2"><b>Address:</b> '+escv(member.address||'—')+'</p></div></div>'+
                  '<div class="flex flex-wrap gap-2">'+
                  (status==='approved'&&digitalId?'<button onclick="app.navigate(\'digital-id\')" class="bg-ribacom-green text-white px-4 py-2.5 rounded-xl text-xs font-extrabold"><i class="fa-solid fa-id-card mr-1"></i> Digital ID</button>':'<button onclick="app.toast(\'Digital ID becomes available after approval.\',\'warning\')" class="bg-gray-100 text-gray-500 px-4 py-2.5 rounded-xl text-xs font-extrabold">Digital ID after Approval</button>')+
                  '<button onclick="app.navigate(\'events\')" class="bg-ribacom-navy text-white px-4 py-2.5 rounded-xl text-xs font-extrabold">Events & Attendance</button>'+
                  '<button onclick="app.navigate(\'welfare\')" class="bg-ribacom-gold text-ribacom-navy px-4 py-2.5 rounded-xl text-xs font-extrabold">Welfare</button>'+
                  '<button onclick="app.navigate(\'finance\')" class="bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-xs font-extrabold">Finance & Dues</button>'+
                  '</div></div>';
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
                            <div class="relative z-10 max-w-3xl space-y-4">
                                <div class="flex items-center gap-4">
                                    <div class="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-white p-1.5 shadow-2xl border-2 border-ribacom-gold/70 flex-shrink-0 overflow-hidden">
                                        <img src="ribacom-crest.jpg" alt="Official Rivers Bayelsa Community RIBACOM Crest" class="w-full h-full object-cover rounded-full">
                                    </div>
                                    <div class="inline-flex items-center gap-2 bg-ribacom-gold/20 text-ribacom-gold border border-ribacom-gold/40 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                                        <i class="fa-solid fa-star text-[10px]"></i> Official Community Platform
                                    </div>
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
                                    <h4 class="font-extrabold text-base text-gray-800">Up to Up to D${(this.db.welfareSettings.loss_parent?.amount||15000).toLocaleString()}</h4>
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
                    ? [...this.db.leadership].sort((a,b)=>Number(a.display_order??a.order??0)-Number(b.display_order??b.order??0))
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
                                        <div><label class="form-label">Passport Photograph</label><input type="file" id="m_photo_file" accept="image/*" class="form-input"><input type="hidden" id="m_photo"><p class="text-[10px] text-gray-500 mt-1">Upload directly from your phone. Maximum 5 MB.</p></div>
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
                                    <p>Membership Application Form Fee: <strong>D${(this.db.welfareSettings.membership_application_fee?.amount||100).toLocaleString()}</strong><br>Monthly membership dues: <strong>D${(this.db.welfareSettings.monthly_dues?.amount||50).toLocaleString()} per month</strong>. Your application is submitted as <strong>Pending</strong> for Secretariat review. Approval is required before full member benefits and Digital ID issuance.</p>
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
                                <p class="text-lg font-extrabold text-ribacom-green">Up to D${(this.db.welfareSettings.wedding?.amount||10000).toLocaleString()}</p>
                            </div>

                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow text-center space-y-1">
                                <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto text-base">
                                    <i class="fa-solid fa-baby"></i>
                                </div>
                                <h4 class="font-bold text-xs text-gray-800">Birthday Benefit</h4>
                                <p class="text-lg font-extrabold text-ribacom-green">Up to D${(this.db.welfareSettings.birth?.amount||5000).toLocaleString()}</p>
                            </div>

                            <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow text-center space-y-1">
                                <div class="w-10 h-10 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto text-base">
                                    <i class="fa-solid fa-ribbon"></i>
                                </div>
                                <h4 class="font-bold text-xs text-gray-800">Bereavement</h4>
                                <p class="text-lg font-extrabold text-ribacom-green">Up to D${(this.db.welfareSettings.loss_parent?.amount||15000).toLocaleString()}</p>
                                <p class="text-[9px] text-gray-400">Parent / Spouse / Child — subject to applicable maximum</p>
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
                                            <option value="wedding">Wedding Benefit — up to D${(this.db.welfareSettings.wedding?.amount||10000).toLocaleString()}</option>
                                            <option value="birth">Birthday Benefit — up to D${(this.db.welfareSettings.birth?.amount||5000).toLocaleString()}</option>
                                            <option value="loss_parent">Loss of Parent — up to D${(this.db.welfareSettings.loss_parent?.amount||15000).toLocaleString()}</option>
                                            <option value="loss_spouse">Loss of Spouse — up to D${(this.db.welfareSettings.loss_spouse?.amount||15000).toLocaleString()}</option>
                                            <option value="loss_child">Loss of Child — up to D${(this.db.welfareSettings.loss_child?.amount||15000).toLocaleString()}</option>
                                            <option value="other">Other Special Welfare</option>
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
                const raw = this.db.youth || {};
                const title = raw.title || 'RIBACOM Youth Wing';
                const content = raw.content || 'The RIBACOM Youth Wing provides a platform for youth participation, leadership development, community service, skills development and cultural activities.';
                const image = raw.image || '';
                const leader = raw.leader || 'Youth Wing Leadership — To Be Announced';
                const activities = Array.isArray(raw.activities) && raw.activities.length
                    ? raw.activities
                    : ['Youth leadership and capacity development','Skills acquisition and entrepreneurship','Community service and volunteering','Cultural and social programmes','Sports and youth engagement'];
                return `
                    <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                        <div class="bg-gradient-to-r from-ribacom-navy to-ribacom-green text-white p-8 rounded-3xl shadow-xl space-y-4">
                            <span class="bg-ribacom-gold text-ribacom-navy font-black text-[10px] px-2.5 py-1 rounded-full uppercase">Youth Wing</span>
                            <h2 class="text-2xl font-extrabold">${title}</h2>
                            ${image ? `<img src="${image}" alt="RIBACOM Youth Wing" class="w-full max-h-56 object-cover rounded-2xl border border-white/20">` : ''}
                            <p class="text-xs text-gray-200 leading-relaxed">${content}</p>
                            <div class="pt-2">
                                <span class="text-xs text-ribacom-gold font-bold"><i class="fa-solid fa-user-shield mr-1"></i> Leadership: ${leader}</span>
                            </div>
                        </div>
                        <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-3">
                            <h3 class="font-bold text-base text-gray-800">Youth Initiatives & Projects</h3>
                            <ul class="space-y-2">
                                ${activities.map(act => `
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
                const contacts = [
                    { role: 'Chairman / President', phone: '+220 877991397', icon: 'fa-user-tie' },
                    { role: 'Secretary General', phone: '+220 833586955', icon: 'fa-user-pen' },
                    { role: 'Welfare Officer', phone: '+220 877039287', icon: 'fa-hand-holding-heart' }
                ];
                const email = 'ribacomgambia@gmail.com';
                const address = 'Agricultural Hall, Opposite St Charles, Tabokoto Road';

                return `
                    <div class="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                        <div class="text-center space-y-1">
                            <span class="text-[10px] font-extrabold uppercase tracking-widest text-ribacom-green">RIBACOM Secretariat</span>
                            <h2 class="text-2xl font-extrabold text-ribacom-navy">Contact Secretariat</h2>
                            <p class="text-xs text-gray-600">Reach out to RIBACOM for official enquiries, membership support and community assistance.</p>
                        </div>

                        <div class="bg-white p-5 rounded-3xl border border-gray-100 card-shadow space-y-4">
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-ribacom-green flex items-center justify-center"><i class="fa-solid fa-location-dot"></i></div>
                                <div>
                                    <div class="text-[10px] uppercase font-extrabold text-gray-400">Secretariat / Meeting Address</div>
                                    <div class="text-sm font-bold text-ribacom-navy mt-1">${esc(address)}</div>
                                </div>
                            </div>
                            <div class="flex items-start gap-3">
                                <div class="w-10 h-10 rounded-xl bg-emerald-50 text-ribacom-green flex items-center justify-center"><i class="fa-solid fa-envelope"></i></div>
                                <div>
                                    <div class="text-[10px] uppercase font-extrabold text-gray-400">RIBACOM Secretariat Email</div>
                                    <a href="mailto:${email}" class="text-sm font-bold text-ribacom-green mt-1 inline-block">${email}</a>
                                </div>
                            </div>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-3">
                            ${contacts.map(c => `
                                <div class="bg-white p-4 rounded-2xl border border-gray-100 card-shadow">
                                    <div class="w-10 h-10 rounded-xl bg-emerald-50 text-ribacom-green flex items-center justify-center mb-3"><i class="fa-solid ${c.icon}"></i></div>
                                    <div class="text-[11px] font-extrabold text-ribacom-navy">${esc(c.role)}</div>
                                    <a href="tel:${c.phone.replace(/[^+\\d]/g, '')}" class="text-sm font-bold text-ribacom-green mt-1 inline-block">${esc(c.phone)}</a>
                                    <a href="https://wa.me/${c.phone.replace(/\\D/g, '')}" target="_blank" rel="noopener noreferrer" class="block text-[10px] font-bold text-gray-500 mt-2">
                                        <i class="fa-brands fa-whatsapp mr-1"></i> WhatsApp
                                    </a>
                                </div>
                            `).join('')}
                        </div>

                        <div class="bg-white p-6 rounded-3xl border border-gray-100 card-shadow space-y-4">
                            <div>
                                <h3 class="font-extrabold text-ribacom-navy">Send a Message</h3>
                                <p class="text-[11px] text-gray-500 mt-1">Use the form below to send an enquiry to the RIBACOM Secretariat.</p>
                            </div>
                            <form onsubmit="event.preventDefault(); const f=this; const body=encodeURIComponent('Name: '+f.name.value.trim()+'\\nEmail: '+f.email.value.trim()+'\\n\\nMessage:\\n'+f.message.value.trim()); window.location.href='mailto:ribacomgambia@gmail.com?subject=RIBACOM%20Secretariat%20Enquiry&body='+body;" class="space-y-3">
                                <input name="name" type="text" required placeholder="Your Name" class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-ribacom-green outline-none">
                                <input name="email" type="email" required placeholder="Your Email" class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-ribacom-green outline-none">
                                <textarea name="message" required rows="4" placeholder="Message content..." class="w-full px-3 py-2 border rounded-xl text-xs focus:ring-2 focus:ring-ribacom-green outline-none"></textarea>
                                <button type="submit" class="w-full bg-ribacom-green hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition">Email Secretariat</button>
                            </form>
                        </div>
                    </div>
                `;
            }


            renderMembershipVerificationView() {
                const params=new URLSearchParams(window.location.search);
                const preset=params.get('id')||'';
                return `
                    <div class="max-w-4xl mx-auto space-y-6 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6 sm:p-8">
                            <span class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ribacom-gold">RIBACOM DIGITAL ID</span>
                            <h2 class="text-2xl sm:text-3xl font-extrabold mt-1">Membership Verification</h2>
                            <p class="text-sm text-gray-300 mt-2">Verify an official RIBACOM membership ID without exposing private member information.</p>
                        </div>
                        <form id="verifyMembershipForm" class="bg-white rounded-3xl border p-5 sm:p-6 card-shadow">
                            <label class="text-xs font-extrabold text-gray-600">Membership ID Number</label>
                            <div class="flex flex-col sm:flex-row gap-3 mt-2">
                                <input id="verifyMembershipId" value="${esc(preset)}" placeholder="e.g. RBC-ID-2026-ABC123" class="flex-1 border rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500" required>
                                <button class="bg-ribacom-green text-white px-6 py-3 rounded-2xl font-extrabold">Verify ID</button>
                            </div>
                        </form>
                        <div id="membershipVerificationResult"></div>
                    </div>`;
            }

            async verifyMembershipId(id) {
                id=String(id||'').trim();
                const out=document.getElementById('membershipVerificationResult');
                if(!out) return;
                if(!id) { out.innerHTML=''; return; }
                if(!/^RBC-ID-[A-Z0-9-]+$/i.test(id)) {
                    out.innerHTML='<div class="bg-red-50 border border-red-200 text-red-700 rounded-3xl p-6 text-center font-extrabold">MEMBERSHIP NOT VERIFIED</div>';
                    return;
                }
                out.innerHTML='<div class="bg-white border rounded-3xl p-8 text-center text-sm text-gray-500">Verifying membership ID…</div>';
                try {
                    const base=(window.RIBACOM_CONFIG?.supabaseUrl||'').replace(/\/$/,'');
                    const res=await fetch(base+'/functions/v1/verify-membership-id?id='+encodeURIComponent(id),{headers:{'Accept':'application/json'}});
                    const data=await res.json().catch(()=>({}));
                    if(!res.ok||!data?.valid) {
                        out.innerHTML='<div class="bg-red-50 border border-red-200 text-red-700 rounded-3xl p-6 text-center"><div class="text-lg font-extrabold">MEMBERSHIP NOT VERIFIED</div><div class="text-xs mt-2">The ID is invalid, inactive, suspended, revoked or not found.</div></div>';
                        return;
                    }
                    out.innerHTML=`
                        <div class="bg-white rounded-3xl border border-emerald-200 card-shadow overflow-hidden">
                            <div class="bg-emerald-50 p-5 text-center border-b border-emerald-100">
                                <div class="text-emerald-700 text-xs font-extrabold uppercase tracking-widest"><i class="fa-solid fa-circle-check mr-1"></i> Verified RIBACOM Membership</div>
                            </div>
                            <div class="p-5 sm:p-7 grid sm:grid-cols-[120px_1fr] gap-6 items-center">
                                ${data.photo_url?'<img src="'+esc(data.photo_url)+'" class="w-28 h-28 rounded-2xl object-cover border mx-auto sm:mx-0" onerror="this.style.display=\'none\'">':'<div class="w-28 h-28 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl text-slate-400 mx-auto sm:mx-0"><i class="fa-solid fa-user"></i></div>'}
                                <div class="space-y-2">
                                    <h3 class="text-2xl font-extrabold text-ribacom-navy">${esc(data.full_name||data.name||'RIBACOM Member')}</h3>
                                    <div class="text-sm"><b>Membership ID:</b> ${esc(data.id_card_number||data.membership_number||id)}</div>
                                    <div class="text-sm"><b>Category:</b> ${esc(data.category||'—')}</div>
                                    <div class="text-sm"><b>State:</b> ${esc(data.state_of_origin||'—')}</div>
                                    <div class="text-sm"><b>Status:</b> <span class="text-emerald-700 font-extrabold">${esc(data.status||'Active')}</span></div>
                                    <div class="text-xs text-gray-500">Issued: ${esc((data.issued_at||'').slice(0,10)||'—')} • Expires: ${esc((data.expires_at||'').slice(0,10)||'—')}</div>
                                </div>
                            </div>
                            <div class="px-5 pb-5 text-center text-[10px] font-bold text-gray-400">RIVERS BAYELSA COMMUNITY IN DIASPORA THE GAMBIA • TRUTH • UNITY • SERVICE</div>
                        </div>`;
                } catch(e) {
                    out.innerHTML='<div class="bg-amber-50 border border-amber-200 text-amber-800 rounded-3xl p-6 text-center"><div class="font-extrabold">Verification service unavailable</div><div class="text-xs mt-2">Please try again shortly.</div></div>';
                }
            }

            renderEcosystemActivityView() {
                const u=this.currentUser||{};
                const role=(u.roleKey||'guest').toLowerCase();
                const isAdmin=['admin','super_admin'].includes(role);
                const isExec=['president','vice_president','secretary_general','assistant_secretary_general','treasurer','welfare_officer','pro'].includes(role);
                const items=[];
                const push=(type,title,desc,action,icon,priority='Normal')=>items.push({type,title,desc,action,icon,priority});

                const pendingApps=this.db.membershipApplications.filter(x=>x.status==='pending');
                const pendingWelfare=this.db.welfareRequests.filter(x=>['pending','under_review'].includes(x.status));
                const pendingApprovals=[...this.db.announcements,...this.db.events,...this.db.gallery,...this.db.publications]
                    .filter(x=>x.approval_status==='pending');

                if(isAdmin||['president','vice_president','secretary_general','assistant_secretary_general'].includes(role)) {
                    if(pendingApps.length) push('Membership',pendingApps.length+' membership application'+(pendingApps.length===1?'':'s')+' awaiting review','New membership applications need attention.','admin-members','fa-user-plus','High');
                }
                if(isAdmin||['president','vice_president','welfare_officer'].includes(role)) {
                    if(pendingWelfare.length) push('Welfare',pendingWelfare.length+' welfare request'+(pendingWelfare.length===1?'':'s')+' awaiting action','Review member welfare requests and update their status.','welfare','fa-hand-holding-heart','High');
                }
                if(isAdmin||isExec) {
                    if(pendingApprovals.length) push('Approvals',pendingApprovals.length+' submission'+(pendingApprovals.length===1?'':'s')+' awaiting approval','Official content is waiting for executive review.','approval-center','fa-check-double','High');
                }
                if(['treasurer','admin','super_admin'].includes(role)) {
                    const pendingFinance=this.db.financeTransactions.filter(x=>x.status==='pending');
                    if(pendingFinance.length) push('Finance',pendingFinance.length+' finance transaction'+(pendingFinance.length===1?'':'s')+' pending confirmation','Review pending financial records and receipts.','finance','fa-coins','High');
                }
                if(role==='pro'||isAdmin) {
                    const drafts=[...this.db.announcements,...this.db.events,...this.db.gallery,...this.db.publications].filter(x=>x.is_published===false);
                    if(drafts.length) push('Communications',drafts.length+' communication item'+(drafts.length===1?'':'s')+' not yet published','Review content before publication.','announcements','fa-bullhorn','Normal');
                }
                if(u.memberId) {
                    const mine=this.db.membershipApplications.filter(x=>x.user_id===u.id);
                    if(mine.some(x=>x.status==='pending')) push('My Membership','Your membership application is under review','You will see the decision and reviewer note here when completed.','member-dashboard','fa-id-card','Normal');
                    const myWelfare=this.db.welfareRequests.filter(x=>x.member_id===u.memberId && ['pending','under_review'].includes(x.status));
                    if(myWelfare.length) push('My Welfare',myWelfare.length+' welfare request'+(myWelfare.length===1?'':'s')+' in progress','Track your welfare support request from your member portal.','member-dashboard','fa-heart','Normal');
                }
                if(!items.length) push('System Ready','No urgent actions right now','Your RIBACOM workspace is up to date. Continue exploring the ecosystem.','digital-ecosystem','fa-circle-check','Good');

                return `
                    <div class="max-w-6xl mx-auto space-y-6 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6 sm:p-8">
                            <span class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ribacom-gold">RIBACOM DIGITAL ECOSYSTEM</span>
                            <div class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mt-1">
                                <div><h2 class="text-2xl sm:text-3xl font-extrabold">Activity & Notifications Centre</h2><p class="text-sm text-gray-300 mt-2">One place to see what needs your attention across the RIBACOM ecosystem.</p></div>
                                <span class="text-xs bg-white/10 border border-white/20 rounded-xl px-3 py-2">${items.length} active item${items.length===1?'':'s'}</span>
                            </div>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] uppercase font-bold text-gray-400">High Priority</div><div class="text-2xl font-extrabold text-red-600 mt-1">${items.filter(x=>x.priority==='High').length}</div></div>
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] uppercase font-bold text-gray-400">Normal</div><div class="text-2xl font-extrabold text-amber-600 mt-1">${items.filter(x=>x.priority==='Normal').length}</div></div>
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] uppercase font-bold text-gray-400">Role</div><div class="text-sm font-extrabold text-ribacom-green mt-2">${esc(role||'guest')}</div></div>
                        </div>
                        <div class="space-y-3">
                            ${items.map(x=>`
                                <div class="bg-white rounded-2xl border border-gray-100 card-shadow p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center">
                                    <div class="w-11 h-11 rounded-2xl bg-emerald-50 text-ribacom-green flex items-center justify-center shrink-0"><i class="fa-solid ${x.icon}"></i></div>
                                    <div class="flex-1"><div class="flex flex-wrap gap-2 items-center"><span class="text-[10px] uppercase font-extrabold text-gray-400">${x.type}</span><span class="text-[9px] font-extrabold px-2 py-1 rounded-full ${x.priority==='High'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}">${x.priority}</span></div><h3 class="font-extrabold text-ribacom-navy mt-1">${esc(x.title)}</h3><p class="text-xs text-gray-500 mt-1">${esc(x.desc)}</p></div>
                                    <button onclick="app.navigate('${x.action}')" class="shrink-0 bg-ribacom-green text-white px-4 py-2.5 rounded-xl text-xs font-extrabold">Open <i class="fa-solid fa-arrow-right ml-1"></i></button>
                                </div>`).join('')}
                        </div>
                        <div class="flex gap-2"><button onclick="app.navigate('digital-ecosystem')" class="bg-ribacom-navy text-white px-4 py-2.5 rounded-xl text-xs font-bold">Back to Ecosystem</button><button onclick="app.loadCloudData().then(()=>app.navigate('ecosystem-activity'))" class="bg-white border border-gray-200 text-ribacom-navy px-4 py-2.5 rounded-xl text-xs font-bold">Refresh Activity</button></div>
                    </div>`;
            }

            renderEcosystemSearchView() {
                const u=this.currentUser||{};
                if(!u.id) return '<div class="max-w-3xl mx-auto p-8 text-center">Please log in to use Unified Ecosystem Search.</div>';
                return `
                    <div class="max-w-6xl mx-auto space-y-6 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6 sm:p-8">
                            <span class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ribacom-gold">RIBACOM DIGITAL ECOSYSTEM</span>
                            <h2 class="text-2xl sm:text-3xl font-extrabold mt-1">Unified Ecosystem Search</h2>
                            <p class="text-sm text-gray-300 mt-2">Search the RIBACOM records available to your account from one central place.</p>
                        </div>
                        <div class="bg-white rounded-3xl border border-gray-100 card-shadow p-5 sm:p-6">
                            <div class="relative">
                                <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
                                <input id="ecosystemSearchInput" type="search" placeholder="Search members, announcements, events, publications, IDs..." oninput="app.runEcosystemSearch(this.value)" class="w-full pl-11 pr-4 py-4 rounded-2xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            </div>
                            <div class="flex flex-wrap gap-2 mt-3 text-[10px] font-bold text-gray-500">
                                <span class="px-3 py-1.5 bg-slate-50 rounded-full">Members</span><span class="px-3 py-1.5 bg-slate-50 rounded-full">Digital IDs</span><span class="px-3 py-1.5 bg-slate-50 rounded-full">News</span><span class="px-3 py-1.5 bg-slate-50 rounded-full">Events</span><span class="px-3 py-1.5 bg-slate-50 rounded-full">Publications</span>
                            </div>
                        </div>
                        <div id="ecosystemSearchResults"></div>
                        <button onclick="app.navigate('digital-ecosystem')" class="bg-ribacom-navy text-white px-4 py-2.5 rounded-xl text-xs font-bold">Back to Ecosystem</button>
                    </div>`;
            }

            runEcosystemSearch(term='') {
                const root=document.getElementById('ecosystemSearchResults');
                if(!root) return;
                const q=String(term||'').trim().toLowerCase();
                if(!q){ root.innerHTML='<div class="text-center text-sm text-gray-400 py-8">Start typing to search authorized ecosystem records.</div>'; return; }
                const out=[];
                const add=(type,title,desc,action,icon)=>out.push({type,title,desc,action,icon});
                this.db.members.filter(m=>[m.fullName,m.membershipNo,m.email,m.phone,m.stateOfOrigin,m.lga,m.category].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,12).forEach(m=>add('Member',m.fullName,m.membershipNo||m.email||m.phone||'RIBACOM member','members','fa-user'));
                this.db.digitalIds.filter(d=>String(d.idCardNumber||'').toLowerCase().includes(q)).slice(0,8).forEach(d=>add('Digital ID',d.idCardNumber,'Official RIBACOM digital identity','digital-id','fa-id-card'));
                this.db.announcements.filter(a=>[a.title,a.content,a.description].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,8).forEach(a=>add('Announcement',a.title,a.description||'RIBACOM announcement','announcements','fa-bullhorn'));
                this.db.events.filter(e=>[e.title,e.description,e.location].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,8).forEach(e=>add('Event',e.title,e.description||e.location||'RIBACOM event','events','fa-calendar-days'));
                this.db.publications.filter(p=>[p.title,p.description,p.content].some(v=>String(v||'').toLowerCase().includes(q))).slice(0,8).forEach(p=>add('Publication',p.title,p.description||'RIBACOM publication','publications','fa-book-open'));
                if(!out.length){root.innerHTML='<div class="bg-white rounded-3xl border border-gray-100 p-8 text-center text-sm text-gray-500">No matching authorized records found.</div>';return;}
                root.innerHTML='<div class="space-y-3">'+out.map(x=>`<button onclick="app.navigate('${x.action}')" class="w-full text-left bg-white rounded-2xl border border-gray-100 card-shadow p-4 flex items-center gap-4 hover:border-ribacom-green transition"><div class="w-10 h-10 rounded-xl bg-emerald-50 text-ribacom-green flex items-center justify-center"><i class="fa-solid ${x.icon}"></i></div><div class="min-w-0 flex-1"><div class="text-[9px] uppercase font-extrabold text-gray-400">${x.type}</div><div class="font-extrabold text-ribacom-navy truncate">${esc(x.title)}</div><div class="text-xs text-gray-500 truncate">${esc(x.desc)}</div></div><i class="fa-solid fa-arrow-right text-gray-300"></i></button>`).join('')+'</div>';
            }

            renderEcosystemCommunicationView() {
                const u=this.currentUser||{};
                if(!u.id) return '<div class="max-w-3xl mx-auto p-8 text-center">Please log in to access RIBACOM Communications.</div>';
                const role=(u.roleKey||'member').toLowerCase();
                const canManage=['admin','super_admin','president','secretary_general','pro'].includes(role);
                const notices=[];
                const add=(type,title,body,date,action,icon)=>notices.push({type,title,body,date,action,icon});
                this.db.announcements.filter(x=>x.is_published!==false).slice(0,10).forEach(x=>add('Official Notice',x.title,x.description||x.content||'RIBACOM announcement',x.date||x.created_at?.slice(0,10),'announcements','fa-bullhorn'));
                this.db.events.filter(x=>x.date && x.date>=new Date().toISOString().slice(0,10)).slice(0,6).forEach(x=>add('Upcoming Event',x.title,x.description||x.location||'RIBACOM event',x.date,'events','fa-calendar-days'));
                if(['admin','super_admin','president','vice_president','secretary_general','assistant_secretary_general'].includes(role)){
                    const pending=this.db.membershipApplications.filter(x=>x.status==='pending').length;
                    if(pending) add('Internal Alert',pending+' membership application'+(pending===1?'':'s')+' awaiting review','Internal membership administration requires attention.',new Date().toISOString().slice(0,10),'admin-members','fa-user-plus');
                }
                if(['admin','super_admin','president','vice_president','welfare_officer'].includes(role)){
                    const pending=this.db.welfareRequests.filter(x=>['pending','under_review'].includes(x.status)).length;
                    if(pending) add('Welfare Alert',pending+' welfare request'+(pending===1?'':'s')+' in progress','Review welfare support activity in the ecosystem.',new Date().toISOString().slice(0,10),'welfare','fa-hand-holding-heart');
                }
                return `
                    <div class="max-w-6xl mx-auto space-y-6 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6 sm:p-8">
                            <span class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ribacom-gold">RIBACOM DIGITAL ECOSYSTEM</span>
                            <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mt-1">
                                <div><h2 class="text-2xl sm:text-3xl font-extrabold">Member Communication Centre</h2><p class="text-sm text-gray-300 mt-2">A central communication layer for official notices, upcoming activities and authorized internal alerts.</p></div>
                                ${canManage?'<button onclick="app.navigate(\'announcements\')" class="bg-white text-ribacom-navy px-4 py-2.5 rounded-xl text-xs font-extrabold">Manage Official Notices</button>':''}
                            </div>
                        </div>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] uppercase font-bold text-gray-400">Notices</div><div class="text-2xl font-extrabold text-ribacom-navy mt-1">${notices.filter(x=>x.type==='Official Notice').length}</div></div>
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] uppercase font-bold text-gray-400">Events</div><div class="text-2xl font-extrabold text-ribacom-green mt-1">${notices.filter(x=>x.type==='Upcoming Event').length}</div></div>
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] uppercase font-bold text-amber-600">Alerts</div><div class="text-2xl font-extrabold mt-1">${notices.filter(x=>x.type!=='Official Notice'&&x.type!=='Upcoming Event').length}</div></div>
                        </div>
                        <div class="space-y-3">
                            ${notices.length?notices.map(x=>`<button onclick="app.navigate('${x.action}')" class="w-full text-left bg-white rounded-2xl border border-gray-100 card-shadow p-4 sm:p-5 flex gap-4 hover:border-ribacom-green transition"><div class="w-11 h-11 rounded-2xl bg-emerald-50 text-ribacom-green flex items-center justify-center shrink-0"><i class="fa-solid ${x.icon}"></i></div><div class="flex-1 min-w-0"><div class="text-[9px] uppercase font-extrabold text-gray-400">${x.type} • ${esc(x.date||'')}</div><h3 class="font-extrabold text-ribacom-navy mt-1">${esc(x.title)}</h3><p class="text-xs text-gray-500 mt-1 line-clamp-2">${esc(x.body)}</p></div><i class="fa-solid fa-chevron-right text-gray-300 self-center"></i></button>`).join(''):'<div class="bg-white rounded-3xl border border-gray-100 p-10 text-center text-sm text-gray-500">No communications are currently available.</div>'}
                        </div>
                        <div class="bg-ribacom-navy text-white rounded-3xl p-5"><div class="font-extrabold">Official communication policy</div><p class="text-xs text-gray-300 mt-1">Official RIBACOM notices remain connected to the existing publication and approval workflow. This centre does not create a separate messaging database.</p></div>
                        <div class="flex gap-2"><button onclick="app.navigate('digital-ecosystem')" class="bg-ribacom-navy text-white px-4 py-2.5 rounded-xl text-xs font-bold">Back to Ecosystem</button><button onclick="app.loadCloudData().then(()=>app.navigate('ecosystem-communication'))" class="bg-white border border-gray-200 text-ribacom-navy px-4 py-2.5 rounded-xl text-xs font-bold">Refresh</button></div>
                    </div>`;
            }

            renderDigitalEcosystemView() {
                const u=this.currentUser||{};
                const role=(u.roleKey||'guest').toLowerCase();
                const isAdmin=['admin','super_admin'].includes(role);
                const isExec=['president','vice_president','secretary_general','assistant_secretary_general','treasurer','welfare_officer','pro'].includes(role);
                const canFinance=['treasurer','admin','super_admin'].includes(role);
                const canWelfare=['welfare_officer','admin','super_admin','president','vice_president'].includes(role);
                const canMembership=['secretary_general','admin','super_admin','president','vice_president'].includes(role);
                const roleNames={
                    super_admin:'Super Administrator',admin:'Administrator',president:'President / Chairman',
                    vice_president:'Vice President',secretary_general:'Secretary General',
                    assistant_secretary_general:'Assistant Secretary General',treasurer:'Treasurer',
                    welfare_officer:'Welfare Officer / Provost',pro:'Public Relations Officer',
                    member:'Member',visitor:'Visitor',guest:'Guest'
                };
                const roleTitle=roleNames[role]||'RIBACOM Member';
                const pendingApplications=this.db.membershipApplications.filter(x=>x.status==='pending').length;
                const pendingWelfare=this.db.welfareRequests.filter(x=>['pending','under_review'].includes(x.status)).length;
                const activeIds=this.db.digitalIds.filter(x=>x.status==='active').length;
                const pendingApprovals=this.db.announcements.filter(x=>x.approval_status==='pending').length+
                    this.db.events.filter(x=>x.approval_status==='pending').length+
                    this.db.gallery.filter(x=>x.approval_status==='pending').length+
                    this.db.publications.filter(x=>x.approval_status==='pending').length;

                const roleActions={
                    member:[
                        {id:'member-dashboard',icon:'fa-user-circle',title:'My RIBACOM Portal',desc:'Membership status, profile, dues and personal services.'},
                        {id:'digital-id',icon:'fa-id-card',title:'My Digital ID',desc:'Open your official RIBACOM Digital ID and QR verification.'},
                        {id:'welfare',icon:'fa-hand-holding-heart',title:'Welfare Support',desc:'View benefits and submit a welfare request.'}
                    ],
                    treasurer:[
                        {id:'treasurer-dashboard',icon:'fa-file-invoice-dollar',title:'Treasurer Workspace',desc:'Manage dues, receipts, transactions and financial reports.'},
                        {id:'finance',icon:'fa-coins',title:'Finance & Dues',desc:'Review the RIBACOM financial ledger and member payment records.'}
                    ],
                    welfare_officer:[
                        {id:'welfare',icon:'fa-hand-holding-heart',title:'Welfare Workspace',desc:'Review and manage member welfare support.'},
                        {id:'members',icon:'fa-address-book',title:'Member Directory',desc:'Access member records needed for welfare administration.'}
                    ],
                    secretary_general:[
                        {id:'admin-members',icon:'fa-users-gear',title:'Membership Administration',desc:'Review membership applications and maintain member records.'},
                        {id:'executive-work',icon:'fa-briefcase',title:'Executive Work Centre',desc:'Coordinate executive tasks and organizational work.'}
                    ],
                    pro:[
                        {id:'announcements',icon:'fa-bullhorn',title:'News & Announcements',desc:'Manage and monitor official RIBACOM communications.'},
                        {id:'publications',icon:'fa-book-open',title:'Publications',desc:'Manage official publications and documents.'},
                        {id:'gallery',icon:'fa-images',title:'Media Gallery',desc:'Manage the RIBACOM media archive.'}
                    ],
                    vice_president:[
                        {id:'executive-work',icon:'fa-briefcase',title:'Executive Work Centre',desc:'Coordinate executive assignments and oversight.'},
                        {id:'approval-center',icon:'fa-check-double',title:'Approval Centre',desc:'Review executive submissions requiring approval.'}
                    ],
                    president:[
                        {id:'approval-center',icon:'fa-check-double',title:'Presidential Approval Centre',desc:'Final review of official submissions and publications.'},
                        {id:'executive-work',icon:'fa-briefcase',title:'Executive Work Centre',desc:'Full executive coordination and oversight.'}
                    ],
                    assistant_secretary_general:[
                        {id:'executive-work',icon:'fa-briefcase',title:'Executive Work Centre',desc:'Manage assigned executive tasks and records.'},
                        {id:'admin-members',icon:'fa-users-gear',title:'Membership Administration',desc:'Support membership administration.'}
                    ]
                };

                let quick=roleActions[role]||[];
                if(isAdmin) quick=[
                    {id:'admin-dashboard',icon:'fa-shield-halved',title:'Administration',desc:'Full system administration and management.'},
                    {id:'admin-members',icon:'fa-users-gear',title:'Membership Administration',desc:'Applications, approvals and member records.'},
                    {id:'treasurer-dashboard',icon:'fa-file-invoice-dollar',title:'Finance Oversight',desc:'Review financial management and reports.'},
                    {id:'approval-center',icon:'fa-check-double',title:'Approval Centre',desc:'Review official executive submissions.'}
                ];

                const canSearch=!!u.id;
                const modules=[
                    {id:'membership',icon:'fa-users',title:'Membership',desc:'Applications, member records and membership services.',show:true},
                    {id:'elections',icon:'fa-check-to-slot',title:'Elections & Voting',desc:'Secure member elections and voting.',show:!!u.id},\n                    {id:'digital-id',icon:'fa-id-card',title:'Digital ID & Verification',desc:'View and verify official RIBACOM Digital IDs.',show:true},
                    {id:'finance',icon:'fa-coins',title:'Finance & Dues',desc:'Dues, payment records and financial services.',show:!!u.id||isAdmin},
                    {id:'welfare',icon:'fa-hand-holding-heart',title:'Welfare',desc:'Welfare benefits, claims and support.',show:true},
                    {id:'announcements',icon:'fa-bullhorn',title:'News & Announcements',desc:'Official RIBACOM communications.',show:true},
                    {id:'events',icon:'fa-calendar-days',title:'Events',desc:'Meetings, programmes and activities.',show:true},
                    {id:'publications',icon:'fa-book-open',title:'Publications',desc:'Official documents and publications.',show:true},
                    {id:'gallery',icon:'fa-images',title:'Media Gallery',desc:'RIBACOM photos and media archive.',show:true},
                    {id:'youth',icon:'fa-people-group',title:'Youth',desc:'Youth programmes and development.',show:true},
                    {id:'advisers',icon:'fa-user-tie',title:'Advisers',desc:'Council and advisory information.',show:true},
                    {id:'constitution',icon:'fa-scale-balanced',title:'Constitution',desc:'RIBACOM governing documents.',show:true},
                    {id:'leadership',icon:'fa-landmark',title:'Leadership',desc:'Current executive leadership.',show:true},
                    {id:'members',icon:'fa-address-book',title:'Members Directory',desc:'Access the member directory.',show:!!u.id||isAdmin},
                    {id:'member-dashboard',icon:'fa-user-circle',title:'My RIBACOM Portal',desc:'Profile, membership status and personal services.',show:!!u.id},
                    {id:'admin-dashboard',icon:'fa-shield-halved',title:'Administration',desc:'System administration and management.',show:isAdmin},
                    {id:'treasurer-dashboard',icon:'fa-file-invoice-dollar',title:'Treasurer Workspace',desc:'Financial management and reports.',show:canFinance},
                    {id:'approval-center',icon:'fa-check-double',title:'Executive Approval Centre',desc:'Review and approve official submissions.',show:isExec||isAdmin},
                    {id:'executive-work',icon:'fa-briefcase',title:'Executive Work Centre',desc:'Executive tasks and organizational work.',show:isExec||isAdmin}
                ];
                modules.push({id:'ecosystem-search',icon:'fa-magnifying-glass',title:'Unified Ecosystem Search',desc:'Search authorized RIBACOM records from one place.',show:canSearch});
                modules.push({id:'ecosystem-communication',icon:'fa-comments',title:'Communication Centre',desc:'Official notices, events and authorized internal alerts.',show:canSearch});
                const visible=modules.filter(x=>x.show);

                return `
                    <div class="max-w-7xl mx-auto space-y-6 animate-fadeIn">
                        <div class="rounded-3xl ribacom-header-gradient text-white p-6 sm:p-8">
                            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                                <div>
                                    <span class="text-[10px] font-extrabold uppercase tracking-[0.2em] text-ribacom-gold">RIBACOM DIGITAL ECOSYSTEM</span>
                                    <h2 class="text-2xl sm:text-3xl font-extrabold mt-1">Welcome, ${esc(u.fullName||'RIBACOM Member')}</h2>
                                    <p class="text-sm text-gray-300 mt-2">Your role-based command centre for the connected RIBACOM digital ecosystem.</p>
                                </div>
                                <div class="rounded-2xl bg-white/10 border border-white/20 px-5 py-4 min-w-[210px]">
                                    <div class="text-[10px] uppercase tracking-wider text-gray-300 font-bold">Current access</div>
                                    <div class="font-extrabold text-ribacom-gold mt-1">${esc(roleTitle)}</div>
                                    <div class="text-[10px] text-gray-300 mt-2">${u.email?esc(u.email):'Public access'}</div>
                                </div>
                            </div>
                        </div>

                        ${u.id?`
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] text-gray-400 font-bold uppercase">Membership</div><div class="text-xl font-extrabold text-ribacom-navy mt-1">${this.db.members.length}</div><div class="text-[10px] text-gray-500">records visible</div></div>
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] text-gray-400 font-bold uppercase">Digital IDs</div><div class="text-xl font-extrabold text-ribacom-green mt-1">${activeIds}</div><div class="text-[10px] text-gray-500">active</div></div>
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] text-gray-400 font-bold uppercase">Welfare</div><div class="text-xl font-extrabold text-amber-600 mt-1">${pendingWelfare}</div><div class="text-[10px] text-gray-500">awaiting action</div></div>
                            <div class="bg-white rounded-2xl border border-gray-100 p-4"><div class="text-[10px] text-gray-400 font-bold uppercase">Applications</div><div class="text-xl font-extrabold text-purple-600 mt-1">${pendingApplications}</div><div class="text-[10px] text-gray-500">pending</div></div>
                        </div>`:''}

                        <div class="bg-white rounded-3xl border border-gray-100 card-shadow p-5 sm:p-6">
                            <div class="flex items-center justify-between gap-3 mb-4">
                                <div><h3 class="font-extrabold text-ribacom-navy">Your Priority Workspace</h3><p class="text-xs text-gray-500 mt-1">Tools assigned to your RIBACOM role.</p></div>
                                ${pendingApprovals&&isExec||isAdmin?'<span class="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">Approval activity available</span>':''}
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                ${quick.map(x=>`
                                    <button onclick="app.navigate('${x.id}')" class="text-left rounded-2xl border border-gray-100 bg-slate-50 hover:bg-emerald-50 hover:border-ribacom-green p-4 transition">
                                        <i class="fa-solid ${x.icon} text-ribacom-green"></i>
                                        <h4 class="font-extrabold text-sm text-ribacom-navy mt-3">${x.title}</h4>
                                        <p class="text-[11px] text-gray-500 mt-1 leading-5">${x.desc}</p>
                                    </button>`).join('')}
                            </div>
                        </div>

                        <div>
                            <div class="flex items-end justify-between mb-3"><div><h3 class="font-extrabold text-ribacom-navy">All Ecosystem Services</h3><p class="text-xs text-gray-500 mt-1">One RIBACOM platform, connected modules and role-based access.</p></div></div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                ${visible.map(m=>`
                                    <button onclick="app.navigate('${m.id}')" class="text-left bg-white rounded-3xl border border-gray-100 card-shadow p-5 hover:-translate-y-0.5 hover:border-ribacom-green transition">
                                        <div class="w-11 h-11 rounded-2xl bg-emerald-50 text-ribacom-green flex items-center justify-center mb-4"><i class="fa-solid ${m.icon} text-lg"></i></div>
                                        <h3 class="font-extrabold text-ribacom-navy">${m.title}</h3>
                                        <p class="text-xs text-gray-500 mt-1 leading-5">${m.desc}</p>
                                        <span class="inline-flex items-center gap-1 mt-4 text-[10px] font-extrabold uppercase text-ribacom-green">Open <i class="fa-solid fa-arrow-right"></i></span>
                                    </button>`).join('')}
                            </div>
                        </div>

                        <div class="bg-ribacom-navy rounded-3xl p-5 sm:p-6 text-white">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div><h3 class="font-extrabold">RIBACOM Digital Ecosystem</h3><p class="text-xs text-gray-300 mt-1">One identity • one Supabase backend • connected services • role-based access.</p></div>
                                <button onclick="app.navigate('home')" class="bg-white/10 border border-white/20 px-4 py-2 rounded-xl text-xs font-bold">Back to Public Home</button>
                            </div>
                        </div>
                    </div>`;
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
                const displayRole = ({super_admin:'Super Admin',admin:'Admin',president:'President / Chairman',vice_president:'Vice President',secretary_general:'Secretary General',assistant_secretary_general:'Assistant Secretary General',treasurer:'Treasurer',welfare_officer:'Welfare Officer / Provost',pro:'Public Relations Officer',visitor:'Visitor'}[role] || 'Member');
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
                this.navigate('digital-ecosystem');
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
                    role: ({super_admin:'Super Admin',admin:'Admin',president:'President / Chairman',vice_president:'Vice President',secretary_general:'Secretary General',assistant_secretary_general:'Assistant Secretary General',treasurer:'Treasurer',welfare_officer:'Welfare Officer / Provost',pro:'Public Relations Officer',visitor:'Visitor'}[role] || 'Member'),
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