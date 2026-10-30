const $ = s => document.querySelector(s);
const ler = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
const salvar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { aviso('Sem espaço para salvar. Use fotos menores.'); } };
const hoje = () => new Date().toLocaleDateString('sv');
const dias = (a, b) => Math.round((Date.parse(a) - Date.parse(b)) / 864e5);
const planta = id => PLANTAS.find(p => p.id === id);
const b64 = u => btoa(String.fromCharCode(...u));
const un64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

function el(tag, cls, txt) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (txt != null) e.textContent = txt;
  return e;
}

function aviso(t) {
  const a = $('#aviso');
  a.textContent = t;
  a.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => { a.hidden = true; }, 3000);
}

function ir(nome) {
  document.querySelectorAll('.tela').forEach(t => t.classList.toggle('ativa', t.id === nome));
  window.scrollTo(0, 0);
}

let usuario, posts, minhas, atual, filtro = 'Tudo', estacao;

async function hash(senha, sal) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sal, iterations: 150000, hash: 'SHA-256' }, k, 256);
  return b64(new Uint8Array(b));
}

let cadastro = false;
function modo(c) {
  cadastro = c;
  $('#campo-nome').hidden = !c;
  $('#nome').required = c;
  $('#entrar').textContent = c ? 'Criar conta' : 'Entrar';
  $('#alternar').textContent = c ? 'Já tenho conta' : 'Criar conta';
  $('#senha').autocomplete = c ? 'new-password' : 'current-password';
  $('#erro-login').textContent = '';
}
$('#alternar').onclick = () => modo(!cadastro);

$('#form-login').onsubmit = async e => {
  e.preventDefault();
  const erro = $('#erro-login');
  const chave = 'u:' + $('#email').value.trim().toLowerCase();
  const senha = $('#senha').value;
  const contas = ler('contas', {});
  erro.textContent = '';
  if (!window.crypto?.subtle) return (erro.textContent = 'Abra o site em um endereço seguro (https ou localhost).');
  if (cadastro) {
    if (contas[chave]) return (erro.textContent = 'Este e-mail já tem conta.');
    const sal = crypto.getRandomValues(new Uint8Array(16));
    contas[chave] = { nome: $('#nome').value.trim(), sal: b64(sal), h: await hash(senha, sal) };
    salvar('contas', contas);
  } else {
    const c = contas[chave];
    if (!c || (await hash(senha, un64(c.sal))) !== c.h) return (erro.textContent = 'E-mail ou senha incorretos.');
  }
  sessionStorage.setItem('sessao', chave);
  $('#senha').value = '';
  iniciar();
};

function iniciar() {
  const chave = sessionStorage.getItem('sessao');
  const conta = ler('contas', {})[chave];
  if (!conta) return;
  usuario = conta.nome;
  posts = ler('posts', null) || POSTS_INICIAIS;
  minhas = ler('minhas:' + chave, []);
  minhas.chave = chave;
  estacao = estacaoAtual();
  $('#menu').hidden = false;
  renderFiltros();
  renderFeed();
  renderPlantas();
  renderGuia();
  ir('feed');
  checar();
}

$('#sair').onclick = () => {
  sessionStorage.removeItem('sessao');
  $('#form-login').reset();
  modo(false);
  $('#menu').hidden = true;
  ir('login');
};

document.querySelectorAll('[data-ir]').forEach(b => {
  b.onclick = () => {
    if (b.dataset.ir === 'feed') renderFeed();
    ir(b.dataset.ir);
  };
});

function midia(p) {
  if (p.img?.startsWith('data:image/jpeg')) {
    const i = el('img');
    i.src = p.img;
    i.alt = p.planta;
    return i;
  }
  const d = el('div', 'emoji', p.emoji);
  d.style.background = p.cor;
  d.style.height = (p.alt || 240) + 'px';
  return d;
}

function renderFiltros() {
  const box = $('#filtros');
  box.replaceChildren();
  ['Tudo', ...new Set(PLANTAS.map(p => p.tipo))].forEach(t => {
    const b = el('button', 'chip' + (t === filtro ? ' on' : ''), t);
    b.onclick = () => { filtro = t; renderFiltros(); renderFeed(); };
    box.append(b);
  });
}

function curtir(p) {
  p.curtiu = !p.curtiu;
  p.curtidas += p.curtiu ? 1 : -1;
  salvar('posts', posts);
}

