import type {
  GraphQLResolveInfo,
  GraphQLScalarType,
  GraphQLScalarTypeConfig,
} from "graphql";
import type { Context } from "../context/index.js";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
export type MakeEmpty<
  T extends { [key: string]: unknown },
  K extends keyof T,
> = { [_ in K]?: never };
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never;
    };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: NonNullable<T[P]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  DateTime: { input: any; output: any };
};

export type GQLActivityCounts = {
  __typename?: "ActivityCounts";
  newConversationCount: Scalars["Int"]["output"];
};

export type GQLConversation = {
  __typename?: "Conversation";
  contextId: Maybe<Scalars["String"]["output"]>;
  contextType: Maybe<Scalars["String"]["output"]>;
  createdAt: Scalars["String"]["output"];
  createdBy: Scalars["String"]["output"];
  hasUnread: Scalars["Boolean"]["output"];
  id: Scalars["String"]["output"];
  lastMessageAt: Scalars["String"]["output"];
  messages: Array<GQLMessage>;
  participants: Array<GQLConversationParticipant>;
  title: Maybe<Scalars["String"]["output"]>;
};

export type GQLConversationConnection = {
  __typename?: "ConversationConnection";
  nodes: Array<GQLConversation>;
  pageInfo: GQLPageInfo;
  totalCount: Scalars["Int"]["output"];
};

export type GQLConversationParticipant = {
  __typename?: "ConversationParticipant";
  displayName: Maybe<Scalars["String"]["output"]>;
  lastSeenAt: Maybe<Scalars["String"]["output"]>;
  userId: Scalars["String"]["output"];
};

export type GQLCreateConversationInput = {
  contextId?: InputMaybe<Scalars["String"]["input"]>;
  contextType?: InputMaybe<Scalars["String"]["input"]>;
  displayNames?: InputMaybe<Array<GQLParticipantDisplayNameInput>>;
  participantIds: Array<Scalars["String"]["input"]>;
  title?: InputMaybe<Scalars["String"]["input"]>;
};

export type GQLMessage = {
  __typename?: "Message";
  body: Scalars["String"]["output"];
  conversationId: Scalars["String"]["output"];
  createdAt: Scalars["String"]["output"];
  id: Scalars["String"]["output"];
  isDeleted: Scalars["Boolean"]["output"];
  metadata: Maybe<Scalars["String"]["output"]>;
  replyTo: Maybe<Scalars["String"]["output"]>;
  senderId: Scalars["String"]["output"];
};

export type GQLMutation = {
  __typename?: "Mutation";
  createConversation: GQLConversation;
  deleteMessage: Scalars["Boolean"]["output"];
  markAllSeen: Scalars["Boolean"]["output"];
  markConversationSeen: Scalars["Boolean"]["output"];
  sendMessage: GQLMessage;
};

export type GQLMutationCreateConversationArgs = {
  input: GQLCreateConversationInput;
};

export type GQLMutationDeleteMessageArgs = {
  messageId: Scalars["String"]["input"];
};

export type GQLMutationMarkConversationSeenArgs = {
  conversationId: Scalars["String"]["input"];
};

export type GQLMutationSendMessageArgs = {
  body: Scalars["String"]["input"];
  conversationId: Scalars["String"]["input"];
  metadata?: InputMaybe<Scalars["String"]["input"]>;
  replyTo?: InputMaybe<Scalars["String"]["input"]>;
};

export type GQLPageInfo = {
  __typename?: "PageInfo";
  hasNextPage: Scalars["Boolean"]["output"];
  hasPreviousPage: Scalars["Boolean"]["output"];
};

export type GQLParticipantDisplayNameInput = {
  displayName: Scalars["String"]["input"];
  userId: Scalars["String"]["input"];
};

export type GQLQuery = {
  __typename?: "Query";
  activityCounts: GQLActivityCounts;
  conversation: Maybe<GQLConversation>;
  conversationByContext: Maybe<GQLConversation>;
  health: Scalars["String"]["output"];
  myConversations: GQLConversationConnection;
};

export type GQLQueryConversationArgs = {
  id: Scalars["String"]["input"];
};

export type GQLQueryConversationByContextArgs = {
  contextId: Scalars["String"]["input"];
  contextType: Scalars["String"]["input"];
  participantId: Scalars["String"]["input"];
};

