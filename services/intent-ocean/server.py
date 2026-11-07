"""OSMINOG intention ocean: invitation-only, single-node pilot, no external AI.

Run behind the supplied TLS reverse proxy. SQLite is deliberately bounded for
this pilot; this is not a multi-worker/distributed production architecture.
"""
from __future__ import annotations
import base64, contextlib, hashlib, hmac, io, json, mimetypes, os, re, secrets, sqlite3, threading, time, urllib.parse
from collections import defaultdict, deque
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import Image, ImageOps

VERSION = '0.3.0-pilot.1'
MAX_BODY = 3_000_000
Image.MAX_IMAGE_PIXELS = 16_000_000
KINDS = {'seek', 'offer', 'discuss', 'together'}

class Failure(Exception):
    def __init__(self, code, message): self.code, self.message = code, message

def require(condition, code=400, message='Некорректный запрос'):
    if not condition: raise Failure(code, message)

def clean(value, limit=2000):
    require(isinstance(value, str) and 0 < len(value.strip()) <= limit)
    return value.strip()

def digest(value): return hashlib.sha256(value.encode()).hexdigest()
def now(): return int(time.time())
def uid(): return secrets.token_hex(16)
def password(value, salt):
    return hashlib.scrypt(value.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1, dklen=32).hex()
def tokens(text):
    # Explicit lexical baseline, not semantic AI. Small stems help Russian inflections.
    words = re.findall(r'[\w]+', text.lower().replace('ё', 'е'))
    stop = {'ищу','продам','куплю','есть','хочу','могу','нужен','нужна','нужно','такой','такую','для','или','это','как','что'}
    return {w[:5] if len(w)>5 else w for w in words if len(w)>2 and w not in stop}

def normalize_file(value):
    require(isinstance(value, dict))
    name = clean(value.get('name'), 120)
    mime = value.get('type')
    require(mime in {'image/jpeg','image/png','application/pdf','text/plain'}, 415, 'Разрешены JPEG, PNG, PDF и TXT')
    try: data = base64.b64decode(value.get('data',''), validate=True)
    except Exception: raise Failure(400,'Некорректное вложение')
    require(0 < len(data) <= 2_000_000, 413, 'Вложение должно быть меньше 2 МБ')
    if mime.startswith('image/'):
        try:
            with Image.open(io.BytesIO(data)) as image:
                require(image.format in {'JPEG','PNG'} and image.width*image.height <= 16_000_000, 413, 'Слишком большое изображение')
                image = ImageOps.exif_transpose(image)
                image.thumbnail((1600,1600))
                out = io.BytesIO(); image.convert('RGB').save(out, 'JPEG', quality=86)
                data = out.getvalue(); mime = 'image/jpeg'; name = Path(name).stem + '.jpg'
        except Failure: raise
        except Exception: raise Failure(400,'Не удалось прочитать изображение')
    elif mime == 'application/pdf': require(data.startswith(b'%PDF-'), 415, 'Это не PDF')
    else:
        try: data.decode('utf-8')
        except UnicodeDecodeError: raise Failure(415,'TXT должен быть в UTF-8')
    return name, mime, data

