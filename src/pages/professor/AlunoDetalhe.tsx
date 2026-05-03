import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiErrorMessage } from '@/lib/api';
import { getAlunoDetalhe, type AlunoDetalhe } from '@/lib/api/professor';
import { formatDate, relativeDay } from '@/lib/format';
import { MODALIDADE_LABEL, type Treino } from '@/types/treino';

export default function ProfAlunoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<AlunoDetalhe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAlunoDetalhe(id)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-3 flex items-center justify-between">
        <Link to="/professor/alunos" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Alunos
        </Link>
        {data && (
          <Link
            to={`/professor/prescrever?alunoId=${data.aluno.id}`}
            className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full bg-accent text-accent-ink"
          >
            + Prescrever
          </Link>
        )}
      </header>

      {error && (
        <div className="mx-5 px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">
          {error}
        </div>
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
            </div>
          </div>

          {data.proximaProva && (
            <div className="mb-5 p-4 rounded-[14px] bg-ink text-bg">
              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-mono opacity-70 mb-1">
                Próxima prova · {relativeDay(data.proximaProva.data)}
              </div>
              <div className="text-[15px] font-bold">{data.proximaProva.nome}</div>
              <div className="text-[11.5px] opacity-75 mt-0.5">
                {MODALIDADE_LABEL[data.proximaProva.modalidade]} · {formatDate(data.proximaProva.data)}
              </div>
            </div>
          )}

          <Section title={`Pendentes (${data.treinosPendentes.length})`}>
            {data.treinosPendentes.length === 0 ? (
              <Empty msg="Nenhum treino pendente" />
            ) : (
              <List items={data.treinosPendentes} variant="pending" />
            )}
          </Section>

          <Section title={`Últimos concluídos (${data.treinosConcluidos.length})`}>
            {data.treinosConcluidos.length === 0 ? (
              <Empty msg="Sem registros recentes" />
            ) : (
              <List items={data.treinosConcluidos} variant="done" />
            )}
          </Section>

          <Section title={`RPs recentes (${data.recordesRecentes.length})`}>
            {data.recordesRecentes.length === 0 ? (
              <Empty msg="Sem RPs registrados" />
            ) : (
              <div className="flex flex-col gap-2">
                {data.recordesRecentes.map((r) => (
                  <div key={r.id} className="px-3 py-2.5 rounded-[12px] bg-surface border border-app flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold">{r.exercicio}</div>
                      <div className="text-mono text-[10px] uppercase text-ink-subtle font-bold tracking-wider">
                        {relativeDay(r.dataRecorde)}
                      </div>
                    </div>
                    <div className="text-mono text-[14px] font-bold tabular text-accent">
                      {r.valor}{r.unidade}{r.reps ? ` × ${r.reps}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-3 text-mono">
        {title}
      </h2>
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

function List({ items, variant }: { items: Treino[]; variant: 'pending' | 'done' }) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="flex items-center justify-between px-3 py-3 rounded-[12px] bg-surface border border-app"
        >
          <div className="min-w-0">
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-0.5">
              {variant === 'pending'
                ? `${relativeDay(t.dataAlvo)} · ${MODALIDADE_LABEL[t.modalidade]}`
                : `${formatDate(t.finalizadoEm ?? t.dataAlvo)} · ${MODALIDADE_LABEL[t.modalidade]}`}
            </div>
            <div className="text-[13.5px] font-semibold truncate">{t.titulo}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
