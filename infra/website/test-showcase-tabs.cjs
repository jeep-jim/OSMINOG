'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTabWorkspace, chooseVisibleTabs, createBrowserStateBank } = require('../../website/showcase.js');

const capture = (id, tabId = 'scene-0-' + id) => ({
  id, tabId, name: id, host: id + '.example', src: '/showcase/' + id + '.jpg'
});

test('new tabs have a useful start state and do not consume additional grid slots', () => {
  const workspace = createTabWorkspace();
  const visible = [capture('maps'), capture('figma')];
  workspace.reset(visible);
  const tab = workspace.add('Новая вкладка');
  assert.equal(tab.kind, 'start');
  assert.equal(tab.name, 'Новая вкладка');
  assert.equal(workspace.tabs.length, 3);
  assert.equal(visible.length, 2);
  assert.equal(workspace.tabs[0], visible[0]);
  assert.equal(workspace.tabs[1], visible[1]);
});

test('choosing a real capture loads it into the new tab without duplicating the tab', () => {
  const workspace = createTabWorkspace();
  workspace.reset([capture('maps')]);
  const added = workspace.add('New tab');
  const chosen = workspace.choose(added.tabId, capture('figma'));
  assert.equal(chosen.tabId, added.tabId);
  assert.equal(chosen.src, '/showcase/figma.jpg');
  assert.equal(chosen.kind, undefined);
  assert.equal(workspace.tabs.length, 2);
  assert.equal(workspace.tabs[1], chosen);
  assert.equal(workspace.tabs[0].src, '/showcase/maps.jpg');
});

test('user-created tabs survive scene and layout switches, even beyond twelve tabs', () => {
  const workspace = createTabWorkspace();
  workspace.reset([capture('maps')]);
  const added = Array.from({length: 16}, () => workspace.add('New tab'));
  const chosen = workspace.choose(added[3].tabId, capture('figma'));
  workspace.reset([capture('youtube', 'scene-2-0'), capture('vscode', 'scene-2-1')]);
  assert.equal(workspace.tabs.length, 18);
  assert.equal(new Set(workspace.tabs.map(tab => tab.tabId)).size, 18);
  assert.equal(workspace.tabs.find(tab => tab.tabId === chosen.tabId).src, '/showcase/figma.jpg');
  assert.equal(workspace.tabs.filter(tab => tab.kind === 'start').length, 15);
});

test('failed or removed captures return their tab to the localized chooser without losing identity', () => {
  const workspace = createTabWorkspace();
  const first = workspace.add('New tab'), second = workspace.add('New tab');
  workspace.choose(first.tabId, capture('maps'));
  workspace.choose(second.tabId, capture('figma'));
  workspace.refresh([capture('figma')], 'Новая вкладка');
  assert.equal(workspace.tabs[0].tabId, first.tabId);
  assert.equal(workspace.tabs[0].kind, 'start');
  assert.equal(workspace.tabs[0].name, 'Новая вкладка');
  assert.equal(workspace.tabs[1].src, '/showcase/figma.jpg');
});

test('an unknown tab cannot change an existing scene or user tab', () => {
  const workspace = createTabWorkspace();
  workspace.reset([capture('maps')]);
  workspace.add('New tab');
  const before = workspace.tabs;
  assert.equal(workspace.choose('missing', capture('figma')), null);
  assert.deepEqual(workspace.tabs, before);
});

