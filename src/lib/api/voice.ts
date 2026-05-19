import { api } from '@/lib/api';

// PR #25 — cliente do endpoint /api/voice/parse-bjj.
//
// Backend valida mime via multer allowlist; client envia o blob com o
// mime exato que MediaRecorder declarou. Em iOS antigo, MediaRecorder
// pode cuspir 'video/mp4' (áudio encapsulado) — passamos adiante e o
// backend trata.

export type VoiceExtractResult = {
  fields: {
    matTimeSegundos?: number;
    roundsCompletos?: number;
    finalizacoesFeitas?: number;
    finalizacoesSofridas?: number;
    readinessRating?: number;
    observacao?: string;
  };
  transcript: string | null;
  confidence: number;
  needsReview: boolean;
  warnings: string[];
  partial: boolean;
};

export async function parseBjjAudio(
  audioBlob: Blob,
  treinoId: string,
): Promise<VoiceExtractResult> {
  const form = new FormData();
  // O backend usa multer.single('audio'); o nome do campo precisa bater.
  // filename é livre — server detecta container via magic bytes.
  const ext = mimeToExt(audioBlob.type);
  form.append('audio', audioBlob, `voice.${ext}`);
  form.append('treinoId', treinoId);

  const { data } = await api.post<VoiceExtractResult>(
    '/voice/parse-bjj',
    form,
    {
      // Axios detecta FormData e seta multipart automaticamente. Não
      // sobrescrevemos Content-Type — boundary precisa vir do browser.
      // Timeout amplo: LLM pt-BR + tool extract ~3-8s tipicamente.
      timeout: 30000,
    },
  );
  return data;
}

function mimeToExt(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('aac')) return 'aac';
  if (mime.includes('mpeg')) return 'mp3';
  return 'bin';
}
