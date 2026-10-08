from PIL import Image, ImageDraw, ImageFont
import random
F='NotoSansSC.ttf'
def font(s,w=400):
    f=ImageFont.truetype(F,s)
    try: f.set_variation_by_axes([w])
    except: pass
    return f
INK=(34,30,40); PAPER=(247,242,234); BLUE=(58,120,208); PINK=(194,96,158)
SH=[
('首页','/',[('f-home-1280','首页 · 搜索 / 分类 / 精选 / 工具'),('f-list-1280','资源列表 · MCP 分类')]),
('资源搜索','/resources',[('f-list-filtered-1280','关键词 + 标签联合筛选'),('f-list-empty-1280','搜索无结果')]),
('资源详情','/resources/[slug]',[('f-detail-1280','详情 · 含 GitHub 与关联工具'),('f-detail-plain-1280','详情 · 无 GitHub、无关联工具')]),
('404 与工具中心','/resources/[slug] · /tools',[('f-notfound-1280','404 · 不存在或已下架'),('f-tools-1280','工具中心')]),
('MCP 配置生成器','/tools/mcp-config',[('t-mcp-1280','Cursor · stdio'),('t-mcp-claude-1280','Claude Desktop · env 掩码与提醒')]),
('MCP 校验 · 格式转换','/tools/mcp-config · /tools/data-converter',[('t-mcp-error-1280','MCP · 必填与命名校验'),('t-convert-1280','格式转换 · JSON → YAML 成功')]),
('格式转换器','/tools/data-converter',[('t-convert-error-1280','解析失败 · 行列定位'),('t-convert-warn-1280','YAML → TOML · 有损提示')]),
('Token 成本估算器','/tools/token-cost',[('t-token-1280','结果与计算公式'),('t-token-error-1280','输入校验')]),
('管理员登录','/admin/login',[('a-login-1280','登录'),('a-login-error-1280','邮箱或密码错误')]),
('后台 · 权限与资源','/admin · /admin/resources',[('a-denied-1280','未登录访问 /admin 被拦截'),('a-resources-1280','资源管理列表')]),
('后台 · 编辑与分类','/admin/resources/new · /admin/taxonomy',[('a-resource-edit-1280','新增资源 · slug 校验'),('a-taxonomy-1280','分类与标签')]),
('后台 · 精选管理','/admin/featured',[('a-featured-1280','精选排序 · 首页预览')]),
('手机 · 首页与列表','375px',[('f-home-375','首页'),('f-list-375','资源列表')]),
('手机 · 详情与工具中心','375px',[('f-detail-375','资源详情'),('f-tools-375','工具中心')]),
('手机 · 工具','375px',[('t-mcp-375','MCP 配置生成器'),('t-convert-375','格式转换器')]),
('手机 · 估算与后台','375px',[('t-token-375','Token 成本估算器'),('a-resources-375','后台 · 资源管理')]),
('手机 · 后台编辑','375px',[('a-resource-edit-375','后台 · 新增资源')]),
]
M=90; GAP=90
for i,(title,route,items) in enumerate(SH,1):
    random.seed(i)
    ims=[]
    for k,lab in items:
        im=Image.open(f'shots3/{k}.png').convert('RGB')
        if im.width>1000: im=im.resize((1600,int(im.height*1600/im.width)),Image.LANCZOS)
        ims.append((im,lab))
    cw=sum(im.width for im,_ in ims)+GAP*(len(ims)-1)
    W=max(M*2+cw,1500); top=300
    H=top+90+max(im.height for im,_ in ims)+80
    img=Image.new('RGB',(W,H),(232,170,205))
    noise=Image.effect_noise((W,H),40).convert('L')
    img=Image.blend(img,Image.composite(Image.new('RGB',(W,H),(214,140,186)),img,noise.point(lambda v:255 if v>150 else 0)),0.35)
    d=ImageDraw.Draw(img)
    def scrib(x,y,w,c): d.line([(x+j,y+random.uniform(-2.5,2.5)) for j in range(0,int(w),12)],fill=c,width=6,joint='curve')
    logo=Image.open('cat-logo.png').resize((140,140))
    mask=Image.new('L',(140,140),0); ImageDraw.Draw(mask).ellipse((0,0,139,139),fill=255)
    d.ellipse((M+6,66,M+152,212),fill=INK); img.paste(logo,(M,60),mask); d.ellipse((M,60,M+140,200),outline=INK,width=5)
    t=f'{i:02d}  {title}'; tf=font(64,800); d.text((M+180,58),t,font=tf,fill=INK)
    scrib(M+182,148,d.textlength(t,font=tf),BLUE)
    d.text((M+180,168),f'蜡笔猫导航 v1 MVP · {route}',font=font(30,500),fill=(70,50,70))
    x=M
    for n,(im,lab) in enumerate(ims):
        y=top
        cx=x+24; cy=y+30
        d.ellipse((cx-24,cy-24,cx+24,cy+24),fill=PINK if n else BLUE,outline=INK,width=3)
        d.text((cx,cy),'AB'[n],font=font(24,800),fill='white',anchor='mm')
        d.text((cx+40,cy),lab,font=font(36,700),fill=INK,anchor='lm')
        y+=80
        d.rectangle((x+10,y+10,x+im.width+10,y+im.height+10),fill=INK)
        img.paste(im,(x,y))
        for k in range(2):
            j=lambda: random.uniform(-1.5,1.5)
            d.line([(x+j(),y+j()),(x+im.width+j(),y+j()),(x+im.width+j(),y+im.height+j()),(x+j(),y+im.height+j()),(x+j(),y+j())],fill=INK,width=4-k)
        x+=im.width+GAP
    img.save(f'ui-mvp-{i:02d}.png',optimize=True)
    print(i,img.size)
