import React from 'react';
import { Droplets, FlaskConical, Monitor, Pill, Thermometer, type LucideIcon } from 'lucide-react';

const MEDICATION_ICON_COMPONENTS: Record<string, LucideIcon> = {
  '101': Pill,
  '102': Monitor,
  '201': Droplets,
  '202': Droplets,
  '301': Droplets,
  '302': Droplets,
  '401': Thermometer,
  '402': Thermometer,
  '501': FlaskConical,
  '502': FlaskConical,
};

export const getMedicationIcon = (code: string, size = 20): React.ReactNode => {
  const Icon = MEDICATION_ICON_COMPONENTS[code] || Pill;
  return <Icon size={size} />;
};
