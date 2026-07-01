import type {
  AdaptationAction,
  AdaptationGoal,
  Hazard,
  LocationPin,
  LocationProfile,
  ProjectSeekingFunding,
  SolutionCard,
} from '@pac-api/client';

export type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

export function locationProperties(
  location: LocationProfile | null | undefined,
): AnalyticsProperties {
  if (!location) {
    return {};
  }

  return {
    location_id: location.organizationId,
    location_name: location.name,
    country: location.countryName,
    population: location.population,
    public_status: location.publicStatus,
    disclosure_year: location.disclosureYear,
    hazards_count: location.hazards?.hazards?.length ?? 0,
    actions_count: location.governmentActions?.actions?.length ?? 0,
    goals_count: location.governmentActions?.goals?.length ?? 0,
    projects_count: location.governmentActions?.projects?.length ?? 0,
  };
}

export function pinProperties(location: LocationPin | null | undefined): AnalyticsProperties {
  if (!location) {
    return {};
  }

  return {
    location_name: location.name,
    org_type: location.orgType,
  };
}

export function hazardProperties(hazard: Hazard | null | undefined): AnalyticsProperties {
  if (!hazard) {
    return {};
  }

  return {
    hazard_type: hazard.hazardType,
    other_hazard_details: hazard.otherHazardDetails,
  };
}

export function hazardKeyProperties(hazardKey: string | null | undefined): AnalyticsProperties {
  if (!hazardKey) {
    return {};
  }

  const [hazardType, otherHazardDetails = ''] = hazardKey.split('|');
  return {
    hazard_type: hazardType,
    other_hazard_details: otherHazardDetails || undefined,
  };
}

export function actionItemProperties(
  type: 'goal' | 'action' | 'project',
  item: AdaptationGoal | AdaptationAction | ProjectSeekingFunding,
): AnalyticsProperties {
  const hazards = 'hazardsAddressed' in item ? item.hazardsAddressed : undefined;
  const title = 'title' in item ? item.title : '';
  const base: AnalyticsProperties = {
    item_type: type,
    item_key: stableTextKey(title),
    hazards_addressed_count: hazards?.length ?? 0,
  };

  if (type === 'action') {
    const action = item as AdaptationAction;
    return {
      ...base,
      status: action.status?.statusType,
      co_benefits_count: action.coBenefits?.length ?? 0,
    };
  }

  if (type === 'project') {
    const project = item as ProjectSeekingFunding;
    return {
      ...base,
      status: project.status,
      finance_status: project.financeStatus,
      funded_percent: project.fundedPercent,
    };
  }

  const goal = item as AdaptationGoal;
  return {
    ...base,
    target_year: goal.targetYear,
  };
}

export function solutionProperties(solution: SolutionCard): AnalyticsProperties {
  return {
    solution_key: stableTextKey(solution.solution || ''),
    solution_category: solution.solutionCategory,
    hazards_addressed_count: solution.solutionHazardsAddressed?.length ?? 0,
    peer_actions_count: solution.peerActions?.length ?? 0,
    pct_peer_taking_action: solution.pctPeerTakingAction,
    has_local_action: solution.hasLocalAction,
  };
}

function stableTextKey(value: string): string | undefined {
  const normalized = value
    .toLowerCase()
    .replace(/<[^>]*>/g, ' ')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);

  return normalized || undefined;
}
