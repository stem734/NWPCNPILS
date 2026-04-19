import React, { useMemo, useState, useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Trash2, Save, Copy, CheckCircle, ExternalLink, Link, AlertCircle, Eye, Edit2, CopyPlus, Phone, Mail, Globe } from 'lucide-react';
import MedicationPreviewModal from '../components/MedicationPreviewModal';
import HealthCheckCard from '../components/HealthCheckCard';
import { resolvePath } from '../subdomainUtils';
import ConfirmDialog from '../components/ConfirmDialog';
import { type MedicationRecord, useMedicationCatalog } from '../medicationCatalog';
import { getFunctionErrorMessage } from '../supabaseFunctionError';
import { HEALTH_CHECK_CARD_LABELS, type HealthCheckCodeFamily } from '../healthCheckCodes';
import { CLINICAL_DOMAIN_IDS, PREVIEW_DOMAIN_CONFIGS, type ClinicalDomainId } from '../healthCheckVariantConfig';
import { SCREENING_TEMPLATES, IMMUNISATION_TEMPLATES, LONG_TERM_CONDITION_TEMPLATES } from '../patientTemplateCatalog';

interface TrendLink {
  title: string;
  url: string;
}

type OutputBuilderType = 'medication' | 'healthcheck' | 'screening' | 'immunisation' | 'ltc';

type HealthCheckBuilderLink = {
  title: string;
  showTitleOnCard?: boolean;
  phone?: string;
  phoneLabel?: string;
  email?: string;
  emailLabel?: string;
  website?: string;
  websiteLabel?: string;
};

type HealthCheckBuilderVariant = {
  resultCode: string;
  resultsMessage: string;
  importantText: string;
  whatIsTitle: string;
  whatIsText: string;
  nextStepsTitle: string;
  nextStepsText: string;
  links: HealthCheckBuilderLink[];
};

const HEALTH_CHECK_PARAM_KEYS: Record<HealthCheckCodeFamily, string> = {
  bp: 'bps',
  bmi: 'bmis',
  cvd: 'cvds',
  chol: 'ldls',
  hba1c: 'hba1cs',
  act: 'acts',
  alc: 'alcs',
  smk: 'smks',
};

const SCREENING_OPTIONS = Object.values(SCREENING_TEMPLATES).map((template) => ({
  value: template.id,
  label: template.label,
}));

const IMMUNISATION_OPTIONS = Object.values(IMMUNISATION_TEMPLATES).map((template) => ({
  value: template.id,
  label: template.label,
}));

const LONG_TERM_CONDITION_OPTIONS = Object.values(LONG_TERM_CONDITION_TEMPLATES).map((template) => ({
  value: template.id,
  label: template.label,
}));

const BUILDER_STORAGE_KEYS = {
  healthcheck: 'card-builder:healthcheck',
  screening: 'card-builder:screening',
  immunisation: 'card-builder:immunisation',
  ltc: 'card-builder:ltc',
} as const;

const createDefaultHealthCheckBuilderState = (): Record<ClinicalDomainId, Record<string, HealthCheckBuilderVariant>> =>
  CLINICAL_DOMAIN_IDS.reduce((domainAcc, domainId) => {
    const domainConfig = PREVIEW_DOMAIN_CONFIGS[domainId];
    domainAcc[domainId] = Object.keys(domainConfig.metricByCode).reduce((variantAcc, resultCode) => {
      const metric = domainConfig.metricByCode[resultCode];
      variantAcc[resultCode] = {
        resultCode,
        resultsMessage: metric.pathway,
        importantText: domainConfig.defaultImportantText || '',
        whatIsTitle: domainConfig.whatIsTitle,
        whatIsText: domainConfig.whatIsText,
        nextStepsTitle: domainConfig.defaultNextStepsTitle,
        nextStepsText: domainConfig.defaultNextStepsText,
        links: [],
      };
      return variantAcc;
    }, {} as Record<string, HealthCheckBuilderVariant>);
    return domainAcc;
  }, {} as Record<ClinicalDomainId, Record<string, HealthCheckBuilderVariant>>);

