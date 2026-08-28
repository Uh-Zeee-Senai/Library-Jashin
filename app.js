if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}

const LEGACY_STORAGE_KEY = 'patrimonios';
let ordensServico = [];
let supabaseClient = null;

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;

    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.hidden = false;
    }
});

//CARREGANDO
document.addEventListener('DOMContentLoaded', async () => {
    const config = window.SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey || !window.supabase) {
        mostrarErroDeConfiguracao();
        return;
    }

    supabaseClient = window.supabase.createClient(config.url, config.anonKey);

    try {
        await carregarOrdensServico();
        renderizarOrdensServico();
    } catch (error) {
        tratarErro('Não foi possível carregar as ordens de serviço.', error);
        return;
    }

    document.getElementById('ordemServicoForm').addEventListener('submit', adicionarOrdemServico);

    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (!deferredPrompt) return;

            deferredPrompt.prompt();
            await deferredPrompt.userChoice;
            deferredPrompt = null;
            installBtn.hidden = true;
        });
    }
});

/**
 * Carrega ordens de serviço do Supabase
 */
async function carregarOrdensServico() {
    const { data, error } = await supabaseClient
        .from('ordens_servico')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;
    ordensServico = data || [];
    await migrarDadosLegadosSeNecessario();
}

async function migrarDadosLegadosSeNecessario() {
    if (ordensServico.length > 0) return;

    const dadosLegados = localStorage.getItem(LEGACY_STORAGE_KEY);
    const patrimoniosLegados = dadosLegados ? JSON.parse(dadosLegados) : [];
    if (patrimoniosLegados.length === 0) return;

    const ordensLegadas = patrimoniosLegados.map(patrimonio => ({
        numero: patrimonio.numero,
        solicitante: 'Não informado',
        descricao: patrimonio.descricao,
        status: patrimonio.conferido ? 'concluida' : 'aberta'
    }));

    const { data, error } = await supabaseClient
        .from('ordens_servico')
        .insert(ordensLegadas)
        .select('*');

    if (error) throw error;
    ordensServico = data || [];
    localStorage.removeItem(LEGACY_STORAGE_KEY);
}


/**
 * Renderiza a lista de ordens de serviço
 */
function renderizarOrdensServico() {
    const lista = document.getElementById('ordemServicoList');

    if (ordensServico.length === 0) {
        lista.innerHTML = '<p class="empty-message">Nenhuma ordem de serviço registrada.</p>';
        return;
    }

    lista.innerHTML = ordensServico.map(ordem => `
        <div class="ordem-servico-item">
            <strong>${escapeHtml(ordem.numero)}</strong>
            <span class="status status-${ordem.status}">${ordem.status === 'concluida' ? 'Concluída' : 'Aberta'}</span>
            <p><b>Solicitante:</b> ${escapeHtml(ordem.solicitante)}</p>
            <p>${escapeHtml(ordem.descricao)}</p>
            <div class="ordem-servico-actions">
                <button class="btn btn-check ${ordem.status === 'concluida' ? 'checked' : ''}" onclick="alternarStatus(${ordem.id})">
                    ${ordem.status === 'concluida' ? 'Reabrir' : 'Concluir'}
                </button>
                <button class="btn btn-delete" onclick="deletarOrdemServico(${ordem.id})">Remover</button>
            </div>
        </div>
    `).join('');
}


/**
 * Alterna a visibilidade da seção de formulário
 */
function toggleFormSection() {
    const formSection = document.getElementById('formSection');
    formSection.classList.toggle('visible');

    if (formSection.classList.contains('visible')) {
        document.getElementById('numeroOrdem').focus();
    }
}

/**
 * Mostrar notificação temporária
 */
function mostrarNotificacao(mensagem) {
    const el = document.createElement('div');
    el.textContent = mensagem;
    el.className = 'toast';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
}


/**
 * Adiciona nova ordem de serviço
 */
async function adicionarOrdemServico(e) {
    e.preventDefault();
    
    const numeroOrdem = document.getElementById('numeroOrdem').value.trim();
    const solicitante = document.getElementById('solicitante').value.trim();
    const descricao = document.getElementById('descricao').value.trim();
    
    if (!numeroOrdem || !solicitante || !descricao) {
        alert('Por favor, preencha todos os campos');
        return;
    }
    
    // Verificar duplicatas
    if (ordensServico.some(ordem => ordem.numero === numeroOrdem)) {
        alert('Já existe uma ordem de serviço com este número!');
        return;
    }
    
    const novaOrdem = {
        numero: numeroOrdem,
        solicitante: solicitante,
        descricao: descricao,
        status: 'aberta'
    };

    const { data, error } = await supabaseClient
        .from('ordens_servico')
        .insert(novaOrdem)
        .select('*')
        .single();

    if (error) {
        tratarErro('Não foi possível salvar a ordem de serviço.', error);
        return;
    }

    ordensServico.unshift(data);
    
    // Limpar formulário
    document.getElementById('ordemServicoForm').reset();
    
    // Fechar formulário
    toggleFormSection();
    
    // Renderizar
    renderizarOrdensServico();
    
    
    // Feedback visual
    mostrarNotificacao('Ordem de serviço adicionada com sucesso!', 'success');
}


/**
 * Alterna o status da ordem de serviço
 */
async function alternarStatus(id) {
    const ordem = ordensServico.find(item => item.id === id);
    if (ordem) {
        const novoStatus = ordem.status === 'concluida' ? 'aberta' : 'concluida';
        const { error } = await supabaseClient
            .from('ordens_servico')
            .update({ status: novoStatus })
            .eq('id', id);

        if (error) {
            tratarErro('Não foi possível atualizar o status da ordem.', error);
            return;
        }

        ordem.status = novoStatus;
        renderizarOrdensServico();
                
        const status = ordem.status === 'concluida' ? 'concluída' : 'reaberta';
        mostrarNotificacao('Ordem de serviço ${status}!', 'success');
    }
}

/**
 * Deleta uma ordem de serviço
 */
async function deletarOrdemServico(id) {
    if (confirm('Tem certeza que deseja remover esta ordem de serviço?')) {
        const { error } = await supabaseClient
            .from('ordens_servico')
            .delete()
            .eq('id', id);

        if (error) {
            tratarErro('Não foi possível remover a ordem de serviço.', error);
            return;
        }

        ordensServico = ordensServico.filter(ordem => ordem.id !== id);
        renderizarOrdensServico();
        
        mostrarNotificacao('Ordem de serviço removida com sucesso!', 'success');
    }
}

function mostrarErroDeConfiguracao() {
    document.getElementById('ordemServicoList').innerHTML =
        '<p class="empty-message">Configure o Supabase em supabase-config.js para carregar as ordens.</p>';
    document.getElementById('ordemServicoForm').querySelectorAll('input, button').forEach(elemento => {
        elemento.disabled = true;
    });
}

function tratarErro(mensagem, error) {
    console.error(mensagem, error);
    mostrarNotificacao(mensagem);
}


/**
 * Escapa caracteres HTML para evitar XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}