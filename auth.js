/* ============================================================
   LIBRARY JASHIN
   AUTENTICAÇÃO
   ============================================================ */


// ============================================================
// CONFIGURAÇÃO
// ============================================================

const supabaseClient = window.supabase.createClient(
    window.SUPABASE_CONFIG.url,
    window.SUPABASE_CONFIG.anonKey
);


// ============================================================
// ELEMENTOS
// ============================================================

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");

const togglePasswordBtn = document.getElementById("togglePassword");

const forgotPasswordBtn =
    document.getElementById("forgotPasswordBtn");

const recoveryModal =
    document.getElementById("recoveryModal");

const recoveryForm =
    document.getElementById("recoveryForm");

const recoveryEmail =
    document.getElementById("recoveryEmail");

const recoveryBtn =
    document.getElementById("recoveryBtn");

const recoveryMessage =
    document.getElementById("recoveryMessage");

const closeRecoveryBtn =
    document.getElementById("closeRecoveryBtn");


// ============================================================
// MENSAGENS
// ============================================================

function showLoginMessage(message, type = "error") {

    if (!loginMessage) {
        return;
    }

    loginMessage.textContent = message;

    loginMessage.className =
        `login-message show ${type}`;
}


function showRecoveryMessage(message, type = "error") {

    if (!recoveryMessage) {
        return;
    }

    recoveryMessage.textContent = message;

    recoveryMessage.className =
        `login-message show ${type}`;
}


function clearRecoveryMessage() {

    if (!recoveryMessage) {
        return;
    }

    recoveryMessage.textContent = "";

    recoveryMessage.className =
        "login-message";

}


// ============================================================
// TRADUÇÃO DE ERROS DO SUPABASE
// ============================================================

function translateAuthError(error) {

    if (!error) {
        return "Ocorreu um erro inesperado.";
    }

    const message =
        (error.message || "").toLowerCase();


    if (
        message.includes("invalid login credentials")
        ||
        message.includes("invalid credentials")
    ) {
        return "E-mail ou senha incorretos.";
    }


    if (message.includes("email not confirmed")) {

        return (
            "Este e-mail ainda não foi confirmado. " +
            "Verifique sua caixa de entrada."
        );

    }


    if (message.includes("too many requests")) {

        return (
            "Muitas tentativas. " +
            "Aguarde alguns minutos e tente novamente."
        );

    }


    if (message.includes("network")) {

        return (
            "Não foi possível conectar ao servidor. " +
            "Verifique sua internet."
        );

    }


    return error.message ||
        "Não foi possível realizar a operação.";
}


// ============================================================
// VERIFICAR SE USUÁRIO É ADMINISTRADOR
// ============================================================

async function isAdmin(userId) {

    if (!userId) {
        return false;
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("admin_users")
        .select("user_id")
        .eq("user_id", userId)
        .maybeSingle();


    if (error) {

        console.error(
            "Erro ao verificar administrador:",
            error
        );

        return false;

    }


    return !!data;
}


// ============================================================
// VERIFICAR SESSÃO
// ============================================================

async function checkExistingSession() {

    const {
        data,
        error
    } = await supabaseClient.auth.getSession();


    if (error) {

        console.error(
            "Erro ao verificar sessão:",
            error
        );

        return;

    }


    const session = data.session;


    if (!session) {
        return;
    }


    const user = session.user;


    const admin = await isAdmin(user.id);


    if (admin) {

        window.location.href =
            "admin.html";

        return;

    }


    // Usuário autenticado mas não administrador.
    await supabaseClient.auth.signOut();

    showLoginMessage(
        "Esta conta não possui acesso administrativo."
    );
}


// ============================================================
// LOGIN
// ============================================================

async function handleLogin(event) {

    event.preventDefault();


    const email =
        emailInput.value.trim();

    const password =
        passwordInput.value;


    if (!email || !password) {

        showLoginMessage(
            "Preencha o e-mail e a senha."
        );

        return;

    }


    loginBtn.disabled = true;

    loginBtn.textContent =
        "Entrando...";


    try {

        const {
            data,
            error
        } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });


        if (error) {
            throw error;
        }


        if (!data.user) {

            throw new Error(
                "Não foi possível identificar o usuário."
            );

        }


        const admin =
            await isAdmin(data.user.id);


        if (!admin) {

            await supabaseClient.auth.signOut();

            throw new Error(
                "Esta conta não possui acesso administrativo."
            );

        }


        showLoginMessage(
            "Login realizado! Redirecionando...",
            "success"
        );


        setTimeout(() => {

            window.location.href =
                "admin.html";

        }, 500);


    } catch (error) {

        console.error(
            "Erro no login:",
            error
        );


        showLoginMessage(
            translateAuthError(error)
        );


        loginBtn.disabled = false;

        loginBtn.textContent =
            "🔐 Entrar";

    }
}


