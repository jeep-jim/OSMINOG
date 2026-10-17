# 4.0.18 — snapped workspace panes

PR59: https://github.com/jeep-jim/OSMINOG/pull/59

## Behaviour

- Move a window by its header grip. It snaps within 18 px to workspace/other-pane edges, with 12 px gaps.
- A blocked drop uses the nearest available position. Neighbours keep their positions.
- Resize stops at a neighbour or the right workspace boundary. It does not push the neighbour down or move the resized window to another row.
- Full-size double-click remains an explicit full-size placement; the expand button provides single-pane view.
- Saved overlapping layouts are repaired on load; width adapts to the available viewport. Vertical scrolling remains supported.
- View presets reset saved custom positions.

## Removed recurring work

BrowserContext no longer clones/reads every tab's DOM on a 2-second idle timer. Provider execution still requests fresh context before each turn, and browser_act returns a fresh observation. Tab metadata remains available from browser state; this is not a claim that cached DOM updates continuously while idle.

Shell render no longer captures a screenshot of every central tab. User-enabled rail thumbnails remain available. Drag/resize geometry is coalesced per animation frame; non-overlapping layout removes quadratic live-pane occlusion scans.

## Validation

137 local tests pass, including migration of overlapping rectangles, edge snapping, stable neighbours, viewport shrink, repeated placement, and resize boundaries. Windows shell smoke also asserts no intersections and no horizontal overflow after real shell operations. Logs and the real fixture screenshot are retained here.

This does not establish a frame-rate/CPU improvement on the user's PC. The separately observed SEND_NOT_CONFIRMED provider transport error is not fixed by this layout change.

Windows run https://github.com/jeep-jim/OSMINOG/actions/runs/38997387853 and agent run https://github.com/jeep-jim/OSMINOG/actions/runs/38997387802 passed. Head 8c5641559c2571ea524d5ed6b46851c0fc1da212; merge 0e643821f7377c96d73ce4ac04c4139b79ee922f. Installed shell also reports SNAP_LAYOUT_NO_OVERLAP_OR_HORIZONTAL_OVERFLOW_PASS; ordinary startup and second-instance restoration pass.

Candidate artifact SHA256 ef665df1108fd7cb2edb849ce093229b05ad65dd1e9682c613a65347ed4ffe47. Runtime source f2123295265ac942abc8cebce884871face90ba1 matches the merge across 432 blob files. Runtime: 4842071 bytes; SHA256 42da51f5dbf3d5c87e8cfa457273c53b3b9b2b9670aada77f27f97581ff05872.

Release https://github.com/jeep-jim/OSMINOG-Releases/actions/runs/38997917811 passed: UPDATE_INSTALL_STARTED and INSTALLED_UPDATE_SMOKE_PASS 4.0.18, upgrading 4.0.17 with retained local data. Installer: 115229366 bytes; SHA256 c85c283fe4d513dbc5bfb96682597a5a8a2208a5231f2782e25473682df427e8. Public latest.yml and Windows JSON feed point to 4.0.18; installer returns MZ bytes.
