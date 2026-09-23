import { useEffect, useState, FormEvent, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";

interface AuthLoginProps {
  children?: ReactNode;
}

export default function AuthLogin({ children }: AuthLoginProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [session, setSession] = useState(false);
  const [loading, setLoading] = useState(true);


  const supabase = publicSupabase;

  // Verifica se já existe uma sessão
  useEffect(() => {
    const checkSession = async () => {
      if (!supabase) {
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setSession(!!session);
      setLoading(false);
    };

    checkSession();

    // Monitora login/logout
    if (supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(!!session);
      });

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setLoginError("");

    if (!email || !password) {
      setLoginError("Preencha e-mail e senha para entrar.");
      return;
    }

    setLoading(true);

    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setLoginError("E-mail ou senha inválidos.");
          return;
        }

        setSession(true);
      } else {
        // Fallback para desenvolvimento sem Supabase
        setSession(true);
      }
    } catch (error) {
      console.error("Erro ao realizar login:", error);
      setLoginError("Ocorreu um erro ao tentar entrar.");
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }

      setSession(false);
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error("Erro ao sair:", error);
    }
  };

  // Enquanto verifica a sessão
  if (loading) {
    return (
      <div className="login-loading">
        Carregando...
      </div>
    );
  }

  // Usuário autenticado
  if (session) {
    return (
      <>
        {children}

        <button onClick={logout}>
          Sair
        </button>
      </>
    );
  }

  // Tela de login
  return (
    <main className="login-page">
      <div className="login-art">
        <div className="brand-mark">
          <span>DN</span>
        </div>

        <p className="eyebrow">GESTÃO INTERNA</p>

        <h1>
          O sabor começa
          <br />
          <em>na conta certa.</em>
        </h1>

        <p className="login-note">
          Custos claros para decisões mais gostosas.
        </p>

        <div className="login-stamp">
          EST. 2018 <span>•</span> RECIFE, PE
        </div>
      </div>

      <form className="login-card" onSubmit={login}>
        <div className="login-header">
          <div className="mini-logo">DN</div>
          <span>PAINEL ADMIN</span>
        </div>

        <h2>Bem-vindo de volta</h2>

        <p>Acesse a operação da Della Nonna.</p>

        <label htmlFor="email">
          E-mail

          <input
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            placeholder="admin@dellanonna.com"
            autoComplete="email"
            required
          />
        </label>

        <label htmlFor="password">
          Senha

          <input
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </label>

        {loginError && (
          <div className="error-message" role="alert">
            {loginError}
          </div>
        )}

        <button
          type="submit"
          className="primary-button login-button"
          disabled={loading}
        >
          {loading ? (
            "Entrando..."
          ) : (
            <>
              Entrar no painel
              <ArrowRight size={16} />
            </>
          )}
        </button>

        <small>
          Área restrita para administradores
        </small>
      </form>
    </main>
  );
}