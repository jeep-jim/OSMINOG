import fs from "node:fs";
import vm from "node:vm";

const read = (name) => fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8");
const manifest = JSON.parse(read("manifest.json"));
const build = JSON.parse(read("OSMINOG_BUILD.json"));
const chat = read("gpt-presence.js");
const editor = read("editor.js");
const presence = read("chatgpt-lite-bridge.js");

const required = [
  ["version", manifest.version === "3.20.0" && build.version === manifest.version],
  ["threads", /THREADS_KEY|activeThread|threadStore/.test(chat)],
  ["agent drag link", chat.includes("application/x-briefcraft-chat-thread")],
  ["patch execution", chat.includes("propose_canvas_patch") && chat.includes("applyCanvasPatch")],
  ["patch retry", chat.includes("forcePatchRetry")],
  ["bounded tool loop", chat.includes("toolHops>12")],
  ["shared vision", chat.includes("osminog.vision_context/v1")],
  ["external vision preflight", presence.includes("prepareAndSendManual")],
  ["native file drop guard", editor.includes("nativeDropBusy")],
  ["file import", editor.includes("importFiles(files")],
];

for (const file of ["editor.js", "gpt-presence.js", "background.js", "chatgpt-lite-bridge.js"]) {
  new vm.Script(read(file), { filename: file });
}

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error(`CORE MERGE verification failed: ${failed.join(", ")}`);
  process.exit(1);
}
console.log(`OSMINOG ${manifest.version}: ${required.length} core contracts verified`);
