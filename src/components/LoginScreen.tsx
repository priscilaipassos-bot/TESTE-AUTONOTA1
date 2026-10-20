import React, { useState } from 'react';
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowRight,
} from 'lucide-react';
import { authService } from '../services/authService';

interface LoginScreenProps {
  onLoginSuccess: (email: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [mode, setMode] = useState<'LOGIN' | 'CHANGE_PASSWORD'>('LOGIN');

  // Form states
  const [email, setEmail] = useState('priscilaipassos@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Troca de senha
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [showNovaSenha, setShowNovaSenha] = useState(false);

  // Feedback states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Submit de Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      const res = await authService.login(email, password);
      if (res.sucesso) {
        if (res.precisaTrocarSenha) {
          setMode('CHANGE_PASSWORD');
          setNovaSenha('');
          setConfirmarSenha('');
          setSuccessMsg('Acesso inicial validado! Por favor, cadastre sua nova senha pessoal.');
        } else {
          onLoginSuccess(email.trim().toLowerCase());
        }
      } else {
        setErrorMsg(res.mensagem || 'E-mail ou senha incorretos.');
      }
    } catch (err: any) {
      setErrorMsg(`Erro de autenticação: ${err.message || 'Falha ao conectar'}`);
    } finally {
      setLoading(false);
    }
  };

  // Submit de Troca Obrigatória de Senha
  const handleChangePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (novaSenha.length < 6) {
      setErrorMsg('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErrorMsg('A confirmação não coincide com a nova senha digitada.');
      return;
    }

    if (novaSenha === 'senha1') {
      setErrorMsg('A nova senha não pode ser a senha padrão inicial (senha1).');
      return;
    }

    setLoading(true);
    try {
      const res = await authService.changePassword(novaSenha, confirmarSenha);
      if (res.sucesso) {
        setSuccessMsg('Senha definitiva cadastrada com sucesso no Supabase! Entrando...');
        setTimeout(() => {
          onLoginSuccess(email.trim().toLowerCase());
        }, 1200);
      } else {
        setErrorMsg(res.mensagem);
      }
    } catch (err: any) {
      setErrorMsg(`Erro ao salvar nova senha: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Header institucional */}
        <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-6 text-center relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-blue-600 text-white font-mono font-bold text-lg shadow-md mb-3 border border-blue-400/30">
            NF
          </div>
          <h1 className="text-xl font-bold tracking-tight">AutoNFS-e Federal</h1>
          <p className="text-xs text-blue-200 mt-1">
            Sistema de Emissão & Automação Inteligente de Notas Fiscais
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950/60 border border-blue-400/30 text-[11px] text-blue-200 font-mono">
            <Database className="w-3 h-3 text-emerald-400" />
            <span>Autenticação Integrada ao Supabase</span>
          </div>
        </div>

        {/* Formulário Principal */}
        <div className="p-6 sm:p-8 space-y-5">
          {mode === 'LOGIN' ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    E-mail de Acesso:
                  </label>
                  <span className="text-[10.5px] text-blue-600 font-medium">Usuário Autorizado</span>
                </div>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="priscilaipassos@gmail.com"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Senha de Acesso:
                  </label>
                  <span className="text-[10.5px] text-slate-500">Padrão inicial: senha1</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Opção Manter Conectado */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600">
                  <input
                    type="checkbox"
                    defaultChecked
                    disabled
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>Permanecer conectado até clicar em "Sair"</span>
                </label>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Validando no Supabase...</span>
                  </>
                ) : (
                  <>
                    <span>Entrar no Sistema</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-600 space-y-1">
                <span className="font-semibold block text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Acesso Seguro Restrito</span>
                </span>
                <p>
                  Credencial inicial padrão: <strong>priscilaipassos@gmail.com</strong> / <strong>senha1</strong>.
                  No primeiro acesso, o sistema exigirá o cadastro de sua senha pessoal definitiva.
                </p>
              </div>
            </form>
          ) : (
            /* TELA DE ALTERAÇÃO OBRIGATÓRIA DE SENHA (PRIMEIRO ACESSO) */
            <form onSubmit={handleChangePasswordSubmit} className="space-y-4">
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 space-y-1">
                <div className="font-bold flex items-center gap-1.5 text-xs text-amber-900">
                  <KeyRound className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Primeiro Acesso: Defina sua Nova Senha</span>
                </div>
                <p className="text-[11px] text-amber-900 leading-relaxed">
                  Por motivos de segurança, altere sua senha de acesso inicial para o e-mail{' '}
                  <strong>{email}</strong>.
                </p>
                <p className="text-[10.5px] text-slate-600">
                  A nova senha será salva diretamente no banco do Supabase e você usará ela nos próximos acessos.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Nova Senha Definitiva:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNovaSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={novaSenha}
                    onChange={(e) => setNovaSenha(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full pl-9 pr-10 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNovaSenha(!showNovaSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  >
                    {showNovaSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-[10.5px] text-slate-500 mt-1 block">
                  Deve ter pelo menos 6 dígitos e ser diferente de "senha1".
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Confirmar Nova Senha:
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showNovaSenha ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={confirmarSenha}
                    onChange={(e) => setConfirmarSenha(e.target.value)}
                    placeholder="Digite a mesma senha novamente"
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                  />
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed font-medium">{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || novaSenha.length < 6 || novaSenha !== confirmarSenha}
                className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Salvando no Supabase...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Salvar Nova Senha e Acessar Sistema</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('LOGIN');
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="w-full text-center text-xs text-slate-500 hover:text-slate-800 py-1 transition-colors cursor-pointer"
              >
                Voltar para tela de login
              </button>
            </form>
          )}
        </div>

        {/* Rodapé de Segurança */}
        <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>Ambiente Seguro SSL</span>
          <span>Sessão Mantida Localmente</span>
        </div>
      </div>
    </div>
  );
};