export type GQLQueryMyConversationsArgs = {
  contextType?: InputMaybe<Scalars["String"]["input"]>;
  limit?: InputMaybe<Scalars["Int"]["input"]>;
  offset?: InputMaybe<Scalars["Int"]["input"]>;
  search?: InputMaybe<Scalars["String"]["input"]>;
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> =
  | ResolverFn<TResult, TParent, TContext, TArgs>
  | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> {
  subscribe: SubscriptionSubscribeFn<
    { [key in TKey]: TResult },
    TParent,
    TContext,
    TArgs
  >;
  resolve?: SubscriptionResolveFn<
    TResult,
    { [key in TKey]: TResult },
    TContext,
    TArgs
  >;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<
  TResult,
  TKey extends string,
  TParent,
  TContext,
  TArgs,
> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<
  TResult,
  TKey extends string,
  TParent = {},
  TContext = {},
  TArgs = {},
> =
  | ((
      ...args: any[]
    ) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo,
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (
  obj: T,
  context: TContext,
  info: GraphQLResolveInfo,
) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<
  TResult = {},
  TParent = {},
  TContext = {},
  TArgs = {},
> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo,
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type GQLResolversTypes = ResolversObject<{
  ActivityCounts: ResolverTypeWrapper<GQLActivityCounts>;
  Boolean: ResolverTypeWrapper<Scalars["Boolean"]["output"]>;
  Conversation: ResolverTypeWrapper<GQLConversation>;
  ConversationConnection: ResolverTypeWrapper<GQLConversationConnection>;
  ConversationParticipant: ResolverTypeWrapper<GQLConversationParticipant>;
  CreateConversationInput: GQLCreateConversationInput;
  DateTime: ResolverTypeWrapper<Scalars["DateTime"]["output"]>;
  Int: ResolverTypeWrapper<Scalars["Int"]["output"]>;
  Message: ResolverTypeWrapper<GQLMessage>;
  Mutation: ResolverTypeWrapper<{}>;
  PageInfo: ResolverTypeWrapper<GQLPageInfo>;
  ParticipantDisplayNameInput: GQLParticipantDisplayNameInput;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars["String"]["output"]>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type GQLResolversParentTypes = ResolversObject<{
  ActivityCounts: GQLActivityCounts;
  Boolean: Scalars["Boolean"]["output"];
  Conversation: GQLConversation;
  ConversationConnection: GQLConversationConnection;
  ConversationParticipant: GQLConversationParticipant;
  CreateConversationInput: GQLCreateConversationInput;
  DateTime: Scalars["DateTime"]["output"];
  Int: Scalars["Int"]["output"];
  Message: GQLMessage;
  Mutation: {};
  PageInfo: GQLPageInfo;
  ParticipantDisplayNameInput: GQLParticipantDisplayNameInput;
  Query: {};
  String: Scalars["String"]["output"];
}>;

export type GQLActivityCountsResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["ActivityCounts"] =
    GQLResolversParentTypes["ActivityCounts"],
> = ResolversObject<{
  newConversationCount?: Resolver<
    GQLResolversTypes["Int"],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GQLConversationResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["Conversation"] =
    GQLResolversParentTypes["Conversation"],
> = ResolversObject<{
  contextId?: Resolver<
    Maybe<GQLResolversTypes["String"]>,
    ParentType,
    ContextType
  >;
  contextType?: Resolver<
    Maybe<GQLResolversTypes["String"]>,
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  createdBy?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  hasUnread?: Resolver<GQLResolversTypes["Boolean"], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  lastMessageAt?: Resolver<
    GQLResolversTypes["String"],
    ParentType,
    ContextType
  >;
  messages?: Resolver<
    Array<GQLResolversTypes["Message"]>,
    ParentType,
    ContextType
  >;
  participants?: Resolver<
    Array<GQLResolversTypes["ConversationParticipant"]>,
    ParentType,
    ContextType
  >;
  title?: Resolver<Maybe<GQLResolversTypes["String"]>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GQLConversationConnectionResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["ConversationConnection"] =
    GQLResolversParentTypes["ConversationConnection"],
> = ResolversObject<{
  nodes?: Resolver<
    Array<GQLResolversTypes["Conversation"]>,
    ParentType,
    ContextType
  >;
  pageInfo?: Resolver<GQLResolversTypes["PageInfo"], ParentType, ContextType>;
  totalCount?: Resolver<GQLResolversTypes["Int"], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GQLConversationParticipantResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["ConversationParticipant"] =
    GQLResolversParentTypes["ConversationParticipant"],
> = ResolversObject<{
  displayName?: Resolver<
    Maybe<GQLResolversTypes["String"]>,
    ParentType,
    ContextType
  >;
  lastSeenAt?: Resolver<
    Maybe<GQLResolversTypes["String"]>,
    ParentType,
    ContextType
  >;
  userId?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export interface GQLDateTimeScalarConfig extends GraphQLScalarTypeConfig<
  GQLResolversTypes["DateTime"],
  any
> {
  name: "DateTime";
}

export type GQLMessageResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["Message"] =
    GQLResolversParentTypes["Message"],
> = ResolversObject<{
  body?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  conversationId?: Resolver<
    GQLResolversTypes["String"],
    ParentType,
    ContextType
  >;
  createdAt?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  id?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  isDeleted?: Resolver<GQLResolversTypes["Boolean"], ParentType, ContextType>;
  metadata?: Resolver<
    Maybe<GQLResolversTypes["String"]>,
    ParentType,
    ContextType
  >;
  replyTo?: Resolver<
    Maybe<GQLResolversTypes["String"]>,
    ParentType,
    ContextType
  >;
  senderId?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GQLMutationResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["Mutation"] =
    GQLResolversParentTypes["Mutation"],
> = ResolversObject<{
  createConversation?: Resolver<
    GQLResolversTypes["Conversation"],
    ParentType,
    ContextType,
    RequireFields<GQLMutationCreateConversationArgs, "input">
  >;
  deleteMessage?: Resolver<
    GQLResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<GQLMutationDeleteMessageArgs, "messageId">
  >;
  markAllSeen?: Resolver<GQLResolversTypes["Boolean"], ParentType, ContextType>;
  markConversationSeen?: Resolver<
    GQLResolversTypes["Boolean"],
    ParentType,
    ContextType,
    RequireFields<GQLMutationMarkConversationSeenArgs, "conversationId">
  >;
  sendMessage?: Resolver<
    GQLResolversTypes["Message"],
    ParentType,
    ContextType,
    RequireFields<GQLMutationSendMessageArgs, "body" | "conversationId">
  >;
}>;

export type GQLPageInfoResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["PageInfo"] =
    GQLResolversParentTypes["PageInfo"],
> = ResolversObject<{
  hasNextPage?: Resolver<GQLResolversTypes["Boolean"], ParentType, ContextType>;
  hasPreviousPage?: Resolver<
    GQLResolversTypes["Boolean"],
    ParentType,
    ContextType
  >;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type GQLQueryResolvers<
  ContextType = Context,
  ParentType extends GQLResolversParentTypes["Query"] =
    GQLResolversParentTypes["Query"],
> = ResolversObject<{
  activityCounts?: Resolver<
    GQLResolversTypes["ActivityCounts"],
    ParentType,
    ContextType
  >;
  conversation?: Resolver<
    Maybe<GQLResolversTypes["Conversation"]>,
    ParentType,
    ContextType,
    RequireFields<GQLQueryConversationArgs, "id">
  >;
  conversationByContext?: Resolver<
    Maybe<GQLResolversTypes["Conversation"]>,
    ParentType,
    ContextType,
    RequireFields<
      GQLQueryConversationByContextArgs,
      "contextId" | "contextType" | "participantId"
    >
  >;
  health?: Resolver<GQLResolversTypes["String"], ParentType, ContextType>;
  myConversations?: Resolver<
    GQLResolversTypes["ConversationConnection"],
    ParentType,
    ContextType,
    Partial<GQLQueryMyConversationsArgs>
  >;
}>;

export type GQLResolvers<ContextType = Context> = ResolversObject<{
  ActivityCounts?: GQLActivityCountsResolvers<ContextType>;
  Conversation?: GQLConversationResolvers<ContextType>;
  ConversationConnection?: GQLConversationConnectionResolvers<ContextType>;
  ConversationParticipant?: GQLConversationParticipantResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Message?: GQLMessageResolvers<ContextType>;
  Mutation?: GQLMutationResolvers<ContextType>;
  PageInfo?: GQLPageInfoResolvers<ContextType>;
  Query?: GQLQueryResolvers<ContextType>;
}>;
