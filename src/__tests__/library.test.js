import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  STORAGE_KEY,
  listDesigns, getDesign, saveDesign, renameDesign, deleteDesign, setUnlocked,
} from '../library.js';
import { normalize } from '../model/achievement.js';

// A Map-backed storage stub — no real localStorage under `node --test`
// (brief §"Tests").
function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

const legacyCoat = { field: 'Gules', ordinary: 'chevron', ordinaryTincture: 'Or' };

// ── round-trip ──

test('round-trip: saveDesign → listDesigns → getDesign deep-equal (post-normalize)', () => {
  const storage = makeStorage();
  const entry = saveDesign(storage, { name: 'Nan’s Arms', coat: legacyCoat });

  assert.ok(entry);
  assert.deepEqual(entry.envelope, { v: 1, coat: normalize(legacyCoat) });

  const list = listDesigns(storage);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0], entry);

  const got = getDesign(storage, entry.id);
  assert.deepEqual(got, entry);
});

// ── entry shape ──

test('saveDesign produces the full entry shape', () => {
  const storage = makeStorage();
  const e = saveDesign(storage, { name: 'A', coat: { field: 'Gules' } });
  assert.equal(typeof e.id, 'string');
  assert.ok(e.id.length > 0);
  assert.equal(e.name, 'A');
  assert.deepEqual(e.envelope, { v: 1, coat: normalize({ field: 'Gules' }) });
  assert.equal(typeof e.createdAt, 'number');
  assert.equal(typeof e.updatedAt, 'number');
  assert.equal(e.unlocked, undefined);
});

test('saveDesign defaults the name to "Untitled" when omitted', () => {
  const storage = makeStorage();
  const e = saveDesign(storage, { coat: { field: 'Gules' } });
  assert.equal(e.name, 'Untitled');
});

test('saveDesign without an id generates unique ids across multiple saves', () => {
  const storage = makeStorage();
  const a = saveDesign(storage, { name: 'A', coat: { field: 'Gules' } });
  const b = saveDesign(storage, { name: 'B', coat: { field: 'Azure' } });
  assert.notEqual(a.id, b.id);
  assert.equal(listDesigns(storage).length, 2);
});

// ── upsert ──

test('upsert: no id creates; that id overwrites (bumps updatedAt, keeps createdAt), no duplicate', () => {
  const storage = makeStorage();
  const first = saveDesign(storage, { name: 'A', coat: { field: 'Gules' } });
  assert.equal(listDesigns(storage).length, 1);

  const second = saveDesign(storage, { id: first.id, coat: { field: 'Azure' } });
  assert.equal(second.id, first.id);
  assert.equal(second.createdAt, first.createdAt);
  assert.ok(second.updatedAt >= first.updatedAt);
  assert.equal(listDesigns(storage).length, 1);
  assert.equal(getDesign(storage, first.id).envelope.coat.field.tincture, 'Azure');
});

test('upsert: overwrite keeps the existing name when no new name is given', () => {
  const storage = makeStorage();
  const first = saveDesign(storage, { name: 'Original', coat: { field: 'Gules' } });
  const second = saveDesign(storage, { id: first.id, coat: { field: 'Azure' } });
  assert.equal(second.name, 'Original');
});

test('upsert: overwrite with a new name replaces it', () => {
  const storage = makeStorage();
  const first = saveDesign(storage, { name: 'Original', coat: { field: 'Gules' } });
  const second = saveDesign(storage, { id: first.id, name: 'Renamed', coat: { field: 'Azure' } });
  assert.equal(second.name, 'Renamed');
});

test('upsert: a given-but-unknown id creates a new entry under that id (no silent id fork)', () => {
  const storage = makeStorage();
  const entry = saveDesign(storage, { id: 'custom-id-123', name: 'A', coat: { field: 'Gules' } });
  assert.equal(entry.id, 'custom-id-123');
  assert.equal(listDesigns(storage).length, 1);
});

test('saveDesign with an unnormalizable coat returns null and writes nothing', () => {
  const storage = makeStorage();
  assert.equal(saveDesign(storage, { name: 'x', coat: null }), null);
  assert.equal(saveDesign(storage, { name: 'x', coat: undefined }), null);
  assert.equal(listDesigns(storage).length, 0);
});

// ── rename / delete / setUnlocked ──

test('renameDesign updates the name and bumps updatedAt', () => {
  const storage = makeStorage();
  const e = saveDesign(storage, { name: 'A', coat: { field: 'Gules' } });
  const renamed = renameDesign(storage, e.id, 'B');
  assert.equal(renamed.name, 'B');
  assert.ok(renamed.updatedAt >= e.updatedAt);
  assert.equal(getDesign(storage, e.id).name, 'B');
});

