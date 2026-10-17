"""Read-only SQLite B-tree/overflow page audit, including every index.
Uses sqlite_master roots and the documented SQLite on-disk format. Run only
against a closed local synthetic database; never opens a writable connection.
"""
import sys, sqlite3, json, struct, tempfile
from pathlib import Path

def audit(path):
    # WAL contents can outlive workerd shutdown. A SQLite backup gives a coherent
    # page image without VACUUM, changing the source, or mixing header versions.
    with tempfile.TemporaryDirectory(prefix='dd-sqlite-audit-') as folder:
        snapshot=Path(folder)/'snapshot.sqlite'
        source=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
        target=sqlite3.connect(snapshot)
        source.backup(target);target.close();source.close()
        return audit_snapshot(snapshot)

def audit_snapshot(path):
    data=Path(path).read_bytes()
    assert data[:16]==b'SQLite format 3\0'
    page_size=int.from_bytes(data[16:18],'big'); page_size=65536 if page_size==1 else page_size
    usable=page_size-data[20]; owners={}
    conn=sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)
    assert conn.execute('pragma integrity_check').fetchone()[0]=='ok'
    roots=[('sqlite_schema','table',1)]+conn.execute("select name,type,rootpage from sqlite_master where rootpage>0 and type in ('table','index')").fetchall()
    def varint(pos):
        n=0
        for i in range(9):
            b=data[pos];pos+=1
            if i==8:return (n<<8)|b,pos
            n=(n<<7)|(b&127)
            if b<128:return n,pos
        raise ValueError('varint')
    def own(page,name):
        assert 0<page<=len(data)//page_size and page not in owners,(page,name,owners.get(page))
        owners[page]=name
    def visit(page,name):
        own(page,name);base=(page-1)*page_size;header=base+(100 if page==1 else 0);kind=data[header]
        assert kind in (2,5,10,13),(page,kind)
        interior=kind in (2,5);count=int.from_bytes(data[header+3:header+5],'big')
        if interior:visit(int.from_bytes(data[header+8:header+12],'big'),name)
        pointers=header+(12 if interior else 8)
        for i in range(count):
            cell=base+int.from_bytes(data[pointers+2*i:pointers+2*i+2],'big')
            if interior:
                visit(int.from_bytes(data[cell:cell+4],'big'),name);cell+=4
            if kind==5:continue
            payload,pos=varint(cell)
            if kind==13:_,pos=varint(pos)
            maximum=usable-35 if kind==13 else ((usable-12)*64//255)-23
            minimum=((usable-12)*32//255)-23
            local=payload
            if payload>maximum:
                k=minimum+(payload-minimum)%(usable-4);local=k if k<=maximum else minimum
            if payload>local:
                overflow=int.from_bytes(data[pos+local:pos+local+4],'big');remaining=payload-local
                while remaining>0:
                    own(overflow,name);off=(overflow-1)*page_size
                    overflow=int.from_bytes(data[off:off+4],'big');remaining-=usable-4
                assert overflow==0
    objects=[]
    for name,kind,root in roots:
        before=len(owners);visit(root,name)
        objects.append(dict(name=name,type=kind,pages=len(owners)-before,bytes=(len(owners)-before)*page_size))
    for obj in objects:
        name=obj['name']
        quoted='"'+name.replace('"','""')+'"'
        if obj['type']=='table':
            obj['rows']=conn.execute('SELECT count(*) FROM '+quoted).fetchone()[0]
            cols=conn.execute('PRAGMA table_info('+quoted+')').fetchall()
            expressions=['coalesce(sum(length(CAST("'+c[1].replace('"','""')+'" AS BLOB))),0)' for c in cols]
            obj['columnBytes']=dict(zip([c[1] for c in cols],conn.execute('SELECT '+','.join(expressions)+' FROM '+quoted).fetchone())) if cols else {}
        else:
            obj['table']=conn.execute('SELECT tbl_name FROM sqlite_schema WHERE name=?',(name,)).fetchone()[0]
            obj['definition']=conn.execute('SELECT sql FROM sqlite_schema WHERE name=?',(name,)).fetchone()[0]
    free_count=conn.execute('pragma freelist_count').fetchone()[0]
    conn.close()
    free_pages=set();trunk=int.from_bytes(data[32:36],'big')
    while trunk:
        assert trunk not in owners and trunk not in free_pages
        free_pages.add(trunk);offset=(trunk-1)*page_size
        entries=int.from_bytes(data[offset+4:offset+8],'big')
        assert entries<=(usable-8)//4
        for i in range(entries):
            page=int.from_bytes(data[offset+8+i*4:offset+12+i*4],'big')
            assert 0<page<=len(data)//page_size and page not in owners and page not in free_pages
            free_pages.add(page)
        trunk=int.from_bytes(data[offset:offset+4],'big')
    assert len(free_pages)==free_count
    owned=len(owners)*page_size;free=free_count*page_size;total=len(data)
    assert total>=owned+free,(total,owned,free)
    assert free_count==int.from_bytes(data[36:40],'big')
    return dict(pageSize=page_size,sqliteBytes=total,ownedBytes=owned,freelistBytes=free,otherBytes=total-owned-free,objects=sorted(objects,key=lambda x:-x['bytes']))
if __name__=='__main__':print(json.dumps(audit(sys.argv[1]),indent=2))
