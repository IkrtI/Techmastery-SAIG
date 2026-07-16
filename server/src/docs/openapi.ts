// OpenAPI document built from the SAME zod schemas the routes validate with
// (SPECS §5 endpoints, §6 shapes). Served at /api/docs.
import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import {
  commentBodySchema,
  createMoodBodySchema,
  idParamsSchema,
  listMoodsQuerySchema,
  moodTypeSchema,
  onboardingBodySchema,
  reactionBodySchema,
  statsQuerySchema,
} from '../routes/schemas.js';
import { REACTION_TYPES } from '../models/Reaction.js';

extendZodWithOpenApi(z);

const registry = new OpenAPIRegistry();

const bearerAuth = registry.registerComponent('securitySchemes', 'bearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

const facultyPublic = z
  .object({ slug: z.string(), nameTh: z.string(), nameEn: z.string() })
  .openapi('FacultyPublic');

const reactionCounts = z
  .object(Object.fromEntries(REACTION_TYPES.map((t) => [t, z.number().int()])) as Record<(typeof REACTION_TYPES)[number], z.ZodNumber>)
  .openapi('ReactionCounts');

const moodPublic = z
  .object({
    id: z.string(),
    moodType: moodTypeSchema,
    text: z.string(),
    faculty: facultyPublic.nullable(),
    major: z.string(),
    year: z.number().int(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    isMine: z.boolean(),
    commentCount: z.number().int(),
    reactions: reactionCounts,
    myReaction: z.enum(REACTION_TYPES).nullable(),
  })
  .openapi('MoodPublic', {
    description: 'The only mood serializer — never contains author-identifying fields (anonymity invariant).',
  });

const userPublic = z
  .object({
    id: z.string(),
    email: z.string().email(),
    studentId: z.string(),
    faculty: facultyPublic.extend({ id: z.string(), knownMajors: z.array(z.string()) }).nullable(),
    major: z.string().nullable(),
    year: z.number().int().nullable(),
    role: z.enum(['user', 'admin']),
    onboarded: z.boolean(),
  })
  .openapi('UserPublic');

const errorBody = z
  .object({
    error: z.object({
      code: z.enum([
        'VALIDATION_ERROR',
        'UNAUTHENTICATED',
        'TOKEN_EXPIRED',
        'NOT_ONBOARDED',
        'FORBIDDEN',
        'NOT_FOUND',
        'RATE_LIMITED',
        'INTERNAL',
      ]),
      message: z.string(),
      details: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
    }),
  })
  .openapi('ApiError');

const moodPage = z.object({ items: z.array(moodPublic), nextCursor: z.string().nullable() }).openapi('MoodPage');
const statsOverview = z
  .object({
    total: z.number().int(),
    counts: z.object({
      happy: z.number().int(),
      hyped: z.number().int(),
      meh: z.number().int(),
      tired: z.number().int(),
      stressed: z.number().int(),
      sad: z.number().int(),
    }),
  })
  .openapi('StatsOverview');

const errorResponses = {
  400: { description: 'Validation error', content: { 'application/json': { schema: errorBody } } },
  401: { description: 'Unauthenticated / token expired', content: { 'application/json': { schema: errorBody } } },
  403: { description: 'Forbidden / not onboarded', content: { 'application/json': { schema: errorBody } } },
  404: { description: 'Not found', content: { 'application/json': { schema: errorBody } } },
  429: { description: 'Rate limited', content: { 'application/json': { schema: errorBody } } },
} as const;

const secured = [{ [bearerAuth.name]: [] }];

registry.registerPath({
  method: 'get',
  path: '/api/health',
  summary: 'Health check',
  responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } } } },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/login',
  summary: 'Begin KMITL SSO login (302 to Keycloak authorize; sets state/PKCE/nonce cookies)',
  responses: { 302: { description: 'Redirect to Keycloak' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/callback',
  summary: 'OIDC callback — exchanges code, verifies id_token via JWKS, upserts user, sets refresh cookie',
  request: { query: z.object({ code: z.string(), state: z.string() }) },
  responses: { 302: { description: 'Redirect to APP_URL (/onboarding when not onboarded)' }, 400: errorResponses[400] },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/refresh',
  summary: 'Rotate refresh token (cookie) → new access token + user',
  responses: {
    200: {
      description: 'New access token',
      content: { 'application/json': { schema: z.object({ accessToken: z.string(), user: userPublic }) } },
    },
    401: errorResponses[401],
    429: errorResponses[429],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/auth/logout',
  summary: 'Revoke the presented refresh token (idempotent)',
  responses: { 204: { description: 'Logged out' } },
});

registry.registerPath({
  method: 'get',
  path: '/api/auth/me',
  summary: 'Authenticated user re-fetch',
  security: secured,
  responses: {
    200: { description: 'Current user', content: { 'application/json': { schema: z.object({ user: userPublic }) } } },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/auth/onboarding',
  summary: 'Complete onboarding (faculty, normalized major, year)',
  security: secured,
  request: { body: { content: { 'application/json': { schema: onboardingBodySchema } } } },
  responses: {
    200: { description: 'Updated user', content: { 'application/json': { schema: z.object({ user: userPublic }) } } },
    400: errorResponses[400],
    401: errorResponses[401],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/moods',
  summary: 'Anonymous mood feed — filters + cursor pagination',
  security: secured,
  request: { query: listMoodsQuerySchema },
  responses: {
    200: { description: 'Feed page', content: { 'application/json': { schema: moodPage } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/moods',
  summary: 'Create a mood (author context denormalized server-side)',
  security: secured,
  request: { body: { content: { 'application/json': { schema: createMoodBodySchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: moodPublic } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    429: errorResponses[429],
  },
});

registry.registerPath({
  method: 'patch',
  path: '/api/moods/{id}',
  summary: 'Edit own mood',
  security: secured,
  request: {
    params: idParamsSchema,
    body: { content: { 'application/json': { schema: z.object({ moodType: moodTypeSchema.optional(), text: z.string().min(1).max(280).optional() }) } } },
  },
  responses: {
    200: { description: 'Updated', content: { 'application/json': { schema: moodPublic } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/moods/{id}',
  summary: 'Delete own mood',
  security: secured,
  request: { params: idParamsSchema },
  responses: { 204: { description: 'Deleted' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

const commentPublic = z
  .object({
    id: z.string(),
    text: z.string(),
    faculty: facultyPublic.nullable(),
    year: z.number().int(),
    createdAt: z.string().datetime(),
    isMine: z.boolean(),
  })
  .openapi('CommentPublic', { description: 'Anonymous like posts: no author-identifying fields.' });

registry.registerPath({
  method: 'get',
  path: '/api/moods/{id}/comments',
  summary: 'Comments under a post (anonymous, oldest-first)',
  security: secured,
  request: { params: idParamsSchema },
  responses: {
    200: { description: 'Comments', content: { 'application/json': { schema: z.object({ items: z.array(commentPublic) }) } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'post',
  path: '/api/moods/{id}/comments',
  summary: 'Add an encouragement comment (profanity-screened)',
  security: secured,
  request: { params: idParamsSchema, body: { content: { 'application/json': { schema: commentBodySchema } } } },
  responses: {
    201: { description: 'Created', content: { 'application/json': { schema: commentPublic } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
    429: errorResponses[429],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/comments/{id}',
  summary: 'Delete a comment (owner or admin)',
  security: secured,
  request: { params: idParamsSchema },
  responses: { 204: { description: 'Deleted' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

const reactionState = z.object({ reactions: reactionCounts, myReaction: z.enum(REACTION_TYPES).nullable() });

registry.registerPath({
  method: 'put',
  path: '/api/moods/{id}/reaction',
  summary: 'Set/replace your reaction (one per user per post)',
  security: secured,
  request: { params: idParamsSchema, body: { content: { 'application/json': { schema: reactionBodySchema } } } },
  responses: {
    200: { description: 'Fresh counts', content: { 'application/json': { schema: reactionState } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/moods/{id}/reaction',
  summary: 'Remove your reaction',
  security: secured,
  request: { params: idParamsSchema },
  responses: {
    200: { description: 'Fresh counts', content: { 'application/json': { schema: reactionState } } },
    401: errorResponses[401],
    403: errorResponses[403],
    404: errorResponses[404],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/stats/overview',
  summary: 'Mood counts under the current filters',
  security: secured,
  request: { query: statsQuerySchema },
  responses: {
    200: { description: 'Counts', content: { 'application/json': { schema: statsOverview } } },
    400: errorResponses[400],
    401: errorResponses[401],
    403: errorResponses[403],
  },
});

registry.registerPath({
  method: 'get',
  path: '/api/faculties',
  summary: 'Faculty list with seed-managed major suggestions',
  security: secured,
  responses: {
    200: {
      description: 'Faculties',
      content: {
        'application/json': {
          schema: z.array(facultyPublic.extend({ id: z.string(), knownMajors: z.array(z.string()) })),
        },
      },
    },
    401: errorResponses[401],
  },
});

registry.registerPath({
  method: 'delete',
  path: '/api/admin/moods/{id}',
  summary: 'Moderation delete — any mood (admin only)',
  security: secured,
  request: { params: idParamsSchema },
  responses: { 204: { description: 'Deleted' }, 401: errorResponses[401], 403: errorResponses[403], 404: errorResponses[404] },
});

export function buildOpenApiDocument() {
  return new OpenApiGeneratorV3(registry.definitions).generateDocument({
    openapi: '3.0.3',
    info: {
      title: 'Mood of the Major API',
      version: '1.0.0',
      description: 'Anonymous mood-sharing platform for KMITL students. Feed/stats responses never contain author-identifying fields.',
    },
    servers: [{ url: '/' }],
  });
}
