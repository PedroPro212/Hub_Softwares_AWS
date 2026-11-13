'use strict';
// Aplicação independente: nenhuma informação ou imagem é enviada a servidores.
const $ = s => document.querySelector(s);
const KEY = 'flash.laudos.v1';
const steps = ['Computador', 'Hardware', 'Temperaturas', 'Registro fotográfico', 'Diagnóstico e parecer'];
const groups = [
  [['type', 'Tipo de equipamento', 'select', 'Desktop|Notebook|All-in-one|Outro'], ['date', 'Data do atendimento', 'date']],
  [],
  [],
  [],
  [['diagnosis', 'Diagnóstico e evidências encontradas', 'textarea'], ['extraServices', 'Outros serviços executados / peças e pasta utilizadas', 'textarea'], ['upgrades', 'Upgrades recomendados (prioridade, compatibilidade e justificativa)', 'textarea'], ['attention', 'Pontos de atenção e orientações ao cliente', 'textarea'], ['limitations', 'Limitações dos testes e pendências', 'textarea'], ['returnDate', 'Revisão sugerida', 'date']]
];
const services = ['Limpeza interna', 'Troca de pasta térmica da CPU', 'Troca de pasta térmica da GPU', 'Limpeza de ventoinhas', 'Organização de cabos', 'Testes de estabilidade', 'Atualização de drivers', 'Verificação do armazenamento'];
const metrics = [['cpuIdle', 'CPU · repouso'], ['cpuMax', 'CPU · máxima'], ['gpuIdle', 'GPU · repouso'], ['gpuMax', 'GPU · máxima']];
const photoNames = { cpuBefore: 'CPU · antes', cpuAfter: 'CPU · depois', gpuBefore: 'GPU · antes', gpuAfter: 'GPU · depois' };
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => globalThis.crypto?.randomUUID?.() || `l-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const blank = () => ({ id: uid(), date: today(), type: 'Desktop', photos: {}, services: [] });
let records = [], current = blank(), dirty = false, step = 0, photoPending = 0, storageBlocked = false;
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 5500); }
try { const raw = localStorage.getItem(KEY); if (raw) { const parsed = JSON.parse(raw); if (!Array.isArray(parsed)) throw Error(); records = parsed.map(validateRecord); } } catch { storageBlocked = true; toast('Não foi possível ler o armazenamento. Exporte seus dados e verifique o navegador.'); }
function field([key, label, type, options]) { let control = type === 'textarea' ? `<textarea name="${key}" rows="4"></textarea>` : type === 'select' ? `<select name="${key}">${options.split('|').map(v => `<option>${v}</option>`).join('')}</select>` : `<input name="${key}" type="${type}" ${type === 'number' ? 'min="0" max="999" step="0.1"' : ''}  maxlength="5000">`; return `<label class="field ${type === 'textarea' ? 'full' : ''}">${label}${control}</label>`; }
function renderEditor() {
  $('#steps').innerHTML = steps.map((s, i) => `<button type="button" data-step="${i}">${String(i + 1).padStart(2, '0')} ${s}</button>`).join('');
  $('#editor').innerHTML = steps.map((title, i) => `<section class="panel" data-panel="${i}"><div class="section-heading"><span>${String(i + 1).padStart(2, '0')}</span><div><h2>${title}</h2><p>${['Identifique o atendimento e registre a condição de entrada.', 'Documente a configuração real do equipamento.', 'Compare medições feitas em condições equivalentes.', 'Documente a pasta térmica e a intervenção realizada.', 'Registre o que foi feito e oriente os próximos passos.'][i]}</p></div></div>${i === 4 ? `<div class="card"><h3>Serviços executados</h3><div class="checklist">${services.map((s, n) => `<label><input type="checkbox" data-service="${n}">${s}</label>`).join('')}</div></div>` : ''}${groups[i].length ? `<div class="card"><div class="grid">${groups[i].map(field).join('')}</div></div>` : ''}${i === 2 ? temperatureEditor() : ''}${i === 3 ? `<div class="card"><p class="hint">JPG, PNG ou WebP, até 10 MB por foto. As imagens são reduzidas para até 1.200 px e armazenadas no laudo. Mantenha os originais fora deste sistema.</p><div class="photo-grid">${Object.entries(photoNames).map(([k, n]) => `<div class="photo-slot"><h3>${n}</h3><div id="image-${k}"></div><label class="field">Selecionar foto<input type="file" accept="image/jpeg,image/png,image/webp" data-photo="${k}"></label><label class="field">Legenda<textarea name="caption_${k}" rows="2" placeholder="Descreva o estado da pasta térmica"></textarea></label><button type="button" data-remove="${k}">Remover foto</button></div>`).join('')}</div></div>` : ''}</section>`).join('');
  for (const el of $('#editor').querySelectorAll('[name]')) el.value = current[el.name] ?? '';
  for (const el of $('#editor').querySelectorAll('[data-service]')) el.checked = current.services.includes(services[+el.dataset.service]);
  // Essenciais sempre visíveis; detalhes técnicos continuam disponíveis sob demanda.
  const editor = $('#editor');
  const essentials = document.createElement('div');
  essentials.className = 'card essentials';
  essentials.innerHTML = '<h2>Dados do atendimento</h2><p class="hint">Selecione o tipo de equipamento, confira a data e marque os serviços executados.</p><div class="grid"></div>';
  const grid = essentials.querySelector('.grid');
  for (const key of ['type', 'date']) grid.append(editor.querySelector(`[name="${key}"]`).closest('label'));
  const checklist = editor.querySelector('.checklist').closest('.card');
  essentials.append(checklist);
  editor.prepend(essentials);
  editor.querySelectorAll('.panel').forEach((panel, i) => {
    if (i < 2) { panel.remove(); return; }
    const details = document.createElement('details');
    details.className = 'optional'; details.dataset.optional = i;
    const summary = document.createElement('summary');
    summary.textContent = ['Mais informações do equipamento', 'Configuração de hardware', 'Temperaturas e testes', 'Fotos do computador', 'Diagnóstico detalhado e orientações'][i] + ' (opcional)';
    panel.before(details); details.append(summary, panel);
    panel.querySelector('.section-heading').remove();
  });
  Object.keys(photoNames).forEach(renderPhoto); renderChart(); updateTitle();
}
function temperatureEditor() { return `<div class="card"><h3>Medições em °C</h3><p class="hint">Deixe em branco se não foi medido ou se não houver GPU dedicada. Máxima é o pico observado no teste; não é o limite do fabricante.</p><div class="table-wrap"><table class="temp-table"><thead><tr><th>Componente / condição</th><th>Antes (°C)</th><th>Depois (°C)</th></tr></thead><tbody>${metrics.map(([k, n]) => `<tr><th scope="row">${n}</th>${['Before', 'After'].map(s => `<td><input aria-label="${n} ${s === 'Before' ? 'antes' : 'depois'}" type="number" name="${k + s}" min="0" max="150" step="0.1" placeholder="Não medido"></td>`).join('')}</tr>`).join('')}</tbody></table></div></div><div class="card"><h3>Antes × depois</h3><div id="chart"></div><p class="hint">Escala fixa: 0 a 150 °C. Uma redução não comprova, sozinha, estabilidade ou operação dentro da especificação. Consulte os limites do modelo.</p></div>`; }
function showStep(n) { step = n; const details = document.querySelector(`[data-optional="${n}"]`); if (details) details.open = true; }
function touch() { dirty = true; $('#saveState').textContent = 'Alterações não salvas'; updateTitle(); }
function updateTitle() { $('#currentTitle').textContent = `${current.type || 'Computador'} · ${formatDate(current.date)}`; }
function number(v) { return v !== '' && v !== undefined && v !== null && Number.isFinite(Number(v)) ? Number(v) : null; }
function temp(v) { const n = number(v); return n === null ? 'Não medido' : `${n.toLocaleString('pt-BR')} °C`; }
function comparison(k) { const a = number(current[k + 'Before']), b = number(current[k + 'After']); if (a === null || b === null) return 'Comparação indisponível'; const d = b - a; return d === 0 ? 'Sem alteração' : `${d < 0 ? 'Redução' : 'Aumento'} de ${Math.abs(d).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} °C`; }
function chartHTML() { return `<div class="legend"><span><i class="dot"></i>Antes</span><span><i class="dot after"></i>Depois</span></div>${metrics.map(([k, n]) => `<div class="chart-row"><strong>${n} · ${comparison(k)}</strong>${['Before', 'After'].map(s => `<div class="bar-line"><span>${s === 'Before' ? 'Antes' : 'Depois'}</span><div class="bar-track"><div class="bar ${s === 'After' ? 'after' : ''}" style="width:${Math.max(0, Math.min(100, (number(current[k + s]) || 0) / 150 * 100))}%"></div></div><span>${temp(current[k + s])}</span></div>`).join('')}</div>`).join('')}`; }
function renderChart() { if ($('#chart')) $('#chart').innerHTML = chartHTML(); }
function renderPhoto(k) { const box = $('#image-' + k); box.replaceChildren(); if (current.photos[k]) { const img = document.createElement('img'); img.src = current.photos[k]; img.alt = photoNames[k]; box.append(img); } }
function renderRecords() { const q = $('#search').value.toLocaleLowerCase('pt-BR'); const found = records.filter(r => [r.type, formatDate(r.date), ...r.services].join(' ').toLocaleLowerCase('pt-BR').includes(q)); $('#records').innerHTML = found.length ? found.map(r => `<button class="record ${r.id === current.id ? 'active' : ''}" data-id="${esc(r.id)}"><strong>${esc(r.type || 'Computador')}</strong><small>${formatDate(r.date)}</small><small>${esc(r.services.join(' · ') || 'Nenhum serviço selecionado')}</small></button>`).join('') : '<p class="empty">Nenhum laudo encontrado.<br>Crie um novo atendimento.</p>'; }
function formatDate(v) { return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v.split('-').reverse().join('/') : 'Não informada'; }
function canLeave() { return !dirty || confirm('Há alterações não salvas. Deseja descartá-las?'); }
function openRecord(r) { current = structuredClone(r); dirty = false; step = 0; renderEditor(); renderRecords(); $('#saveState').textContent = records.some(x => x.id === r.id) ? 'Versão salva neste navegador' : 'Ainda não salvo'; }
function invalid() { for (let i = 0; i < groups.length; i++) { for (const [key, label, type] of groups[i]) { const el = $(`[name="${key}"]`); if (el && !el.checkValidity()) { showStep(i); el.closest('details')?.setAttribute('open', ''); el.reportValidity(); return true; } } } for (const [k] of metrics) { for (const s of ['Before', 'After']) { const n = number(current[k + s]); if (n !== null && (n < 0 || n > 150)) { showStep(2); toast('As temperaturas devem estar entre 0 e 150 °C.'); return true; } } for (const s of ['Before', 'After']) { const idle = number(current[(k.startsWith('cpu') ? 'cpu' : 'gpu') + 'Idle' + s]), max = number(current[(k.startsWith('cpu') ? 'cpu' : 'gpu') + 'Max' + s]); if (idle !== null && max !== null && max < idle) { showStep(2); toast('A máxima não pode ser menor que a temperatura em repouso.'); return true; } } } return false; }
function persist(next) { if (storageBlocked) { toast('Armazenamento indisponível. Exporte um JSON antes de continuar.'); return false; } try { localStorage.setItem(KEY, JSON.stringify(next)); records = next; renderRecords(); return true; } catch { toast('Não foi possível salvar: espaço insuficiente ou armazenamento bloqueado. Exporte o JSON agora; remova fotos ou laudos antigos após fazer backup.'); return false; } }
function save() { if (photoPending) { toast('Aguarde o processamento das fotos.'); return; } if (invalid()) return; current.updatedAt = new Date().toISOString(); const next = records.filter(r => r.id !== current.id); next.unshift(structuredClone(current)); if (persist(next)) { dirty = false; $('#saveState').textContent = 'Salvo neste navegador · ' + new Date().toLocaleTimeString('pt-BR'); toast('Laudo salvo neste navegador.'); } }
function download(data, name) { const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function exportData(list, name) { download({ app: 'flash-laudos', version: 1, exportedAt: new Date().toISOString(), records: list }, name); }
function validateRecord(r) { if (!r || typeof r !== 'object' || Array.isArray(r)) throw Error('Registro inválido'); const clean = blank(); if (typeof r.id !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(r.id)) throw Error('Identificador inválido'); clean.id = r.id; const keys = [...groups.flat().map(f => f[0]), ...metrics.flatMap(([k]) => [k + 'Before', k + 'After']), ...Object.keys(photoNames).map(k => 'caption_' + k), 'client', 'phone', 'email', 'os', 'equipment', 'technician', 'serial', 'status', 'accessories', 'condition', 'complaint', 'cpu', 'gpu', 'motherboard', 'ram', 'storage', 'psu', 'cooling', 'case', 'system', 'other', 'opinion', 'result', 'ambient', 'duration', 'tools', 'method', 'updatedAt']; for (const k of keys) { if (r[k] !== undefined) { if (!['string', 'number'].includes(typeof r[k]) || String(r[k]).length > 20000) throw Error('Campo inválido'); clean[k] = String(r[k]); } } for (const [k] of metrics) for (const s of ['Before', 'After']) { const v = clean[k + s]; if (v !== undefined && v !== '' && (number(v) === null || number(v) < 0 || number(v) > 150)) throw Error('Temperatura inválida'); } for (const [key, , type, opts] of groups.flat()) if (type === 'select' && clean[key] && !opts.split('|').includes(clean[key])) throw Error('Opção inválida'); clean.services = Array.isArray(r.services) ? r.services.filter(v => services.includes(v)) : []; clean.photos = {}; for (const k of Object.keys(photoNames)) { const src = r.photos?.[k]; if (src) { if (typeof src !== 'string' || src.length > 2200000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(src)) throw Error('Imagem inválida'); clean.photos[k] = src; } } return clean; }
async function importJSON(file) { try { if (!file) return; if (file.size > 25 * 1024 * 1024) throw Error('Arquivo maior que 25 MB'); const data = JSON.parse(await file.text()); if (data.app !== 'flash-laudos' || data.version !== 1 || !Array.isArray(data.records) || data.records.length > 500) throw Error('Formato ou versão incompatível'); const incoming = data.records.map(validateRecord); if (new Set(incoming.map(r => r.id)).size !== incoming.length) throw Error('IDs duplicados no arquivo'); if (!incoming.length) throw Error('Arquivo sem laudos'); if (!canLeave()) return; const duplicates = incoming.filter(r => records.some(x => x.id === r.id)).length; if (!confirm(`Importar ${incoming.length} laudo(s)? ${duplicates} laudo(s) com o mesmo identificador serão substituídos. Os demais serão mantidos.`)) return; const ids = new Set(incoming.map(r => r.id)); if (persist([...incoming, ...records.filter(r => !ids.has(r.id))])) { openRecord(incoming[0]); toast('Importação concluída.'); } } catch (e) { toast('Importação cancelada: ' + e.message); } finally { $('#importFile').value = ''; } }
async function attachPhoto(input) { const file = input.files[0], k = input.dataset.photo; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) { toast('Use JPG, PNG ou WebP de até 10 MB.'); input.value = ''; return; } const target = current; photoPending++; try { const image = await createImageBitmap(file); const scale = Math.min(1, 1200 / Math.max(image.width, image.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale)); const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height); image.close(); const src = canvas.toDataURL('image/jpeg', .76); if (src.length > 2200000) throw Error(); if (current !== target) return; current.photos[k] = src; renderPhoto(k); touch(); toast('Foto preparada. Salve o laudo para armazená-la.'); } catch { toast('Não foi possível processar a foto. Tente outra imagem.'); } finally { photoPending--; input.value = ''; } }
function reportSections() {
  const fields = list => list.filter(([k]) => String(current[k] ?? '').trim()).map(([k, label]) => [label.replace(' *', '').replace(' (opcional)', ''), current[k]]);
  return [
    ['Computador', fields(groups[0].filter(([k]) => !['date', 'os', 'status', 'technician'].includes(k)))],
    ['Testes térmicos', [...fields(groups[2]), ...metrics.filter(([k]) => number(current[k + 'Before']) !== null || number(current[k + 'After']) !== null).map(([k, label]) => [label, `Antes: ${temp(current[k + 'Before'])} | Depois: ${temp(current[k + 'After'])}`])]],
    ['Serviços executados', current.services.map(s => ['', s])],
    ['Diagnóstico detalhado e orientações', fields(groups[4])]
  ].filter(([, rows]) => rows.length);
}
function buildPDF() {
  if (photoPending) { toast('Aguarde o processamento das fotos.'); return null; }
  if (invalid()) return null;
  if (!window.jspdf) { toast('Não foi possível carregar o gerador de PDF. Recarregue a página.'); return null; }
  const doc = new window.jspdf.jsPDF({ unit: 'mm', format: 'a5' });
  doc.setProperties({ title: 'Laudo técnico - Flash Informática', author: 'Flash Informática' });
  const ink = [30, 35, 44], red = [194, 37, 49], muted = [91, 99, 112];
  let y = 0, sectionNumber = 0;
  function font(size, bold = false, color = ink) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); doc.setTextColor(...color); }
  function pageHeader(first = false) {
    doc.setFillColor(...red); doc.rect(10, 10, 2, first ? 23 : 9, 'F');
    font(first ? 19 : 12, true); doc.text('FLASH', 16, first ? 18 : 16);
    font(first ? 9 : 8, true, red); doc.text('INFORMÁTICA', first ? 43 : 35, first ? 18 : 16);
    if (first) {
      font(8, false, muted); doc.text('CUIDADO E PRECISÃO PARA SEU COMPUTADOR', 16, 24);
      font(18, true); doc.text('Laudo técnico', 16, 33);
      doc.setFillColor(244, 245, 247); doc.roundedRect(10, 40, 128, 17, 2, 2, 'F');
      font(7, true, muted); doc.text('EQUIPAMENTO', 15, 46); doc.text('DATA DO ATENDIMENTO', 83, 46);
      font(10, true); doc.text(current.type || 'Computador', 15, 52); doc.text(formatDate(current.date), 83, 52); y = 63;
    } else { font(8, false, muted); doc.text('LAUDO TÉCNICO', 138, 16, {align: 'right'}); y = 26; }
  }
  function ensure(height) { if (y + height > 193) { doc.addPage(); pageHeader(); } }
  function text(value, size = 9.5, bold = false, color = ink, x = 10, width = 128) {
    font(size, bold, color);
    const lines = doc.splitTextToSize(String(value), width);
    for (const line of lines) { ensure(5); font(size, bold, color); doc.text(line, x, y); y += size * .46; }
  }
  function section(title) {
    ensure(20); sectionNumber++;
    doc.setFillColor(...red); doc.roundedRect(10, y - 3.5, 8, 7, 1, 1, 'F');
    font(8, true, [255, 255, 255]); doc.text(String(sectionNumber).padStart(2, '0'), 14, y + 1, {align:'center'});
    font(11, true); doc.text(title, 21, y + 1);
    doc.setDrawColor(220, 224, 230); doc.line(10, y + 7, 138, y + 7); y += 14;
  }
  pageHeader(true);
  if (current.services.length) {
    section('Serviços executados');
    for (const service of current.services) {
      ensure(7); doc.setFillColor(...red); doc.circle(12, y - 1, .8, 'F'); text(service, 9.5, false, ink, 17, 121); y += 2;
    }
    y += 4;
  }
  const readings = metrics.filter(([key]) => number(current[key + 'Before']) !== null || number(current[key + 'After']) !== null);
  if (readings.length) {
    ensure(23 + readings.length * 10); section('Temperaturas e testes');
    doc.setFillColor(244, 245, 247); doc.rect(10, y - 4, 128, 8, 'F');
    font(7.5, true, muted); doc.text('MEDIÇÃO', 13, y + 1); doc.text('ANTES', 75, y + 1); doc.text('DEPOIS', 108, y + 1); y += 10;
    for (const [key, label] of readings) {
      font(9); doc.text(label, 13, y); doc.text(temp(current[key + 'Before']), 75, y); font(9, true); doc.text(temp(current[key + 'After']), 108, y);
      doc.setDrawColor(231, 234, 238); doc.line(10, y + 3, 138, y + 3); y += 10;
    }
    text('Valores medidos em °C. Máxima corresponde ao pico observado durante o teste.', 7.5, false, muted); y += 6;
  }
  const details = groups[4].filter(([key]) => String(current[key] ?? '').trim());
  if (details.length) {
    section('Diagnóstico e orientações');
    const labels = { diagnosis: 'Diagnóstico', extraServices: 'Detalhes dos serviços', upgrades: 'Upgrades recomendados', attention: 'Orientações de uso', limitations: 'Limitações e pendências', returnDate: 'Revisão sugerida' };
    for (const [key, label] of details) {
      ensure(15); text(labels[key] || label, 8.5, true, red);
      text(key === 'returnDate' ? formatDate(current[key]) : current[key]); y += 4;
    }
    y += 3;
  }
  const photos = Object.entries(photoNames).filter(([key]) => current.photos[key]);
  if (photos.length) {
    ensure(88); section('Registro fotográfico');
    for (const [key, name] of photos) {
      const img = doc.getImageProperties(current.photos[key]);
      const scale = Math.min(120 / img.width, 58 / img.height), w = img.width * scale, h = img.height * scale;
      ensure(h + 19); text(name, 9, true);
      doc.setFillColor(245, 246, 248); doc.roundedRect(10, y - 1, 128, h + 4, 2, 2, 'F');
      doc.addImage(current.photos[key], img.fileType, 10 + (128 - w) / 2, y + 1, w, h); y += h + 8;
      if (current['caption_' + key]) text(current['caption_' + key], 8, false, muted);
      y += 5;
    }
  }
  const pages = doc.getNumberOfPages();
  for (let n = 1; n <= pages; n++) {
    doc.setPage(n); doc.setDrawColor(...red); doc.setLineWidth(.5); doc.line(10, 198, 138, 198);
    font(7, true, muted); doc.text('FLASH INFORMÁTICA', 10, 203);
    font(7, false, muted); doc.text('flashparaiso.com.br', 10, 207); doc.text(`${n} / ${pages}`, 138, 204, {align: 'right'});
  }
  return doc;
}
function pdfName() { return 'laudo-' + [current.type, current.date, current.id.slice(0, 8)].join('-').replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 70) + '.pdf'; }
function generatePDF() { const doc = buildPDF(); if (!doc) return; doc.save(pdfName()); toast('PDF A5 gerado. Imprima em tamanho real (100%).'); }
let previewURL = null, previewDocument = null;
function preview() {
  const doc = buildPDF(); if (!doc) return;
  if (previewURL) URL.revokeObjectURL(previewURL);
  previewDocument = doc; previewURL = URL.createObjectURL(doc.output('blob'));
  $('#pdfFrame').src = previewURL; $('#openPDF').href = previewURL;
  $('#previewDialog').showModal();
}
$('#previewDownload').onclick = () => { if (previewDocument) previewDocument.save(pdfName()); };
$('#previewDialog').addEventListener('close', () => { $('#pdfFrame').removeAttribute('src'); $('#openPDF').removeAttribute('href'); if (previewURL) URL.revokeObjectURL(previewURL); previewURL = null; previewDocument = null; });
$('#editor').addEventListener('submit', e => e.preventDefault());
$('#editor').addEventListener('input', e => { if (e.target.name) { current[e.target.name] = e.target.value; touch(); if (e.target.type === 'number') renderChart(); } if (e.target.dataset.service !== undefined) { current.services = [...$('#editor').querySelectorAll('[data-service]:checked')].map(el => services[+el.dataset.service]); touch(); } });
$('#editor').addEventListener('change', e => { if (e.target.dataset.photo) attachPhoto(e.target); });
$('#editor').addEventListener('click', e => { const k = e.target.dataset.remove; if (k) { delete current.photos[k]; renderPhoto(k); touch(); } });
$('#steps').addEventListener('click', e => { if (e.target.dataset.step !== undefined) showStep(+e.target.dataset.step); });
$('#next').onclick = generatePDF;
$('#pdf').onclick = generatePDF;
$('#new').onclick = () => { if (canLeave()) openRecord(blank()); };
$('#save').onclick = save; $('#preview').onclick = preview; $('#closePreview').onclick = () => $('#previewDialog').close();
$('#search').oninput = renderRecords; $('#records').onclick = e => { const b = e.target.closest('[data-id]'); if (b && canLeave()) openRecord(records.find(r => r.id === b.dataset.id)); };
$('#export').onclick = () => exportData([current], 'flash-laudo-' + current.id + '.json'); $('#exportAll').onclick = () => { if (!records.length) { toast('Nenhum laudo salvo para exportar. Use “Exportar este JSON” para o laudo aberto.'); return; } exportData(records, 'flash-backup-' + today() + '.json'); if (dirty) toast('Backup dos laudos salvos. O laudo aberto tem alterações não salvas.'); };
$('#import').onclick = () => $('#importFile').click(); $('#importFile').onchange = e => importJSON(e.target.files[0]);
$('#delete').onclick = () => { if (!confirm('Excluir este laudo e suas fotos deste navegador? Esta ação não pode ser desfeita.')) return; const next = records.filter(r => r.id !== current.id); if (!records.some(r => r.id === current.id) || persist(next)) { openRecord(blank()); toast('Laudo excluído.'); } };
$('#demo').onclick = () => { if (!canLeave()) return; openRecord({ ...blank(), os: 'EXEMPLO-001', client: 'Cliente de demonstração', equipment: 'Desktop de demonstração', technician: 'Técnico de exemplo', cpu: 'AMD Ryzen 5 5600', gpu: 'NVIDIA GeForce RTX 3060', ram: '16 GB DDR4 · 2 × 8 GB · 3200 MHz', storage: 'SSD NVMe 500 GB', motherboard: 'B550 · modelo a confirmar', psu: 'Modelo e potência a confirmar', cooling: 'Air cooler', system: 'Windows 11', complaint: 'Temperatura elevada sob carga.', ambient: '25', duration: '20', tools: 'Exemplo ilustrativo: teste de carga controlado', method: 'Mesmo ambiente e perfil de ventilação. Dados fictícios para demonstrar o sistema.', cpuIdleBefore: '52', cpuIdleAfter: '36', cpuMaxBefore: '94', cpuMaxAfter: '72', gpuIdleBefore: '48', gpuIdleAfter: '39', gpuMaxBefore: '86', gpuMaxAfter: '74', services: ['Limpeza interna', 'Troca de pasta térmica da CPU', 'Testes de estabilidade'], diagnosis: 'Exemplo: acúmulo de poeira e pasta térmica ressecada na CPU.', upgrades: 'Exemplo: avaliar SSD de maior capacidade conforme uso e compatibilidade da placa-mãe.', attention: 'Manter entradas de ar desobstruídas e observar ruídos e temperaturas.', opinion: 'Exemplo fictício: redução térmica observada após manutenção. Conferir limites oficiais dos modelos antes de concluir a análise.', result: 'Apto com ressalvas', limitations: 'Dados de demonstração. Não representam testes reais.' }); touch(); };
window.addEventListener('beforeunload', e => { if (dirty || photoPending) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('storage', e => { if (e.key === KEY) { storageBlocked = true; toast('Os laudos foram alterados em outra aba. Exporte o laudo aberto e recarregue esta página para evitar sobrescritas.'); } });
renderEditor(); renderRecords();
