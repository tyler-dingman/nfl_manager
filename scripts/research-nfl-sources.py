"""Explicit public-source research only. Never imports env, connects to DB, or ingests articles.

Usage: python3 scripts/research-nfl-sources.py discover|probe
Stores link and HTTP/feed metadata, not article bodies. X is reference-only.
"""
import concurrent.futures as futures
import datetime as dt
import ipaddress
import json
import pathlib
import re
import sys
import ssl
import urllib.error
import urllib.parse as U
import urllib.request as R
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from email.utils import parsedate_to_datetime

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'reports/source-expansion'
STAMP = dt.datetime.now(dt.timezone.utc).isoformat()

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.links=[]; self.href=None; self.parts=[]; self.feeds=[]
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='a': self.href=a.get('href'); self.parts=[]
        if tag=='link' and a.get('type','') in ('application/rss+xml','application/atom+xml'):
            self.feeds.append(a.get('href',''))
    def handle_data(self, data):
        if self.href: self.parts.append(data)
    def handle_endtag(self, tag):
        if tag=='a' and self.href:
            self.links.append((' '.join(''.join(self.parts).split()),self.href)); self.href=None

def safe(url):
    p=U.urlsplit(url); host=(p.hostname or '').lower()
    if p.scheme not in ('http','https') or p.username or p.password or p.port not in (None,80,443):
        raise ValueError('Not a public HTTP URL')
    if host.removeprefix('www.') in ('localhost','downdistance.com','x.com','twitter.com','mobile.x.com','mobile.twitter.com') or host.endswith(('.local','.internal')):
        raise ValueError('Blocked host')
    try: ipaddress.ip_address(host); raise ValueError('IP literals are not research sources')
    except ValueError as e:
        if str(e)=='IP literals are not research sources': raise
    return url

class Redirect(R.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        safe(newurl)
        if U.urlsplit(newurl).hostname in ('x.com','twitter.com'): raise ValueError('X reference only')
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def get(url):
    safe(url)
    req=R.Request(url,headers={'User-Agent':'DownDistanceSourceResearch/1.0','Accept':'application/rss+xml, application/atom+xml, text/html, application/xml;q=0.9'})
    with R.build_opener(R.ProxyHandler({}), Redirect(), R.HTTPSHandler(context=ssl.create_default_context(cafile='/etc/ssl/cert.pem'))).open(req,timeout=12) as res:
        data=res.read(1_048_577)
        if len(data)>1_048_576: raise ValueError('Research response exceeds 1 MiB')
        return data.decode('utf-8','replace'),dict(res.headers),res.url,res.status

def discover():
    html,_,_,_=get('https://sharpsources.com/sources')
    p=Links();p.feed(html)
    teamlinks=dict((u.rsplit('/',1)[-1],U.urljoin('https://sharpsources.com/',u)) for _,u in p.links if 'teams/nfl/' in u)
    existing=json.loads((OUT/'existing.json').read_text())
    teams={s['teamId'] for s in existing['monitoring'] if s['teamId']!='NFL'}
    names={'ARI':'arizona-cardinals','ATL':'atlanta-falcons','BAL':'baltimore-ravens','BUF':'buffalo-bills','CAR':'carolina-panthers','CHI':'chicago-bears','CIN':'cincinnati-bengals','CLE':'cleveland-browns','DAL':'dallas-cowboys','DEN':'denver-broncos','DET':'detroit-lions','GB':'green-bay-packers','HOU':'houston-texans','IND':'indianapolis-colts','JAX':'jacksonville-jaguars','KC':'kansas-city-chiefs','LV':'las-vegas-raiders','LAC':'los-angeles-chargers','LAR':'los-angeles-rams','MIA':'miami-dolphins','MIN':'minnesota-vikings','NE':'new-england-patriots','NO':'new-orleans-saints','NYG':'new-york-giants','NYJ':'new-york-jets','PHI':'philadelphia-eagles','PIT':'pittsburgh-steelers','SEA':'seattle-seahawks','SF':'san-francisco-49ers','TB':'tampa-bay-buccaneers','TEN':'tennessee-titans','WAS':'washington-commanders'}
    def one(team):
        url=teamlinks[names[team]]; h,_,_,_=get(url);p=Links();p.feed(h)
        found={}
        for text,link in p.links:
            if text.startswith('Read at ') and link.startswith('https://'):
                name=text.removeprefix('Read at ').removesuffix(' →').strip()
                host=U.urlsplit(link).hostname.lower().removeprefix('www.')
                k=(host,name)
                if k not in found: found[k]={'name':name,'url':link,'domain':host,'team':team,'discoveryUrl':url,'checkedAt':STAMP}
        return {'team':team,'directoryUrl':url,'sources':list(found.values())}
    with futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(one,sorted(teams)))
    (OUT/'discovery.json').write_text(json.dumps(results,indent=2)+'\n')
    print({r['team']:len(r['sources']) for r in results})

