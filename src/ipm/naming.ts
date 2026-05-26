export function buildNfseFilename(
  numero: string,
  ext: string,
  dataEmissao?: string,
  tomadorNome?: string,
): string {
  if (dataEmissao && tomadorNome) {
    // dataEmissao: dd/mm/yyyy -> yyyy-mm
    const parts = dataEmissao.split('/');
    const yearMonth = parts.length === 3 ? `${parts[2]}-${parts[1]}` : dataEmissao;
    const tomador = tomadorNome.replace(/[\\/:*?"<>|]/g, '').trim();
    return `${yearMonth} - ${tomador} - Nota Fiscal de Serviço - NFS-e${numero}.${ext}`;
  }
  return `NFS-e${numero}.${ext}`;
}
