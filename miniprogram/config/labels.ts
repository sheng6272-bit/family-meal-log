/**
 * Presentation labels for family relations. The canonical list of relations
 * lives in shared/constants (FAMILY_RELATIONS); these are the Chinese UI labels.
 */

export const RELATION_LABELS: Record<FamilyRelation, string> = {
  self: '本人',
  spouse: '配偶',
  child: '子女',
  parent: '父母',
  other: '其他',
};

export const RELATION_OPTIONS: { value: FamilyRelation; label: string }[] = [
  { value: 'self', label: '本人' },
  { value: 'spouse', label: '配偶' },
  { value: 'child', label: '子女' },
  { value: 'parent', label: '父母' },
  { value: 'other', label: '其他' },
];
