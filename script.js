// ============================================================
//  ContrataAí — script.js v2
//  Integrações: Supabase · EmailJS · Z-API · Analytics
// ============================================================

// ─── CONFIGURAÇÃO ───────────────────────────────────────────
const CONFIG = {
  // ── Supabase ──
  supabaseUrl:    "https://aqwpmqdswyiscepaacuk.supabase.co",
  supabaseKey:    "sb_publishable_xgGqMTHhWfZ31kZ5BSIG9A_joxYc7Ah",

  // ── EmailJS ──
  emailjsPublicKey:              "x-OcKyorGmWywSP4D",
  emailjsServiceId:              "service_awz6mxl",
  emailjsTemplateIdCliente:      "template_nrzmg5c",
  emailjsTemplateIdProfissional: "template_nrzmg5c",
  emailDestino:                  "contrataai00@gmail.com",

  // ── Z-API ──
  zapiInstanceId:  "ZAPI_INSTANCE_ID",     // ex: 3D123ABC456...
  zapiToken:       "ZAPI_TOKEN",           // token do Security
  zapiClientToken: "ZAPI_CLIENT_TOKEN",    // client-token do painel
  whatsappAdmin:   "5599981748640",        // número que vai receber (DDI+DDD+número)

  // ── Admin ──
  adminPassword: "ContrataAi@2026",        // troque por uma senha forte

  // ── Google Analytics ──
  gaId: "G-XXXXXXXXXX"                     // substitua pelo seu Measurement ID
};

// ─── SUPABASE ────────────────────────────────────────────────
let supabase = null;

async function initSupabase() {
  if (CONFIG.supabaseUrl === "SUPABASE_URL") return null; // não configurado ainda

  const { createClient } = supabaseLib;
  supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  return supabase;
}

async function salvarNoSupabase(tipo, dados) {
  if (!supabase) return { ok: false, erro: "Supabase não configurado" };

  const tabela = tipo === "Cliente" ? "leads_clientes" : "leads_profissionais";

  const payload = {
    nome:        dados.nome,
    whatsapp:    dados.whatsapp,
    cidade:      dados.cidade,
    tipo,
    lgpd_aceito: true,
    criado_em:   new Date().toISOString(),
  };

  if (tipo === "Cliente") {
    payload.servico = dados.servico;
    payload.bairro  = dados.bairro  || null;
    payload.prazo   = dados.prazo   || null;
  }
  if (tipo === "Profissional") {
    payload.area            = dados.area;
    payload.bairros         = dados.bairros         || null;
    payload.atende_urgencia = dados.atende_urgencia  || null;
    payload.mei             = dados.mei              || null;
    payload.tem_fotos       = dados.tem_fotos        || null;
    payload.experiencia     = dados.experiencia      || null;
  }

  const { error } = await supabase.from(tabela).insert([payload]);
  return error ? { ok: false, erro: error.message } : { ok: true };
}

// ─── EMAIL (EmailJS) ─────────────────────────────────────────
function initEmailJS() {
  if (CONFIG.emailjsPublicKey === "EMAILJS_PUBLIC_KEY") return;
  emailjs.init(CONFIG.emailjsPublicKey);
}

async function enviarEmail(tipo, dados) {
  if (CONFIG.emailjsPublicKey === "EMAILJS_PUBLIC_KEY") return { ok: false };

  const templateId = tipo === "Cliente"
    ? CONFIG.emailjsTemplateIdCliente
    : CONFIG.emailjsTemplateIdProfissional;

  // Parâmetros nomeados para bater com os campos do template EmailJS
  const params = {
    to_email:          CONFIG.emailDestino,
    tipo_cadastro:     tipo,
    nome:              dados.nome              || "-",
    whatsapp:          dados.whatsapp          || "-",
    cidade:            dados.cidade            || "-",
    bairro:            dados.bairro            || dados.bairros || "-",
    servico_interesse: dados.servico           || "-",
    area_atuacao:      dados.area              || "-",
    mensagem:          dados.experiencia       || "-",
    status:            "novo",
    data_cadastro:     new Date().toLocaleString("pt-BR"),
  };

  try {
    await emailjs.send(CONFIG.emailjsServiceId, templateId, params);
    return { ok: true };
  } catch (err) {
    console.error("EmailJS erro:", err);
    return { ok: false, erro: err };
  }
}

// ─── WHATSAPP (Z-API) ─────────────────────────────────────────
async function enviarWhatsAppZAPI(tipo, dados) {
  if (CONFIG.zapiInstanceId === "ZAPI_INSTANCE_ID") return { ok: false };

  const mensagem = buildWhatsAppMessage(tipo, dados);
  const url = `https://api.z-api.io/instances/${CONFIG.zapiInstanceId}/token/${CONFIG.zapiToken}/send-text`;

  try {
    const res = await fetch(url, {
      method:  "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token":  CONFIG.zapiClientToken,
      },
      body: JSON.stringify({
        phone:   CONFIG.whatsappAdmin,
        message: mensagem,
      }),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, erro: json };
  } catch (err) {
    console.error("Z-API erro:", err);
    return { ok: false, erro: err };
  }
}

