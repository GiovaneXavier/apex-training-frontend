import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { apiErrorMessage } from '@/lib/api';
import {
  GRUPO_MUSCULAR_LABEL,
  createExercicio,
  deleteExercicio,
  listExercicios,
  updateExercicio,
  type Exercicio,
  type ExercicioInput,
  type GrupoMuscular,
} from '@/lib/api/exercicios';
import { cn } from '@/lib/utils';

const GRUPOS = Object.keys(GRUPO_MUSCULAR_LABEL) as GrupoMuscular[];

export default function ProfExercicios() {
  const [items, setItems] = useState<Exercicio[]>([]);
  const [q, setQ] = useState('');
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
      });
      setItems(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  // debounce busca + filtro
  useEffect(() => {
    const t = setTimeout(reload, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line
  }, [q, grupo]);

  const grouped = useMemo(() => {
    const m = new Map<string, Exercicio[]>();
    for (const ex of items) {
      const g = ex.grupoMuscular ?? 'OUTRO';
      if (!m.has(g)) m.set(g, []);
      m.get(g)!.push(ex);
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

        <div className="grid grid-cols-[1fr_140px] gap-2 mb-4">
          <Field label="Buscar" placeholder="ex: supino..." value={q} onChange={(e) => setQ(e.target.value)} />
          <div>
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
        </div>

        {loading ? (
          <div className="text-ink-subtle text-sm">Carregando…</div>
        ) : (
          <div className="space-y-5">
            {grouped.map(([g, exs]) => (
              <div key={g}>
                <div className="text-mono text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle mb-2">
                  {GRUPO_MUSCULAR_LABEL[g as GrupoMuscular] ?? g} · {exs.length}
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
  const [grupoMuscular, setGrupoMuscular] = useState<GrupoMuscular | ''>(exercicio?.grupoMuscular ?? '');
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
      grupoMuscular: grupoMuscular || undefined,
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
          <Field label="Nome" placeholder="Supino Inclinado" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">Grupo muscular</div>
          <select
            value={grupoMuscular}
            onChange={(e) => setGrupoMuscular(e.target.value as GrupoMuscular | '')}
            className="w-full h-11 px-3.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-3.5"
          >
            <option value="">— sem grupo —</option>
            {GRUPOS.map((g) => <option key={g} value={g}>{GRUPO_MUSCULAR_LABEL[g]}</option>)}
          </select>

          <Field label="Equipamento" placeholder="Barra, Halter, Cabo..." value={equipamento} onChange={(e) => setEquipamento(e.target.value)} />
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
