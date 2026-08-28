# OSMINOG Chrome 3.10.1 — DESKTOP STABILITY

Base: 3.10.0 MEDIA CREW.

## Fixed

- Team mode no longer hides the canvas world, files or objects. Team is a transparent overlay and only its movable window intercepts input.
- Agent thinking progress is rendered inside the purple activity strip in the active chat. The old floating top-left progress element is disabled.
- Main agent defaults to the center of the current viewport. Additional agents are arranged around it; manually placed positions remain authoritative.
- Idle/work mascot and parallel task ghost default to the viewport center when there is no object target.
- A connected local project folder appears as a yellow draggable OSMINOG folder icon on the workspace.
- Double-clicking the icon opens a movable/resizable explorer backed by the approved ordinary folder. It lists and navigates real files, previews supported media/text and can place supported files on the canvas.
- Folder-ready and folder-sync events keep the desktop representation synchronized.

## Preserved

- MEDIA CREW Provider Registry.
- Team media attachments and tray.
- Google bridge V4/background transport.
- DeepSeek authenticated web-session transport.
- Fixed Chrome manifest key and extension identity.

## Artifact

`OSMINOG-Chrome-3.10.1-DESKTOP-STABILITY-ROOT.zip`

- Size: `278536` bytes
- SHA-256: `1f02ab9b770a4f18c9a14d0cdb7ed83250e82252a6f7eb3bf125bb77db735251`
- Files: `51`
- Root `manifest.json`: yes

The complete ZIP is the verified ChatGPT artifact. It is not claimed as stored in GitHub until a remote copy matches the exact size and SHA-256.

## Runtime checklist

1. Open Team and confirm canvas files/objects stay visible.
2. Run an agent task and confirm progress appears only in the purple chat strip.
3. Confirm Main and the mascot start in the viewport center; drag Main and verify its manual position persists.
4. Connect the local folder and confirm a yellow draggable folder icon appears.
5. Open the folder explorer, browse actual files and place one image/text file on the canvas.
6. Regression-test DeepSeek and Google AI.
