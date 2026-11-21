'use strict';
const path = require('node:path'), crypto = require('node:crypto');
const P = require('./policy.cjs');

// Conversation content is session memory, isolated by desk. Credentials never
// enter this store, renderer state, log records, or conversation history.
class AgentConversation {
  constructor(host) { this.host = host; this.desks = new Map(); this.turn = null; this.emitTimer = null; }
  record(desk = this.host.active()) {
    if (!this.desks.has(desk)) {
      if (this.desks.size >= 20) {
        const oldest = [...this.desks.keys()].find(key => key !== this.turn?.desk);
        if (oldest !== undefined) this.desks.delete(oldest);
      }
      this.desks.set(desk, {messages: [], model: '', endpoint: '', connection: 'idle', consents: new Set()});
    }
    return this.desks.get(desk);
  }
  state(privateMode) {
    if (privateMode) return {chat: [], chatDesk: '', chatModel: '', chatEndpoint: '', chatConnection: 'idle'};
    const desk = this.host.active(), value = this.desks.get(desk);
    return {chat: (value?.messages || []).map(item => ({...item})), chatDesk: desk,
      chatModel: value?.model || '', chatEndpoint: value?.endpoint || '', chatConnection: value?.connection || 'idle'};
  }
  message(record, role, text, status = 'complete') {
    const entry = {id: crypto.randomUUID(), role, text, status, time: Date.now()};
    record.messages.push(entry);
    let length = record.messages.reduce((total, item) => total + item.text.length, 0);
    while (record.messages.length > 80 || length > 250000 && record.messages.length > 2) length -= record.messages.shift().text.length;
    return entry;
  }
  emit(immediate = false) {
    if (immediate) { clearTimeout(this.emitTimer); this.emitTimer = null; this.host.emit(); return; }
    if (this.emitTimer) return;
    this.emitTimer = setTimeout(() => { this.emitTimer = null; this.host.emit(); }, 40);
    this.emitTimer.unref?.();
  }
  valid(turn) {
    const h = this.host;
    return this.turn === turn && turn.generation === h.generation && turn.desk === h.active() && !h.disposed && !h.isPrivate() && !h.browser.disposed && h.agentOpen() && !h.win?.isDestroyed?.() && (!turn.tools || h.valid());
  }
  ownsClient(client) { return !!this.turn?.tools && this.host.progressRun?.client === client && this.valid(this.turn); }
  finish(turn, phase, text, {partial = false} = {}) {
    if (this.turn !== turn) return;
    const h = this.host, reply = turn.reply, answer = String(text || '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').slice(0, 128000);
    // Revoke synchronously before waiting for process exit. Chat-stop leaves
    // the workspace connected, but that must not keep this worker authorized.
    const released = h.revokeRunClient(turn.progress?.client);
    reply.text = partial && turn.received ? reply.text + '\n\n' + answer : answer;
    reply.status = phase === 'completed' ? 'complete' : phase;
    turn.record.connection = phase === 'error' ? 'error' : phase === 'completed' || turn.received ? 'connected' : 'idle';
    if (turn.progress) {
      h.progress.finish(turn.progress.owner, 'default', {phase, statusText: answer.slice(0, 240), estimated: true});
      h.progressOwners.delete(turn.progress.owner);
      h.progress.stopOwner(turn.progress.owner + ':terminal', phase === 'completed' ? 'Задача завершена' : 'Задача остановлена');
      h.progressOwners.delete(turn.progress.owner + ':terminal');
      if (h.progressRun === turn.progress) h.progressRun = null;
    }
    this.turn = null;
    if (h.worker === turn.worker) h.worker = null;
    h.running = false;
    this.emit(true);
    return Promise.all([released, h.terminateWorker(turn.worker)]);
  }
  async start(args) {
    const h = this.host;
    h.requireMode();
    if (h.running || this.turn) throw Error('Дождитесь ответа или остановите его');
    if (!h.utilityProcess) throw Error('Процесс модели недоступен');
    const endpoint = P.endpoint(P.text(args.endpoint, 2048)).url, model = P.text(args.model, 200), task = P.text(args.task, 12000);
    const key = args.key ? P.text(args.key, 4096) : '', desk = h.active(), record = this.record(desk);
    const history = record.messages.filter(item => item.role === 'user' || item.role === 'assistant' && item.status === 'complete').map(item => ({role: item.role, content: item.text}));
    record.model = model; record.endpoint = endpoint; record.connection = 'connecting';
    this.message(record, 'user', task);
    const tools = h.valid(), reply = this.message(record, 'assistant', tools ? 'Понял. Сейчас займусь задачей.' : 'Сейчас отвечу…', 'working');
    const turn = {desk, record, reply, tools, generation: h.generation, worker: null, received: false, progress: null};
    this.turn = turn; h.running = true; this.emit(true);
    let payload = {chatOnly: !tools, requestPermissions: tools, endpoint, model, task, key, history, vision: tools && args.vision === true};
    const clear = () => { if (payload) { payload.key = ''; payload.progressToken = ''; } payload = null; };
    try {
      if (tools) {
        // A specific model is allowed to receive inspected workspace data only
        // after a visible decision. Autonomy does not bypass this consent.
        const consent = endpoint + '\n' + model + '\n' + String(args.vision === true);
        if (!record.consents.has(consent)) {
          await h.approve('model', 'Разрешить модели ' + model + ' получить сообщения этого чата и данные, которые вы попросите прочитать?\nАдрес: ' + endpoint + (args.vision === true ? '\nВы также включили отправку снимков страниц.' : ''), {force: true});
          if (!this.valid(turn)) throw Error('Отправка отменена');
          record.consents.add(consent);
        }
        const progress = {owner: 'worker:' + crypto.randomUUID(), token: crypto.randomBytes(16).toString('hex'), generation: h.generation, client: null};
        turn.progress = progress; h.progressRun = progress; h.progressOwners.add(progress.owner);
        payload.cdp = h.gateway.url; payload.progressToken = progress.token;
        h.autoProgress(progress.owner, {desk, source: 'agent', label: 'Agent Mouse', percent: null, statusText: 'Выполняю задачу', estimated: true});
      }
      if (!this.valid(turn)) throw Error('Отправка отменена');
      const child = h.utilityProcess.fork(path.join(__dirname, 'runner.cjs'), [], {serviceName: 'Agent Mouse', stdio: 'pipe', env: P.cleanEnv()});
      turn.worker = child; h.worker = child;
      child.once('spawn', () => {
        if (!this.valid(turn)) { clear(); void h.terminateWorker(child); return; }
        try { child.postMessage(payload); } catch { this.finish(turn, 'error', 'Не удалось отправить сообщение модели.'); } finally { clear(); }
      });
      child.on('message', message => {
        if (!this.valid(turn)) return;
        if (message?.type === 'delta' && !turn.tools && typeof message.text === 'string') {
          if (!turn.received) reply.text = '';
          turn.received = true; record.connection = 'connected'; reply.status = 'streaming';
          if (reply.text.length + message.text.length > 128000) { void this.finish(turn, 'error', 'Ответ превысил допустимую длину.', {partial: true}); return; }
          reply.text += message.text; this.emit();
        } else if (message?.type === 'activity' && turn.tools && typeof message.text === 'string') {
          turn.received = true; record.connection = 'connected'; reply.text = message.text.slice(0, 1200); reply.status = 'working'; this.emit();
        } else if (message?.type === 'log') h.log(message.text);
        else if (message?.type === 'done') {
          const phase = ['completed', 'stopped'].includes(message.outcome) ? message.outcome : 'error';
          void this.finish(turn, phase, message.text || 'Модель не прислала ответ.', {partial: phase === 'error' && reply.status === 'streaming'});
        }
      });
      child.on('exit', () => { clear(); if (this.turn === turn) void this.finish(turn, 'error', 'Соединение с моделью прервалось. Попробуйте отправить сообщение снова.', {partial: reply.status === 'streaming'}); });
      child.on('error', () => { clear(); if (this.turn === turn) void this.finish(turn, 'error', 'Не удалось запустить процесс модели.'); });
      child.stdout?.on('data', () => {}); child.stderr?.on('data', () => {});
      return h.state();
    } catch (error) {
      clear();
      if (this.turn === turn) await this.finish(turn, /отклон|отмен|останов/i.test(error.message) ? 'stopped' : 'error', String(error.message).slice(0, 1500));
      return h.state();
    }
  }
  async stop(reason = 'Ответ остановлен') {
    const turn = this.turn;
    if (!turn) return;
    this.host.cancelPending(reason);
    if (turn.tools && this.host.terminalService.pending) this.host.terminalService.stop();
    await this.finish(turn, 'stopped', reason, {partial: turn.reply.status === 'streaming'});
  }
  revoke() { for (const record of this.desks.values()) { record.consents.clear(); record.connection = 'idle'; } }
  clear() {
    if (this.host.running || this.turn) throw Error('Сначала остановите ответ');
    this.record().messages = [];
    this.emit(true);
    return this.host.state();
  }
}
module.exports = {AgentConversation};
