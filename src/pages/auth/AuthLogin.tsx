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
    return <div className="login-loading">Carregando...</div>;
  }

  // Usuário autenticado
  if (session) {
    return (
      <>
        {children}

        <button onClick={logout}>Sair</button>
      </>
    );
  }

  // Tela de login
  return (
    <main className="flex min-h-screen w-full flex-col items-center justify-center gap-12 bg-[#F5EAC6] px-6 py-12 lg:flex-row lg:items-center lg:justify-between lg:px-16">
      {/* Coluna esquerda */}
      <div className="flex w-full max-w-xl flex-col items-center text-center lg:items-start lg:text-left">
        {/* Logo — placeholder, trocar por <img src="/logo.svg" /> */}

        <div>
          <span
          style={{ fontFamily: '"Fraunces", serif' }}
            className="mb-5 font-serif text-4xl font-bold leading-[1.08]
         text-[#2E5A3B] lg:text-5xl
         "
          >
            O sabor começa
          </span>
          <br />
          <span style={{ fontFamily: '"Fraunces", serif' }} className="text-[#7C1F1F] text-4xl lg:text-5xl">
            na conta certa.
          </span>
        </div>

        <p className="mb-16 font-serif text-lg italic text-[#2E5A3B]">
          Custos claros para decisões mais gostosas.
        </p>
      </div>

      {/* Card de login */}
      <form
        onSubmit={login}
        className="flex w-full max-w-[560px] flex-col rounded-[28px] border border-[#ECDFB0] bg-[#FBF4DE] px-8 py-10 shadow-[0_30px_60px_rgba(70,40,10,0.08)] sm:px-14 sm:py-12"
      >
        {/* Mini logo — placeholder */}
        <div className="mb-7 flex justify-center">
          <div className="flex h-[100px] w-full items-center justify-center ">
            <img
              src="/logo.png"
              alt=""
              className="h-[90px] w-[200px]  object-contain"
            />
          </div>
        </div>

        <span className="mb-1.5 text-center font-serif text-2xl font-bold text-[#1F4A2E] sm:text-left">
          Bem-vindo de volta
        </span>

        <p className="mb-7 text-center text-sm text-[#2E5A3B] sm:text-left">
          Acesse a operação da Della Nonna.
        </p>

        <label
          htmlFor="email"
          className="mb-5 block font-mono text-xs font-bold uppercase tracking-widest text-[#1F4A2E]"
        >
          E-mail
          <span className="relative mt-2 block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[15px] text-[#2E5A3B]">
              ✉
            </span>
            <input
              id="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="exemplo@email.com"
              autoComplete="email"
              required
              className="h-[52px] w-full rounded-xl border border-[#E6D9A6] bg-[#F7EDCB] pl-11 pr-4 text-sm font-normal normal-case tracking-normal text-[#1F4A2E] placeholder:text-[#A49B83] focus:border-[#C4272A] focus:outline-none"
            />
          </span>
        </label>

        <label
          htmlFor="password"
          className="mb-6 block font-mono text-xs font-bold uppercase tracking-widest text-[#1F4A2E]"
        >
          Senha
          <span className="relative mt-2 block">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] text-[#2E5A3B]">
              🔒
            </span>
            <input
              id="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="h-[52px] w-full rounded-xl border border-[#E6D9A6] bg-[#F7EDCB] pl-11 pr-11 text-sm font-normal normal-case tracking-normal text-[#1F4A2E] placeholder:text-[#A49B83] focus:border-[#C4272A] focus:outline-none"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#2E5A3B] opacity-70">
              👁
            </span>
          </span>
        </label>

        {loginError && (
          <div
            role="alert"
            className="-mt-2 mb-4 rounded-lg bg-[#FBE4E0] px-3.5 py-2.5 text-[13px] text-[#A4291F]"
          >
            {loginError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#8C1D1D] text-sm font-semibold text-[#FDF6E3] transition-colors hover:bg-[#741616] disabled:cursor-not-allowed disabled:opacity-70"
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

        <div className="relative mt-7 pt-6 text-center">
          <span className="absolute inset-x-0 top-0 h-px bg-[#E6D9A6]" />
          <span className="absolute left-1/2 -top-2.5 -translate-x-1/2 bg-[#FBF4DE] px-2 text-[13px]">
            🍅
          </span>
          <small className="text-[13px] text-[#8C8674]">
            Área restrita para administradores
          </small>
        </div>
      </form>
    </main>
  );
}
