"""Generate the review inventory and reports from recorded public evidence; no network/DB."""
import csv
import datetime as dt
import hashlib
import json
import pathlib
import re
import urllib.parse as U
from html.parser import HTMLParser
from email.utils import parsedate_to_datetime

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'reports/source-expansion'
DATA=ROOT/'src/data/sources/research'
old=json.loads((OUT/'existing.json').read_text())
discovered=json.loads((OUT/'discovery.json').read_text())
probes=json.loads((OUT/'probes.json').read_text())
teams=sorted(t['team'] for t in discovered)
observations={r['url']:r for r in probes}
stamp=max(p['checkedAt'] for p in probes)
now=dt.datetime.fromisoformat(stamp)

def normalized(url):
    p=U.urlsplit(url);host=(p.hostname or '').lower().removeprefix('www.')
    if host in ('twitter.com','mobile.twitter.com','mobile.x.com'):host='x.com'
    path=p.path.rstrip('/')
    if host=='x.com':path='/'+path.split('/')[1].lower()
    query=U.urlencode(sorted((k,v) for k,v in U.parse_qsl(p.query) if not k.lower().startswith('utm_') and k not in ('fbclid','gclid','ref')))
    return U.urlunsplit(('https',host,path,query,''))

def identity(url):
    p=U.urlsplit(normalized(url));host=p.hostname
    if host in ('x.com','youtube.com','youtu.be','reddit.com'):return normalized(url)
    # Explicit separate NBC editorial desks; no arbitrary stripping of shared hosting paths.
    if host=='nbcsports.com':return 'https://nbcsports.com'+('/nfl/profootballtalk' if '/profootballtalk/' in p.path else '/bayarea' if '/bayarea/' in p.path else '')
    return 'https://'+host

sources={};links=set();aliases=[]
def add(name,url,team_ids,kind,origin,alias=None,feed=None,evidence=None,configured=False):
    if not url:return
    key=identity(url)
    if key not in sources:
        sources[key]={'id':'RESEARCH_'+hashlib.sha256(key.encode()).hexdigest()[:16].upper(),'name':name,'url':key,'canonicalDomain':U.urlsplit(key).hostname,'type':kind,'existingIds':[],'origins':[],'evidenceUrls':[],'sampleUrls':[],'feedUrls':[],'configuredEnabled':False}
    s=sources[key]
    for field,value in [('existingIds',alias),('origins',origin),('evidenceUrls',evidence),('feedUrls',feed),('sampleUrls',url)]:
        if value and value not in s[field]:s[field].append(value)
    s['configuredEnabled'] |= configured
    if kind=='OFFICIAL':s['type']=kind;s['name']=name
    for team in team_ids:
        if team in teams:links.add((s['id'],team))
    if alias:aliases.append({'registry':origin,'id':alias,'sourceId':s['id'],'url':url})

for s in old['general']:
    add(s['displayName'],s.get('url'),[s['team']] if s.get('team') else teams if s['category']!='DATA' else [],s['category'],'general',s['id'],s.get('rssUrl'),configured=s['enabled'])
for s in old['monitoring']:
    add(s['name'],s['canonicalUrl'],teams if s['teamId']=='NFL' or s['metadata'].get('multiTeam') else [s['teamId']], 'OFFICIAL' if s['id'].endswith('OFFICIAL_NEWS') or s['id']=='CHIEFS_COM' else s['platform'],'monitoring',s['id'],s['metadata'].get('feedUrl'),configured=s['active'])
for s in old['video']:
    add(s['name'],s.get('candidateUrl'),[s['teamId']], 'YOUTUBE','video',s['id'])
for r in json.loads((OUT/'manual-candidates.json').read_text()):
    add(r['name'],r['url'],[r['team']],'PUBLICATION','research',evidence=r['discoveryUrl'])
for t in discovered:
    for s in t['sources']:
        add(s['name'],s['url'],[t['team']], 'OFFICIAL' if s['name'].endswith(' official') else 'NEWSLETTER' if 'substack.com' in s['domain'] else 'PUBLICATION','research',evidence=t['directoryUrl'])

# The supplied directory contains exact linked account URLs. Never synthesize a handle.
# It is a discovery reference, not evidence of current activity or affiliation.
class ReporterParser(HTMLParser):
    def __init__(self):super().__init__();self.team=None;self.tag=None;self.text=[];self.urls=[];self.rows=[]
    def handle_starttag(self,t,a):
        if t in ('h3','p'):self.tag=t;self.text=[];self.urls=[]
        if t=='a' and self.tag=='p':
            u=dict(a).get('href','')
            if U.urlsplit(u).hostname in ('x.com','twitter.com') and len(U.urlsplit(u).path.strip('/').split('/'))==1:self.urls.append(u)
    def handle_data(self,d):
        if self.tag:self.text.append(d)
    def handle_endtag(self,t):
        if t!=self.tag:return
        text=' '.join(''.join(self.text).split())
        if t=='h3':self.team=text
        if t=='p' and self.team and self.urls:self.rows.append((self.team,text,self.urls))
        self.tag=None

