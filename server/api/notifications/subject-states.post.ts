/// Batch-fetches subject state (open/closed/merged) for notification threads.
import type {
  NotificationSubjectState,
  NotificationSubjectStateResult,
  NotificationSubjectStateTarget,
} from '#shared/types/notifications';

interface GraphQLSubjectNode {
  state?: string;
  mergedAt?: string | null;
}

interface GraphQLSubjectRepository {
  issue?: GraphQLSubjectNode | null;
  pullRequest?: GraphQLSubjectNode | null;
}

interface GraphQLSubjectResponse {
  [key: string]: GraphQLSubjectRepository | null | undefined;
}

const maxTargets = 50;
const maxGraphQLInt = 2_147_483_647;

const isSubjectTarget = (value: unknown): value is NotificationSubjectStateTarget => {
  if (!value || typeof value !== 'object') return false;

  const target = value as Partial<NotificationSubjectStateTarget>;
  return (
    typeof target.key === 'string' &&
    typeof target.owner === 'string' &&
    typeof target.repo === 'string' &&
    (target.type === 'issues' || target.type === 'pulls') &&
    typeof target.number === 'number' &&
    Number.isSafeInteger(target.number) &&
    target.number > 0 &&
    target.number <= maxGraphQLInt
  );
};

const normalizeState = (
  type: NotificationSubjectStateTarget['type'],
  node: GraphQLSubjectNode | null | undefined
): NotificationSubjectState | undefined => {
  if (!node?.state) return undefined;

  // Pull requests with a merge date are considered "merged" even though GitHub reports them as "closed"
  if (type === 'pulls' && node.mergedAt) return 'merged';

  const state = node.state.toLowerCase();
  return state === 'open' || state === 'closed' ? state : undefined;
};
/** Build a batched GraphQL query with aliased fields to resolve multiple subjects in one round-trip. */

const buildSubjectStatesQuery = (targets: NotificationSubjectStateTarget[]) => {
  const variables: string[] = [];
  const fields: string[] = [];
  const values: Record<string, string | number> = {};

  targets.forEach((target, index) => {
    variables.push(`$owner${index}: String!`, `$repo${index}: String!`, `$number${index}: Int!`);
    values[`owner${index}`] = target.owner;
    values[`repo${index}`] = target.repo;
    values[`number${index}`] = target.number;

    const fieldName = target.type === 'pulls' ? 'pullRequest' : 'issue';
    const nodeFields = target.type === 'pulls' ? 'state mergedAt' : 'state';
    fields.push(
      `subject${index}: repository(owner: $owner${index}, name: $repo${index}) { ${fieldName}(number: $number${index}) { ${nodeFields} } }`
    );
  });

  return {
    query: `query NotificationSubjectStates(${variables.join(', ')}) { ${fields.join('\n')} }`,
    variables: values,
  };
};

const normalizeSubjectTargetsBody = (body: unknown) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification subject state request body',
    });
  }

  const targets = (body as { targets?: unknown }).targets;

  if (!Array.isArray(targets)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification subject state request body',
    });
  }

  const normalizedTargets = targets.slice(0, maxTargets);
  if (!normalizedTargets.every(isSubjectTarget)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid notification subject state request body',
    });
  }

  return normalizedTargets;
};

/** Batch-fetch the open/closed/merged state of notification subject items via GraphQL. */
export default defineEventHandler(async (event) => {
  const targets = normalizeSubjectTargetsBody(await readBody(event));

  if (targets.length === 0) {
    return { items: [] satisfies NotificationSubjectStateResult[] };
  }

  const octokit = await getGitHubClient(event);
  const { query, variables } = buildSubjectStatesQuery(targets);

  try {
    const payload = await octokit.graphql<GraphQLSubjectResponse>(query, variables);

    const items = targets.map((target, index): NotificationSubjectStateResult => {
      const repository = payload[`subject${index}`];
      const node = target.type === 'pulls' ? repository?.pullRequest : repository?.issue;

      return {
        key: target.key,
        state: normalizeState(target.type, node),
      };
    });

    return { items };
  } catch (error) {
    console.error('Error fetching notification subject states:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch notification subject states',
    });
  }
});
