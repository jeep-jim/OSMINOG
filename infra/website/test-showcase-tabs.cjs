'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createTabWorkspace } = require('../../website/showcase.js');

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
