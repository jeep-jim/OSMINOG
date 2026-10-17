'use strict';
// On-demand only: no sampling timer, URL paths, titles, prompts or file contents.
function report(app,win,browser){
 const owners=new Map();
 const add=(wc,label)=>{if(!wc||wc.isDestroyed())return;const pid=wc.getOSProcessId();if(!pid)return;const labels=owners.get(pid)||new Set();labels.add(label);owners.set(pid,labels)};
 add(win?.webContents,'Оболочка / холст');
 for(const t of [...(browser?.tabs?.values()||[]),...(browser?.providers?.values()||[])]){let host='страница';try{host=new URL(t.url).hostname}catch{}add(t.view?.webContents,`${t.ephemeral?'Служебная вкладка':t.visible?'Видимая вкладка':'Фоновая вкладка'}: ${host}`)}
 const processes=app.getAppMetrics().map(m=>({pid:m.pid,type:m.type,labels:[...(owners.get(m.pid)||[m.name||m.type])],workingSetKB:m.memory?.workingSetSize??null,privateKB:m.memory?.privateBytes??null,cpuPercent:m.cpu?.percentCPUUsage??null}));
 return{at:new Date().toISOString(),processes,totalWorkingSetKB:processes.reduce((sum,p)=>sum+(p.workingSetKB||0),0),note:'Рабочий набор процессов может включать общие страницы памяти. Это не точный аналог столбца памяти Диспетчера задач. CPU — среднее между запросами; первый замер не является интервалом простоя.'};
}
function format(r){const mb=k=>k==null?'—':(k/1024).toFixed(1)+' МБ';return r.processes.map(p=>`${p.labels.join(', ')}\nPID ${p.pid} · память ${mb(p.workingSetKB)} · CPU ${p.cpuPercent==null?'—':p.cpuPercent.toFixed(1)+'%'}`).join('\n\n')+`\n\nСумма рабочих наборов: ${mb(r.totalWorkingSetKB)}\n${r.note}`}
module.exports={report,format};
