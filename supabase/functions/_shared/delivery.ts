export type Address = {
  cep: string;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
};

type Pizzeria = Address;
type DeliveryRule = { id: string; distancia_min_km: number; distancia_max_km: number; taxa: number };
type DeliveryConfig = { modo: "dinamica" | "fixa"; taxa_fixa: number };
type GeocodeFeature = { geometry?: { coordinates?: [number, number] }; properties?: Record<string, unknown> };
export class DeliveryError extends Error { constructor(message: string, readonly status = 422) { super(message); } }

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const requiredString = (value: unknown) => typeof value === "string" ? value.trim() : "";
const supabaseConfig = () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) throw new DeliveryError("O serviço de delivery não está configurado no servidor.", 503);
  return { supabaseUrl, serviceKey };
};

async function serviceSelect<T>(table: string, query: string): Promise<T[]> {
  const { supabaseUrl, serviceKey } = supabaseConfig();
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
  if (!response.ok) throw new DeliveryError("Não foi possível ler as configurações de delivery.", 503);
  return await response.json() as T[];
}

function addressFrom(row: Record<string, unknown>): Pizzeria {
  return { cep: requiredString(row.cep), rua: requiredString(row.rua), numero: requiredString(row.numero), complemento: requiredString(row.complemento), bairro: requiredString(row.bairro), cidade: requiredString(row.cidade), estado: requiredString(row.estado) };
}
function fullAddress(address: Address) {
  return [address.rua, address.numero, address.complemento, address.bairro, address.cidade, address.estado, address.cep, "Brasil"].filter(Boolean).join(", ");
}

async function geocode(query: string, expected: Address): Promise<[number, number]> {
  const orsKey = Deno.env.get("ORS_API_KEY");
  if (!orsKey) throw new DeliveryError("O serviço de rotas não está configurado.", 503);
  const url = new URL("https://api.openrouteservice.org/geocode/search");
  url.searchParams.set("text", query);
  url.searchParams.set("boundary.country", "BR");
  url.searchParams.set("size", "1");
  const response = await fetch(url, { headers: { Authorization: orsKey } });
  if (!response.ok) throw new DeliveryError("Não foi possível localizar o endereço para calcular a rota. Confira os dados e tente novamente.", 422);
  const result = await response.json() as { features?: GeocodeFeature[] };
  const feature = result.features?.[0];
  const coords = feature?.geometry?.coordinates;
  const props = feature?.properties ?? {};
  if (!coords || coords.length !== 2 || !Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
    throw new DeliveryError("Endereço não localizado. Confira rua, número, bairro e CEP.", 422);
  }
  const label = String(props.label ?? "");
  const geocodedNumber = String(props.housenumber ?? label.match(/(?:^|,\s*)(\d+[A-Za-z]?)(?:,|$)/)?.[1] ?? "");
  if (expected.numero && geocodedNumber && normalize(geocodedNumber) !== normalize(expected.numero)) {
    throw new DeliveryError("Não foi possível confirmar o número informado no endereço. Confira o número e tente novamente.", 422);
  }
  const locality = String(props.locality ?? props.localadmin ?? props.county ?? "");
  if (expected.cidade && locality && normalize(locality) !== normalize(expected.cidade) && !normalize(locality).includes(normalize(expected.cidade))) {
    throw new DeliveryError("O endereço localizado não corresponde à cidade informada. Confira o CEP e o endereço.", 422);
  }
  const confidence = Number(props.confidence ?? 1);
  if (confidence < 0.3) throw new DeliveryError("O endereço não pôde ser identificado com segurança. Informe mais detalhes.", 422);
  return coords;
}

async function validateCep(address: Address): Promise<Address> {
  const cep = address.cep.replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) throw new DeliveryError("Informe um CEP válido com 8 dígitos.");
  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
  if (!response.ok) throw new DeliveryError("Não foi possível validar o CEP agora. Tente novamente.", 503);
  const data = await response.json() as { erro?: boolean; localidade?: string; uf?: string };
  if (data.erro) throw new DeliveryError("CEP não encontrado. Confira o CEP informado.");
  if (data.localidade && address.cidade && normalize(data.localidade) !== normalize(address.cidade)) throw new DeliveryError("O CEP não corresponde à cidade informada.");
  if (data.uf && address.estado && normalize(data.uf) !== normalize(address.estado)) throw new DeliveryError("O CEP não corresponde ao estado informado.");
  return { ...address, cidade: data.localidade || address.cidade, estado: data.uf || address.estado };
}

