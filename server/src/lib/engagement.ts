// Per-post engagement (comment count, reaction counts, viewer's reaction),
// batched for a feed page in three queries.
import type { Types } from 'mongoose';
import { Comment } from '../models/Comment.js';
import { Reaction, REACTION_TYPES, type ReactionType } from '../models/Reaction.js';

export interface Engagement {
  commentCount: number;
  reactions: Record<ReactionType, number>;
  myReaction: ReactionType | null;
}

export function emptyEngagement(): Engagement {
  const reactions = Object.fromEntries(REACTION_TYPES.map((t) => [t, 0])) as Record<ReactionType, number>;
  return { commentCount: 0, reactions, myReaction: null };
}

export async function fetchEngagement(postIds: Types.ObjectId[], userId: string): Promise<Map<string, Engagement>> {
  const map = new Map<string, Engagement>();
  for (const id of postIds) map.set(id.toString(), emptyEngagement());
  if (postIds.length === 0) return map;

  const [commentCounts, reactionCounts, mine] = await Promise.all([
    Comment.aggregate<{ _id: Types.ObjectId; n: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: '$post', n: { $sum: 1 } } },
    ]),
    Reaction.aggregate<{ _id: { post: Types.ObjectId; type: ReactionType }; n: number }>([
      { $match: { post: { $in: postIds } } },
      { $group: { _id: { post: '$post', type: '$type' }, n: { $sum: 1 } } },
    ]),
    Reaction.find({ post: { $in: postIds }, user: userId }),
  ]);

  for (const row of commentCounts) {
    const e = map.get(row._id.toString());
    if (e) e.commentCount = row.n;
  }
  for (const row of reactionCounts) {
    const e = map.get(row._id.post.toString());
    if (e && (REACTION_TYPES as readonly string[]).includes(row._id.type)) e.reactions[row._id.type] = row.n;
  }
  for (const r of mine) {
    const e = map.get(r.post.toString());
    if (e) e.myReaction = r.type as ReactionType;
  }
  return map;
}

export async function fetchEngagementOne(postId: Types.ObjectId, userId: string): Promise<Engagement> {
  const map = await fetchEngagement([postId], userId);
  return map.get(postId.toString()) ?? emptyEngagement();
}
