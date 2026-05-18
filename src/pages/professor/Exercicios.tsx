import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { apiErrorMessage } from '@/lib/api';
import {
  DOMINIO_LABEL,
  GRUPO_MUSCULAR_LABEL,
  TIPO_MOVIMENTO_LABEL,
  createExercicio,
  deleteExercicio,
  listExercicios,
  updateExercicio,
  type DominioExercicio,
  type Exercicio,
  type ExercicioInput,
  type GrupoMuscular,
  type TipoMovimento,
} from '@/lib/api/exercicios';
import { cn } from '@/lib/utils';

const GRUPOS = Object.keys(GRUPO_MUSCULAR_LABEL) as GrupoMuscular[];
const DOMINIOS = Object.keys(DOMINIO_LABEL) as DominioExercicio[];
const TIPOS_MOV = Object.keys(TIPO_MOVIMENTO_LABEL) as TipoMovimento[];

export default function ProfExercicios() {
  const [items, setItems] = useState<Exercicio[]>([]);
  const [q, setQ] = useState('');
  // PR #22 — filtro raiz por domínio (default mostra TODOS pra
  // manter o comportamento histórico de descoberta de catálogo).
  const [dominio, setDominio] = useState<DominioExercicio | ''>('');
  const [grupo, setGrupo] = useState<GrupoMuscular | ''>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<Exercicio | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const data = await listExercicios({
        q: q.trim() || undefined,
        grupo: grupo || undefined,
        dominio: dominio || undefined,
      });
      setItems(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  // debounce busca + filtros
  useEffect(() => {
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, grupo, dominio]);

  // PR #22 — agrupamento contextual: musculação por grupo muscular,
  // BJJ por tipo de movimento, outros pelo domínio puro.
  const grouped = useMemo(() => {
    const m = new Map<string, Exercicio[]>();
    for (const ex of items) {
      let chave: string;
      if (ex.dominio === 'MUSCULACAO') chave = ex.grupoMuscular ?? 'OUTRO';
      else if (ex.dominio === 'JIU_JITSU') chave = ex.tipoMovimento ?? 'OUTRO';
      else chave = ex.dominio;
      if (!m.has(chave)) m.set(chave, []);
      m.get(chave)!.push(ex);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  async function onDelete(id: string) {
    if (!confirm('Excluir este exercício?')) return;
    try {
      await deleteExercicio(id);
      reload();
    } catch (err) {
      alert(apiErrorMessage(err));
    }
  }

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/professor/dashboard" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Dashboard
        </Link>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="text-[11px] font-bold uppercase tracking-wider text-accent"
        >
          + Novo
        </button>
      </header>

      <div className="px-5 max-w-2xl mx-auto">
        <h1 className="text-[26px] font-bold tracking-tight mb-1">Catálogo de exercícios</h1>
        <p className="text-ink-muted text-sm mb-5">Biblioteca compartilhada · {items.length} cadastrados</p>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        <div className="grid grid-cols-[1fr_120px] gap-2 mb-2">
          <Field label="Buscar" placeholder="ex: supino..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div>
            <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Domínio</div>
            <select
              value={dominio}
              onChange={(e) => {
                const novo = e.target.value as DominioExercicio | '';
                setDominio(novo);
                // Trocar de domínio reseta o filtro secundário —
                // grupo muscular não faz sentido em BJJ e vice-versa.
                setGrupo('');
              }}
              className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px]"
            >
              <option value="">Todos</option>
              {DOMINIOS.map((d) => <option key={d} value={d}>{DOMINIO_LABEL[d]}</option>)}
            </select>
          </div>
        </div>

        {/* Filtro secundário só aparece em musculação — manter coerência
            com o picker do RotinaForm. BJJ filtra por tipoMovimento na
            visão de pick (não nesta tela ainda). */}
        {(dominio === 'MUSCULACAO' || dominio === '') && (
          <div className="mb-4">
            <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Grupo</div>
            <select
              value={grupo}
              onChange={(e) => setGrupo(e.target.value as GrupoMuscular | '')}
              className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px]"
            >
              <option value="">Todos</option>
              {GRUPOS.map((g) => <option key={g} value={g}>{GRUPO_MUSCULAR_LABEL[g]}</option>)}
            </select>
          </div>
        )}

        {loading ? (
          <div className="text-ink-subtle text-sm">Carregando…</div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([chave, exs]) => (
              <div key={chave}>
                <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2">
                  {labelDoGrupo(chave)} · {exs.length}
                </div>
                <div className="space-y-1.5">
                  {exs.map((ex) => (
                    <ExercicioRow key={ex.id} ex={ex} onEdit={() => setEditing(ex)} onDelete={() => onDelete(ex.id)} />
                  ))}
                </div>
              </div>
            ))}
            {grouped.length === 0 && (
              <div className="text-ink-subtle text-sm">Nenhum exercício encontrado.</div>
            )}
          </div>
        )}
      </div>

      {(creating || editing) && (
        <ExercicioModal
          exercicio={editing}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function ExercicioRow({ ex, onEdit, onDelete }: { ex: Exercicio; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 rounded-[12px] bg-surface border border-app">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold truncate">{ex.nome}</div>
        <div className="text-[11px] text-ink-subtle truncate">
          {ex.equipamento ?? '—'}
          {ex.videoUrl && ' · vídeo'}
        </div>
      </div>
      <div className="flex gap-1.5 ml-2 flex-shrink-0">
        <button type="button" onClick={onEdit} className="text-[10px] uppercase tracking-wider font-bold text-accent">
          editar
        </button>
        <button type="button" onClick={onDelete} className="text-[10px] uppercase tracking-wider font-bold text-danger">
          excluir
        </button>
      </div>
    </div>
  );
}

function ExercicioModal({ exercicio, onClose, onSaved }: {
  exercicio: Exercicio | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!exercicio;
  const [nome, setNome] = useState(exercicio?.nome ?? '');
  // PR #22 — domínio do exercício. Default MUSCULACAO mantém o fluxo
  // legado intacto pra quem só cadastra exercício de musc.
  const [dominio, setDominio] = useState<DominioExercicio>(exercicio?.dominio ?? 'MUSCULACAO');
  const [grupoMuscular, setGrupoMuscular] = useState<GrupoMuscular | ''>(exercicio?.grupoMuscular ?? '');
  const [tipoMovimento, setTipoMovimento] = useState<TipoMovimento | ''>(exercicio?.tipoMovimento ?? '');
  const [posicao, setPosicao] = useState(exercicio?.posicao ?? '');
  const [equipamento, setEquipamento] = useState(exercicio?.equipamento ?? '');
  const [videoUrl, setVideoUrl] = useState(exercicio?.videoUrl ?? '');
  const [instrucoes, setInstrucoes] = useState(exercicio?.instrucoes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { setError('Nome obrigatório'); return; }
    setSaving(true);
    setError(null);
    const input: ExercicioInput = {
      nome: nome.trim(),
      dominio,
      // Strip dos campos contextuais — só enviamos o que faz sentido
      // pro domínio atual (defesa em profundidade ao schema Zod
      // .strict() do backend).
      grupoMuscular: dominio === 'MUSCULACAO' && grupoMuscular ? grupoMuscular : undefined,
      tipoMovimento: dominio === 'JIU_JITSU' && tipoMovimento ? tipoMovimento : undefined,
      posicao: dominio === 'JIU_JITSU' && posicao.trim() ? posicao.trim() : undefined,
      equipamento: equipamento.trim() || undefined,
      videoUrl: videoUrl.trim() || undefined,
      instrucoes: instrucoes.trim() || undefined,
    };
    try {
      if (editing && exercicio) await updateExercicio(exercicio.id, input);
      else await createExercicio(input);
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="w-full md:max-w-md bg-bg rounded-t-[20px] md:rounded-[20px] p-5 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">{editing ? 'Editar exercício' : 'Novo exercício'}</h2>
          <button type="button" onClick={onClose} className="text-ink-muted text-[20px] leading-none">×</button>
        </div>

        {error && (
          <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
        )}

        <form onSubmit={onSubmit}>
          <Field label="Nome" placeholder={dominio === 'JIU_JITSU' ? 'Passagem toreando' : 'Supino Inclinado'} value={nome} onChange={(e) => setNome(e.target.value)} required />

          {/* PR #22 — Domínio. Tabs em cima do form porque muda o
              conjunto de campos visíveis abaixo. Editar não bloqueia
              troca (caso o prof tenha cadastrado errado). */}
          <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Domínio</div>
          <div className="flex gap-1 mb-3.5" role="tablist">
            {DOMINIOS.map((d) => (
              <button
                key={d}
                type="button"
                role="tab"
                aria-selected={dominio === d}
                onClick={() => setDominio(d)}
                className={
                  'flex-1 py-1.5 rounded-[10px] text-[10px] font-bold uppercase tracking-wider ' +
                  (dominio === d
                    ? 'bg-ink text-bg'
                    : 'bg-surface border border-app-strong text-ink-muted')
                }
              >
                {DOMINIO_LABEL[d]}
              </button>
            ))}
          </div>

          {dominio === 'MUSCULACAO' && (
            <>
              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Grupo muscular</div>
              <select
                value={grupoMuscular}
                onChange={(e) => setGrupoMuscular(e.target.value as GrupoMuscular | '')}
                className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3.5"
              >
                <option value="">— sem grupo —</option>
                {GRUPOS.map((g) => <option key={g} value={g}>{GRUPO_MUSCULAR_LABEL[g]}</option>)}
              </select>
            </>
          )}

          {dominio === 'JIU_JITSU' && (
            <>
              <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Tipo de movimento</div>
              <select
                value={tipoMovimento}
                onChange={(e) => setTipoMovimento(e.target.value as TipoMovimento | '')}
                className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3.5"
              >
                <option value="">— sem tipo —</option>
                {TIPOS_MOV.map((t) => <option key={t} value={t}>{TIPO_MOVIMENTO_LABEL[t]}</option>)}
              </select>

              <Field
                label="Posição"
                placeholder="ex: guarda fechada, montada, 100 quilos"
                value={posicao}
                onChange={(e) => setPosicao(e.target.value)}
              />
            </>
          )}

          <Field label="Equipamento" placeholder={dominio === 'JIU_JITSU' ? 'Tatame, kimono...' : 'Barra, Halter, Cabo...'} value={equipamento} onChange={(e) => setEquipamento(e.target.value)} />
          <Field label="Vídeo URL" placeholder="https://youtube.com/..." value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} />

          <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Instruções</div>
          <textarea
            value={instrucoes}
            onChange={(e) => setInstrucoes(e.target.value)}
            placeholder="Dicas curtas de execução..."
            className="w-full min-h-[80px] px-3.5 py-2.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3.5 resize-y"
          />

          <button
            type="submit"
            disabled={saving}
            className={cn(
              'w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50',
            )}
          >
            {saving ? 'Salvando…' : editing ? 'Salvar' : 'Criar exercício'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Resolve o cabeçalho do agrupamento sem hardcode na UI.
// As chaves vêm de 3 dicionários diferentes (GrupoMuscular, TipoMovimento,
// DominioExercicio) — tenta cada um e cai pra string crua se não bater.
function labelDoGrupo(chave: string): string {
  return (
    (GRUPO_MUSCULAR_LABEL as Record<string, string>)[chave] ??
    (TIPO_MOVIMENTO_LABEL as Record<string, string>)[chave] ??
    (DOMINIO_LABEL as Record<string, string>)[chave] ??
    chave
  );
}
