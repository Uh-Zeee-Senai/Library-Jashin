let livros = [];
let filtroAtual = 'todos';
let buscaAtual = '';
let ordenacaoAtual = 'recent';
let deferredPrompt = null;

const config = window.SUPABASE_CONFIG || {};
const supabaseClient = window.supabase?.createClient(config.url, config.anonKey);

const statusLabel = { lendo:'📖 Lendo', lido:'✅ Lido', quero_ler:'📕 Quero ler', pausado:'⏸️ Pausado', abandonado:'❌ Abandonado' };

function esc(value){ const d=document.createElement('div'); d.textContent=value ?? ''; return d.innerHTML; }
function progresso(l){ return l.paginas ? Math.min(100,Math.round((Number(l.pagina_atual||0)/Number(l.paginas))*100)) : 0; }

window.addEventListener('beforeinstallprompt', e=>{ e.preventDefault(); deferredPrompt=e; const b=document.getElementById('installBtn'); if(b)b.hidden=false; });

async function carregarLivros(){
    if(!supabaseClient) throw new Error('Supabase não configurado.');
    const {data,error}=await supabaseClient.from('livros').select('*').order('created_at',{ascending:false});
    if(error) throw error;
    livros=data||[];
    renderizar();
}

function renderizar(){
    const total=livros.length, lendo=livros.filter(l=>l.status==='lendo').length, lidos=livros.filter(l=>l.status==='lido').length, favoritos=livros.filter(l=>l.favorito).length;
    document.getElementById('statTotal').textContent=total;
    document.getElementById('statLendo').textContent=lendo;
    document.getElementById('statLidos').textContent=lidos;
    document.getElementById('statFavoritos').textContent=favoritos;

    let lista=livros.filter(l=>{
        const texto=`${l.titulo||''} ${l.autor||''}`.toLowerCase();
        const bateBusca=!buscaAtual || texto.includes(buscaAtual);
        const bateFiltro=filtroAtual==='todos' || (filtroAtual==='favoritos'?!!l.favorito:l.status===filtroAtual);
        return bateBusca && bateFiltro;
    });
    lista.sort((a,b)=>{
        if(ordenacaoAtual==='title') return (a.titulo||'').localeCompare(b.titulo||'','pt-BR');
        if(ordenacaoAtual==='author') return (a.autor||'').localeCompare(b.autor||'','pt-BR');
        if(ordenacaoAtual==='rating') return Number(b.avaliacao||0)-Number(a.avaliacao||0);
        if(ordenacaoAtual==='progress') return progresso(b)-progresso(a);
        return new Date(b.created_at||0)-new Date(a.created_at||0);
    });

    const count=document.getElementById('bookCount');
    count.textContent=`${lista.length} ${lista.length===1?'livro':'livros'}`;
    const grid=document.getElementById('bookList');
    if(!lista.length){ grid.innerHTML='<div class="empty-public">🔎<br><br>Nenhum livro encontrado com esses filtros.</div>'; return; }
    grid.innerHTML=lista.map(l=>{
        const p=progresso(l);
        const capa=l.capa_url?`<img src="${esc(l.capa_url)}" alt="Capa de ${esc(l.titulo)}" onerror="this.style.display='none'">`:'📖';
        const rating=l.avaliacao?`<span class="rating">${'★'.repeat(Number(l.avaliacao))}${'☆'.repeat(5-Number(l.avaliacao))}</span>`:'';
        return `<article class="book"><div class="cover">${capa}${l.favorito?'<span class="favorite">♥</span>':''}</div><h3>${esc(l.titulo)}</h3><p>${esc(l.autor)}</p><div class="meta"><span class="chip">${statusLabel[l.status]||esc(l.status)}</span>${l.genero?`<span class="chip">${esc(l.genero)}</span>`:''}</div>${rating?`<b>${rating}</b>`:''}${l.status==='lendo'&&l.paginas?`<small>Progresso · ${p}%</small><div class="progress"><span style="width:${p}%"></span></div>`:''}<button class="btn btn-secondary" type="button" onclick="abrirDetalhes(${l.id})">Ver detalhes</button></article>`;
    }).join('');
}

function abrirDetalhes(id){
    const l=livros.find(x=>x.id===id); if(!l)return;
    const p=progresso(l);
    const capa=l.capa_url?`<img src="${esc(l.capa_url)}" alt="Capa de ${esc(l.titulo)}">`:'📖';
    document.getElementById('detailContent').innerHTML=`<div class="detail-head"><div class="detail-cover">${capa}</div><div><span class="eyebrow">${statusLabel[l.status]||''}</span><h2>${esc(l.titulo)}</h2><strong>${esc(l.autor)}</strong>${l.genero?`<p>Gênero: ${esc(l.genero)}</p>`:''}${l.ano_publicacao?`<p>Ano: ${esc(l.ano_publicacao)}</p>`:''}${l.paginas?`<p>${esc(l.paginas)} páginas · ${p}% concluído</p>`:''}${l.avaliacao?`<p class="rating">${'★'.repeat(Number(l.avaliacao))}${'☆'.repeat(5-Number(l.avaliacao))}</p>`:''}</div></div>${l.resenha?`<div style="margin-top:20px"><span class="eyebrow">RESENHA</span><p>${esc(l.resenha)}</p></div>`:''}`;
    const m=document.getElementById('detailModal'); m.classList.add('show'); m.setAttribute('aria-hidden','false');
}
window.abrirDetalhes=abrirDetalhes;
function fecharDetalhes(){const m=document.getElementById('detailModal');m.classList.remove('show');m.setAttribute('aria-hidden','true');}

document.addEventListener('DOMContentLoaded',async()=>{
    document.getElementById('searchInput')?.addEventListener('input',e=>{buscaAtual=e.target.value.trim().toLowerCase();renderizar();});
    document.getElementById('sortSelect')?.addEventListener('change',e=>{ordenacaoAtual=e.target.value;renderizar();});
    document.querySelectorAll('#filterTabs .tab').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('#filterTabs .tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');filtroAtual=b.dataset.filter;renderizar();}));
    document.getElementById('detailClose')?.addEventListener('click',fecharDetalhes);
    document.getElementById('detailModal')?.addEventListener('click',e=>{if(e.target.id==='detailModal')fecharDetalhes();});
    document.getElementById('installBtn')?.addEventListener('click',async()=>{if(!deferredPrompt)return;deferredPrompt.prompt();await deferredPrompt.userChoice;deferredPrompt=null;document.getElementById('installBtn').hidden=true;});
    try{await carregarLivros();}catch(error){console.error(error);document.getElementById('bookList').innerHTML='<div class="empty-public">⚠️<br><br>Não foi possível carregar a biblioteca.</div>';}
});