import { METRIC_DEFINITIONS, METRIC_ORDER, type MetricStatus, type ParsedMetric } from './healthCheckData';
import { HEALTH_CHECK_CODE_VALUES } from './healthCheckCodes';

/**
 * Normalise the raw status string from the URL into one of: ok | amber | red | unknown
 *
 * SystmOne protocol templates can output any of the accepted values below.
 */
function normaliseStatus(raw: string): MetricStatus {
  const s = raw.toLowerCase().trim().replace(/[_\s-]/g, '');
  if (['ok', 'healthy', 'active', 'no', 'nonsmoker', 'lowrisk', 'low'].includes(s)) return 'ok';
  if (['amber', 'borderline', 'moderate', 'overweight', 'ex', 'exsmoker', 'prediabetes', 'low activity', 'lowactivity'].includes(s)) return 'amber';
  if (['red', 'high', 'obese', 'diabetic', 'diabeticrange', 'smoker', 'yes', 'highrisk', 'inactive'].includes(s)) return 'red';
  return 'unknown';
}

function normaliseCodeStatus(raw: string): MetricStatus {
  const code = raw.toUpperCase().trim();
  if (HEALTH_CHECK_CODE_VALUES.bp.includes(code)) {
    return code === 'BPNORMAL' ? 'ok' : 'red';
  }
  if (HEALTH_CHECK_CODE_VALUES.bmi.includes(code)) {
    if (code === 'BMINORMAL') return 'ok';
    return code === 'BMI1' ? 'amber' : 'red';
  }
  if (HEALTH_CHECK_CODE_VALUES.cvd.includes(code)) return code === 'QRISKLOW' ? 'ok' : 'red';
  if (HEALTH_CHECK_CODE_VALUES.chol.includes(code)) return code === 'CHOLNORMAL' ? 'ok' : 'amber';
  if (HEALTH_CHECK_CODE_VALUES.hba1c.includes(code)) {
    if (code === 'HBA1CNORMAL') return 'ok';
    if (code === 'HBA1CNDH1') return 'amber';
    return 'red';
  }
  if (HEALTH_CHECK_CODE_VALUES.act.includes(code)) {
    if (code === 'GPPAQACTIVE') return 'ok';
    if (code === 'GPPAQMODACTIVE' || code === 'GPPAQFAIRINACTIVE' || code === 'GPPAQUNABLE') return 'amber';
    return 'red';
  }
  if (HEALTH_CHECK_CODE_VALUES.alc.includes(code)) {
    if (code === 'ALCRISKATRISK') return 'red';
    if (code === 'ALCRISKTOOMUCH' || code === 'ALCRISKTOOMUCH1') return 'amber';
    if (code === 'ALCRISKOK' || code === 'ALCRISKTEETOTAL') return 'ok';
    return 'ok';
  }
  if (HEALTH_CHECK_CODE_VALUES.smk.includes(code)) {
    if (code === 'SMOKNONSMOK' || code === 'SMOKSTOPPED') return 'ok';
    return 'red';
  }
  return 'unknown';
}

function parseS1Csv(param: string) {
  const parts = param.split(',').map((part) => part.trim());
  return {
    orgName: parts[0] || '',
    bpsys: parts[1] || '',
    bpdias: parts[2] || '',
    bpnote: parts[3] || '',
    act: parts[4] || '',
    smk: parts[5] || '',
    bmi: parts[6] || '',
    bminote: parts[7] || '',
    alc: parts[8] || '',
    qrisk: parts[9] || '',
    qrisknote: parts[10] || '',
    hba1c: parts[11] || '',
    hba1cnote: parts[12] || '',
    hdl: parts[13] || '',
    ldl: parts[14] || '',
    totchol: parts[15] || '',
    cholrv: parts[16] || '',
    bpsysdt: parts[17] || '',
  };
}

/**
 * Parse health check metrics from URLSearchParams.
 *
 * Supports two formats:
 *
 * 1. Individual params (recommended for SystmOne templates):
 *    ?bp=142/92&bps=amber&bmi=28.5&bmis=amber&cvd=4.2&cvds=ok&...
 *    Each metric has a value param (e.g. bp) and a status param (e.g. bps).
 *    Status-only metrics (act, alc, smk) just need the status param:
 *    ?acts=low&alcs=ok&smks=no
 *
 * 2. Compact single-param format (useful if URL length is a concern):
 *    ?hc=bp:142/92:amber,bmi:28.5:amber,cvd:4.2:ok,...
 *    Each segment is  metricId:value:status  separated by commas.
 *    Status-only: act::low,alc::ok,smk::no
 */
