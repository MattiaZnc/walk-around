import type { TotaliGiorno } from '@/features/itinerary/api/totali.api';
import { dataMedia, giornoSettimana } from '@/lib/format';

/**
 * Esportazione CSV pensata per Excel italiano, che è il programma con cui
 * questi file vengono aperti quasi sempre:
 *  - separatore punto e virgola (con la virgola, Excel in locale italiano
 *    mette tutta la riga in una cella);
 *  - decimali con la virgola;
 *  - BOM UTF-8 in testa, altrimenti le lettere accentate diventano simboli;
 *  - fine riga CRLF, come previsto dall'RFC 4180.
 */

const SEPARATORE = ';';
const FINE_RIGA = '\r\n';
const BOM = '﻿';

export const INTESTAZIONI = [
  'Data',
  'Giorno',
  'Mezzo',
  'Tappe',
  'Km',
  'Minuti',
  'Tratte',
  'Tratte manuali',
  'Tratte stimate',
  'Complete',
] as const;

/** Numero con la virgola decimale e senza separatore di migliaia. */
function numeroCsv(valore: number, decimali = 2): string {
  return valore.toFixed(decimali).replace('.', ',');
}

/**
 * Racchiude il campo tra apici quando contiene separatori, apici o ritorni a
 * capo, come prevede l'RFC 4180. Gli apici interni vengono raddoppiati.
 */
function campo(valore: string): string {
  if (/[";\r\n]/.test(valore)) {
    return `"${valore.replace(/"/g, '""')}"`;
  }
  return valore;
}

function tratteAttese(giorno: TotaliGiorno): number {
  return Math.max(0, giorno.tappe - 1) + (giorno.rientro && giorno.tappe > 1 ? 1 : 0);
}

export function rigaCsv(giorno: TotaliGiorno): string {
  const valori = [
    giorno.data,
    giornoSettimana(giorno.data),
    giorno.modalita === 'piedi' ? 'a piedi' : 'in auto',
    String(giorno.tappe),
    numeroCsv(giorno.km),
    String(giorno.minuti),
    String(giorno.tratte),
    String(giorno.tratteManuali),
    String(giorno.tratteStimate),
    giorno.tratte >= tratteAttese(giorno) ? 'sì' : 'no',
  ];

  return valori.map(campo).join(SEPARATORE);
}

/** Contenuto completo del file, righe di totale incluse. */
export function componiCsv(giorni: readonly TotaliGiorno[]): string {
  const righe: string[] = [INTESTAZIONI.join(SEPARATORE)];

  // Dal più vecchio al più recente: in un rendiconto si legge in ordine.
  const ordinati = [...giorni].sort((a, b) => a.data.localeCompare(b.data));
  for (const giorno of ordinati) {
    righe.push(rigaCsv(giorno));
  }

  const kmTotali = ordinati.reduce((somma, giorno) => somma + giorno.km, 0);
  const minutiTotali = ordinati.reduce((somma, giorno) => somma + giorno.minuti, 0);
  const tappeTotali = ordinati.reduce((somma, giorno) => somma + giorno.tappe, 0);

  righe.push('');
  righe.push(
    [
      campo('TOTALE'),
      '',
      '',
      String(tappeTotali),
      numeroCsv(Math.round(kmTotali * 100) / 100),
      String(minutiTotali),
      '',
      '',
      '',
      '',
    ].join(SEPARATORE),
  );

  return BOM + righe.join(FINE_RIGA) + FINE_RIGA;
}

/** Es. "walk-around_2026-01-01_2026-01-31.csv" */
export function nomeFileCsv(da: string, a: string): string {
  return `walk-around_${da}_${a}.csv`;
}

/** Riga di descrizione mostrata accanto al pulsante di esportazione. */
export function descrizioneEsportazione(da: string, a: string, giorni: number): string {
  const quante = giorni === 1 ? '1 giornata' : `${giorni} giornate`;
  return `${quante} dal ${dataMedia(da)} al ${dataMedia(a)}`;
}

/**
 * Avvia il salvataggio del file nel browser.
 * L'oggetto URL viene liberato subito dopo: senza revoke il contenuto resta in
 * memoria fino alla chiusura della pagina.
 */
export function scaricaCsv(contenuto: string, nomeFile: string): void {
  const blob = new Blob([contenuto], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const collegamento = document.createElement('a');
  collegamento.href = url;
  collegamento.download = nomeFile;
  document.body.append(collegamento);
  collegamento.click();
  collegamento.remove();

  URL.revokeObjectURL(url);
}
