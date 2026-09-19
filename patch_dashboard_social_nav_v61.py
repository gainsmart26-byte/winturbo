from pathlib import Path
p=Path("dashboard.html")
s=p.read_text()
nav='<button data-s="socialManagement">Social Media Management</button>'
if nav not in s:
    needle='<button data-s="contentIdeas">✦ Content Ideas</button>'
    if needle in s:s=s.replace(needle,needle+'\\n'+nav,1)
css='<style>/* WINTURBO_SOCIAL_NAV_PERMANENT_V61 */#app .nav button[data-s="socialManagement"]{display:block!important;visibility:visible!important;opacity:1!important}</style>'
if 'WINTURBO_SOCIAL_NAV_PERMANENT_V61' not in s:s=s.replace('</head>',css+'\\n</head>',1)
p.write_text(s)
