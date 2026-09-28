# App installabile (PWA)

L'app si installa dal browser e si apre come un'applicazione a sé, senza barra
degli indirizzi: comodo quando la si usa in giro.

- **Android/Chrome**: menu ⋮ → _Installa app_ (o _Aggiungi a schermata Home_)
- **iOS/Safari**: Condividi → _Aggiungi alla schermata Home_
- **Desktop**: icona di installazione nella barra degli indirizzi

## Cosa funziona senza rete

Le schermate già visitate si aprono, perché l'app (codice, stili, icone) è
salvata in locale, insieme alle mattonelle di mappa già viste — fino a 300, per
due settimane.

**I dati no**: tappe, chilometri e totali stanno su Supabase e richiedono la
rete. Senza connessione compare un avviso in cima allo schermo e le modifiche
non vengono salvate. Non c'è una coda di scrittura offline: sarebbe utile, ma
richiede una gestione dei conflitti che al momento non c'è, e un salvataggio che
sembra riuscito e invece va perso è peggio di un avviso.

Le chiamate a Supabase non finiscono mai in cache: le risposte dipendono
dall'utente autenticato e mostrare dati di un accesso precedente sarebbe un
problema di riservatezza, oltre che di correttezza.

## Aggiornamenti

`registerType: 'autoUpdate'`: quando esce una versione nuova il service worker
la scarica e la attiva da solo, senza chiedere niente. La si vede al
ricaricamento successivo.

## Icone

Generate da `scripts/genera-icone.py` (`npm run icone`), non convertite da un
SVG: sulla macchina di sviluppo non c'è un convertitore, e le icone servono in
PNG perché iOS non accetta SVG nel manifest.

| File                     | Uso                                     |
| ------------------------ | --------------------------------------- |
| `icona-192.png`          | elenco app, notifiche                   |
| `icona-512.png`          | schermata di avvio, negozi              |
| `icona-maskable-512.png` | Android, che ritaglia l'icona a cerchio |
| `apple-touch-icon.png`   | schermata Home di iOS                   |
| `favicon.svg`            | scheda del browser                      |

La variante _maskable_ ha il disegno più interno: Android ritaglia e altrimenti
i bordi si perderebbero.

## Verifica dopo un rilascio

In Chrome, _DevTools → Application_:

1. **Manifest**: nome, icone e `display: standalone` presenti, nessun errore.
2. **Service Workers**: uno attivo, stato _activated_.
3. **Cache Storage**: una voce `workbox-precache-*` e, dopo aver aperto una
   mappa, `mattonelle-mappa`.
4. Da terminale: `curl -I https://<dominio>/manifest.webmanifest` deve
   rispondere `application/manifest+json`.