function renderFeed() {
  const q = $('#busca').value.trim().toLowerCase();
  const g = $('#grade');
  g.replaceChildren();
  const lista = posts.filter(p => (filtro === 'Tudo' || planta(p.plantaId)?.tipo === filtro) && `${p.planta} ${p.texto} ${p.autor}`.toLowerCase().includes(q));
  if (!lista.length) g.append(el('p', 'sub', 'Nenhuma foto encontrada.'));
  lista.forEach(p => {
    const c = el('article', 'card');
    const m = el('button', 'midia');
    m.setAttribute('aria-label', 'Abrir ' + p.planta);
    m.append(midia(p));
    m.onclick = () => abrir(p.id);
    const info = el('div', 'info');
    const t = el('div');
    t.append(el('strong', null, p.planta), el('small', null, p.autor));
    const l = el('button', 'curtir', (p.curtiu ? '❤️ ' : '🤍 ') + p.curtidas);
    l.onclick = () => { curtir(p); renderFeed(); };
    info.append(t, l);
    c.append(m, info);
    g.append(c);
  });
}

$('#busca').oninput = renderFeed;

function abrir(id) {
  atual = posts.find(p => p.id === id);
  renderDetalhe();
  ir('detalhe');
}

function renderDetalhe() {
  const p = atual, pl = planta(p.plantaId);
  $('#det-midia').replaceChildren(midia(p));
  $('#det-titulo').textContent = p.planta;
  $('#det-autor').textContent = 'por ' + p.autor;
  $('#det-texto').textContent = p.texto;
  $('#det-curtir').textContent = (p.curtiu ? '❤️ ' : '🤍 ') + p.curtidas;
  const c = $('#det-cuidado');
  c.replaceChildren();
  if (pl) {
    c.append(el('strong', null, 'Como cuidar'));
    [`Luz: ${pl.luz}`, `Regar a cada ${pl.rega} dias, de manhã cedo ou no fim da tarde`, `Onde plantar: ${pl.vaso}`, `Estações: ${pl.est.join(', ')}`, pl.dica].forEach(t => c.append(el('p', null, t)));
  }
  const lista = $('#lista-com');
  lista.replaceChildren();
  if (!p.comentarios.length) lista.append(el('li', 'sub', 'Seja o primeiro a comentar.'));
  p.comentarios.forEach(x => {
    const li = el('li');
    li.append(el('strong', null, x.autor + ': '), document.createTextNode(x.texto));
    lista.append(li);
  });
}

$('#voltar').onclick = () => { renderFeed(); ir('feed'); };
$('#det-curtir').onclick = () => { curtir(atual); renderDetalhe(); };

$('#form-com').onsubmit = e => {
  e.preventDefault();
  const t = $('#comentario').value.trim().slice(0, 200);
  if (!t) return;
  atual.comentarios.push({ autor: usuario, texto: t });
  salvar('posts', posts);
  $('#comentario').value = '';
  renderDetalhe();
};

$('#det-baixar').onclick = () => {
  let url = atual.img?.startsWith('data:image/jpeg') ? atual.img : null;
  if (!url) {
    const c = document.createElement('canvas');
    c.width = c.height = 600;
    const x = c.getContext('2d');
    x.fillStyle = atual.cor;
    x.fillRect(0, 0, 600, 600);
    x.font = '260px serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(atual.emoji, 300, 300);
    url = c.toDataURL('image/png');
  }
  const a = el('a');
  a.href = url;
  a.download = `plant-${atual.id}.${url.startsWith('data:image/png') ? 'png' : 'jpg'}`;
  a.click();
};

$('#det-comp').onclick = async () => {
  const dados = { title: 'Plant+', text: `${atual.planta} no Plant+: ${atual.texto}` };
  try {
    if (navigator.share) await navigator.share(dados);
    else { await navigator.clipboard.writeText(dados.text); aviso('Texto copiado.'); }
  } catch { /* compartilhamento cancelado */ }
};

$('#post-planta').replaceChildren(...PLANTAS.map(p => Object.assign(el('option', null, p.nome), { value: p.id })));
$('#add-planta').replaceChildren(...PLANTAS.map(p => Object.assign(el('option', null, p.nome), { value: p.id })));

