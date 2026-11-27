'use strict';
// Accepted native workspace colors, independent of the CSS under test. Keep
// historical releases on their original palette when replaying their checks.
const PALETTE={light:{hex:'#c7cfdf',rgb:[199,207,223]},dark:{hex:'#43536b',rgb:[67,83,107]}};
const paletteForVersion=version=>['6.0.37','6.0.38','6.0.43'].includes(version)?{...PALETTE,dark:{hex:'#354357',rgb:[53,67,87]}}:PALETTE;
// Observe the workspace token, not the separate control-border palette. The
// independent expected colors above still decide whether native pixels pass.
function workspaceSeamToken(style){return style.getPropertyValue('--mouse-grid-seam').trim()||style.getPropertyValue('--line').trim();}
module.exports={paletteForVersion,workspaceSeamToken};
