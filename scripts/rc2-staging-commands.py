"""Print commands for review ONLY. Never executes subprocesses or contacts Cloudflare."""
import pathlib,tomllib
root=pathlib.Path(__file__).resolve().parents[1]
config=tomllib.loads((root/'config/rc2.api.toml').read_text())
print('# REMOTE ACTIONS REQUIRE SEPARATE EXPLICIT APPROVAL; do not execute this output now.')
print('# First confirm account is Workers Free, no billing upgrade, ten free slots/headroom.')
for db in config['d1_databases']:
 print('npx wrangler d1 create '+db['database_name'])
print('# Record returned staging IDs in all four binding configurations; reject placeholders.')
for db in config['d1_databases']:
 print('npx wrangler d1 migrations apply '+db['binding']+' --remote --config config/rc2.api.toml')
print('# Configure approved staging hostname + mTLS, install individual tester certs; record SHA256 allowlist.')
print('# Set AUTH_BASE_URL to that HTTPS hostname in API/Web configurations.')
for role, keys in {'api':['AUTH_JWT_SECRET','APP_MAIL_ENCRYPTION_KEY','CONTENT_AUTOMATION_SECRET','APP_MAIL_JOB_SECRET'], 'web':['AUTH_JWT_SECRET'], 'application':['CONTENT_AUTOMATION_SECRET','APP_MAIL_JOB_SECRET']}.items():
 for key in keys: print('npx wrangler secret put '+key+' --config config/rc2.'+role+'.toml')
print('# Revalidate configuration and build. Keep every cron/ingestion/delivery flag disabled.')
for role in ['password','api','odds-processor','application','web']:
 print('npx wrangler deploy --config config/rc2.'+role+'.toml')
print('# mTLS client is also required for health/API checks; never place the key in public assets.')
print('# curl --cert /secure/tester.pem --key /secure/tester.key https://APPROVED_HOST/api/auth/config')
print('# Anonymous and spoofed-certificate-header requests MUST return 403, including /_next assets.')
print('# Emergency: remove web route/deny all certificate fingerprints; keep service workers private.')
print('# Code rollback: wrangler versions list --config CONFIG; wrangler rollback VERSION --config CONFIG.')
print('# Stop ingress and every writer first; do not roll back schemas or replace D1 data in place.')
