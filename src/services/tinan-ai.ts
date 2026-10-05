import {
  assessReadiness,
  type ProjectCategory,
  type TINANBlueprint,
} from '../core/tinan-blueprint';

export interface AIProvider {
  analyze(idea: string): Promise<TINANBlueprint>;
}

function categoryFor(idea: string): ProjectCategory {
  const text = idea.toLowerCase();
  if (/\b(solar|energy|battery|grid|electric|photovoltaic|inverter)\b/.test(text)) return 'Energy';
  if (/\b(data|dataset|sensor|iot|api|proof|meter)\b/.test(text)) return 'Data';
  if (/\b(token|blockchain|web3|smart contract|dao)\b/.test(text)) return 'Web3';
  if (/\b(asset|property|equipment|inventory|resource)\b/.test(text)) return 'Asset';
  if (/\b(business|company|marketplace|service|customer)\b/.test(text)) return 'Business';
  return 'Other';
}

function titleFor(idea: string, category: ProjectCategory): string {
  const trimmed = idea.trim();
  const sentence = trimmed.split(/[.!?\n]/, 1)[0]?.trim() ?? '';
  const words = sentence.split(/\s+/).slice(0, 8).join(' ');
  return words ? `${words}${sentence.split(/\s+/).length > 8 ? '…' : ''}` : `${category} project blueprint`;
}

export class DemoAIProvider implements AIProvider {
  async analyze(idea: string): Promise<TINANBlueprint> {
    const normalizedIdea = idea.trim();
    if (normalizedIdea.length < 12) {
      throw new Error('Describe your idea in at least 12 characters to create an analysis.');
    }

    await new Promise<void>((resolve) => window.setTimeout(resolve, 450));

    const category = categoryFor(normalizedIdea);
    const energyProject = category === 'Energy';
    const dataProject = energyProject || category === 'Data';
    const readiness = assessReadiness({ idea: normalizedIdea });
    const createdAt = new Date().toISOString();
    const projectTitle = titleFor(normalizedIdea, category);

    return {
      id: globalThis.crypto?.randomUUID?.() ?? `blueprint-${Date.now()}`,
      title: projectTitle,
      description: normalizedIdea,
      category,
      problem: 'The project needs a clear way to connect its real-world value, participants, and trustworthy evidence.',
      solution: 'Define the operating model first, then use TINAN AI to organize its data, proof, and optional token utility.',
      tokenizationModel: energyProject
        ? 'Optional project/energy representation after meter data, rights, and verification are established.'
        : 'Optional utility, asset, or data representation after ownership and participant rights are established.',
      tokenType: energyProject ? 'Energy Token (concept)' : 'Project Token (concept)',
      blockchain: 'Not selected. Compare only networks configured for this deployment.',
      utility: 'Specify who can use the token, what it enables, and how that utility is delivered.',
      dataSources: dataProject
        ? ['Identify the operator-controlled source', 'Document collection frequency and access permissions']
        : ['Identify authoritative project records', 'Document source ownership and update process'],
      energyData: energyProject
        ? 'No energy measurements are available from this demo. Connect a real meter, inverter, battery, grid, API, or IoT source before making production claims.'
        : 'Not applicable based on the supplied description; no energy measurements were created.',
      proofModel: 'Hash a user-provided record, retain its source and timestamp, then anchor it on a configured chain only after explicit confirmation.',
      risks: [
        'Token rights, ownership, and transfer restrictions need independent review.',
        'Off-chain evidence may be incomplete, manipulated, or unavailable.',
        'Network fees, contract behavior, and operational dependencies require testing.',
      ],
      complianceNotes: [
        'Assess applicable jurisdictions, privacy obligations, and consumer disclosures with qualified professionals.',
        'This demo does not provide legal, investment, tax, or compliance advice.',
      ],
      readinessScore: readiness.score,
      recommendations: [
        'Define project owners, users, and measurable outcomes.',
        'Identify and obtain permission for each source of data or energy readings.',
        'Choose a token utility only after clarifying rights and operational responsibilities.',
        'Select a configured network and review contracts before any transaction.',
      ],
      createdAt,
    };
  }
}

export const tinanAIProvider: AIProvider = new DemoAIProvider();
