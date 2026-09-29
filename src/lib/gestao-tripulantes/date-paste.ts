/** Datas de cadastro: aceita colar DD/MM/AAAA e guarda ISO YYYY-MM-DD. */

function dois(n: number): string {
  return String(n).padStart(2, '0');
}

function dataValida(ano: number, mes: number, dia: number): string | null {
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2100) return null;
  const dt = new Date(Date.UTC(ano, mes - 1, dia));
  if (dt.getUTCFullYear() !== ano || dt.getUTCMonth() !== mes - 1 || dt.getUTCDate() !== dia) return null;
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

/** Texto colado ou digitado → ISO, ou null se não for uma data civil. */
export function parseDataColavel(raw: string): string | null {
  const texto = String(raw || '').trim();
  if (!texto) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(texto);
  if (iso) return dataValida(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const br = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})$/.exec(texto);
  if (br) {
    const ano = Number(br[3]) < 100 ? 2000 + Number(br[3]) : Number(br[3]);
    return dataValida(ano, Number(br[2]), Number(br[1]));
  }

  const digitos = texto.replace(/\D/g, '');
  if (digitos.length === 8) {
    return dataValida(Number(digitos.slice(4)), Number(digitos.slice(2, 4)), Number(digitos.slice(0, 2)));
  }
  return null;
}

/** ISO YYYY-MM-DD → DD/MM/AAAA. Outro texto volta vazio. */
export function formatDataBr(iso: string | null | undefined): string {
  const s = String(iso || '');
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** Máscara enquanto digita: só dígitos, até DD/MM/AAAA. */
export function mascaraDataBr(raw: string): string {
  const d = String(raw || '').replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}
