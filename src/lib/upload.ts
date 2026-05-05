// Adapter de upload — mockado.
// Para ligar S3/CloudFront/Cloudinary depois, preserve a assinatura
// `(file: File) => Promise<{ url: string }>` e troque a implementação.
//
// Hoje retorna um data URL local pra não exigir backend de storage,
// permitindo testar a UI ponta a ponta sem infraestrutura.

export type UploadResult = { url: string };

async function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/** Mock — devolve um data URL imediatamente. Substituir por chamada presigned-PUT do S3. */
export async function uploadFotoMock(file: File): Promise<UploadResult> {
  // Simula latência de rede pra validar o estado de loading da UI
  await new Promise((r) => setTimeout(r, 600));
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Foto maior que 8MB. Tente reduzir antes de enviar.');
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Selecione uma imagem.');
  }
  const url = await fileToDataURL(file);
  return { url };
}

/** Stub pronto pra S3. Não chamado em produção até preencher.
 *
 * Fluxo recomendado:
 *   1. POST /api/uploads/presign  →  { url, fields }
 *   2. PUT na URL com o File
 *   3. Devolve a URL final pública (CloudFront ou bucket)
 */
export async function uploadFotoS3(_file: File): Promise<UploadResult> {
  throw new Error('uploadFotoS3 não implementado. Configure presign no backend.');
}

// Fachada que o resto da app usa. Troque AQUI quando S3 estiver pronto.
export const uploadFoto = uploadFotoMock;
