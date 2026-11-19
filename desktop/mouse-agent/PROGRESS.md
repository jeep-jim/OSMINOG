# Task progress protocol — Mouse 6.0.31

The per-pane pill displays metadata explicitly reported by a page, a connected
agent, or Mouse's command runner. It does not infer progress from a provider's
website, response length, stdout lines, elapsed time, or the number of tool calls.
Opening ChatGPT, DeepSeek, or another AI website alone does not connect that
website to this protocol.

Ordinary navigation, a slow network load, a failed load, a generic `aria-busy`
region, or an unmarked `<progress>` never opens this pill. This replaces the
earlier automatic navigation/DOM behavior. Native file downloads keep their
separate 6.0.30 download activity and completion UI. Each task pill remains
immediately **under its own pane's address/header row**; it adds no global footer.

## Page API

A normal HTTP(S) tab can report its own task through the limited preload bridge:

```js
await window.MouseAgent.updateProgress(null, 'Ожидаю результат', { taskId: 'report' });
await window.MouseAgent.updateProgress(35, 'Проверена первая часть', {
  taskId: 'report', etaSeconds: 90 // Only when the site has supplied this estimate.
});
await window.MouseAgent.updateProgress(100, 'Отчёт готов', { taskId: 'report' });
```

`percent` is `null` or a finite number from 0 through 100. `statusText` must be a
string of at most 240 characters. The optional `taskId` contains 1–64 ASCII
letters, digits, underscores, dots, colons, or hyphens; the default is `default`.
Calls return a promise for the accepted task record. Invalid or unavailable
updates reject that promise.

The page/site author calls the API at the actual lifecycle boundaries of their
own asynchronous task. `browser.setProgress(percent, message, options)` is an
alias with the same authority when the main-world `window.browser` name is free
after the site's initial scripts. An existing `window.browser` object is never
overwritten or extended; use `window.MouseAgent.updateProgress` in that case.

| Option | Accepted meaning |
| --- | --- |
| `taskId` | A unique logical task key within this document; use different IDs for concurrent jobs |
| `phase` | `running` (default), `completed`, `stopped`, `cancelled`, or `error` |
| `etaSeconds` | `null`/omitted for unknown, otherwise a finite number from 0 through 604800 (seven days) supplied by the producer |

Numeric 100 or `phase: 'completed'` immediately hides the task pill. A completed
report arriving without an earlier task also creates no visible success pill.
`error`, `cancelled`, and `stopped` preserve the last running percentage, clear
ETA, and show the final status for five seconds. If no earlier report exists,
those outcomes have an unknown percentage. Reporting a cancelled state only
describes the site's own outcome; the reporting API does not cancel its work.

Mouse labels a supplied ETA `Осталось ≈90 с · оценка сайта` (or `оценка ИИ` for
an agent). It subtracts only the time elapsed since that report arrived: after
five seconds, a 90-second estimate displays approximately 85 seconds. A new
report of the same ETA starts a new estimate at its new receipt time. Omitting
ETA on the next report clears it. The stored reported value is not rewritten by
the display clock, and a percentage is never extrapolated from time.

When the estimate expires, the label becomes `Оценка истекла · ждём ответ`;
the task stays running at its last reported percentage. `etaSeconds: 0` has
the same behavior and does not complete a task. Without an ETA, the label
shows elapsed time, such as `В работе 5 с`. Unknown progress remains
indeterminate (`…`), with no invented percentage or remaining time. A site's
estimate is identified as its estimate, not a guarantee.

```js
const taskId = 'export-' + crypto.randomUUID();
await MouseAgent.updateProgress(null, 'Готовлю экспорт', { taskId });
try {
  const result = await performActualExport();
  await MouseAgent.updateProgress(100, 'Экспорт готов', { taskId });
  return result;
} catch (error) {
  await MouseAgent.updateProgress(null, 'Экспорт не завершён', {
    taskId, phase: error.name === 'AbortError' ? 'cancelled' : 'error'
  });
  throw error;
}
```

The main process derives the owner, desktop, tab ID, and domain label from the
IPC sender. A caller cannot supply another tab's identity or update its task.
Only the owning top frame is accepted; private mode and a locked screen deny the
API. A main-issued document token rejects late reports after a new-document
navigation or renderer loss. Same-document `pushState`/hash changes, hidden tabs,
and switching desktops retain task identity; moving a tab moves its task to that
tab's new desktop. Tab closure, a new document, private-mode cleanup and screen
locking clear visible task state. Unlock/normal-mode restoration can resample
current explicit DOM declarations; they do not resurrect old completed pills.
This bridge exposes progress only: it does not grant
page code access to Agent Mouse, terminal commands, or browser controls.

Page and model percentages are reported estimates. They are not a measurement of
the provider's internal processing. The pill identifies the source separately
from the reported status text.

## Explicit DOM adapter for any HTTP(S) site

A site can declare its task without invoking JavaScript across the bridge:

