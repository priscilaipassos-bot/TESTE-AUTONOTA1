import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { DashboardOverview } from './components/DashboardOverview';
import { SchedulesList } from './components/SchedulesList';
import { InvoicesList } from './components/InvoicesList';
import { ClientsManager } from './components/ClientsManager';
import { AutomationLogsModal } from './components/AutomationLogsModal';
import { DanfseViewerModal } from './components/DanfseViewerModal';
import { ScheduleModal } from './components/ScheduleModal';
import { EmitNowModal } from './components/EmitNowModal';
import { SettingsModal } from './components/SettingsModal';
import { storageService } from './services/storageService';
import { supabaseService } from './services/supabaseService';
import { AutomationRunner, getBrasiliaDateTime } from './services/automationRunner';
import { parseMultipleEmails } from './utils/emailHelper';
import {
  NfseDocument,
  ProgramacaoAgendamento,
  TomadorCliente,
  ServicoItem,
  PrestadorConfig,
  EmailConfig,
  AutomationLogEntry,
} from './types/nfse';
import { CheckCircle2, AlertCircle, AlertTriangle, Mail, X } from 'lucide-react';
import { LoginScreen } from './components/LoginScreen';
import { authService } from './services/authService';

export default function App() {
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');

  // Sessão de Autenticação (Mantida até clicar em Sair)
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    const session = authService.getSession();
    return session ? session.email : null;
  });

  // Core State
  const [prestador, setPrestador] = useState<PrestadorConfig>(() => storageService.getPrestador());
  const [clientes, setClientes] = useState<TomadorCliente[]>(() => storageService.getClientes());
  const [servicos, setServicos] = useState<ServicoItem[]>(() => storageService.getServicos());
  const [agendamentos, setAgendamentos] = useState<ProgramacaoAgendamento[]>(() =>
    storageService.getAgendamentos()
  );
  const [notas, setNotas] = useState<NfseDocument[]>(() => storageService.getNotas());
  const [logs, setLogs] = useState<AutomationLogEntry[]>(() => storageService.getLogs());
  const [emailConfig, setEmailConfig] = useState<EmailConfig>(() =>
    storageService.getEmailConfig()
  );
  const [isRobotActive, setIsRobotActive] = useState<boolean>(() =>
    storageService.isRobotActive()
  );
  const [isRobotRunning, setIsRobotRunning] = useState<boolean>(false);

  // Modals state
  const [danfseModalNota, setDanfseModalNota] = useState<NfseDocument | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<ProgramacaoAgendamento | null>(null);
  const [emitNowModalOpen, setEmitNowModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  const showToast = useCallback(
    (text: string, type: 'success' | 'info' | 'error' = 'success') => {
      setToastMessage({ text, type });
      setTimeout(() => {
        setToastMessage(null);
      }, 5500);
    },
    []
  );

  const refreshState = useCallback(() => {
    setPrestador(storageService.getPrestador());
    setClientes(storageService.getClientes());
    setServicos(storageService.getServicos());
    setAgendamentos(storageService.getAgendamentos());
    setNotas(storageService.getNotas());
    setLogs(storageService.getLogs());
    setEmailConfig(storageService.getEmailConfig());
    setIsRobotActive(storageService.isRobotActive());
  }, []);

  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Sincronização inicial com o Supabase Cloud e Vercel
  useEffect(() => {
    let isMounted = true;
    const fetchSupabaseMetadata = async () => {
      try {
        const loaded = await storageService.initAndHydrate();
        if (isMounted) {
          refreshState();
          if (loaded) {
            console.log('[App] Dados sincronizados com sucesso da nuvem (Supabase/Vercel).');
          }
        }
      } catch (err) {
        console.warn('[App] Falha ao sincronizar na inicialização:', err);
      }
    };
    fetchSupabaseMetadata();
    return () => {
      isMounted = false;
    };
  }, [refreshState, currentUserEmail]);

  // Background worker loop
  useEffect(() => {
    const timer = setInterval(async () => {
      if (storageService.isRobotActive() && storageService.isReady()) {
        const count = await AutomationRunner.checkAndExecuteDueSchedules();
        if (count > 0) {
          refreshState();
          showToast(`Robô Automático: ${count} nota(s) emitida(s) e enviadas por E-mail com DANFSE (PDF) e XML!`);
        }
      }
    }, 20000);

    return () => clearInterval(timer);
  }, [refreshState, showToast]);

  // Handler: Toggle Robot
  const handleToggleRobot = () => {
    const nextVal = !isRobotActive;
    storageService.setRobotActive(nextVal);
    setIsRobotActive(nextVal);
    storageService.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tipo: 'SISTEMA',
      nivel: nextVal ? 'SUCESSO' : 'AVISO',
      mensagem: nextVal
        ? 'Robô de emissão e envio automático ATIVADO.'
        : 'Robô de emissão e envio automático PAUSADO pelo usuário.',
    });
    setLogs(storageService.getLogs());
    showToast(nextVal ? 'Robô de Emissão ativado com sucesso!' : 'Robô pausado.');
  };

  // Handler: Manual Run of Robot
  const handleTriggerRobot = async () => {
    setIsRobotRunning(true);
    const bNow = getBrasiliaDateTime();
    storageService.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tipo: 'AGENDAMENTO',
      nivel: 'INFO',
      mensagem: `Varredura manual acionada: verificando contratos agendados para a data e horário oficial de Brasília (${bNow.formatada})...`,
    });

    const count = await AutomationRunner.checkAndExecuteDueSchedules();
    refreshState();
    setIsRobotRunning(false);

    if (count > 0) {
      showToast(`${count} agendamento(s) processado(s) e enviados por E-mail!`);
    } else {
      showToast(`Nenhum agendamento atingiu a data e horário de Brasília (${bNow.horaStr}). Todos em dia!`, 'info');
    }
  };

  // Handler: Execute specific schedule now
  const handleExecuteScheduleNow = async (agd: ProgramacaoAgendamento) => {
    const cliente = clientes.find((c) => c.id === agd.clienteId);
    if (!cliente) {
      alert('Cliente não encontrado.');
      return;
    }

    const result = await AutomationRunner.emitirNfse(
      cliente,
      agd.servicoDescricao,
      agd.codigoTributacaoNacional,
      agd.itemLC116,
      agd.valorServico,
      agd.aliquotaIss,
      agd.issRetido,
      agd.reterImpostosFederais,
      agd.informacoesComplementares,
      agd,
      agd.enviarEmailAutomatico
    );

    refreshState();
    if (result.sucesso && result.nota) {
      showToast(`NFS-e Nº ${result.nota.numero} autorizada e enviada por E-mail com sucesso!`);
      setDanfseModalNota(result.nota);
    }
  };

  // Handler: Save Schedule
  const handleSaveSchedule = (agd: ProgramacaoAgendamento) => {
    storageService.saveAgendamento(agd);
    storageService.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tipo: 'AGENDAMENTO',
      nivel: 'INFO',
      mensagem: `Programação salva: "${agd.titulo}" (${agd.tipoRecorrencia}, próxima emissão em ${agd.dataProximaExecucao}).`,
      referenciaId: agd.id,
    });
    refreshState();
    showToast('Agendamento salvo com sucesso!');
  };

  // Handler: Toggle Schedule Active
  const handleToggleSchedule = (id: string) => {
    const novoStatus = storageService.toggleAgendamento(id);
    refreshState();
    showToast(novoStatus ? 'Agendamento ativado.' : 'Agendamento pausado.', 'info');
  };

  // Handler: Duplicate Schedule
  const handleDuplicateSchedule = (agd: ProgramacaoAgendamento) => {
    const duplicated: ProgramacaoAgendamento = {
      ...agd,
      id: `agd-${Date.now()}`,
      titulo: `${agd.titulo} (Cópia)`,
      totalEmitidas: 0,
      dataUltimaExecucao: undefined,
      criadoEm: new Date().toISOString(),
      ativo: true,
    };
    storageService.saveAgendamento(duplicated);
    storageService.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tipo: 'AGENDAMENTO',
      nivel: 'INFO',
      mensagem: `Agendamento duplicado: "${duplicated.titulo}".`,
      referenciaId: duplicated.id,
    });
    refreshState();
    showToast(`Agendamento "${duplicated.titulo}" duplicado com sucesso!`);
  };

  // Handler: Delete Schedule
  const handleDeleteSchedule = (id: string) => {
    storageService.deleteAgendamento(id);
    storageService.addLog({
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      tipo: 'AGENDAMENTO',
      nivel: 'AVISO',
      mensagem: `Agendamento código ${id} excluído definitivamente pelo usuário.`,
      referenciaId: id,
    });
    refreshState();
    showToast('Agendamento excluído com sucesso.');
  };

  // Handler: Nota emitida imediatamente
  const handleNotaEmitida = (nota: NfseDocument) => {
    refreshState();
    showToast(`NFS-e Nº ${nota.numero} emitida com sucesso via Notaas!`);
    setDanfseModalNota(nota);
  };

  // Handler: Cancel Nota (comunicação com Notaas / Receita Federal e persistência)
  const handleCancelNota = async (id: string, motivo: string, codigoMotivo?: string): Promise<{ sucesso: boolean; mensagem: string; canceladaNotaas?: boolean }> => {
    const notasList = storageService.getNotas();
    const notaAlvo = notasList.find((n) => n.id === id);
    const prestadorCfg = storageService.getPrestador();

    let canceladaNotaas = false;
    let avisoNotaas = '';

    if (notaAlvo && notaAlvo.notaasId) {
      try {
        const res = await fetch('/api/notaas/cancelar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            invoiceId: notaAlvo.notaasId,
            chaveAcesso: notaAlvo.chaveAcesso,
            numero: notaAlvo.numero,
            motivo,
            codigoMotivo: codigoMotivo || '1',
            prestador: prestadorCfg,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          canceladaNotaas = Boolean(data.canceladaNotaas);
          avisoNotaas = data.message || 'Cancelamento transmitido com sucesso ao Notaas e Receita Federal.';
        } else {
          avisoNotaas = `Aviso do Notaas: ${data.error || 'Não foi possível confirmar o cancelamento automático no Notaas. Verifique em platform.notaas.com.br'}`;
        }
      } catch (err: any) {
        avisoNotaas = `Aviso de conexão com o Notaas: ${err.message}. A nota foi cancelada no sistema local, confirme em platform.notaas.com.br`;
      }
    }

    const updated = storageService.cancelNota(id, motivo);
    refreshState();

    if (updated) {
      const msgCompleta = canceladaNotaas
        ? `NFS-e Nº ${updated.numero} cancelada com sucesso no Notaas e Receita Federal.`
        : `NFS-e Nº ${updated.numero} cancelada no sistema.${avisoNotaas ? ` (${avisoNotaas})` : ''}`;
      showToast(msgCompleta, canceladaNotaas ? 'success' : 'info');
      return { sucesso: true, mensagem: msgCompleta, canceladaNotaas };
    }

    return { sucesso: false, mensagem: 'Nota fiscal não localizada.' };
  };

  // Handler: Reemitir NFS-e para o Notaas (SEM envio de e-mail automático, com aviso explícito)
  const handleReemitirNota = async (nota: NfseDocument, customDps?: string, customSerie?: string) => {
    showToast(`Reemitindo NFS-e Nº ${nota.numero} no Notaas... (Aviso: E-mail não será enviado automaticamente)`, 'info');

    try {
      const result = await AutomationRunner.reemitirNfse(nota, customDps, customSerie);
      refreshState();

      if (result.sucesso && result.nota) {
        showToast(
          `NFS-e Nº ${result.nota.numero} transmitida com sucesso ao Notaas! (Aviso: E-mail não enviado automaticamente)`,
          result.nota.status === 'AUTORIZADA' ? 'success' : 'info'
        );
        return { sucesso: true, nota: result.nota };
      } else {
        showToast(result.erro || 'Falha ao retransmitir para o Notaas.', 'error');
        return { sucesso: false, erro: result.erro };
      }
    } catch (err: any) {
      const msg = `Erro na reemissão: ${err.message || 'Falha de comunicação'}`;
      showToast(msg, 'error');
      return { sucesso: false, erro: msg };
    }
  };

  // Handler: Resend Email com DANFSE (PDF) e XML anexados
  const handleResendEmail = async (nota: NfseDocument, customEmail?: string) => {
    const currentEmailConfig = storageService.getEmailConfig();
    const rawTarget = customEmail || nota.emailDestinatario || nota.tomador.email || currentEmailConfig.remetenteEmail;
    const targetEmails = parseMultipleEmails(rawTarget);

    if (targetEmails.length === 0) {
      showToast('E-mail de destino não informado ou inválido.', 'error');
      return { sucesso: false, erro: 'E-mail de destino inválido' };
    }

    const targetFormatted = targetEmails.join(', ');

    if (!currentEmailConfig.senhaApp || !currentEmailConfig.senhaApp.trim()) {
      showToast(
        '⚠️ Senha de App do Gmail não configurada! Abra as Configurações (engrenagem) > Disparo por E-mail e informe sua Senha de Aplicativo de 16 caracteres.',
        'error'
      );
      return {
        sucesso: false,
        erro: 'Senha de Aplicativo do Gmail não configurada nas Configurações.',
      };
    }

    showToast(`Enviando e-mail com DANFSE (PDF) e XML para [${targetFormatted}]...`, 'info');

    try {
      const corpoRenderizado = AutomationRunner.renderTemplate(currentEmailConfig.corpoTemplate, nota);
      const assuntoRenderizado = AutomationRunner.renderTemplate(currentEmailConfig.assuntoTemplate, nota);

      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          servidorSmtp: currentEmailConfig.servidorSmtp,
          porta: currentEmailConfig.porta,
          usuario: currentEmailConfig.usuario,
          senhaApp: currentEmailConfig.senhaApp,
          remetenteNome: currentEmailConfig.remetenteNome,
          remetenteEmail: currentEmailConfig.remetenteEmail,
          destinatario: targetEmails,
          enviarCopiaOculta: currentEmailConfig.enviarCopiaOculta,
          assunto: assuntoRenderizado,
          corpo: corpoRenderizado,
          nota, // O backend gera o DANFSE (PDF) e o XML oficial assinado
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        nota.emailEnviado = true;
        nota.emailStatus = 'ENVIADO';
        nota.emailDataEnvio = new Date().toISOString();
        nota.emailDestinatario = targetFormatted;
        storageService.updateNota(nota);
        storageService.addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          tipo: 'EMAIL',
          nivel: 'SUCESSO',
          mensagem: `E-mail entregue com sucesso para [${targetFormatted}] com DANFSE (PDF) e XML Nacional anexados.`,
          referenciaId: nota.id,
        });
        refreshState();
        showToast(`✅ E-mail com DANFSE (PDF) e XML entregue para [${targetFormatted}]!`, 'success');
        return { sucesso: true };
      } else {
        const errMsg = data.error || 'Erro ao conectar ao servidor SMTP.';
        nota.emailEnviado = false;
        nota.emailStatus = 'ERRO';
        storageService.updateNota(nota);
        storageService.addLog({
          id: `log-${Date.now()}`,
          timestamp: new Date().toISOString(),
          tipo: 'EMAIL',
          nivel: 'AVISO',
          mensagem: `Falha no envio de e-mail fiscal para [${targetFormatted}]: ${errMsg}`,
          referenciaId: nota.id,
        });
        refreshState();
        showToast(`Falha no envio: ${errMsg}`, 'error');
        return { sucesso: false, erro: errMsg };
      }
    } catch (err: any) {
      const errMsg = err.message || 'Erro de rede ao enviar e-mail.';
      showToast(`Erro ao conectar ao servidor: ${errMsg}`, 'error');
      return { sucesso: false, erro: errMsg };
    }
  };

  // Handler: Client actions
  const handleSaveCliente = (cliente: TomadorCliente) => {
    storageService.saveCliente(cliente);
    refreshState();
    showToast(`Cliente "${cliente.razaoSocial}" salvo com sucesso!`);
  };

  const handleDeleteCliente = (id: string) => {
    storageService.deleteCliente(id);
    refreshState();
    showToast('Cliente removido.');
  };

  // Handler: Reset and Reload from Supabase
  const handleResetSampleData = async () => {
    await storageService.resetAll();
    refreshState();
    showToast('Dados recarregados diretamente do Supabase com sucesso!');
    setSettingsModalOpen(false);
  };

  // Handler: Clear Logs
  const handleClearDemoData = () => {
    storageService.clearAllDemoData();
    refreshState();
    showToast('Logs limpos e sincronizados com o Supabase!');
    setSettingsModalOpen(false);
  };

  // Handlers de Autenticação
  const handleLoginSuccess = async (email: string) => {
    setCurrentUserEmail(email);
    showToast(`Bem-vinda, ${email}! Sincronizando dados com a nuvem...`, 'info');
    try {
      await storageService.initAndHydrate();
      refreshState();
      showToast(`Acesso autenticado e dados fiscais sincronizados com sucesso!`);
    } catch {
      refreshState();
      showToast(`Bem-vinda, ${email}!`);
    }
  };

  const handleSyncCloud = async () => {
    setIsSyncingCloud(true);
    try {
      const ok = await storageService.initAndHydrate();
      refreshState();
      showToast(ok ? 'Dados fiscais sincronizados com o Supabase com sucesso!' : 'Metadados sincronizados (cache local ativo).');
    } catch (err: any) {
      showToast(`Erro ao sincronizar: ${err.message}`, 'error');
    } finally {
      setIsSyncingCloud(false);
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUserEmail(null);
    showToast('Sessão encerrada com sucesso.', 'info');
  };

  // Se o usuário não estiver autenticado, exibe a tela de login
  if (!currentUserEmail) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900">
      {/* Strict 3-Zone Top Bar */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        onOpenEmitNow={() => setEmitNowModalOpen(true)}
        onOpenSettings={() => setSettingsModalOpen(true)}
        isRobotRunning={isRobotRunning}
        onTriggerRobot={handleTriggerRobot}
        userEmail={currentUserEmail}
        onLogout={handleLogout}
        onSyncCloud={handleSyncCloud}
        isSyncingCloud={isSyncingCloud}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {currentTab === 'dashboard' && (
          <DashboardOverview
            notas={notas}
            agendamentos={agendamentos}
            clientes={clientes}
            isRobotActive={isRobotActive}
            onToggleRobot={handleToggleRobot}
            onSelectNota={(nota) => setDanfseModalNota(nota)}
            onViewSchedules={() => setCurrentTab('schedules')}
            onViewInvoices={() => setCurrentTab('invoices')}
            onNewSchedule={() => {
              setScheduleToEdit(null);
              setScheduleModalOpen(true);
            }}
            onEmitNow={() => setEmitNowModalOpen(true)}
            onExecuteScheduleNow={handleExecuteScheduleNow}
          />
        )}

        {currentTab === 'schedules' && (
          <SchedulesList
            agendamentos={agendamentos}
            clientes={clientes}
            onNewSchedule={() => {
              setScheduleToEdit(null);
              setScheduleModalOpen(true);
            }}
            onEditSchedule={(agd) => {
              setScheduleToEdit(agd);
              setScheduleModalOpen(true);
            }}
            onDuplicateSchedule={handleDuplicateSchedule}
            onToggleSchedule={handleToggleSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onExecuteNow={handleExecuteScheduleNow}
          />
        )}

        {currentTab === 'invoices' && (
          <InvoicesList
            notas={notas}
            onSelectNota={(nota) => setDanfseModalNota(nota)}
            onCancelNota={handleCancelNota}
            onResendEmail={handleResendEmail}
            onEmitNow={() => setEmitNowModalOpen(true)}
            onReemitirNota={handleReemitirNota}
          />
        )}

        {currentTab === 'clients' && (
          <ClientsManager
            clientes={clientes}
            onSaveCliente={handleSaveCliente}
            onDeleteCliente={handleDeleteCliente}
            onScheduleForClient={(clienteId) => {
              setScheduleToEdit(null);
              setScheduleModalOpen(true);
            }}
          />
        )}
      </main>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 text-xs border max-w-md animate-fade-in ${
            toastMessage.type === 'error'
              ? 'bg-rose-950 text-white border-rose-500 shadow-rose-950/40'
              : toastMessage.type === 'info'
              ? 'bg-slate-900 text-slate-100 border-sky-500 shadow-sky-950/40'
              : 'bg-slate-900 text-white border-blue-500 shadow-blue-950/40'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : toastMessage.type === 'info' ? (
            <Mail className="w-4 h-4 text-sky-400 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span className="flex-1 font-medium">{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Official DANFSE Viewer Modal */}
      <DanfseViewerModal
        nota={danfseModalNota}
        onClose={() => setDanfseModalNota(null)}
        onResendEmail={handleResendEmail}
        onNotaAtualizada={(novaNota) => {
          setNotas(storageService.getNotas());
          setDanfseModalNota(novaNota);
        }}
      />

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={scheduleModalOpen}
        onClose={() => {
          setScheduleModalOpen(false);
          setScheduleToEdit(null);
        }}
        onSave={handleSaveSchedule}
        scheduleToEdit={scheduleToEdit}
        clientes={clientes}
        servicos={servicos}
        onOpenNewClient={() => {
          setScheduleModalOpen(false);
          setCurrentTab('clients');
        }}
      />

      {/* Emit Now Modal */}
      <EmitNowModal
        isOpen={emitNowModalOpen}
        onClose={() => setEmitNowModalOpen(false)}
        clientes={clientes}
        servicos={servicos}
        prestador={prestador}
        onOpenNewClient={() => {
          setEmitNowModalOpen(false);
          setCurrentTab('clients');
        }}
        onOpenSettings={() => {
          setEmitNowModalOpen(false);
          setSettingsModalOpen(true);
        }}
        onNotaEmitida={handleNotaEmitida}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
        prestador={prestador}
        emailConfig={emailConfig}
        logs={logs}
        isRobotActive={isRobotActive}
        onClearLogs={() => {
          storageService.clearLogs();
          setLogs([]);
        }}
        onSavePrestador={(p) => {
          storageService.savePrestador(p);
          setPrestador(p);
        }}
        onSaveEmailConfig={(e) => {
          storageService.saveEmailConfig(e);
          setEmailConfig(e);
        }}
        onResetSampleData={handleResetSampleData}
        onClearDemoData={handleClearDemoData}
        onRefreshAllData={refreshState}
      />
    </div>
  );
}
