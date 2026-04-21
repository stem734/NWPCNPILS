import React, { useMemo, useReducer, useState, useEffect } from 'react';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Plus, Trash2, Save, Copy, ExternalLink, Link, AlertCircle, Eye, Edit2, CopyPlus, Phone, Mail, Globe, X } from 'lucide-react';
import MedicationPreviewModal from '../components/MedicationPreviewModal';
import HealthCheckCard from '../components/HealthCheckCard';
import { resolvePath } from '../subdomainUtils';
import ConfirmDialog from '../components/ConfirmDialog';
import Modal from '../components/Modal';
import { type MedicationRecord, useMedicationCatalog } from '../medicationCatalog';
import { getFunctionErrorMessage } from '../supabaseFunctionError';
import { HEALTH_CHECK_CARD_LABELS, type HealthCheckCodeFamily } from '../healthCheckCodes';
import { CLINICAL_DOMAIN_IDS, PREVIEW_DOMAIN_CONFIGS, type ClinicalDomainId } from '../healthCheckVariantConfig';
import {
  SCREENING_TEMPLATES,
  IMMUNISATION_TEMPLATES,
  LONG_TERM_CONDITION_TEMPLATES,
  type ScreeningTemplate,
  type ImmunisationTemplate,
  type LongTermConditionTemplate,
  type PatientResourceLink,
} from '../patientTemplateCatalog';
import {
  fetchCardTemplateRevisions,
  fetchCardTemplates,
} from '../cardTemplateStore';
import type {
  CardTemplateBuilderType,
  CardTemplateRevisionRecord,
  HealthCheckBuilderLink,
  HealthCheckBuilderVariant,
  HealthCheckTemplatePayload,
} from '../cardTemplateTypes';

interface TrendLink {
  title: string;
  url: string;
}

type OutputBuilderType = 'medication' | 'healthcheck' | 'screening' | 'immunisation' | 'ltc';

type BuilderHistoryState = {
  builderType: CardTemplateBuilderType;
  templateId: string;
  label: string;
  revisions: CardTemplateRevisionRecord[];
  loading: boolean;
} | null;

type BuilderConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  isDangerous: boolean;
  onConfirm: () => void;
} | null;

type BuilderNotice = { type: OutputBuilderType; message: string } | null;
type StateValue<T> = T | ((current: T) => T);

type BuilderUiState = {
  selectedOutputType: OutputBuilderType;
  previewMed: MedicationRecord | null;
  selectedHealthCheckDomain: ClinicalDomainId;
  selectedHealthCheckVariantCode: string;
  healthCheckEditorOpen: boolean;
  screeningEditorOpen: boolean;
  immunisationEditorOpen: boolean;
  ltcEditorOpen: boolean;
  historyState: BuilderHistoryState;
  confirmDialog: BuilderConfirmDialog;
  builderNotice: BuilderNotice;
};

type BuilderUiAction =
  | { type: 'selectOutputType'; outputType: OutputBuilderType }
  | { type: 'setPreviewMed'; value: MedicationRecord | null }
  | { type: 'setSelectedHealthCheckDomain'; value: ClinicalDomainId }
  | { type: 'setSelectedHealthCheckVariantCode'; value: string }
  | { type: 'setHealthCheckEditorOpen'; value: boolean }
  | { type: 'setScreeningEditorOpen'; value: boolean }
  | { type: 'setImmunisationEditorOpen'; value: boolean }
  | { type: 'setLtcEditorOpen'; value: boolean }
  | { type: 'setHistoryState'; value: StateValue<BuilderHistoryState> }
  | { type: 'setConfirmDialog'; value: StateValue<BuilderConfirmDialog> }
  | { type: 'setBuilderNotice'; value: StateValue<BuilderNotice> };

const initialBuilderUiState: BuilderUiState = {
  selectedOutputType: 'medication',
  previewMed: null,
  selectedHealthCheckDomain: 'bp',
  selectedHealthCheckVariantCode: 'BPNORMAL',
  healthCheckEditorOpen: false,
  screeningEditorOpen: false,
  immunisationEditorOpen: false,
  ltcEditorOpen: false,
  historyState: null,
  confirmDialog: null,
  builderNotice: null,
};

const resolveStateValue = <T,>(current: T, value: StateValue<T>): T =>
  typeof value === 'function' ? (value as (current: T) => T)(current) : value;

const builderUiReducer = (state: BuilderUiState, action: BuilderUiAction): BuilderUiState => {
  switch (action.type) {
    case 'selectOutputType':
      return {
        ...state,
        selectedOutputType: action.outputType,
        previewMed: null,
        healthCheckEditorOpen: false,
        screeningEditorOpen: false,
        immunisationEditorOpen: false,
        ltcEditorOpen: false,
        historyState: null,
        confirmDialog: null,
        builderNotice: null,
      };
    case 'setPreviewMed':
      return { ...state, previewMed: action.value };
    case 'setSelectedHealthCheckDomain':
      return { ...state, selectedHealthCheckDomain: action.value };
    case 'setSelectedHealthCheckVariantCode':
      return { ...state, selectedHealthCheckVariantCode: action.value };
    case 'setHealthCheckEditorOpen':
      return { ...state, healthCheckEditorOpen: action.value };
    case 'setScreeningEditorOpen':
      return { ...state, screeningEditorOpen: action.value };
    case 'setImmunisationEditorOpen':
      return { ...state, immunisationEditorOpen: action.value };
    case 'setLtcEditorOpen':
      return { ...state, ltcEditorOpen: action.value };
    case 'setHistoryState':
      return { ...state, historyState: resolveStateValue(state.historyState, action.value) };
    case 'setConfirmDialog':
      return { ...state, confirmDialog: resolveStateValue(state.confirmDialog, action.value) };
    case 'setBuilderNotice':
      return { ...state, builderNotice: resolveStateValue(state.builderNotice, action.value) };
    default:
      return state;
  }
};

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

