# Live element references — 4.0.17

browser_read({id}) reads the existing BrowserWorkspace tab, returning a one-use snapshot and page.elements (ref, tag, role, label, type, href, bounds). No separate browser/profile is launched.

Use browser_act({id,snapshot,actions:[{type:"click",ref:"e1"}]}). The same node is located again at execution time. For text, click the field first and use the returned observation snapshot and its field ref with {type:"type",ref:"e2",text:"Honda"}. Typing requires that exact field to retain focus.

The element registry lives in Electron isolated world 997, not the website's global object. References expire on the next read, navigation, or document replacement. Host snapshot checks also bind project, access revision, tab, URL, viewport and time. Disabled, disconnected, semantically changed, occluded or offscreen targets fail before input. Coordinates remain supported for canvas controls. Native risk classification and confirmation remain in force; targets are revalidated after confirmation.

Scope: main document DOM (not a complete accessibility tree, cross-origin iframe traversal, or closed shadow DOM). The service execution loop receives results privately; this does not register tools inside third-party webchat backends. A model must return valid tool requests through the existing provider adapter. CDP/MCP alone cannot establish that adapter.

Validation: npm test --prefix desktop; Windows session smoke acceptance 7 checks actual native click after layout movement, replacement rejection, and registry isolation. These are controlled fixtures, not signed-in ChatGPT/DeepSeek end-to-end acceptance.
