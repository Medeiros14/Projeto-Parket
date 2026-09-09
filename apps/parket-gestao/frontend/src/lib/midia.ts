// Miniatura das fotos do fiscal servida pelo proprio Supabase Storage.
//
// A foto do laudo vive no bucket publico fiscal-midias em ~1280px / ~190KB, que
// e o tamanho certo pra abrir a foto, e grande demais pra uma grade de
// miniaturas de 150px. A rota /render/image/ devolve o MESMO arquivo
// redimensionado e ainda negocia o formato sozinha: manda WebP pra quem aceita
// e JPEG pro resto. Na pratica a mesma foto sai de 187KB pra 39KB sem guardar
// segunda copia no bucket.
//
// So reescreve link do nosso Storage. Foto antiga em data URI e midia vinda do
// WhatsApp passam intactas, senao a URL sairia quebrada.
export function midiaThumb(url: string | null | undefined, width = 400, quality = 70): string {
  if (!url) return "";
  const alvo = "/storage/v1/object/public/";
  if (!url.includes(alvo)) return url;
  return url.replace(alvo, "/storage/v1/render/image/public/")
    + (url.includes("?") ? "&" : "?") + `width=${width}&quality=${quality}`;
}