name_by_slug={t['directoryUrl'].rstrip('/').rsplit('/',1)[-1]:t['team'] for t in discovered}
reporter_input=OUT/'reporter-directory.html'
reporters=[]
if reporter_input.exists():
    parser=ReporterParser();parser.feed(reporter_input.read_text())
    for team_name,text,urls in parser.rows:
        team=name_by_slug.get(team_name.lower().replace(' ','-'))
        if not team:continue
        affiliation=text.split('–',1)[-1].split(':',1)[0].strip() if '–' in text else 'Unverified'
        parts=text.split('–',1)[0].split('&')
        for i,url in enumerate(urls):
            name=re.sub(r'\s*\(.*','',parts[min(i,len(parts)-1)]).strip()
            handle=U.urlsplit(url).path.strip('/')
            printed=re.findall(r'@([A-Za-z0-9_]+)',text)
            conflict=handle.lower() not in [p.lower() for p in printed]
            add(name,url,[team],'X','research',evidence='https://www.unabated.com/post/best-nfl-twitter-follows')
            reporters.append({'team':team,'name':name,'handle':handle,'url':normalized(url),'affiliation':affiliation,'specialty':'Team beat / analysis; confirm on primary biography','recentActivity':None,'reliabilityAssessment':'Not established by directory inclusion','verificationStatus':'DIRECTORY_CONFLICT' if conflict else 'DIRECTORY_ONLY','ingestionFeasibility':'DISCOVERY_ONLY','equivalentAuthorizedUrl':None})
elif (OUT/'reporters.json').exists():
    reporters=json.loads((OUT/'reporters.json').read_text())
    for r in reporters:
        add(r['name'],r['url'],[r['team']],'X','research',evidence='https://www.unabated.com/post/best-nfl-twitter-follows')

def fresh(value):
    try:
        try:d=dt.datetime.fromisoformat(value.replace('Z','+00:00'))
        except ValueError:d=parsedate_to_datetime(value)
        if not d.tzinfo:d=d.replace(tzinfo=dt.timezone.utc)
        return 0 <= (now-d).total_seconds() <= 45*86400
    except (ValueError,TypeError,OverflowError):return False

for key,s in sources.items():
    direct=[p for p in probes if identity(p['url'])==key]
    feed=[p for p in direct if p.get('feedItems',0)>0 and any(fresh(d) for d in p.get('feedDates',[]))]
    pages=[p for p in direct if p.get('status')==200 and any(fresh(d) for d in p.get('publicationDates',[]))]
    signed=any(p.get('hasAuthorMetadata') for p in pages)
    associated=[team for sid,team in links if sid==s['id']]
    reachable=any(p.get('status')==200 for p in direct)
    is_official=s['type']=='OFFICIAL'
    aggregator=s['canonicalDomain'] in ('yardbarker.com','sports.yahoo.com','profootballrumors.com','sbnation.com')
    # Conservative research rubric: a byline is only weak originality evidence (5/25).
    # No claim of independently audited accuracy or original breaking news.
    points={'originalReporting':20 if is_official and feed else 5 if signed and not aggregator else 0,'reliability':20 if is_official and feed else 10 if signed else 0,'teamRelevance':20 if associated else 0,'freshness':15 if feed or pages else 0,'uniqueness':0 if aggregator else 5 if reachable else 0,'accessibility':5 if feed else 3 if reachable else 0}
    score=sum(points.values());qualified=score>=60 and bool(feed or pages) and bool(associated)
    s.update(qualityEvidence=points,qualityScore=score,tier=1 if score>=90 else 2 if score>=75 else 3 if score>=60 else None,qualified=qualified,qualificationScope='Provisional supplemental candidate; editorial accuracy review outstanding',canonicalFeedUrl=feed[0]['finalUrl'] if feed else None,verificationStatus='FEED_VERIFIED' if feed else 'PRIMARY_PAGE_VERIFIED' if pages else 'HTTP_REACHABLE' if reachable else 'DIRECTORY_ONLY' if s['evidenceUrls'] else 'UNVERIFIED',verifiedAt=max(p['checkedAt'] for p in feed+pages) if feed or pages else None,rightsStatus='REVIEW_REQUIRED',ingestionEligible=False,discoveryOnly=not bool(feed),enabled=False,lastSuccessAt=None,lastErrorAt=None,consecutiveFailures=None,averageDailyItems=None,observedFeedItems=feed[0]['feedItems'] if feed else None,originalReportingAssessment='First-party official announcements' if is_official and feed else 'Byline observed; original reporting not established' if signed else 'Not established',redundancyAssessment='Aggregator/syndication; trace original publisher' if aggregator else 'Compare story-level attribution before claiming independence',recommendedAction='HOLD_FOR_RIGHTS_AND_COST_REVIEW' if feed else 'DISCOVERY_ONLY' if s['type']=='X' else 'HOLD_FOR_VERIFICATION')
    s['classification']='EXISTING_FAILING' if s['existingIds'] and direct and not reachable else 'EXISTING_ACTIVE' if s['existingIds'] and s['configuredEnabled'] else 'EXISTING_INACTIVE' if s['existingIds'] else 'NEW_RECOMMENDED' if qualified else 'NEW_DISCOVERY_ONLY'
    s['classificationScope']='Repository configuration / one-shot public probe; production state unknown'
    s['feedUrls']=sorted(set(s['feedUrls']+[p['url'] for p in feed]))

