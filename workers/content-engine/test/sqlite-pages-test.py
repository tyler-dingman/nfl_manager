import importlib.util, sqlite3, tempfile, pathlib, unittest
spec=importlib.util.spec_from_file_location('pages',pathlib.Path(__file__).parents[1]/'scripts/sqlite-pages.py')
pages=importlib.util.module_from_spec(spec);spec.loader.exec_module(pages)
class PageAuditTest(unittest.TestCase):
 def test_overflow_indexes_without_rowid_and_freelist(self):
  with tempfile.TemporaryDirectory() as folder:
   path=pathlib.Path(folder)/'synthetic.sqlite';db=sqlite3.connect(path)
   db.executescript('CREATE TABLE records(id INTEGER PRIMARY KEY, value BLOB); CREATE INDEX text_index ON records(value); CREATE TABLE keyed(k TEXT PRIMARY KEY,v BLOB) WITHOUT ROWID;')
   for i in range(100):
    value=(str(i)+'synthetic evidence '*1000).encode();db.execute('INSERT INTO records VALUES(?,?)',(i,value));db.execute('INSERT INTO keyed VALUES(?,?)',(str(i),value))
   db.commit();db.execute('DELETE FROM records WHERE id>90');db.commit();db.close()
   result=pages.audit(path)
   self.assertEqual(result['otherBytes'],0)
   self.assertEqual(result['sqliteBytes'],result['ownedBytes']+result['freelistBytes'])
   self.assertTrue(all(x['bytes']>4096 for x in result['objects'] if x['name'] in ('records','text_index','keyed')))
 def test_pending_wal_is_included_in_coherent_snapshot(self):
  with tempfile.TemporaryDirectory() as folder:
   path=pathlib.Path(folder)/'wal.sqlite';db=sqlite3.connect(path)
   db.execute('pragma journal_mode=wal');db.execute('pragma wal_autocheckpoint=0')
   db.execute('CREATE TABLE evidence(id INTEGER PRIMARY KEY,value BLOB)');db.commit()
   for i in range(200):db.execute('INSERT INTO evidence VALUES(?,?)',(i,b'synthetic '*1000))
   db.commit();expected=db.execute('pragma page_count').fetchone()[0]*db.execute('pragma page_size').fetchone()[0]
   self.assertLess(path.stat().st_size,expected)
   result=pages.audit(path);self.assertEqual(result['sqliteBytes'],expected)
   self.assertGreaterEqual(result['otherBytes'],0);db.close()
if __name__=='__main__':unittest.main()
