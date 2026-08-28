const C=window.QUIXPRINT_CRM_CONFIG||{},ok=C.SUPABASE_URL&&!C.SUPABASE_URL.includes("YOUR_")&&C.SUPABASE_ANON_KEY&&!C.SUPABASE_ANON_KEY.includes("YOUR_");
const db=ok?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null,$=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const stages=["New Lead","Researching","Contacted","Follow-Up","Quoted","Won","Lost"],S={user:null,workspace:null,members:[],companies:[],contacts:[],activities:[],current:null};
const esc=v=>String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const today=()=>new Date().toISOString().slice(0,10),fmt=v=>v?new Date(v+"T12:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):"—",money=v=>Number(v||0).toLocaleString("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0});
const member=id=>S.members.find(x=>x.user_id===id)?.display_name||"Unassigned",active=c=>!["Won","Lost"].includes(c.stage);
function toast(m,e=false){let t=$("#toast");t.textContent=m;t.className="toast show"+(e?" error":"");setTimeout(()=>t.className="toast",2600)}
function initTabs(){$$("[data-auth]").forEach(b=>b.onclick=()=>{$$("[data-auth]").forEach(x=>x.classList.toggle("active",x===b));$("#loginForm").classList.toggle("hidden",b.dataset.auth!=="login");$("#signupForm").classList.toggle("hidden",b.dataset.auth!=="signup")});$("#stage").innerHTML=stages.map(x=>`<option>${x}</option>`).join("");$("#stageFilter").innerHTML='<option value="">All stages</option>'+stages.map(x=>`<option>${x}</option>`).join("")}
async function init(){initTabs();if(!ok){$("#configWarning").classList.remove("hidden");return}let {data:{session}}=await db.auth.getSession();if(session)await enter(session.user)}
$("#loginForm").onsubmit=async e=>{e.preventDefault();let {error}=await db.auth.signInWithPassword({email:$("#loginEmail").value.trim(),password:$("#loginPassword").value});if(error)toast(error.message,true);else location.reload()}
$("#signupForm").onsubmit=async e=>{e.preventDefault();let code=$("#joinCode").value.trim().toUpperCase(),{data,error}=await db.auth.signUp({email:$("#signupEmail").value.trim(),password:$("#signupPassword").value,options:{data:{display_name:$("#signupName").value.trim()}}});if(error)return toast(error.message,true);if(!data.session)return toast("Confirm your email, then log in.");if(code){let {error:x}=await db.rpc("join_workspace",{invite_code_input:code});if(x)return toast(x.message,true)}await enter(data.user)}
async function enter(u){S.user=u;$("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");await loadAll();bind();render()}
async function loadAll(){let {data:w,error}=await db.from("workspace_members").select("workspace_id,workspaces(id,name,invite_code)").eq("user_id",S.user.id).single();if(error)return toast(error.message,true);S.workspace=w.workspaces;let [m,c,k,a]=await Promise.all([db.from("workspace_members").select("*").eq("workspace_id",S.workspace.id),db.from("companies").select("*").eq("workspace_id",S.workspace.id).order("updated_at",{ascending:false}),db.from("contacts").select("*").eq("workspace_id",S.workspace.id),db.from("activities").select("*").eq("workspace_id",S.workspace.id).order("activity_date",{ascending:false}).order("created_at",{ascending:false})]);S.members=m.data||[];S.companies=c.data||[];S.contacts=k.data||[];S.activities=a.data||[];let opts='<option value="">Unassigned</option>'+S.members.map(x=>`<option value="${x.user_id}">${esc(x.display_name||x.email)}</option>`).join("");$("#owner").innerHTML=opts;$("#ownerFilter").innerHTML='<option value="">All owners</option>'+opts.replace('<option value="">Unassigned</option>','')}
let bound=false;function bind(){if(bound)return;bound=true;$$(".nav[data-view]").forEach(b=>b.onclick=()=>view(b.dataset.view));$("#logoutBtn").onclick=()=>db.auth.signOut().then(()=>location.reload());$("#addCompanyBtn").onclick=()=>openCompany();$("#closeCompanyBtn").onclick=$("#cancelCompanyBtn").onclick=()=>$("#companyDialog").close();$("#companyForm").onsubmit=saveCompany;$("#deleteCompanyBtn").onclick=deleteCompany;$("#contactForm").onsubmit=saveContact;$("#cancelContactEditBtn").onclick=resetContactForm;$("#activityForm").onsubmit=saveActivity;$$("[data-tab]").forEach(b=>b.onclick=()=>tab(b.dataset.tab));["searchInput","stageFilter","ownerFilter","priorityFilter"].forEach(id=>$("#"+id).addEventListener(id==="searchInput"?"input":"change",renderCompanies));$("#copyCodeBtn").onclick=()=>navigator.clipboard.writeText(S.workspace.invite_code).then(()=>toast("Invite code copied."));$("#exportBtn").onclick=exportCSV;$("#csvInput").onchange=importCSV}
function view(n){$$(".view").forEach(x=>x.classList.add("hidden"));$("#"+n+"View").classList.remove("hidden");$$(".nav[data-view]").forEach(x=>x.classList.toggle("active",x.dataset.view===n));$("#pageTitle").textContent={dashboard:"Dashboard",pipeline:"Pipeline",companies:"Companies",followups:"Follow-ups",settings:"Settings"}[n]}
function render(){renderDashboard();renderPipeline();renderCompanies();renderFollowups();renderSettings()}
function renderDashboard(){let due=S.companies.filter(c=>active(c)&&c.next_follow_up&&c.next_follow_up<=today()),open=S.companies.filter(active);$("#statCompanies").textContent=S.companies.length;$("#statContacts").textContent=S.contacts.length;$("#statDue").textContent=due.length;$("#statPipeline").textContent=money(open.reduce((a,c)=>a+Number(c.estimated_value||0),0));let max=Math.max(...stages.map(s=>S.companies.filter(c=>c.stage===s).length),1);$("#funnel").innerHTML=stages.map(s=>{let n=S.companies.filter(c=>c.stage===s).length;return `<div class="funnel-row"><span>${s}</span><div class="bar"><i style="width:${n/max*100}%"></i></div><strong>${n}</strong></div>`}).join("");$("#priorityList").innerHTML=list(due.slice(0,7),c=>fmt(c.next_follow_up),"Nothing due.");$("#recentCompanies").innerHTML=list(S.companies.slice(0,7),c=>`${c.stage} · ${S.contacts.filter(x=>x.company_id===c.id).length} contacts`,"No companies yet.");$("#recentActivity").innerHTML=S.activities.slice(0,7).map(a=>{let c=S.companies.find(x=>x.id===a.company_id),k=S.contacts.find(x=>x.id===a.contact_id);return `<div class="list-item"><div><strong>${esc(a.activity_type)}: ${esc(a.subject)}</strong><small>${esc(c?.name||"Deleted company")}${k?" · "+esc(k.name):""}</small></div><small>${fmt(a.activity_date)}</small></div>`}).join("")||'<div class="empty">No activity yet.</div>'}
function list(items,sub,empty){return items.length?items.map(c=>`<div class="list-item"><div><strong>${esc(c.name)}</strong><small>${esc(c.industry||c.location||"")}</small></div><div><span>${esc(sub(c))}</span><small>${money(c.estimated_value)}</small></div></div>`).join(""):`<div class="empty">${empty}</div>`}
function renderPipeline(){$("#kanban").innerHTML=stages.map(s=>`<section class="kanban-col"><div class="kanban-head"><h3>${s}</h3><strong>${S.companies.filter(c=>c.stage===s).length}</strong></div>${S.companies.filter(c=>c.stage===s).map(c=>`<article class="kanban-card" onclick="openCompany('${c.id}')"><strong>${esc(c.name)}</strong><p>${esc(c.industry||c.location||"")}</p><p>${S.contacts.filter(x=>x.company_id===c.id).length} contacts</p><div class="card-foot"><span class="priority ${c.priority}">${c.priority}</span><span>${fmt(c.next_follow_up)}</span></div><div class="card-foot"><span>${esc(member(c.owner_id))}</span><strong>${money(c.estimated_value)}</strong></div></article>`).join("")}</section>`).join("")}
function filtered(){let q=$("#searchInput").value.toLowerCase(),st=$("#stageFilter").value,ow=$("#ownerFilter").value,pr=$("#priorityFilter").value;return S.companies.filter(c=>{let cs=S.contacts.filter(x=>x.company_id===c.id);return(!st||c.stage===st)&&(!ow||c.owner_id===ow)&&(!pr||c.priority===pr)&&(!q||[c.name,c.website,c.industry,c.location,c.products,c.notes,c.opportunity_summary,...cs.flatMap(x=>[x.name,x.title,x.email,x.phone])].some(v=>String(v||"").toLowerCase().includes(q)))})}
function renderCompanies(){let rows=filtered();$("#emptyCompanies").classList.toggle("hidden",!!rows.length);$("#companyRows").innerHTML=rows.map(c=>{let cs=S.contacts.filter(x=>x.company_id===c.id);return `<tr><td><strong>${esc(c.name)}</strong><br><small>${esc(c.industry||c.location||"")}</small></td><td>${cs.length}${cs.find(x=>x.is_primary)?` · ${esc(cs.find(x=>x.is_primary).name)}`:""}</td><td><span class="badge ${c.stage}">${c.stage}</span></td><td><span class="priority ${c.priority}">${c.priority}</span></td><td>${esc(member(c.owner_id))}</td><td>${fmt(c.next_follow_up)}</td><td>${money(c.estimated_value)}</td><td><button class="row-btn" onclick="openCompany('${c.id}')">•••</button></td></tr>`}).join("")}
function renderFollowups(){let a=S.companies.filter(c=>active(c)&&c.next_follow_up).sort((x,y)=>x.next_follow_up.localeCompare(y.next_follow_up)),t=today();$("#overdueList").innerHTML=list(a.filter(c=>c.next_follow_up<t),c=>fmt(c.next_follow_up),"Nothing overdue.");$("#todayList").innerHTML=list(a.filter(c=>c.next_follow_up===t),c=>c.priority,"Nothing due today.");$("#upcomingList").innerHTML=list(a.filter(c=>c.next_follow_up>t),c=>fmt(c.next_follow_up),"Nothing upcoming.")}
function renderSettings(){$("#workspaceCode").textContent=S.workspace.invite_code;$("#teamList").innerHTML=S.members.map(m=>`<div class="list-item"><div><strong>${esc(m.display_name||"Team member")}</strong><small>${esc(m.email)}</small></div><span>${esc(m.role)}</span></div>`).join("")}
window.openCompany=id=>{let c=S.companies.find(x=>x.id===id);S.current=c||null;$("#companyId").value=c?.id||"";$("#companyTitle").textContent=c?"Edit company":"Add company";let map={companyName:"name",website:"website",industry:"industry",location:"location",stage:"stage",priority:"priority",owner:"owner_id",source:"source",products:"products",estimatedValue:"estimated_value",lastContacted:"last_contacted",nextFollowUp:"next_follow_up",opportunitySummary:"opportunity_summary",notes:"notes"};Object.entries(map).forEach(([el,k])=>$("#"+el).value=c?.[k]??(el==="stage"?"New Lead":el==="priority"?"Normal":""));$("#owner").value=c?.owner_id||S.user.id;$("#deleteCompanyBtn").classList.toggle("hidden",!c);resetContactForm();renderContacts();renderActivity();tab("overview");$("#companyDialog").showModal()}
function tab(n){$$("[data-tab]").forEach(b=>b.classList.toggle("active",b.dataset.tab===n));["overview","contacts","activity"].forEach(x=>$("#"+x+"Tab").classList.toggle("hidden",x!==n))}
async function saveCompany(e){e.preventDefault();let id=$("#companyId").value,p={workspace_id:S.workspace.id,name:$("#companyName").value.trim(),website:$("#website").value.trim()||null,industry:$("#industry").value.trim()||null,location:$("#location").value.trim()||null,stage:$("#stage").value,priority:$("#priority").value,owner_id:$("#owner").value||null,source:$("#source").value.trim()||null,products:$("#products").value.trim()||null,estimated_value:Number($("#estimatedValue").value)||null,last_contacted:$("#lastContacted").value||null,next_follow_up:$("#nextFollowUp").value||null,opportunity_summary:$("#opportunitySummary").value.trim()||null,notes:$("#notes").value.trim()||null,updated_by:S.user.id};let {data,error}=await(id?db.from("companies").update(p).eq("id",id).select().single():db.from("companies").insert(p).select().single());if(error)return toast(error.message,true);S.current=data;$("#companyId").value=data.id;$("#deleteCompanyBtn").classList.remove("hidden");await loadAll();render();renderContacts();renderActivity();toast(id?"Company updated.":"Company added.")}
async function deleteCompany(){if(!confirm("Delete this company, its contacts and activity history?"))return;let {error}=await db.from("companies").delete().eq("id",S.current.id);if(error)return toast(error.message,true);$("#companyDialog").close();await loadAll();render();toast("Company deleted.")}
function renderContacts(){let enabled=!!S.current;$("#contactWarning").classList.toggle("hidden",enabled);$("#contactForm").classList.toggle("hidden",!enabled);let rows=S.contacts.filter(c=>c.company_id===S.current?.id);$("#contactsList").innerHTML=rows.map(c=>`<div class="contact-card"><div><h4>${esc(c.name)}${c.is_primary?' <span class="badge">Primary</span>':""}</h4><p>${esc(c.title||"")}</p><p>${esc(c.email||"")} ${c.phone?"· "+esc(c.phone):""}</p></div><div class="contact-actions"><button class="btn secondary" onclick="editContact('${c.id}')">Edit</button><button class="btn danger" onclick="deleteContact('${c.id}')">Delete</button></div></div>`).join("")||'<div class="empty">No contacts yet.</div>';$("#activityContact").innerHTML='<option value="">No specific contact</option>'+rows.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}
function resetContactForm(){$("#contactForm").reset();$("#contactId").value="";$("#contactPrimary").value="false";$("#cancelContactEditBtn").classList.add("hidden")}
window.editContact=id=>{let c=S.contacts.find(x=>x.id===id);$("#contactId").value=c.id;$("#contactName").value=c.name;$("#contactTitle").value=c.title||"";$("#contactEmail").value=c.email||"";$("#contactPhone").value=c.phone||"";$("#contactLinkedin").value=c.linkedin||"";$("#contactPrimary").value=String(c.is_primary);$("#cancelContactEditBtn").classList.remove("hidden")}
async function saveContact(e){e.preventDefault();if(!S.current)return;let id=$("#contactId").value,p={workspace_id:S.workspace.id,company_id:S.current.id,name:$("#contactName").value.trim(),title:$("#contactTitle").value.trim()||null,email:$("#contactEmail").value.trim()||null,phone:$("#contactPhone").value.trim()||null,linkedin:$("#contactLinkedin").value.trim()||null,is_primary:$("#contactPrimary").value==="true"};if(p.is_primary)await db.from("contacts").update({is_primary:false}).eq("company_id",S.current.id);let {error}=await(id?db.from("contacts").update(p).eq("id",id):db.from("contacts").insert(p));if(error)return toast(error.message,true);await loadAll();render();resetContactForm();renderContacts();toast(id?"Contact updated.":"Contact added.")}
window.deleteContact=async id=>{if(!confirm("Delete this contact?"))return;let {error}=await db.from("contacts").delete().eq("id",id);if(error)return toast(error.message,true);await loadAll();render();renderContacts();toast("Contact deleted.")}
function renderActivity(){let enabled=!!S.current;$("#activityWarning").classList.toggle("hidden",enabled);$("#activityForm").classList.toggle("hidden",!enabled);$("#activityDate").value=today();let rows=S.activities.filter(a=>a.company_id===S.current?.id);$("#activityTimeline").innerHTML=rows.map(a=>{let c=S.contacts.find(x=>x.id===a.contact_id);return `<article class="timeline-item"><h4>${esc(a.activity_type)} · ${esc(a.subject)}</h4><small>${fmt(a.activity_date)}${c?" · "+esc(c.name):""}</small>${a.body?`<p>${esc(a.body)}</p>`:""}</article>`}).join("")||'<div class="empty">No activity yet.</div>'}
async function saveActivity(e){e.preventDefault();if(!S.current)return;let p={workspace_id:S.workspace.id,company_id:S.current.id,contact_id:$("#activityContact").value||null,activity_type:$("#activityType").value,subject:$("#activitySubject").value.trim(),body:$("#activityBody").value.trim()||null,activity_date:$("#activityDate").value||today(),created_by:S.user.id};let {error}=await db.from("activities").insert(p);if(error)return toast(error.message,true);if(["Call","Email","Meeting"].includes(p.activity_type))await db.from("companies").update({last_contacted:p.activity_date,updated_by:S.user.id}).eq("id",S.current.id);$("#activitySubject").value="";$("#activityBody").value="";await loadAll();render();renderActivity();toast("Activity logged.")}
function exportCSV(){let h=["company","website","industry","location","stage","priority","source","products","estimated_value","last_contacted","next_follow_up","opportunity_summary","notes","contact_name","contact_title","contact_email","contact_phone","contact_linkedin","contact_primary"],q=v=>`"${String(v??"").replaceAll('"','""')}"`,rows=[];filtered().forEach(c=>{let cs=S.contacts.filter(x=>x.company_id===c.id);if(!cs.length)cs=[{}];cs.forEach(k=>rows.push([c.name,c.website,c.industry,c.location,c.stage,c.priority,c.source,c.products,c.estimated_value,c.last_contacted,c.next_follow_up,c.opportunity_summary,c.notes,k.name,k.title,k.email,k.phone,k.linkedin,k.is_primary].map(q).join(",")))});let csv=[h.join(","),...rows].join("\n"),a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download=`quixprint-companies-${today()}.csv`;a.click()}
function parseCSV(t) {
  let rows = [], r = [], c = "", quoted = false;

  for (let i = 0; i < t.length; i++) {
    let x = t[i], n = t[i + 1];

    if (x == '"' && quoted && n == '"') {
      c += '"';
      i++;
    } else if (x == '"') {
      quoted = !quoted;
    } else if (x == "," && !quoted) {
      r.push(c);
      c = "";
    } else if ((x == "\n" || x == "\r") && !quoted) {
      if (x == "\r" && n == "\n") i++;

      r.push(c);

      if (r.some(v => v.trim())) rows.push(r);

      r = [];
      c = "";
    } else {
      c += x;
    }
  }

  r.push(c);

  if (r.some(v => v.trim())) rows.push(r);

  return rows;
}