$('#form-post').onsubmit = async e => {
  e.preventDefault();
  const f = $('#foto').files[0];
  if (!f || !/^image\/(jpeg|png|webp)$/.test(f.type)) return aviso('Escolha uma foto JPG, PNG ou WebP.');
  if (f.size > 10e6) return aviso('A foto deve ter até 10 MB.');
  try {
    const bmp = await createImageBitmap(f);
    const r = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * r);
    c.height = Math.round(bmp.height * r);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const pl = planta($('#post-planta').value);
    posts.unshift({ id: Date.now(), autor: usuario, plantaId: pl.id, planta: pl.nome, texto: $('#post-texto').value.trim().slice(0, 200), img: c.toDataURL('image/jpeg', 0.8), curtidas: 0, curtiu: false, comentarios: [] });
    salvar('posts', posts);
    e.target.reset();
    filtro = 'Tudo';
    renderFiltros();
    renderFeed();
    ir('feed');
    aviso('Foto publicada.');
  } catch {
    aviso('Não foi possível ler essa foto.');
  }
};

const restam = m => planta(m.id).rega - dias(hoje(), m.ultima);

function salvarMinhas() {
  salvar('minhas:' + minhas.chave, minhas);
}

function renderPlantas() {
  const pend = minhas.filter(m => restam(m) <= 0);
  $('#banner').textContent = pend.length ? `Rega pendente: ${pend.length} planta(s). Melhor horário: antes das 9h ou depois das 17h.` : 'Nenhuma rega pendente hoje.';
  $('#banner').classList.toggle('alerta', pend.length > 0);
  document.querySelector('[data-ir=plantas]').dataset.n = pend.length || '';
  const l = $('#lista-plantas');
  l.replaceChildren();
  if (!minhas.length) l.append(el('li', 'sub', 'Adicione as plantas que você cultiva para receber avisos de rega.'));
  minhas.forEach((m, i) => {
    const pl = planta(m.id), r = restam(m);
    const li = el('li', 'item');
    const t = el('div');
    t.append(el('strong', null, `${pl.emoji} ${pl.nome}`), el('small', null, r <= 0 ? 'Regar hoje' : `Próxima rega em ${r} dia(s)`));
    const ok = el('button', 'btn pequeno', 'Reguei');
    ok.onclick = () => { m.ultima = hoje(); salvarMinhas(); renderPlantas(); };
    const rm = el('button', 'btn claro pequeno', 'Remover');
    rm.onclick = () => { minhas.splice(i, 1); salvarMinhas(); renderPlantas(); };
    li.append(t, ok, rm);
    l.append(li);
  });
}

$('#add-btn').onclick = () => {
  const id = $('#add-planta').value;
  if (minhas.some(m => m.id === id)) return aviso('Você já adicionou essa planta.');
  minhas.push({ id, ultima: '1970-01-01' });
  salvarMinhas();
  renderPlantas();
};

$('#notif').onclick = async () => {
  if (!('Notification' in window)) return aviso('Este navegador não suporta notificações.');
  aviso((await Notification.requestPermission()) === 'granted' ? 'Notificações ativadas.' : 'Notificações bloqueadas.');
};

function checar() {
  if (!minhas) return;
  renderPlantas();
  const agora = new Date().toTimeString().slice(0, 5);
  if (!('Notification' in window) || Notification.permission !== 'granted' || agora < $('#hora').value) return;
  minhas.filter(m => restam(m) <= 0 && m.avisada !== hoje()).forEach(m => {
    new Notification('Hora de regar: ' + planta(m.id).nome, { body: 'Melhor horário: antes das 9h ou depois das 17h.' });
    m.avisada = hoje();
  });
  salvarMinhas();
}

setInterval(checar, 60000);

function estacaoAtual() {
  const m = new Date().getMonth();
  return m === 11 || m < 2 ? 'verão' : m < 5 ? 'outono' : m < 8 ? 'inverno' : 'primavera';
}

function renderGuia() {
  const box = $('#estacoes');
  box.replaceChildren();
  TODAS.forEach(s => {
    const b = el('button', 'chip' + (s === estacao ? ' on' : ''), s);
    b.onclick = () => { estacao = s; renderGuia(); };
    box.append(b);
  });
  const l = $('#guia-lista');
  l.replaceChildren();
  PLANTAS.filter(p => p.est.includes(estacao)).forEach(p => {
    const li = el('li', 'item');
    const t = el('div');
    t.append(el('strong', null, `${p.emoji} ${p.nome}`), el('small', null, `${p.luz} · regar a cada ${p.rega} dias`), el('small', null, p.dica));
    li.append(t);
    l.append(li);
  });
  $('#dicas').replaceChildren(...DICAS.map(d => el('li', null, d)));
}

if (sessionStorage.getItem('sessao')) iniciar();
