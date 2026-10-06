# Wraps the page files into full HTML documents for normal web hosting -> site/
import os, shutil
src=os.path.dirname(os.path.abspath(__file__)); out=os.path.join(src,"site")
shutil.rmtree(out,ignore_errors=True); os.makedirs(out)
head='<!doctype html><html lang="sw"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style></head><body>'
for f in ["index.html","dashboard.html","centre.html"]:
    open(os.path.join(out,f),"w").write(head+open(os.path.join(src,f)).read()+"</body></html>")
for f in ["styles.css","config.js","api.js","demo-data.js","sw.js","manifest.json","manifest-centre.json","icon-192.png","icon-512.png","icon-centre-192.png","icon-centre-512.png","supabase-schema.sql"]:
    shutil.copy(os.path.join(src,f),out)
print("built",sorted(os.listdir(out)))