// ============================================================
// MOSTRAR / ESCONDER SENHA
// ============================================================

function togglePassword() {

    const isPassword =
        passwordInput.type === "password";


    passwordInput.type =
        isPassword
            ? "text"
            : "password";


    togglePasswordBtn.textContent =
        isPassword
            ? "🙈"
            : "👁️";


    togglePasswordBtn.setAttribute(
        "aria-label",
        isPassword
            ? "Ocultar senha"
            : "Mostrar senha"
    );
}


// ============================================================
// ABRIR RECUPERAÇÃO
// ============================================================

function openRecoveryModal() {

    clearRecoveryMessage();


    recoveryEmail.value =
        emailInput.value.trim();


    recoveryModal.classList.add("show");

    recoveryModal.setAttribute(
        "aria-hidden",
        "false"
    );


    setTimeout(() => {

        recoveryEmail.focus();

    }, 100);

}


// ============================================================
// FECHAR RECUPERAÇÃO
// ============================================================

function closeRecoveryModal() {

    recoveryModal.classList.remove("show");

    recoveryModal.setAttribute(
        "aria-hidden",
        "true"
    );

}


// ============================================================
// RECUPERAR SENHA
// ============================================================

async function handlePasswordRecovery(event) {

    event.preventDefault();


    const email =
        recoveryEmail.value.trim();


    if (!email) {

        showRecoveryMessage(
            "Digite o e-mail da sua conta."
        );

        return;

    }


    recoveryBtn.disabled = true;

    recoveryBtn.textContent =
        "Enviando...";


    clearRecoveryMessage();


    try {

        /*
         * IMPORTANTE:
         *
         * O endereço abaixo deve ser uma URL
         * válida do seu projeto publicado.
         *
         * Durante o desenvolvimento usamos
         * window.location.origin.
         */

        const redirectUrl =
            `${window.location.origin}/reset-password.html`;


        const {
            error
        } = await supabaseClient.auth.resetPasswordForEmail(
            email,
            {
                redirectTo: redirectUrl
            }
        );


        if (error) {
            throw error;
        }


        /*
         * Não informamos se o e-mail existe ou não.
         * Isso evita revelar quais endereços possuem
         * contas administrativas.
         */

        showRecoveryMessage(
            "Se este e-mail possuir uma conta, " +
            "enviamos um link de recuperação para ele.",
            "success"
        );


        recoveryBtn.textContent =
            "📧 Link enviado";


        setTimeout(() => {

            closeRecoveryModal();

            recoveryBtn.disabled = false;

            recoveryBtn.textContent =
                "📧 Enviar link";

        }, 4000);


    } catch (error) {

        console.error(
            "Erro na recuperação:",
            error
        );


        showRecoveryMessage(
            translateAuthError(error)
        );


        recoveryBtn.disabled = false;

        recoveryBtn.textContent =
            "📧 Enviar link";

    }

}


// ============================================================
// EVENTOS
// ============================================================

if (loginForm) {

    loginForm.addEventListener(
        "submit",
        handleLogin
    );

}


if (togglePasswordBtn) {

    togglePasswordBtn.addEventListener(
        "click",
        togglePassword
    );

}


if (forgotPasswordBtn) {

    forgotPasswordBtn.addEventListener(
        "click",
        openRecoveryModal
    );

}


if (closeRecoveryBtn) {

    closeRecoveryBtn.addEventListener(
        "click",
        closeRecoveryModal
    );

}


if (recoveryForm) {

    recoveryForm.addEventListener(
        "submit",
        handlePasswordRecovery
    );

}


// Fechar clicando fora do modal

if (recoveryModal) {

    recoveryModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                recoveryModal
            ) {

                closeRecoveryModal();

            }

        }
    );

}


// ============================================================
// INICIALIZAÇÃO
// ============================================================

checkExistingSession();