import type { GQLResolvers } from "../generated/graphql.js";
import { conversationResolvers } from "./conversation.js";
import { messageResolvers } from "./message.js";
import { activityResolvers } from "./activity.js";

// Merge all resolvers
export const resolvers: GQLResolvers = {
  Query: {
    health: () => "ok",
    ...conversationResolvers.Query,
    ...activityResolvers.Query,
  },
  Mutation: {
    ...conversationResolvers.Mutation,
    ...messageResolvers.Mutation,
  },
  Conversation: conversationResolvers.Conversation,
};
