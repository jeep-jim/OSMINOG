import hashlib,pathlib,subprocess
p=pathlib.Path('gpt-presence.js');before=p.read_bytes()
assert hashlib.sha256(before).hexdigest()=='e971f11ccfb86fd7be85c761e14e5ccac1b483dcb2a3b748ab48bda1e46206c9'
s=before.decode()
pairs=[
('return changed||!!meta.canvasChanged||!!payload.patch?.actions?.length||tools.has("propose_canvas_patch")','return !!meta.canvasChanged||!!meta.canvasPrepared&&!meta.fatalExecutionError'),
('"Готово — изменение подготовлено на холсте."','"Правка подготовлена и ожидает применения на холсте."'),
('if(staged?.error){activity(`Patch отклонён: ${staged.error}`,true);return false}','if(staged?.ok!==true||!staged.proposalId){if(currentPromptMeta)currentPromptMeta.canvasPrepared=null;activity(`Patch отклонён: ${staged?.error||"нет подтверждения подготовки"}`,true);return false}\n    if(currentPromptMeta)currentPromptMeta.canvasPrepared=staged.proposalId;'),
('const applied=B.applyPatch?.(staged.proposalId);if(!applied?.applied){activity(applied?.error||"Правка не применена",true);return false}','const applied=B.applyPatch?.(staged.proposalId);if(currentPromptMeta)currentPromptMeta.canvasPrepared=null;if(applied?.cancelled)throw new Error("Правка отменена пользователем; изменения не применены");if(!applied?.applied){if(currentPromptMeta)currentPromptMeta.fatalExecutionError=applied?.error||"Правка не применена";activity(applied?.error||"Правка не применена",true);return false}'),
('if(tool==="propose_canvas_patch"&&q("#gptPresenceApply")?.value==="direct"){const applied=B.applyPatch?.(result.proposalId);result={...result,...applied};if(applied?.applied){currentPromptMeta.canvasChanged=true;await persist()}}','if(tool==="propose_canvas_patch"){currentPromptMeta.canvasPrepared=result.staged&&result.proposalId||null;if(q("#gptPresenceApply")?.value==="direct"){const applied=B.applyPatch?.(result.proposalId);currentPromptMeta.canvasPrepared=null;if(applied?.cancelled)throw new Error("Правка отменена пользователем; изменения не применены");result={...result,...applied};if(applied?.applied){currentPromptMeta.canvasChanged=true;await persist()}else currentPromptMeta.fatalExecutionError=applied?.error||"Правка не применена"}}'),
('&&!patchRetrying&&!currentPromptMeta.canvasChanged&&!reviewWasAwaiting)','&&!patchRetrying&&!currentPromptMeta.canvasChanged&&!currentPromptMeta.canvasPrepared&&!reviewWasAwaiting)'),
('else if(currentPromptMeta?.execution==="canvas"&&!isGeneratedImageAction(currentPromptMeta.text)&&!currentPromptMeta.canvasChanged&&!reviewWasAwaiting)changed=','else if(currentPromptMeta?.execution==="canvas"&&!isGeneratedImageAction(currentPromptMeta.text)&&!currentPromptMeta.canvasChanged&&!currentPromptMeta.canvasPrepared&&!reviewWasAwaiting)changed='),
('finishResponseProgress(review?.required&&review.passed?"Готово · проверено":changed?"Готово · применено":"Готово");busy=false;','finishResponseProgress(!executionSatisfied(currentPromptMeta,payload,changed)?"Не завершено":currentPromptMeta.canvasPrepared&&!currentPromptMeta.canvasChanged?"Ожидает применения":review?.required&&review.passed?"Готово · проверено":currentPromptMeta.canvasChanged?"Готово · применено":"Готово");busy=false;'),
('tools:ctx.capabilities.tools.filter(n=>/^(provider_|media_|project_folder_)/.test(n))','tools:(ctx.capabilities.tools||[]).filter(n=>/^(provider_|media_|project_folder_)/.test(n))')]
for a,b in pairs:
 assert s.count(a)==1,a
 s=s.replace(a,b)
assert hashlib.sha256(s.encode()).hexdigest()=='2def588cd605b827fc82f7c098489f36a446f80d15cb910fb3ef32d9ece8620d'
p.write_bytes(s.encode())
p=pathlib.Path('tests/agent-session-409.cjs');p.write_text(p.read_text()+"\nrequire('./patch-outcome-409.cjs');\n")
for f in ['patch-outcome-409','agent-session-409','provider-session-isolation-3218','privacy-no-mirroring','team-null-response-3203']:
 subprocess.run(['node','tests/'+f+'.cjs'],check=True)
