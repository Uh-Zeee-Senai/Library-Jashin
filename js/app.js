const config = window.SUPABASE_CONFIG || {};
const db = window.supabaseClient || window.supabase?.createClient(config.url, config.anonKey);
let livros = [];
let filtroAtual = 'todos';
let buscaAtual = '';
let ordenacaoAtual = 'recent';

function esc(value) { const div = document.createElement('div'); div.textContent = value ?? ''; return div.innerHTML; }
function percentual(livro) { const paginas = Number(livro.paginas || 0); const atual = Number(livro.pagina_atual || 0); return paginas > 0 ? Math.min(100, Math.round((atual / paginas) * 100)) : 0; }
function statusTexto(status) { return { lendo:'📖 Lendo', lido:'✅ Lido', quero_ler:'📕 Quero ler', pausado:'⏸️ Pausado', abandonado:'❌ Abandonado' }[status] || status; }
function formatarData(data) { if (!data) return ''; return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(new Date(data)); }
function mostrarErro(container,texto) { if (container) container.innerHTML=`<div class="empty-public">⚠️<br><br>${esc(texto)}</div>`; }
function setText(id,value) { const el=document.getElementById(id); if(el) el.textContent=value; }
function renderStats() { setText('statTotal',livros.length); setText('statLendo',livros.filter(l=>l.status==='lendo').length); setText('statLidos',livros.filter(l=>l.status==='lido').length); setText('statFavoritos',livros.filter(l=>l.favorito).length); }
function filtrarLivros() {
  const termo=buscaAtual.toLocaleLowerCase('pt-BR');
  return livros.filter(l=>{ const busca=!termo||[l.titulo,l.autor,l.genero].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(termo)); const filtro=filtroAtual==='todos'||(filtroAtual==='favoritos'?!!l.favorito:l.status===filtroAtual); return busca&&filtro; }).sort((a,b)=>{
    if(ordenacaoAtual==='title') return String(a.titulo).localeCompare(String(b.titulo),'pt-BR');
    if(ordenacaoAtual==='author') return String(a.autor).localeCompare(String(b.autor),'pt-BR');
    if(ordenacaoAtual==='rating') return Number(b.avaliacao||0)-Number(a.avaliacao||0);
    if(ordenacaoAtual==='progress') return percentual(b)-percentual(a);
    return new Date(b.created_at||0)-new Date(a.created_at||0);
  });
}
function estrelas(nota) { const n=Math.max(0,Math.min(5,Number(nota||0))); return n?`<span class="rating" aria-label="${n} de 5 estrelas">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span>`:''; }
function livroCard(l) {
  const capa=l.capa_url?`<img src="${esc(l.capa_url)}" alt="Capa de ${esc(l.titulo)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`:'📖';
  const p=percentual(l);
  return `<article class="book"><div class="cover">${capa}<span class="favorite" title="${l.favorito?'Favorito':'Não favoritado'}">${l.favorito?'♥':'♡'}</span></div><h3>${esc(l.titulo)}</h3><p>${esc(l.autor)}</p><div class="meta"><span class="chip">${esc(statusTexto(l.status))}</span>${l.genero?`<span class="chip">${esc(l.genero)}</span>`:''}</div>${l.avaliacao?`<div style="margin-top:8px">${estrelas(l.avaliacao)}</div>`:''}${l.status==='lendo'&&l.paginas?`<b>Progresso: ${p}%</b><div class="progress"><span style="width:${p}%"></span></div>`:''}<button class="btn btn-secondary" style="width:100%;margin-top:5px" type="button" data-book-id="${Number(l.id)}">Ver detalhes</button></article>`;
}
function renderLivros() {
  const container=document.getElementById('bookList'); if(!container)return; const resultado=filtrarLivros(); setText('bookCount',`${resultado.length} ${resultado.length===1?'livro':'livros'}`); container.innerHTML=resultado.length?resultado.map(livroCard).join(''):'<div class="empty-public">📚<br><br>Nenhum livro encontrado com esses filtros.</div>'; container.querySelectorAll('[data-book-id]').forEach(btn=>btn.addEventListener('click',()=>abrirDetalhes(Number(btn.dataset.bookId))));
}
function abrirDetalhes(id) {
  const livro=livros.find(l=>Number(l.id)===id), modal=document.getElementById('detailModal'), content=document.getElementById('detailContent'); if(!livro||!modal||!content)return;
  const capa=livro.capa_url?`<img src="${esc(livro.capa_url)}" alt="Capa de ${esc(livro.titulo)}">`:'📖';
  content.innerHTML=`<div class="detail-head"><div class="detail-cover">${capa}</div><div><span class="eyebrow">DETALHES DA OBRA</span><h2>${esc(livro.titulo)}</h2><p><strong>${esc(livro.autor)}</strong></p>${livro.genero?`<span class="chip">${esc(livro.genero)}</span>`:''}<p>${esc(statusTexto(livro.status))}${livro.ano_publicacao?` · ${esc(livro.ano_publicacao)}`:''}</p>${livro.avaliacao?`<div>${estrelas(livro.avaliacao)}</div>`:''}</div></div>${livro.resenha?`<p style="margin-top:20px"><strong>Sobre a leitura</strong><br>${esc(livro.resenha)}</p>`:''}${livro.paginas?`<p><strong>Progresso:</strong> ${percentual(livro)}% (${Number(livro.pagina_atual||0)} de ${Number(livro.paginas)} páginas)</p>`:''}<small>Adicionado em ${esc(formatarData(livro.created_at))}</small>`;
  modal.classList.add('show'); modal.setAttribute('aria-hidden','false');
}
function fecharDetalhes() { const modal=document.getElementById('detailModal'); if(!modal)return; modal.classList.remove('show'); modal.setAttribute('aria-hidden','true'); }
async function carregarLivros() { const container=document.getElementById('bookList'); if(!db)return mostrarErro(container,'Configuração do Supabase não encontrada.'); const {data,error}=await db.from('livros').select('*').order('created_at',{ascending:false}); if(error)throw error; livros=data||[]; renderStats(); renderLivros(); }
let deferredInstallPrompt=null;
function configurarPwa() { window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;const btn=document.getElementById('installBtn');if(btn)btn.hidden=false;}); document.getElementById('installBtn')?.addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;document.getElementById('installBtn').hidden=true;}); }
document.addEventListener('DOMContentLoaded',async()=>{
  document.querySelectorAll('#filterTabs .tab').forEach(tab=>tab.addEventListener('click',()=>{document.querySelectorAll('#filterTabs .tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');filtroAtual=tab.dataset.filter;renderLivros();}));
  document.getElementById('searchInput')?.addEventListener('input',e=>{buscaAtual=e.target.value.trim();renderLivros();}); document.getElementById('sortSelect')?.addEventListener('change',e=>{ordenacaoAtual=e.target.value;renderLivros();}); document.getElementById('detailClose')?.addEventListener('click',fecharDetalhes); document.getElementById('detailModal')?.addEventListener('click',e=>{if(e.target.id==='detailModal')fecharDetalhes();}); document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharDetalhes();}); configurarPwa(); try{await carregarLivros();}catch(error){console.error(error);mostrarErro(document.getElementById('bookList'),'Não foi possível carregar a biblioteca.');}
});
