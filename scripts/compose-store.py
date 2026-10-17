"""Turns raw captures from store-shots.mjs into captioned App Store screenshots (1320x2868).

usage: python scripts/compose-store.py <locale>   (needs Pillow and the Noto Sans TC font for zh)
"""
import os
import sys
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1320, 2868
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

CAPTIONS = {
    'zh-TW': [
        ('選對閘門', '兵力瞬間暴增！'),
        ('九大首領', '閃開巨石與火球！'),
        ('萬箭齊發', '擊潰來襲敵軍'),
        ('施放技能', '箭雨從天而降'),
        ('九大地區', '天空之城等你征服'),
        ('寶藏關', '打爆寶箱賺金幣'),
        ('升級軍團', '稱王之路由你開創'),
        ('收服首領', '打贏的首領變成你的英雄'),
    ],
    'en-US': [
        ('PICK THE GATE', 'Grow your army fast!'),
        ('9 GIANT BOSSES', 'Dodge boulders and fireballs'),
        ('RAIN ARROWS', 'Crush the enemy horde'),
        ('UNLEASH SKILLS', 'Call down an arrow storm'),
        ('9 LANDS', 'Up to the sky citadel'),
        ('TREASURE RUNS', 'Crack chests for coins'),
        ('UPGRADE', 'Build the mightiest army'),
        ('RECRUIT BOSSES', 'Beaten bosses become heroes'),
    ],
}

NAMES = ['1-gates', '2-boss', '3-battle', '4-skill', '5-region', '6-treasure', '7-home', '8-collection']


def font(locale, size, bold=True):
    if locale.startswith('zh'):
        f = ImageFont.truetype(os.path.expanduser('~/.local/share/fonts/NotoSansTC.ttf'), size)
        f.set_variation_by_name('Black' if bold else 'Bold')
        return f
    return ImageFont.truetype(os.path.join(ROOT, 'public/fonts/LilitaOne-Regular.ttf'), size)


def compose(locale):
    src = os.path.join(ROOT, 'store', f'raw-{locale}')
    out = os.path.join(ROOT, 'store', locale)
    os.makedirs(out, exist_ok=True)
    for i, name in enumerate(NAMES):
        shot = Image.open(os.path.join(src, f'{name}.png')).convert('RGB')
        canvas = Image.new('RGB', (W, H))
        # background gradient
        top, bottom = (40, 110, 230), (20, 45, 120)
        grad = Image.new('RGB', (1, H))
        for y in range(H):
            t = y / H
            grad.putpixel((0, y), tuple(int(top[k] * (1 - t) + bottom[k] * t) for k in range(3)))
        canvas.paste(grad.resize((W, H)))
        draw = ImageDraw.Draw(canvas)
        # light rays behind the title
        rays = Image.new('L', (W, 700), 0)
        rd = ImageDraw.Draw(rays)
        for k in range(18):
            import math
            a0 = k / 18 * math.pi * 2
            a1 = a0 + math.pi / 18
            cx, cy = W / 2, 330
            rd.polygon([(cx, cy), (cx + math.cos(a0) * 1400, cy + math.sin(a0) * 1400), (cx + math.cos(a1) * 1400, cy + math.sin(a1) * 1400)], fill=28)
        canvas.paste((255, 255, 255), (0, 0), rays)

        title, sub = CAPTIONS[locale][i]
        tf = font(locale, 150)
        sf = font(locale, 76, bold=False)
        draw.text((W / 2, 250), title, font=tf, fill='#ffffff', anchor='mm', stroke_width=12, stroke_fill='#0f2554')
        draw.text((W / 2, 420), sub, font=sf, fill='#ffe27a', anchor='mm', stroke_width=7, stroke_fill='#0f2554')

        # phone-style framed screenshot
        sw = 1000
        sh = int(shot.height * sw / shot.width)
        shot = shot.resize((sw, sh), Image.LANCZOS)
        x = (W - sw) // 2
        y = 560
        radius = 70
        shadow = Image.new('L', (sw + 160, sh + 160), 0)
        ImageDraw.Draw(shadow).rounded_rectangle((80, 100, sw + 80, sh + 100), radius=radius, fill=150)
        shadow = shadow.filter(ImageFilter.GaussianBlur(36))
        canvas.paste((5, 12, 40), (x - 80, y - 80), shadow)
        border = Image.new('L', (sw + 28, sh + 28), 0)
        ImageDraw.Draw(border).rounded_rectangle((0, 0, sw + 27, sh + 27), radius=radius + 14, fill=255)
        canvas.paste((255, 255, 255), (x - 14, y - 14), border)
        mask = Image.new('L', (sw, sh), 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, sw - 1, sh - 1), radius=radius, fill=255)
        canvas.paste(shot, (x, y), mask)
        canvas.save(os.path.join(out, f'{i + 1}.png'))
    print('wrote', out)


if __name__ == '__main__':
    compose(sys.argv[1] if len(sys.argv) > 1 else 'zh-TW')
