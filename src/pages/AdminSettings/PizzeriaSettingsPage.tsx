import { useEffect, useState } from "react";
import { LoaderCircle, MapPin, Save } from "lucide-react";
import { publicSupabase } from "../../lib/supabase";

type DaySchedule = { day: number; name: string; closed: boolean; opens: string; closes: string };
type Settings = { cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string; horarios: DaySchedule[] };
const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const defaultSchedule = (): DaySchedule[] => dayNames.map((name, day) => ({ day, name, closed: true, opens: "18:00", closes: "23:00" }));
const emptySettings = (): Settings => ({ cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "", horarios: defaultSchedule() });
const formatCep = (value: string) => { const digits = value.replace(/\D/g, "").slice(0, 8); return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits; };

export default function PizzeriaSettingsPage() {
  const [settings, setSettings] = useState<Settings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [cepMessage, setCepMessage] = useState("");

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!publicSupabase) { setMessage("Supabase não está configurado."); setLoading(false); return; }
      const { data, error } = await publicSupabase.from("configuracoes_pizzaria").select("*").eq("id", 1).maybeSingle();
      if (!active) return;
      if (error) setMessage(`Não foi possível carregar as configurações: ${error.message}`);
      else if (data) {
        const savedHours = Array.isArray(data.horarios) ? data.horarios as Partial<DaySchedule>[] : [];
        setSettings({
          cep: data.cep ?? "", rua: data.rua ?? "", numero: data.numero ?? "", complemento: data.complemento ?? "",
          bairro: data.bairro ?? "", cidade: data.cidade ?? "", estado: data.estado ?? "",
          horarios: defaultSchedule().map((day) => ({ ...day, ...(savedHours.find((saved) => saved.day === day.day) ?? {}) })),
        });
      }
      setLoading(false);
    };
    void load();
    return () => { active = false; };
  }, []);

  const update = (field: keyof Omit<Settings, "horarios">, value: string) => setSettings((current) => ({ ...current, [field]: value }));
  const lookupCep = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) { setCepMessage(""); return; }
    setCepMessage("Consultando CEP…");
    try {
      const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      if (!response.ok) throw new Error("Falha ao consultar o CEP.");
      const result = await response.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (result.erro) { setCepMessage("CEP não encontrado. Preencha o endereço manualmente."); return; }
      setSettings((current) => ({ ...current, rua: result.logradouro ?? current.rua, bairro: result.bairro ?? current.bairro, cidade: result.localidade ?? current.cidade, estado: result.uf ?? current.estado }));
      setCepMessage("Endereço localizado pelo CEP.");
    } catch { setCepMessage("Não foi possível consultar o CEP. Preencha o endereço manualmente."); }
  };
  const updateDay = (day: number, patch: Partial<DaySchedule>) => setSettings((current) => ({ ...current, horarios: current.horarios.map((entry) => entry.day === day ? { ...entry, ...patch } : entry) }));

  const save = async () => {
    if (!publicSupabase) { setMessage("Supabase não está configurado."); return; }
    if (settings.cep.replace(/\D/g, "").length !== 8 || !settings.rua.trim() || !settings.numero.trim() || !settings.bairro.trim() || !settings.cidade.trim() || !settings.estado.trim()) {
      setMessage("Preencha o endereço completo da pizzaria, incluindo CEP e número."); return;
    }
    if (settings.horarios.some((day) => !day.closed && (!day.opens || !day.closes || day.opens === day.closes))) {
      setMessage("Em cada dia aberto, informe horários de abertura e fechamento diferentes."); return;
    }
    setSaving(true); setMessage("");
    const { error } = await publicSupabase.from("configuracoes_pizzaria").upsert({ id: 1, ...settings, cep: formatCep(settings.cep), updated_at: new Date().toISOString() });
    setSaving(false);
    setMessage(error ? `Não foi possível salvar: ${error.message}` : "Configurações salvas.");
  };

  const inputClass = "h-11 w-full rounded-xl border border-[#e4dfc9] bg-white px-3 text-sm text-[#315c40] outline-none focus:border-[#78936b] focus:ring-2 focus:ring-[#78936b]/15";
  return <main className="min-h-screen bg-[#F7F5F0] px-5 py-7 text-[#295727] sm:px-8 lg:px-11">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#b52327]">Administração</p><h1 className="font-serif text-3xl font-bold text-[#155b3b]">Configurações da pizzaria</h1><p className="mt-1 text-sm text-[#54715b]">Endereço de origem para as rotas e horários de atendimento.</p></div><button type="button" onClick={() => void save()} disabled={loading || saving} className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#b51e24] px-4 text-sm font-semibold text-white disabled:opacity-60">{saving ? <LoaderCircle className="animate-spin" size={17} /> : <Save size={17} />}{saving ? "Salvando…" : "Salvar configurações"}</button></header>
    {message && <p role="status" className={`mb-4 rounded-xl px-4 py-3 text-sm ${message.includes("salvas") ? "bg-[#eaf2e5] text-[#286342]" : "bg-[#fbe9e6] text-[#a61f24]"}`}>{message}</p>}
    <section className="mb-6 rounded-2xl border border-[#e5ddbd] bg-white p-5 shadow-sm sm:p-6"><div className="mb-5 flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#f5eee0] text-[#34704a]"><MapPin size={19} /></span><div><h2 className="font-serif text-xl font-bold text-[#155b3b]">Endereço da pizzaria</h2><p className="text-xs text-[#71826a]">Usado como origem para calcular distâncias por estrada.</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-[#526d58]">CEP<input className={`${inputClass} mt-1.5`} value={settings.cep} onChange={(event) => { const cep = formatCep(event.target.value); update("cep", cep); if (cep.replace(/\D/g, "").length === 8) void lookupCep(cep); }} placeholder="00000-000" inputMode="numeric" autoComplete="postal-code" />{cepMessage && <small className="mt-1 block font-normal">{cepMessage}</small>}</label>
        <label className="text-xs font-semibold text-[#526d58] sm:col-span-2">Rua<input className={`${inputClass} mt-1.5`} value={settings.rua} onChange={(event) => update("rua", event.target.value)} autoComplete="street-address" /></label>
        <label className="text-xs font-semibold text-[#526d58]">Número<input className={`${inputClass} mt-1.5`} value={settings.numero} onChange={(event) => update("numero", event.target.value)} /></label>
        <label className="text-xs font-semibold text-[#526d58]">Complemento<input className={`${inputClass} mt-1.5`} value={settings.complemento} onChange={(event) => update("complemento", event.target.value)} /></label>
        <label className="text-xs font-semibold text-[#526d58]">Bairro<input className={`${inputClass} mt-1.5`} value={settings.bairro} onChange={(event) => update("bairro", event.target.value)} /></label>
        <label className="text-xs font-semibold text-[#526d58]">Cidade<input className={`${inputClass} mt-1.5`} value={settings.cidade} onChange={(event) => update("cidade", event.target.value)} /></label>
        <label className="text-xs font-semibold text-[#526d58]">Estado<input className={`${inputClass} mt-1.5 uppercase`} maxLength={2} value={settings.estado} onChange={(event) => update("estado", event.target.value.toUpperCase())} /></label>
      </div>
    </section>
    <section className="rounded-2xl border border-[#e5ddbd] bg-white p-5 shadow-sm sm:p-6"><div className="mb-5"><h2 className="font-serif text-xl font-bold text-[#155b3b]">Horários de funcionamento</h2><p className="text-xs text-[#71826a]">Marque os dias fechados e informe a abertura e o fechamento dos demais.</p></div>
      <div className="space-y-2">{settings.horarios.map((day) => <div key={day.day} className="grid items-center gap-3 rounded-xl border border-[#eee9dc] p-3 sm:grid-cols-[1fr_120px_120px_130px]"><strong className="text-sm text-[#315c40]">{day.name}</strong><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={day.closed} onChange={(event) => updateDay(day.day, { closed: event.target.checked })} />Fechado</label><label className="text-[11px] text-[#71826a]">Abre<input type="time" disabled={day.closed} value={day.opens} onChange={(event) => updateDay(day.day, { opens: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#e4dfc9] bg-white px-2 text-sm disabled:opacity-50" /></label><label className="text-[11px] text-[#71826a]">Fecha<input type="time" disabled={day.closed} value={day.closes} onChange={(event) => updateDay(day.day, { closes: event.target.value })} className="mt-1 h-9 w-full rounded-lg border border-[#e4dfc9] bg-white px-2 text-sm disabled:opacity-50" /></label></div>)}</div>
    </section>
  </main>;
}