const cloneResourceLinks = (links: PatientResourceLink[]) => links.map((link) => ({ ...link }));
const cloneScreeningTemplate = (template: ScreeningTemplate): ScreeningTemplate => ({
  ...template,
  guidance: [...template.guidance],
  nhsLinks: cloneResourceLinks(template.nhsLinks),
});
const cloneImmunisationTemplate = (template: ImmunisationTemplate): ImmunisationTemplate => ({
  ...template,
  guidance: [...template.guidance],
  nhsLinks: cloneResourceLinks(template.nhsLinks),
});
const cloneLongTermConditionTemplate = (template: LongTermConditionTemplate): LongTermConditionTemplate => ({
  ...template,
  guidance: [...template.guidance],
  nhsLinks: cloneResourceLinks(template.nhsLinks),
  zones: template.zones?.map((zone) => ({ ...zone, when: [...zone.when], actions: [...zone.actions] })),
  additionalSections: template.additionalSections?.map((section) => ({ ...section, points: [...section.points] })),
});

const createDefaultScreeningState = (): Record<string, ScreeningTemplate> =>
  Object.fromEntries(Object.entries(SCREENING_TEMPLATES).map(([key, template]) => [key, cloneScreeningTemplate(template)]));

const createDefaultImmunisationState = (): Record<string, ImmunisationTemplate> =>
  Object.fromEntries(Object.entries(IMMUNISATION_TEMPLATES).map(([key, template]) => [key, cloneImmunisationTemplate(template)]));

const createDefaultLongTermConditionState = (): Record<string, LongTermConditionTemplate> =>
  Object.fromEntries(Object.entries(LONG_TERM_CONDITION_TEMPLATES).map(([key, template]) => [key, cloneLongTermConditionTemplate(template)]));

