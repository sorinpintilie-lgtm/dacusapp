"""Builds the App Store / Google Play screenshots and the Play feature graphic from app captures.

Inputs:  release/store-assets/screens-src/*.png  (390x844 @3x captures of the app)
Outputs: release/store-assets/ios-6.9/*.png      1320x2868 (iPhone 6.9")
         release/store-assets/android-phone/*.png 1080x1920
         release/store-assets/play-feature-graphic.png 1024x500
Usage (repo root): python release/make-store-assets.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'release/store-assets/screens-src'
OUT = ROOT / 'release/store-assets'
FONTS = ROOT / 'node_modules/@expo-google-fonts/barlow'
LOGO = ROOT / 'apps/mobile/assets/dacus-logo.png'

RED = (210, 10, 17)
INK = (20, 20, 20)
PAPER = (244, 243, 241)
WHITE = (255, 255, 255)

# (capture, headline, subline, background)
SLIDES = [
    ('home', 'Tot pentru casă,\nîntr-o aplicație', 'Peste 17.000 de produse Dacus', PAPER),
    ('search', 'Găsești orice,\ndin prima', 'Caută după nume, brand sau cod', INK),
    ('departments', 'Totul, pe\ndepartamente', 'De la construcții la grădină', PAPER),
    ('product-added', 'Un gest\nși e în coș', 'Prețuri și stoc actualizate', RED),
    ('cart', 'Coș simplu,\nplată sigură', 'Plata pe pagina securizată a magazinului', PAPER),
    ('loyalty', 'Puncte la\nfiecare comandă', '100 de puncte = 5 RON', INK),
]


def font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / weight / f'Barlow_{weight}.ttf'), size)


def rounded(image: Image.Image, radius: int) -> Image.Image:
    mask = Image.new('L', image.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, image.width - 1, image.height - 1), radius, fill=255)
    out = image.convert('RGBA')
    out.putalpha(mask)
    return out


def slide(capture: str, headline: str, subline: str, background, size: tuple[int, int]) -> Image.Image:
    width, height = size
    scale = width / 1320
    canvas = Image.new('RGB', size, background)
    draw = ImageDraw.Draw(canvas)
    dark = background != PAPER
    title_color = WHITE if dark else INK
    sub_color = (220, 220, 222) if dark else (90, 90, 95)

    # Headline block
    title_font = font('800ExtraBold', round(118 * scale))
    sub_font = font('500Medium', round(52 * scale))
    y = round(190 * scale)
    for line in headline.split('\n'):
        w = draw.textlength(line, font=title_font)
        draw.text(((width - w) / 2, y), line, font=title_font, fill=title_color)
        y += round(128 * scale)
    y += round(24 * scale)
    w = draw.textlength(subline, font=sub_font)
    draw.text(((width - w) / 2, y), subline, font=sub_font, fill=sub_color)

    # The app screen, framed and running off the bottom edge
    shot = Image.open(SRC / f'{capture}.png').convert('RGB')
    shot_w = round(width * 0.78)
    shot_h = round(shot.height * shot_w / shot.width)
    shot = rounded(shot.resize((shot_w, shot_h), Image.LANCZOS), round(70 * scale))
    top = y + round(110 * scale)
    left = (width - shot_w) // 2

    shadow = Image.new('RGBA', size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle(
        (left, top + round(30 * scale), left + shot_w, top + shot_h), round(70 * scale), fill=(0, 0, 0, 110 if dark else 60)
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(round(40 * scale)))
    canvas = Image.alpha_composite(canvas.convert('RGBA'), shadow)
    border = round(10 * scale)
    frame = Image.new('RGBA', (shot_w + border * 2, shot_h + border * 2), (0, 0, 0, 0))
    ImageDraw.Draw(frame).rounded_rectangle(
        (0, 0, frame.width - 1, frame.height - 1), round(80 * scale), fill=(28, 28, 30, 255) if not dark else (60, 60, 64, 255)
    )
    canvas.alpha_composite(frame, (left - border, top - border))
    canvas.alpha_composite(shot, (left, top))
    return canvas.convert('RGB')


def feature_graphic() -> Image.Image:
    width, height = 1024, 500
    canvas = Image.new('RGB', (width, height), WHITE)
    draw = ImageDraw.Draw(canvas)
    # Red band on the right with a phone screen peeking in
    draw.rectangle((620, 0, width, height), fill=RED)
    logo = Image.open(LOGO).convert('RGBA')
    logo = logo.crop(logo.getchannel('A').getbbox())
    logo_w = 470
    logo = logo.resize((logo_w, round(logo.height * logo_w / logo.width)), Image.LANCZOS)
    canvas.paste(logo, (60, 110), logo)
    draw.text((64, 300), 'Tot pentru casă,', font=font('800ExtraBold', 50), fill=INK)
    draw.text((64, 356), 'într-o aplicație.', font=font('800ExtraBold', 50), fill=INK)
    shot = Image.open(SRC / 'home.png').convert('RGB')
    shot_w = 300
    shot = rounded(shot.resize((shot_w, round(shot.height * shot_w / shot.width)), Image.LANCZOS), 36)
    canvas.paste(shot, (680, 60), shot)
    return canvas


def main() -> None:
    for folder, size in (('ios-6.9', (1320, 2868)), ('android-phone', (1080, 1920))):
        target = OUT / folder
        target.mkdir(parents=True, exist_ok=True)
        for index, (capture, headline, subline, background) in enumerate(SLIDES, start=1):
            slide(capture, headline, subline, background, size).save(target / f'{index:02d}-{capture}.png', optimize=True)
    feature_graphic().save(OUT / 'play-feature-graphic.png', optimize=True)
    print('wrote', OUT)


if __name__ == '__main__':
    main()
