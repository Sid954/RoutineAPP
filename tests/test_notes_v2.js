const assert = require('assert');
const mem = {};
global.localStorage = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };

(async () => {
  console.log('Testing the Notes store (v2)...');
  // Old to-do notes exist before the store is first read
  mem.notes_v1 = JSON.stringify([
    { id: 'a1', text: 'Bring the lab report', subject: 'dsl', date: '2026-11-05', done: false, createdAt: 1000 },
    { id: 'a2', text: 'Read chapter 3', subject: '', date: '', done: true, createdAt: 2000 }
  ]);
  const N = await import('../src/notes/notes-store.js');

  // 1. Migration
  let all = N.listNotes();
  assert.strictEqual(all.length, 2);
  const a1 = N.getNote('a1');
  assert.strictEqual(a1.type, 'list'); assert.strictEqual(a1.items[0].text, 'Bring the lab report');
  assert.strictEqual(a1.due, '2026-11-05'); assert.strictEqual(a1.subject, 'DSL');
  assert.strictEqual(N.isDone(N.getNote('a2')), true, 'a ticked old note is a finished list');
  assert.ok(mem.notes_v1_backup, 'the old data is kept as a backup');
  assert.ok(JSON.parse(mem.notes_v2).length === 2);
  console.log('✅ old to-do notes migrate');

  // 2. Create: notes, lists, blank ones are refused, due date is optional
  assert.strictEqual(N.addNote({ type: 'note', title: '  ', body: '   ' }), null);
  const n1 = N.addNote({ type: 'note', title: 'Chapter 4 summary', body: 'Entropy measures disorder.\nSecond law.', subject: 'ph', tags: ['#Exam', 'exam', 'Lab Notes'] });
  assert.deepStrictEqual(n1.tags, ['exam', 'lab-notes']); assert.strictEqual(n1.due, ''); assert.strictEqual(n1.subject, 'PH');
  const l1 = N.addNote({ type: 'list', title: 'Pack', items: [{ text: 'charger' }, { text: 'lab coat' }], due: '2026-12-01', dueTime: '08:30' });
  assert.strictEqual(l1.items.length, 2); assert.strictEqual(l1.dueTime, '08:30');
  assert.strictEqual(N.normalizeNote({ type: 'note', due: '', dueTime: '08:30' }).dueTime, '', 'a time needs a date');
  console.log('✅ create');

  // 3. Lists: ticking items, done state, notes for a subject
  N.toggleItem(l1.id, N.getNote(l1.id).items[0].id);
  assert.strictEqual(N.isDone(N.getNote(l1.id)), false);
  N.toggleItem(l1.id, N.getNote(l1.id).items[1].id);
  assert.strictEqual(N.isDone(N.getNote(l1.id)), true);
  assert.strictEqual(N.notesForSubject('ph').length, 1);
  assert.strictEqual(N.isOverdue({ due: '2026-11-01', type: 'note', done: false, items: [] }, '2026-11-20'), true);
  console.log('✅ lists and done state');

  // 4. Search, sort, pin
  assert.strictEqual(N.listNotes({ query: 'entropy' }).length, 1);
  assert.strictEqual(N.listNotes({ query: 'second LAW' }).length, 1, 'every word, any case');
  assert.strictEqual(N.listNotes({ query: '#exam' }).length, 1);
  assert.strictEqual(N.listNotes({ query: 'charger' }).length, 1, 'list items are searched');
  assert.strictEqual(N.listNotes({ query: 'nothing here' }).length, 0);
  assert.deepStrictEqual(N.listNotes({ sort: 'title' }).slice(0, 2).map(n => n.title || N.firstLine(n)), ['Bring the lab report', 'Chapter 4 summary'], 'by title, or by the first line');
  assert.strictEqual(N.listNotes({ sort: 'due' })[0].id, 'a1', 'earliest due first');
  N.pinNote('a2', true);
  assert.strictEqual(N.listNotes()[0].id, 'a2', 'pinned notes come first');
  console.log('✅ search, sort, pin');

  // 5. Archive, trash, restore, purge
  N.archiveNote(n1.id);
  assert.strictEqual(N.listNotes({ view: 'notes' }).some(n => n.id === n1.id), false);
  assert.strictEqual(N.listNotes({ view: 'archive' }).length, 1);
  N.archiveNote(n1.id, false);
  N.trashNote(l1.id);
  assert.strictEqual(N.listNotes().some(n => n.id === l1.id), false);
  assert.strictEqual(N.listNotes({ view: 'trash' }).length, 1);
  N.restoreNote(l1.id);
  assert.strictEqual(N.listNotes({ view: 'trash' }).length, 0);
  N.trashNote(l1.id);
  assert.strictEqual(N.purgeOldTrash(Date.now() + 10 * 864e5), 0, 'ten days in the trash is fine');
  assert.strictEqual(N.purgeOldTrash(Date.now() + 31 * 864e5), 1, 'after 30 days it is deleted');
  assert.strictEqual(N.getNote(l1.id), null);
  console.log('✅ archive, trash, purge');

  // 6. Convert, duplicate, text, words
  const c = N.convertNote(n1.id);
  assert.strictEqual(c.type, 'list'); assert.deepStrictEqual(c.items.map(i => i.text), ['Entropy measures disorder.', 'Second law.']);
  const back = N.convertNote(n1.id);
  assert.strictEqual(back.type, 'note'); assert.strictEqual(back.body, 'Entropy measures disorder.\nSecond law.');
  const dup = N.duplicateNote(n1.id);
  assert.strictEqual(dup.title, 'Chapter 4 summary (copy)'); assert.notStrictEqual(dup.id, n1.id);
  assert.ok(N.noteText(N.getNote('a1')).includes('[ ] Bring the lab report'));
  assert.strictEqual(N.wordCount({ title: 'Two words', type: 'note', body: 'and three more', items: [] }), 5);
  console.log('✅ convert, duplicate, text');

  // 7. Backup: export, import merges and keeps the newest copy
  const json = N.exportNotes();
  assert.ok(JSON.parse(json).notes.length >= 3);
  const before = N.listNotes().length;
  assert.strictEqual(N.importNotes(json), 0, 'importing the same data changes nothing');
  const edited = JSON.parse(json); edited.notes[0].updatedAt += 5000; edited.notes[0].title = 'Edited elsewhere';
  edited.notes.push({ type: 'note', title: 'From another phone', body: 'hello' });
  assert.strictEqual(N.importNotes(edited), 2);
  assert.strictEqual(N.listNotes().length, before + 1);
  assert.strictEqual(N.importNotes('not json'), -1);
  N.emptyTrash();
  console.log('✅ export and import');
  console.log('All Notes store tests passed.');
})().catch(e => { console.error(e); process.exit(1); });