export function parseHealthCheckParams(params: URLSearchParams): ParsedMetric[] {
  const rawValues: Record<string, { value: string; status: string }> = {};
  let resultDate = params.get('date') || params.get('resultDate') || params.get('dt') || '';
  let cholesterolComponents: { hdl?: string; ldl?: string; tc?: string } | null = null;

  const hcParam = params.get('hc');
  const s1Param = params.get('s1') || params.get('s1csv') || params.get('payload');

  if (hcParam) {
    // Compact format
    hcParam.split(',').forEach((segment) => {
      const parts = segment.split(':');
      if (parts.length >= 2) {
        const id = parts[0].trim();
        const value = parts[1].trim();
        const status = parts[2]?.trim() ?? '';
        if (id) rawValues[id] = { value, status };
      }
      });
  } else if (s1Param) {
    const csv = parseS1Csv(s1Param);
    if (csv.bpsysdt) {
      resultDate = csv.bpsysdt;
    }

    if (csv.bpsys || csv.bpdias || csv.bpnote) {
      rawValues.bp = { value: [csv.bpsys, csv.bpdias].filter(Boolean).join('/'), status: csv.bpnote };
    }

    if (csv.bmi || csv.bminote) {
      rawValues.bmi = { value: csv.bmi, status: csv.bminote };
    }

    if (csv.qrisk || csv.qrisknote) {
      rawValues.cvd = { value: csv.qrisk, status: csv.qrisknote };
    }

    if (csv.hdl || csv.ldl || csv.totchol || csv.cholrv) {
      cholesterolComponents = {
        hdl: csv.hdl || '',
        ldl: csv.ldl || '',
        tc: csv.totchol || '',
      };
      // Use the existing "ldl" metric as the shared cholesterol card.
      // We still store LDL as the primary value for backwards compatibility, but the UI
      // can render HDL/LDL/TC together from `components`.
      rawValues.ldl = { value: csv.ldl || csv.totchol || '', status: csv.cholrv };
    }

    if (csv.hba1c || csv.hba1cnote) {
      rawValues.hba1c = { value: csv.hba1c, status: csv.hba1cnote };
    }

    if (csv.act) {
      rawValues.act = { value: csv.act, status: csv.act };
    }

    if (csv.alc) {
      rawValues.alc = { value: csv.alc, status: csv.alc };
    }

    if (csv.smk) {
      rawValues.smk = { value: csv.smk, status: csv.smk };
    }
  } else {
    // Individual params format
    METRIC_ORDER.forEach((id) => {
      const value = params.get(id) ?? '';
      const status = params.get(`${id}s`) ?? '';
      if (value || status) {
        rawValues[id] = { value, status };
      }
    });
  }

  // If we have individual cholesterol params, infer a shared breakdown for the cholesterol card.
  if (!cholesterolComponents && (rawValues.tc || rawValues.nhdl || rawValues.ldl)) {
    const tcRaw = rawValues.tc?.value ?? '';
    const ldlRaw = rawValues.ldl?.value ?? '';
    const nhdlRaw = rawValues.nhdl?.value ?? '';
    const tc = Number.parseFloat(tcRaw);
    const nhdl = Number.parseFloat(nhdlRaw);
    const hdl = Number.isFinite(tc) && Number.isFinite(nhdl) ? (tc - nhdl).toFixed(1) : '';
    cholesterolComponents = { hdl, ldl: ldlRaw, tc: tcRaw };
  }

  const results: ParsedMetric[] = [];

  METRIC_ORDER.forEach((id) => {
    const raw = rawValues[id];
    if (!raw) return;

    const def = METRIC_DEFINITIONS[id];
    if (!def) return;

    const status = normaliseStatus(raw.status) === 'unknown' ? normaliseCodeStatus(raw.status) : normaliseStatus(raw.status);
    // Skip entirely if we have neither a value nor a recognisable status
    if (!raw.value && status === 'unknown') return;

    const resolvedStatus: Exclude<MetricStatus, 'unknown'> = status === 'unknown' ? 'ok' : status;
    const statusInfo = def.statuses[resolvedStatus];

    results.push({
      id,
      label: def.label,
      value: raw.value,
      unit: def.unit,
      whatTitle: def.whatTitle,
      what: def.what,
      resultCode: raw.status,
      resultDate,
      components: id === 'ldl' ? (cholesterolComponents || undefined) : undefined,
      status: resolvedStatus,
      badge: statusInfo.badge,
      badgeClass: statusInfo.badgeClass,
      pathway: statusInfo.pathway,
      meaning: statusInfo.meaning,
      helpLinks: statusInfo.helpLinks,
    });
  });

  return results;
}

/**
 * Returns true if the URLSearchParams appear to contain health check metric data
 * (as opposed to the legacy topic codes format).
 */
export function isHealthCheckFormat(params: URLSearchParams): boolean {
  if (params.has('hc') || params.has('s1') || params.has('s1csv') || params.has('payload')) return true;
  return METRIC_ORDER.some((id) => params.has(id) || params.has(`${id}s`)) || params.has('date') || params.has('resultDate') || params.has('dt');
}