test('reducing and restoring a layout preserves every open tab and the active page', () => {
  const workspace = createTabWorkspace();
  const initial = Array.from({ length: 12 }, (_, i) => capture('site-' + i, 'capture-' + i));
  workspace.ensure(initial);
  const added = workspace.add('New tab');
  const active = workspace.choose(added.tabId, capture('maps'));
  const before = workspace.tabs.map(tab => [tab.tabId, tab.src]);
  const twelve = chooseVisibleTabs(workspace.tabs, [active, ...initial], 12, active.tabId);
  const one = chooseVisibleTabs(workspace.tabs, twelve, 1, active.tabId);
  assert.deepEqual(one.map(tab => tab.tabId), [active.tabId]);
  const restored = chooseVisibleTabs(workspace.tabs, one, 12, active.tabId);
  assert.equal(restored.length, 12);
  assert.equal(new Set(restored.map(tab => tab.tabId)).size, 12);
  assert.equal(restored[0].src, '/showcase/maps.jpg');
  assert.deepEqual(workspace.tabs.map(tab => [tab.tabId, tab.src]), before);
  assert.equal(workspace.tabs.length, 13);
});

test('seeding a larger layout does not duplicate existing captures or replace chosen pages', () => {
  const workspace = createTabWorkspace();
  workspace.ensure([capture('maps', 'seed-1')]);
  workspace.choose('seed-1', capture('figma'));
  workspace.ensure([capture('maps', 'seed-1'), capture('youtube', 'seed-2')]);
  assert.equal(workspace.tabs.length, 2);
  assert.equal(workspace.tabs[0].src, '/showcase/figma.jpg');
  assert.equal(workspace.tabs[1].src, '/showcase/youtube.jpg');
});

test('five Mouse desktops retain independent tabs, geometry and active state', () => {
  const bank = createBrowserStateBank(), workspace = createTabWorkspace();
  workspace.ensure([capture('maps'), capture('figma')]);
  const added = Array.from({ length: 16 }, () => workspace.add('New tab'));
  workspace.choose(added[15].tabId, capture('youtube'));
  const content = {
    tabs: workspace.snapshot(), layoutId: '2', sources: ['scene-0-maps', added[15].tabId],
    gridRects: [[0, 0, 63, 100], [63, 0, 37, 100]], paneSlots: [1, 0], activePane: 1, zoomed: -1
  };
  bank.remember('mouse', 4, content);
  bank.remember('mouse', 1, { ...content, layoutId: '1', activePane: 0 });
  for (const scene of [3, 5, 0]) bank.remember('mouse', scene, { ...content, layoutId: '2-stacked', paneSlots: [0, 1] });
  content.gridRects[0][2] = 90;
  const restored = bank.recall('mouse', 4);
  assert.deepEqual(restored.gridRects, [[0, 0, 63, 100], [63, 0, 37, 100]]);
  assert.deepEqual(restored.paneSlots, [1, 0]);
  assert.equal(restored.activePane, 1);
  assert.equal(bank.recall('mouse', 1).layoutId, '1');
  for (const scene of [3, 5, 0]) assert.equal(bank.recall('mouse', scene).layoutId, '2-stacked');
  assert.equal(bank.lastScene('mouse'), 0);
  workspace.restore(restored.tabs);
  assert.equal(workspace.tabs.length, 18);
  assert.equal(workspace.tabs.at(-1).src, '/showcase/youtube.jpg');
  const next = workspace.add('New tab');
  assert.equal(next.tabId, 'user-17');
  restored.paneSlots.reverse();
  assert.deepEqual(bank.recall('mouse', 4).paneSlots, [1, 0]);
});

test('a failed capture in a restored base tab can be replaced without losing its identity', () => {
  const workspace = createTabWorkspace();
  workspace.ensure([capture('maps', 'seed-maps')]);
  const saved = workspace.snapshot();
  workspace.reset([]);
  workspace.restore(saved);
  workspace.refresh([capture('figma')], 'Новая вкладка');
  assert.equal(workspace.tabs[0].tabId, 'seed-maps');
  assert.equal(workspace.tabs[0].kind, 'start');
  const chosen = workspace.choose('seed-maps', capture('figma'));
  assert.equal(chosen.tabId, 'seed-maps');
  assert.equal(chosen.src, '/showcase/figma.jpg');
  assert.equal(workspace.tabs.length, 1);
});
