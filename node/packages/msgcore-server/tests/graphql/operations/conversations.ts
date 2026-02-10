export const HEALTH_QUERY = `
  query Health {
    health
  }
`;

export const GET_CONVERSATION = `
  query GetConversation($id: String!) {
    conversation(id: $id) {
      id
      contextType
      contextId
      title
      createdBy
      lastMessageAt
      createdAt
      participants {
        userId
        displayName
        lastSeenAt
      }
      messages {
        id
        conversationId
        senderId
        body
        metadata
        replyTo
        isDeleted
        createdAt
      }
      hasUnread
    }
  }
`;

export const GET_CONVERSATION_BY_CONTEXT = `
  query GetConversationByContext($contextType: String!, $contextId: String!, $participantId: String!) {
    conversationByContext(contextType: $contextType, contextId: $contextId, participantId: $participantId) {
      id
      contextType
      contextId
      title
      createdBy
    }
  }
`;

export const MY_CONVERSATIONS = `
  query MyConversations($contextType: String, $search: String, $limit: Int, $offset: Int) {
    myConversations(contextType: $contextType, search: $search, limit: $limit, offset: $offset) {
      nodes {
        id
        contextType
        contextId
        title
        createdBy
        lastMessageAt
        hasUnread
      }
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
      }
    }
  }
`;

export const ACTIVITY_COUNTS = `
  query ActivityCounts {
    activityCounts {
      newConversationCount
    }
  }
`;

export const CREATE_CONVERSATION = `
  mutation CreateConversation($input: CreateConversationInput!) {
    createConversation(input: $input) {
      id
      contextType
      contextId
      title
      createdBy
      lastMessageAt
      createdAt
      participants {
        userId
        displayName
      }
    }
  }
`;

export const SEND_MESSAGE = `
  mutation SendMessage($conversationId: String!, $body: String!, $metadata: String, $replyTo: String) {
    sendMessage(conversationId: $conversationId, body: $body, metadata: $metadata, replyTo: $replyTo) {
      id
      conversationId
      senderId
      body
      metadata
      replyTo
      isDeleted
      createdAt
    }
  }
`;

export const DELETE_MESSAGE = `
  mutation DeleteMessage($messageId: String!) {
    deleteMessage(messageId: $messageId)
  }
`;

export const MARK_CONVERSATION_SEEN = `
  mutation MarkConversationSeen($conversationId: String!) {
    markConversationSeen(conversationId: $conversationId)
  }
`;

export const MARK_ALL_SEEN = `
  mutation MarkAllSeen {
    markAllSeen
  }
`;