test('renameDesign on a missing id returns null and creates nothing', () => {
  const storage = makeStorage();
  assert.equal(renameDesign(storage, 'nope', 'X'), null);
  assert.equal(listDesigns(storage).length, 0);
});

test('deleteDesign removes the entry', () => {
  const storage = makeStorage();
  const e = saveDesign(storage, { name: 'A', coat: { field: 'Gules' } });
  assert.equal(deleteDesign(storage, e.id), true);
  assert.equal(listDesigns(storage).length, 0);
  assert.equal(getDesign(storage, e.id), null);
});

test('deleteDesign of a missing id is a no-op (returns false, list unchanged)', () => {
  const storage = makeStorage();
  saveDesign(storage, { name: 'A', coat: { field: 'Gules' } });
  assert.equal(deleteDesign(storage, 'nope'), false);
  assert.equal(listDesigns(storage).length, 1);
});

test('setUnlocked sets and clears the flag; missing id returns null', () => {
  const storage = makeStorage();
  const e = saveDesign(storage, { name: 'A', coat: { field: 'Gules' } });
  const locked = setUnlocked(storage, e.id, true);
  assert.equal(locked.unlocked, true);
  assert.equal(getDesign(storage, e.id).unlocked, true);

  const unlocked = setUnlocked(storage, e.id, false);
  assert.equal(unlocked.unlocked, false);

  assert.equal(setUnlocked(storage, 'nope', true), null);
});

// ── ordering ──

test('listDesigns orders entries most-recently-updated first', () => {
  const storage = makeStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify([
    { id: 'old', name: 'Old', envelope: { v: 1, coat: normalize({ field: 'Gules' }) }, createdAt: 1, updatedAt: 1 },
    { id: 'new', name: 'New', envelope: { v: 1, coat: normalize({ field: 'Azure' }) }, createdAt: 2, updatedAt: 5 },
  ]));
  assert.deepEqual(listDesigns(storage).map((e) => e.id), ['new', 'old']);
});

// ── corrupt / missing storage (read path never throws) ──

test('missing storage key → listDesigns returns []', () => {
  assert.deepEqual(listDesigns(makeStorage()), []);
});

test('garbage JSON in storage → listDesigns returns [], never throws', () => {
  const storage = { getItem: () => 'not-json{{{', setItem: () => {} };
  assert.doesNotThrow(() => listDesigns(storage));
  assert.deepEqual(listDesigns(storage), []);
});

test('storage.getItem throwing → listDesigns returns [], never throws', () => {
  const storage = { getItem: () => { throw new Error('boom'); }, setItem: () => {} };
  assert.doesNotThrow(() => listDesigns(storage));
  assert.deepEqual(listDesigns(storage), []);
});

test('a non-array parsed value → listDesigns returns []', () => {
  const storage = { getItem: () => JSON.stringify({ not: 'an array' }), setItem: () => {} };
  assert.deepEqual(listDesigns(storage), []);
});

test('an individual entry with an unnormalizable coat is dropped, not thrown', () => {
  const storage = makeStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify([
    { id: '1', name: 'bad', envelope: { v: 1, coat: null }, createdAt: 1, updatedAt: 1 },
    { id: '2', name: 'good', envelope: { v: 1, coat: { field: 'Gules' } }, createdAt: 2, updatedAt: 2 },
  ]));
  const list = listDesigns(storage);
  assert.equal(list.length, 1);
  assert.equal(list[0].id, '2');
});

test('undefined/null storage never throws and behaves as an empty library', () => {
  assert.deepEqual(listDesigns(undefined), []);
  assert.equal(getDesign(undefined, 'x'), null);
  assert.equal(deleteDesign(undefined, 'x'), false);
});

// ── quota / write failure (write path never throws) ──

test('quota/write failure → saveDesign returns a failure signal, never throws', () => {
  const storage = { getItem: () => null, setItem: () => { throw new Error('QuotaExceededError'); } };
  let result;
  assert.doesNotThrow(() => { result = saveDesign(storage, { name: 'A', coat: { field: 'Gules' } }); });
  assert.equal(result, null);
});

test('quota/write failure → renameDesign/deleteDesign/setUnlocked also fail without throwing', () => {
  const map = new Map();
  const okStorage = { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)) };
  const e = saveDesign(okStorage, { name: 'A', coat: { field: 'Gules' } });

  const failingStorage = { getItem: okStorage.getItem, setItem: () => { throw new Error('quota'); } };
  assert.doesNotThrow(() => assert.equal(renameDesign(failingStorage, e.id, 'B'), null));
  assert.doesNotThrow(() => assert.equal(deleteDesign(failingStorage, e.id), false));
  assert.doesNotThrow(() => assert.equal(setUnlocked(failingStorage, e.id, true), null));
});