inventory={'checkedAt':stamp,'sources':sorted(sources.values(),key=lambda s:s['id']),'teamSources':[{'sourceId':sid,'teamId':team} for sid,team in sorted(links)],'aliases':aliases}
DATA.mkdir(parents=True,exist_ok=True)
(DATA/'inventory.json').write_text(json.dumps(inventory,indent=2)+'\n')
(OUT/'reporters.json').write_text(json.dumps(reporters,indent=2)+'\n')
with (ROOT/'NFL_SOURCE_REGISTRY.csv').open('w',newline='') as f:
    w=csv.writer(f,lineterminator="\n");w.writerow(['Team','Source','URL','Type','Quality score','Tier','Existing/New','Ingestion method','Ingestion eligibility','Verification status','Recommended action','Source ID','Qualified','Rights status','Configured enabled (not production)','Last successful ingestion','Average daily items','Error rate','Original reporting','Evidence URLs'])
    for s in inventory['sources']:
        ts=[team for sid,team in links if sid==s['id']] or ['NFL / unassigned']
        for t in sorted(ts):w.writerow([t,s['name'],s['url'],s['type'],s['qualityScore'],s['tier'] or 'REVIEW','Existing' if s['existingIds'] else 'New','RSS_ATOM' if s['canonicalFeedUrl'] else 'DISCOVERY_ONLY','NO',s['verificationStatus'],s['recommendedAction'],s['id'],s['qualified'],s['rightsStatus'],s['configuredEnabled'],'UNKNOWN','UNKNOWN','UNKNOWN',s['originalReportingAssessment'],' | '.join(s['evidenceUrls']+s['sampleUrls'][:1])])
    for s in old['video']:
        if not s.get('candidateUrl'):w.writerow([s.get('teamId') or 'NFL',s['name'],'UNRESOLVED','YOUTUBE','','REVIEW','Existing','NONE','NO','UNVERIFIED','RESOLVE_IMMUTABLE_CHANNEL_ID',s['id'],False,'REVIEW_REQUIRED',False,'UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','Repository video catalog'])
    for s in old['general']:
        if not s.get('url'):w.writerow([s.get('team') or 'NFL',s['displayName'],'UNRESOLVED',s['platform'],'','REVIEW','Existing','NONE','NO','UNVERIFIED','RESOLVE_PRIMARY_URL',s['id'],False,'REVIEW_REQUIRED',s['enabled'],'UNKNOWN','UNKNOWN','UNKNOWN','UNKNOWN','Repository general registry'])

summary={'uniqueSources':len(sources),'teamAssignments':len(links),'existingUniqueSources':sum(bool(s['existingIds']) for s in sources.values()),'newUniqueSources':sum(not s['existingIds'] for s in sources.values()),'qualifiedUniqueSources':sum(s['qualified'] for s in sources.values()),'technicalFeedSources':sum(bool(s['canonicalFeedUrl']) for s in sources.values()),'ingestionEligible':0,'discoveryOnly':sum(s['discoveryOnly'] for s in sources.values()),'newEnabled':0,'productionEnabled':'UNKNOWN','existingRawRecords':{k:len(v) for k,v in old.items()},'unresolvedVideoRecords':sum(not s.get('candidateUrl') for s in old['video']),'teams':[]}
by_id={s['id']:s for s in sources.values()}
for team in teams:
    ss=[by_id[sid] for sid,t in links if t==team]
    summary['teams'].append({'team':team,'total':len(ss),'qualified':sum(s['qualified'] for s in ss),'technicalFeeds':sum(bool(s['canonicalFeedUrl']) for s in ss),'existing':sum(bool(s['existingIds']) for s in ss),'new':sum(not s['existingIds'] for s in ss),'discoveryOnly':sum(s['discoveryOnly'] for s in ss),'localXReferences':sum(r['team']==team for r in reporters),'qualifiedGap':max(0,20-sum(s['qualified'] for s in ss))})
(OUT/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='teams'},indent=2))
