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
                this.bindSupabaseAuthState();
                this.ready = this.restoreSupabaseSession()
                    .then(() => this.loadCloudData())
                    .then(() => this.navigate(this.currentView))
                    .catch(error => {
                        console.error('RIBACOM startup error:', error);
                        this.navigate(this.currentView || 'home');
                    });
            }

            initSupabase() {
                try {
                    const cfg = window.RIBACOM_CONFIG || {};
                    if (!window.supabase?.createClient || !cfg.supabaseUrl || !cfg.supabaseKey) {
                        console.warn('RIBACOM Supabase configuration is unavailable.');
                        return;
                    }
                    this.supabaseClient = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
                        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
                    });
                    this.cloudMode = true;
                } catch (error) {
                    console.error('Supabase initialization failed:', error);
                    this.supabaseClient = null;
                    this.cloudMode = false;
                }
            }

            async loadCloudData() {
                if (!this.supabaseClient) return this.db;
                this.cloudErrors = [];
                const publicSources = {
                    leadership: 'leadership',
                    advisers: 'advisers',
                    constitution: 'constitution',
                    announcements: 'announcements',
                    events: 'events',
                    gallery: 'gallery',
                    publications: 'publications',
                    youthContent: 'youth_content',
                    aboutContent: 'ribacom_about_content'
                };
                // Only request protected datasets after authentication. RLS remains the
                // authoritative security boundary; this prevents guest startup from
                // generating expected permission errors for admin/member-only tables.
                const privateSources = this.currentUser ? {
                    members: 'members',
                    digitalIds: 'digital_ids',
                    paymentSettings: 'payment_settings',
                    welfareRequests: 'welfare_requests',
                    financeTransactions: 'finance_transactions',
                    membershipApplications: 'membership_applications'
                } : {};
                const sources = {...publicSources, ...privateSources};
                const results = await Promise.all(Object.entries(sources).map(async ([key, table]) => {
                    try {
                        const { data, error } = await this.supabaseClient.from(table).select('*');
                        if (error) {
                            this.cloudErrors.push({table, message:error.message || String(error)});
                            console.warn('RIBACOM data load failed for '+table+':', error.message || error);
                            return [key, []];
                        }
                        return [key, data || []];
                    } catch (error) {
                        console.warn('RIBACOM data load failed for '+table+':', error);
                        return [key, []];
                    }
                }));
                for (const [key, value] of results) {
                    if (key === 'youthContent') this.db.youth = value[0] || this.db.youth;
                    else if (key === 'aboutContent') this.db.about = value[0] || this.db.about;
                    else if (key === 'members') {
                        this.db.members = value.map(m => ({
                            ...m,
                            fullName: m.fullName || m.full_name || '',
                            membershipNo: m.membershipNo || m.membership_number || '',
                            stateOfOrigin: m.stateOfOrigin || m.state_of_origin || '',
                            photoUrl: m.photoUrl || m.photo_url || ''
                        }));
                    } else if (key === 'digitalIds') {
                        this.db.digitalIds = value.map(id => ({
                            ...id,
                            memberId: id.memberId || id.member_id || null,
                            idCardNumber: id.idCardNumber || id.id_card_number || '',
                            qrCodeData: id.qrCodeData || id.qr_code_data || '',
                            expiresAt: id.expiresAt || id.expires_at || null,
                            issuedAt: id.issuedAt || id.issued_at || null
                        }));
                    } else if (key === 'membershipApplications') {
                        this.db.membershipApplications = value.map(a => ({
                            ...a,
                            fullName: a.fullName || a.full_name || '',
                            userId: a.userId || a.user_id || null,
                            membershipCategory: a.membershipCategory || a.membership_category || '',
                            status: a.status || 'pending'
                        }));
                    } else {
                        this.db[key] = value;
                    }
                }
                if (this.cloudErrors.length) {
                    console.warn('RIBACOM cloud data warnings:', this.cloudErrors);
                }
                return this.db;
            }

            bindSupabaseAuthState() {
                if (!this.supabaseClient?.auth) return;
                try {
                    this.supabaseClient.auth.onAuthStateChange(async (event, session) => {
                        if (event === 'SIGNED_OUT') {
                            this.currentUser = null;
                            this.updateAuthHeaderUI();
                            return;
                        }
                        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
                            await this.hydrateCurrentUser(session.user);
                            this.updateAuthHeaderUI();
                        }
                    });
                } catch (error) {
                    console.warn('Supabase auth listener setup failed:', error);
                }
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
                        this.updateAuthHeaderUI();
                        return;
                    }
                    await this.hydrateCurrentUser(user);
                } catch (error) {
                    console.warn('Session restore failed:', error);
                    this.currentUser = null;
                    this.updateAuthHeaderUI();
                }
            }
            async hydrateCurrentUser(user) {
                if (!user || !this.supabaseClient) return;
                const [profileResult, memberResult, applicationResult] = await Promise.all([
                    this.supabaseClient.from('profiles').select('*').eq('id', user.id).maybeSingle(),
                    this.supabaseClient.from('members').select('*').eq('user_id', user.id).maybeSingle(),
                    this.supabaseClient.from('membership_applications').select('*').eq('user_id', user.id).order('created_at',{ascending:false}).limit(1).maybeSingle()
                ]);
                if (profileResult.error) console.warn('Profile hydration:', profileResult.error.message);
                if (memberResult.error) console.warn('Member hydration:', memberResult.error.message);
                if (applicationResult.error) console.warn('Application hydration:', applicationResult.error.message);
                const profile = profileResult.data;
                const member = memberResult.data;
                const latestApplication = applicationResult.data;

                // Email verification can leave a newly registered applicant without a
                // members row because the initial anonymous signup cannot satisfy the
                // protected members INSERT policy. Once the user is authenticated, safely
                // create/synchronize that member record from their latest application.
                let activeMember = member;
                if (!activeMember && latestApplication) {
                    const memberPayload = {
                        user_id: user.id,
                        full_name: latestApplication.full_name || profile?.full_name || user.email,
                        email: latestApplication.email || user.email,
                        phone: latestApplication.phone || profile?.phone || '',
                        state_of_origin: latestApplication.state_of_origin || '',
                        lga: latestApplication.lga || '',
                        address: latestApplication.current_address || '',
                        photo_url: latestApplication.photo_url || null,
                        nationality: latestApplication.nationality || 'Nigerian',
                        category: String(latestApplication.membership_category || '').toLowerCase().includes('associate') ? 'associate' : 'regular',
                        status: latestApplication.status || 'pending'
                    };
                    const { data: createdMember, error: memberSyncError } = await this.supabaseClient
                        .from('members')
                        .upsert(memberPayload,{onConflict:'user_id'})
                        .select('*')
                        .maybeSingle();
                    if (memberSyncError) {
                        console.warn('Post-verification member sync:', memberSyncError.message);
                    } else {
                        activeMember = createdMember;
                    }
                }

                // Keep the profile role authoritative, but recover a missing profile safely
                // from the authenticated account so verified users are never stranded as guests.
                let resolvedProfile = profile;
                if (!resolvedProfile) {
                    const {data:createdProfile,error:profileSyncError}=await this.supabaseClient
                        .from('profiles')
                        .upsert({
                            id:user.id,
                            email:user.email || '',
                            full_name:activeMember?.full_name || latestApplication?.full_name || user.email || '',
                            phone:activeMember?.phone || latestApplication?.phone || ''
                        },{onConflict:'id'})
                        .select('*')
                        .maybeSingle();
                    if (profileSyncError) console.warn('Post-verification profile sync:', profileSyncError.message);
                    else resolvedProfile = createdProfile;
                }
                const role = resolvedProfile?.role || 'member';
                this.currentUser = {
                    id: user.id,
                    userId: user.id,
                    email: user.email,
                    fullName: resolvedProfile?.full_name || activeMember?.full_name || latestApplication?.full_name || user.email,
                    phone: resolvedProfile?.phone || activeMember?.phone || '',
                    role: ({super_admin:'Super Admin',admin:'Admin',president:'President / Chairman',vice_president:'Vice President',secretary_general:'Secretary General',assistant_secretary_general:'Assistant Secretary General',treasurer:'Treasurer',welfare_officer:'Welfare Officer / Provost',pro:'Public Relations Officer',visitor:'Visitor'}[role] || 'Member'),
                    roleKey: role,
                    membershipNumber: activeMember?.membership_number || '',
                    memberId: activeMember?.id || null,
                    status: activeMember?.status || latestApplication?.status || null,
                    photoUrl: resolvedProfile?.avatar_url || activeMember?.photo_url || latestApplication?.photo_url || ''
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
                if (!this.currentUser) {
                    this.openLoginModal();
                    return;
                }
                const role = String(this.currentUser.roleKey || '').toLowerCase();
                if (['admin','super_admin'].includes(role)) {
                    this.navigate('admin-dashboard');
                    return;
                }
                if (role === 'treasurer') {
                    this.navigate('treasurer-dashboard');
                    return;
                }
                if (['president','vice_president','secretary_general','assistant_secretary_general','welfare_officer','pro'].includes(role)) {
                    this.navigate('executive-work');
                    return;
                }
                this.navigate('member-dashboard');
            }

            renderBasicPublicView(view) {
                const titles={about:'About RIBACOM',members:'Members',announcements:'News & Announcements',events:'Events',gallery:'Media Gallery',publications:'Publications',youth:'Youth Wing',advisers:'Council of Advisers',contact:'Contact Us',constitution:'Constitution'};
                const keyMap={announcements:'announcements',events:'events',gallery:'gallery',publications:'publications',advisers:'advisers',constitution:'constitution'};
                const title=titles[view]||'RIBACOM';
                const key=keyMap[view];
                let body='';
                if(view==='home') body='<div class="bg-ribacom-navy text-white rounded-3xl p-7 sm:p-10 border-b-4 border-ribacom-gold"><span class="text-ribacom-gold text-xs font-black uppercase">Official Community Portal</span><h1 class="text-3xl sm:text-5xl font-extrabold mt-2">'+esc(window.RIBACOM_CONFIG?.orgName||'RIBACOM')+'</h1><p class="mt-3 text-sm text-gray-200">'+esc(window.RIBACOM_CONFIG?.officialName||'Rivers Bayelsa Community in Diaspora The Gambia')+'</p><p class="mt-4 text-ribacom-gold font-extrabold">'+esc(window.RIBACOM_CONFIG?.motto||'TRUTH • UNITY • SERVICE')+'</p><div class="mt-6 flex flex-wrap gap-2"><button onclick="app.navigate(\'membership\')" class="bg-ribacom-gold text-ribacom-navy px-5 py-3 rounded-xl font-extrabold text-sm">Join RIBACOM</button><button onclick="app.navigate(\'announcements\')" class="bg-white/10 border border-white/20 px-5 py-3 rounded-xl font-bold text-sm">Latest News</button></div></div>';
                else if(view==='membership') body='<div class="bg-white rounded-3xl border p-6"><h2 class="text-2xl font-extrabold text-ribacom-navy">RIBACOM Membership</h2><p class="text-sm text-gray-600 mt-2">Membership applications are submitted through the secure member portal.</p><button onclick="app.openLoginModal()" class="mt-5 bg-ribacom-green text-white px-5 py-3 rounded-xl font-bold">Login / Apply for Membership</button></div>';
                else if(view==='contact') body='<div class="bg-white rounded-3xl border p-6"><h2 class="text-2xl font-extrabold text-ribacom-navy">Contact RIBACOM</h2><div class="mt-4 space-y-2 text-sm text-gray-700"><p><b>Secretariat:</b> Agricultural Hall, Opposite Charles Jaw School, Bundung</p><p><b>Email:</b> ribacomgambia@gmail.com</p><p><b>Chairman / President:</b> +220 877991397</p><p><b>Secretary General:</b> +220 833586955</p><p><b>Welfare Officer:</b> +220 877039287</p></div></div>';
                else {
                    const rows=(this.db[key]||[]);
                    body='<div class="space-y-4">'+(rows.length?rows.map(x=>'<article class="bg-white rounded-2xl border p-5"><h3 class="font-extrabold text-ribacom-navy">'+esc(x.title||x.name||x.article_title||'RIBACOM Record')+'</h3><p class="text-sm text-gray-600 mt-2">'+esc(x.description||x.content||x.caption||x.article_text||'')+'</p></article>').join(''):'<div class="bg-white rounded-2xl border p-6 text-sm text-gray-500">No published records are currently available.</div>')+'</div>';
                }
                return '<div class="max-w-5xl mx-auto space-y-5 animate-fadeIn"><div><h2 class="text-2xl font-extrabold text-ribacom-navy">'+esc(title)+'</h2><p class="text-xs text-gray-500">RIBACOM Digital Ecosystem</p></div>'+body+'</div>';
            }

            navigate(view, params=null) {
                this.currentView=view||'home';
                const protectedViews=['member-dashboard','treasurer-dashboard','finance','finance-reports','executive-work','approval-center','admin-dashboard','admin-members','admin-digital-ids','admin-constitution','admin-gallery','admin-welfare','admin-leadership','admin-advisers','admin-announcements','admin-events','admin-publications','admin-youth','admin-payments','admin-about','admin-system'];
                if(protectedViews.includes(this.currentView) && !this.currentUser){
                    this.toast('Please sign in to access this portal.','warning');
                    this.openLoginModal();
                    return;
                }
                let html;
                try {
                    if(this.currentView==='member-dashboard') html=this.renderMemberDashboardView?.();
                    else if(this.currentView==='admin-dashboard') html=this.renderAdminDashboardView?.();
                    else if(this.currentView==='admin-digital-ids') html=this.renderAdminDigitalIdsView?.();
                    else if(this.currentView==='admin-members') html=this.renderMembershipReviewD7?.();
                    else if(this.currentView==='admin-constitution') html=this.renderAdminConstitutionD5?.();
                    else if(this.currentView==='admin-gallery') html=this.renderAdminGalleryD5?.();
                    else if(this.currentView==='admin-system') html=this.renderD7Page?.(this.currentView);
                    else if(this.currentView==='treasurer-dashboard') html=this.renderTreasurerDashboardView?.();
                    else if(this.currentView==='finance') html=this.renderFinanceView?.();
                    else if(this.currentView==='finance-reports') html=this.renderFinanceReports?.();
                    else if(this.currentView==='approval-center') html=this.renderApprovalCenter?.();
                    else if(this.currentView==='executive-work') html=this.renderExecutiveWorkCenter?.();
                    else if(this.currentView==='digital-id') html=this.renderDigitalIdView?.();
                    else if(this.currentView==='welfare') html=this.renderWelfareView?.() || '<div class="bg-white rounded-3xl border p-8 text-center">Welfare Centre is loading…</div>';
                    else if(this.currentView==='notifications') html=this.renderNotificationsView?.() || '<div class="bg-white rounded-3xl border p-8 text-center">Notifications Centre is loading…</div>';
                    else if(this.currentView==='elections') html=this.renderElectionsView?.();
                    else html=this.renderBasicPublicView(this.currentView);
                    const target=document.getElementById('appViewport');
                    if(target) {
                        if(html && typeof html.then==='function') html.then(h=>{target.innerHTML=h||'';this.updateAuthHeaderUI();window.scrollTo({top:0,behavior:'smooth'});});
                        else { target.innerHTML=html||this.renderBasicPublicView(this.currentView); this.updateAuthHeaderUI(); window.scrollTo({top:0,behavior:'smooth'}); }
                    }
                } catch(error) {
                    console.error('RIBACOM navigation error:',error);
                    const target=document.getElementById('appViewport');
                    if(target) target.innerHTML='<div class="bg-white rounded-2xl border border-red-200 p-6 text-red-700"><b>RIBACOM page error.</b><p class="text-sm mt-1">Please try this page again.</p></div>';
                }
            }

            updateAuthHeaderUI() {
                const container = document.getElementById('authButtonsContainer');
                const miniStatus = document.getElementById('userMiniStatus');
                const idBtn = document.getElementById('digitalIdQuickBtn');
                const mobileProfile = document.getElementById('mobileProfileCard');
                const mobileFooter = document.getElementById('mobileDrawerFooter');

                if (!container) return;
                if (this.currentUser) {
                    if (miniStatus) miniStatus.innerText = this.currentUser.fullName;
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
                    if (miniStatus) miniStatus.innerText = "Guest User";
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
                // Route approval through the full application workflow when an application exists.
                // This keeps member status, membership number, application status and Digital ID synchronized.
                if(status==='approved' && member.user_id && typeof this.approveMembershipApplication==='function'){
                    const {data:pendingApplication,error:pendingError}=await this.supabaseClient
                        .from('membership_applications')
                        .select('id,status')
                        .eq('user_id',member.user_id)
                        .in('status',['pending','under_review'])
                        .order('created_at',{ascending:false})
                        .limit(1)
                        .maybeSingle();
                    if(pendingError){this.toast(pendingError.message,'error');return;}
                    if(pendingApplication?.id) return this.approveMembershipApplication(pendingApplication.id);
                }
                const patch={status,updated_at:new Date().toISOString()};
                if(status==='approved'){
                    const currentNo=member.membershipNo||member.membership_number;
                    if(!currentNo){
                        let uniqueNo=null;
                        for(let attempt=0;attempt<8;attempt++){
                            const candidate=`RBC-GM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}${attempt?'-'+attempt:''}`;
                            const {data:conflict,error:checkError}=await this.supabaseClient.from('members').select('id').eq('membership_number',candidate).maybeSingle();
                            if(checkError){this.toast(checkError.message,'error');return;}
                            if(!conflict){uniqueNo=candidate;break;}
                        }
                        if(!uniqueNo){this.toast('Unable to generate a unique membership number. Please try again.','error');return;}
                        patch.membership_number=uniqueNo;
                    }
                }
                const {data,error}=await this.supabaseClient.from('members').update(patch).eq('id',id).select().maybeSingle();
                if(error){this.toast(error.message,'error');return;}

                // Keep the applicant's application record synchronized with the member decision.
                // This prevents the Admin dashboard and member dashboard from showing different statuses.
                const applicationStatus=status==='approved'?'approved':status==='rejected'?'rejected':status==='suspended'?'suspended':status;
                // Synchronize only the applicant's latest application, so an older historical
                // application is never accidentally changed by a new membership decision.
                const {data:latestApplication,error:applicationLookupError}=await this.supabaseClient
                    .from('membership_applications')
                    .select('id')
                    .eq('user_id',member.user_id)
                    .order('created_at',{ascending:false})
                    .limit(1)
                    .maybeSingle();
                if(applicationLookupError){
                    console.warn('Application lookup sync:',applicationLookupError.message);
                } else if(latestApplication?.id){
                    const {error:applicationUpdateError}=await this.supabaseClient
                        .from('membership_applications')
                        .update({status:applicationStatus,updated_at:new Date().toISOString()})
                        .eq('id',latestApplication.id);
                    if(applicationUpdateError) console.warn('Application status sync:',applicationUpdateError.message);
                }

                await this.loadCloudData();
                if(status==='approved'){
                    const approvedMember=this.db.members.find(m=>m.id===id);
                    const existingId=this.db.digitalIds.find(x=>x.memberId===id || x.member_id===id);
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
                const existing=this.db.digitalIds.find(x=>x.memberId===memberId || x.member_id===memberId); if(existing){this.toast('This member already has a Digital ID. Use edit/renew instead.','warning');return;}
                let idCardNumber=null;
                for(let attempt=0;attempt<8;attempt++){
                    const candidate=`RBC-GM-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}${attempt?'-'+attempt:''}`;
                    const {data:conflict,error:checkError}=await this.supabaseClient.from('digital_ids').select('id').eq('id_card_number',candidate).maybeSingle();
                    if(checkError){this.toast(checkError.message,'error');return;}
                    if(!conflict){idCardNumber=candidate;break;}
                }
                if(!idCardNumber){this.toast('Unable to generate a unique Digital ID number. Please try again.','error');return;}
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
            // RibacomApp now owns startup sequencing so authentication and cloud data
            // are restored before the initial route renders. This prevents a double
            // navigation race that could overwrite the authenticated dashboard.
        });