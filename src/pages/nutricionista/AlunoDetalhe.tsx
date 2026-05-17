import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiErrorMessage, isCancelError } from '@/lib/api';
import { getAlunoDetalheNutri, type NutriAlunoDetalhe } from '@/lib/api/nutri';
import { listEvolucoes, PROTOCOLO_LABEL, type Evolucao } from '@/lib/api/evolucoes';
import { formatDate, relativeDay } from '@/lib/format';
import { MODALIDADE_LABEL, type Treino } from '@/types/treino';

export default function NutriAlunoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<NutriAlunoDetalhe | null>(null);
  const [evolucoes, setEvolucoes] = useState<Evolucao[]>([]);
  const [loadingEvolucoes, setLoadingEvolucoes] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PR #18a — fetch paralelo de detalhe + histórico de avaliações ISAK.
  // AbortController no cleanup (padrão PR #15). Cancel é silencioso.
  useEffect(() => {
    if (!id) return;
    const ctrl = new AbortController();
    Promise.allSettled([
      getAlunoDetalheNutri(id, { signal: ctrl.signal }).then(
        (d) => setData(d),
        (err) => { if (!isCancelError(err)) setError(apiErrorMessage(err)); },
      ),
      listEvolucoes({ alunoId: id, limit: 20 }, { signal: ctrl.signal })
        .then(
          (list) => setEvolucoes(list),
          (err) => { if (!isCancelError(err)) setError(apiErrorMessage(err)); },
        )
        .finally(() => { if (!ctrl.signal.aborted) setLoadingEvolucoes(false); }),
    ]);
    return () => ctrl.abort();
  }, [id]);

  // Gate de escrita — front espelha a regra do backend (audit 4.x +
  // PR #4.1): só permite registrar avaliação se o aluno aceitou o
  // compartilhamento. Backend ainda retorna 403 sozinho — esse gate é
  // defesa em profundidade UX, não substituto.
  const podeRegistrar = data?.aceitoPeloAluno === true;

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-3 flex items-center justify-between">
        <Link to="/nutri/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Alunos
        </Link>
        {data && (
          <NovaAvaliacaoButton alunoId={data.aluno.id} enabled={podeRegistrar} />
        )}
      </header>

      {error && (
        <div className="mx-5 px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
      )}

      {!data && !error && <div className="px-5 text-ink-subtle text-sm">Carregando...</div>}

      {data && (
        <div className="px-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="size-14 rounded-full bg-accent text-accent-ink flex items-center justify-center font-bold text-[20px]">
              {data.aluno.nome.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight leading-tight truncate">{data.aluno.nome}</h1>
              <div className="text-[12px] text-ink-muted truncate">{data.aluno.email}</div>
              {(data.aluno.pesoKg || data.aluno.alturaCm) && (
                <div className="text-mono text-[11px] text-ink-subtle font-bold uppercase tracking-wider mt-1">
                  {data.aluno.pesoKg ? `${data.aluno.pesoKg}kg` : ''}
                  {data.aluno.pesoKg && data.aluno.alturaCm ? ' · ' : ''}
                  {data.aluno.alturaCm ? `${data.aluno.alturaCm}cm` : ''}
                </div>
              )}
            </div>
          </div>

          {!podeRegistrar && (
            <div className="mb-5 px-3 py-2.5 rounded-[10px] bg-warn-bg text-warn text-[12px] font-medium">
              Aluno ainda não aceitou compartilhar os dados. Registro de
              avaliações está bloqueado até o aceite.
            </div>
          )}

          <Section
            title={
              loadingEvolucoes
                ? 'Avaliações físicas'
                : `Avaliações físicas (${evolucoes.length})`
            }
          >
            {loadingEvolucoes ? (
              <div className="text-ink-subtle text-[12px] py-2">Carregando histórico…</div>
            ) : evolucoes.length === 0 ? (
              <Empty msg="Sem avaliações registradas. Registre a primeira ISAK." />
            ) : (
              <div className="flex flex-col gap-2">
                {evolucoes.map((ev) => <EvolucaoRow key={ev.id} ev={ev} />)}
              </div>
            )}
          </Section>

          {data.proximasProvas.length > 0 && (
            <Section title="Próximas provas">
              <div className="flex flex-col gap-2">
                {data.proximasProvas.map((p) => (
                  <div key={p.id} className="p-3 rounded-[14px] bg-ink text-bg">
                    <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-mono opacity-70 mb-1">
                      {relativeDay(p.data)} · {MODALIDADE_LABEL[p.modalidade]}
                    </div>
                    <div className="text-[14px] font-bold">{p.nome}</div>
                    <div className="text-[11px] opacity-75">{formatDate(p.data)}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          <Section title={`Próximos treinos (${data.proximosTreinos.length})`}>
            {data.proximosTreinos.length === 0 ? (
              <Empty msg="Sem treinos prescritos nos próximos 30 dias" />
            ) : (
              <div className="flex flex-col gap-2">
                {data.proximosTreinos.map((t) => <TreinoRow key={t.id} treino={t} />)}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

// PR #18a — botão de nova avaliação. Espelha o gate do backend:
// `aceitoPeloAluno` é a única chave que destrava escrita do nutri.
function NovaAvaliacaoButton({ alunoId, enabled }: { alunoId: string; enabled: boolean }) {
  if (!enabled) {
    return (
      <button
        type="button"
        disabled
        title="Aluno precisa aceitar compartilhamento antes de registrar avaliação"
        className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-surface border border-app-strong text-ink-subtle opacity-50 cursor-not-allowed"
      >
        + Avaliação
      </button>
    );
  }
  return (
    <Link
      to={`/aluno/evolucao/nova?alunoId=${alunoId}`}
      className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-accent text-accent-ink"
    >
      + Avaliação
    </Link>
  );
}

function EvolucaoRow({ ev }: { ev: Evolucao }) {
  return (
    <Link
      to={`/aluno/evolucao?id=${ev.id}`}
      className="flex items-center justify-between px-3 py-3 rounded-[12px] bg-surface border border-app"
    >
      <div className="min-w-0">
        <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
          {relativeDay(ev.dataAvaliacao)} · {ev.protocolo ? PROTOCOLO_LABEL[ev.protocolo] : 'sem protocolo'}
        </div>
        <div className="text-[12.5px] flex gap-3 flex-wrap text-ink-muted">
          {ev.pesoKg != null && <span>{ev.pesoKg.toFixed(1)} kg</span>}
          {ev.imc != null && <span>IMC {ev.imc.toFixed(1)}</span>}
          {ev.percentualGordura != null && (
            <span className="text-accent font-bold">%BF {ev.percentualGordura.toFixed(1)}</span>
          )}
        </div>
      </div>
      <span className="text-mono text-[9px] uppercase tracking-[0.6px] font-bold text-ink-subtle">
        {ev.avaliadorTipo === 'NUTRICIONISTA' ? 'NUTRI' : ev.avaliadorTipo === 'ALUNO' ? 'AUTO' : 'PROF'}
      </span>
    </Link>
  );
}

function TreinoRow({ treino }: { treino: Treino }) {
  return (
    <div className="px-3 py-3 rounded-[12px] bg-surface border border-app">
      <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
        {relativeDay(treino.dataAlvo)} · {MODALIDADE_LABEL[treino.modalidade]}
      </div>
      <div className="text-[13.5px] font-semibold truncate">{treino.titulo}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-3 text-mono">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="px-3 py-4 rounded-[12px] bg-surface border border-app text-ink-subtle text-[13px] text-center">
      {msg}
    </div>
  );
}
