const firebaseConfig = {
  apiKey: "AIzaSyBaqROPsywPgtKjQU7cs1ke1WaqDFhWwn0",
  authDomain: "sistema-gw-36566.firebaseapp.com",
  projectId: "sistema-gw-36566",
  storageBucket: "sistema-gw-36566.firebasestorage.app",
  messagingSenderId: "472820177992",
  appId: "1:472820177992:web:2e1b98c9f6ac3a823d0c7d"
};

const VERSAO = "2.7";
document.getElementById("versao-app").textContent = "v" + VERSAO;

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function ordemServico(nome) {
  const n = (nome || "").toLowerCase();
  if (n.includes("tratamento"))                         return 0;
  if (n.includes("pasta"))                              return 1;
  if (n.includes("emassamento") || n.includes("massa")) return 2;
  if (n.includes("textura"))                            return 3;
  return 99;
}

function nomeAbrev(nome) {
  const n = (nome || "").toLowerCase();
  if (n.includes("tratamento")) return "Tratamento";
  if (n.includes("pasta"))      return "Gesso";
  if (n.includes("emassamento") || n.includes("massa")) return "Massa";
  if (n.includes("textura"))    return "Textura";
  return (nome || "").substring(0, 10);
}

function parseId(id) {
  const m = id.match(/^([A-Z]+)(\d+)$/);
  return m ? { block: m[1], num: parseInt(m[2]) } : null;
}

// Agrupa locais por bloco e pavimento
function groupByBloco(data) {
  const blocos = {};
  data.forEach(local => {
    const parsed = parseId(local.identificacao);
    if (!parsed) return;
    const { block, num } = parsed;
    if (!blocos[block]) blocos[block] = { ground: {}, upper: {} };
    if (num >= 100) blocos[block].upper[num - 100] = local;
    else            blocos[block].ground[num]       = local;
  });
  return blocos;
}

// Monta colunas: par (ímpar=topo, par=base), do maior para o menor
function buildCols(wing) {
  const nums = Object.keys(wing).map(Number);
  if (!nums.length) return [];
  const maxNum    = Math.max(...nums);
  const highOdd   = maxNum % 2 === 0 ? maxNum - 1 : maxNum;
  const cols = [];
  for (let odd = highOdd; odd >= 1; odd -= 2) {
    cols.push({ odd, even: odd + 1, oddLocal: wing[odd], evenLocal: wing[odd + 1] });
  }
  return cols;
}

function renderAptCell(local) {
  if (!local) return `<div class="apt-vazio"></div>`;
  const numPart = local.identificacao.replace(/^[A-Z]+/, "");
  const servs   = [...(local.servicos || [])].sort((a, b) => ordemServico(a.nome) - ordemServico(b.nome));
  return `
    <div class="apt-cell">
      <div class="apt-header">Apt: ${escHtml(numPart)}</div>
      ${servs.map(s =>
        `<div class="apt-serv ${s.status}"
              data-apt="${escHtml(local.identificacao)}"
              data-nome="${escHtml(s.nome)}"
              data-status="${s.status}"
              data-executor="${escHtml((s.executor && s.executor.nome) || '')}"
              data-valor="${s.valorPago || ''}"
              data-data="${escHtml(s.dataPagamento || '')}"
              onclick="verServico(this)">${nomeAbrev(s.nome)}</div>`
      ).join("")}
    </div>`;
}

function verServico(el) {
  const metaVP = document.querySelector('meta[name=viewport]');
  metaVP.setAttribute('content', 'width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover');

  const apt      = el.dataset.apt;
  const nome     = el.dataset.nome;
  const status   = el.dataset.status;
  const executor = el.dataset.executor;
  const valor    = el.dataset.valor;
  const data     = el.dataset.data;

  const fmtValor = v => v ? "R$ " + parseFloat(v).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "—";

  let html = `
    <div class="info-row"><span class="info-label">Apt</span><span>${escHtml(apt)}</span></div>
    <div class="info-row"><span class="info-label">Serviço</span><span>${escHtml(nome)}</span></div>
    <div class="info-row"><span class="info-label">Status</span><span class="info-status ${status}">${status === "concluido" ? "Concluído ✓" : "Pendente"}</span></div>`;
  if (status === "concluido") {
    html += `
    <div class="info-row"><span class="info-label">Executor</span><span>${escHtml(executor) || "—"}</span></div>
    <div class="info-row"><span class="info-label">Data</span><span>${escHtml(data) || "—"}</span></div>
    <div class="info-row"><span class="info-label">Valor pago</span><span>${fmtValor(valor)}</span></div>`;
  }

  document.getElementById("info-conteudo").innerHTML = html;
  requestAnimationFrame(() => {
    document.getElementById("modal-info").style.display = "flex";
  });
}

function fecharInfo() {
  document.getElementById("modal-info").style.display = "none";
  const metaVP = document.querySelector('meta[name=viewport]');
  metaVP.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function renderWing(cols) {
  const n = cols.length;
  return `
    <div class="wing" style="grid-template-columns:repeat(${n},30px)">
      ${cols.map(c => renderAptCell(c.oddLocal)).join("")}
      ${cols.map(c => renderAptCell(c.evenLocal)).join("")}
    </div>`;
}

function render(data) {
  const blocos = groupByBloco(data);
  const letras = Object.keys(blocos).sort();

  if (!letras.length) {
    document.getElementById("mapa").innerHTML =
      '<p class="empty">Nenhum local cadastrado.</p>';
    return;
  }

  document.getElementById("mapa").innerHTML = letras.map(letra => {
    const { ground, upper } = blocos[letra];
    const gCols = buildCols(ground);
    const uCols = buildCols(upper);
    return `
      <div class="bloco">
        <div class="bloco-label">BLOCO ${letra}</div>
        <div class="bloco-body">
          ${gCols.length ? renderWing(gCols) : ""}
          ${uCols.length ? `<div class="corredor"></div>${renderWing(uCols)}` : ""}
        </div>
      </div>`;
  }).join("");
}

db.collection("locais").orderBy("identificacao", "asc").onSnapshot(snap => {
  render(snap.docs.map(d => ({ id: d.id, ...d.data() })));
}, err => {
  console.error(err);
  document.getElementById("mapa").innerHTML =
    '<p class="empty">Erro ao conectar.</p>';
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