def probe(feeds_only=False, extras_only=False):
    old=json.loads((OUT/'existing.json').read_text());discovery=json.loads((OUT/'discovery.json').read_text())
    urls=set()
    for s in old['monitoring']:
        if s['platform'] in ('RSS','WEB'):
            urls.add(s['canonicalUrl'])
            if s['metadata'].get('feedUrl'): urls.add(s['metadata']['feedUrl'])
    for s in old['general']:
        if s['platform'] in ('RSS','WEB'):
            for k in ('url','rssUrl'):
                if s.get(k):urls.add(s[k])
    # One direct publisher example per domain per team, deduplicated across teams.
    for team in discovery:
        for s in team['sources']:urls.add(s['url'])
    if feeds_only:
        previous=json.loads((OUT/'probes.json').read_text())
        seen={r['url'] for r in previous}
        urls={f for r in previous for f in r.get('feedLinks',[]) if f not in seen and not U.urlsplit(f).hostname in ('x.com','twitter.com')}
    if extras_only:
        previous=json.loads((OUT/'probes.json').read_text())
        seen={r['url'] for r in previous}
        urls={r['url'] for r in json.loads((OUT/'manual-candidates.json').read_text()) if r['url'] not in seen}
    def one(url):
        row={'url':url,'checkedAt':STAMP}
        try:
            data,headers,final,status=get(url);p=Links();p.feed(data)
            row.update(status=status,finalUrl=final,contentType=headers.get('Content-Type'),feedLinks=[U.urljoin(final,f) for f in p.feeds],etag=headers.get('ETag'),lastModified=headers.get('Last-Modified'))
            # Public metadata only. No publisher text/body retained.
            row['hasAuthorMetadata']=bool(re.search(r'(?:name|property)=[\"\'](?:author|article:author)[\"\']',data,re.I))
            dates=re.findall(r'(?:datePublished|dateModified|article:published_time)[\"\']?\s*(?:content=|:)\s*[\"\']([^\"\']+)',data,re.I)
            row['publicationDates']=dates[:2]
            try:
                root=ET.fromstring(data)
                if root.tag.split('}')[-1] in ('rss','feed','RDF'):
                    items=[e for e in root.iter() if e.tag.split('}')[-1] in ('item','entry')]
                    row['feedItems']=len(items)
                    dates=[e.text for i in items for e in i if e.tag.split('}')[-1] in ('pubDate','published','updated') and e.text]
                    row['feedDates']=dates[:3]
            except ET.ParseError: pass
        except Exception as e: row['error']=str(e)[:180]
        return row
    with futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(one,sorted(urls)))
    if feeds_only or extras_only: results=previous+results
    (OUT/'probes.json').write_text(json.dumps(results,indent=2)+'\n')
    print({'requests':len(results),'ok':sum(r.get('status')==200 for r in results),'feeds':sum('feedItems' in r for r in results)})

if __name__=='__main__': {'discover':discover,'probe':probe,'feeds':lambda:probe(True),'extras':lambda:probe(extras_only=True)}[sys.argv[1]]()
