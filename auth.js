const config = window.SUPABASE_CONFIG || {};
const supabaseClient = window.supabase?.createClient(config.url, config.anonKey);

function showMessage(element, message, type = 'error') {
    if (!element) return;
    element.textContent = message;
    element.className = `login-message show ${type}`;
}

function translateAuthError(error) {
    const message = (error?.message || '').toLowerCase();
    if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (message.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
    if (message.includes('too many requests')) return 'Muitas tentativas. Aguarde alguns minutos.';
    return error?.message || 'Não foi possível realizar a operação.';
}

async function isAdmin(userId) {
    if (!userId || !supabaseClient) return false;
    const { data, error } = await supabaseClient
        .from('admin_users')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle();
    if (error) {
        console.error('Erro ao verificar administrador:', error);
        return false;
    }
    return !!data;
}

async function ensureAdminSession() {
    if (!supabaseClient) return null;
    const { data } = await supabaseClient.auth.getSession();
    const session = data?.session;
    if (!session) return null;
    if (!(await isAdmin(session.user.id))) {
        await supabaseClient.auth.signOut();
        return null;
    }
    return session;
}

async function requireAdmin() {
    const session = await ensureAdminSession();
    if (!session) {
        window.location.replace('login.html');
        return null;
    }
    return session;
}

async function logoutAdmin() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    window.location.replace('login.html');
}

async function handleLogin(event) {
    event.preventDefault();
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;
    const btn = document.getElementById('loginBtn');
    const message = document.getElementById('loginMessage');

    if (!email || !password) {
        showMessage(message, 'Preencha o e-mail e a senha.');
        return;
    }
    if (!supabaseClient) {
        showMessage(message, 'Configuração do Supabase não encontrada.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Entrando...';

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (!(await isAdmin(data.user.id))) {
            await supabaseClient.auth.signOut();
            throw new Error('Esta conta não possui acesso administrativo.');
        }
        showMessage(message, 'Login realizado! Abrindo dashboard...', 'success');
        setTimeout(() => window.location.replace('admin.html'), 500);
    } catch (error) {
        console.error(error);
        showMessage(message, translateAuthError(error));
        btn.disabled = false;
        btn.textContent = '🔐 Entrar';
    }
}

async function handlePasswordRecovery(event) {
    event.preventDefault();
    const email = document.getElementById('recoveryEmail')?.value.trim();
    const btn = document.getElementById('recoveryBtn');
    const message = document.getElementById('recoveryMessage');
    if (!email) {
        showMessage(message, 'Digite o e-mail da sua conta.');
        return;
    }
    btn.disabled = true;
    btn.textContent = 'Enviando...';
    try {
        const redirectUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '')}/reset-password.html`;
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: redirectUrl });
        if (error) throw error;
        showMessage(message, 'Se este e-mail possuir uma conta, enviamos o link de recuperação para ele.', 'success');
        setTimeout(() => closeRecoveryModal(), 3500);
    } catch (error) {
        console.error(error);
        showMessage(message, translateAuthError(error));
    } finally {
        btn.disabled = false;
        btn.textContent = '📧 Enviar link';
    }
}

function openRecoveryModal() {
    const modal = document.getElementById('recoveryModal');
    const recoveryEmail = document.getElementById('recoveryEmail');
    const email = document.getElementById('email');
    const message = document.getElementById('recoveryMessage');
    if (!modal) return;
    if (email && recoveryEmail) recoveryEmail.value = email.value.trim();
    if (message) message.className = 'login-message';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    recoveryEmail?.focus();
}

function closeRecoveryModal() {
    const modal = document.getElementById('recoveryModal');
    if (!modal) return;
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
}

document.addEventListener('DOMContentLoaded', async () => {
    if (!supabaseClient) return;

    const loginForm = document.getElementById('loginForm');
    const recoveryForm = document.getElementById('recoveryForm');
    loginForm?.addEventListener('submit', handleLogin);
    recoveryForm?.addEventListener('submit', handlePasswordRecovery);
    document.getElementById('forgotPasswordBtn')?.addEventListener('click', openRecoveryModal);
    document.getElementById('closeRecoveryBtn')?.addEventListener('click', closeRecoveryModal);
    document.getElementById('togglePassword')?.addEventListener('click', () => {
        const input = document.getElementById('password');
        input.type = input.type === 'password' ? 'text' : 'password';
    });

    if (loginForm) {
        const session = await ensureAdminSession();
        if (session) window.location.replace('admin.html');
    }
});

window.supabaseClient = supabaseClient;
window.isAdmin = isAdmin;
window.requireAdmin = requireAdmin;
window.logoutAdmin = logoutAdmin;
