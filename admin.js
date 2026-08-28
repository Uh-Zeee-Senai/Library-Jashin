let livros = [];
let editingId = null;

const db = window.supabaseClient;

const statusLabel = {
    lendo: '📖 Lendo',
    lido: '✅ Lido',
    quero_ler: '📕 Quero ler',
    pausado: '⏸️ Pausado',
    abandonado: '❌ Abandonado'
};

function esc(value) {
    const div = document.createElement('div');
    div.textContent = value ?? '';
    return div.innerHTML;
}

function notify(message) {
    const el = document.getElementById('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(window.__toastTimer);
    window.__toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

async function carregarLivros() {
    const { data, error } = await db.from('livros').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    livros = data || [];
    renderTudo();
}

function atualizarEstatisticas() {
    const total = livros.length;
    const lendo = livros.filter(l => l.status === 'lendo').length;
    const lidos = livros.filter(l => l.status === 'lido').length;
    const favoritos = livros.filter(l => l.favorito).length;
    const quero = livros.filter(l => l.status === 'quero_ler').length;
    const pausados = livros.filter(l => l.status === 'pausado').length;
    const paginas = livros.reduce((sum, l) => sum + Number(l.pagina_atual || 0), 0);
    const avaliados = livros.filter(l => Number(l.avaliacao) > 0);
    const media = avaliados.length ? (avaliados.reduce((sum, l) => sum + Number(l.avaliacao), 0) / avaliados.length).toFixed(1) : '—';

    setText('statTotal', total);
    setText('statLendo', lendo);
    setText('statLidos', lidos);
    setText('statFavoritos', favoritos);
    setText('statPages', paginas);
    setText('statWant', quero);
    setText('statPaused', pausados);
    setText('statRating', media === '—' ? '—' : `${media} ★`);

    const summary = document.getElementById('statusSummary');
    if (summary) {
        summary.innerHTML = Object.entries(statusLabel).map(([key, label]) => {
            const count = livros.filter(l => l.status === key).length;
            return `<div class="stat-card"><small>${label}</small><strong>${count}</strong></div>`;
        }).join('');
    }
}

function livroCard(livro) {
    const progresso = livro.paginas ? Math.min(100, Math.round((Number(livro.pagina_atual || 0) / Number(livro.paginas)) * 100)) : 0;
    const capa = livro.capa_url ? `<img src="${esc(livro.capa_url)}" alt="Capa de ${esc(livro.titulo)}" onerror="this.remove()">` : '📖';
    return `<article class="book-card"><div class="book-card-cover">${capa}</div><div class="book-card-body"><h3>${esc(livro.titulo)}</h3><p>${esc(livro.autor)}</p><span class="status-pill">${statusLabel[livro.status] || esc(livro.status)}</span>${livro.status === 'lendo' ? `<p style="margin-top:8px">Progresso: ${progresso}%</p>` : ''}</div></article>`;
}

function renderDashboard() {
    const container = document.getElementById('readingNow');
    if (!container) return;
    const atuais = livros.filter(l => l.status === 'lendo').slice(0, 4);
    container.innerHTML = atuais.length ? atuais.map(livroCard).join('') : '<div class="empty">Nenhum livro em leitura no momento.<br>Que tal começar uma nova jornada?</div>';
}

function renderTabela() {
    const wrap = document.getElementById('bookTableWrap');
    if (!wrap) return;
    if (!livros.length) {
        wrap.innerHTML = '<div class="empty">📚<br><br>Nenhum livro cadastrado ainda.</div>';
        return;
    }
    wrap.innerHTML = `<table class="book-table"><thead><tr><th>Capa</th><th>Livro</th><th>Gênero</th><th>Status</th><th>Nota</th><th>Ações</th></tr></thead><tbody>${livros.map(l => `<tr><td>${l.capa_url ? `<img class="book-cover-mini" src="${esc(l.capa_url)}" alt="">` : '📖'}</td><td><strong>${esc(l.titulo)}</strong><br><small>${esc(l.autor)}</small></td><td>${esc(l.genero || '—')}</td><td>${statusLabel[l.status] || esc(l.status)}</td><td>${l.avaliacao ? `${'★'.repeat(Number(l.avaliacao))}` : '—'}</td><td><div class="actions"><button class="icon-btn" onclick="editarLivro(${l.id})" title="Editar">✏️</button><button class="icon-btn delete" onclick="excluirLivro(${l.id})" title="Excluir">🗑️</button></div></td></tr>`).join('')}</tbody></table>`;
}

function renderTudo() {
    atualizarEstatisticas();
    renderDashboard();
    renderTabela();
}

function abrirModal(livro = null) {
    editingId = livro?.id || null;
    document.getElementById('modalTitle').textContent = livro ? 'Editar livro' : 'Adicionar livro';
    document.getElementById('bookId').value = livro?.id || '';
    document.getElementById('titulo').value = livro?.titulo || '';
    document.getElementById('autor').value = livro?.autor || '';
    document.getElementById('genero').value = livro?.genero || '';
    document.getElementById('anoPublicacao').value = livro?.ano_publicacao || '';
    document.getElementById('capaUrl').value = livro?.capa_url || '';
    document.getElementById('paginas').value = livro?.paginas || '';
    document.getElementById('paginaAtual').value = livro?.pagina_atual || 0;
    document.getElementById('status').value = livro?.status || 'quero_ler';
    document.getElementById('avaliacao').value = livro?.avaliacao || '';
    document.getElementById('resenha').value = livro?.resenha || '';
    document.getElementById('favorito').value = String(!!livro?.favorito);
    document.getElementById('bookModal').classList.add('show');
    document.getElementById('bookModal').setAttribute('aria-hidden', 'false');
    document.getElementById('titulo').focus();
}

function fecharModal() {
    document.getElementById('bookModal').classList.remove('show');
    document.getElementById('bookModal').setAttribute('aria-hidden', 'true');
    editingId = null;
}

async function salvarLivro(event) {
    event.preventDefault();
    const titulo = document.getElementById('titulo').value.trim();
    const autor = document.getElementById('autor').value.trim();
    if (!titulo || !autor) return notify('Título e autor são obrigatórios.');

    const paginas = Number(document.getElementById('paginas').value) || null;
    let paginaAtual = Number(document.getElementById('paginaAtual').value) || 0;
    if (paginas) paginaAtual = Math.min(Math.max(0, paginaAtual), paginas);

    const payload = {
        titulo,
        autor,
        genero: document.getElementById('genero').value || null,
        ano_publicacao: Number(document.getElementById('anoPublicacao').value) || null,
        capa_url: document.getElementById('capaUrl').value.trim() || null,
        paginas,
        pagina_atual: paginaAtual,
        status: document.getElementById('status').value,
        avaliacao: Number(document.getElementById('avaliacao').value) || null,
        resenha: document.getElementById('resenha').value.trim() || null,
        favorito: document.getElementById('favorito').value === 'true',
        updated_at: new Date().toISOString()
    };

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
        if (editingId) {
            const { error } = await db.from('livros').update(payload).eq('id', editingId);
            if (error) throw error;
            notify('Livro atualizado com sucesso!');
        } else {
            const { error } = await db.from('livros').insert(payload);
            if (error) throw error;
            notify('Livro adicionado à biblioteca!');
        }
        fecharModal();
        await carregarLivros();
    } catch (error) {
        console.error(error);
        notify('Não foi possível salvar o livro.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Salvar livro';
    }
}

window.editarLivro = id => {
    const livro = livros.find(l => l.id === id);
    if (livro) abrirModal(livro);
};

window.excluirLivro = async id => {
    const livro = livros.find(l => l.id === id);
    if (!livro || !confirm(`Excluir “${livro.titulo}”? Esta ação não pode ser desfeita.`)) return;
    const { error } = await db.from('livros').delete().eq('id', id);
    if (error) return notify('Não foi possível excluir o livro.');
    notify('Livro removido.');
    await carregarLivros();
};

function trocarView(view) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(`view-${view}`)?.classList.add('active');
    document.querySelectorAll('.side-nav button').forEach(el => el.classList.toggle('active', el.dataset.view === view));
    const titles = { dashboard: 'Dashboard', books: 'Biblioteca', stats: 'Estatísticas' };
    setText('viewTitle', titles[view] || 'Dashboard');
    document.getElementById('sidebar')?.classList.remove('open');
}

function configurarSidebar() {
    const layout = document.querySelector('.admin-layout');
    const collapseBtn = document.getElementById('collapseBtn');
    if (!layout || !collapseBtn) return;
    const salvo = localStorage.getItem('libraryJashinSidebar') === 'collapsed';
    layout.classList.toggle('sidebar-collapsed', salvo);
    collapseBtn.setAttribute('aria-expanded', String(!salvo));
    collapseBtn.title = salvo ? 'Expandir menu' : 'Recolher menu';
    collapseBtn.addEventListener('click', () => {
        const collapsed = layout.classList.toggle('sidebar-collapsed');
        localStorage.setItem('libraryJashinSidebar', collapsed ? 'collapsed' : 'expanded');
        collapseBtn.setAttribute('aria-expanded', String(!collapsed));
        collapseBtn.title = collapsed ? 'Expandir menu' : 'Recolher menu';
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    const session = await window.requireAdmin();
    if (!session) return;
    setText('userEmail', session.user.email || 'Administrador');
    configurarSidebar();

    document.querySelectorAll('.side-nav button').forEach(btn => btn.addEventListener('click', () => trocarView(btn.dataset.view)));
    document.getElementById('logoutBtn')?.addEventListener('click', window.logoutAdmin);
    document.getElementById('addBookBtn')?.addEventListener('click', () => abrirModal());
    document.getElementById('dashboardAddBtn')?.addEventListener('click', () => abrirModal());
    document.getElementById('cancelBtn')?.addEventListener('click', fecharModal);
    document.getElementById('bookForm')?.addEventListener('submit', salvarLivro);
    document.getElementById('menuBtn')?.addEventListener('click', () => document.getElementById('sidebar')?.classList.toggle('open'));
    document.getElementById('bookModal')?.addEventListener('click', e => { if (e.target.id === 'bookModal') fecharModal(); });

    try { await carregarLivros(); }
    catch (error) { console.error(error); notify('Não foi possível carregar a biblioteca.'); }
});