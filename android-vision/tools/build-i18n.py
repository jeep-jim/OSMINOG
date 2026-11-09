#!/usr/bin/env python3
"""Compile auditable, offline catalogs. No user content or cloud translation."""
from pathlib import Path
import json,re,subprocess
root=Path(__file__).resolve().parents[1]; langs=['en','zh','ja','ko','ar','es','pt','de','fr']; table={}
for path in sorted((root/'i18n').glob('*.tsv')):
 for n,line in enumerate(path.read_text().splitlines(),1):
  row=line.split('|');assert len(row)==10,(path,n,len(row));assert row[0] not in table,row[0];assert all(row),row
  table[row[0]]=dict(zip(langs,row[1:]))
alias={
 'Выбранный планктон; нажать — выбрать фото':'Выбрать фото профиля',
 'Выбрать планктон':'Выбрать ИИ-персонажа',
 'Запись, её ответы и вложения удалятся с этого устройства.':'Мысль, ответы и вложения удалятся с этого устройства.',
 'Личная запись сохранена. Внутренний ИИ OSMINOG ещё не подключён к серверу.':'Сообщение сохранено на устройстве. Внутренний ИИ ещё не подключён.',
 'Нет доступа к микрофону. Разреши его для OSMINOG в настройках Android.':'Микрофон не разрешён. Его можно включить в настройках приложения Android.'}
for k,v in alias.items():table[k]=table[v]
for key,base,format in [('(Глубина)','Глубина','({})'),('Кадр камеры.jpg','Кадр камеры','{}.jpg'),('Изображение.png','Фото','{}.png')]:table[key]={l:format.format(table[base][l]) for l in langs}
table['%.1f КБ']={l:'%.1f KB' for l in langs};table['Русский']={l:'Русский' for l in langs}
app=(root/'app/src/main/assets/app.js').read_text();welcome=re.search(r'const welcomeCopy=(\{.*?\n\});',app,re.S).group(1)
w=json.loads(subprocess.check_output(['node','-e','console.log(JSON.stringify('+welcome+'))']))
for i,key in enumerate(w['ru']['lines']):table[key]={l:w[l]['lines'][i] for l in langs}
for field in ['hint','label']:table[w['ru'][field]]={l:w[l][field] for l in langs}
# Inventory is committed and must be complete in every supported language.
required=json.loads((root/'i18n/required.json').read_text());assert not(set(required)-set(table)),sorted(set(required)-set(table))
source=(root/'i18n/runtime.js').read_text().replace('/*CATALOG*/',json.dumps(table,ensure_ascii=False,separators=(',',':')))
(root/'app/src/main/assets/i18n.js').write_text(source)
print('I18N_COVERAGE_PASS',len(required),'keys,',len(langs)+1,'languages')