```html
<progress data-mouse-task="report"
          data-mouse-task-state="running"
          data-mouse-eta-seconds="45"
          aria-label="Собираю отчёт"
          max="200" value="128"></progress>
```

This reports 64% and the site's 45-second estimate. The same attributes work on
`role="progressbar"` with `aria-valuenow`/`aria-valuemin`/`aria-valuemax`. An
explicit task region without a numeric range reports unknown progress. Its
bounded `aria-label` and `aria-valuetext` provide the action text. Set
`data-mouse-task-state` to `completed`, `error`, `cancelled`, or `stopped` at the
actual outcome. Removing the declaration removes that DOM report without
claiming success. Task IDs follow the same ASCII 1–64 rule; duplicate IDs in the
same document are ambiguous and are not chosen arbitrarily.

The adapter reads only these explicit attributes in the owning top document's
light DOM. It does not inspect chat messages, infer a reply's end from text
length, enter iframes/shadow roots, or recognize provider-specific stop buttons.
The API remains available for a site's own shadow-DOM implementation. Hidden or
offscreen explicit declarations continue to report because they describe a
task, not the visibility of its widget. Generic HTML/ARIA widgets have no Mouse
task lifecycle by themselves: [HTML progress](https://html.spec.whatwg.org/multipage/form-elements.html#the-progress-element)
describes the element's progress semantics, while
[ARIA busy](https://www.w3.org/TR/wai-aria-1.2/#aria-busy) describes a region being
updated; neither grants knowledge of an AI service's remaining time.

The adapter has one chunked initial discovery, bounded new-subtree discovery,
and relevant-attribute updates coalesced at 250 ms. It has no class/style/scroll
rescans, geometry reads or periodic visibility polling. Overflow gets one
chunked recovery walk after a 1500 ms quiet period. Discovery visits at most 1024
nodes per tick, retains at most 32 candidates and reports at most 4 distinct tasks
per page. Exact ETA and automatic task support on every existing AI website are
not claimed: the site or an explicitly connected agent must supply the report.

## External agent over scoped CDP

Enable Agent Mouse through its existing consent dialog, then use the temporary
loopback session URL shown by Mouse. The SDK uses the same authenticated gateway
as browser actions; the connection remains limited to the enabled desktop.

```js
const { AgentController } = require('./agent-connector.cjs');
const browser = await new AgentController(sessionUrl).connect();
try {
  await browser.setProgress(null, 'Читаю исходные данные', { taskId: 'analysis' });
  // Perform and verify actual work here.
  await browser.setProgress(40, 'Проверены исходные данные', { taskId: 'analysis' });
  // Report 100 only when the task has a completed result.
  await browser.setProgress(100, 'Анализ готов', { taskId: 'analysis' });
} catch (error) {
  await browser.setProgress(null, 'Не удалось завершить анализ', {
    taskId: 'analysis', phase: 'error'
  }).catch(() => {});
  throw error;
} finally {
  await browser.close();
}
```

The wire method is **`browser.setProgress`**. It is a Mouse gateway extension,
not a Chromium-wide CDP method:

```json
{"id":1,"method":"browser.setProgress","params":{"taskId":"analysis","percent":40,"statusText":"Проверены исходные данные"}}
```

The SDK accepts the same `phase` and `etaSeconds` options. A numeric 100 or
`phase: 'completed'` sets the completed phase and immediately hides the pill.
A stopped/cancelled/error report preserves the last percentage;
it never manufactures 100. The gateway assigns `source: "agent"`, the active
authorized desktop, and `estimated: true`. Separate connections have separate
owners and source labels, even when they use the same `taskId`. Disconnect freezes
that connection's unfinished indicators with a connection-closed status. This
metadata change is not a claim that an independently running external process
was terminated. Mouse's actual **Stop** also revokes its gateway, stops its
utility worker and PTY, and invalidates pending actions.

The trusted shell can use the Agent IPC action `set-progress` while its enabled
session is valid. A webpage cannot invoke this privileged Agent IPC channel.

## Built-in worker and terminal

The utility worker prompt exposes this explicit model tool:

```json
{"action":"browser.setProgress","args":{"percent":35,"statusText":"Проверена первая часть","etaSeconds":90}}
```

The host begins one worker task with an indeterminate value. A private,
memory-only run token binds the worker's updates to that same task. The token is
not included in model messages, source labels, or renderer state. The model's
`done` action reports completed/100 as an **AI estimate**; the 20-step limit
reports stopped, and model/transport errors report error. Neither the limit nor
an error generates a completed percentage.
Only `taskId`, `phase`, and `etaSeconds` are forwarded as optional metadata;
model-supplied owner/source/desktop/permission fields are never forwarded. A
model may explicitly estimate its own progress or ETA, labelled `оценка ИИ`.
Mouse does not invent an estimate when the model supplies none.

Programmatic terminal commands begin with `percent: null`, `source: "terminal"`,
and `estimated: false`. Stdout is displayed without changing the percentage.
Only the actual command result determines completion: exit code 0 reports
completed/100; a nonzero exit reports error and retains the previous value.
For `background: true`, completion means **the launch command finished**, with
the status `Фоновая команда запущена`; it does not mean a long-running server
finished. Ordinary interactive terminal input is not parsed into progress tasks.

## Store and UI contract

`mouse-progress.cjs` exports `ProgressStore`. Main creates one shared instance
and passes it to `AgentHost` as `progress`. Its `emit` callback publishes
`mouse:progress-state` with `{ revision, tasks }`. Public task fields are:

| Field | Meaning |
| --- | --- |
| `id` | Opaque UUID used by the pill and its dismiss action |
| `taskId` | Producer's task key, scoped to its private owner |
| `desk` | Trusted desktop ID |
| `source` | `agent`, `terminal`, `page`, or `shell` |
| `label` | Trusted source label, at most 64 characters |
| `tabId` | Optional tab identity assigned by main |
| `percent` | `null`, or a number floored to one decimal place |
| `statusText` | Plain status text; control/bidi characters removed; maximum 240 characters |
| `phase` | `running`, `completed`, `stopped`, `cancelled`, `error`, or `stale` |
| `estimated` | Whether numeric progress is a producer/model estimate |
| `etaSeconds` | Producer's bounded remaining-time estimate as received, or `null`; the UI counts down from `updatedAt` without changing this value |
| `createdAt`, `updatedAt`, `dismissAt` | Local timestamps in milliseconds |

Private owner keys and document tokens are omitted from renderer DTOs. A task's
source, label and tab ID cannot change within an owner/task key. Only main can
move a page owner's desktop when the underlying tab moves. Main removes/resets
that owner when the document itself changes.

The trusted shell uses `N.progress('state')`,
`N.progress('update', { percent, statusText, taskId?, phase?, etaSeconds? })`, and
`N.progress('dismiss', { id })`, plus `N.onProgress(callback)` for events.
**Dismiss hides an indicator; it does not cancel work.** To stop Agent Mouse,
use the existing Agent Stop action, which stops its actual execution resources.

Resource bounds are 64 running tasks globally, 4 per owner, and 24 retained
finished records. Page API and DOM reports also share a combined limit of 4
running tasks in their owning tab; using both producers does not double that
page's allowance. Fifty tabs can therefore each report one independent task,
subject to the same global limit. Explicit updates exceeding capacity reject with
`MOUSE_PROGRESS_LIMIT` (SDK `error.code`; CDP `error.data`). Automatic worker
and command indicators are best effort at capacity: missing display capacity
does not prevent their underlying execution. Other errors, including revoked
session access, are not ignored. Finished records expire after 60 seconds. A
completed task is immediately absent from the visible snapshot; stopped,
cancelled and error indicators remain for five seconds.
A producer silent for 30 minutes becomes `stale`, retains its last percentage,
and shows `Нет обновлений` for 5 seconds. Stale means missing updates and does
not assert that the underlying work stopped. Ordinary updates coalesce within
100 ms; final-state notifications are also bounded during completion bursts.
Trusted privacy removal and clear operations publish immediately.

One renderer clock runs once per second only while a running task pill is
visible. It pauses when the document is hidden or Nora freezes the pane UI, and
stops when no such pill remains. Download feedback retains its separate owner.
Clock ticks update text and accessible labels without requesting native layout.
Remaining time is `ceil(max(0, etaSeconds - max(0, now - updatedAt) / 1000))`;
unknown-ETA elapsed time is `floor(max(0, now - createdAt) / 1000)`. A backwards
clock change is clamped at zero elapsed time. Neither formula changes task
completion or percentage.

State is memory-only. The protocol does not write progress history into the
profile or export status text to an AI provider by itself.

## Verification

`mouse-progress-task.test.cjs` reproduces the former false navigation,
completed 100 and bare-ARIA behaviors. `mouse-progress.test.cjs` covers ownership,
trusted metadata, numeric/text
validation, estimates versus indeterminate values, Stop/error/stale semantics,
dismissal/TTL, limits, and event coalescing. `mouse-agent.test.cjs` additionally
uses the real loopback WebSocket gateway and SDK for progress ownership, tests
worker run association and terminal result semantics, and covers disposal after
a destroyed native window getter. Its WebContents, utility-process, and PTY
fixtures are unit fixtures. `mouse-progress-bridge.test.cjs` verifies document
tokens, SPA/background/desktop ownership and rejection of forged scope;
`mouse-page-activity.test.cjs` verifies opt-in semantics and bounded observer work;
`mouse-progress-pane.test.cjs` retains download and header placement checks,
verifies estimate countdown/expiry and elapsed time with a controlled clock,
and checks that text ticks cause no native layout and stop without visible tasks.
The store/bridge tests cover 50 independent owners, the 64-task cap and the
combined per-page quota; an identical newly reported ETA refreshes its receipt
timestamp. `mouse-overlay-metadata.test.cjs` exercises the actual modal observer
so ordinary title/loading/progress mutations do not create layout work.
Installed macOS and Windows task/stress verification are separate gates and
remain necessary before publication.
