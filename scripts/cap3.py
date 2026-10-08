from playwright.sync_api import sync_playwright
S='file:///workspace/built/sites/'
U={'f':S+'f4136983-aedf-4ee9-9590-7ab65df09cc1/index.html','t':S+'7c290fac-5ff3-43b6-b6cd-bd9d25983db3/index.html','a':S+'fd879b0c-982c-425c-804d-c7a599f7b4b4/index.html'}
J=[('f',s,1280) for s in 'home list list-filtered list-empty detail detail-plain notfound tools'.split()]+[('f',s,375) for s in 'home list detail tools'.split()]
J+=[('t',s,1280) for s in 'mcp mcp-claude mcp-error convert convert-error convert-warn token token-error'.split()]+[('t',s,375) for s in 'mcp convert token'.split()]
J+=[('a',s,1280) for s in 'login login-error denied resources resource-edit taxonomy featured'.split()]+[('a',s,375) for s in 'resources resource-edit'.split()]
with sync_playwright() as p:
    b=p.firefox.launch()
    for k,s,w in J:
        ctx=b.new_context(viewport={'width':w,'height':820 if w>400 else 812},device_scale_factor=1.5 if w>400 else 2,locale='zh-CN')
        pg=ctx.new_page(); pg.goto(U[k]); pg.wait_for_timeout(500)
        pg.evaluate(f"()=>showState('{s}')"); pg.wait_for_timeout(500)
        pg.screenshot(path=f"shots3/{k}-{s}-{w}.png",full_page=True); ctx.close()
    print('ok')
