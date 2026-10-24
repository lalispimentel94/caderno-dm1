// Função de servidor (Vercel). Recebe as fotos do diário, chama a API da Anthropic
// com a chave guardada no servidor e devolve só o JSON com os valores lidos.
// Variáveis de ambiente (configuradas no painel da Vercel, nunca no código):
//   ANTHROPIC_API_KEY  chave da API da Anthropic
//   ACCESS_CODE        código de acesso que o usuário digita na página
//   MODEL_DEFAULT      (opcional) modelo do modo "Padrão"
//   MODEL_CAREFUL      (opcional) modelo do modo "Cuidadoso"

const crypto = require('crypto');

const MODEL_DEFAULT = process.env.MODEL_DEFAULT || 'claude-sonnet-5-5';
const MODEL_CAREFUL = process.env.MODEL_CAREFUL || 'claude-opus-5-5';
const MAX_IMAGES = 3;
const MAX_B64_TOTAL = 3_600_000; // limite da Vercel é ~4,5 MB por requisição

const PROMPT = [
  'Você recebe fotos de UM diário de glicemias capilares manuscrito: uma tabela "TABELA DE GLICEMIAS" com uma linha por dia (1 a 31) e as colunas CAFÉ, ALMOÇO, LANCHE, JANTAR, CEIA e OBSERVAÇÕES.',
  'Se houver mais de uma imagem, a primeira mostra a página inteira e as demais são recortes ampliados da parte superior e da parte inferior da mesma página (com sobreposição no meio). Use os recortes para ler os dígitos com precisão e a imagem inteira para conferir a linha de cada dia.',
  'Tarefa: transcrever os valores numéricos de glicemia (mg/dL) escritos à mão, dia por dia.',
  'Regras:',
  '- Ignore círculos desenhados em volta dos números: não fazem parte do valor.',
  '- Se um número foi escrito por cima de outro (rasura), leia o valor mais provável e inclua a célula em "duvidas".',
  '- Célula vazia é null. Não invente valores nem preencha dias em branco.',
  '- Valores plausíveis ficam entre 20 e 600. Se um dígito for ambíguo (como 1 e 7, 3 e 8, 0 e 6), dê o melhor palpite e inclua a célula em "duvidas".',
  '- Ignore nomes, assinaturas, observações e qualquer dado de identificação: não os transcreva.',
  'Responda SOMENTE com JSON neste formato:',
  '{"mes":"MM/AAAA ou null","linhas":[[cafe,almoco,lanche,jantar,ceia],...],"duvidas":[[dia,periodo],...]}',
  '"linhas" tem uma lista por dia, a partir do dia 1, até o último dia que tenha algum valor. Em "duvidas", dia vai de 1 a 31 e periodo de 0 (café) a 4 (ceia).'
].join('\n');

function sameSecret(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function fail(res, status, code) {
  res.status(status).json({ error: code });
}

function extractJson(text) {
  const t = String(text || '').trim();
  try { return JSON.parse(t); } catch (e) { /* tenta extrair */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { /* cai abaixo */ }
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return fail(res, 405, 'method_not_allowed');

  const key = process.env.ANTHROPIC_API_KEY;
  const access = process.env.ACCESS_CODE;
  if (!key || !access) return fail(res, 500, 'server_not_configured');

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = null; }
  }
  if (!body || typeof body !== 'object') return fail(res, 400, 'bad_request');

  if (!sameSecret(body.code || '', access)) return fail(res, 401, 'bad_code');

  const imgs = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
  if (!imgs.length) return fail(res, 400, 'no_images');
  let total = 0;
  for (const s of imgs) {
    if (typeof s !== 'string' || !/^[A-Za-z0-9+/=]+$/.test(s)) return fail(res, 400, 'bad_image');
    total += s.length;
  }
  if (total > MAX_B64_TOTAL) return fail(res, 413, 'too_large');

  const model = body.modo === 'complex' ? MODEL_CAREFUL : MODEL_DEFAULT;

  const content = imgs.map(data => ({
    type: 'image',
    source: { type: 'base64', media_type: 'image/jpeg', data }
  }));
  content.push({ type: 'text', text: PROMPT });

  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        messages: [{ role: 'user', content }]
      })
    });
  } catch (e) {
    return fail(res, 502, 'upstream_error');
  }

  if (r.status === 429) return fail(res, 429, 'rate_limited');
  if (r.status === 413) return fail(res, 413, 'too_large');
  if (r.status === 400) return fail(res, 422, 'image_rejected');
  if (r.status === 401 || r.status === 403) return fail(res, 502, 'server_key_invalid');
  if (!r.ok) return fail(res, 502, 'upstream_error');

  let out;
  try { out = await r.json(); } catch (e) { return fail(res, 502, 'upstream_error'); }

  if (out.stop_reason === 'refusal') return fail(res, 422, 'refused');
  const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  if (!text.trim()) return fail(res, 502, 'empty_completion');

  const data = extractJson(text);
  if (!data || !Array.isArray(data.linhas)) return fail(res, 502, 'invalid_json');

  // Devolve só o necessário, sem eco da imagem nem da resposta bruta.
  res.status(200).json({
    mes: typeof data.mes === 'string' ? data.mes : null,
    linhas: data.linhas.slice(0, 31),
    duvidas: Array.isArray(data.duvidas) ? data.duvidas.slice(0, 200) : []
  });
};
