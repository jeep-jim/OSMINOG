from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
OLD_CONTEXT_COMMIT = "3d6de3b8a9f90b688676214eac94f88237a576b8"


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, got {count}: {old[:120]!r}")
    write(path, text.replace(old, new, 1))


def replace_in_block(path, start_marker, end_marker, old, new):
    text = read(path)
    start = text.find(start_marker)
    if start < 0:
        raise RuntimeError(f"{path}: start marker not found: {start_marker!r}")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{path}: end marker not found: {end_marker!r}")
    block = text[start:end]
    count = block.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one scoped match, got {count}: {old[:120]!r}")
    block = block.replace(old, new, 1)
    write(path, text[:start] + block + text[end:])


def regex_once(path, pattern, replacement, flags=0):
    text = read(path)
    # Use a callable replacement so JavaScript backslashes are never interpreted
    # as Python replacement escapes/backreferences.
    next_text, count = re.subn(pattern, lambda _m: replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one regex match, got {count}: {pattern[:120]!r}")
    write(path, next_text)


# 1) Direct ChatGPT transport: advertise the same owner tool surface as the real bridge.
replace_once(
    "background.js",
    "project_list,project_create,project_switch,project_rename,project_folder_status",
    "project_list,project_create,project_switch,project_rename,project_revisions,project_checkpoint,project_restore_revision,project_folder_status",
)
replace_once(
    "background.js",
    "module_list,module_open,module_remove,module_permissions_revoke,window_list",
    "module_list,module_create,module_update,module_test,module_open,module_remove,module_permissions_revoke,workspace_read,workspace_patch,icon_set,icon_reset,window_list",
)

# 2) Chat runtime: keep capability declarations consistent with bridge.js.
replace_once(
    "gpt-presence.js",
    '"project_list","project_create","project_switch","project_rename","project_folder_status"',
    '"project_list","project_create","project_switch","project_rename","project_revisions","project_checkpoint","project_restore_revision","project_folder_status"',
)
replace_once(
    "gpt-presence.js",
    '"module_list","module_open","module_remove","module_permissions_revoke","window_list"',
    '"module_list","module_create","module_update","module_test","module_open","module_remove","module_permissions_revoke","workspace_read","workspace_patch","icon_set","icon_reset","window_list"',
)
replace_in_block(
    "gpt-presence.js",
    '  function contextForPrompt(prompt="",threadOverride=null,pinsOverride=null){',
    '\n  async function pushContext',
    '"media_crew","project_folder_status"',
    '"media_crew","project_list","project_create","project_switch","project_rename","project_revisions","project_checkpoint","project_restore_revision","project_folder_status"',
)
replace_in_block(
    "gpt-presence.js",
    '  function contextForPrompt(prompt="",threadOverride=null,pinsOverride=null){',
    '\n  async function pushContext',
    '"github_dispatch_workflow","module_status"]}},policy:',
    '"github_dispatch_workflow","module_status","module_list","module_create","module_update","module_test","module_open","module_remove","module_permissions_revoke","workspace_read","workspace_patch","icon_set","icon_reset","dev_status","list_dev_files","read_dev_file","write_dev_file","source_publish","release_publish"]}},policy:',
)

# 3) Restore visible, sequential execution progress. These are concise status events,
#    not hidden chain-of-thought, and they remain excluded from the model prompt history.
replace_once(
    "gpt-presence.js",
    'function add(role,text,attachments=[],meta={}){if(meta.author==="OSMINOG"&&(meta.source==="progress"||meta.source==="runtime")){activity(String(text||""),meta.source==="runtime");return Promise.resolve()}if(!String(text||"").trim()&&!attachments.length)return Promise.resolve();',
    'function add(role,text,attachments=[],meta={}){if(meta.author==="OSMINOG"&&(meta.source==="progress"||meta.source==="runtime")){activity(String(text||""),meta.source==="runtime");}if(!String(text||"").trim()&&!attachments.length)return Promise.resolve();',
)

# 4) Utilities such as a stopwatch/timer/calculator are real apps, not loose canvas primitives.
new_execution_mode = r'''  function executionMode(text=""){const v=String(text||"");if(/(выпусти|опубликуй|зарелиз|релиз|запиши|собери).{0,28}(верси|release)|(?:version|release).{0,28}(publish|ship|record)/i.test(v))return"release";if(/(запиши|сохрани|отправь|закоммить|залей).{0,30}(репозитор|гитхаб|github)|(?:commit|push|write).{0,24}(repo|github)/i.test(v))return"repository";const product=/(OSMINOG|осьминог|продукт|редактор|интерфейс|верстк|в[её]рстк|модул|магазин|окн|панел|шапк|тре[йя]|браузер|инструмент|github|гитхаб|исходник|код\s+продукт|editor\.js|background\.js|manifest\.json|poseidon|посейдон)/i.test(v),productEdit=product&&/(исправ|почин|передел|измени|добав|убер|удал|верни|сделай|науч|обнов|реализ|fix|change|update|remove|add|refactor)/i.test(v),canvasExplicit=/(на\s+(?:этом\s+)?(?:холст|доск)|объект\s+на\s+холст|сло[йя]\s+на\s+холст|canvas\s+object|on\s+the\s+canvas)/i.test(v),selfProduct=/(продукт|сам(?:ого)?\s+(?:OSMINOG|осьминог|себя)|интерфейс\s+(?:OSMINOG|осьминог)|верстк.{0,24}(?:OSMINOG|осьминог|продукт)|код\s+(?:OSMINOG|осьминог|продукт)|editor\.js|background\.js|manifest\.json)/i.test(v),appVerb=/(созда|сдела|собер|напиш|реализ|добав|запуст|build|create|make|implement)/i.test(v),appNoun=/(приложени|мини[- ]?приложени|расширени|модул|виджет|плеер|студи|секундомер|таймер|часы|будильник|калькулятор|конвертер|диктофон|заметк|todo|to-do|app|extension|module|widget|player|stopwatch|timer|clock|alarm|calculator|converter|recorder|notes?)/i.test(v),visualMock=/(макет|рисунк|нарис|схем|wireframe|mockup|sketch)/i.test(v),appBuild=appVerb&&appNoun&&!visualMock;if(appBuild&&!selfProduct)return"app";if(productEdit&&!canvasExplicit)return"source";if(isEditPrompt(v))return"canvas";if(/(начинай|продолжай|не останавливайся|делай дальше|выполняй|приступай|finish it|continue|keep going|go ahead)/i.test(v))return"action";return"chat"}'''
regex_once("gpt-presence.js", r'^  function executionMode\(text=""\)\{.*$', new_execution_mode, flags=re.M)

replace_once(
    "gpt-presence.js",
    'Create the requested app with module_create. Prefer runtime=native and template voice-assistant, clock or panel so the app is a direct OSMINOG interface with no iframe or generic wrapper. Use sandbox HTML only when arbitrary third-party code truly requires isolation. Then call module_test; never claim installation until the returned checks say ok and persisted=true. For an existing module use module_update followed by module_test.',
    'Create the requested app as a real OSMINOG module, never as loose canvas shapes/buttons or a browser placeholder. Prefer runtime=native only for behavior covered by a built-in native template such as voice-assistant or clock, or for a declarative panel. For any other interactive utility or application, use module_create with runtime=sandbox and one complete standalone HTML document with inline CSS/JavaScript. module_create performs launch verification and must return test.ok=true and persisted=true before you claim success. For an existing module use module_update and verify it with module_test.',
)

# 5) Preserve the direct-session HTML path as a safe fallback: turn returned HTML
#    into a real, tested Module Store application instead of looping for 12 hops.
new_install_app = r'''  async function installWorkspaceApp(answer=""){
    const meta=currentPromptMeta;if(!meta)return false;const name=workspaceAppName(meta.text),html=extractWorkspaceHtml(answer);if(!html){activity("Приложение не установлено: ИИ не передал исполняемый HTML. Продолжаю через Module Runtime.",true);return false}
    const id=`custom-${name.toLowerCase().replace(/[^a-z0-9а-яё]+/gi,"-").replace(/^-+|-+$/g,"")||Date.now()}`,icon=(name.replace(/^OSMINOG\s+/i,"").match(/[\p{L}\p{N}]/u)?.[0]||"A").toUpperCase(),utility=/(виджет|widget|часы|clock|таймер|timer|секундомер|stopwatch|калькулятор|calculator|сч[её]тчик|counter|погода|weather)/i.test(`${meta.text} ${name}`);
    const result=await B.executeTool?.("module_create",{id,name,title:name,runtime:"sandbox",html,manifest:{id,name,version:"1.0.0",type:utility?"widget":"app",displayMode:utility?"widget":"window",runtime:"sandbox",icon},onDesktop:true,openAfterInstall:true});
    if(!result||result.error){activity(result?.error||"Module Runtime недоступен",true);return false}if(!meta.mutations.includes("module_create"))meta.mutations.push("module_create");if(result?.test?.ok&&result?.persisted)meta.moduleResult=result;activity(meta.moduleResult?`Приложение «${name}» установлено и проверено.`:`Приложение «${name}» создано, но запуск не подтверждён.`,true);return !!meta.moduleResult
  }'''
regex_once(
    "gpt-presence.js",
    r'  async function installWorkspaceApp\(answer=""\)\{[\s\S]*?\n  async function sendPrompt',
    new_install_app + '\n  async function sendPrompt',
)
replace_once(
    "gpt-presence.js",
    'const appMode=currentPromptMeta?.execution==="app";let changed=false;',
    'const appMode=currentPromptMeta?.execution==="app";let changed=false;if(appMode&&!currentPromptMeta?.moduleResult&&extractWorkspaceHtml(visibleText))await installWorkspaceApp(visibleText);',
)

# 6) Restore the old one-click provider behavior. Access Center remains available,
#    but it no longer hijacks and replaces the working "connect in background" listener.
replace_once(
    "gpt-presence.js",
    'if(tabBtn){tabBtn.hidden=false;tabBtn.textContent="Открыть центр подключений";tabBtn.classList.toggle("provider-tab-connected",!!status?.connected)}',
    'if(tabBtn){tabBtn.hidden=false;tabBtn.textContent=status?.connected?"Подключено":"Подключить в фоне";tabBtn.classList.toggle("provider-tab-connected",!!status?.connected)}',
)
replace_once(
    "gpt-presence.js",
    'if(authBtn)authBtn.hidden=true;',
    'if(authBtn)authBtn.hidden=provider==="gpt"||provider==="custom"||!!status?.connected;',
)
regex_once(
    "osminog-session-manager.js",
    r'  function bindSessionActions\(row\)\{[\s\S]*?\n  \}\n  function installAgentSettings',
    '  function bindSessionActions(){/* Keep gpt-presence direct connect/authorize listeners. Access Center must not hijack them. */}\n  function installAgentSettings',
)
replace_once(
    "osminog-session-manager.js",
    'connectBtn.textContent="Открыть центр подключений"',
    'connectBtn.textContent="Подключить в фоне"',
)
replace_once(
    "osminog-session-manager.js",
    'if(authBtn)authBtn.hidden=true;',
    'if(authBtn)authBtn.hidden=false;',
)
replace_once(
    "osminog-session-manager.js",
    'globalThis.OSMINOGSessionManager={version:"3.14.1"',
    'globalThis.OSMINOGSessionManager={version:"3.14.2-dev"',
)

# 7) Restore the canonical persistent context that was removed after 3.11.33.
#    This is additive and does not roll back current runtime source.
subprocess.run(
    ["git", "checkout", OLD_CONTEXT_COMMIT, "--", "OSMINOG_PROJECT_LOG.md", "OSMINOG_ROADMAP.md", "project-log-archive", "docs/OSMINOG_UPDATE_ARCHITECTURE.md"],
    cwd=ROOT,
    check=True,
)

log_marker = "CHAT OWNER RUNTIME RECOVERY · 3.14.2 candidate"
log_path = ROOT / "OSMINOG_PROJECT_LOG.md"
log = log_path.read_text(encoding="utf-8")
if log_marker not in log:
    log += f'''\n\n## 2026-09-02 — {log_marker}\n\n- Причина ремонта: в 3.14.1 прямой ChatGPT transport и UI чата разошлись по контрактам. Direct transport для `app` требовал HTML, а `gpt-presence` считал приложение завершённым только после `module_create/module_update`; результат мог уходить в длинный автономный цикл без фактической установки.\n- В direct transport восстановлен полный список Owner Max tools: project revisions/checkpoints, module create/update/test, workspace/icon actions.\n- Команды вида «сделай секундомер/таймер/калькулятор/виджет» снова классифицируются как приложение, а не как набор примитивов на холсте. HTML-ответ direct transport теперь устанавливается через реальный `module_create`, проходит launch-test и создаёт launcher/module, а не browser-карточку.\n- В чат возвращены видимые короткие этапы выполнения. Они сохраняются в UI, но исключаются из контекста модели как `progress/runtime`; скрытые chain-of-thought не выводятся.\n- Session Manager больше не заменяет рабочие обработчики «Подключить в фоне» обработчиком открытия Access Center. Центр остаётся отдельным интерфейсом, а подключение снова выполняет реальный `connect()`.\n- Восстановлены `OSMINOG_PROJECT_LOG.md`, `OSMINOG_ROADMAP.md`, `project-log-archive/` и `docs/OSMINOG_UPDATE_ARCHITECTURE.md` поверх текущего кода без отката 3.14.x.\n- До публичного релиза обязательна проверка: ChatGPT direct + attached fallback; создание секундомера как module/launcher; создание произвольного sandbox app; web_search → asset_create; source/GitHub edit; DeepSeek/Claude/Gemini/Google AI background sessions; восстановление сессии после закрытия/перезапуска.\n'''
    log_path.write_text(log, encoding="utf-8")

roadmap_marker = "3.14.2 CHAT OWNER RUNTIME RECOVERY"
roadmap_path = ROOT / "OSMINOG_ROADMAP.md"
roadmap = roadmap_path.read_text(encoding="utf-8")
if roadmap_marker not in roadmap:
    roadmap += f'''\n\n## {roadmap_marker}\n\nЦель: вернуть единый рабочий контракт «чат → реальный инструмент → проверенная мутация», не откатывая новый UI.\n\n1. Один capability contract для direct ChatGPT, attached Presence и других провайдеров.\n2. Простые пользовательские формулировки про секундомер/таймер/калькулятор/приложение должны создавать настоящий Module Store app с launcher, а не россыпь canvas-кнопок.\n3. Короткие этапы работы видны последовательно в чате; внутренний chain-of-thought не показывается.\n4. «Подключить в фоне» реально создаёт/переиспользует service session. Access Center не подменяет действие подключения.\n5. GitHub/исходники, web_search/web_fetch/asset_create, workspace, modules и project revisions доступны Owner Max чату по одному контракту.\n6. Никаких удалений текущей 3.14.x архитектуры: ремонт идёт поверх, с сохранённой историей и проверяемой веткой.\n'''
    roadmap_path.write_text(roadmap, encoding="utf-8")

# Static contract assertions: fail the repair before commit if the intended runtime
# guarantees are not present in the patched tree.
bg = read("background.js")
gpt = read("gpt-presence.js")
sessions = read("osminog-session-manager.js")
checks = {
    "direct project revision tools": all(x in bg for x in ["project_revisions", "project_checkpoint", "project_restore_revision"]),
    "direct module tools": all(x in bg for x in ["module_create", "module_update", "module_test", "workspace_patch", "icon_set"]),
    "stopwatch classified as app": "секундомер|таймер|часы|будильник|калькулятор" in gpt and 'return"app"' in gpt,
    "HTML fallback installs module": 'B.executeTool?.("module_create"' in gpt and "installWorkspaceApp(visibleText)" in gpt,
    "progress remains visible": 'activity(String(text||""),meta.source==="runtime");}if(!String(text||"").trim()' in gpt,
    "provider button performs direct routing": "Access Center must not hijack them" in sessions and 'connectBtn.textContent="Подключить в фоне"' in sessions,
    "restored project log": log_marker in read("OSMINOG_PROJECT_LOG.md"),
    "restored roadmap": roadmap_marker in read("OSMINOG_ROADMAP.md"),
}
failed = [name for name, ok in checks.items() if not ok]
if failed:
    raise RuntimeError("repair contract failed: " + ", ".join(failed))

print("OSMINOG 3.14.2 chat owner runtime repair applied")
