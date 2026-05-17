import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { Field } from '@/components/auth/Field';
import { useAuth } from '@/contexts/AuthContext';
import { apiErrorMessage } from '@/lib/api';
import {
  PROTOCOLO_LABEL,
  createEvolucao,
  previewBodyFat,
  type Dobras,
  type EvolucaoInput,
  type Perimetros,
  type Protocolo,
} from '@/lib/api/evolucoes';
import { cn } from '@/lib/utils';

type Modo = 'ALUNO' | 'ISAK';

export default function AlunoEvolucaoNova() {
  const { user } = useAuth();
  // PR #18a — quando vier `?alunoId=…` (nutri/prof linkam pra avaliar
  // um aluno específico), pulamos a tela de seleção e abrimos direto
  // o form ISAK. O alunoId é repassado via prop pro FormISAK.
  const [params] = useSearchParams();
  const alunoIdParam = params.get('alunoId') ?? '';
  const ehProfissional = user?.role === 'NUTRICIONISTA' || user?.role === 'PROFESSOR';
  const modoInicial: Modo | null = alunoIdParam && ehProfissional ? 'ISAK' : null;
  const [modo, setModo] = useState<Modo | null>(modoInicial);

  return (
    <div className="min-h-screen bg-bg text-ink pb-24">
      <header className="px-5 pt-7 pb-4 flex items-center justify-between">
        <Link to="/aluno/evolucao" className="text-mono text-[11px] uppercase tracking-wider text-ink-muted font-bold">
          ← Evolução
        </Link>
      </header>

      <div className="px-5 max-w-2xl mx-auto">
        {!modo ? (
          <Selecao onSelect={setModo} />
        ) : modo === 'ALUNO' ? (
          <FormAluno onCancel={() => setModo(null)} />
        ) : (
          <FormISAK
            onCancel={() => setModo(null)}
            alunoIdInicial={alunoIdParam || undefined}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tela 1: seleção modular
// ─────────────────────────────────────────────────────────────
function Selecao({ onSelect }: { onSelect: (m: Modo) => void }) {
  return (
    <>
      <h1 className="text-[26px] font-bold tracking-tight mb-1">Nova avaliação</h1>
      <p className="text-ink-muted text-sm mb-6">
        Escolha o tipo de medição. A complexidade do formulário se adapta a quem está preenchendo.
      </p>

      <button
        type="button"
        onClick={() => onSelect('ALUNO')}
        className="block w-full text-left p-5 rounded-[18px] bg-surface border border-app hover:border-accent transition-colors mb-3 shadow-card"
      >
        <div className="flex items-start gap-3 mb-2">
          <span className="size-10 rounded-[12px] bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" /><path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
            </svg>
          </span>
          <div className="flex-1">
            <div className="text-[16px] font-bold tracking-tight">Auto-avaliação</div>
            <div className="text-[12px] text-ink-muted">Em casa · rápido · sem equipamento técnico</div>
          </div>
          <span className="text-ink-muted">→</span>
        </div>
        <ul className="text-[12px] text-ink-muted space-y-1 ml-13 pl-13">
          <li>· Peso e altura</li>
          <li>· Cintura, quadril, braço com fita métrica</li>
          <li>· Fotos de progresso (frente, lado, costas)</li>
        </ul>
      </button>

      <button
        type="button"
        onClick={() => onSelect('ISAK')}
        className="block w-full text-left p-5 rounded-[18px] bg-surface border border-app hover:border-accent transition-colors shadow-card"
      >
        <div className="flex items-start gap-3 mb-2">
          <span className="size-10 rounded-[12px] bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 2v6l-4 8a4 4 0 0 0 4 6h6a4 4 0 0 0 4-6l-4-8V2" />
              <path d="M9 2h6" />
            </svg>
          </span>
          <div className="flex-1">
            <div className="text-[16px] font-bold tracking-tight">Avaliação profissional · ISAK</div>
            <div className="text-[12px] text-ink-muted">Consultório · adipômetro + fita + paquímetro</div>
          </div>
          <span className="text-ink-muted">→</span>
        </div>
        <ul className="text-[12px] text-ink-muted space-y-1">
          <li>· 8 dobras cutâneas</li>
          <li>· 5 perímetros + 2 diâmetros ósseos</li>
          <li>· Cálculo automático de %BF: JP3, JP4, JP7 ou Durnin-Womersley</li>
        </ul>
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Form 1: Auto-avaliação (Aluno)
// ─────────────────────────────────────────────────────────────
function FormAluno({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [pesoKg, setPesoKg] = useState('');
  const [alturaCm, setAlturaCm] = useState('');
  const [cinturaCm, setCinturaCm] = useState('');
  const [quadrilCm, setQuadrilCm] = useState('');
  const [bracoCm, setBracoCm] = useState('');
  const [coxaCm, setCoxaCm] = useState('');
  const [fotoFrente, setFotoFrente] = useState('');
  const [fotoLado, setFotoLado] = useState('');
  const [fotoCostas, setFotoCostas] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const input: EvolucaoInput = {
      pesoKg: pesoKg ? Number(pesoKg) : undefined,
      alturaCm: alturaCm ? Number(alturaCm) : undefined,
      protocolo: 'ALUNO_FITA',
      medidas: {
        tipo: 'ALUNO_FITA',
        cinturaCm: cinturaCm ? Number(cinturaCm) : undefined,
        quadrilCm: quadrilCm ? Number(quadrilCm) : undefined,
        bracoCm: bracoCm ? Number(bracoCm) : undefined,
        coxaCm: coxaCm ? Number(coxaCm) : undefined,
      },
      fotos: (fotoFrente || fotoLado || fotoCostas)
        ? { frente: fotoFrente || undefined, lado: fotoLado || undefined, costas: fotoCostas || undefined }
        : undefined,
      observacoes: observacoes || undefined,
    };

    try {
      await createEvolucao(input);
      navigate('/aluno/evolucao', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onCancel} className="text-ink-subtle text-[20px] leading-none">←</button>
        <h1 className="text-[24px] font-bold tracking-tight">Auto-avaliação</h1>
      </div>
      <p className="text-ink-muted text-sm mb-5">Tire as medidas com fita métrica e tire fotos no mesmo horário e iluminação.</p>

      {error && (
        <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
      )}

      <form onSubmit={onSubmit}>
        <SectionTitle>Antropometria</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Peso (kg)" type="number" step="0.1" inputMode="decimal" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
          <Field label="Altura (cm)" type="number" inputMode="numeric" value={alturaCm} onChange={(e) => setAlturaCm(e.target.value)} />
        </div>

        <SectionTitle>Fita métrica</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Cintura (cm)" type="number" step="0.1" inputMode="decimal" value={cinturaCm} onChange={(e) => setCinturaCm(e.target.value)} />
          <Field label="Quadril (cm)" type="number" step="0.1" inputMode="decimal" value={quadrilCm} onChange={(e) => setQuadrilCm(e.target.value)} />
          <Field label="Braço (cm)" type="number" step="0.1" inputMode="decimal" value={bracoCm} onChange={(e) => setBracoCm(e.target.value)} />
          <Field label="Coxa (cm)" type="number" step="0.1" inputMode="decimal" value={coxaCm} onChange={(e) => setCoxaCm(e.target.value)} />
        </div>

        <SectionTitle>Fotos de progresso (URL)</SectionTitle>
        <p className="text-[11px] text-ink-subtle mb-2">
          Por enquanto cole o link da imagem (ex: do Drive ou imgur). Upload direto vem em breve.
        </p>
        <Field label="Frente" placeholder="https://..." value={fotoFrente} onChange={(e) => setFotoFrente(e.target.value)} />
        <Field label="Lado" placeholder="https://..." value={fotoLado} onChange={(e) => setFotoLado(e.target.value)} />
        <Field label="Costas" placeholder="https://..." value={fotoCostas} onChange={(e) => setFotoCostas(e.target.value)} />

        <SectionTitle>Observações</SectionTitle>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Como você se sentiu hoje? Algum detalhe importante?"
          className="w-full min-h-[80px] px-3.5 py-2.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-4 resize-y"
        />

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50 mt-2"
        >
          {saving ? 'Salvando…' : 'Salvar avaliação'}
        </button>
      </form>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Form 2: ISAK Profissional
// ─────────────────────────────────────────────────────────────
function FormISAK({
  onCancel,
  alunoIdInicial,
}: {
  onCancel: () => void;
  alunoIdInicial?: string;
}) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const ehProfissional = user?.role === 'NUTRICIONISTA' || user?.role === 'PROFESSOR';

  // PR #18a — pré-preenche o aluno quando viemos pelo deep-link do
  // detalhe (nutri/prof clicou em "+ Avaliação"). Quando preenchido,
  // o campo abaixo fica readOnly pra evitar mudança acidental — pra
  // mudar de aluno o profissional volta e abre outra ficha.
  const [alunoId, setAlunoId] = useState<string>(alunoIdInicial ?? '');
  const [pesoKg, setPesoKg] = useState('');
  const [alturaCm, setAlturaCm] = useState('');
  const [sexoBio, setSexoBio] = useState<'M' | 'F'>('M');
  const [idadeAnos, setIdadeAnos] = useState('30');
  const [protocolo, setProtocolo] = useState<Protocolo>('JP7');
  const [dobras, setDobras] = useState<Dobras>({});
  const [perimetros, setPerimetros] = useState<Perimetros>({});
  const [observacoes, setObservacoes] = useState('');
  const [preview, setPreview] = useState<{ imc: number | null; pct: number | null }>({ imc: null, pct: null });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Recalcula preview quando muda algo relevante (debounced)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await previewBodyFat({
          protocolo,
          sexoBio,
          idadeAnos: idadeAnos ? Number(idadeAnos) : undefined,
          pesoKg: pesoKg ? Number(pesoKg) : undefined,
          alturaCm: alturaCm ? Number(alturaCm) : undefined,
          medidas: { tipo: 'ISAK_RESTRITO', dobras, perimetros },
        });
        setPreview({ imc: r.imc, pct: r.percentualGordura });
      } catch {
        setPreview({ imc: null, pct: null });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [protocolo, sexoBio, idadeAnos, pesoKg, alturaCm, dobras, perimetros]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (ehProfissional && !alunoId.trim()) {
      setError('Informe o ID do aluno');
      return;
    }

    setSaving(true);
    const input: EvolucaoInput = {
      alunoId: ehProfissional ? alunoId : undefined,
      pesoKg: pesoKg ? Number(pesoKg) : undefined,
      alturaCm: alturaCm ? Number(alturaCm) : undefined,
      protocolo,
      sexoBio,
      idadeAnos: idadeAnos ? Number(idadeAnos) : undefined,
      medidas: { tipo: 'ISAK_RESTRITO', dobras, perimetros },
      observacoes: observacoes || undefined,
    };

    try {
      await createEvolucao(input);
      navigate('/aluno/evolucao', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <button type="button" onClick={onCancel} className="text-ink-subtle text-[20px] leading-none">←</button>
        <h1 className="text-[24px] font-bold tracking-tight">Avaliação ISAK</h1>
      </div>
      <p className="text-ink-muted text-sm mb-4">Perfil restrito · cálculo de %BF em tempo real conforme protocolo.</p>

      {/* Preview pegajoso no topo */}
      <div className="sticky top-0 z-10 -mx-5 px-5 py-3 mb-4 bg-bg/95 backdrop-blur border-b border-app">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">% Gordura</div>
            <div className="text-mono text-[28px] font-bold tabular leading-none text-accent">
              {preview.pct !== null ? `${preview.pct.toFixed(1)}%` : '—'}
            </div>
          </div>
          <div>
            <div className="text-mono text-[10px] uppercase tracking-[0.6px] text-ink-subtle font-bold">IMC</div>
            <div className="text-mono text-[20px] font-bold tabular leading-none">
              {preview.imc !== null ? preview.imc.toFixed(1) : '—'}
            </div>
          </div>
          <div className="ml-auto text-[10px] uppercase tracking-wider text-ink-subtle font-bold">
            {PROTOCOLO_LABEL[protocolo]}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-3 py-2 mb-3 rounded-[10px] bg-danger-bg text-danger text-[12px] font-medium">{error}</div>
      )}

      <form onSubmit={onSubmit}>
        {ehProfissional && (
          <Field
            label="ID do aluno"
            placeholder="cuid do aluno"
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            readOnly={Boolean(alunoIdInicial)}
            required
          />
        )}

        <SectionTitle>Identificação</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-1">
            <SubLabel>Sexo</SubLabel>
            <div className="grid grid-cols-2 gap-1">
              <button type="button" onClick={() => setSexoBio('M')} className={chipCls(sexoBio === 'M')}>M</button>
              <button type="button" onClick={() => setSexoBio('F')} className={chipCls(sexoBio === 'F')}>F</button>
            </div>
          </div>
          <Field label="Idade" type="number" inputMode="numeric" value={idadeAnos} onChange={(e) => setIdadeAnos(e.target.value)} />
          <Field label="Peso (kg)" type="number" step="0.1" inputMode="decimal" value={pesoKg} onChange={(e) => setPesoKg(e.target.value)} />
        </div>
        <Field label="Altura (cm)" type="number" inputMode="numeric" value={alturaCm} onChange={(e) => setAlturaCm(e.target.value)} />

        <SectionTitle>Protocolo de cálculo</SectionTitle>
        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {(['JP3', 'JP4', 'JP7', 'DURNIN_WOMERSLEY'] as Protocolo[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setProtocolo(p)}
              className={chipCls(protocolo === p)}
            >
              <span className="text-[10px] uppercase tracking-wider font-bold">{PROTOCOLO_LABEL[p]}</span>
            </button>
          ))}
        </div>

        <SectionTitle>Dobras cutâneas (mm)</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <DobraField label="Tríceps" value={dobras.triceps} onChange={(v) => setDobras({ ...dobras, triceps: v })} />
          <DobraField label="Subescapular" value={dobras.subescapular} onChange={(v) => setDobras({ ...dobras, subescapular: v })} />
          <DobraField label="Bíceps" value={dobras.biceps} onChange={(v) => setDobras({ ...dobras, biceps: v })} />
          <DobraField label="Axilar média" value={dobras.axilarMedia} onChange={(v) => setDobras({ ...dobras, axilarMedia: v })} />
          <DobraField label="Suprailíaca" value={dobras.suprailiaca} onChange={(v) => setDobras({ ...dobras, suprailiaca: v })} />
          <DobraField label="Abdominal" value={dobras.abdominal} onChange={(v) => setDobras({ ...dobras, abdominal: v })} />
          <DobraField label="Coxa" value={dobras.coxa} onChange={(v) => setDobras({ ...dobras, coxa: v })} />
          <DobraField label="Panturrilha" value={dobras.panturrilha} onChange={(v) => setDobras({ ...dobras, panturrilha: v })} />
          <DobraField label="Peitoral" value={dobras.peitoral} onChange={(v) => setDobras({ ...dobras, peitoral: v })} />
        </div>

        <SectionTitle>Perímetros (cm)</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          <DobraField label="Braço" value={perimetros.braco} onChange={(v) => setPerimetros({ ...perimetros, braco: v })} />
          <DobraField label="Cintura" value={perimetros.cintura} onChange={(v) => setPerimetros({ ...perimetros, cintura: v })} />
          <DobraField label="Quadril" value={perimetros.quadril} onChange={(v) => setPerimetros({ ...perimetros, quadril: v })} />
          <DobraField label="Coxa" value={perimetros.coxa} onChange={(v) => setPerimetros({ ...perimetros, coxa: v })} />
          <DobraField label="Panturrilha" value={perimetros.panturrilha} onChange={(v) => setPerimetros({ ...perimetros, panturrilha: v })} />
        </div>

        <SectionTitle>Observações</SectionTitle>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Detalhes técnicos, tipo de adipômetro, condições..."
          className="w-full min-h-[80px] px-3.5 py-2.5 rounded-[12px] bg-surface border border-app-strong text-ink text-[14px] mb-4 resize-y"
        />

        <button
          type="submit"
          disabled={saving}
          className="w-full h-12 rounded-[14px] bg-accent text-accent-ink font-bold text-[14px] disabled:opacity-50 mt-2"
        >
          {saving ? 'Salvando…' : 'Salvar avaliação'}
        </button>
      </form>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Helpers UI
// ─────────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] uppercase tracking-[0.6px] text-ink-subtle font-bold mb-2 mt-5 text-mono">
      {children}
    </h2>
  );
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.6px] font-bold text-ink-subtle text-mono mb-1.5">
      {children}
    </div>
  );
}

function DobraField({ label, value, onChange }: { label: string; value?: number; onChange: (v: number | undefined) => void }) {
  return (
    <Field
      label={label}
      type="number"
      step="0.1"
      inputMode="decimal"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  );
}

function chipCls(active: boolean): string {
  return cn(
    'h-11 rounded-[10px] flex items-center justify-center text-[12px] font-bold uppercase tracking-wider',
    active ? 'bg-ink text-bg' : 'bg-surface border border-app-strong text-ink-muted',
  );
}
