#!/usr/bin/env python3
"""Genera le icone della PWA in public/.

    python3 scripts/genera-icone.py

Disegnate con PIL invece di convertire un SVG: sulla macchina di sviluppo non
c'è un convertitore, e le icone servono in PNG (il manifest accetta anche SVG,
ma iOS no e Android preferisce PNG per le maschere).

Il disegno viene fatto quattro volte più grande e poi ridotto con LANCZOS:
senza questo passaggio PIL non applica antialiasing e i bordi risultano
scalettati.
"""
from PIL import Image, ImageDraw

VERDE = (27, 122, 84, 255)  # --primary del tema chiaro
CHIARO = (240, 253, 244, 255)
FATTORE = 4


def disegna(dimensione: int, maskable: bool) -> Image.Image:
    grande = dimensione * FATTORE
    img = Image.new('RGBA', (grande, grande), VERDE)
    d = ImageDraw.Draw(img)

    # Le icone maskable vengono ritagliate a cerchio da Android: il disegno
    # deve stare più interno, altrimenti i bordi si perdono.
    margine = grande * (0.3 if maskable else 0.22)
    largh = grande - 2 * margine
    spessore = max(2, int(grande * 0.055))
    raggio = max(3, int(grande * 0.085))

    # Percorso a zig-zag con un punto all'inizio e uno alla fine.
    punti = [
        (margine + largh * 0.12, margine + largh * 0.88),
        (margine + largh * 0.40, margine + largh * 0.48),
        (margine + largh * 0.60, margine + largh * 0.64),
        (margine + largh * 0.88, margine + largh * 0.12),
    ]
    d.line(punti, fill=CHIARO, width=spessore, joint='curve')

    for centro in (punti[0], punti[-1]):
        d.ellipse(
            [centro[0] - raggio, centro[1] - raggio, centro[0] + raggio, centro[1] + raggio],
            fill=CHIARO,
            outline=VERDE,
            width=max(1, spessore // 2),
        )

    return img.resize((dimensione, dimensione), Image.LANCZOS)


ICONE = [
    (192, 'public/icona-192.png', False),
    (512, 'public/icona-512.png', False),
    (512, 'public/icona-maskable-512.png', True),
    (180, 'public/apple-touch-icon.png', False),
]

if __name__ == '__main__':
    for dimensione, nome, maskable in ICONE:
        disegna(dimensione, maskable).save(nome, optimize=True)
        print(f'✓ {nome} ({dimensione}px{", maskable" if maskable else ""})')