const DrugBuilder: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();
  const [selectedOutputType, setSelectedOutputType] = useState<OutputBuilderType>('medication');
  const {
    medications: existingMeds,
    loading: loadingMeds,
    reload: reloadMeds,
  } = useMedicationCatalog();

  // Search / generate
  const [medName, setMedName] = useState('');
  const [medType, setMedType] = useState<'NEW' | 'REAUTH'>('NEW');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Editable fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [badge, setBadge] = useState<'NEW' | 'REAUTH'>('NEW');
  const [category, setCategory] = useState('');
  const [keyInfo, setKeyInfo] = useState<string[]>(['']);
  const [nhsLink, setNhsLink] = useState('');
  const [trendLinks, setTrendLinks] = useState<TrendLink[]>([]);
  const [sickDaysNeeded, setSickDaysNeeded] = useState(false);
  const [reviewMonths, setReviewMonths] = useState(12);
  const [contentReviewDate, setContentReviewDate] = useState('');
  const [hasContent, setHasContent] = useState(false);
  const [editingCode, setEditingCode] = useState('');
  const [requestedCode, setRequestedCode] = useState('');
  const [previewMed, setPreviewMed] = useState<MedicationRecord | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedCode, setSavedCode] = useState('');
  const [saveError, setSaveError] = useState('');
  const [savedAction, setSavedAction] = useState<'created' | 'updated'>('created');

  const [deletingCode, setDeletingCode] = useState('');
  const [healthCheckLocalSupportName, setHealthCheckLocalSupportName] = useState('');
  const [healthCheckLocalSupportPhone, setHealthCheckLocalSupportPhone] = useState('');
  const [healthCheckLocalSupportEmail, setHealthCheckLocalSupportEmail] = useState('');
  const [healthCheckLocalSupportWebsite, setHealthCheckLocalSupportWebsite] = useState('');
  const [healthCheckSelections] = useState<Record<HealthCheckCodeFamily, string>>({
    bp: '',
    bmi: '',
    cvd: '',
    chol: '',
    hba1c: '',
    act: '',
    alc: '',
    smk: '',
  });
  const [selectedHealthCheckDomain, setSelectedHealthCheckDomain] = useState<ClinicalDomainId>('bp');
  const [selectedHealthCheckVariantCode, setSelectedHealthCheckVariantCode] = useState('BPNORMAL');
  const [healthCheckBuilderConfigs, setHealthCheckBuilderConfigs] = useState<Record<ClinicalDomainId, Record<string, HealthCheckBuilderVariant>>>(() => createDefaultHealthCheckBuilderState());
  const [screeningType, setScreeningType] = useState('cervical');
  const [immunisationSelections, setImmunisationSelections] = useState<string[]>(['flu']);
  const [selectedLongTermCondition, setSelectedLongTermCondition] = useState('asthma');
  const [localSupportName, setLocalSupportName] = useState('');
  const [localSupportPhone, setLocalSupportPhone] = useState('');
  const [localSupportEmail, setLocalSupportEmail] = useState('');
  const [localSupportWebsite, setLocalSupportWebsite] = useState('');
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    isDangerous: boolean;
    onConfirm: () => void;
  } | null>(null);
  const [builderNotice, setBuilderNotice] = useState<{ type: OutputBuilderType; message: string } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      if (session?.user) {
        setAuthenticated(true);
      } else {
        navigate(resolvePath('/admin'));
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    const domainCodes = Object.keys(PREVIEW_DOMAIN_CONFIGS[selectedHealthCheckDomain].metricByCode);
    if (!domainCodes.includes(selectedHealthCheckVariantCode)) {
      setSelectedHealthCheckVariantCode(domainCodes[0] || '');
    }
  }, [selectedHealthCheckDomain, selectedHealthCheckVariantCode]);

  useEffect(() => {
    try {
      const hcRaw = window.localStorage.getItem(BUILDER_STORAGE_KEYS.healthcheck);
      if (hcRaw) {
        const parsed = JSON.parse(hcRaw) as {
          selectedDomain?: ClinicalDomainId;
          selectedCode?: string;
          configs?: Record<ClinicalDomainId, Record<string, HealthCheckBuilderVariant>>;
          localSupportName?: string;
          localSupportPhone?: string;
          localSupportEmail?: string;
          localSupportWebsite?: string;
        };
        if (parsed.selectedDomain) setSelectedHealthCheckDomain(parsed.selectedDomain);
        if (parsed.selectedCode) setSelectedHealthCheckVariantCode(parsed.selectedCode);
        if (parsed.configs) setHealthCheckBuilderConfigs(parsed.configs);
        setHealthCheckLocalSupportName(parsed.localSupportName || '');
        setHealthCheckLocalSupportPhone(parsed.localSupportPhone || '');
        setHealthCheckLocalSupportEmail(parsed.localSupportEmail || '');
        setHealthCheckLocalSupportWebsite(parsed.localSupportWebsite || '');
      }

      const screeningRaw = window.localStorage.getItem(BUILDER_STORAGE_KEYS.screening);
      if (screeningRaw) {
        const parsed = JSON.parse(screeningRaw) as { screeningType?: string };
        if (parsed.screeningType) setScreeningType(parsed.screeningType);
      }

      const immsRaw = window.localStorage.getItem(BUILDER_STORAGE_KEYS.immunisation);
      if (immsRaw) {
        const parsed = JSON.parse(immsRaw) as {
          immunisationSelections?: string[];
          localSupportName?: string;
          localSupportPhone?: string;
          localSupportEmail?: string;
          localSupportWebsite?: string;
        };
        if (Array.isArray(parsed.immunisationSelections) && parsed.immunisationSelections.length > 0) {
          setImmunisationSelections(parsed.immunisationSelections);
        }
        setLocalSupportName(parsed.localSupportName || '');
        setLocalSupportPhone(parsed.localSupportPhone || '');
        setLocalSupportEmail(parsed.localSupportEmail || '');
        setLocalSupportWebsite(parsed.localSupportWebsite || '');
      }

      const ltcRaw = window.localStorage.getItem(BUILDER_STORAGE_KEYS.ltc);
      if (ltcRaw) {
        const parsed = JSON.parse(ltcRaw) as { selectedLongTermCondition?: string };
        if (parsed.selectedLongTermCondition) setSelectedLongTermCondition(parsed.selectedLongTermCondition);
      }
    } catch {
      // Ignore local template hydration errors and continue with defaults.
    }
  }, []);

  const previewDraft = useMemo<MedicationRecord | null>(() => {
    if (!hasContent) {
      return null;
    }

    return {
      code: editingCode || '000',
      title: title.trim() || medName.trim() || 'Medication Preview',
      description: description.trim(),
      badge,
      category: category.trim(),
      keyInfo: keyInfo.filter((item) => item.trim()),
      nhsLink: nhsLink.trim(),
      trendLinks: trendLinks.filter((item) => item.title.trim() && item.url.trim()),
      sickDaysNeeded,
      reviewMonths,
      contentReviewDate,
      source: editingCode ? 'override' : 'custom',
      isBuiltIn: false,
    };
  }, [badge, category, description, editingCode, hasContent, keyInfo, medName, nhsLink, reviewMonths, contentReviewDate, sickDaysNeeded, title, trendLinks]);

  const getFriendlyMedicationName = (medication: MedicationRecord) => {
    const [baseTitle] = medication.title.split(' - ');
    return baseTitle.trim();
  };

  const startEditingMedication = (medication: MedicationRecord) => {
    setMedName(getFriendlyMedicationName(medication));
    setMedType(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setTitle(medication.title);
    setDescription(medication.description);
    setBadge(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setCategory(medication.category);
    setKeyInfo(medication.keyInfo.length > 0 ? medication.keyInfo : ['']);
    setNhsLink(medication.nhsLink || '');
    setTrendLinks(medication.trendLinks);
    setSickDaysNeeded(Boolean(medication.sickDaysNeeded));
    setReviewMonths(medication.reviewMonths || 12);
    setContentReviewDate(medication.contentReviewDate || '');
    setEditingCode(medication.code);
    setRequestedCode(medication.code);
    setHasContent(true);
    setSavedCode('');
    setSavedAction('updated');
    setSaveError('');
    setGenError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const duplicateMedication = (medication: MedicationRecord) => {
    const friendlyName = getFriendlyMedicationName(medication);
    const duplicateTitle = medication.title.includes(' - ')
      ? medication.title.replace(friendlyName, `${friendlyName} Copy`)
      : `${medication.title} Copy`;

    setMedName(`${friendlyName} Copy`);
    setMedType(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setTitle(duplicateTitle);
    setDescription(medication.description);
    setBadge(medication.badge === 'REAUTH' ? 'REAUTH' : 'NEW');
    setCategory(medication.category);
    setKeyInfo(medication.keyInfo.length > 0 ? medication.keyInfo : ['']);
    setNhsLink(medication.nhsLink || '');
    setTrendLinks(medication.trendLinks);
    setSickDaysNeeded(Boolean(medication.sickDaysNeeded));
    setReviewMonths(medication.reviewMonths || 12);
    setContentReviewDate(medication.contentReviewDate || '');
    setEditingCode('');
    setRequestedCode('');
    setHasContent(true);
    setSavedCode('');
    setSavedAction('created');
    setSaveError('');
    setGenError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sourceLabel = (medication: MedicationRecord) => {
    if (medication.source === 'built-in') return 'Built in';
    if (medication.source === 'override') return 'Built-in override';
    return 'Custom';
  };

  const buildPatientUrl = (params: URLSearchParams) =>
    `${window.location.origin}${resolvePath('/patient')}?${params.toString()}`;

  const copyText = async (value: string) => {
    await navigator.clipboard.writeText(value);
  };

  const healthCheckPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({ type: 'healthcheck' });
    (Object.entries(healthCheckSelections) as Array<[HealthCheckCodeFamily, string]>).forEach(([family, code]) => {
      if (!code) return;
      params.set(HEALTH_CHECK_PARAM_KEYS[family], code);
    });
    if (healthCheckLocalSupportName.trim()) params.set('localName', healthCheckLocalSupportName.trim());
    if (healthCheckLocalSupportPhone.trim()) params.set('localPhone', healthCheckLocalSupportPhone.trim());
    if (healthCheckLocalSupportEmail.trim()) params.set('localEmail', healthCheckLocalSupportEmail.trim());
    if (healthCheckLocalSupportWebsite.trim()) params.set('localWebsite', healthCheckLocalSupportWebsite.trim());
    return buildPatientUrl(params);
  }, [
    healthCheckLocalSupportEmail,
    healthCheckLocalSupportName,
    healthCheckLocalSupportPhone,
    healthCheckLocalSupportWebsite,
    healthCheckSelections,
  ]);

  const screeningPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({ type: 'screening', screen: screeningType });
    return buildPatientUrl(params);
  }, [screeningType]);

  const immunisationPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({ type: 'imms' });
    if (immunisationSelections.length > 0) {
      params.set('vaccine', immunisationSelections.join(','));
    }
    if (localSupportName.trim()) {
      params.set('localName', localSupportName.trim());
    }
    if (localSupportPhone.trim()) {
      params.set('localPhone', localSupportPhone.trim());
    }
    if (localSupportEmail.trim()) {
      params.set('localEmail', localSupportEmail.trim());
    }
    if (localSupportWebsite.trim()) {
      params.set('localWebsite', localSupportWebsite.trim());
    }
    return buildPatientUrl(params);
  }, [immunisationSelections, localSupportEmail, localSupportName, localSupportPhone, localSupportWebsite]);

  const longTermConditionPreviewUrl = useMemo(() => {
    const params = new URLSearchParams({ type: 'ltc', ltc: selectedLongTermCondition });
    return buildPatientUrl(params);
  }, [selectedLongTermCondition]);

  const buildHealthCheckVariantPreviewUrl = (domainId: ClinicalDomainId, resultCode: string) => {
    const params = new URLSearchParams({ type: 'healthcheck' });
    const family = domainId === 'ldl' ? 'chol' : domainId;
    const key = HEALTH_CHECK_PARAM_KEYS[family as HealthCheckCodeFamily];
    params.set(key, resultCode);
    if (healthCheckLocalSupportName.trim()) params.set('localName', healthCheckLocalSupportName.trim());
    if (healthCheckLocalSupportPhone.trim()) params.set('localPhone', healthCheckLocalSupportPhone.trim());
    if (healthCheckLocalSupportEmail.trim()) params.set('localEmail', healthCheckLocalSupportEmail.trim());
    if (healthCheckLocalSupportWebsite.trim()) params.set('localWebsite', healthCheckLocalSupportWebsite.trim());
    return buildPatientUrl(params);
  };

  const healthCheckCatalogueRows = CLINICAL_DOMAIN_IDS.flatMap((domainId) => {
    const metricByCode = PREVIEW_DOMAIN_CONFIGS[domainId].metricByCode;
    return Object.keys(metricByCode).map((resultCode) => ({
      id: `${domainId}:${resultCode}`,
      domainId,
      resultCode,
      label: HEALTH_CHECK_CARD_LABELS[(domainId === 'ldl' ? 'chol' : domainId) as HealthCheckCodeFamily] || PREVIEW_DOMAIN_CONFIGS[domainId].heading,
      summary: (healthCheckBuilderConfigs[domainId]?.[resultCode]?.resultsMessage || metricByCode[resultCode].pathway || '').trim(),
      previewUrl: buildHealthCheckVariantPreviewUrl(domainId, resultCode),
    }));
  });

  const toggleImmunisation = (value: string) => {
    setImmunisationSelections((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const selectedHealthCheckDomainConfig = PREVIEW_DOMAIN_CONFIGS[selectedHealthCheckDomain];
  const selectedHealthCheckDomainCodes = Object.keys(selectedHealthCheckDomainConfig.metricByCode);
  const resolvedSelectedHealthCheckVariantCode = selectedHealthCheckDomainCodes.includes(selectedHealthCheckVariantCode)
    ? selectedHealthCheckVariantCode
    : (selectedHealthCheckDomainCodes[0] || '');
  const defaultHealthCheckConfigs = createDefaultHealthCheckBuilderState();
  const selectedHealthCheckVariant =
    healthCheckBuilderConfigs[selectedHealthCheckDomain]?.[resolvedSelectedHealthCheckVariantCode] ||
    defaultHealthCheckConfigs[selectedHealthCheckDomain][resolvedSelectedHealthCheckVariantCode];
  const selectedHealthCheckMetric =
    selectedHealthCheckDomainConfig.metricByCode[resolvedSelectedHealthCheckVariantCode] || selectedHealthCheckDomainConfig.defaultMetric;
  const selectedHealthCheckVariantSafe: HealthCheckBuilderVariant =
    selectedHealthCheckVariant || {
      resultCode: resolvedSelectedHealthCheckVariantCode,
      resultsMessage: selectedHealthCheckMetric.pathway || '',
      importantText: '',
      whatIsTitle: selectedHealthCheckDomainConfig.whatIsTitle,
      whatIsText: selectedHealthCheckDomainConfig.whatIsText,
      nextStepsTitle: selectedHealthCheckDomainConfig.defaultNextStepsTitle,
      nextStepsText: selectedHealthCheckDomainConfig.defaultNextStepsText,
      links: [],
    };
  const selectedScreeningTemplate = SCREENING_TEMPLATES[screeningType] || SCREENING_TEMPLATES.cervical;
  const selectedImmunisationTemplates = (immunisationSelections.length > 0 ? immunisationSelections : ['flu'])
    .map((value) => IMMUNISATION_TEMPLATES[value])
    .filter((template): template is (typeof IMMUNISATION_TEMPLATES)[keyof typeof IMMUNISATION_TEMPLATES] => Boolean(template));
  const selectedLongTermConditionTemplate =
    LONG_TERM_CONDITION_TEMPLATES[selectedLongTermCondition] || LONG_TERM_CONDITION_TEMPLATES.asthma;
  const healthCheckLocalSupportLink: HealthCheckBuilderLink | null =
    (healthCheckLocalSupportPhone.trim() || healthCheckLocalSupportEmail.trim() || healthCheckLocalSupportWebsite.trim())
      ? {
          title: healthCheckLocalSupportName.trim() || 'Local support',
          showTitleOnCard: true,
          phone: healthCheckLocalSupportPhone.trim(),
          phoneLabel: 'Call',
          email: healthCheckLocalSupportEmail.trim(),
          emailLabel: 'Email',
          website: healthCheckLocalSupportWebsite.trim(),
          websiteLabel: 'Website',
        }
      : null;

  const updateHealthCheckVariant = (domainId: ClinicalDomainId, resultCode: string, patch: Partial<HealthCheckBuilderVariant>) => {
    const fallbackVariant = defaultHealthCheckConfigs[domainId][resultCode];
    setHealthCheckBuilderConfigs((current) => ({
      ...current,
      [domainId]: {
        ...current[domainId],
        [resultCode]: {
          ...(current[domainId]?.[resultCode] || fallbackVariant),
          ...patch,
        },
      },
    }));
  };

  const updateHealthCheckLink = (index: number, field: keyof HealthCheckBuilderLink, value: string | boolean) => {
    const links = [...selectedHealthCheckVariantSafe.links];
    const existing = links[index] || {
      title: '',
      showTitleOnCard: true,
      phone: '',
      phoneLabel: '',
      email: '',
      emailLabel: '',
      website: '',
      websiteLabel: '',
    };
    links[index] = {
      ...existing,
      [field]: value,
    };
    updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, { links });
  };

  const addHealthCheckLink = () => {
    updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, {
      links: [
        ...selectedHealthCheckVariantSafe.links,
        {
          title: '',
          showTitleOnCard: true,
          phone: '',
          phoneLabel: '',
          email: '',
          emailLabel: '',
          website: '',
          websiteLabel: '',
        },
      ],
    });
  };

  const removeHealthCheckLink = (index: number) => {
    updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, {
      links: selectedHealthCheckVariantSafe.links.filter((_, linkIndex) => linkIndex !== index),
    });
  };

  const handleGenerate = async () => {
    if (!medName.trim()) return;
    setGenerating(true);
    setGenError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('generate-medication-content', {
        body: { medicationName: medName.trim(), type: medType },
      });
      if (invokeError) throw invokeError;

      if (data.success && data.content) {
        const c = data.content;
        setTitle((c.title as string) || medName);
        setDescription((c.description as string) || '');
        setBadge(medType);
        setCategory((c.category as string) || '');
        setKeyInfo((c.keyInfo as string[]) || ['']);
        setNhsLink((c.nhsLink as string) || '');
        setSickDaysNeeded((c.sickDaysNeeded as boolean) || false);
        setReviewMonths((c.reviewMonths as number) || 12);
        
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + 12);
        setContentReviewDate(targetDate.toISOString().slice(0, 10));

        setTrendLinks((c.trendLinks as TrendLink[]) || []);
        setHasContent(true);
        setSavedCode('');
        setRequestedCode('');
      }
    } catch (err) {
      console.error('Generation error:', err);
      const message = await getFunctionErrorMessage(err, 'AI generation failed.');
      setGenError(message);
      // Still show the editor so they can fill manually
      setTitle(medName);
      setBadge(medType);
      setKeyInfo(['']);
      setHasContent(true);
      setRequestedCode('');
    }
    setGenerating(false);
  };

  const handleSave = async () => {
    if (!title.trim() || !description.trim() || !category.trim()) {
      setSaveError('Title, description, and category are required.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('save-medication', {
        body: {
          code: editingCode || undefined,
          requestedCode: requestedCode.trim() || undefined,
          medicationName: medName.trim() || title.trim(),
          title: title.trim(),
          description: description.trim(),
          badge,
          category: category.trim(),
          keyInfo: keyInfo.filter(k => k.trim()),
          nhsLink: nhsLink.trim(),
          trendLinks: trendLinks.filter(l => l.title.trim() && l.url.trim()),
          sickDaysNeeded,
          reviewMonths,
          contentReviewDate,
        },
      });
      if (invokeError) throw invokeError;
      if (data.success) {
        setSavedAction(editingCode ? 'updated' : 'created');
        setSavedCode(data.code);
        await reloadMeds();
      }
    } catch (err) {
      console.error('Save error:', err);
      const message = await getFunctionErrorMessage(err, 'Failed to save medication. Please try again.');
      setSaveError(message);
    }
    setSaving(false);
  };

  const handleDelete = (medication: MedicationRecord) => {
    const isBuiltIn = medication.isBuiltIn;
    const deleteTitle = isBuiltIn ? 'Hide Medication?' : 'Delete Medication?';
    const deleteMessage = isBuiltIn
      ? `Hide medication ${medication.code}? It will be removed from the app until you restore it in the database.`
      : `Delete medication ${medication.code}? This cannot be undone from the builder.`;

    setConfirmDialog({
      title: deleteTitle,
      message: deleteMessage,
      confirmLabel: isBuiltIn ? 'Hide' : 'Delete',
      isDangerous: true,
      onConfirm: async () => {
        setDeletingCode(medication.code);
        try {
          const { error: delError } = await supabase.functions.invoke('delete-medication', {
            body: { code: medication.code },
          });
          if (delError) throw delError;
          await reloadMeds();
          if (editingCode === medication.code) {
            resetForm();
          }
        } catch {
          console.error('Delete error');
        }
        setDeletingCode('');
        setConfirmDialog(null);
      },
    });
  };

  const updateKeyInfo = (index: number, value: string) => {
    const updated = [...keyInfo];
    updated[index] = value;
    setKeyInfo(updated);
  };

  const addKeyInfo = () => setKeyInfo([...keyInfo, '']);
  const removeKeyInfo = (index: number) => setKeyInfo(keyInfo.filter((_, i) => i !== index));

  const updateTrendLink = (index: number, field: 'title' | 'url', value: string) => {
    const updated = [...trendLinks];
    updated[index] = { ...updated[index], [field]: value };
    setTrendLinks(updated);
  };

  const addTrendLink = () => setTrendLinks([...trendLinks, { title: '', url: '' }]);
  const removeTrendLink = (index: number) => setTrendLinks(trendLinks.filter((_, i) => i !== index));

  const resetForm = () => {
    setMedName('');
    setMedType('NEW');
    setTitle('');
    setDescription('');
    setBadge('NEW');
    setCategory('');
    setKeyInfo(['']);
    setNhsLink('');
    setTrendLinks([]);
    setSickDaysNeeded(false);
    setReviewMonths(12);
    setContentReviewDate('');
    setHasContent(false);
    setEditingCode('');
    setRequestedCode('');
    setSavedCode('');
    setSavedAction('created');
    setSaveError('');
    setGenError('');
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const showBuilderNotice = (type: OutputBuilderType, message: string) => {
    setBuilderNotice({ type, message });
    window.setTimeout(() => {
      setBuilderNotice((current) => (current?.type === type ? null : current));
    }, 2200);
  };

  const openPreview = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const saveHealthCheckTemplate = () => {
    window.localStorage.setItem(
      BUILDER_STORAGE_KEYS.healthcheck,
      JSON.stringify({
        selectedDomain: selectedHealthCheckDomain,
        selectedCode: resolvedSelectedHealthCheckVariantCode,
        configs: healthCheckBuilderConfigs,
        localSupportName: healthCheckLocalSupportName.trim(),
        localSupportPhone: healthCheckLocalSupportPhone.trim(),
        localSupportEmail: healthCheckLocalSupportEmail.trim(),
        localSupportWebsite: healthCheckLocalSupportWebsite.trim(),
      }),
    );
    showBuilderNotice('healthcheck', 'Health check template saved.');
  };

  const resetHealthCheckTemplate = () => {
    setHealthCheckBuilderConfigs(createDefaultHealthCheckBuilderState());
    setSelectedHealthCheckDomain('bp');
    setSelectedHealthCheckVariantCode('BPNORMAL');
    setHealthCheckLocalSupportName('');
    setHealthCheckLocalSupportPhone('');
    setHealthCheckLocalSupportEmail('');
    setHealthCheckLocalSupportWebsite('');
    showBuilderNotice('healthcheck', 'Health check template reset.');
  };

  const saveScreeningTemplate = () => {
    window.localStorage.setItem(BUILDER_STORAGE_KEYS.screening, JSON.stringify({ screeningType }));
    showBuilderNotice('screening', 'Screening template saved.');
  };

  const resetScreeningTemplate = () => {
    setScreeningType('cervical');
    showBuilderNotice('screening', 'Screening template reset.');
  };

  const saveImmunisationTemplate = () => {
    window.localStorage.setItem(
      BUILDER_STORAGE_KEYS.immunisation,
      JSON.stringify({
        immunisationSelections,
        localSupportName: localSupportName.trim(),
        localSupportPhone: localSupportPhone.trim(),
        localSupportEmail: localSupportEmail.trim(),
        localSupportWebsite: localSupportWebsite.trim(),
      }),
    );
    showBuilderNotice('immunisation', 'Immunisation template saved.');
  };

  const resetImmunisationTemplate = () => {
    setImmunisationSelections(['flu']);
    setLocalSupportName('');
    setLocalSupportPhone('');
    setLocalSupportEmail('');
    setLocalSupportWebsite('');
    showBuilderNotice('immunisation', 'Immunisation template reset.');
  };

  const saveLtcTemplate = () => {
    window.localStorage.setItem(BUILDER_STORAGE_KEYS.ltc, JSON.stringify({ selectedLongTermCondition }));
    showBuilderNotice('ltc', 'Long term condition template saved.');
  };

  const resetLtcTemplate = () => {
    setSelectedLongTermCondition('asthma');
    showBuilderNotice('ltc', 'Long term condition template reset.');
  };

  if (!authenticated) return null;

  // Success screen after saving
  if (savedCode) {
    return (
      <>
        {confirmDialog && (
          <ConfirmDialog
            title={confirmDialog.title}
            message={confirmDialog.message}
            confirmLabel={confirmDialog.confirmLabel}
            isDangerous={confirmDialog.isDangerous}
            onConfirm={confirmDialog.onConfirm}
            onCancel={() => setConfirmDialog(null)}
          />
        )}
      <div className="dashboard-shell" style={{ maxWidth: '700px' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <CheckCircle size={64} color="#007f3b" style={{ marginBottom: '1rem' }} />
          <h1 style={{ fontSize: '1.5rem', color: '#007f3b' }}>
            Card {savedAction === 'created' ? 'Created' : 'Updated'}
          </h1>
          <p style={{ color: '#4c6272', marginBottom: '1.5rem' }}>
            <strong>{title}</strong> has been {savedAction === 'created' ? 'created' : 'updated'} successfully.
          </p>

          <div style={{
            padding: '1.5rem', background: '#eef7ff', borderRadius: '12px',
            border: '2px solid #005eb8', marginBottom: '1.5rem',
          }}>
            <div style={{ fontSize: '0.85rem', color: '#4c6272', marginBottom: '0.5rem' }}>Medication Card Code</div>
            <div style={{
              fontSize: '3rem', fontWeight: 800, color: '#005eb8',
              fontFamily: 'monospace', letterSpacing: '0.1em',
            }}>
              {savedCode}
            </div>
            <button
              onClick={() => copyCode(savedCode)}
              className="action-button"
              style={{ marginTop: '1rem', backgroundColor: '#005eb8' }}
            >
              <Copy size={16} /> Copy Code
            </button>
          </div>

          <div style={{
            padding: '1rem', background: '#fff9c4', borderRadius: '8px',
            fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'left',
          }}>
            <strong>Add to SystmOne Protocol:</strong>
            <br />
            Add code <strong>{savedCode}</strong> to your medication protocol output.
            When included in the URL as <code>codes=...{savedCode}</code>, patients will see this medication information.
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button onClick={resetForm} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Plus size={16} /> Create Another
            </button>
            <button onClick={() => navigate(resolvePath('/admin/dashboard'))} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              <ArrowLeft size={16} /> Back to Dashboard
            </button>
          </div>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDangerous={confirmDialog.isDangerous}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    <div className="dashboard-shell">
      {previewMed && <MedicationPreviewModal med={previewMed} onClose={() => setPreviewMed(null)} />}

      <div className="dashboard-header">
        <div className="dashboard-header-copy" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
        <button
          onClick={() => navigate(resolvePath('/admin/dashboard'))}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#005eb8', display: 'flex' }}
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.75rem', margin: 0 }}>Card Builder</h1>
          <p style={{ margin: '0.25rem 0 0' }}>
            Manage the patient-facing outputs delivered through MyMedInfo, including medication information and health-check journeys.
          </p>
        </div>
      </div>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Builder Mode</h2>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {([
            ['medication', 'Medication'],
            ['healthcheck', 'Health Checks'],
            ['screening', 'Screening'],
            ['immunisation', 'Immunisation'],
            ['ltc', 'Long Term Conditions'],
          ] as Array<[OutputBuilderType, string]>).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setSelectedOutputType(value)}
              className="action-button"
              style={{
                backgroundColor: selectedOutputType === value ? '#005eb8' : '#eef7ff',
                color: selectedOutputType === value ? '#ffffff' : '#005eb8',
                border: selectedOutputType === value ? 'none' : '1px solid #005eb8',
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Step 1: Search and Generate */}
      {selectedOutputType === 'medication' && (
      <>
      <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
          1. {editingCode ? `Editing Medication Card ${editingCode}` : 'Medication Card'}
        </h2>
        <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
          Create or update medication outputs here. Health checks and other patient pathways use the same platform, but their content is currently configured through dedicated route parameters and views.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={medName}
            onChange={e => setMedName(e.target.value)}
                placeholder="Enter medication name (e.g. Metformin, Atorvastatin)"
            style={{
              flex: '1 1 200px', padding: '0.75rem', border: '2px solid #d8dde0',
              borderRadius: '8px', fontSize: '1rem', boxSizing: 'border-box',
            }}
            onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          />
          <select
            value={medType}
            onChange={e => setMedType(e.target.value as 'NEW' | 'REAUTH')}
            style={{
              flex: '1 1 120px', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px',
              fontSize: '0.95rem', background: 'white',
            }}
          >
            <option value="NEW">New Prescription</option>
            <option value="REAUTH">Reauthorisation</option>
          </select>
          <button
            onClick={handleGenerate}
            disabled={generating || !medName.trim()}
            className="action-button"
            style={{ flex: '1 1 auto', backgroundColor: '#005eb8', opacity: generating || !medName.trim() ? 0.6 : 1, justifyContent: 'center' }}
          >
            <Sparkles size={16} /> {generating ? 'Generating...' : 'Generate with AI'}
          </button>
        </div>
        {genError && (
          <div style={{ padding: '0.5rem 0.75rem', background: '#fff9c4', color: '#7a6200', borderRadius: '6px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} /> {genError}
          </div>
        )}
      </div>

      {/* Step 2: Editor */}
      {hasContent && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #007f3b' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>
            2. {editingCode ? `Edit Medication Card ${editingCode}` : 'Edit Medication Card Content'}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Title *</label>
              <input
                type="text" value={title} onChange={e => setTitle(e.target.value)}
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Description *</label>
              <textarea
                value={description} onChange={e => setDescription(e.target.value)} rows={3}
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Category *</label>
                <input
                  type="text" value={category} onChange={e => setCategory(e.target.value)}
                  placeholder="e.g. Diabetes, Cardiovascular"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Type</label>
                <select
                  value={badge} onChange={e => setBadge(e.target.value as 'NEW' | 'REAUTH')}
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', background: 'white' }}
                >
                  <option value="NEW">New Medication</option>
                  <option value="REAUTH">Reauthorisation</option>
                </select>
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Code</label>
                <input
                  type="text"
                  value={requestedCode}
                  onChange={e => setRequestedCode(e.target.value.replace(/[^\d]/g, '').slice(0, 3))}
                  placeholder={badge === 'REAUTH' ? 'e.g. 602' : 'e.g. 601'}
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Review Period (months)</label>
                <input
                  type="number"
                  value={reviewMonths}
                  onChange={e => setReviewMonths(Math.max(1, parseInt(e.target.value) || 12))}
                  min="1"
                  max="60"
                  placeholder="e.g. 12"
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 150px', minWidth: '150px' }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Content Review Date</label>
                <input
                  type="date"
                  value={contentReviewDate}
                  onChange={e => setContentReviewDate(e.target.value)}
                  style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ flex: '1 1 auto', display: 'flex', alignItems: 'end', paddingBottom: '0.2rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 600 }}>
                  <input
                    type="checkbox" checked={sickDaysNeeded} onChange={e => setSickDaysNeeded(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  Sick Day Rules
                </label>
              </div>
            </div>

            <p style={{ fontSize: '0.82rem', color: '#4c6272', margin: '-0.25rem 0 0' }}>
              Leave the code blank to auto-pair with an existing family where possible, for example `601` and `602`. Enter a code manually if you need to override it.
            </p>

            {/* Key Information */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem' }}>Key Information Points</label>
                <button onClick={addKeyInfo} style={{ background: 'none', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={14} /> Add Point
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {keyInfo.map((info, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text" value={info} onChange={e => updateKeyInfo(i, e.target.value)}
                      placeholder={`Key point ${i + 1}`}
                      style={{ flex: 1, padding: '0.5rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    {keyInfo.length > 1 && (
                      <button onClick={() => removeKeyInfo(i)} style={{ background: '#fde8e8', border: 'none', color: '#d5281b', borderRadius: '6px', padding: '0.5rem', cursor: 'pointer' }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* NHS Link */}
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ExternalLink size={14} /> NHS Link</span>
              </label>
              <input
                type="url" value={nhsLink} onChange={e => setNhsLink(e.target.value)}
                placeholder="https://www.nhs.uk/medicines/..."
                style={{ width: '100%', padding: '0.6rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>

            {/* Resource Links */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Link size={14} /> Resource Links (leaflets, PDFs)
                </label>
                <button onClick={addTrendLink} style={{ background: 'none', border: '1px solid #007f3b', color: '#007f3b', borderRadius: '6px', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <Plus size={14} /> Add Link
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {trendLinks.map((link, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text" value={link.title} onChange={e => updateTrendLink(i, 'title', e.target.value)}
                      placeholder="Link title"
                      style={{ flex: 1, padding: '0.5rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <input
                      type="url" value={link.url} onChange={e => updateTrendLink(i, 'url', e.target.value)}
                      placeholder="https://... (direct PDF link)"
                      style={{ flex: 2, padding: '0.5rem', border: '2px solid #d8dde0', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }}
                    />
                    <button onClick={() => removeTrendLink(i)} style={{ background: '#fde8e8', border: 'none', color: '#d5281b', borderRadius: '6px', padding: '0.5rem', cursor: 'pointer' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {trendLinks.length === 0 && (
                  <p style={{ fontSize: '0.8rem', color: '#4c6272', margin: 0 }}>No resource links added yet. Click "Add Link" to add PDF leaflets or external resources.</p>
                )}
              </div>
            </div>
          </div>

          {saveError && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#fde8e8', color: '#d5281b', borderRadius: '6px', marginTop: '1rem', fontSize: '0.85rem' }}>
              {saveError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
            <button
              onClick={() => previewDraft && setPreviewMed(previewDraft)}
              disabled={!previewDraft || !previewDraft.description || previewDraft.keyInfo.length === 0}
              className="action-button"
              style={{ flex: '1 1 auto', justifyContent: 'center', backgroundColor: '#005eb8', opacity: !previewDraft || !previewDraft.description || previewDraft.keyInfo.length === 0 ? 0.6 : 1 }}
            >
              <Eye size={16} /> Preview
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="action-button"
              style={{ flex: '1 1 auto', justifyContent: 'center', backgroundColor: '#007f3b', opacity: saving ? 0.6 : 1 }}
            >
              <Save size={16} /> {saving ? 'Saving...' : editingCode ? 'Save Changes' : 'Save'}
            </button>
            <button onClick={resetForm} className="action-button" style={{ flex: '1 1 auto', justifyContent: 'center', backgroundColor: '#4c6272' }}>
              {editingCode ? 'Cancel Edit' : 'Reset'}
            </button>
          </div>
        </div>
      )}

      {/* Existing medications */}
      <div className="card">
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>3. Medication Catalogue</h2>
        {loadingMeds ? (
          <p style={{ color: '#4c6272' }}>Loading...</p>
        ) : existingMeds.length === 0 ? (
          <p style={{ color: '#4c6272' }}>No medications available. Use the search above to create your first one.</p>
        ) : (
          <div className="dashboard-list">
            {existingMeds.map(med => (
              <div
                key={med.code}
                className="dashboard-list-card"
              >
                <div style={{
                  padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.85rem',
                  fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white',
                  minWidth: '40px', textAlign: 'center',
                }}>
                  {med.code}
                </div>
                <div className="dashboard-list-main">
                  <div className="dashboard-list-title">{med.title}</div>
                  <div className="dashboard-meta" style={{ marginTop: '0.15rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#4c6272' }}>{med.category}</span>
                    <span style={{
                      padding: '0 0.4rem', borderRadius: '3px', fontSize: '0.7rem', fontWeight: 700,
                      background: med.badge === 'NEW' ? '#005eb8' : med.badge === 'REAUTH' ? '#007f3b' : '#4c6272',
                      color: 'white',
                    }}>
                      {med.badge}
                    </span>
                    <span className={`dashboard-badge ${med.source === 'custom' ? 'dashboard-badge--amber' : med.source === 'override' ? 'dashboard-badge--purple' : 'dashboard-badge--muted'}`}>
                      {sourceLabel(med)}
                    </span>
                    <span className="dashboard-badge dashboard-badge--blue">
                      Review: {med.reviewMonths || 12}mo
                    </span>
                    <span className={`dashboard-badge ${
                      !med.contentReviewDate ? 'dashboard-badge--muted' :
                      new Date(`${med.contentReviewDate}T00:00:00`).getTime() < Date.now() ? 'dashboard-badge--red' :
                      new Date(`${med.contentReviewDate}T00:00:00`).getTime() < Date.now() + 30 * 24 * 60 * 60 * 1000 ? 'dashboard-badge--amber' :
                      'dashboard-badge--green'
                    }`}>
                      {med.contentReviewDate ? `Content review: ${med.contentReviewDate}` : 'No review set'}
                    </span>
                  </div>
                </div>
                <div className="dashboard-list-actions">
                  <button
                    onClick={() => setPreviewMed(med)}
                    title="Preview patient view"
                    className="action-button-sm"
                    style={{
                      background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <Eye size={14} /> Preview
                  </button>
                  <button
                    onClick={() => startEditingMedication(med)}
                    title="Edit medication"
                    className="action-button-sm"
                    style={{
                      background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <Edit2 size={14} /> Edit
                  </button>
                  <button
                    onClick={() => duplicateMedication(med)}
                    title="Duplicate medication"
                    className="action-button-sm"
                    style={{
                      background: '#f3f8f1', border: '1px solid #007f3b', color: '#007f3b',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <CopyPlus size={14} /> Duplicate
                  </button>
                  <button
                    onClick={() => copyCode(med.code)}
                    title="Copy SystmOne code"
                    className="action-button-sm"
                    style={{
                      background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8',
                      borderRadius: '6px', padding: '0.4rem 0.6rem', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem',
                      justifyContent: 'center'
                    }}
                  >
                    <Copy size={14} /> Copy
                  </button>
                  <button
                    onClick={() => handleDelete(med)}
                    disabled={deletingCode === med.code}
                    className="action-button-sm"
                    style={{
                      background: '#fde8e8', border: 'none', color: '#d5281b',
                      borderRadius: '6px', padding: '0.4rem', cursor: 'pointer', display: 'flex',
                      justifyContent: 'center'
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </>
      )}

      {selectedOutputType === 'healthcheck' && (
        <>
          <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. NHS Health Check Card Builder</h2>
            <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
              Build each health check card variation separately. Every result type can carry its own explanation, follow-up guidance, and a mix of national NHS links and local support links.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            </div>
            <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid #d8dde0', background: '#f8fbfd' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#005eb8' }}>Local support details (optional)</div>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                <input
                  type="text"
                  value={healthCheckLocalSupportName}
                  onChange={(e) => setHealthCheckLocalSupportName(e.target.value)}
                  placeholder="Service name (e.g. Practice health coach)"
                  style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                <input
                  type="text"
                  value={healthCheckLocalSupportPhone}
                  onChange={(e) => setHealthCheckLocalSupportPhone(e.target.value)}
                  placeholder="Phone number"
                  style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                <input
                  type="email"
                  value={healthCheckLocalSupportEmail}
                  onChange={(e) => setHealthCheckLocalSupportEmail(e.target.value)}
                  placeholder="Email address"
                  style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
                <input
                  type="url"
                  value={healthCheckLocalSupportWebsite}
                  onChange={(e) => setHealthCheckLocalSupportWebsite(e.target.value)}
                  placeholder="Website URL"
                  style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(260px, 320px) minmax(0, 1fr)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ border: '1px solid #d8dde0', borderRadius: '10px', padding: '1rem', background: '#f8fbfd' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#005eb8' }}>1. Choose section</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {CLINICAL_DOMAIN_IDS.map((domainId) => (
                      <button
                        key={domainId}
                        type="button"
                        onClick={() => {
                          const nextCodes = Object.keys(PREVIEW_DOMAIN_CONFIGS[domainId].metricByCode);
                          setSelectedHealthCheckDomain(domainId);
                          setSelectedHealthCheckVariantCode(nextCodes[0] || '');
                        }}
                        style={{
                          textAlign: 'left',
                          padding: '0.75rem 0.85rem',
                          borderRadius: '8px',
                          border: selectedHealthCheckDomain === domainId ? '2px solid #005eb8' : '1px solid #d8dde0',
                          background: selectedHealthCheckDomain === domainId ? '#eef7ff' : '#ffffff',
                          cursor: 'pointer',
                          color: '#1d2a33',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{HEALTH_CHECK_CARD_LABELS[domainId as HealthCheckCodeFamily] || PREVIEW_DOMAIN_CONFIGS[domainId].heading}</div>
                        <div style={{ fontSize: '0.82rem', color: '#4c6272', marginTop: '0.2rem' }}>
                          {Object.keys(PREVIEW_DOMAIN_CONFIGS[domainId].metricByCode).length} result type{Object.keys(PREVIEW_DOMAIN_CONFIGS[domainId].metricByCode).length === 1 ? '' : 's'}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ border: '1px solid #d8dde0', borderRadius: '10px', padding: '1rem', background: '#f8fbfd' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#005eb8' }}>2. Choose result type</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.keys(selectedHealthCheckDomainConfig.metricByCode).map((resultCode) => (
                      <button
                        key={resultCode}
                        type="button"
                        onClick={() => setSelectedHealthCheckVariantCode(resultCode)}
                        style={{
                          textAlign: 'left',
                          padding: '0.75rem 0.85rem',
                          borderRadius: '8px',
                          border: resolvedSelectedHealthCheckVariantCode === resultCode ? '2px solid #005eb8' : '1px solid #d8dde0',
                          background: resolvedSelectedHealthCheckVariantCode === resultCode ? '#eef7ff' : '#ffffff',
                          cursor: 'pointer',
                          color: '#1d2a33',
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>{resultCode}</div>
                        <div style={{ fontSize: '0.82rem', color: '#4c6272', marginTop: '0.2rem' }}>
                          {selectedHealthCheckDomainConfig.metricByCode[resultCode].pathway}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '1rem', background: '#f8fbfd', borderRadius: '10px', border: '1px solid #d8dde0' }}>
                  <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>3. Preview Link</div>
                  <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1d2a33', marginBottom: '0.75rem' }}>{healthCheckPreviewUrl}</code>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={() => copyText(healthCheckPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
                      <Copy size={16} /> Copy Preview Link
                    </button>
                    <a href={healthCheckPreviewUrl} target="_blank" rel="noreferrer" className="action-button" style={{ backgroundColor: '#007f3b', textDecoration: 'none' }}>
                      <ExternalLink size={16} /> Open Preview
                    </a>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="card" style={{ margin: 0, borderLeft: '4px solid #007f3b' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '0.35rem' }}>{selectedHealthCheckDomainConfig.heading}</h3>
                  <p style={{ margin: '0 0 1rem', color: '#4c6272' }}>{selectedHealthCheckDomainConfig.subheading}</p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>What does this result mean?</label>
                      <textarea
                        value={selectedHealthCheckVariantSafe.resultsMessage}
                        onChange={(e) => updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, { resultsMessage: e.target.value })}
                        rows={4}
                        style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Important message</label>
                      <textarea
                        value={selectedHealthCheckVariantSafe.importantText}
                        onChange={(e) => updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, { importantText: e.target.value })}
                        rows={3}
                        placeholder="Optional urgent or safeguarding guidance shown in the Important box."
                        style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>What is this? title</label>
                        <input
                          type="text"
                          value={selectedHealthCheckVariantSafe.whatIsTitle}
                          onChange={(e) => updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, { whatIsTitle: e.target.value })}
                          style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Next steps title</label>
                        <input
                          type="text"
                          value={selectedHealthCheckVariantSafe.nextStepsTitle}
                          onChange={(e) => updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, { nextStepsTitle: e.target.value })}
                          style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>What is this? body</label>
                      <textarea
                        value={selectedHealthCheckVariantSafe.whatIsText}
                        onChange={(e) => updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, { whatIsText: e.target.value })}
                        rows={4}
                        style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Next steps guidance</label>
                      <textarea
                        value={selectedHealthCheckVariantSafe.nextStepsText}
                        onChange={(e) => updateHealthCheckVariant(selectedHealthCheckDomain, resolvedSelectedHealthCheckVariantCode, { nextStepsText: e.target.value })}
                        rows={4}
                        style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>Resource and Support Links</h3>
                      <p style={{ margin: '0.35rem 0 0', color: '#4c6272' }}>Add national NHS links and local support contacts. These are shown inside the card’s next-steps section.</p>
                    </div>
                    <button onClick={addHealthCheckLink} className="action-button" style={{ backgroundColor: '#005eb8' }}>
                      <Plus size={16} /> Add Link
                    </button>
                  </div>

                  {selectedHealthCheckVariantSafe.links.length === 0 ? (
                    <p style={{ color: '#4c6272', margin: 0 }}>No links added yet for this result type.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {selectedHealthCheckVariantSafe.links.map((link, index) => (
                        <div key={index} style={{ border: '1px solid #d8dde0', borderRadius: '10px', padding: '1rem', background: '#f8fbfd' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <strong>Link {index + 1}</strong>
                            <button onClick={() => removeHealthCheckLink(index)} style={{ background: '#fde8e8', border: 'none', color: '#d5281b', borderRadius: '6px', padding: '0.45rem', cursor: 'pointer' }}>
                              <Trash2 size={14} />
                            </button>
                          </div>

                          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                            <div>
                              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}>Card title</label>
                              <input
                                type="text"
                                value={link.title || ''}
                                onChange={(e) => updateHealthCheckLink(index, 'title', e.target.value)}
                                style={{ width: '100%', padding: '0.65rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'end' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem' }}>
                                <input
                                  type="checkbox"
                                  checked={link.showTitleOnCard !== false}
                                  onChange={(e) => updateHealthCheckLink(index, 'showTitleOnCard', e.target.checked)}
                                />
                                Show title on card
                              </label>
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: '0.75rem' }}>
                            <div>
                              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Phone size={14} /> Phone</span></label>
                              <input
                                type="text"
                                value={link.phone || ''}
                                onChange={(e) => updateHealthCheckLink(index, 'phone', e.target.value)}
                                style={{ width: '100%', padding: '0.65rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}>Phone label</label>
                              <input
                                type="text"
                                value={link.phoneLabel || ''}
                                onChange={(e) => updateHealthCheckLink(index, 'phoneLabel', e.target.value)}
                                placeholder="Call"
                                style={{ width: '100%', padding: '0.65rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Mail size={14} /> Email</span></label>
                              <input
                                type="text"
                                value={link.email || ''}
                                onChange={(e) => updateHealthCheckLink(index, 'email', e.target.value)}
                                style={{ width: '100%', padding: '0.65rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}>Email label</label>
                              <input
                                type="text"
                                value={link.emailLabel || ''}
                                onChange={(e) => updateHealthCheckLink(index, 'emailLabel', e.target.value)}
                                placeholder="Email"
                                style={{ width: '100%', padding: '0.65rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}><Globe size={14} /> Website</span></label>
                              <input
                                type="text"
                                value={link.website || ''}
                                onChange={(e) => updateHealthCheckLink(index, 'website', e.target.value)}
                                style={{ width: '100%', padding: '0.65rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box' }}
                              />
                            </div>
                            <div>
                              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.25rem' }}>Website label</label>
                              <input
                                type="text"
                                value={link.websiteLabel || ''}
                                onChange={(e) => updateHealthCheckLink(index, 'websiteLabel', e.target.value)}
                                placeholder="Website"
                                style={{ width: '100%', padding: '0.65rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.92rem', boxSizing: 'border-box' }}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card" style={{ margin: 0, borderLeft: '4px solid #005eb8' }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>2. Edit + Patient preview</h3>
                  <HealthCheckCard
                    metric={{
                      label: selectedHealthCheckMetric.label,
                      value: selectedHealthCheckMetric.value,
                      unit: selectedHealthCheckMetric.unit,
                      badge: selectedHealthCheckMetric.badge,
                      badgeClass: selectedHealthCheckMetric.badgeClass,
                      whatTitle: selectedHealthCheckVariantSafe.whatIsTitle,
                      what: selectedHealthCheckVariantSafe.whatIsText,
                      pathway: selectedHealthCheckMetric.pathway,
                      breakdown: selectedHealthCheckMetric.breakdown,
                      oneLiner: selectedHealthCheckMetric.oneLiner,
                    }}
                    resultsMessage={selectedHealthCheckVariantSafe.resultsMessage}
                    importantText={selectedHealthCheckVariantSafe.importantText}
                    nextStepsTitle={selectedHealthCheckVariantSafe.nextStepsTitle}
                    nextStepsText={selectedHealthCheckVariantSafe.nextStepsText}
                    links={[
                      ...selectedHealthCheckVariantSafe.links.filter((link) => (link.title || '').trim() && ((link.phone || '').trim() || (link.email || '').trim() || (link.website || '').trim())),
                      ...(healthCheckLocalSupportLink ? [healthCheckLocalSupportLink] : []),
                    ]}
                    expanded
                  />
                </div>
                <div className="card" style={{ margin: 0 }}>
                  {builderNotice?.type === 'healthcheck' && (
                    <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
                      {builderNotice.message}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <button onClick={() => openPreview(healthCheckPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
                      <Eye size={16} /> Preview
                    </button>
                    <button onClick={saveHealthCheckTemplate} className="action-button" style={{ backgroundColor: '#007f3b' }}>
                      <Save size={16} /> Save Template
                    </button>
                    <button onClick={resetHealthCheckTemplate} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                      Reset
                    </button>
                  </div>
                </div>

                <div className="card" style={{ margin: 0 }}>
                  <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>3. Health Check Card Catalogue</h3>
                  <div className="dashboard-list">
                    {healthCheckCatalogueRows.map((row) => (
                      <div key={row.id} className="dashboard-list-card">
                        <div style={{
                          padding: '0.3rem 0.6rem',
                          borderRadius: '6px',
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          background: '#005eb8',
                          color: 'white',
                          minWidth: '72px',
                          textAlign: 'center',
                        }}>
                          {row.resultCode}
                        </div>
                        <div className="dashboard-list-main">
                          <div className="dashboard-list-title">{row.label}</div>
                          <div className="dashboard-meta" style={{ marginTop: '0.2rem' }}>
                            <span style={{ fontSize: '0.82rem', color: '#4c6272' }}>{row.summary}</span>
                          </div>
                        </div>
                        <div className="dashboard-list-actions">
                          <button onClick={() => openPreview(row.previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <Eye size={14} /> Preview
                          </button>
                          <button
                            onClick={() => {
                              setSelectedHealthCheckDomain(row.domainId);
                              setSelectedHealthCheckVariantCode(row.resultCode);
                            }}
                            className="action-button-sm"
                            style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                          >
                            <Edit2 size={14} /> Edit
                          </button>
                          <button onClick={() => copyText(row.previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                            <Copy size={14} /> Copy
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedOutputType === 'screening' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. Screening Card Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
            Build a reusable generic screening template and generate a patient preview link.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Screening type</label>
              <select
                value={screeningType}
                onChange={(e) => setScreeningType(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', background: '#ffffff' }}
              >
                {SCREENING_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid #d8dde0', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#005eb8' }}>Template preview</div>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{selectedScreeningTemplate.label}</div>
            <p style={{ margin: '0 0 0.6rem', color: '#4c6272' }}>{selectedScreeningTemplate.headline}</p>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#4c6272' }}>
              Includes {selectedScreeningTemplate.nhsLinks.length} NHS.UK resource link{selectedScreeningTemplate.nhsLinks.length === 1 ? '' : 's'}.
            </p>
          </div>
          <div style={{ padding: '1rem', background: '#f8fbfd', borderRadius: '10px', border: '1px solid #d8dde0', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>Preview Link</div>
            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1d2a33' }}>{screeningPreviewUrl}</code>
          </div>
          {builderNotice?.type === 'screening' && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
              {builderNotice.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => openPreview(screeningPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Eye size={16} /> Preview
            </button>
            <button onClick={saveScreeningTemplate} className="action-button" style={{ backgroundColor: '#007f3b' }}>
              <Save size={16} /> Save Template
            </button>
            <button onClick={resetScreeningTemplate} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              Reset
            </button>
            <button onClick={() => copyText(screeningPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Copy size={16} /> Copy Link
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem', borderLeft: '4px solid #4c6272' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>2. Screening Card Catalogue</h3>
            <div className="dashboard-list">
              {SCREENING_OPTIONS.map((option) => {
                const previewUrl = buildPatientUrl(new URLSearchParams({ type: 'screening', screen: option.value }));
                return (
                  <div key={option.value} className="dashboard-list-card">
                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white', minWidth: '72px', textAlign: 'center' }}>
                      {option.value.toUpperCase()}
                    </div>
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{option.label}</div>
                    </div>
                    <div className="dashboard-list-actions">
                      <button onClick={() => openPreview(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Eye size={14} /> Preview
                      </button>
                      <button onClick={() => setScreeningType(option.value)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => copyText(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedOutputType === 'immunisation' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. Immunisation Card Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
            Build reusable immunisation templates, then apply local support details for practice-specific deployment links.
          </p>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Vaccines</label>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {IMMUNISATION_OPTIONS.map((option) => (
                <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 0.8rem', border: '1px solid #d8dde0', borderRadius: '8px', background: '#f8fbfd' }}>
                  <input
                    type="checkbox"
                    checked={immunisationSelections.includes(option.value)}
                    onChange={() => toggleImmunisation(option.value)}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid #d8dde0', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#005eb8' }}>Selected template cards</div>
            {selectedImmunisationTemplates.length === 0 ? (
              <p style={{ margin: 0, color: '#4c6272' }}>No template selected.</p>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {selectedImmunisationTemplates.map((template) => (
                  <span
                    key={template.id}
                    style={{
                      background: '#eef7ff',
                      color: '#005eb8',
                      border: '1px solid #b8d6ee',
                      borderRadius: '999px',
                      padding: '0.35rem 0.7rem',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                    }}
                  >
                    {template.label}
                  </span>
                ))}
              </div>
            )}
            <p style={{ margin: '0.7rem 0 0', color: '#4c6272', fontSize: '0.9rem' }}>
              Each selected template includes NHS.UK links and aftercare guidance.
            </p>
          </div>
          <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid #d8dde0', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#005eb8' }}>Local support details (optional)</div>
            <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              <input
                type="text"
                value={localSupportName}
                onChange={(e) => setLocalSupportName(e.target.value)}
                placeholder="Service name (e.g. Practice care team)"
                style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
              <input
                type="text"
                value={localSupportPhone}
                onChange={(e) => setLocalSupportPhone(e.target.value)}
                placeholder="Phone number"
                style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
              <input
                type="email"
                value={localSupportEmail}
                onChange={(e) => setLocalSupportEmail(e.target.value)}
                placeholder="Email address"
                style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
              <input
                type="url"
                value={localSupportWebsite}
                onChange={(e) => setLocalSupportWebsite(e.target.value)}
                placeholder="Website URL"
                style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ padding: '1rem', background: '#f8fbfd', borderRadius: '10px', border: '1px solid #d8dde0', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>Preview Link</div>
            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1d2a33' }}>{immunisationPreviewUrl}</code>
          </div>
          {builderNotice?.type === 'immunisation' && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
              {builderNotice.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => openPreview(immunisationPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Eye size={16} /> Preview
            </button>
            <button onClick={saveImmunisationTemplate} className="action-button" style={{ backgroundColor: '#007f3b' }}>
              <Save size={16} /> Save Template
            </button>
            <button onClick={resetImmunisationTemplate} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              Reset
            </button>
            <button onClick={() => copyText(immunisationPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Copy size={16} /> Copy Link
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem', borderLeft: '4px solid #4c6272' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>2. Immunisation Card Catalogue</h3>
            <div className="dashboard-list">
              {IMMUNISATION_OPTIONS.map((option) => {
                const previewUrl = buildPatientUrl(new URLSearchParams({ type: 'imms', vaccine: option.value }));
                return (
                  <div key={option.value} className="dashboard-list-card">
                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white', minWidth: '72px', textAlign: 'center' }}>
                      {option.value.toUpperCase()}
                    </div>
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{option.label}</div>
                    </div>
                    <div className="dashboard-list-actions">
                      <button onClick={() => openPreview(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Eye size={14} /> Preview
                      </button>
                      <button
                        onClick={() => setImmunisationSelections([option.value])}
                        className="action-button-sm"
                        style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => copyText(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {selectedOutputType === 'ltc' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. Long Term Conditions Card Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>
            Create reusable long-term condition cards. Starter templates are preloaded for Asthma and Diabetes.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: '1 1 240px' }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Condition</label>
              <select
                value={selectedLongTermCondition}
                onChange={(e) => setSelectedLongTermCondition(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', background: '#ffffff' }}
              >
                {LONG_TERM_CONDITION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid #d8dde0', background: '#f8fbfd' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem', color: '#005eb8' }}>Default template fields</div>
            <div style={{ fontWeight: 700, marginBottom: '0.35rem' }}>{selectedLongTermConditionTemplate.label}</div>
            <p style={{ margin: '0 0 0.55rem', color: '#4c6272' }}>{selectedLongTermConditionTemplate.headline}</p>
            <p style={{ margin: '0 0 0.55rem', color: '#4c6272', fontSize: '0.92rem' }}>{selectedLongTermConditionTemplate.explanation}</p>
            <ul style={{ margin: '0 0 0.55rem 1rem', color: '#4c6272', padding: 0 }}>
              {selectedLongTermConditionTemplate.guidance.slice(0, 3).map((item, idx) => (
                <li key={idx} style={{ marginBottom: '0.2rem' }}>{item}</li>
              ))}
            </ul>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#4c6272' }}>
              Includes {selectedLongTermConditionTemplate.nhsLinks.length} default resource link{selectedLongTermConditionTemplate.nhsLinks.length === 1 ? '' : 's'}.
            </p>
          </div>

          {selectedLongTermConditionTemplate.zones && selectedLongTermConditionTemplate.zones.length > 0 && (
            <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '10px', border: '1px solid #d8dde0', background: '#f8fbfd' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>Traffic-light sections</div>
              <div style={{ display: 'grid', gap: '0.7rem' }}>
                {selectedLongTermConditionTemplate.zones.map((zone) => {
                  const tone = zone.color === 'green'
                    ? { border: '#007f3b', bg: '#f3f9f2', heading: '#005a2e' }
                    : zone.color === 'amber'
                      ? { border: '#b27a00', bg: '#fff8e6', heading: '#8a5f00' }
                      : { border: '#d5281b', bg: '#fdecec', heading: '#9d1c12' };
                  return (
                    <div key={zone.color} style={{ border: `1px solid ${tone.border}`, background: tone.bg, borderRadius: '8px', padding: '0.65rem 0.75rem' }}>
                      <div style={{ fontWeight: 700, color: tone.heading, marginBottom: '0.3rem' }}>{zone.title}</div>
                      <p style={{ margin: 0, color: '#4c6272', fontSize: '0.9rem' }}>
                        {zone.when.length} signs · {zone.actions.length} action points
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ padding: '1rem', background: '#f8fbfd', borderRadius: '10px', border: '1px solid #d8dde0', marginBottom: '1rem' }}>
            <div style={{ fontWeight: 700, marginBottom: '0.5rem', color: '#005eb8' }}>Preview Link</div>
            <code style={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: '#1d2a33' }}>{longTermConditionPreviewUrl}</code>
          </div>

          {builderNotice?.type === 'ltc' && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
              {builderNotice.message}
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => openPreview(longTermConditionPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Eye size={16} /> Preview
            </button>
            <button onClick={saveLtcTemplate} className="action-button" style={{ backgroundColor: '#007f3b' }}>
              <Save size={16} /> Save Template
            </button>
            <button onClick={resetLtcTemplate} className="action-button" style={{ backgroundColor: '#4c6272' }}>
              Reset
            </button>
            <button onClick={() => copyText(longTermConditionPreviewUrl)} className="action-button" style={{ backgroundColor: '#005eb8' }}>
              <Copy size={16} /> Copy Link
            </button>
          </div>

          <div className="card" style={{ marginTop: '1rem', borderLeft: '4px solid #4c6272' }}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>2. Long Term Condition Card Catalogue</h3>
            <div className="dashboard-list">
              {LONG_TERM_CONDITION_OPTIONS.map((option) => {
                const previewUrl = buildPatientUrl(new URLSearchParams({ type: 'ltc', ltc: option.value }));
                return (
                  <div key={option.value} className="dashboard-list-card">
                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white', minWidth: '72px', textAlign: 'center' }}>
                      {option.value.toUpperCase()}
                    </div>
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{option.label}</div>
                    </div>
                    <div className="dashboard-list-actions">
                      <button onClick={() => openPreview(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Eye size={14} /> Preview
                      </button>
                      <button onClick={() => setSelectedLongTermCondition(option.value)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button onClick={() => copyText(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Copy size={14} /> Copy
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};

export default DrugBuilder;
