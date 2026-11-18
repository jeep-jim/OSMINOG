# Progress protocol — Mouse 6.0.24

The progress rail displays metadata explicitly reported by a page, a connected
agent, or Mouse's command runner. It does not infer progress from a provider's
website, response length, stdout lines, elapsed time, or the number of tool calls.
Opening ChatGPT, DeepSeek, or another AI website alone does not connect that
website to this protocol.

## Page API

A normal HTTP(S) tab can report its own task through the limited preload bridge:

```js
await window.MouseAgent.updateProgress(null, 'Ожидаю результат', { taskId: 'report' });
await window.MouseAgent.updateProgress(35, 'Проверена первая часть', { taskId: 'report' });
await window.MouseAgent.updateProgress(100, 'Отчёт готов', { taskId: 'report' });
```

`percent` is `null` or a finite number from 0 through 100. `statusText` must be a
string of at most 240 characters. The optional `taskId` contains 1–64 ASCII
letters, digits, underscores, dots, colons, or hyphens; the default is `default`.
Calls return a promise for the accepted task record. Invalid or unavailable
updates reject that promise.

The main process derives the owner, desktop, tab ID, and domain label from the
IPC sender. A caller cannot supply another tab's identity or update its task.
Only the owning top frame is accepted; private mode and a locked screen deny the
API. Navigation, tab closure, desktop reassignment, and private-mode cleanup
invalidate page ownership. This bridge exposes progress only: it does not grant
page code access to Agent Mouse, terminal commands, or browser controls.

Page and model percentages are reported estimates. They are not a measurement of
the provider's internal processing. The rail identifies the source separately
from the reported status text.

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

`phase` may be omitted or set to `running`, `stopped`, or `error`. A numeric 100
sets the completed phase. A stopped/error report preserves the last percentage;
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
{"action":"browser.setProgress","args":{"percent":35,"statusText":"Проверена первая часть"}}
```

The host begins one worker task with an indeterminate value. A private,
memory-only run token binds the worker's updates to that same task. The token is
not included in model messages, source labels, or renderer state. The model's
`done` action reports completed/100 as an **AI estimate**; the 20-step limit
reports stopped, and model/transport errors report error. Neither the limit nor
an error generates a completed percentage.

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
| `id` | Opaque UUID used by the rail and its dismiss action |
| `taskId` | Producer's task key, scoped to its private owner |
| `desk` | Trusted desktop ID |
| `source` | `agent`, `terminal`, `page`, or `shell` |
| `label` | Trusted source label, at most 64 characters |
| `tabId` | Optional tab identity assigned by main |
| `percent` | `null`, or a number floored to one decimal place |
| `statusText` | Plain status text; control/bidi characters removed; maximum 240 characters |
| `phase` | `running`, `completed`, `stopped`, `error`, or `stale` |
| `estimated` | Whether numeric progress is a producer/model estimate |
| `createdAt`, `updatedAt`, `dismissAt` | Local timestamps in milliseconds |

Private owner keys are omitted from renderer DTOs. A task's source context
(desktop, source, label, and tab ID) cannot change within an owner/task key.
Main must remove/reset that owner when the underlying page context changes.

The trusted shell uses `N.progress('state')`,
`N.progress('update', { percent, statusText, taskId? })`, and
`N.progress('dismiss', { id })`, plus `N.onProgress(callback)` for events.
**Dismiss hides an indicator; it does not cancel work.** To stop Agent Mouse,
use the existing Agent Stop action, which stops its actual execution resources.

Resource bounds are 12 running tasks globally, 4 per owner, and 24 retained
finished records. Explicit updates exceeding capacity reject with
`MOUSE_PROGRESS_LIMIT` (SDK `error.code`; CDP `error.data`). Automatic worker
and command indicators are best effort at capacity: missing display capacity
does not prevent their underlying execution. Other errors, including revoked
session access, are not ignored. Finished records expire after 60 seconds. A completed
indicator stays visible for 2.5 seconds; stopped/error indicators for 5 seconds.
A producer silent for 30 minutes becomes `stale`, retains its last percentage,
and shows `Нет обновлений` for 5 seconds. Stale means missing updates and does
not assert that the underlying work stopped. Ordinary updates coalesce within
100 ms; final-state notifications are also bounded during completion bursts.
Trusted privacy removal and clear operations publish immediately.

State is memory-only. The protocol does not write progress history into the
profile or export status text to an AI provider by itself.

## Verification

`mouse-progress.test.cjs` covers ownership, trusted metadata, numeric/text
validation, estimates versus indeterminate values, Stop/error/stale semantics,
dismissal/TTL, limits, and event coalescing. `mouse-agent.test.cjs` additionally
uses the real loopback WebSocket gateway and SDK for progress ownership, tests
worker run association and terminal result semantics, and covers disposal after
a destroyed native window getter. Its WebContents, utility-process, and PTY
fixtures are unit fixtures; installed macOS verification is a separate gate.
