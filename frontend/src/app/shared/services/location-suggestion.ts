export interface LocationSuggestion {
  organizationId: number;
  slug: string;
  name: string;
  country?: string;
  disclosesToCDP: boolean;
  isReportingLeader: boolean;
}
