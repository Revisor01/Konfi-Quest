#!/usr/bin/env python3
"""Passt das App-Store-Profil zu den Berechtigungen der App? (02.10.2026)

Aufruf: profil-pruefen.py <profil.mobileprovision> <AppRelease.entitlements>

WARUM: Jede Berechtigung, die die App in AppRelease.entitlements traegt, muss
auch das Provisioning-Profil erlauben -- sonst bricht xcodebuild erst nach
Pods und Kompilieren beim Signieren ab ("Provisioning profile ... doesn't
include the com.apple.developer.associated-domains entitlement"). Das Profil
erlaubt eine neue Berechtigung erst, wenn sie im Apple-Developer-Konto fuer
die App-ID eingeschaltet UND das Profil danach neu erzeugt ist. Genau das
steht bei Universal Links an (applinks:/webcredentials:, Simon 02.10.2026:
"noch in 2.3.0"). Diese Pruefung sagt es vor dem Bau, mit dem Weg zur
Abhilfe.

WIE: Ein .mobileprovision ist eine CMS-Signatur um eine XML-Plist; die Plist
steht darin unverschluesselt. Gelesen wird ihr Abschnitt "Entitlements".
Verglichen werden die Schluessel, nicht die Werte: Das Profil traegt fuer
associated-domains den Platzhalter "*", die App die konkreten Domains.

Kein Netz, kein Schluessel -- laeuft genauso im Test
(frontend/src/__tests__/betrieb/profilPruefen.test.ts).
"""
import plistlib
import sys

APP_ID = 'de.godsapp.konfiquest'

# Was im Apple-Developer-Konto einzuschalten ist, je Berechtigung. Fehlt ein
# Eintrag, nennt die Meldung den Schluessel selbst.
FAEHIGKEIT = {
    'com.apple.developer.associated-domains': 'Associated Domains',
    'aps-environment': 'Push Notifications',
}


def profil_berechtigungen(roh: bytes) -> dict:
    anfang = roh.find(b'<?xml')
    ende = roh.find(b'</plist>')
    if anfang < 0 or ende < 0:
        raise ValueError('keine Plist im Profil gefunden')
    plist = plistlib.loads(roh[anfang:ende + len(b'</plist>')])
    return plist.get('Entitlements', {})


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__.splitlines()[2], file=sys.stderr)
        return 2
    profil_pfad, app_pfad = sys.argv[1], sys.argv[2]
    name = profil_pfad.rsplit('/', 1)[-1].removesuffix('.mobileprovision')

    try:
        im_profil = profil_berechtigungen(open(profil_pfad, 'rb').read())
    except (OSError, ValueError, plistlib.InvalidFileException) as fehler:
        print(f'FEHLER: Profil "{name}" nicht lesbar: {fehler}', file=sys.stderr)
        return 1
    with open(app_pfad, 'rb') as datei:
        in_der_app = plistlib.load(datei)

    fehlend = sorted(k for k in in_der_app if k not in im_profil)
    if not fehlend:
        print(f'Profil "{name}" erlaubt alle {len(in_der_app)} Berechtigungen der App.')
        return 0

    print(f'FEHLER: Profil "{name}" erlaubt nicht, was die App verlangt:', file=sys.stderr)
    for k in fehlend:
        print(f'  - {k} ({FAEHIGKEIT.get(k, k)})', file=sys.stderr)
    print(
        '\nAbhilfe im Apple-Developer-Konto (developer.apple.com/account/resources):\n'
        f'  1. Identifiers -> {APP_ID} -> '
        + ', '.join(FAEHIGKEIT.get(k, k) for k in fehlend)
        + ' ankreuzen -> Save.\n'
        f'  2. Profiles -> "{name}" -> Edit -> Save (das Profil wird neu erzeugt;\n'
        '     den Namen NICHT aendern, der Workflow sucht genau ihn).\n'
        'Danach den Workflow neu starten. Herunterladen ist nicht noetig, der\n'
        'Workflow holt das Profil selbst ueber die App-Store-Connect-API.',
        file=sys.stderr,
    )
    return 1


if __name__ == '__main__':
    sys.exit(main())
