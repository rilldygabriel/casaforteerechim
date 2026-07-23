const GRAPH_API_VERSION = process.env.WHATSAPP_GRAPH_API_VERSION || 'v23.0';

function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function clean(value, max = 600) {
  return String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function formatBoolean(value) {
  return value === true || value === 'Sim' ? 'Sim' : 'Não';
}

function visitorMessage(data) {
  return [
    'NOVO VISITANTE — CASA FORTE',
    '',
    `Nome: ${clean(data.nome, 120)}`,
    `WhatsApp: ${clean(data.telefone, 40)}`,
    `Cidade: ${clean(data.cidade, 80) || 'Não informado'}`,
    `Bairro: ${clean(data.bairro, 80) || 'Não informado'}`,
    `Quer acompanhamento: ${formatBoolean(data.acompanhamento)}`,
    `Convidado por: ${clean(data.convidado_por, 120) || 'Não informado'}`,
    `Igreja anterior: ${clean(data.igreja_anterior, 120) || 'Não informado'}`,
    `Passo de fé: ${clean(data.passo_fe, 100) || 'Não informado'}`,
    `Quer mensagem do pastor: ${formatBoolean(data.mensagem_pastor)}`,
    `Experiência no culto: ${clean(data.experiencia_culto, 80) || 'Não informado'}`,
    `Deseja voltar: ${clean(data.voltar_culto, 120) || 'Não informado'}`
  ].join('\n');
}

function prayerMessage(data) {
  return [
    'NOVO PEDIDO DE ORAÇÃO — CASA FORTE',
    '',
    `Nome: ${clean(data.nome, 120)}`,
    `WhatsApp: ${clean(data.telefone, 40)}`,
    `Categoria: ${clean(data.categoria, 80) || 'Não informada'}`,
    `Deseja contato: ${clean(data.deseja_contato, 20) || 'Não informado'}`,
    '',
    `Pedido: ${clean(data.pedido, 900)}`
  ].join('\n');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Método não permitido.' });
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const destination = process.env.WHATSAPP_NOTIFICATION_TO;
  const templateName = process.env.WHATSAPP_TEMPLATE_NAME;
  const templateLanguage = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'pt_BR';

  if (!accessToken || !phoneNumberId || !destination || !templateName) {
    console.error('WhatsApp não configurado: faltam variáveis de ambiente.');
    return json(res, 503, { ok: false, error: 'Notificação ainda não configurada.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const type = body?.type;
  const data = body?.data || {};

  if (!['visitante', 'pedido_oracao'].includes(type)) {
    return json(res, 400, { ok: false, error: 'Tipo de notificação inválido.' });
  }

  if (!clean(data.nome, 120) || !clean(data.telefone, 40)) {
    return json(res, 400, { ok: false, error: 'Nome e telefone são obrigatórios.' });
  }

  const message = type === 'visitante' ? visitorMessage(data) : prayerMessage(data);
  const endpoint = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: destination.replace(/\D/g, ''),
    type: 'template',
    template: {
      name: templateName,
      language: { code: templateLanguage },
      components: [
        {
          type: 'body',
          parameters: [{ type: 'text', text: message }]
        }
      ]
    }
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Erro da WhatsApp Cloud API:', result);
      return json(res, 502, { ok: false, error: 'A Meta recusou a notificação.' });
    }

    return json(res, 200, { ok: true, messageId: result.messages?.[0]?.id || null });
  } catch (error) {
    console.error('Falha ao enviar notificação pelo WhatsApp:', error);
    return json(res, 500, { ok: false, error: 'Falha interna ao enviar a notificação.' });
  }
}