export async function calculateDelivery(addressInput: unknown) {
  let address = addressFrom((addressInput && typeof addressInput === "object" ? addressInput : {}) as Record<string, unknown>);
  if (!address.rua || !address.numero || !address.bairro || !address.cidade || !address.cep) {
    throw new DeliveryError("Preencha CEP, rua, número, bairro, cidade e estado para calcular a entrega.");
  }
  address = await validateCep(address);
  const configRows = await serviceSelect<DeliveryConfig>("configuracoes_delivery", "id=eq.1&select=modo,taxa_fixa");
  const deliveryConfig = configRows[0] ?? { modo: "dinamica" as const, taxa_fixa: 0 };
  if (deliveryConfig.modo === "fixa") {
    const fee = Number(deliveryConfig.taxa_fixa);
    if (!Number.isFinite(fee) || fee < 0) throw new DeliveryError("A taxa fixa de entrega está inválida. A pizzaria precisa revisar a configuração.", 503);
    return { modo: "fixa" as const, manual_confirmation: false, distance_km: null, taxa_entrega: fee, faixa: null };
  }
  const orsKey = Deno.env.get("ORS_API_KEY");
  if (!orsKey) {
    return { modo: "dinamica" as const, manual_confirmation: true as const, distance_km: null, taxa_entrega: null, faixa: null };
  }
  const [settingsRows, rulesRows] = await Promise.all([
    serviceSelect<Record<string, unknown>>("configuracoes_pizzaria", "id=eq.1&select=cep,rua,numero,complemento,bairro,cidade,estado"),
    serviceSelect<DeliveryRule>("regras_delivery", "select=id,distancia_min_km,distancia_max_km,taxa&order=distancia_min_km.asc"),
  ]);
  if (!settingsRows.length) throw new DeliveryError("A pizzaria ainda não cadastrou o endereço de origem.", 503);
  if (!rulesRows.length) throw new DeliveryError("A pizzaria ainda não configurou as faixas de entrega.", 503);
  const origin = addressFrom(settingsRows[0]);
  if (!origin.rua || !origin.numero || !origin.bairro || !origin.cidade || !origin.estado || !origin.cep) throw new DeliveryError("Complete o endereço da pizzaria nas configurações administrativas.", 503);
  const [start, end] = await Promise.all([geocode(fullAddress(origin), origin), geocode(fullAddress(address), address)]);
  const routeResponse = await fetch("https://api.openrouteservice.org/v2/directions/driving-car", {
    method: "POST", headers: { Authorization: orsKey, "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates: [start, end], instructions: false, geometry: false }),
  });
  if (!routeResponse.ok) throw new DeliveryError("Não foi possível calcular uma rota terrestre para esse endereço. Confira os dados ou tente novamente mais tarde.", 422);
  const route = await routeResponse.json() as { routes?: Array<{ summary?: { distance?: number } }> };
  const meters = Number(route.routes?.[0]?.summary?.distance);
  if (!Number.isFinite(meters) || meters <= 0) throw new DeliveryError("A rota não retornou uma distância válida para a entrega.", 422);
  const distanceKm = Math.round((meters / 1000) * 100) / 100;
  const ordered = rulesRows.map((rule) => ({ ...rule, distancia_min_km: Number(rule.distancia_min_km), distancia_max_km: Number(rule.distancia_max_km), taxa: Number(rule.taxa) })).sort((a, b) => a.distancia_min_km - b.distancia_min_km);
  let expectedMin = 0;
  for (const rule of ordered) {
    if (!Number.isFinite(rule.distancia_min_km) || !Number.isFinite(rule.distancia_max_km) || !Number.isFinite(rule.taxa) || rule.distancia_min_km !== expectedMin || rule.distancia_max_km <= rule.distancia_min_km || rule.taxa < 0) {
      throw new DeliveryError("As faixas de entrega estão inválidas. A pizzaria precisa revisar as regras.", 503);
    }
    expectedMin = rule.distancia_max_km;
  }
  const first = ordered[0];
  const matched = ordered.find((rule, index) => distanceKm <= rule.distancia_max_km && (index === 0 ? distanceKm >= rule.distancia_min_km : distanceKm > rule.distancia_min_km));
  if (!first || first.distancia_min_km !== 0 || !matched) {
    const max = ordered.at(-1)?.distancia_max_km ?? 0;
    throw new DeliveryError(`Este endereço fica fora da área de entrega (limite atual: ${max} km por rota).`, 422);
  }
  return { modo: "dinamica" as const, manual_confirmation: false, distance_km: distanceKm, taxa_entrega: matched.taxa, faixa: { distancia_min_km: matched.distancia_min_km, distancia_max_km: matched.distancia_max_km } };
}

export const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Content-Type": "application/json" };
export function jsonResponse(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: corsHeaders }); }
