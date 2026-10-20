import React from 'react';
import { PlusCircle, Settings, RefreshCw, LogOut, User, Cloud } from 'lucide-react';

export type NavTab = 'dashboard' | 'schedules' | 'invoices' | 'clients';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenEmitNow: () => void;
  onOpenSettings: () => void;
  isRobotRunning?: boolean;
  onTriggerRobot?: () => void;
  userEmail?: string;
  onLogout?: () => void;
  onSyncCloud?: () => void;
  isSyncingCloud?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenEmitNow,
  onOpenSettings,
  isRobotRunning,
  onTriggerRobot,
  userEmail,
  onLogout,
  onSyncCloud,
  isSyncingCloud,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Zone 1: Brand title, one line */}
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('dashboard');
            }}
            className="text-lg font-bold tracking-tight text-slate-950 flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-xs shadow-xs">
              NF
            </div>
            <span>AutoNFS-e Federal</span>
          </a>
          <span className="hidden lg:inline text-xs text-slate-500 font-mono">
            API Notaas
          </span>
        </div>

        {/* Zone 2: 4 nav links, 1-2 word labels, single-line */}
        <nav className="hidden md:flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => onSelectTab('dashboard')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              currentTab === 'dashboard'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Visão Geral
          </button>

          <button
            onClick={() => onSelectTab('schedules')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              currentTab === 'schedules'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Agendamentos
          </button>

          <button
            onClick={() => onSelectTab('invoices')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              currentTab === 'invoices'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Notas Emitidas
          </button>

          <button
            onClick={() => onSelectTab('clients')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
              currentTab === 'clients'
                ? 'bg-slate-100 text-slate-950 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            Clientes
          </button>
        </nav>

        {/* Zone 3: 1-2 primary actions */}
        <div className="flex items-center gap-2 shrink-0">
          {onSyncCloud && (
            <button
              onClick={onSyncCloud}
              disabled={isSyncingCloud}
              className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 shadow-2xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sincronizar dados em tempo real com a nuvem (Supabase & Vercel)"
            >
              <Cloud className={`w-3.5 h-3.5 ${isSyncingCloud ? 'animate-bounce text-blue-600' : 'text-blue-600'}`} />
              <span className="hidden xl:inline">{isSyncingCloud ? 'Sincronizando...' : 'Nuvem Conectada'}</span>
            </button>
          )}

          <button
            onClick={onOpenSettings}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 bg-white hover:bg-slate-100 rounded-lg transition-colors border border-slate-300 shadow-2xs flex items-center gap-1.5 cursor-pointer"
            title="Configurações do Emissor Nacional, Certificado A1, E-mail e Logs do Robô"
            aria-label="Abrir configurações (engrenagem)"
          >
            <Settings className="w-4 h-4 text-slate-700" />
            <span className="hidden sm:inline">Configurações</span>
          </button>

          <button
            onClick={onOpenEmitNow}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow-xs flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Emitir NFS-e</span>
          </button>

          {/* Usuário e Botão Sair */}
          {userEmail && (
            <div className="hidden lg:flex items-center gap-1.5 pl-2 border-l border-slate-200">
              <div className="text-right">
                <span className="block text-[11px] font-semibold text-slate-800 leading-tight truncate max-w-[130px]" title={userEmail}>
                  {userEmail}
                </span>
                <span className="block text-[9.5px] text-emerald-600 font-medium">Sessão Ativa</span>
              </div>
            </div>
          )}

          {onLogout && (
            <button
              onClick={onLogout}
              className="p-1.5 sm:px-2.5 sm:py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200 shadow-2xs flex items-center gap-1.5 cursor-pointer"
              title="Sair do sistema (encerrar sessão)"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sair</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-200 bg-slate-50 px-2 py-1.5 text-xs">
        <button
          onClick={() => onSelectTab('dashboard')}
          className={`px-2 py-1 rounded ${currentTab === 'dashboard' ? 'font-bold text-slate-900 bg-white' : 'text-slate-600'}`}
        >
          Visão Geral
        </button>
        <button
          onClick={() => onSelectTab('schedules')}
          className={`px-2 py-1 rounded ${currentTab === 'schedules' ? 'font-bold text-slate-900 bg-white' : 'text-slate-600'}`}
        >
          Agendamentos
        </button>
        <button
          onClick={() => onSelectTab('invoices')}
          className={`px-2 py-1 rounded ${currentTab === 'invoices' ? 'font-bold text-slate-900 bg-white' : 'text-slate-600'}`}
        >
          Notas
        </button>
        <button
          onClick={() => onSelectTab('clients')}
          className={`px-2 py-1 rounded ${currentTab === 'clients' ? 'font-bold text-slate-900 bg-white' : 'text-slate-600'}`}
        >
          Clientes
        </button>
        <button
          onClick={onOpenSettings}
          className="px-2 py-1 rounded text-slate-700 flex items-center gap-1 font-medium hover:bg-slate-200"
          title="Abrir configurações (engrenagem)"
        >
          <Settings className="w-3.5 h-3.5 text-slate-700" />
          <span>Config</span>
        </button>
        {onLogout && (
          <button
            onClick={onLogout}
            className="px-2 py-1 rounded text-rose-600 flex items-center gap-1 font-medium hover:bg-rose-100"
            title="Sair do sistema"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sair</span>
          </button>
        )}
      </div>
    </header>
  );
};