function norm(v) {
  return String(v || "").trim().toLowerCase();
}

function contactKey(c) {
  let email = norm(c.email || c.contact_email);

  if (email) {
    return `email:${email}`;
  }

  return `name:${norm(c.name || c.contact_name)}|title:${norm(
    c.title || c.contact_title
  )}`;
}

async function withRetry(fn, tries = 3) {
  let last;

  for (let i = 0; i < tries; i++) {
    let res = await fn();

    if (!res?.error) return res;

    last = res;

    if (i < tries - 1) {
      await new Promise(r => setTimeout(r, 500 * (i + 1)));
    }
  }

  return last;
}

async function importCSV(e) {
  let f = e.target.files[0];

  if (!f) return;

  let rows = parseCSV(await f.text());
  let h = rows[0]?.map(x => x.trim().toLowerCase());

  if (!h?.includes("company")) {
    return toast("CSV must include a company column.", true);
  }

  let data = rows
    .slice(1)
    .map((r, i) => ({
      ...Object.fromEntries(
        h.map((k, j) => [k, r[j]?.trim() || null])
      ),
      __row: i + 2
    }))
    .filter(x => x.company);

  let groups = {};

  data.forEach(r => {
    (groups[norm(r.company)] ??= []).push(r);
  });

  let importedCompanies = 0;
  let importedContacts = 0;
  let skippedContacts = 0;
  let failures = [];

  for (const group of Object.values(groups)) {
    let r = group[0];

    let payload = {
      workspace_id: S.workspace.id,
      name: r.company,
      website: r.website || null,
      industry: r.industry || null,
      location: r.location || null,

      stage: stages.includes(r.stage)
        ? r.stage
        : "New Lead",

      priority: ["Hot", "Warm", "Normal", "Low"].includes(r.priority)
        ? r.priority
        : "Normal",

      owner_id: S.user.id,
      source: r.source || null,
      products: r.products || null,

      estimated_value:
        r.estimated_value &&
        Number.isFinite(Number(r.estimated_value))
          ? Number(r.estimated_value)
          : null,

      last_contacted: r.last_contacted || null,
      next_follow_up: r.next_follow_up || null,
      opportunity_summary: r.opportunity_summary || null,
      notes: r.notes || null,
      updated_by: S.user.id
    };

    let { data: company, error } = await withRetry(() =>
      db
        .from("companies")
        .upsert(payload, {
          onConflict: "workspace_id,name"
        })
        .select()
        .single()
    );

    // IMPORTANT:
    // A failed company no longer kills the entire import.
    if (error) {
      failures.push(
        `Rows ${group.map(x => x.__row).join(", ")} ` +
        `(${r.company}): ${error.message}`
      );

      continue;
    }

    importedCompanies++;

    // Get contacts that already exist for this company.
    let {
      data: existing,
      error: existingError
    } = await withRetry(() =>
      db
        .from("contacts")
        .select(
          "id,name,title,email,phone,linkedin,is_primary"
        )
        .eq("workspace_id", S.workspace.id)
        .eq("company_id", company.id)
    );

    if (existingError) {
      failures.push(
        `Rows ${group.map(x => x.__row).join(", ")} ` +
        `(${r.company} contacts): ${existingError.message}`
      );

      continue;
    }

    // Build a list of contacts that already exist.
    let existingKeys = new Set(
      (existing || []).map(contactKey)
    );

    // Also prevent duplicate contacts within this CSV.
    let seenKeys = new Set();

    let contacts = [];

    for (const x of group.filter(x => x.contact_name)) {
      let c = {
        workspace_id: S.workspace.id,
        company_id: company.id,
        name: x.contact_name,
        title: x.contact_title || null,
        email: x.contact_email || null,
        phone: x.contact_phone || null,
        linkedin: x.contact_linkedin || null,

        is_primary:
          String(x.contact_primary).toLowerCase() === "true" ||
          x.contact_primary === "1"
      };

      let key = contactKey(c);

      // Don't re-add the 92 contacts that already imported.
      if (
        existingKeys.has(key) ||
        seenKeys.has(key)
      ) {
        skippedContacts++;
        continue;
      }

      seenKeys.add(key);
      contacts.push(c);
    }

    if (contacts.length) {
      let { error: ce } = await withRetry(() =>
        db.from("contacts").insert(contacts)
      );

      if (ce) {
        failures.push(
          `Rows ${group.map(x => x.__row).join(", ")} ` +
          `(${r.company} contacts): ${ce.message}`
        );

        continue;
      }

      importedContacts += contacts.length;
    }
  }

  // Reset the file input so the same CSV can be selected again.
  e.target.value = "";

  await loadAll();
  render();

  let msg =
    `Import complete: ` +
    `${importedCompanies} companies processed, ` +
    `${importedContacts} contacts added, ` +
    `${skippedContacts} duplicate contacts skipped.`;

  if (failures.length) {
    console.error("CSV import failures", failures);

    toast(
      `${msg} ${failures.length} company group(s) failed. ` +
      `Open the browser console for details.`,
      true
    );
  } else {
    toast(msg);
  }
}
init();
