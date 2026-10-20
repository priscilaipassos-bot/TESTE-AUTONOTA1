import express, { Express } from 'express';
import nodemailer from 'nodemailer';
import { generateDanfsePdfBuffer } from './utils/danfsePdfGenerator';
import { parseNotaasNfseXml } from './utils/notaasXmlParser';

export function createBackendApp(): Express {
  const app = express();

  app.use(express.json({ limit: '15mb' }));

  // CORS middleware para aplicações web e Vercel Serverless
  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, apikey, x-api-key, X-Requested-With, Accept'
    );
    if (_req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Normalização universal de rotas para Vercel Serverless e Node.js
  app.use((req, _res, next) => {
    // 1. Suporte a Vercel Catch-All Serverless ([...path].js)
    if (req.query) {
      const catchAll = req.query.path || req.query.__path;
      if (catchAll) {
        const sub = Array.isArray(catchAll) ? catchAll.join('/') : String(catchAll);
        delete (req.query as any).path;
        delete (req.query as any).__path;
        const queryIdx = (req.url || '').indexOf('?');
        const qs = queryIdx >= 0 ? req.url.slice(queryIdx) : '';
        req.url = '/api/' + sub.replace(/^\//, '') + qs;
      }
    }

    // 2. Se req.url contiver o texto literal [...path], remove
    if (req.url && req.url.includes('[...path]')) {
      req.url = req.url.replace(/\/api\/\[\.\.\.path\]/g, '/api').replace(/\/\[\.\.\.path\]/g, '/api');
    }

    // NUNCA altere requisições do Vite ou de arquivos estáticos/frontend
    if (
      req.url.startsWith('/@') ||
      req.url.startsWith('/src') ||
      req.url.startsWith('/node_modules') ||
      req.url.includes('.') ||
      req.url === '/'
    ) {
      return next();
    }

    // 3. Apenas em ambiente Vercel Serverless onde a função é invocada sem o prefixo /api
    if (process.env.VERCEL && !req.url.startsWith('/api')) {
      req.url = '/api' + req.url;
    }
    next();
  });

  const router = express.Router();

  // Health check route (/api/health)
  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      platform: process.env.VERCEL ? 'vercel_serverless' : 'node_server',
      timestamp: new Date().toISOString(),
    });
  });

  // Diagnóstico completo Vercel & Supabase (/api/vercel/status)
  router.get('/vercel/status', async (_req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || 'https://gcpvceeaeyeufofntmwc.supabase.co').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3';
    try {
      const checkRes = await fetch(`${supabaseUrl}/rest/v1/autonfse_metadata?user_id=eq.autonfse_system_metadata&select=user_id,updated_at,data`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      });
      const data = checkRes.ok ? await checkRes.json() : null;
      const metadata = data && data[0]?.data ? data[0].data : null;
      return res.json({
        success: true,
        platform: process.env.VERCEL ? 'vercel_serverless' : 'node_server',
        vercel: Boolean(process.env.VERCEL),
        supabase: {
          connected: checkRes.ok,
          statusHttp: checkRes.status,
          url: supabaseUrl,
          table: 'autonfse_metadata',
          rowKey: 'autonfse_system_metadata',
          lastUpdated: data && data[0]?.updated_at,
          totalNotas: metadata?.notas?.length || 0,
          notas: (metadata?.notas || []).map((n: any) => ({
            numero: n.numero,
            status: n.status,
            tomador: n.tomador?.razaoSocial || n.tomador?.nomeContato,
            valor: n.impostos?.valorServicos,
          })),
          totalClientes: metadata?.clientes?.length || 0,
          clientes: (metadata?.clientes || []).map((c: any) => c.razaoSocial || c.nomeContato),
          totalAgendamentos: metadata?.agendamentos?.length || 0,
          agendamentos: (metadata?.agendamentos || []).map((a: any) => a.titulo),
          prestador: metadata?.prestador?.razaoSocial || 'PRISCILA I PASSOS LTDA',
        },
        timestamp: new Date().toISOString(),
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message,
        platform: process.env.VERCEL ? 'vercel_serverless' : 'node_server',
      });
    }
  });

  // Supabase status check endpoint
  router.get('/supabase/status', async (_req, res) => {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://gcpvceeaeyeufofntmwc.supabase.co';
      const cleanUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3';

      const checkRes = await fetch(`${cleanUrl}/rest/v1/autonfse_metadata?limit=1`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      });

      return res.json({
        success: checkRes.ok,
        statusHttp: checkRes.status,
        url: cleanUrl,
        tabela: 'autonfse_metadata',
        mensagem: checkRes.ok
          ? 'Conexão com Supabase validada com sucesso via backend!'
          : `Supabase retornou status ${checkRes.status}`,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Falha ao testar Supabase: ${err.message}`,
      });
    }
  });

  // Backup / Endpoint de Metadados do Supabase (/api/metadata)
  router.get('/metadata', async (_req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || 'https://gcpvceeaeyeufofntmwc.supabase.co').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3';
    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/autonfse_metadata?user_id=eq.autonfse_system_metadata&select=user_id,data,updated_at`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          Accept: 'application/json',
        },
      });
      if (!response.ok) {
        return res.status(response.status).json({ success: false, error: `Supabase status ${response.status}` });
      }
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length > 0 && rows[0]?.data) {
        return res.json({
          success: true,
          data: rows[0].data,
          updated_at: rows[0].updated_at,
        });
      }
      return res.json({ success: false, data: null, message: 'Nenhum registro encontrado' });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/metadata', async (req, res) => {
    const supabaseUrl = (process.env.VITE_SUPABASE_URL || 'https://gcpvceeaeyeufofntmwc.supabase.co').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_INQR2qlr9so3jznxFhIzMA_ccbtG9b3';
    try {
      const { data } = req.body;
      if (!data || typeof data !== 'object') {
        return res.status(400).json({ success: false, error: 'Corpo da requisição inválido' });
      }

      // Garante que apenas os dados da nota fiscal sejam salvos no Supabase (sem arquivos brutos)
      const sanitizedData = { ...data };
      if (sanitizedData.notas && Array.isArray(sanitizedData.notas)) {
        sanitizedData.notas = sanitizedData.notas.map((n: any) => {
          const { xmlConteudo, ...dadosFiscais } = n;
          return dadosFiscais;
        });
      }

      const payload = {
        user_id: 'autonfse_system_metadata',
        data: {
          ...sanitizedData,
          lastUpdated: new Date().toISOString(),
          appVersion: '2.0.0',
        },
        updated_at: new Date().toISOString(),
      };
      const response = await fetch(`${supabaseUrl}/rest/v1/autonfse_metadata`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates',
        },
        body: JSON.stringify(payload),
      });
      if (response.ok || response.status === 201 || response.status === 204) {
        return res.json({ success: true, message: 'Metadados persistidos com sucesso!' });
      }
      const errBody = await response.text();
      return res.status(response.status).json({ success: false, error: errBody });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // ROTA: Gerar e Baixar PDF oficial do DANFSE Nacional
  router.post('/danfse/pdf', async (req, res) => {
    try {
      const { nota } = req.body;
      if (!nota) {
        return res.status(400).json({
          success: false,
          error: 'Dados da NFS-e não informados para geração do PDF.',
        });
      }

      console.log(`[PDF] Gerando DANFSE PDF da NFS-e Nº ${nota.numero}...`);
      const pdfBuffer = await generateDanfsePdfBuffer(nota);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="DANFSE_${nota.numero || 'Nacional'}.pdf"`
      );
      return res.send(pdfBuffer);
    } catch (err: any) {
      console.error('[PDF] Erro ao gerar DANFSE em PDF:', err);
      return res.status(500).json({
        success: false,
        error: `Erro ao gerar DANFSE em PDF: ${err.message || 'Falha interna'}`,
      });
    }
  });

  // ROTA: Envio Real de E-mail via SMTP com DANFSE (PDF) e XML Anexados
  router.post('/send-email', async (req, res) => {
    try {
      const {
        servidorSmtp,
        porta,
        usuario,
        senhaApp,
        remetenteNome,
        remetenteEmail,
        destinatario,
        enviarCopiaOculta,
        copiaOculta,
        bcc,
        assunto,
        corpo,
        anexos,
        nota,
      } = req.body;

      // Normaliza múltiplos e-mails de destino (aceita array ou string separada por vírgula / ponto e vírgula)
      let cleanedDestinatarios: string[] = [];
      if (Array.isArray(destinatario)) {
        destinatario.forEach((d) => {
          if (typeof d === 'string') {
            d.split(/[;,]+/).forEach((item) => {
              const clean = item.trim().toLowerCase();
              if (clean && clean.includes('@') && !cleanedDestinatarios.includes(clean)) {
                cleanedDestinatarios.push(clean);
              }
            });
          }
        });
      } else if (typeof destinatario === 'string') {
        destinatario.split(/[;,]+/).forEach((item) => {
          const clean = item.trim().toLowerCase();
          if (clean && clean.includes('@') && !cleanedDestinatarios.includes(clean)) {
            cleanedDestinatarios.push(clean);
          }
        });
      }

      if (cleanedDestinatarios.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Nenhum e-mail de destino válido informado. Você pode informar um ou mais e-mails separados por vírgula.',
        });
      }

      // Normaliza cópia oculta (BCC) se fornecida
      let cleanedBcc: string[] = [];
      const rawBcc = enviarCopiaOculta || copiaOculta || bcc;
      if (rawBcc) {
        if (Array.isArray(rawBcc)) {
          rawBcc.forEach((b) => {
            if (typeof b === 'string') {
              b.split(/[;,]+/).forEach((item) => {
                const clean = item.trim().toLowerCase();
                if (clean && clean.includes('@') && !cleanedBcc.includes(clean)) {
                  cleanedBcc.push(clean);
                }
              });
            }
          });
        } else if (typeof rawBcc === 'string') {
          rawBcc.split(/[;,]+/).forEach((item) => {
            const clean = item.trim().toLowerCase();
            if (clean && clean.includes('@') && !cleanedBcc.includes(clean)) {
              cleanedBcc.push(clean);
            }
          });
        }
      }

      if (!usuario || !senhaApp || !String(senhaApp).trim()) {
        return res.status(400).json({
          success: false,
          error:
            'Senha de Aplicativo do Gmail não configurada. Abra as Configurações (ícone de engrenagem) > Disparo por E-mail e informe a Senha de App de 16 letras gerada na sua Conta Google (myaccount.google.com/apppasswords).',
        });
      }

      const cleanPassword = String(senhaApp).replace(/[\s\-]/g, '').trim().toLowerCase();
      const cleanUser = String(usuario).trim().replace(/@gmail\.co$/i, '@gmail.com');
      const cleanRemetente = String(remetenteEmail || cleanUser).trim().replace(/@gmail\.co$/i, '@gmail.com');

      const host = servidorSmtp ? String(servidorSmtp).trim() : 'smtp.gmail.com';
      const isGmail = host.includes('gmail') || cleanUser.includes('@gmail');
      let portNum = Number(porta) || (isGmail ? 465 : 587);
      let secure = portNum === 465;

      if (portNum === 587) {
        secure = false;
      }

      const transporter = nodemailer.createTransport({
        host,
        port: portNum,
        secure,
        auth: {
          user: cleanUser,
          pass: cleanPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.verify();

      const attachmentsList: any[] = [];

      // 1. Se passou nota, gera automaticamente o DANFSE PDF oficial e anexa
      if (nota) {
        try {
          console.log(`[Email] Gerando e anexando DANFSE (PDF) para NFS-e Nº ${nota.numero}...`);
          const pdfBuffer = await generateDanfsePdfBuffer(nota);
          attachmentsList.push({
            filename: `DANFSE_${nota.numero || 'Nacional'}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
          console.log(`[Email] DANFSE PDF anexado com sucesso (${pdfBuffer.length} bytes).`);
        } catch (ePdf) {
          console.error('[Email] Aviso: Erro ao gerar DANFSE PDF para anexar:', ePdf);
        }

        // Anexa o XML oficial assinado
        if (nota.xmlConteudo) {
          attachmentsList.push({
            filename: `NFSe_${nota.numero || 'Nacional'}.xml`,
            content: nota.xmlConteudo,
            contentType: 'application/xml',
          });
        }
      }

      // 2. Anexos adicionais
      if (anexos && Array.isArray(anexos)) {
        for (const a of anexos) {
          const jaExiste = attachmentsList.some((item) => item.filename === a.filename);
          if (!jaExiste) {
            attachmentsList.push({
              filename: a.filename,
              content: a.content,
              encoding: a.encoding || 'utf-8',
              contentType: a.contentType,
            });
          }
        }
      }

      // Dispara o e-mail real para todos os destinatários
      const mailOptions: any = {
        from: `"${remetenteNome || 'PRISCILA I PASSOS LTDA'}" <${cleanRemetente}>`,
        to: cleanedDestinatarios,
        bcc: cleanedBcc.length > 0 ? cleanedBcc : undefined,
        subject: assunto || 'Nota Fiscal de Serviços Eletrônica NFS-e Nacional (DANFSE + XML)',
        text: corpo || 'Segue em anexo o DANFSE (PDF) e o XML oficial da NFS-e Nacional.',
        html: corpo
          ? `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.65; max-width: 680px; margin: 0 auto; padding: 15px 0;">
              <div style="font-size: 14px; color: #1e293b; margin-bottom: 20px;">${corpo.replace(/\n/g, '<br>')}</div>
              <div style="margin-top: 20px; padding: 12px 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0284c7; border-radius: 6px; font-size: 12px; color: #334155;">
                📎 <strong>Documentos Fiscais em Anexo neste E-mail:</strong><br/>
                &bull; <strong>DANFSE (PDF):</strong> Documento Auxiliar Oficial da NFS-e para impressão ou escrituração contábil.<br/>
                &bull; <strong>NFSe (XML):</strong> Arquivo XML com padrão nacional da Receita Federal assinado digitalmente.
              </div>
            </div>`
          : undefined,
        attachments: attachmentsList,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log(`[Email] E-mail entregue com sucesso para [${cleanedDestinatarios.join(', ')}] com ${attachmentsList.length} anexos. ID: ${info.messageId}`);

      return res.json({
        success: true,
        messageId: info.messageId,
        response: info.response,
        destinatarios: cleanedDestinatarios,
        copiaOculta: cleanedBcc,
        anexosEnviados: attachmentsList.map((a) => a.filename),
      });
    } catch (err: any) {
      console.error('Erro ao enviar e-mail via SMTP:', err);
      let errorMsg = err.message || 'Erro de conexão com o servidor SMTP.';

      if (
        errorMsg.includes('535') ||
        errorMsg.includes('BadCredentials') ||
        errorMsg.includes('Username and Password not accepted')
      ) {
        errorMsg =
          'Erro 535 no Gmail: Usuário ou Senha de Aplicativo recusada. No Gmail com verificação em 2 etapas, gere uma "Senha de App" de 16 letras em myaccount.google.com/apppasswords e cole no campo "Senha de App" das Configurações.';
      } else if (errorMsg.includes('ECONNREFUSED')) {
        errorMsg = 'Servidor SMTP recusou a conexão. Verifique o endereço do host e a porta.';
      } else if (errorMsg.includes('ETIMEDOUT')) {
        errorMsg = 'Tempo limite esgotado ao tentar alcançar o servidor SMTP.';
      }

      return res.status(500).json({
        success: false,
        error: errorMsg,
      });
    }
  });

  // ROTA: Teste de Conexão SMTP de E-mail
  router.post('/test-email', async (req, res) => {
    try {
      const { servidorSmtp, porta, usuario, senhaApp, remetenteEmail } = req.body;
      if (!usuario || !senhaApp || !String(senhaApp).trim()) {
        return res.status(400).json({
          success: false,
          error: 'E-mail de usuário ou Senha de Aplicativo não informada.',
        });
      }
      const cleanUser = String(usuario).trim().replace(/@gmail\.co$/i, '@gmail.com');
      const cleanPassword = String(senhaApp).replace(/[\s\-]/g, '').trim().toLowerCase();
      const cleanRemetente = String(remetenteEmail || cleanUser).trim().replace(/@gmail\.co$/i, '@gmail.com');

      const host = servidorSmtp ? String(servidorSmtp).trim() : 'smtp.gmail.com';
      const isGmail = host.includes('gmail') || cleanUser.includes('@gmail');
      let portNum = Number(porta) || (isGmail ? 465 : 587);
      let secure = portNum === 465;

      const transporter = nodemailer.createTransport({
        host,
        port: portNum,
        secure,
        auth: {
          user: cleanUser,
          pass: cleanPassword,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.verify();

      // Envia e-mail de teste para o próprio usuário/remetente
      await transporter.sendMail({
        from: `"AutoNFS-e Nacional" <${cleanRemetente}>`,
        to: cleanUser,
        subject: '✅ AutoNFS-e: Conexão Gmail SMTP Conectada com Sucesso!',
        text: `Olá!\n\nEste é um e-mail de teste confirmando que a sua integração de e-mail (${cleanUser}) está 100% configurada e conectada ao Gmail.\n\nSuas próximas notas fiscais autorizadas serão enviadas automaticamente para os clientes com DANFSE (PDF) e XML anexados.\n\nAtenciosamente,\nAutoNFS-e Nacional`,
      });

      return res.status(200).json({
        success: true,
        message: `Conexão SMTP validada com sucesso! Um e-mail de teste foi enviado para ${cleanUser}.`,
      });
    } catch (err: any) {
      console.error('[Email Test] Erro:', err);
      let errorMsg = err.message || 'Falha de conexão SMTP';
      if (
        errorMsg.includes('535') ||
        errorMsg.includes('BadCredentials') ||
        errorMsg.includes('Username and Password not accepted')
      ) {
        errorMsg =
          'Erro 535 no Gmail: Usuário ou Senha de Aplicativo recusada. Certifique-se de usar o e-mail completo com @gmail.com e de gerar a "Senha de App" de 16 letras em myaccount.google.com/apppasswords.';
      }
      return res.status(400).json({
        success: false,
        error: errorMsg,
      });
    }
  });

  // ROTA: Testar Conexão com a API Notaas (Proxy Server-Side Seguro)
  router.post('/notaas/test-connection', async (req, res) => {
    try {
      const apiKey = req.body?.apiKey;
      const cleanToken = String(apiKey || process.env.VITE_NOTAAS_API_KEY || process.env.NOTAAS_API_KEY || 'ntaas_zo987DbmrHkCL6iMGLVvR3lvQP6Sr9ix').trim();
      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          statusHttp: 400,
          message: 'Chave de API / Token da Notaas não foi informada.',
          error: 'Chave de API / Token da Notaas não foi informada.',
        });
      }

      // Chamada server-side com header oficial x-api-key
      const testRes = await fetch('https://platform.notaas.com.br/api/v1/emitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': cleanToken,
        },
        body: JSON.stringify({
          tipo: 'nfse',
          ambiente: 'sandbox',
          referencia: `test-${Date.now()}`,
          probe: true,
        }),
      });

      const responseText = await testRes.text();
      let responseJson: any = null;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        // resposta não JSON
      }

      if (testRes.status === 401 || responseJson?.error?.includes('API key inválida') || responseJson?.error?.includes('API key obrigatória')) {
        return res.status(401).json({
          success: false,
          statusHttp: 401,
          message: responseJson?.error || 'Chave de API não autorizada (401) no Notaas. Verifique se o token foi copiado completo do painel platform.notaas.com.br (prefixo ntaas_*).',
          error: responseJson?.error || 'Chave de API não autorizada (401) no Notaas.',
          detalhes: 'Verifique se a chave foi copiada completa do painel platform.notaas.com.br (prefixo ntaas_*).',
          diagnostico: `POST /api/v1/emitir: HTTP ${testRes.status}`,
        });
      }

      if (testRes.status === 403) {
        return res.status(403).json({
          success: false,
          statusHttp: 403,
          message: 'Acesso negado (403) pelos servidores da Notaas. Verifique as permissões da sua conta.',
          error: 'Acesso negado (403) pelos servidores da Notaas.',
          diagnostico: `POST /api/v1/emitir: HTTP 403`,
        });
      }

      if (!testRes.ok && testRes.status >= 500) {
        return res.status(502).json({
          success: false,
          statusHttp: testRes.status,
          message: `Servidores da Notaas retornaram instabilidade temporária (HTTP ${testRes.status}). Tente novamente em instantes.`,
          error: `Erro no servidor Notaas: HTTP ${testRes.status}`,
          diagnostico: `platform.notaas.com.br: HTTP ${testRes.status}`,
        });
      }

      return res.json({
        success: true,
        origem: 'NOTAAS_PLATFORM',
        statusHttp: testRes.status,
        message: 'Chave de API Notaas (ntaas_) autenticada com sucesso no endpoint oficial!',
        mensagem: 'Chave de API Notaas (ntaas_) autenticada com sucesso no endpoint oficial!',
        diagnostico: `platform.notaas.com.br: HTTP ${testRes.status} (Autenticado)`,
      });
    } catch (err: any) {
      console.error('Erro ao testar API Notaas no servidor:', err);
      return res.status(500).json({
        success: false,
        statusHttp: 500,
        message: `Falha de conexão com os servidores da Notaas: ${err.message || 'Falha de comunicação'}`,
        error: `Erro ao comunicar com a Notaas: ${err.message || 'Falha de rede.'}`,
      });
    }
  });

  // Função auxiliar para baixar e obter o XML oficial da NFS-e emitido pelo Notaas
  async function fetchXmlFromNotaas(
    xmlCandidate: string | undefined,
    invoiceId: string | undefined,
    apiKey: string
  ): Promise<string | undefined> {
    // 1. Se já for o texto do XML
    if (xmlCandidate && (xmlCandidate.trim().startsWith('<?xml') || xmlCandidate.trim().startsWith('<'))) {
      return xmlCandidate.trim();
    }

    // 2. Se for uma URL (xmlUrl ou linkXml)
    if (xmlCandidate && String(xmlCandidate).startsWith('http')) {
      try {
        console.log(`[Notaas XML] Baixando XML oficial da URL: ${xmlCandidate}`);
        const xmlRes = await fetch(xmlCandidate, {
          headers: {
            'x-api-key': apiKey,
            'Accept': 'application/xml, text/xml, application/octet-stream, */*',
          },
        });
        if (xmlRes.ok) {
          const text = await xmlRes.text();
          if (
            text &&
            (text.includes('<?xml') ||
              text.includes('<NFSe') ||
              text.includes('<CompNfse') ||
              text.includes('<infNFSe') ||
              text.includes('<DFe') ||
              text.includes('<nfe') ||
              text.includes('<tcCompNfse>'))
          ) {
            console.log(`[Notaas XML] XML baixado com sucesso da URL (${text.length} bytes)`);
            return text;
          }
        }
      } catch (eUrl) {
        console.warn('[Notaas XML] Falha ao baixar XML via URL:', eUrl);
      }
    }

    // 3. Se tiver invoiceId, tenta endpoints conhecidos da API Notaas
    if (invoiceId && !invoiceId.startsWith('dps-') && !invoiceId.startsWith('nfs-')) {
      const endpoints = [
        `https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/xml`,
        `https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/download/xml`,
      ];
      for (const ep of endpoints) {
        try {
          console.log(`[Notaas XML] Tentando obter XML oficial via endpoint: ${ep}`);
          const epRes = await fetch(ep, {
            headers: {
              'x-api-key': apiKey,
              'Accept': 'application/xml, text/xml, application/json, */*',
            },
          });
          if (epRes.ok) {
            const contentType = epRes.headers.get('content-type') || '';
            if (contentType.includes('json')) {
              const json: any = await epRes.json();
              const candidate = json.xml || json.xmlConteudo || json.conteudo || json.data;
              if (candidate && (candidate.includes('<?xml') || candidate.includes('<'))) {
                return candidate;
              }
            } else {
              const text = await epRes.text();
              if (
                text &&
                (text.includes('<?xml') ||
                  text.includes('<NFSe') ||
                  text.includes('<CompNfse') ||
                  text.includes('<infNFSe') ||
                  text.includes('<DFe') ||
                  text.includes('<nfe'))
              ) {
                console.log(`[Notaas XML] XML obtido com sucesso pelo endpoint (${text.length} bytes)`);
                return text;
              }
            }
          }
        } catch (eEp) {
          console.warn(`[Notaas XML] Falha no endpoint ${ep}:`, eEp);
        }
      }
    }

    return undefined;
  }

  // ROTA: Obter e analisar o XML oficial de uma NFS-e no Notaas
  router.post('/notaas/fetch-xml', async (req, res) => {
    try {
      const { invoiceId, xmlUrl, apiKey, prestador } = req.body || {};
      const cleanToken = String(
        apiKey ||
          prestador?.apiKeyNotas ||
          process.env.VITE_NOTAAS_API_KEY ||
          process.env.NOTAAS_API_KEY ||
          'ntaas_zo987DbmrHkCL6iMGLVvR3lvQP6Sr9ix'
      ).trim();

      const xmlContent = await fetchXmlFromNotaas(xmlUrl, invoiceId, cleanToken);
      if (!xmlContent) {
        return res.status(404).json({
          success: false,
          error: 'XML oficial não disponível para download no Notaas no momento.',
        });
      }

      const dadosXml = parseNotaasNfseXml(xmlContent);
      return res.json({
        success: true,
        xmlConteudo: xmlContent,
        dadosXml,
      });
    } catch (err: any) {
      console.error('[Notaas Fetch XML] Erro:', err);
      return res.status(500).json({
        success: false,
        error: `Erro ao obter XML do Notaas: ${err.message}`,
      });
    }
  });

  // ROTA: Consultar status de NFS-e no Notaas e sincronizar dados do XML
  router.get('/notaas/invoice-status/:invoiceId', async (req, res) => {
    try {
      const apiKey = (req.headers['x-api-key'] || req.query.apiKey) as string;
      const { invoiceId } = req.params;

      if (!apiKey || !invoiceId) {
        return res.status(400).json({
          success: false,
          error: 'Chave de API e ID da NFS-e são obrigatórios.',
        });
      }

      const cleanToken = String(apiKey).trim();
      const statusRes = await fetch(`https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/status`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'x-api-key': cleanToken,
        },
      });

      const dataStatus: any = await statusRes.json();

      let xmlConteudo: string | undefined;
      let dadosXml: any;

      const statusRetorno = dataStatus?.status || '';
      if (
        statusRetorno === 'authorized' ||
        statusRetorno === 'emitted' ||
        statusRetorno === 'issued' ||
        dataStatus?.chNFSe ||
        dataStatus?.pdfUrl
      ) {
        const rawXml = dataStatus?.xmlUrl || dataStatus?.xml || dataStatus?.linkXml;
        xmlConteudo = await fetchXmlFromNotaas(rawXml, invoiceId, cleanToken);
        if (xmlConteudo) {
          dadosXml = parseNotaasNfseXml(xmlConteudo);
        }
      }

      return res.json({
        success: statusRes.ok,
        statusHttp: statusRes.status,
        data: dataStatus,
        xmlConteudo,
        dadosXml,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: `Erro ao consultar status no Notaas: ${err.message}`,
      });
    }
  });

  // ROTA: Emitir NFS-e via POST para API Notaas
  router.post('/notaas/emitir', async (req, res) => {
    try {
      const {
        apiKey,
        prestador,
        tomador,
        servico,
        impostos,
        informacoesComplementares,
        idExterno,
        numeroDps,
        serieDps,
        numero,
        serie,
        empresaId,
      } = req.body;

      const cleanToken = String(apiKey || prestador?.apiKeyNotas || process.env.VITE_NOTAAS_API_KEY || process.env.NOTAAS_API_KEY || 'ntaas_zo987DbmrHkCL6iMGLVvR3lvQP6Sr9ix').trim();

      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          error: 'Chave de API / Token da Notaas não configurada. Abra as Configurações e informe sua chave ntaas_*.',
        });
      }

      const tomadorCpfCnpj = String(tomador?.documento || '').replace(/\D/g, '');
      const isCnpj = tomadorCpfCnpj.length === 14;
      const prestadorCnpj = String(prestador?.cnpj || '46874965000104').replace(/\D/g, '');

      const valorTotal = Number(impostos?.valorServicos) || Number(servico?.valor) || 0;
      const aliquota = Number(impostos?.aliquotaIss) || Number(servico?.aliquotaIss) || Number(servico?.aliquota) || 2.0;
      const descServico = servico?.descricao || 'Prestação de serviços';
      const codTribNac = String(servico?.codigoTributacaoNacional || '99.01.01').trim();

      let codTribMun = '001';
      if (servico?.codigoTributacaoMunicipal && /^\d{3}$|^\d{9}$/.test(String(servico.codigoTributacaoMunicipal).trim())) {
        codTribMun = String(servico.codigoTributacaoMunicipal).trim();
      }

      const numDpsCalculado = Number(numeroDps ?? numero ?? req.body?.dps?.numero ?? 18);
      const serieDpsCalculada = String(serieDps ?? serie ?? req.body?.dps?.serie ?? prestador?.serieDps ?? '1608').trim();

      const payloadNotaas: any = {
        tipo: 'nfse',
        ambiente: prestador?.ambienteEmissao === 'PRODUCAO' ? 'producao' : 'sandbox',
        referencia: idExterno || `dps-${Date.now()}`,
        numero: numDpsCalculado,
        serie: serieDpsCalculada,
        numeroDps: numDpsCalculado,
        serieDps: serieDpsCalculada,
        dps: {
          numero: numDpsCalculado,
          serie: serieDpsCalculada,
        },
        valor: valorTotal,
        descricao: descServico,
        discriminacao: descServico,
        codigoTributacaoNacional: codTribNac,
        itemLc116: servico?.itemLC116 || servico?.itemListaServico || '1.07',
        aliquotaIss: aliquota,
        issRetido: Boolean(impostos?.issRetido),
        empresaId: empresaId || prestador?.empresaIdNotas || undefined,
        prestador: {
          cnpj: prestadorCnpj,
          razaoSocial: prestador?.razaoSocial || 'PRISCILA I PASSOS LTDA',
          inscricaoMunicipal: prestador?.inscricaoMunicipal || undefined,
        },
        tomador: {
          tipo: isCnpj ? 'PJ' : 'PF',
          tipoPessoa: isCnpj ? 'PJ' : 'PF',
          documento: tomadorCpfCnpj,
          cpfCnpj: tomadorCpfCnpj,
          cpf_cnpj: tomadorCpfCnpj,
          razaoSocial: tomador?.razaoSocial || tomador?.nome || 'Tomador',
          nome: tomador?.razaoSocial || tomador?.nome || 'Tomador',
          email: tomador?.email || '',
          telefone: tomador?.telefone ? String(tomador.telefone).replace(/\D/g, '') : undefined,
          endereco: {
            logradouro: tomador?.endereco?.logradouro || '',
            numero: tomador?.endereco?.numero || 'S/N',
            complemento: tomador?.endereco?.complemento || '',
            bairro: tomador?.endereco?.bairro || '',
            cidade: tomador?.endereco?.municipio || 'Belo Horizonte',
            municipio: tomador?.endereco?.municipio || 'Belo Horizonte',
            uf: tomador?.endereco?.uf || 'MG',
            cep: String(tomador?.endereco?.cep || '').replace(/\D/g, ''),
            codigoMunicipio: tomador?.endereco?.codigoMunicipio || '3106200',
            codigoIbge: tomador?.endereco?.codigoMunicipio || '3106200',
          },
        },
        servico: {
          discriminacao: descServico,
          descricao: descServico,
          valor: valorTotal,
          valorServicos: valorTotal,
          valorTotal: valorTotal,
          aliquota: aliquota,
          aliquotaIss: aliquota,
          issRetido: Boolean(impostos?.issRetido),
          codigoTributacaoMunicipal: codTribMun,
          codigoTributacaoNacional: codTribNac,
          itemListaServico: servico?.itemLC116 || servico?.itemListaServico || '1.07',
          itemLc116: servico?.itemLC116 || servico?.itemListaServico || '1.07',
          cnae: servico?.cnae || undefined,
        },
        valores: {
          total: valorTotal,
          servicos: valorTotal,
          aliquotaIss: aliquota,
          iss: Number(impostos?.valorIss) || (valorTotal * (aliquota / 100)),
          valorLiquido: Number(impostos?.valorLiquido) || valorTotal,
        },
        observacoes: informacoesComplementares || 'Documento emitido via Notaas.',
      };

      console.log("=== DADOS REAIS ENVIADOS AO NOTAAS ===");
      console.log("numeroDps:", payloadNotaas.numeroDps);
      console.log("serieDps:", payloadNotaas.serieDps);
      console.log("Payload Completo:", JSON.stringify(payloadNotaas, null, 2));

      const resNotaas = await fetch('https://platform.notaas.com.br/api/v1/emitir', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-api-key': cleanToken,
        },
        body: JSON.stringify(payloadNotaas),
      });

      const responseBody = await resNotaas.text();
      let dataPlat: any = {};
      try {
        dataPlat = JSON.parse(responseBody);
      } catch {
        // texto
      }

      if (resNotaas.ok || resNotaas.status === 200 || resNotaas.status === 201 || resNotaas.status === 202) {
        const invoiceId = dataPlat?.invoiceId || dataPlat?.id || dataPlat?.notaFiscalId || `notaas-${Date.now()}`;
        let statusFinal = dataPlat?.status || 'queued';
        let dadosStatus: any = dataPlat;
        let erroSefazMsg = dataPlat?.errorMessage || '';
        let erroSefazCode = dataPlat?.errorCode || '';

        // Se Notaas enfileirou ou está em processamento, realiza polling até confirmação oficial
        if (dataPlat?.queued || statusFinal === 'queued' || statusFinal === 'processing') {
          console.log(`[Notaas] Nota enfileirada no Notaas (ID: ${invoiceId}). Aguardando retorno da prefeitura/SEFAZ...`);

          const maxTentativas = 8;
          for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            try {
              const checkRes = await fetch(`https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/status`, {
                method: 'GET',
                headers: {
                  'Accept': 'application/json',
                  'x-api-key': cleanToken,
                },
              });

              if (checkRes.ok) {
                dadosStatus = await checkRes.json();
                statusFinal = dadosStatus?.status || statusFinal;
                console.log(`[Notaas] Polling tentativa ${tentativa}/${maxTentativas}: status = ${statusFinal}`);

                if (dadosStatus?.errorMessage) {
                  erroSefazMsg = dadosStatus.errorMessage;
                  erroSefazCode = dadosStatus.errorCode || '';
                } else if (Array.isArray(dadosStatus?.errors) && dadosStatus.errors.length > 0) {
                  erroSefazMsg = dadosStatus.errors[0]?.Descricao || dadosStatus.errors[0]?.mensagem || 'Rejeição SEFAZ';
                  erroSefazCode = dadosStatus.errors[0]?.Codigo || dadosStatus.errors[0]?.codigo || '';
                }

                if (
                  statusFinal === 'issued' ||
                  statusFinal === 'authorized' ||
                  statusFinal === 'emitted' ||
                  statusFinal === 'error' ||
                  erroSefazMsg ||
                  dadosStatus?.chNFSe ||
                  dadosStatus?.pdfUrl
                ) {
                  break;
                }
              }
            } catch (ePoll) {
              console.warn(`[Notaas] Falha no polling tentativa ${tentativa}:`, ePoll);
            }
          }
        }

        let chave = dadosStatus?.chNFSe || dadosStatus?.chave || dadosStatus?.chaveAcesso || dataPlat?.chNFSe || dataPlat?.chave;
        const pdf = dadosStatus?.pdfUrl || dadosStatus?.pdf || dadosStatus?.linkPdf || dataPlat?.pdfUrl || dataPlat?.pdf;
        const xml = dadosStatus?.xmlUrl || dadosStatus?.xml || dadosStatus?.linkXml || dataPlat?.xmlUrl || dataPlat?.xml;
        let codVerif = dadosStatus?.codigoVerificacao || dadosStatus?.verificacao || dataPlat?.codigoVerificacao;

        // Extrai número da NFS-e
        let numeroFinal = dadosStatus?.numero || dataPlat?.numero;
        if (!numeroFinal && dadosStatus?.numeroNfe) {
          const match = String(dadosStatus.numeroNfe).match(/0+(\d{1,9})\d{10}$/);
          if (match) {
            numeroFinal = match[1];
          } else {
            const cleanNum = String(dadosStatus.numeroNfe).replace(/\D/g, '');
            if (cleanNum.length <= 9 && cleanNum.length > 0) numeroFinal = cleanNum;
          }
        }
        if (!numeroFinal && chave) {
          const matchChave = String(chave).match(/0+(\d{1,9})\d{10}$/);
          if (matchChave) numeroFinal = matchChave[1];
        }

        const autorizada = (statusFinal === 'issued' || statusFinal === 'authorized' || statusFinal === 'emitted' || Boolean(dadosStatus?.chNFSe || dadosStatus?.pdfUrl)) && !erroSefazMsg && statusFinal !== 'error';
        const erro = statusFinal === 'error' || Boolean(erroSefazMsg);
        const processando = !autorizada && !erro;

        let xmlConteudoBaixado: string | undefined;
        let dadosXmlOficial: any;
        if (autorizada) {
          xmlConteudoBaixado = await fetchXmlFromNotaas(xml, invoiceId, cleanToken);
          if (xmlConteudoBaixado) {
            dadosXmlOficial = parseNotaasNfseXml(xmlConteudoBaixado);
            if (dadosXmlOficial.chaveAcesso) chave = dadosXmlOficial.chaveAcesso;
            if (dadosXmlOficial.numero) numeroFinal = dadosXmlOficial.numero;
            if (dadosXmlOficial.codigoVerificacao) codVerif = dadosXmlOficial.codigoVerificacao;
          }
        }

        return res.json({
          success: true,
          statusHttp: resNotaas.status,
          provedor: 'NOTAAS_PLATFORM',
          nfeId: invoiceId,
          autorizada,
          processando,
          status: autorizada ? 'AUTORIZADA' : (erro ? 'ERRO' : 'PROCESSANDO'),
          statusNotaas: statusFinal,
          rejeicaoSefaz: erroSefazMsg ? { codigo: erroSefazCode, mensagem: erroSefazMsg } : undefined,
          numero: numeroFinal ? String(numeroFinal) : undefined,
          chaveAcesso: chave,
          codigoVerificacao: codVerif,
          linkDownloadPdf: pdf,
          linkDownloadXml: xml,
          xmlConteudo: xmlConteudoBaixado,
          dadosXml: dadosXmlOficial,
          mensagem: erroSefazMsg
            ? `Nota recebida pelo Notaas (ID: ${invoiceId}), mas rejeitada pela SEFAZ: [${erroSefazCode}] ${erroSefazMsg}`
            : autorizada
            ? `NFS-e Nº ${numeroFinal || ''} autorizada e confirmada com sucesso pela API Notaas!`
            : `NFS-e registrada no Notaas (ID: ${invoiceId}) e em processamento na prefeitura/SEFAZ.`,
          dadosRetorno: dadosStatus,
        });
      }

      const errorMsg = dataPlat?.error || dataPlat?.mensagem || dataPlat?.message || responseBody || 'Erro na emissão no Notaas';
      console.error(`[Notaas] Erro da API Notaas (HTTP ${resNotaas.status}):`, errorMsg);

      return res.status(resNotaas.status || 400).json({
        success: false,
        statusHttp: resNotaas.status,
        error: errorMsg,
        detalhes: dataPlat,
        respostaBruta: responseBody,
      });
    } catch (err: any) {
      console.error('[Notaas] Erro geral ao contatar Notaas:', err);
      return res.status(500).json({
        success: false,
        error: `Erro de conexão com o Notaas: ${err.message || 'Falha de comunicação'}`,
      });
    }
  });

  // ROTA: Cancelamento Oficial de Nota no Notaas / Receita Federal
  router.post('/notaas/cancelar', async (req, res) => {
    try {
      const { invoiceId, chaveAcesso, numero, motivo, codigoMotivo, apiKey, prestador } = req.body || {};
      const cleanToken = (apiKey || prestador?.apiKeyNotas || process.env.VITE_NOTAAS_API_KEY || process.env.NOTAAS_API_KEY || '').trim();

      if (!cleanToken) {
        return res.status(400).json({
          success: false,
          error: 'Chave de API do Notaas não configurada. Informe a API Key nas Configurações.',
        });
      }

      const motivoTexto = (motivo || 'Cancelamento solicitado pelo emitente').trim();
      const codMotivo = Number(codigoMotivo) || 1;

      if (invoiceId && !invoiceId.startsWith('dps-') && !invoiceId.startsWith('nfs-')) {
        try {
          console.log(`[Notaas Cancel] Enviando requisição de cancelamento da nota ID ${invoiceId}...`);
          const resCancel = await fetch(`https://platform.notaas.com.br/api/v1/invoices/${invoiceId}/cancel`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'x-api-key': cleanToken,
            },
            body: JSON.stringify({
              motivo: motivoTexto,
              codigoMotivo: codMotivo,
              justificativa: motivoTexto,
            }),
          });

          const respText = await resCancel.text();
          let respData: any = {};
          try {
            respData = JSON.parse(respText);
          } catch {}

          if (resCancel.ok || resCancel.status === 200 || resCancel.status === 202) {
            return res.status(200).json({
              success: true,
              canceladaNotaas: true,
              message: `NFS-e Nº ${numero || ''} cancelada com sucesso no Notaas e comunicada à Receita Federal.`,
              detalhes: respData,
            });
          } else {
            const errMsg = respData?.error || respData?.message || respText || `HTTP ${resCancel.status}`;
            return res.status(resCancel.status || 400).json({
              success: false,
              canceladaNotaas: false,
              error: `Notaas retornou erro ao cancelar: ${errMsg}`,
              detalhes: respData,
            });
          }
        } catch (eReq: any) {
          console.error('[Notaas Cancel] Falha de comunicação:', eReq);
          return res.status(500).json({
            success: false,
            canceladaNotaas: false,
            error: `Falha de rede ao conectar com Notaas: ${eReq.message}`,
          });
        }
      }

      return res.status(200).json({
        success: true,
        canceladaNotaas: false,
        message: 'Nota cancelada no sistema local. Como a nota não possui ID no Notaas, verifique o cancelamento no Portal Nacional da NFS-e (nfse.gov.br).',
      });
    } catch (err: any) {
      console.error('[Notaas Cancel] Erro geral:', err);
      return res.status(500).json({
        success: false,
        error: `Erro ao processar cancelamento: ${err.message}`,
      });
    }
  });

  // Disponibiliza as rotas da API sob /api/* e como fallback em /* para serverless
  app.use('/api', router);
  app.use('/', router);

  return app;
}
