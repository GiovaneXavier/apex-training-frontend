import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { apiErrorMessage } from '@/lib/api';
import { getAlunoDetalheNutri, type NutriAlunoDetalhe } from '@/lib/api/nutri';
import { formatDate, relativeDay } from '@/lib/format';
import { MODALIDADE_LABEL, type Treino } from '@/types/treino';

export default function NutriAlunoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<NutriAlunoDetalhe | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAlunoDetalheNutri(id)
      .then((d) => !cancelled && setData(d))
      .catch((err) => !cancelled && setError(apiErrorMessage(err)));
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-3 flex items-center justify-between">
        <Link to="/nutri/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Alunos
        </Link>
        <span className="text-mono text-[10px] uppercase tracking-wider text-ink-subtle font-bold">leitura</span>
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