// ─── ANALYTICS ───────────────────────────────────────────────
function trackEvent(eventName, params = {}) {
  if (typeof gtag === "function") {
    gtag("event", eventName, params);
  }
}

// ─── LOCALSTORAGE (fallback) ──────────────────────────────────
function salvarLocalStorage(tipo, dados) {
  const key  = "contrataai_leads";
  const lista = JSON.parse(localStorage.getItem(key) || "[]");
  lista.push({ tipo, ...dados, createdAt: new Date().toISOString() });
  localStorage.setItem(key, JSON.stringify(lista));
}

// ─── MENSAGEM WHATSAPP ────────────────────────────────────────
function buildWhatsAppMessage(tipo, dados) {
  const linhas = [
    "🚀 *Novo cadastro no ContrataAí*",
    "",
    `*Tipo:* ${tipo}`,
    `*Nome:* ${dados.nome || "-"}`,
    `*WhatsApp:* ${dados.whatsapp || "-"}`,
    `*Cidade:* ${dados.cidade || "-"}`,
  ];

  if (dados.bairro) linhas.push(`*Bairro:* ${dados.bairro}`);
  if (dados.bairros) linhas.push(`*Bairros onde atende:* ${dados.bairros}`);

  if (tipo === "Cliente") {
    linhas.push(`*Serviço:* ${dados.servico || "-"}`);
    if (dados.prazo) linhas.push(`*Quando gostaria de usar:* ${dados.prazo}`);
  }

  if (tipo === "Profissional") {
    linhas.push(`*Área:* ${dados.area || "-"}`);
    if (dados.atende_urgencia) linhas.push(`*Atende urgência:* ${dados.atende_urgencia}`);
    if (dados.mei) linhas.push(`*MEI/CNPJ:* ${dados.mei}`);
    if (dados.tem_fotos) linhas.push(`*Tem fotos de serviços:* ${dados.tem_fotos}`);
    linhas.push(`*Experiência:* ${dados.experiencia || "-"}`);
  }

  linhas.push("", `*Data:* ${new Date().toLocaleString("pt-BR")}`);
  return linhas.join("\n");
}

// ─── TOAST ───────────────────────────────────────────────────
const toast = document.querySelector("#toast");

function showToast(msg, tipo = "success") {
  toast.textContent = msg;
  toast.className   = `toast show ${tipo}`;
  setTimeout(() => toast.classList.remove("show"), 5000);
}

// ─── FORMULÁRIO ──────────────────────────────────────────────
function getFormData(form) {
  const fd   = new FormData(form);
  const data = {};
  for (const [k, v] of fd.entries()) data[k] = String(v).trim();
  return data;
}

async function handleSubmit(event) {
  event.preventDefault();

  const form          = event.currentTarget;
  const btn           = form.querySelector("[type=submit]");
  const tipo          = form.dataset.formType;
  const dados         = getFormData(form);
  const textoOriginal = btn.textContent;

  btn.disabled    = true;
  btn.textContent = "Enviando…";

  // 1. Salvar local (fallback sempre garantido)
  salvarLocalStorage(tipo, dados);

  // 2. Supabase primeiro — é o canal principal
  const resultDB = await salvarNoSupabase(tipo, dados);
  console.log("Supabase:", resultDB);

  // 3. E-mail e WhatsApp somente se Supabase ok (ou se não estiver configurado ainda)
  const supabaseOk = resultDB.ok || CONFIG.supabaseUrl === "SUPABASE_URL";

  let resultEmail = { ok: false };
  let resultWA    = { ok: false };

  if (supabaseOk) {
    [resultEmail, resultWA] = await Promise.all([
      enviarEmail(tipo, dados),
      enviarWhatsAppZAPI(tipo, dados),
    ]);
    console.log("Email:",    resultEmail);
    console.log("WhatsApp:", resultWA);
  }

  // 4. Analytics
  trackEvent("form_submit", { form_type: tipo, cidade: dados.cidade });

  // 5. Feedback
  showToast("✅ Cadastro registrado! Em breve você receberá novidades.");

  form.reset();
  btn.disabled    = false;
  btn.textContent = textoOriginal;
}

// ─── MENU MOBILE ─────────────────────────────────────────────
const menuButton = document.querySelector("#menuButton");
const navLinks   = document.querySelector("#navLinks");

menuButton?.addEventListener("click", (e) => {
  e.stopPropagation();
  navLinks.classList.toggle("open");
});

document.addEventListener("click", (e) => {
  if (navLinks?.classList.contains("open") && !navLinks.contains(e.target)) {
    navLinks.classList.remove("open");
  }
});

navLinks?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => navLinks.classList.remove("open"));
});

// ─── INIT ────────────────────────────────────────────────────
(async () => {
  initEmailJS();
  await initSupabase();
  document.querySelectorAll("form[data-form-type]").forEach((form) => {
    form.addEventListener("submit", handleSubmit);
  });
})();
