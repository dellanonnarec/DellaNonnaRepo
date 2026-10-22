import { useEffect, useMemo, useState } from "react";
import { CirclePlus, LoaderCircle, Save, Trash2, Truck } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";

type Rule = { id: string; distancia_min_km: number; distancia_max_km: number; taxa: number };
type Mode = "dinamica" | "fixa";
const newId = () => globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export default function DeliveryRulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [mode, setMode] = useState<Mode>("dinamica");
  const [fixedFee, setFixedFee] = useState(10);
  const [savedMode, setSavedMode] = useState<Mode>("dinamica");
  const [savedFixedFee, setSavedFixedFee] = useState(10);
  const [savedRules, setSavedRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!publicSupabase) { setMessage("Supabase não está configurado."); setLoading(false); return; }
      const [rulesResult, configResult] = await Promise.all([
        publicSupabase.from("regras_delivery").select("id, distancia_min_km, distancia_max_km, taxa").order("distancia_min_km"),
        publicSupabase.from("configuracoes_delivery").select("modo, taxa_fixa").eq("id", 1).maybeSingle(),
      ]);
      if (!active) return;
      if (rulesResult.error) setMessage(`Não foi possível carregar as faixas: ${rulesResult.error.message}`);
      else {
        const rows = (rulesResult.data ?? []).map((row) => ({ id: row.id, distancia_min_km: Number(row.distancia_min_km), distancia_max_km: Number(row.distancia_max_km), taxa: Number(row.taxa) }));
        setRules(rows); setSavedRules(rows);
      }
      if (configResult.error) setMessage(`Não foi possível carregar o modo de cobrança: ${configResult.error.message}`);
      else if (configResult.data) {
        const loadedMode: Mode = configResult.data.modo === "fixa" ? "fixa" : "dinamica";
        const loadedFee = Number(configResult.data.taxa_fixa ?? 10);
        setMode(loadedMode); setSavedMode(loadedMode); setFixedFee(loadedFee); setSavedFixedFee(loadedFee);
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const orderedRules = useMemo(() => [...rules].sort((a, b) => a.distancia_min_km - b.distancia_min_km), [rules]);
  const maxDistance = orderedRules.at(-1)?.distancia_max_km ?? 0;
  const validation = useMemo(() => {
    if (mode === "fixa") return Number.isFinite(fixedFee) && fixedFee >= 0 ? "" : "Informe uma taxa fixa válida, igual ou maior que zero.";
    if (!orderedRules.length) return "Adicione pelo menos uma faixa para ativar as entregas.";
    let previousMax = 0;
    for (const [index, rule] of orderedRules.entries()) {
      if (!Number.isFinite(rule.distancia_min_km) || !Number.isFinite(rule.distancia_max_km) || !Number.isFinite(rule.taxa) || rule.distancia_min_km < 0 || rule.distancia_max_km <= rule.distancia_min_km || rule.taxa < 0) return `Revise os valores da faixa ${index + 1}.`;
      if (Math.round(rule.distancia_min_km * 100) !== Math.round(previousMax * 100)) return index === 0 ? "A primeira faixa deve começar em 0 km." : "Ajuste as faixas para que não haja sobreposições nem lacunas.";
      previousMax = rule.distancia_max_km;
    }
    return "";
  }, [mode, fixedFee, orderedRules]);

  const updateRule = (id: string, field: keyof Omit<Rule, "id">, raw: string) => {
    const value = raw === "" ? Number.NaN : Number(raw);
    setRules((current) => current.map((rule) => rule.id === id ? { ...rule, [field]: value } : rule));
    setMessage("");
  };
  const addRule = () => {
    const last = orderedRules.at(-1);
    const min = last?.distancia_max_km ?? 0;
    setRules((current) => [...current, { id: newId(), distancia_min_km: min, distancia_max_km: min + 2, taxa: 0 }]); setMessage("");
  };
  const removeRule = (id: string) => { setRules((current) => current.filter((rule) => rule.id !== id)); setMessage(""); };

  const save = async () => {
    if (!publicSupabase) { setMessage("Supabase não está configurado."); return; }
    if (validation) { setMessage(validation); return; }
    setSaving(true); setMessage("");
    const { data, error } = await publicSupabase.rpc("salvar_configuracao_delivery", {
      p_modo: mode,
      p_taxa_fixa: mode === "fixa" ? fixedFee : null,
      p_regras: orderedRules.map(({ id, distancia_min_km, distancia_max_km, taxa }) => ({ id: id.startsWith("draft-") ? null : id, distancia_min_km, distancia_max_km, taxa })),
    });
    setSaving(false);
    if (error) { setMessage(`Não foi possível salvar: ${error.message}`); return; }
    const rows = ((data?.regras ?? []) as Rule[]).map((row) => ({ id: row.id, distancia_min_km: Number(row.distancia_min_km), distancia_max_km: Number(row.distancia_max_km), taxa: Number(row.taxa) }));
    if (mode === "dinamica") { setRules(rows); setSavedRules(rows); }
    setSavedMode(mode); setSavedFixedFee(fixedFee);
    setMessage(mode === "fixa" ? "Taxa fixa de delivery salva." : "Regras dinâmicas de delivery salvas.");
  };

  const changed = mode !== savedMode || fixedFee !== savedFixedFee || (mode === "dinamica" && JSON.stringify(orderedRules) !== JSON.stringify(savedRules));
  const inputClass = "h-10 w-full rounded-lg border border-[#e4dfc9] bg-white px-3 text-sm text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15";
  return <main className="min-h-screen bg-[#F7F5F0] px-5 py-7 text-[#295727] sm:px-8 lg:px-11">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b52327]">Administração</p><h1 className="font-serif text-3xl font-bold text-[#155b3b]">Regras de delivery</h1><p className="mt-1 text-sm text-[#54715b]">Escolha como a taxa de entrega será calculada.</p></div><button type="button" onClick={() => void save()} disabled={loading || saving || Boolean(validation) || !changed} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#b51e24] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}{saving ? "Salvando…" : "Salvar configuração"}</button></header>
    {message && <p role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm ${message.includes("salva") ? "bg-[#eaf2e5] text-[#286342]" : "bg-[#fbe9e6] text-[#a61f24]"}`}>{message}</p>}
    <section className="mb-5 grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => { setMode("dinamica"); setMessage(""); }} aria-pressed={mode === "dinamica"} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${mode === "dinamica" ? "border-[#34704a] ring-2 ring-[#34704a]/15" : "border-[#e5ddbd] hover:border-[#b8c7ae]"}`}><span className="text-sm font-bold text-[#315c40]">Por distância</span><p className="mt-1 text-xs leading-relaxed text-[#71826a]">Calcula a rota até a pizzaria e aplica a faixa correspondente.</p></button>
      <button type="button" onClick={() => { setMode("fixa"); setMessage(""); }} aria-pressed={mode === "fixa"} className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${mode === "fixa" ? "border-[#34704a] ring-2 ring-[#34704a]/15" : "border-[#e5ddbd] hover:border-[#b8c7ae]"}`}><span className="text-sm font-bold text-[#315c40]">Taxa fixa</span><p className="mt-1 text-xs leading-relaxed text-[#71826a]">Cobra o mesmo valor em todos os endereços, independente da distância.</p></button>
    </section>
    {mode === "fixa" ? <section className="max-w-xl rounded-2xl border border-[#e5ddbd] bg-white p-5 shadow-sm sm:p-6"><div className="mb-4 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f5eee0] text-[#34704a]"><Truck size={19} /></span><div><h2 className="font-serif text-xl font-bold text-[#155b3b]">Valor único da entrega</h2><p className="text-xs text-[#71826a]">Este valor será incluído no checkout para qualquer endereço válido.</p></div></div><label className="block max-w-xs text-xs font-semibold text-[#526d58]">Taxa fixa (R$)<div className="relative mt-1.5"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#829078]">R$</span><input className={`${inputClass} pl-10`} type="number" min="0" step="0.01" value={Number.isFinite(fixedFee) ? fixedFee : ""} onChange={(event) => { setFixedFee(event.target.value === "" ? Number.NaN : Number(event.target.value)); setMessage(""); }} /></div></label></section> : <>
      <section className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e5ddbd] bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f5eee0] text-[#34704a]"><Truck size={19} /></span><div><strong className="text-sm text-[#315c40]">Área máxima atendida</strong><p className="text-xs text-[#71826a]">A última faixa define o limite da entrega por rota.</p></div></div><strong className="font-serif text-2xl text-[#155b3b]">{maxDistance.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km</strong></section>
      <section className="overflow-hidden rounded-2xl border border-[#e5ddbd] bg-white shadow-sm"><div className="grid grid-cols-[1.2fr_1.2fr_1fr_44px] gap-3 border-b border-[#eee9dc] bg-[#faf8f2] px-4 py-3 text-[11px] font-bold uppercase tracking-wide text-[#71826a] sm:grid-cols-[1.3fr_1.3fr_1fr_48px]"><span>Distância mínima</span><span>Distância máxima</span><span>Taxa (R$)</span><span /></div>
        {loading ? <div className="flex items-center gap-2 p-6 text-sm text-[#71826a]"><LoaderCircle className="animate-spin" size={16} />Carregando faixas…</div> : orderedRules.length === 0 ? <p className="p-6 text-sm text-[#71826a]">Nenhuma faixa cadastrada. Adicione as regras que deseja oferecer.</p> : orderedRules.map((rule, index) => <div key={rule.id} className="grid grid-cols-[1.2fr_1.2fr_1fr_44px] items-center gap-3 border-b border-[#eee9dc] px-4 py-3 last:border-b-0 sm:grid-cols-[1.3fr_1.3fr_1fr_48px]"><label className="min-w-0"><span className="sr-only">Distância mínima da faixa {index + 1}</span><div className="relative"><input className={`${inputClass} pr-8`} type="number" min="0" step="0.1" value={Number.isFinite(rule.distancia_min_km) ? rule.distancia_min_km : ""} onChange={(event) => updateRule(rule.id, "distancia_min_km", event.target.value)} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#829078]">km</span></div></label><label className="min-w-0"><span className="sr-only">Distância máxima da faixa {index + 1}</span><div className="relative"><input className={`${inputClass} pr-8`} type="number" min="0.1" step="0.1" value={Number.isFinite(rule.distancia_max_km) ? rule.distancia_max_km : ""} onChange={(event) => updateRule(rule.id, "distancia_max_km", event.target.value)} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#829078]">km</span></div></label><label className="min-w-0"><span className="sr-only">Taxa da faixa {index + 1}</span><div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#829078]">R$</span><input className={`${inputClass} pl-9`} type="number" min="0" step="0.01" value={Number.isFinite(rule.taxa) ? rule.taxa : ""} onChange={(event) => updateRule(rule.id, "taxa", event.target.value)} /></div></label><button type="button" onClick={() => removeRule(rule.id)} className="grid size-10 place-items-center rounded-lg text-[#a43a32] hover:bg-[#f8e8df]" aria-label={`Excluir faixa ${index + 1}`}><Trash2 size={17} /></button></div>)}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eee9dc] bg-[#faf8f2] px-4 py-4"><button type="button" onClick={addRule} disabled={loading} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8dfcf] bg-white px-4 text-sm font-semibold text-[#286342] hover:bg-[#f3f7ef] disabled:opacity-50"><CirclePlus size={17} />Adicionar faixa</button><p className="text-xs text-[#71826a]">Faixas: “de” no início e “acima de” nas seguintes; a distância final é inclusiva.</p></div>
      </section>
    </>}
    {validation && <p className="mt-4 rounded-xl bg-[#fbe9e6] px-4 py-3 text-sm text-[#a61f24]">{validation}</p>}
    {changed && !validation && <p className="mt-4 text-xs text-[#71826a]">Há alterações ainda não salvas.</p>}
  </main>;
}
