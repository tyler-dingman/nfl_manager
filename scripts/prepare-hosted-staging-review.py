"""Generate a LOCAL review package only. No network, subprocesses, or deployment."""
import json, pathlib, tomllib
root = pathlib.Path(__file__).resolve().parents[1]
out = root / 'reports/hosted-staging'
out.mkdir(parents=True, exist_ok=True)
account = '6e8c301360ab628706dcf3acf55f0dbb'
roles = ['password', 'api', 'odds-processor', 'application', 'web']
configs = {}
for role in roles:
    text = (root / f'config/rc2.{role}.toml').read_text()
    text = text.replace('down-distance-rc2-staging-', 'down-distance-rc3-staging-')
    text = text.replace('dd-rc2-staging-', 'dd-rc3-staging-').replace('rc2-staging-review', 'rc3-hosted-review')
    text = '# LOCAL REVIEW ONLY: account safety and owner deployment approval are outstanding.\naccount_id = "' + account + '"\n' + text
    if role == 'web':
        text = text.replace('# Private staging gate denies missing/invalid Access claims; synthetic resource IDs.', '# Existing mTLS gate; no public route until hostname and certificates are approved.')
        text = text.replace('APP_PASSWORD_ENABLED = "true"', 'APP_PASSWORD_ENABLED = "true"\nAPP_MAIL_ENABLED = "false"\nSEARCH_ANSWER_PROVIDER = "deterministic"')
    path = root / f'config/rc3-hosted.{role}.toml'
    path.write_text(text)
    configs[role] = tomllib.loads(text)
physical = {}
for role, config in configs.items():
    assert config['account_id'] == account
    assert config['workers_dev'] is False and config['preview_urls'] is False
    assert not config.get('routes') and not config.get('triggers', {}).get('crons')
    assert not config.get('r2_buckets') and not config.get('hyperdrive')
    assert config['name'] == 'down-distance-rc3-staging-' + role
    for service in config.get('services', []):
        assert service['service'] in {c['name'] for c in configs.values()}
        assert service['service'] != 'dnd-content-scheduler'
    for key, value in config.get('vars', {}).items():
        assert not any(s in key for s in ['DATABASE_URL', 'R2_', 'API_KEY', 'SECRET'])
        if key.endswith('_ENABLED') and key != 'APP_PASSWORD_ENABLED': assert value == 'false'
    for binding in config.get('d1_databases', []):
        assert binding['database_name'].startswith('dd-rc3-staging-')
        assert binding['remote'] is False
        assert physical.setdefault(binding['binding'], binding['database_id']) == binding['database_id']
        assert (root/'config'/binding['migrations_dir']).resolve().is_dir()
assert len(physical) == 10 and len(set(physical.values())) == 10
assert configs['web']['main'] == '../workers/staging/mtls-index.ts'
assert configs['web']['assets']['run_worker_first'] is True
assert 'REPLACE_' in configs['web']['vars']['STAGING_MTLS_HOST']
assert 'REPLACE_' in configs['web']['vars']['STAGING_MTLS_SHA256']
cli = 'node node_modules/wrangler/bin/wrangler.js'
lines = [
 '# REVIEW ONLY. NO REMOTE APPROVAL HAS BEEN GIVEN. DO NOT EXECUTE THIS FILE.',
 '# Phase 1 is BLOCKED: subscriptions API returned 403; Free plan and account usage unverified.',
 '# Reverify the selected account, quota usage, no-billing eligibility, and name conflicts before any approval.',
 '# All creation/deploy commands below require a separate explicit owner approval of this exact package.',
 '# Expected account: ' + account,
 '# Keep the existing dnd-content-scheduler unchanged; do not deploy a scheduler.',
 '', '# AFTER OWNER APPROVAL ONLY: create these ten isolated synthetic staging databases.',
]
for binding in configs['api']['d1_databases']:
    lines.append(f'{cli} d1 create {binding["database_name"]} --config config/rc3-hosted.api.toml')
lines += ['', '# STOP: record the ten RETURNED database IDs consistently in all five configs.',
          '# Reject synthetic IDs; never bind an existing production database.',
          '# Apply each role migration directory, including users/0008_account_erasure_completion.sql.']
for binding in configs['api']['d1_databases']:
    lines.append(f'{cli} d1 migrations apply {binding["binding"]} --remote --config config/rc3-hosted.api.toml')
lines += ['', '# Generate new staging-only secrets outside the repository. Never reuse production credentials.',
          '# Upload identical new AUTH_JWT_SECRET to API and Web. Do not supply provider/email/AI keys.']
secret_commands = []
for role, keys in {'api':['AUTH_JWT_SECRET','APP_MAIL_ENCRYPTION_KEY','CONTENT_AUTOMATION_SECRET','APP_MAIL_JOB_SECRET'], 'web':['AUTH_JWT_SECRET'], 'application':['CONTENT_AUTOMATION_SECRET','APP_MAIL_JOB_SECRET']}.items():
    for key in keys: secret_commands.append(f'{cli} secret put {key} --config config/rc3-hosted.{role}.toml')
lines += ['', '# STOP: approve the staging-only hostname/zone and individual tester certificates.',
          '# Configure mTLS presentation on that hostname; set host and SHA-256 allowlist in Web.',
          '# Set staging-only AUTH_BASE_URL on API and Web. Keep every feature flag/cron disabled.',
          '# No routes are currently configured. Review the exact hostname route separately before attaching it.',
          '# Compile the approved config locally; this step is not deployment.',
          'DD_BUILD_WRANGLER_CONFIG=config/rc3-hosted.web.toml node scripts/build-split-worker.mjs',
          '', '# AFTER EXPLICIT DEPLOYMENT APPROVAL ONLY: internal Workers first, gated Web last.']
for role in roles: lines.append(f'{cli} deploy --config config/rc3-hosted.{role}.toml')
lines += ['', '# Upload fresh staging secrets only AFTER the route-free Workers exist; avoid implicit Worker creation.'] + secret_commands
lines += ['', '# No public hostname/route creation command is approved or generated while its value is unknown.',
          '# After separately reviewed hostname attachment, verify anonymous/invalid/spoofed-header denial',
          '# on both assets and APIs before admitting approved synthetic testers.',
          '# Read actual per-Worker CPU and account-wide D1 analytics; local elapsed time is not CPU.',
          '# Recovery target approval is separate: ten new empty destinations cannot coexist with ten',
          '# occupied databases in a ten-slot Free account. Do not delete databases to make room.',
          '# Select a separately approved empty Free recovery account or explicitly review replacement',
          '# of synthetic staging databases after a verified backup and current independent erasure ledger.',
          '# No database deletion, R2 activation, billing change, ingestion, or cron command is generated.', '']
(out/'commands-for-owner-review.txt').write_text('\n'.join(lines))
result = {'status':'PASS','scope':'local static review package only; not hosted verification or deployment approval',
 'accountId':account,'workers':[c['name'] for c in configs.values()],
 'databases':[b['database_name'] for b in configs['api']['d1_databases']],
 'distinctD1Bindings':10,'cronTriggers':0,'r2Bindings':0,'postgresBindings':0,
 'publicWorkersDev':False,'previewUrls':False,'routesConfigured':False,'assetsRunWorkerFirst':True,
 'actualDatabaseIdsConfigured':False,'approvedHostConfigured':False,'testerAllowlistConfigured':False,
 'remoteMutationsPerformed':False,'deploymentApproved':False,'existingSchedulerModified':False}
(out/'local-package-check.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
