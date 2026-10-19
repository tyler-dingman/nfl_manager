import json,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class CapacityGate(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.data=json.loads((ROOT/'reports/multi-d1-staging/capacity.json').read_text())
 def test_all_scenarios(self):
  self.assertEqual(len(self.data['rows']),16)
  self.assertEqual({(r['dau'],r['days']) for r in self.data['rows']},{(d,t) for d in [0,25,50,100] for t in [30,90,180,365]})
 def test_conservation_and_reference_sensitivity(self):
  for r in self.data['rows']:
   self.assertEqual(len(r['baseDatabasesBytes']),10)
   self.assertEqual(sum(r['baseDatabasesBytes'].values()),r['baseAccountBytes'])
   self.assertEqual(sum(r['retainedDatabasesBytes'].values()),r['retainedAccountBytes'])
   self.assertTrue(all(r['retainedDatabasesBytes'][k]>=v for k,v in r['baseDatabasesBytes'].items()))
 def test_gate_remains_closed(self):
  self.assertEqual(self.data['gate'],'FAIL');self.assertFalse(self.data['routingImplemented'])
  r=next(r for r in self.data['rows'] if r['dau']==50 and r['days']==365)
  self.assertGreater(r['teamAverageLowerBoundBytes'],350000000)
  self.assertGreater(max(r['optimisticZeroOldSavedOddsDatabasesBytes'].values()),350000000)
  self.assertGreater(r['fourVersionSteadyStateWritesSensitivity'],70000)
 def test_no_unmeasured_routing_or_extra_daily_allowance(self):
  for r in self.data['rows']:
   self.assertIsNone(r['maximumMultiD1Queries']);self.assertIsNone(r['multiD1AdditionalDailyOperations'])
   self.assertEqual(r['maximumSingleD1Queries'],47)
 def test_every_mapping_contains_each_team_once(self):
  for strategy in self.data['rows'][0]['strategies'].values():
   teams=sum(strategy['teams'],[]);self.assertEqual(len(teams),32);self.assertEqual(len(set(teams)),32)
 def test_every_current_table_and_polling_owner(self):
  self.assertEqual(len(self.data['currentTableInventory']),184)
  roles={r['table']:r['role'] for r in self.data['currentTableInventory']}
  self.assertEqual(roles['app_storage_poll_batch'],'SHARED');self.assertEqual(roles['app_storage_poll_retry'],'SHARED')
  self.assertEqual(len(self.data['crossRoleForeignKeys']),28)
 def test_revision_measurements_verified(self):
  for r in self.data['canonicalMeasurements']:self.assertTrue(r['allRevisionsVerified']);self.assertEqual(r['versions'],4)
if __name__=='__main__':unittest.main()
