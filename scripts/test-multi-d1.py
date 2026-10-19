"""Feasibility regression tests; deliberately no application multi-D1 claim."""
import importlib.util,unittest
from pathlib import Path
p=Path(__file__).with_name('project-multi-d1.py')
s=importlib.util.spec_from_file_location('model',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Feasibility(unittest.TestCase):
 def test_all_teams_once(self):
  teams=sum(m.GROUPS,[]);self.assertEqual(len(set(teams)),32)
  for i,g in enumerate(m.GROUPS):
   self.assertEqual(len(g),4)
   for t in g:self.assertEqual(m.route(t),f'TEAM_{i+1}')
 def test_unknown_fails_closed(self):
  for t in ['',None,'NFL','../../USER']:
   with self.assertRaises(ValueError):m.route(t)
 def test_inventory_complete(self):
  self.assertEqual(len(m.inventory),len(set(m.tables)));self.assertEqual(len(m.tables),182)
  self.assertTrue(all(r['allocation'] in {'TEAM_OWNER','USER','SHARED','LOCAL_INTERNAL'} for r in m.inventory))
 def test_auth_central(self):
  for t in ['app_users','app_sessions','app_credentials','app_saved_content','app_heads','app_franchise_heads']:self.assertEqual(m.owner(t),'USER')
 def test_content_and_local_namespaces(self):
  for t in ['app_editorial_stories','app_odds_history','app_search','app_search_data']:self.assertEqual(m.owner(t),'TEAM_OWNER')
  for t in ['app_payload_objects','app_storage_pins']:self.assertEqual(m.owner(t),'LOCAL_INTERNAL')
 def test_all_scenarios(self):
  self.assertEqual(len(m.rows),20)
  for r in m.rows:
   self.assertEqual(len(r['databasesBytes']),10);self.assertEqual(r['accountBytes'],sum(r['databasesBytes'].values()))
   comp,old,_=m.ns['scenario'](r['dau'],r['days'],0)
   expected=old+9*comp['fixedSchemaAndRegistry']*1.2
   self.assertLess(abs(expected-r['accountBytes']),20)
   self.assertGreaterEqual(r['allReferencesAccountBytes'],r['accountBytes'])
 def test_50_dau_not_certified(self):
  r=next(r for r in m.rows if r['dau']==50 and r['days']==365)
  self.assertLess(max(r['databasesBytes'].values()),350000000)
  self.assertGreater(r['operations']['d1WritesPerDayAmplificationSensitivity'],100000)
  self.assertGreater(r['allReferencesMaxDatabaseBytes'],500000000)
 def test_queries_are_baseline_only(self):
  q=m.json.loads((m.ROOT/'reports/approved-retention/queries.json').read_text())
  self.assertEqual(q['samples'],1180);self.assertEqual(q['maximum'],38);self.assertEqual(q['atLeast50'],0)
 def test_cross_database_dependencies_exist(self):self.assertGreater(len(m.cross),0)
if __name__=='__main__':unittest.main(verbosity=2)
