// Adapter de upload — fluxo S3 Presigned URL.
//
// Por que presigned URL e não passar pelo backend?
// - O Node.js fica fora do caminho do byte → não sobrecarrega o servidor
//   nem o event loop com tráfego de imagens.
// - Escala horizontalmente: o S3 absorve o pico de upload de fotos de
//   evolução (cenário típico: vários alunos no início do mês).
//
// Fluxo:
//   1. GET /api/upload/presigned-url → { uploadUrl, publicUrl, requiredHeaders }
//   2. PUT direto no S3 com o File como body
//   3. Retorna a publicUrl para persistir em EvolucaoCorporal.fotoUrl

import axios from 'axios';
import { api } from './api';

export type UploadResult = { url: string; key: string };
export type UploadKind = 'evolucao' | 'avatar' | 'plano-alimentar';

// PR #18b — regras por kind espelham o backend (controllers/upload).
// Tabela única evita drift entre o que o cliente valida cedo (UX) e o
// que o backend valida tarde (segurança).
const KIND_RULES: Record<UploadKind, { mimes: Set<string>; maxBytes: number; label: string }> = {
  evolucao: {
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    maxBytes: 8 * 1024 * 1024,
    label: 'imagem JPEG, PNG, WebP ou HEIC',
  },
  avatar: {
    mimes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic']),
    maxBytes: 8 * 1024 * 1024,
    label: 'imagem JPEG, PNG, WebP ou HEIC',
  },
  'plano-alimentar': {
    mimes: new Set(['application/pdf']),
    maxBytes: 15 * 1024 * 1024,
    label: 'PDF',
  },
};

type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
  key: string;
  requiredHeaders: Record<string, string>;
  expiresIn: number;
};

function validateFile(file: File, kind: UploadKind): void {
  const rule = KIND_RULES[kind];
  if (file.size > rule.maxBytes) {
    const mb = Math.round(rule.maxBytes / (1024 * 1024));
    throw new Error(`Arquivo maior que ${mb}MB. Reduza antes de enviar.`);
  }
  if (!rule.mimes.has(file.type)) {
    throw new Error(`Selecione um ${rule.label}.`);
  }
}

/** Upload via S3 Presigned URL — produção. */
export async function uploadFotoS3(
  file: File,
  opts: { kind?: UploadKind; onProgress?: (pct: number) => void } = {},
): Promise<UploadResult> {
  const kind = opts.kind ?? 'evolucao';
  validateFile(file, kind);

  // 1) Pega a URL pré-assinada do nosso backend (autenticação via interceptor).
  const { data } = await api.get<PresignResponse>('/upload/presigned-url', {
    params: {
      contentType: file.type,
      contentLength: file.size,
      kind,
    },
  });

  // 2) PUT direto no S3. Importante: usar `axios` raw (sem nossa instância
  // `api`) — o interceptor adiciona Authorization, e qualquer header extra
  // não previsto na assinatura é rejeitado pelo S3 com SignatureDoesNotMatch.
  await axios.put(data.uploadUrl, file, {
    headers: data.requiredHeaders,
    // Passamos o File diretamente — axios não deve serializar
    transformRequest: [(body) => body],
    onUploadProgress: opts.onProgress
      ? (e) => {
          if (e.total) opts.onProgress!(Math.round((e.loaded / e.total) * 100));
        }
      : undefined,
  });

  // 3) URL final pública (CloudFront ou bucket) — é o que vai pra
  // EvolucaoCorporal.fotoUrl no banco. PR #18b: retorna também a key
  // pra plano alimentar gravar referência usada em delete/replace.
  return { url: data.publicUrl, key: data.key };
}

/** Mantido apenas pra testes locais sem AWS configurado. */
export async function uploadFotoMock(file: File, kind: UploadKind = 'evolucao'): Promise<UploadResult> {
  validateFile(file, kind);
  await new Promise((r) => setTimeout(r, 600));
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  return { url, key: `mock/${file.name}` };
}

// Fachada pública. Em dev sem AWS, defina VITE_UPLOAD_MODE=mock no .env.local.
export const uploadFoto: (
  file: File,
  opts?: { kind?: UploadKind; onProgress?: (pct: number) => void },
) => Promise<UploadResult> =
  import.meta.env.VITE_UPLOAD_MODE === 'mock'
    ? (file, opts) => uploadFotoMock(file, opts?.kind)
    : uploadFotoS3;
