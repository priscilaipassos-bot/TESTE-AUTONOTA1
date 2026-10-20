import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Mail,
  Phone,
  Edit2,
  Trash2,
  Calendar,
  X,
  Check,
  Building2,
  User,
} from 'lucide-react';
import { TomadorCliente } from '../types/nfse';
import { formatCnpj, formatCpf, formatPhoneNumber } from '../utils/formatters';
import { parseMultipleEmails } from '../utils/emailHelper';

interface ClientsManagerProps {
  clientes: TomadorCliente[];
  onSaveCliente: (cliente: TomadorCliente) => void;
  onDeleteCliente: (id: string) => void;
  onScheduleForClient: (clienteId: string) => void;
}

export const ClientsManager: React.FC<ClientsManagerProps> = ({
  clientes,
  onSaveCliente,
  onDeleteCliente,
  onScheduleForClient,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<TomadorCliente | null>(null);

  // Form states
  const [tipoInscricao, setTipoInscricao] = useState<'CNPJ' | 'CPF'>('CNPJ');
  const [documento, setDocumento] = useState('');
  const [razaoSocial, setRazaoSocial] = useState('');
  const [nomeContato, setNomeContato] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [inscricaoMunicipal, setInscricaoMunicipal] = useState('');
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [codigoMunicipio, setCodigoMunicipio] = useState('3106705');
  const [municipio, setMunicipio] = useState('Betim');
  const [uf, setUf] = useState('MG');
  const [cep, setCep] = useState('32600100');

  const filtered = clientes.filter(
    (c) =>
      c.razaoSocial.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.documento.includes(searchTerm) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.telefone && c.telefone.includes(searchTerm))
  );

  const handleOpenNew = () => {
    setEditingClient(null);
    setTipoInscricao('CNPJ');
    setDocumento('');
    setRazaoSocial('');
    setNomeContato('');
    setEmail('');
    setTelefone('');
    setLogradouro('');
    setNumero('');
    setComplemento('');
    setBairro('');
    setCodigoMunicipio('3106705');
    setMunicipio('Betim');
    setUf('MG');
    setCep('');
    setInscricaoMunicipal('');
    setModalOpen(true);
  };

  const handleOpenEdit = (c: TomadorCliente) => {
    setEditingClient(c);
    setTipoInscricao(c.tipoInscricao);
    setDocumento(c.documento);
    setRazaoSocial(c.razaoSocial);
    setNomeContato(c.nomeContato || '');
    setEmail(c.email);
    setTelefone(c.telefone || '');
    setInscricaoMunicipal(c.inscricaoMunicipal || '');
    setLogradouro(c.endereco.logradouro);
    setNumero(c.endereco.numero);
    setComplemento(c.endereco.complemento || '');
    setBairro(c.endereco.bairro);
    setCodigoMunicipio(c.endereco.codigoMunicipio || '');
    setMunicipio(c.endereco.municipio);
    setUf(c.endereco.uf);
    setCep(c.endereco.cep);
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documento.trim() || !razaoSocial.trim() || !email.trim()) {
      alert('Preencha os campos obrigatórios (Documento, Razão Social e E-mail).');
      return;
    }

    const emailList = parseMultipleEmails(email);
    if (emailList.length === 0) {
      alert('Informe ao menos um endereço de e-mail válido para envio da NFS-e.');
      return;
    }

    const newCliente: TomadorCliente = {
      id: editingClient ? editingClient.id : `cli-${Date.now()}`,
      tipoInscricao,
      documento: documento.replace(/\D/g, ''),
      razaoSocial: razaoSocial.trim(),
      nomeContato: nomeContato.trim(),
      email: emailList.join(', '),
      emails: emailList,
      telefone: telefone ? telefone.replace(/\D/g, '') : undefined,
      inscricaoMunicipal: inscricaoMunicipal.trim() || undefined,
      endereco: {
        logradouro: logradouro.trim(),
        numero: numero.trim(),
        complemento: complemento.trim(),
        bairro: bairro.trim(),
        codigoMunicipio: codigoMunicipio.trim() || undefined,
        municipio: municipio.trim(),
        uf: uf.trim().toUpperCase(),
        cep: cep.replace(/\D/g, ''),
      },
    };

    onSaveCliente(newCliente);
    setModalOpen(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900">
            Cadastro de Clientes
          </h2>
          <p className="text-xs text-slate-500">
            Gerencie os dados cadastrais e e-mails dos clientes para emissão e envio do DANFSE em PDF e XML.
          </p>
        </div>

        <button
          onClick={handleOpenNew}
          className="w-full sm:w-auto justify-center px-3.5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Cadastrar Cliente</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por razão social, CNPJ/CPF, e-mail ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-blue-500 focus:bg-white transition-all text-slate-900"
          />
        </div>
      </div>

      {/* Grid of Clients */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500 text-xs shadow-2xs">
          <Building2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-800 text-sm">Nenhum tomador cadastrado</p>
          <p className="text-slate-400 mt-1 max-w-sm mx-auto">
            Cadastre os dados cadastrais da empresa ou cliente para vincular às emissões automáticas de NFS-e.
          </p>
          <button
            onClick={handleOpenNew}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Cadastrar Primeiro Tomador</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cliente) => {
          const docFormatado =
            cliente.tipoInscricao === 'CNPJ'
              ? formatCnpj(cliente.documento)
              : formatCpf(cliente.documento);

          return (
            <div
              key={cliente.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:border-slate-300 transition-colors flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider block">
                      {cliente.tipoInscricao}: {docFormatado}
                    </span>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight mt-0.5">
                      {cliente.razaoSocial}
                    </h3>
                    {cliente.nomeContato && (
                      <span className="text-[11px] text-slate-500 block">
                        Contato: {cliente.nomeContato}
                      </span>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs">
                  <div className="flex items-start gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {parseMultipleEmails(cliente.email).length > 1 ? (
                        <div className="space-y-1">
                          <span className="font-semibold text-[10.5px] text-blue-900 block">
                            {parseMultipleEmails(cliente.email).length} e-mails de envio:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {parseMultipleEmails(cliente.email).map((em, idx) => (
                              <span
                                key={idx}
                                className="inline-block px-1.5 py-0.5 bg-blue-50 border border-blue-200 text-blue-800 rounded text-[10px] truncate max-w-[200px]"
                                title={em}
                              >
                                {em}
                              </span>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="truncate block" title={cliente.email}>
                          {cliente.email || 'Sem e-mail cadastrado'}
                        </span>
                      )}
                    </div>
                  </div>

                  {cliente.telefone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{formatPhoneNumber(cliente.telefone)}</span>
                    </div>
                  )}

                  <div className="text-[11px] text-slate-400 truncate">
                    {cliente.endereco.municipio}/{cliente.endereco.uf} - {cliente.endereco.bairro}
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => onScheduleForClient(cliente.id)}
                  className="text-xs text-blue-700 hover:text-blue-900 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Programar Nota</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(cliente)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                    title="Editar cliente"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Deseja excluir o cliente "${cliente.razaoSocial}"?`)) {
                        onDeleteCliente(cliente.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    title="Excluir cliente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        </div>
      )}

      {/* Add / Edit Client Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-900">
                {editingClient ? 'Editar Cliente Tomador' : 'Novo Cliente Tomador'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tipo:</label>
                  <select
                    value={tipoInscricao}
                    onChange={(e) => setTipoInscricao(e.target.value as 'CNPJ' | 'CPF')}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  >
                    <option value="CNPJ">Pessoa Jurídica (CNPJ)</option>
                    <option value="CPF">Pessoa Física (CPF)</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    Número do Documento:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={tipoInscricao === 'CNPJ' ? '00.000.000/0000-00' : '000.000.000-00'}
                    value={documento}
                    onChange={(e) => setDocumento(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Razão Social / Nome Completo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nome do cliente para emissão da NFS-e"
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Nome do Contato / Responsável:
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carlos (Financeiro)"
                    value={nomeContato}
                    onChange={(e) => setNomeContato(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Telefone / Celular (opcional):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: (31) 3529-5288"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">
                      E-mails para Envio da NFS-e (permite múltiplos):
                    </label>
                    <span className="text-[10.5px] text-blue-600 font-medium">
                      Separar por vírgula (,) ou ponto e vírgula (;)
                    </span>
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="preposto.regap@nitnave.com, financeiro@nitnave.com, fiscal@nitnave.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white text-xs"
                  />
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Todos os e-mails informados receberão o DANFSE (PDF) e o XML oficial em cada emissão.
                  </span>

                  {/* Pré-visualização dos e-mails reconhecidos */}
                  {parseMultipleEmails(email).length > 0 && (
                    <div className="mt-1.5 p-1.5 bg-blue-50/70 border border-blue-200/80 rounded-md">
                      <span className="text-[10px] font-semibold text-blue-900 block mb-1">
                        Destinatários confirmados ({parseMultipleEmails(email).length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {parseMultipleEmails(email).map((em, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-white border border-blue-300 text-blue-800 rounded text-[10px] font-mono shadow-2xs"
                          >
                            <Mail className="w-2.5 h-2.5 text-blue-600" />
                            <span>{em}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Inscrição Municipal (se houver):
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Isento ou número"
                    value={inscricaoMunicipal}
                    onChange={(e) => setInscricaoMunicipal(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono text-slate-900 text-xs"
                  />
                </div>
              </div>

              {/* Endereço */}
              <div className="pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800 block mb-2">Endereço do Tomador:</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <label className="block text-slate-600 mb-0.5">Logradouro / Rua:</label>
                    <input
                      type="text"
                      value={logradouro}
                      onChange={(e) => setLogradouro(e.target.value)}
                      placeholder="Ex: Inconfidência"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Número:</label>
                    <input
                      type="text"
                      value={numero}
                      onChange={(e) => setNumero(e.target.value)}
                      placeholder="Ex: 414"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="block text-slate-600 mb-0.5">Complemento:</label>
                    <input
                      type="text"
                      value={complemento}
                      onChange={(e) => setComplemento(e.target.value)}
                      placeholder="Ex: Sala 201 Lote 144 Quadra 18"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">CEP:</label>
                    <input
                      type="text"
                      value={cep}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="Ex: 32600-100"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                  <div>
                    <label className="block text-slate-600 mb-0.5">Bairro:</label>
                    <input
                      type="text"
                      value={bairro}
                      onChange={(e) => setBairro(e.target.value)}
                      placeholder="Ex: Centro"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Município:</label>
                    <input
                      type="text"
                      value={municipio}
                      onChange={(e) => setMunicipio(e.target.value)}
                      placeholder="Ex: Betim"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">Cód. IBGE:</label>
                    <input
                      type="text"
                      value={codigoMunicipio}
                      onChange={(e) => setCodigoMunicipio(e.target.value)}
                      placeholder="Ex: 3106705"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-0.5">UF:</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={uf}
                      onChange={(e) => setUf(e.target.value)}
                      placeholder="MG"
                      className="w-full px-2 py-1 bg-slate-50 border border-slate-300 rounded text-slate-900 uppercase font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-semibold flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Salvar Cliente</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
