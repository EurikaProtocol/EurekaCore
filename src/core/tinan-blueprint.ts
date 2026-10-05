export const PROJECT_CATEGORIES = [
  'Energy',
  'Data',
  'Web3',
  'Business',
  'Asset',
  'Other',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export type TINANBlueprint = {
  id: string;
  title: string;
  description: string;
  category: ProjectCategory;
  problem: string;
  solution: string;
  tokenizationModel: string;
  tokenType: string;
  blockchain: string;
  utility: string;
  dataSources: string[];
  energyData: string;
  proofModel: string;
  risks: string[];
  complianceNotes: string[];
  readinessScore: number;
  recommendations: string[];
  createdAt: string;
};

export type ProjectStatus =
  | 'DRAFT'
  | 'ANALYZING'
  | 'READY'
  | 'TOKENIZING'
  | 'DEPLOYED'
  | 'VERIFIED'
  | 'LIVE';

export type TINANProject = {
  id: string;
  title: string;
  idea: string;
  status: ProjectStatus;
  blueprint?: TINANBlueprint;
  createdAt: string;
  updatedAt: string;
};

export type ReadinessFactor = {
  label: string;
  ready: boolean;
  points: number;
  explanation: string;
};

export type ReadinessAssessment = {
  score: number;
  factors: ReadinessFactor[];
  disclaimer: string;
};

export type ReadinessInputs = {
  idea: string;
  walletConnected?: boolean;
  networkSelected?: boolean;
  contractSelected?: boolean;
  metadataReady?: boolean;
};

export function assessReadiness({
  idea,
  walletConnected = false,
  networkSelected = false,
  contractSelected = false,
  metadataReady = false,
}: ReadinessInputs): ReadinessAssessment {
  const normalized = idea.toLowerCase();
  const factors: ReadinessFactor[] = [
    {
      label: 'Project definition',
      ready: idea.trim().length >= 40,
      points: 20,
      explanation: 'A clear description of the project, users, and intended outcome.',
    },
    {
      label: 'Token utility',
      ready: /\b(utility|access|reward|governance|ownership|payment|credit|redeem)\b/.test(normalized),
      points: 15,
      explanation: 'A specific role for a token beyond representing an idea.',
    },
    {
      label: 'Data availability',
      ready: /\b(data|sensor|meter|api|record|proof|production|output|source)\b/.test(normalized),
      points: 15,
      explanation: 'Identified data sources and a way to obtain or validate them.',
    },
    {
      label: 'Blockchain readiness',
      ready: networkSelected,
      points: 15,
      explanation: 'A supported chain and its RPC/network settings have been selected.',
    },
    {
      label: 'Wallet readiness',
      ready: walletConnected,
      points: 10,
      explanation: 'A compatible wallet is connected when a transaction is needed.',
    },
    {
      label: 'Smart contract readiness',
      ready: contractSelected,
      points: 10,
      explanation: 'The intended contract and its deployment status are understood.',
    },
    {
      label: 'Metadata readiness',
      ready: metadataReady,
      points: 10,
      explanation: 'Token/project metadata has a defined owner and durable location.',
    },
    {
      label: 'Compliance considerations',
      ready: /\b(compliance|regulation|jurisdiction|legal|privacy|consent)\b/.test(normalized),
      points: 5,
      explanation: 'Relevant legal, privacy, and jurisdiction questions are noted for review.',
    },
  ];

  const possiblePoints = factors.reduce((total, factor) => total + factor.points, 0);
  const earnedPoints = factors.reduce((total, factor) => total + (factor.ready ? factor.points : 0), 0);

  return {
    score: Math.round((earnedPoints / possiblePoints) * 100),
    factors,
    disclaimer: 'Planning aid only; this score is not legal, financial, technical, or compliance certification.',
  };
}
