import { GraphQLError } from "graphql";
import type { GQLResolvers } from "../generated/graphql.js";

function requireAuth(userId: string | null): string {
  if (userId === null) {
    throw new GraphQLError("Authentication required");
  }
  return userId;
}

export const activityResolvers: GQLResolvers = {
  Query: {
    activityCounts: (_parent, _args, context) => {
      const userId = requireAuth(context.userId);

      const newConversationCount =
        context.repos.userActivity.countNewConversations(userId);

      return { newConversationCount };
    },
  },
};