const CardBuilder: React.FC = () => {
  const [authenticated, setAuthenticated] = useState(false);
  const navigate = useNavigate();
  const [uiState, dispatchUi] = useReducer(builderUiReducer, initialBuilderUiState);
  const {
    medications: existingMeds,
    loading: loadingMeds,
    reload: reloadMeds,
  } = useMedicationCatalog();
  const {
    selectedOutputType,
    previewMed,
    selectedHealthCheckDomain,
    selectedHealthCheckVariantCode,
    healthCheckEditorOpen,
    screeningEditorOpen,
    immunisationEditorOpen,
    ltcEditorOpen,
    historyState,
    confirmDialog,
    builderNotice,
  } = uiState;

  const setSelectedOutputType = (value: OutputBuilderType) => dispatchUi({ type: 'selectOutputType', outputType: value });
  const setPreviewMed = (value: MedicationRecord | null) => dispatchUi({ type: 'setPreviewMed', value });
  const setSelectedHealthCheckDomain = (value: ClinicalDomainId) => dispatchUi({ type: 'setSelectedHealthCheckDomain', value });
  const setSelectedHealthCheckVariantCode = (value: string) => dispatchUi({ type: 'setSelectedHealthCheckVariantCode', value });
  const setHealthCheckEditorOpen = (value: boolean) => dispatchUi({ type: 'setHealthCheckEditorOpen', value });
  const setScreeningEditorOpen = (value: boolean) => dispatchUi({ type: 'setScreeningEditorOpen', value });
  const setImmunisationEditorOpen = (value: boolean) => dispatchUi({ type: 'setImmunisationEditorOpen', value });
  const setLtcEditorOpen = (value: boolean) => dispatchUi({ type: 'setLtcEditorOpen', value });
  const setHistoryState = (value: StateValue<BuilderHistoryState>) => dispatchUi({ type: 'setHistoryState', value });
  const setConfirmDialog = (value: StateValue<BuilderConfirmDialog>) => dispatchUi({ type: 'setConfirmDialog', value });
  const setBuilderNotice = (value: StateValue<BuilderNotice>) => dispatchUi({ type: 'setBuilderNotice', value });

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

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [deletingCode, setDeletingCode] = useState('');
  const [healthCheckLocalSupportName, setHealthCheckLocalSupportName] = useState('');
  const [healthCheckLocalSupportPhone, setHealthCheckLocalSupportPhone] = useState('');
  const [healthCheckLocalSupportEmail, setHealthCheckLocalSupportEmail] = useState('');
  const [healthCheckLocalSupportWebsite, setHealthCheckLocalSupportWebsite] = useState('');
  const [healthCheckBuilderConfigs, setHealthCheckBuilderConfigs] = useState<Record<ClinicalDomainId, Record<string, HealthCheckBuilderVariant>>>(() => createDefaultHealthCheckBuilderState());
  const [screeningTemplates, setScreeningTemplates] = useState<Record<string, ScreeningTemplate>>(() => createDefaultScreeningState());
  const [screeningType, setScreeningType] = useState('cervical');
  const [immunisationTemplates, setImmunisationTemplates] = useState<Record<string, ImmunisationTemplate>>(() => createDefaultImmunisationState());
  const [immunisationSelections, setImmunisationSelections] = useState<string[]>(['flu']);
  const [longTermConditionTemplates, setLongTermConditionTemplates] = useState<Record<string, LongTermConditionTemplate>>(() => createDefaultLongTermConditionState());
  const [selectedLongTermCondition, setSelectedLongTermCondition] = useState('asthma');
  const [templateActionKey, setTemplateActionKey] = useState('');

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
    if (!authenticated) return;

    const loadTemplates = async () => {
      try {
        const [healthcheckRows, screeningRows, immunisationRows, ltcRows] = await Promise.all([
          fetchCardTemplates<HealthCheckTemplatePayload>('healthcheck'),
          fetchCardTemplates<ScreeningTemplate>('screening'),
          fetchCardTemplates<ImmunisationTemplate>('immunisation'),
          fetchCardTemplates<LongTermConditionTemplate>('ltc'),
        ]);

        if (healthcheckRows.length > 0) {
          const next = createDefaultHealthCheckBuilderState();
          healthcheckRows.forEach((row) => {
            const domainId = row.template_id as ClinicalDomainId;
            if (next[domainId]) {
              next[domainId] = {
                ...next[domainId],
                ...((row.payload as HealthCheckTemplatePayload)?.variants || {}),
              };
            }
          });
          setHealthCheckBuilderConfigs(next);
        }

        if (screeningRows.length > 0) {
          setScreeningTemplates((current) => {
            const next = { ...current };
            screeningRows.forEach((row) => {
              next[row.template_id] = cloneScreeningTemplate(row.payload as ScreeningTemplate);
            });
            return next;
          });
        }

        if (immunisationRows.length > 0) {
          setImmunisationTemplates((current) => {
            const next = { ...current };
            immunisationRows.forEach((row) => {
              next[row.template_id] = cloneImmunisationTemplate(row.payload as ImmunisationTemplate);
            });
            return next;
          });
        }

        if (ltcRows.length > 0) {
          setLongTermConditionTemplates((current) => {
            const next = { ...current };
            ltcRows.forEach((row) => {
              next[row.template_id] = cloneLongTermConditionTemplate(row.payload as LongTermConditionTemplate);
            });
            return next;
          });
        }
      } catch (error) {
        console.error('Failed to load card templates', error);
      }
    };

    loadTemplates();
  }, [authenticated]);

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

  const buildHealthCheckFamilyPreviewUrl = (domainId: ClinicalDomainId) => {
    const params = new URLSearchParams({ type: 'healthcheck', previewOnly: '1', previewDomain: domainId });
    if (healthCheckLocalSupportName.trim()) params.set('localName', healthCheckLocalSupportName.trim());
    if (healthCheckLocalSupportPhone.trim()) params.set('localPhone', healthCheckLocalSupportPhone.trim());
    if (healthCheckLocalSupportEmail.trim()) params.set('localEmail', healthCheckLocalSupportEmail.trim());
    if (healthCheckLocalSupportWebsite.trim()) params.set('localWebsite', healthCheckLocalSupportWebsite.trim());
    return buildPatientUrl(params);
  };

  const selectedScreeningTemplate = screeningTemplates[screeningType] || SCREENING_TEMPLATES.cervical;
  const selectedImmunisationTemplate = immunisationTemplates[immunisationSelections[0]] || IMMUNISATION_TEMPLATES.flu;
  const selectedLongTermConditionTemplate =
    longTermConditionTemplates[selectedLongTermCondition] || LONG_TERM_CONDITION_TEMPLATES.asthma;

  const healthCheckCatalogueRows = CLINICAL_DOMAIN_IDS.map((domainId) => {
    const metricByCode = PREVIEW_DOMAIN_CONFIGS[domainId].metricByCode;
    const resultCodes = Object.keys(metricByCode);
    const familyCode = (domainId === 'ldl' ? 'chol' : domainId).toUpperCase();

    return {
      id: domainId,
      domainId,
      familyCode,
      label: HEALTH_CHECK_CARD_LABELS[(domainId === 'ldl' ? 'chol' : domainId) as HealthCheckCodeFamily] || PREVIEW_DOMAIN_CONFIGS[domainId].heading,
      summary: `${resultCodes.length} result type${resultCodes.length === 1 ? '' : 's'}`,
      resultCodes,
      previewUrl: buildHealthCheckFamilyPreviewUrl(domainId),
    };
  });

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

  const updateScreeningTemplate = (templateId: string, patch: Partial<ScreeningTemplate>) => {
    setScreeningTemplates((current) => ({
      ...current,
      [templateId]: {
        ...(current[templateId] || cloneScreeningTemplate(SCREENING_TEMPLATES.cervical)),
        ...patch,
      },
    }));
  };

  const updateScreeningGuidance = (templateId: string, index: number, value: string) => {
    const template = screeningTemplates[templateId] || SCREENING_TEMPLATES.cervical;
    const guidance = [...template.guidance];
    guidance[index] = value;
    updateScreeningTemplate(templateId, { guidance });
  };

  const updateScreeningLink = (templateId: string, index: number, field: keyof PatientResourceLink, value: string) => {
    const template = screeningTemplates[templateId] || SCREENING_TEMPLATES.cervical;
    const nhsLinks = template.nhsLinks.map((link, linkIndex) => linkIndex === index ? { ...link, [field]: value } : link);
    updateScreeningTemplate(templateId, { nhsLinks });
  };

  const updateImmunisationTemplate = (templateId: string, patch: Partial<ImmunisationTemplate>) => {
    setImmunisationTemplates((current) => ({
      ...current,
      [templateId]: {
        ...(current[templateId] || cloneImmunisationTemplate(IMMUNISATION_TEMPLATES.flu)),
        ...patch,
      },
    }));
  };

  const updateImmunisationGuidance = (templateId: string, index: number, value: string) => {
    const template = immunisationTemplates[templateId] || IMMUNISATION_TEMPLATES.flu;
    const guidance = [...template.guidance];
    guidance[index] = value;
    updateImmunisationTemplate(templateId, { guidance });
  };

  const updateImmunisationLink = (templateId: string, index: number, field: keyof PatientResourceLink, value: string) => {
    const template = immunisationTemplates[templateId] || IMMUNISATION_TEMPLATES.flu;
    const nhsLinks = template.nhsLinks.map((link, linkIndex) => linkIndex === index ? { ...link, [field]: value } : link);
    updateImmunisationTemplate(templateId, { nhsLinks });
  };

  const updateLongTermConditionTemplate = (templateId: string, patch: Partial<LongTermConditionTemplate>) => {
    setLongTermConditionTemplates((current) => ({
      ...current,
      [templateId]: {
        ...(current[templateId] || cloneLongTermConditionTemplate(LONG_TERM_CONDITION_TEMPLATES.asthma)),
        ...patch,
      },
    }));
  };

  const updateLongTermGuidance = (templateId: string, index: number, value: string) => {
    const template = longTermConditionTemplates[templateId] || LONG_TERM_CONDITION_TEMPLATES.asthma;
    const guidance = [...template.guidance];
    guidance[index] = value;
    updateLongTermConditionTemplate(templateId, { guidance });
  };

  const updateLongTermLink = (templateId: string, index: number, field: keyof PatientResourceLink, value: string) => {
    const template = longTermConditionTemplates[templateId] || LONG_TERM_CONDITION_TEMPLATES.asthma;
    const nhsLinks = template.nhsLinks.map((link, linkIndex) => linkIndex === index ? { ...link, [field]: value } : link);
    updateLongTermConditionTemplate(templateId, { nhsLinks });
  };

  const updateLongTermZone = (
    templateId: string,
    zoneIndex: number,
    field: 'title' | 'when' | 'actions',
    value: string | string[],
  ) => {
    const template = longTermConditionTemplates[templateId] || LONG_TERM_CONDITION_TEMPLATES.asthma;
    const zones = (template.zones || []).map((zone, index) => index === zoneIndex ? { ...zone, [field]: value } : zone);
    updateLongTermConditionTemplate(templateId, { zones });
  };

  const updateLongTermAdditionalSection = (
    templateId: string,
    sectionIndex: number,
    field: 'title' | 'points',
    value: string | string[],
  ) => {
    const template = longTermConditionTemplates[templateId] || LONG_TERM_CONDITION_TEMPLATES.asthma;
    const additionalSections = (template.additionalSections || []).map((section, index) => index === sectionIndex ? { ...section, [field]: value } : section);
    updateLongTermConditionTemplate(templateId, { additionalSections });
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
      const saveAction = editingCode ? 'updated' : 'created';
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
        await reloadMeds();
        showBuilderNotice('medication', `Card ${saveAction} successfully.`);
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

  const persistCardTemplate = async (
    builderType: CardTemplateBuilderType,
    templateId: string,
    label: string,
    payload: unknown,
    successMessage: string,
  ) => {
    const actionKey = `${builderType}:${templateId}`;
    setTemplateActionKey(actionKey);
    try {
      const { data, error } = await supabase.functions.invoke('save-card-template', {
        body: { builderType, templateId, label, payload },
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Template save did not complete');
      showBuilderNotice(builderType as OutputBuilderType, successMessage);
    } catch (err) {
      const message = await getFunctionErrorMessage(err, 'Failed to save card template.');
      showBuilderNotice(builderType as OutputBuilderType, message);
    } finally {
      setTemplateActionKey('');
    }
  };

  const loadTemplateHistory = async (builderType: CardTemplateBuilderType, templateId: string, label: string) => {
    setHistoryState({ builderType, templateId, label, revisions: [], loading: true });
    try {
      const revisions = await fetchCardTemplateRevisions(builderType, templateId);
      setHistoryState({ builderType, templateId, label, revisions, loading: false });
    } catch (error) {
      console.error('Failed to load template history', error);
      setHistoryState({ builderType, templateId, label, revisions: [], loading: false });
    }
  };

  const applyTemplatePayloadToState = (
    builderType: CardTemplateBuilderType,
    templateId: string,
    payload: unknown,
  ) => {
    if (builderType === 'healthcheck') {
      const next = createDefaultHealthCheckBuilderState();
      const domainId = templateId as ClinicalDomainId;
      next[domainId] = {
        ...next[domainId],
        ...((payload as HealthCheckTemplatePayload)?.variants || {}),
      };
      setHealthCheckBuilderConfigs((current) => ({ ...current, [domainId]: next[domainId] }));
      return;
    }
    if (builderType === 'screening') {
      setScreeningTemplates((current) => ({
        ...current,
        [templateId]: cloneScreeningTemplate(payload as ScreeningTemplate),
      }));
      return;
    }
    if (builderType === 'immunisation') {
      setImmunisationTemplates((current) => ({
        ...current,
        [templateId]: cloneImmunisationTemplate(payload as ImmunisationTemplate),
      }));
      return;
    }
    setLongTermConditionTemplates((current) => ({
      ...current,
      [templateId]: cloneLongTermConditionTemplate(payload as LongTermConditionTemplate),
    }));
  };

  const restoreTemplateRevision = async (revision: CardTemplateRevisionRecord) => {
    if (!historyState) return;
    setTemplateActionKey(`${historyState.builderType}:${historyState.templateId}:restore:${revision.id}`);
    try {
      const { data, error } = await supabase.functions.invoke('restore-card-template', {
        body: {
          builderType: historyState.builderType,
          templateId: historyState.templateId,
          revisionId: revision.id,
        },
      });
      if (error) throw error;
      if (!data?.success) throw new Error('Template restore did not complete');
      applyTemplatePayloadToState(historyState.builderType, historyState.templateId, revision.payload);

      const revisions = await fetchCardTemplateRevisions(historyState.builderType, historyState.templateId);
      setHistoryState((current) => current ? { ...current, revisions, loading: false } : current);
      showBuilderNotice(historyState.builderType as OutputBuilderType, `${historyState.label} restored.`);
    } catch (err) {
      const message = await getFunctionErrorMessage(err, 'Failed to restore template.');
      showBuilderNotice(historyState.builderType as OutputBuilderType, message);
    } finally {
      setTemplateActionKey('');
    }
  };

  const saveHealthCheckTemplate = async (domainId = selectedHealthCheckDomain) => {
    const familyLabel = HEALTH_CHECK_CARD_LABELS[(domainId === 'ldl' ? 'chol' : domainId) as HealthCheckCodeFamily]
      || PREVIEW_DOMAIN_CONFIGS[domainId].heading;
    await persistCardTemplate(
      'healthcheck',
      domainId,
      familyLabel,
      { variants: healthCheckBuilderConfigs[domainId] || createDefaultHealthCheckBuilderState()[domainId] },
      `${familyLabel} template saved.`,
    );
  };

  const saveScreeningTemplate = async (templateId = screeningType) => {
    const template = screeningTemplates[templateId] || SCREENING_TEMPLATES.cervical;
    await persistCardTemplate('screening', templateId, template.label, template, `${template.label} saved.`);
  };

  const saveImmunisationTemplate = async (templateId = immunisationSelections[0] || 'flu') => {
    const template = immunisationTemplates[templateId] || IMMUNISATION_TEMPLATES.flu;
    await persistCardTemplate('immunisation', templateId, template.label, template, `${template.label} saved.`);
  };

  const saveLtcTemplate = async (templateId = selectedLongTermCondition) => {
    const template = longTermConditionTemplates[templateId] || LONG_TERM_CONDITION_TEMPLATES.asthma;
    await persistCardTemplate('ltc', templateId, template.label, template, `${template.label} saved.`);
  };

  if (!authenticated) return null;

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
      {builderNotice?.type === 'medication' && (
        <div style={{ marginBottom: '1rem', padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600 }}>
          {builderNotice.message}
        </div>
      )}
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
              Use the row list below to preview, edit, and copy each health check card variation.
            </p>
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
            {builderNotice?.type === 'healthcheck' && (
              <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
                {builderNotice.message}
              </div>
            )}

            <h3 style={{ marginBottom: '1rem' }}>3. Health Check Card Catalogue</h3>
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
                    {row.familyCode}
                  </div>
                  <div className="dashboard-list-main">
                    <div className="dashboard-list-title">{row.label}</div>
                    <div className="dashboard-meta" style={{ marginTop: '0.2rem' }}>
                      <span style={{ fontSize: '0.82rem', color: '#4c6272' }}>{row.summary}</span>
                      <span style={{ fontSize: '0.82rem', color: '#4c6272' }}>
                        {row.resultCodes.join(', ')}
                      </span>
                    </div>
                  </div>
                  <div className="dashboard-list-actions">
                    <button onClick={() => openPreview(row.previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <Eye size={14} /> Preview
                    </button>
                    <button
                      onClick={() => {
                        setSelectedHealthCheckDomain(row.domainId);
                        setSelectedHealthCheckVariantCode(row.resultCodes[0] || '');
                        setHealthCheckEditorOpen(true);
                      }}
                      className="action-button-sm"
                      style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                    >
                      <Edit2 size={14} /> Edit
                    </button>
                    <button
                      onClick={() => loadTemplateHistory('healthcheck', row.domainId, row.label)}
                      className="action-button-sm"
                      style={{ background: '#fff8e6', border: '1px solid #b27a00', color: '#8a5f00', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                    >
                      Audit
                    </button>
                    <button onClick={() => copyText(row.previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                      <Copy size={14} /> Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {healthCheckEditorOpen && (
            <Modal isOpen={healthCheckEditorOpen} onClose={() => setHealthCheckEditorOpen(false)} size="xl">
              <div style={{
                width: 'min(1120px, 90vw)',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                background: '#ffffff',
                borderRadius: '16px',
                boxShadow: '0 24px 60px rgba(15, 32, 45, 0.24)',
              }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderBottom: '1px solid #e0e0e0' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#003087', fontSize: '1.25rem', fontWeight: 600 }}>Edit Health Check Card</h3>
                    <p style={{ margin: '0.35rem 0 0', color: '#4c6272', fontSize: '0.9rem' }}>
                      {selectedHealthCheckMetric.label} - {resolvedSelectedHealthCheckVariantCode}
                    </p>
                  </div>
                  <button
                    onClick={() => setHealthCheckEditorOpen(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4c6272', padding: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={24} />
                  </button>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
                  <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Section</label>
                        <select
                          value={selectedHealthCheckDomain}
                          onChange={(e) => {
                            const nextDomain = e.target.value as ClinicalDomainId;
                            const nextCodes = Object.keys(PREVIEW_DOMAIN_CONFIGS[nextDomain].metricByCode);
                            setSelectedHealthCheckDomain(nextDomain);
                            setSelectedHealthCheckVariantCode(nextCodes[0] || '');
                          }}
                          style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {CLINICAL_DOMAIN_IDS.map((domainId) => (
                            <option key={domainId} value={domainId}>
                              {HEALTH_CHECK_CARD_LABELS[(domainId === 'ldl' ? 'chol' : domainId) as HealthCheckCodeFamily] || PREVIEW_DOMAIN_CONFIGS[domainId].heading}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>Result type</label>
                        <select
                          value={resolvedSelectedHealthCheckVariantCode}
                          onChange={(e) => setSelectedHealthCheckVariantCode(e.target.value)}
                          style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', fontSize: '0.95rem', background: '#ffffff', boxSizing: 'border-box' }}
                        >
                          {Object.keys(selectedHealthCheckDomainConfig.metricByCode).map((resultCode) => (
                            <option key={resultCode} value={resultCode}>{resultCode}</option>
                          ))}
                        </select>
                      </div>
                    </div>

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

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                      <div style={{ flex: 1 }}>
                        <h4 style={{ margin: 0 }}>Resource and Support Links</h4>
                        <p style={{ margin: '0.35rem 0 0', color: '#4c6272' }}>Add national NHS links and local support contacts shown in the next-steps section.</p>
                      </div>
                      <button onClick={addHealthCheckLink} className="action-button" style={{ backgroundColor: '#005eb8', flexShrink: 0, whiteSpace: 'nowrap' }}>
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

                  <div style={{ position: 'sticky', top: 0, alignSelf: 'start' }}>
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
                  </div>
                </div>

                <div style={{ padding: '1.5rem', borderTop: '1px solid #e0e0e0', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setHealthCheckEditorOpen(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#4c6272',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                    }}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      saveHealthCheckTemplate(selectedHealthCheckDomain);
                      setHealthCheckEditorOpen(false);
                    }}
                    style={{
                      padding: '0.75rem 1.5rem',
                      backgroundColor: '#007f3b',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.95rem',
                      fontWeight: 500,
                    }}
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </Modal>
          )}
        </>
      )}

      {selectedOutputType === 'screening' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. Screening Card Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>Use rows below to preview, edit, and copy each screening card template.</p>
          {builderNotice?.type === 'screening' && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
              {builderNotice.message}
            </div>
          )}

          <h3 style={{ marginBottom: '1rem' }}>2. Screening Card Catalogue</h3>
          <div className="dashboard-list">
              {Object.values(screeningTemplates).map((template) => {
                const previewUrl = buildPatientUrl(new URLSearchParams({ type: 'screening', screen: template.id }));
                return (
                  <div key={template.id} className="dashboard-list-card">
                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white', minWidth: '72px', textAlign: 'center' }}>
                      {template.id.toUpperCase()}
                    </div>
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{template.label}</div>
                      <div className="dashboard-meta" style={{ marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', color: '#4c6272' }}>{template.headline}</span>
                      </div>
                    </div>
                    <div className="dashboard-list-actions">
                      <button onClick={() => openPreview(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Eye size={14} /> Preview
                      </button>
                      <button onClick={() => { setScreeningType(template.id); setScreeningEditorOpen(true); }} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => loadTemplateHistory('screening', template.id, template.label)}
                        className="action-button-sm"
                        style={{ background: '#fff8e6', border: '1px solid #b27a00', color: '#8a5f00', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                      >
                        Audit
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
      )}

      {selectedOutputType === 'immunisation' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. Immunisation Card Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>Use rows below to preview, edit, and copy each immunisation card template.</p>
          {builderNotice?.type === 'immunisation' && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
              {builderNotice.message}
            </div>
          )}

          <h3 style={{ marginBottom: '1rem' }}>2. Immunisation Card Catalogue</h3>
          <div className="dashboard-list">
              {Object.values(immunisationTemplates).map((template) => {
                const previewUrl = buildPatientUrl(new URLSearchParams({ type: 'imms', vaccine: template.id }));
                return (
                  <div key={template.id} className="dashboard-list-card">
                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white', minWidth: '72px', textAlign: 'center' }}>
                      {template.id.toUpperCase()}
                    </div>
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{template.label}</div>
                      <div className="dashboard-meta" style={{ marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', color: '#4c6272' }}>{template.headline}</span>
                      </div>
                    </div>
                    <div className="dashboard-list-actions">
                      <button onClick={() => openPreview(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Eye size={14} /> Preview
                      </button>
                      <button
                        onClick={() => { setImmunisationSelections([template.id]); setImmunisationEditorOpen(true); }}
                        className="action-button-sm"
                        style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                      >
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => loadTemplateHistory('immunisation', template.id, template.label)}
                        className="action-button-sm"
                        style={{ background: '#fff8e6', border: '1px solid #b27a00', color: '#8a5f00', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                      >
                        Audit
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
      )}

      {selectedOutputType === 'ltc' && (
        <div className="card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid #005eb8' }}>
          <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>1. Long Term Conditions Card Builder</h2>
          <p style={{ margin: '0 0 1rem', color: '#4c6272', fontSize: '0.95rem' }}>Use rows below to preview, edit, and copy each long term condition card template.</p>

          {builderNotice?.type === 'ltc' && (
            <div style={{ padding: '0.5rem 0.75rem', background: '#eef7ff', color: '#005eb8', borderRadius: '6px', marginBottom: '0.9rem', fontSize: '0.88rem', fontWeight: 600 }}>
              {builderNotice.message}
            </div>
          )}
          <h3 style={{ marginBottom: '1rem' }}>2. Long Term Condition Card Catalogue</h3>
          <div className="dashboard-list">
              {Object.values(longTermConditionTemplates).map((template) => {
                const previewUrl = buildPatientUrl(new URLSearchParams({ type: 'ltc', ltc: template.id }));
                return (
                  <div key={template.id} className="dashboard-list-card">
                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 800, fontFamily: 'monospace', background: '#005eb8', color: 'white', minWidth: '72px', textAlign: 'center' }}>
                      {template.id.toUpperCase()}
                    </div>
                    <div className="dashboard-list-main">
                      <div className="dashboard-list-title">{template.label}</div>
                      <div className="dashboard-meta" style={{ marginTop: '0.2rem' }}>
                        <span style={{ fontSize: '0.82rem', color: '#4c6272' }}>{template.headline}</span>
                      </div>
                    </div>
                    <div className="dashboard-list-actions">
                      <button onClick={() => openPreview(previewUrl)} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #005eb8', color: '#005eb8', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Eye size={14} /> Preview
                      </button>
                      <button onClick={() => { setSelectedLongTermCondition(template.id); setLtcEditorOpen(true); }} className="action-button-sm" style={{ background: '#eef7ff', border: '1px solid #4c6272', color: '#4c6272', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <Edit2 size={14} /> Edit
                      </button>
                      <button
                        onClick={() => loadTemplateHistory('ltc', template.id, template.label)}
                        className="action-button-sm"
                        style={{ background: '#fff8e6', border: '1px solid #b27a00', color: '#8a5f00', borderRadius: '6px', padding: '0.4rem 0.6rem', display: 'flex', gap: '0.35rem', alignItems: 'center' }}
                      >
                        Audit
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
      )}

      {screeningEditorOpen && (
        <Modal isOpen={screeningEditorOpen} onClose={() => setScreeningEditorOpen(false)} size="xl">
          <div style={{ width: 'min(960px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: '16px', boxShadow: '0 24px 60px rgba(15, 32, 45, 0.24)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#003087' }}>Edit Screening Card</h3>
                <p style={{ margin: '0.35rem 0 0', color: '#4c6272' }}>{selectedScreeningTemplate.label}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => saveScreeningTemplate(screeningType)} className="action-button" style={{ backgroundColor: '#007f3b' }}>
                  <Save size={16} /> Save
                </button>
                <button onClick={() => setScreeningEditorOpen(false)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                  Close
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" value={selectedScreeningTemplate.label} onChange={(e) => updateScreeningTemplate(screeningType, { label: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <input type="text" value={selectedScreeningTemplate.headline} onChange={(e) => updateScreeningTemplate(screeningType, { headline: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <textarea value={selectedScreeningTemplate.explanation} onChange={(e) => updateScreeningTemplate(screeningType, { explanation: e.target.value })} rows={4} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <div>
                <h4 style={{ margin: '0 0 0.5rem' }}>Guidance</h4>
                {selectedScreeningTemplate.guidance.map((item, index) => (
                  <input key={index} type="text" value={item} onChange={(e) => updateScreeningGuidance(screeningType, index, e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
                ))}
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.5rem' }}>Resource links</h4>
                {selectedScreeningTemplate.nhsLinks.map((link, index) => (
                  <div key={index} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr', marginBottom: '0.75rem' }}>
                    <input type="text" value={link.title} onChange={(e) => updateScreeningLink(screeningType, index, 'title', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    <input type="text" value={link.url} onChange={(e) => updateScreeningLink(screeningType, index, 'url', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    <textarea value={link.description} onChange={(e) => updateScreeningLink(screeningType, index, 'description', e.target.value)} rows={2} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {immunisationEditorOpen && (
        <Modal isOpen={immunisationEditorOpen} onClose={() => setImmunisationEditorOpen(false)} size="xl">
          <div style={{ width: 'min(960px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: '16px', boxShadow: '0 24px 60px rgba(15, 32, 45, 0.24)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#003087' }}>Edit Immunisation Card</h3>
                <p style={{ margin: '0.35rem 0 0', color: '#4c6272' }}>{selectedImmunisationTemplate.label}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => saveImmunisationTemplate(immunisationSelections[0] || 'flu')} className="action-button" style={{ backgroundColor: '#007f3b' }}>
                  <Save size={16} /> Save
                </button>
                <button onClick={() => setImmunisationEditorOpen(false)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                  Close
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" value={selectedImmunisationTemplate.label} onChange={(e) => updateImmunisationTemplate(selectedImmunisationTemplate.id, { label: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <input type="text" value={selectedImmunisationTemplate.headline} onChange={(e) => updateImmunisationTemplate(selectedImmunisationTemplate.id, { headline: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <textarea value={selectedImmunisationTemplate.explanation} onChange={(e) => updateImmunisationTemplate(selectedImmunisationTemplate.id, { explanation: e.target.value })} rows={4} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <div>
                <h4 style={{ margin: '0 0 0.5rem' }}>Guidance</h4>
                {selectedImmunisationTemplate.guidance.map((item, index) => (
                  <input key={index} type="text" value={item} onChange={(e) => updateImmunisationGuidance(selectedImmunisationTemplate.id, index, e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
                ))}
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.5rem' }}>Resource links</h4>
                {selectedImmunisationTemplate.nhsLinks.map((link, index) => (
                  <div key={index} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr', marginBottom: '0.75rem' }}>
                    <input type="text" value={link.title} onChange={(e) => updateImmunisationLink(selectedImmunisationTemplate.id, index, 'title', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    <input type="text" value={link.url} onChange={(e) => updateImmunisationLink(selectedImmunisationTemplate.id, index, 'url', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    <textarea value={link.description} onChange={(e) => updateImmunisationLink(selectedImmunisationTemplate.id, index, 'description', e.target.value)} rows={2} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {ltcEditorOpen && (
        <Modal isOpen={ltcEditorOpen} onClose={() => setLtcEditorOpen(false)} size="xl">
          <div style={{ width: 'min(1040px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: '16px', boxShadow: '0 24px 60px rgba(15, 32, 45, 0.24)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#003087' }}>Edit Long Term Condition Card</h3>
                <p style={{ margin: '0.35rem 0 0', color: '#4c6272' }}>{selectedLongTermConditionTemplate.label}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={() => saveLtcTemplate(selectedLongTermCondition)} className="action-button" style={{ backgroundColor: '#007f3b' }}>
                  <Save size={16} /> Save
                </button>
                <button onClick={() => setLtcEditorOpen(false)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                  Close
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <input type="text" value={selectedLongTermConditionTemplate.label} onChange={(e) => updateLongTermConditionTemplate(selectedLongTermCondition, { label: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <input type="text" value={selectedLongTermConditionTemplate.headline} onChange={(e) => updateLongTermConditionTemplate(selectedLongTermCondition, { headline: e.target.value })} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <textarea value={selectedLongTermConditionTemplate.explanation} onChange={(e) => updateLongTermConditionTemplate(selectedLongTermCondition, { explanation: e.target.value })} rows={4} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <textarea value={selectedLongTermConditionTemplate.importantMessage || ''} onChange={(e) => updateLongTermConditionTemplate(selectedLongTermCondition, { importantMessage: e.target.value })} rows={3} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
              <div>
                <h4 style={{ margin: '0 0 0.5rem' }}>Guidance</h4>
                {selectedLongTermConditionTemplate.guidance.map((item, index) => (
                  <input key={index} type="text" value={item} onChange={(e) => updateLongTermGuidance(selectedLongTermCondition, index, e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
                ))}
              </div>
              {(selectedLongTermConditionTemplate.zones || []).map((zone, zoneIndex) => (
                <div key={`${zone.color}-${zoneIndex}`} style={{ border: '1px solid #d8dde0', borderRadius: '10px', padding: '1rem', background: '#f8fbfd' }}>
                  <input type="text" value={zone.title} onChange={(e) => updateLongTermZone(selectedLongTermCondition, zoneIndex, 'title', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
                  <textarea value={zone.when.join('\n')} onChange={(e) => updateLongTermZone(selectedLongTermCondition, zoneIndex, 'when', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} rows={4} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
                  <textarea value={zone.actions.join('\n')} onChange={(e) => updateLongTermZone(selectedLongTermCondition, zoneIndex, 'actions', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} rows={4} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
              ))}
              {(selectedLongTermConditionTemplate.additionalSections || []).map((section, sectionIndex) => (
                <div key={`${section.title}-${sectionIndex}`} style={{ border: '1px solid #d8dde0', borderRadius: '10px', padding: '1rem', background: '#f8fbfd' }}>
                  <input type="text" value={section.title} onChange={(e) => updateLongTermAdditionalSection(selectedLongTermCondition, sectionIndex, 'title', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box', marginBottom: '0.5rem' }} />
                  <textarea value={section.points.join('\n')} onChange={(e) => updateLongTermAdditionalSection(selectedLongTermCondition, sectionIndex, 'points', e.target.value.split('\n').map((item) => item.trim()).filter(Boolean))} rows={4} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <h4 style={{ margin: '0 0 0.5rem' }}>Resource links</h4>
                {selectedLongTermConditionTemplate.nhsLinks.map((link, index) => (
                  <div key={index} style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr', marginBottom: '0.75rem' }}>
                    <input type="text" value={link.title} onChange={(e) => updateLongTermLink(selectedLongTermCondition, index, 'title', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    <input type="text" value={link.url} onChange={(e) => updateLongTermLink(selectedLongTermCondition, index, 'url', e.target.value)} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                    <textarea value={link.description} onChange={(e) => updateLongTermLink(selectedLongTermCondition, index, 'description', e.target.value)} rows={2} style={{ width: '100%', padding: '0.7rem', border: '2px solid #d8dde0', borderRadius: '8px', boxSizing: 'border-box' }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {historyState && (
        <Modal isOpen={Boolean(historyState)} onClose={() => setHistoryState(null)} size="lg">
          <div style={{ width: 'min(760px, 100%)', maxHeight: '85vh', overflowY: 'auto', background: '#ffffff', borderRadius: '16px', boxShadow: '0 24px 60px rgba(15, 32, 45, 0.24)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ margin: 0, color: '#003087' }}>Template Audit History</h3>
                <p style={{ margin: '0.35rem 0 0', color: '#4c6272' }}>{historyState.label}</p>
              </div>
              <button onClick={() => setHistoryState(null)} className="action-button" style={{ backgroundColor: '#4c6272' }}>
                Close
              </button>
            </div>
            {historyState.loading ? (
              <p style={{ color: '#4c6272' }}>Loading history...</p>
            ) : historyState.revisions.length === 0 ? (
              <p style={{ color: '#4c6272' }}>No saved revisions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {historyState.revisions.map((revision) => (
                  <div key={revision.id} style={{ border: '1px solid #d8dde0', borderRadius: '10px', padding: '1rem', background: '#f8fbfd', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, color: '#1d2a33' }}>Version {revision.version} • {revision.action}</div>
                      <div style={{ color: '#4c6272', fontSize: '0.9rem', marginTop: '0.25rem' }}>
                        {new Date(revision.created_at).toLocaleString('en-GB')}
                      </div>
                    </div>
                    <button
                      onClick={() => restoreTemplateRevision(revision)}
                      disabled={templateActionKey === `${historyState.builderType}:${historyState.templateId}:restore:${revision.id}`}
                      className="action-button-sm"
                      style={{ background: '#f3f8f1', border: '1px solid #007f3b', color: '#007f3b', borderRadius: '6px', padding: '0.55rem 0.75rem' }}
                    >
                      Restore
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
    </>
  );
};

export default CardBuilder;
