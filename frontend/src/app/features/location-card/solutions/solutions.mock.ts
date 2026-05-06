import { HazardEnum, LocationProfile, SolutionCategoryEnum, SolutionCard } from '@pac-api/client';

export const MOCK_SOLUTION_CARD: SolutionCard = {
  solution: 'Test Solution',
  solutionCategory: SolutionCategoryEnum.ENGINEERED_BUILT_ENVIRONMENT,
  pctPeerTakingAction: 50,
  hasLocalAction: true,
  solutionHazardsAddressed: [{ hazardType: HazardEnum.EXTREME_HEAT }],
  hazardFilter: 'All',
  peerActions: [
    {
      peerName: 'Peer City 1',
      action: {
        title: 'Peer Action 1',
        description: 'Description 1',
        timeframe: '2025',
      },
    },
    {
      peerName: 'Peer City 2',
      action: {
        title: 'Peer Action 2',
        description: 'Description 2',
        timeframe: '2030',
      },
    },
  ],
};

export const MOCK_LOCATION_DATA_WITH_SOLUTIONS: LocationProfile = {
  organizationId: 12345,
  name: 'San Francisco',
  countryName: 'United States',
  lat: 37.7749,
  lng: -122.4194,
  geometry: {
    type: 'Point',
    coordinates: [0, 0],
  },
  hazards: {
    statistics: {
      vulnerableSectors: [],
    },
    hazards: [
      {
        hazard: { hazardType: HazardEnum.EXTREME_HEAT },
        hazardRank: 1,
      },
      {
        hazard: { hazardType: HazardEnum.URBAN_FLOODING },
        hazardRank: 2,
      },
    ],
  },
  governmentActions: {
    goals: [],
    actions: [],
    projects: [],
  },
  solutions: {
    solutions: {
      [SolutionCategoryEnum.ENGINEERED_BUILT_ENVIRONMENT]: [MOCK_SOLUTION_CARD],
      [SolutionCategoryEnum.ECONOMIC]: [
        {
          solution: 'Economic Solution',
          solutionCategory: SolutionCategoryEnum.ECONOMIC,
          solutionHazardsAddressed: [{ hazardType: HazardEnum.URBAN_FLOODING }],
          hazardFilter: 'All',
          peerActions: [],
        },
      ],
    },
  },
};
