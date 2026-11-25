// CI-only preparation of a real, advertised macOS display mode. No app UI,
// off-screen geometry, private display API or synthetic display is involved.
// Run --output, let that process exit, then run --verify on the same receipt.
// Apple: CGDisplayCopyAllDisplayModes, CGConfigureDisplayWithDisplayMode,
// CGCompleteDisplayConfiguration(.forSession). A one-shot SetDisplayMode would
// revert on process exit, so it is deliberately not used here.
import Foundation
import CoreGraphics

let minimumWidth = 1440, minimumHeight = 900
let arguments = Array(CommandLine.arguments.dropFirst())
let output = arguments.count == 2 ? URL(fileURLWithPath: arguments[1]) : nil
let pid = Int(ProcessInfo.processInfo.processIdentifier)
var report: [String: Any] = [
    "schema": 1, "version": "6.0.39", "platform": "darwin",
    "source": "CoreGraphics advertised display modes", "scope": "forSession",
    "minimum": ["width": minimumWidth, "height": minimumHeight],
    "pid": pid, "startedAt": ISO8601DateFormatter().string(from: Date()), "ok": false
]

func require(_ condition: Bool, _ message: String) throws {
    if !condition { throw NSError(domain: "Mouse637Display", code: 1,
                                  userInfo: [NSLocalizedDescriptionKey: message]) }
}
func modeRecord(_ mode: CGDisplayMode) -> [String: Any] {
    return ["id": Int(mode.ioDisplayModeID), "width": mode.width, "height": mode.height,
            "pixelWidth": mode.pixelWidth, "pixelHeight": mode.pixelHeight,
            "refreshRate": mode.refreshRate, "usableForDesktopGUI": mode.isUsableForDesktopGUI()]
}
func sameMode(_ first: [String: Any], _ second: [String: Any]) -> Bool {
    return ["id", "width", "height", "pixelWidth", "pixelHeight"].allSatisfy { key in
        guard let a = first[key] as? Int, let b = second[key] as? Int else { return false }
        return a == b
    }
}
func snapshot() throws -> [String: Any] {
    let display = CGMainDisplayID()
    try require(CGDisplayIsActive(display) != 0, "The main macOS display is not active")
    guard let mode = CGDisplayCopyDisplayMode(display) else {
        throw NSError(domain: "Mouse637Display", code: 1,
                      userInfo: [NSLocalizedDescriptionKey: "Cannot read the actual main display mode"])
    }
    let bounds = CGDisplayBounds(display)
    return ["displayID": Int(display), "mode": modeRecord(mode),
            "bounds": ["x": Double(bounds.origin.x), "y": Double(bounds.origin.y),
                       "width": Double(bounds.width), "height": Double(bounds.height)]]
}
func sufficient(_ state: [String: Any], _ selected: [String: Any]) -> Bool {
    guard let mode = state["mode"] as? [String: Any],
          let bounds = state["bounds"] as? [String: Double],
          let width = mode["width"] as? Int, let height = mode["height"] as? Int else { return false }
    return sameMode(mode, selected) && mode["usableForDesktopGUI"] as? Bool == true
        && width >= minimumWidth && height >= minimumHeight
        && (bounds["width"] ?? 0) >= Double(minimumWidth)
        && (bounds["height"] ?? 0) >= Double(minimumHeight)
}
func save() throws {
    guard let output = output else { return }
    let data = try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys])
    try (data + Data("\n".utf8)).write(to: output, options: .atomic)
}