class Ocean:
    def __init__(self, db_path, web_root, origin='https://osminog.red', local=False):
        self.web_root = Path(web_root).resolve(); self.origin = origin; self.local = local
        require(origin == 'https://osminog.red' or (local and origin.startswith('http://127.0.0.1:')), 500, 'Недопустимый origin')
        self.lock = threading.RLock(); self.auth_limit = threading.Semaphore(2)
        self.db = sqlite3.connect(db_path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.executescript('''
          PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA max_page_count=262144;
          CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,login TEXT UNIQUE, name TEXT,salt TEXT,passhash TEXT,avatar TEXT DEFAULT 'plankton');
          CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user TEXT REFERENCES users(id),csrf TEXT,expires INTEGER);
          CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,uses INTEGER,expires INTEGER);
          CREATE TABLE IF NOT EXISTS intents(id TEXT PRIMARY KEY,owner TEXT REFERENCES users(id),text TEXT,kind TEXT,audience TEXT,created INTEGER,expires INTEGER,closed INTEGER DEFAULT 0,nonce TEXT,UNIQUE(owner,nonce));
          CREATE TABLE IF NOT EXISTS threads(id TEXT PRIMARY KEY,intent TEXT REFERENCES intents(id),a TEXT,b TEXT,created INTEGER,UNIQUE(intent,b));
          CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,thread TEXT REFERENCES threads(id),sender TEXT,text TEXT,created INTEGER,nonce TEXT,UNIQUE(sender,nonce));
          CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,owner TEXT,intent TEXT REFERENCES intents(id),name TEXT,mime TEXT,data BLOB);
          CREATE TABLE IF NOT EXISTS blocks(owner TEXT,target TEXT,PRIMARY KEY(owner,target));
          CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,reporter TEXT,intent TEXT,reason TEXT,created INTEGER);
          CREATE INDEX IF NOT EXISTS intent_owner ON intents(owner,created);
          CREATE INDEX IF NOT EXISTS message_thread ON messages(thread,created);
        ''')
        self.limits = defaultdict(deque)
    def limit(self, key, amount, seconds=60):
        t = time.monotonic(); q = self.limits[key]
        while q and t-q[0] > seconds: q.popleft()
        require(len(q)<amount,429,'Слишком часто. Попробуй немного позже.')
        q.append(t)
        if len(self.limits)>5000:
            self.limits = defaultdict(deque,{k:v for k,v in self.limits.items() if v and t-v[-1]<600})
    def invite(self, uses=10):
        code=secrets.token_urlsafe(24)
        with self.lock, self.db:
            self.db.execute('INSERT INTO invites VALUES(?,?,?)',(digest(code), uses, now()+7*86400))
        return code
    def row(self, sql, args=()): return self.db.execute(sql,args).fetchone()
    def rows(self, sql, args=()): return self.db.execute(sql,args).fetchall()
    def blocked(self, a,b): return bool(self.row('SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)',(a,b,b,a)))
    def profile(self, user): return {'id':user['id'],'name':user['name'],'avatar':user['avatar']}
    def session(self, token):
        return self.row('SELECT u.*,s.csrf FROM sessions s JOIN users u ON u.id=s.user WHERE s.hash=? AND s.expires>?',(digest(token),now())) if token else None
    def auth(self, action, data, ip):
        self.limit('auth:'+ip,8,300)
        login=clean(data.get('login'),32).lower(); pw=clean(data.get('password'),128)
        require(re.fullmatch('[a-z0-9_]{3,32}',login) and len(pw)>=10,400,'Логин: 3–32 латинских символа; пароль: от 10 символов')
        require(self.auth_limit.acquire(blocking=False),429,'Попробуй немного позже')
        try:
            if action == 'register':
                inv=self.row('SELECT * FROM invites WHERE hash=? AND uses>0 AND expires>?',(digest(str(data.get('invite',''))),now()))
                require(inv is not None,403,'Нужен действующий код приглашения')
                require(self.row('SELECT COUNT(*) n FROM users')['n']<100,503,'Пилот заполнен')
                require(not self.row('SELECT 1 FROM users WHERE login=?',(login,)),409,'Логин занят')
                salt=secrets.token_hex(16); name=clean(data.get('name'),48)
                self.db.execute('INSERT INTO users(id,login,name,salt,passhash) VALUES(?,?,?,?,?)',(uid(),login,name,salt,password(pw,salt)))
                self.db.execute('UPDATE invites SET uses=uses-1 WHERE hash=?',(inv['hash'],))
            user=self.row('SELECT * FROM users WHERE login=?',(login,))
            computed=password(pw,user['salt'] if user else '00'*16)
            require(user is not None and hmac.compare_digest(computed,user['passhash']),401,'Неверный логин или пароль')
        finally: self.auth_limit.release()
        self.db.execute('DELETE FROM sessions WHERE user=? AND hash NOT IN (SELECT hash FROM sessions WHERE user=? ORDER BY expires DESC LIMIT 9)',(user['id'],user['id']))
        token=secrets.token_urlsafe(32); csrf=secrets.token_urlsafe(24)
        self.db.execute('DELETE FROM sessions WHERE expires<?',(now(),))
        self.db.execute('INSERT INTO sessions VALUES(?,?,?,?)',(digest(token),user['id'],csrf,now()+30*86400))
        return {'user':self.profile(user),'csrf':csrf}, token
    def visible(self, intent, user):
        return intent and (intent['owner']==user or (intent['audience']=='ocean' and not intent['closed'] and intent['expires']>now() and not self.blocked(user,intent['owner'])))
    def intent(self, iid): return self.row('SELECT i.*,u.name,u.avatar FROM intents i JOIN users u ON u.id=i.owner WHERE i.id=?',(iid,))
    def pack(self, intent):
        obj=dict(intent); obj.pop('nonce',None)
        obj['attachments']=[dict(x) for x in self.rows('SELECT id,name,mime FROM attachments WHERE intent=?',(intent['id'],))]
        return obj
    def thread(self, tid, user):
        thread=self.row('SELECT * FROM threads WHERE id=? AND (a=? OR b=?)',(tid,user,user))
        require(thread is not None and not self.blocked(thread['a'],thread['b']),404,'Беседа недоступна')
        return thread
    def api(self, method, path, query, data, user, token):
        u=user['id']; self.limit('user:'+u,90)
        if method=='POST' and path=='/api/logout':
            self.db.execute('DELETE FROM sessions WHERE hash=?',(digest(token),)); return {'ok':True}
        if path=='/api/profile' and method=='POST':
            avatar=data.get('avatar','plankton'); require(avatar in {'plankton','jelly','star'})
            self.db.execute('UPDATE users SET name=?,avatar=? WHERE id=?',(clean(data.get('name'),48),avatar,u)); return {'ok':True}
        if path=='/api/intents' and method=='GET':
            return {'items':[self.pack(x) for x in self.rows('SELECT i.*,u.name,u.avatar FROM intents i JOIN users u ON u.id=i.owner WHERE i.owner=? ORDER BY i.created DESC,i.rowid DESC LIMIT 200',(u,))][::-1]}
        if path=='/api/intents' and method=='POST':
            text=clean(data.get('text')); nonce=clean(data.get('nonce'),64)
            existing=self.row('SELECT id FROM intents WHERE owner=? AND nonce=?',(u,nonce))
            if existing: return self.pack(self.intent(existing['id']))
            require(self.row('SELECT COUNT(*) n FROM intents WHERE owner=?',(u,))['n']<200,409,'Лимит пилота: 200 намерений на участника')
            require(self.row('SELECT COUNT(*) n FROM intents WHERE owner=? AND closed=0 AND expires>?',(u,now()))['n']<20,409,'Заверши одно из 20 активных намерений')
            audience=data.get('audience');kind=data.get('kind'); hours=data.get('hours',24)
            require(audience in {'private','ocean'} and kind in KINDS and type(hours) is int and 1<=hours<=168)
            files=data.get('files',[]); require(isinstance(files,list) and len(files)<=1,400,'В пилоте одно вложение на намерение')
            normalized=[normalize_file(f) for f in files]
            new_bytes=sum(len(f[2]) for f in normalized)
            require(self.row('SELECT COALESCE(SUM(length(data)),0) n FROM attachments WHERE owner=?',(u,))['n']+new_bytes<=10_000_000,413,'Лимит вложений участника: 10 МБ')
            require(self.row('SELECT COALESCE(SUM(length(data)),0) n FROM attachments')['n']+new_bytes<=512_000_000,507,'Хранилище пилота заполнено')
            iid=uid();self.db.execute('INSERT INTO intents(id,owner,text,kind,audience,created,expires,nonce) VALUES(?,?,?,?,?,?,?,?)',(iid,u,text,kind,audience,now(),now()+hours*3600,nonce))
            for name,mime,blob in normalized: self.db.execute('INSERT INTO attachments VALUES(?,?,?,?,?,?)',(uid(),u,iid,name,mime,blob))
            return self.pack(self.intent(iid))
        match=re.fullmatch(r'/api/intents/([a-f0-9]{32})/(close|matches)',path)
        if match:
            intent=self.intent(match[1]);require(intent is not None and intent['owner']==u,404,'Намерение недоступно')
            if match[2]=='close' and method=='POST':
                self.db.execute('UPDATE intents SET closed=1 WHERE id=?',(intent['id'],)); return {'ok':True}
            require(match[2]=='matches' and method=='GET',405)
            require(not intent['closed'] and intent['expires']>now(),409,'Намерение уже завершено')
            needle=tokens(intent['text']); matches=[]
            # Bounded pilot (100 users × at most 20 active). Filter access before ranking.
            for x in self.rows("SELECT i.*,u.name,u.avatar FROM intents i JOIN users u ON u.id=i.owner WHERE i.owner!=? AND audience='ocean' AND closed=0 AND expires>?",(u,now())):
                if self.blocked(u,x['owner']): continue
                shared=needle & tokens(x['text'])
                if not shared: continue
                complement={intent['kind'],x['kind']}=={'seek','offer'}
                obj=self.pack(x); obj['score']=len(shared)+(2 if complement else 0)
                obj['reason']=('Встречные намерения; ' if complement else 'Похожая тема; ')+ 'совпали слова: '+', '.join(sorted(shared))
                matches.append(obj)
            matches.sort(key=lambda x:(-x['score'],-x['created']))
            return {'mode':'lexical','items':matches[:12]}
        if path=='/api/threads' and method=='GET':
            items=[]
            for t in self.rows('SELECT t.*,i.text,u.name FROM threads t JOIN intents i ON i.id=t.intent JOIN users u ON u.id=CASE WHEN t.a=? THEN t.b ELSE t.a END WHERE t.a=? OR t.b=? ORDER BY t.created DESC LIMIT 100',(u,u,u)):
                if not self.blocked(t['a'],t['b']): items.append(dict(t))
            return {'items':items}
        if path=='/api/threads' and method=='POST':
            self.limit('thread:'+u,10)
            intent=self.intent(data.get('intent'));require(self.visible(intent,u) and intent['owner']!=u,404,'Намерение недоступно')
            old=self.row('SELECT * FROM threads WHERE intent=? AND b=?',(intent['id'],u))
            if old: return dict(old)
            require(self.row('SELECT COUNT(*) n FROM threads')['n']<200,409,'Лимит бесед пилота достигнут')
            tid=uid();self.db.execute('INSERT OR IGNORE INTO threads VALUES(?,?,?,?,?)',(tid,intent['id'],intent['owner'],u,now()))
            return dict(self.row('SELECT * FROM threads WHERE intent=? AND b=?',(intent['id'],u)))
        match=re.fullmatch(r'/api/threads/([a-f0-9]{32})/messages',path)
        if match:
            t=self.thread(match[1],u)
            if method=='GET':
                return {'thread':dict(t),'items':[dict(x) for x in self.rows('SELECT m.id,m.sender,m.text,m.created,u.name FROM messages m JOIN users u ON u.id=m.sender WHERE m.thread=? ORDER BY m.created,m.rowid LIMIT 500',(t['id'],))]}
            require(method=='POST',405)
            require(self.row('SELECT COUNT(*) n FROM messages WHERE thread=?',(t['id'],))['n']<500,409,'Лимит беседы пилота: 500 сообщений')
            text=clean(data.get('text'));nonce=clean(data.get('nonce'),64)
            old=self.row('SELECT * FROM messages WHERE sender=? AND nonce=?',(u,nonce))
            if old:
                require(old['thread']==t['id'],409,'Повторный идентификатор');return {'id':old['id']}
            mid=uid();self.db.execute('INSERT INTO messages VALUES(?,?,?,?,?,?)',(mid,t['id'],u,text,now(),nonce)); return {'id':mid}
        if path=='/api/block' and method=='POST':
            target=data.get('target');require(target!=u and self.row('SELECT 1 FROM users WHERE id=?',(target,)),400)
            self.db.execute('INSERT OR IGNORE INTO blocks VALUES(?,?)',(u,target));return {'ok':True}
        if path=='/api/report' and method=='POST':
            self.limit('report:'+u,5,3600);intent=self.intent(data.get('intent'));require(self.visible(intent,u),404)
            require(self.row('SELECT COUNT(*) n FROM reports')['n']<10000,503,'Приём жалоб временно недоступен')
            self.db.execute('INSERT INTO reports VALUES(?,?,?,?,?)',(uid(),u,intent['id'],clean(data.get('reason'),500),now()));return {'ok':True}
        raise Failure(404,'Не найдено')

def handler(ocean):
    class Handler(BaseHTTPRequestHandler):
        server_version='OSMINOG';sys_version=''
        def log_message(self,*_): pass  # no URLs, messages, auth credentials or request bodies in logs
        def setup(self): super().setup();self.connection.settimeout(15)
        def reply(self,status,value,ctype='application/json; charset=utf-8',extra=None):
            payload=json.dumps(value,ensure_ascii=False).encode() if not isinstance(value,bytes) else value
            self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(payload)))
            self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer')
            self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
            self.send_header('Permissions-Policy','camera=(self), microphone=(), geolocation=()')
            for k,v in (extra or {}).items():self.send_header(k,v)
            self.end_headers()
            if self.command!='HEAD': self.wfile.write(payload)
        def cookie(self,token): return 'ocean_session='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+('2592000' if token else '0')+('' if ocean.local else '; Secure')
        def execute(self):
            try:
                parsed=urllib.parse.urlsplit(self.path);path=parsed.path
                require(len(self.path)<=2048,414)
                host=self.headers.get('Host','').split(':')[0]
                require(host in ({'127.0.0.1','localhost'} if ocean.local else {'osminog.red'}),421,'Неверный домен')
                if self.command=='GET' and path=='/healthz':return self.reply(200,{'ok':True,'version':VERSION,'matching':'lexical','pilot':True})
                if not path.startswith('/api/'):
                    require(self.command in {'GET','HEAD'},405)
                    relative=urllib.parse.unquote(path).lstrip('/') or 'index.html'
                    file=(ocean.web_root/relative).resolve();require(file.is_relative_to(ocean.web_root) and file.is_file() and file.suffix in {'.html','.js','.css','.svg','.json','.webmanifest','.png'},404,'Не найдено')
                    return self.reply(200,file.read_bytes(),mimetypes.guess_type(file)[0] or 'application/octet-stream')
                data={}
                if self.command=='POST':
                    require(self.headers.get('Origin')==ocean.origin,403,'Недопустимый источник запроса')
                    require(self.headers.get('Content-Type','').split(';')[0]=='application/json' and not self.headers.get('Transfer-Encoding') and not self.headers.get('Content-Encoding'),415)
                    length=int(self.headers.get('Content-Length','0'));require(0<length<=MAX_BODY,413,'Запрос слишком большой')
                    raw=self.rfile.read(length);require(len(raw)==length,400)
                    data=json.loads(raw);require(isinstance(data,dict))
                jar=cookies.SimpleCookie();jar.load(self.headers.get('Cookie',''));token=jar['ocean_session'].value if 'ocean_session' in jar else ''
                with ocean.lock, ocean.db:
                    if path in {'/api/login','/api/register'} and self.command=='POST':
                        # Only trust the sanitized X-Real-IP emitted by the localhost proxy.
                        ip=self.headers.get('X-Real-IP',self.client_address[0]) if self.client_address[0]=='127.0.0.1' else self.client_address[0]
                        result,token=ocean.auth(path.rsplit('/',1)[1],data,ip)
                        ocean.db.commit()
                        return self.reply(200,result,extra={'Set-Cookie':self.cookie(token)})
                    user=ocean.session(token)
                    if path=='/api/session' and self.command=='GET':
                        return self.reply(200,{'user':ocean.profile(user) if user else None,'csrf':user['csrf'] if user else None,'version':VERSION})
                    require(user is not None,401,'Войди в свой океан')
                    if self.command=='POST': require(hmac.compare_digest(self.headers.get('X-CSRF-Token',''),user['csrf']),403,'Обнови страницу и повтори')
                    match=re.fullmatch(r'/api/files/([a-f0-9]{32})',path)
                    if match and self.command=='GET':
                        f=ocean.row('SELECT * FROM attachments WHERE id=?',(match[1],))
                        require(f and ocean.visible(ocean.intent(f['intent']),user['id']),404,'Вложение недоступно')
                        disposition='inline' if f['mime'].startswith('image/') else 'attachment'
                        return self.reply(200,f['data'],f['mime'],{'Content-Disposition':disposition+"; filename*=UTF-8''"+urllib.parse.quote(f['name'],safe='')})
                    result=ocean.api(self.command,path,urllib.parse.parse_qs(parsed.query),data,user,token)
                    ocean.db.commit()
                    return self.reply(200,result,extra={'Set-Cookie':self.cookie('')} if path=='/api/logout' else None)
            except Failure as e:self.reply(e.code,{'error':e.message})
            except (ValueError,TypeError,json.JSONDecodeError):self.reply(400,{'error':'Некорректный запрос'})
            except (BrokenPipeError,ConnectionResetError,TimeoutError): pass
            except Exception:self.reply(500,{'error':'Ошибка сервера; данные не считаются отправленными'})
        do_GET=execute;do_POST=execute;do_HEAD=execute
    return Handler

class Server(ThreadingHTTPServer):
    daemon_threads=True;request_queue_size=16
    def __init__(self,*args,**kwargs):self.slots=threading.BoundedSemaphore(16);super().__init__(*args,**kwargs)
    def process_request(self,request,client_address):
        if not self.slots.acquire(False):self.shutdown_request(request);return
        try:super().process_request(request,client_address)
        except Exception:self.slots.release();raise
    def process_request_thread(self,*args):
        try:super().process_request_thread(*args)
        finally:self.slots.release()

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('--invite',action='store_true');p.add_argument('--uses',type=int,default=10);args=p.parse_args()
    root=Path(__file__).resolve().parents[2];db=os.environ.get('OSMINOG_DB','/data/ocean.sqlite3')
    local=os.environ.get('OSMINOG_LOCAL_TEST')=='1';port=int(os.environ.get('PORT','8080'))
    ocean=Ocean(db,root/'mobile-web',os.environ.get('OSMINOG_ORIGIN','https://osminog.red'),local)
    if args.invite:
        require(1<=args.uses<=100);print(ocean.invite(args.uses))
    else:Server(('0.0.0.0' if os.environ.get('OSMINOG_CONTAINER')=='1' else '127.0.0.1',port),handler(ocean)).serve_forever()