do {
    try require(arguments.count == 2 && ["--output", "--verify"].contains(arguments[0]),
                "Usage: xcrun swift mouse-637-macos-display.swift --output|--verify receipt.json")
    try require(ProcessInfo.processInfo.environment["CI"] == "true", "Display preparation is restricted to CI=true")
    if arguments[0] == "--verify" {
        let data = try Data(contentsOf: output!)
        guard let prepared = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw NSError(domain: "Mouse637Display", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Display receipt is not an object"])
        }
        report = prepared
        try require(report["schema"] as? Int == 1 && report["version"] as? String == "6.0.39"
                    && report["scope"] as? String == "forSession" && report["ok"] as? Bool == true,
                    "Display preparation did not produce a successful 6.0.39 session receipt")
        let preparedMinimum = report["minimum"] as? [String: Int]
        try require(preparedMinimum?["width"] == minimumWidth && preparedMinimum?["height"] == minimumHeight,
                    "Display receipt must retain the required logical 1440x900 minimum")
        let preparedPID = report["pid"] as? Int
        try require(preparedPID != nil && preparedPID! > 0 && preparedPID != pid,
                    "Persistence must be verified by a new process after preparation exits")
        guard let selected = report["selected"] as? [String: Any],
              let advertised = report["advertisedModes"] as? [[String: Any]] else {
            throw NSError(domain: "Mouse637Display", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "Display receipt lacks advertised and selected modes"])
        }
        try require(advertised.contains { sameMode($0, selected) }, "Selected mode was not advertised by macOS")
        var actual = try snapshot()
        actual["pid"] = pid; actual["checkedAt"] = ISO8601DateFormatter().string(from: Date())
        report["persistence"] = actual
        try require(actual["displayID"] as? Int == report["displayID"] as? Int && sufficient(actual, selected),
                    "The selected logical 1440x900 display mode did not persist after helper exit")
        report["processExitVerified"] = true
        try save()
        print("MOUSE_637_MACOS_DISPLAY_PERSISTENCE_PASS")
    } else {
        let before = try snapshot(), display = CGMainDisplayID()
        report["displayID"] = Int(display); report["before"] = before
        guard let modes = CGDisplayCopyAllDisplayModes(display, nil) as? [CGDisplayMode] else {
            throw NSError(domain: "Mouse637Display", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "macOS did not return advertised display modes"])
        }
        report["advertisedModes"] = modes.map(modeRecord)
        let candidates = modes.filter {
            $0.isUsableForDesktopGUI() && $0.width >= minimumWidth && $0.height >= minimumHeight
        }.sorted {
            if $0.width * $0.height != $1.width * $1.height { return $0.width * $0.height < $1.width * $1.height }
            if $0.pixelWidth * $0.pixelHeight != $1.pixelWidth * $1.pixelHeight {
                return $0.pixelWidth * $0.pixelHeight < $1.pixelWidth * $1.pixelHeight
            }
            return $0.ioDisplayModeID < $1.ioDisplayModeID
        }
        let current = before["mode"] as! [String: Any]
        guard let selected = candidates.first(where: { sameMode(modeRecord($0), current) }) ?? candidates.first else {
            throw NSError(domain: "Mouse637Display", code: 1,
                          userInfo: [NSLocalizedDescriptionKey: "The actual macOS display advertises no desktop mode with logical size at least 1440x900; native verification cannot continue"])
        }
        let selectedRecord = modeRecord(selected), changed = !sameMode(current, selectedRecord)
        report["selected"] = selectedRecord; report["changed"] = changed
        if changed {
            var configuration: CGDisplayConfigRef?
            let begin = CGBeginDisplayConfiguration(&configuration)
            report["configuration"] = ["begin": begin.rawValue]
            try require(begin == .success && configuration != nil, "Cannot begin macOS display configuration: \(begin.rawValue)")
            let configure = CGConfigureDisplayWithDisplayMode(configuration, display, selected, nil)
            report["configuration"] = ["begin": begin.rawValue, "configure": configure.rawValue]
            if configure != .success { CGCancelDisplayConfiguration(configuration) }
            try require(configure == .success, "macOS rejected its advertised display mode: \(configure.rawValue)")
            let complete = CGCompleteDisplayConfiguration(configuration, .forSession)
            report["configuration"] = ["begin": begin.rawValue, "configure": configure.rawValue, "complete": complete.rawValue]
            try require(complete == .success, "macOS could not apply the session display mode: \(complete.rawValue)")
        }
        var actual = try snapshot()
        let deadline = Date().addingTimeInterval(5)
        while !sufficient(actual, selectedRecord) && Date() < deadline {
            Thread.sleep(forTimeInterval: 0.1); actual = try snapshot()
        }
        report["after"] = actual
        try require(actual["displayID"] as? Int == Int(display) && sufficient(actual, selectedRecord),
                    "Actual macOS mode and global display bounds do not meet logical 1440x900 after configuration")
        report["ok"] = true
        try save()
        print("MOUSE_637_MACOS_DISPLAY_PREPARED")
    }
} catch {
    report["ok"] = false; report["error"] = error.localizedDescription
    do { try save() } catch { fputs("Cannot save display failure receipt: \(error.localizedDescription)\n", stderr) }
    fputs("MOUSE_637_MACOS_DISPLAY_FAILED \(error.localizedDescription)\n", stderr)
    exit(1)
}
