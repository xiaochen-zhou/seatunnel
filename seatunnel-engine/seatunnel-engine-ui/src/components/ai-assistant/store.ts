/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ref, computed } from 'vue'
import type { Message, Conversation, AIConfig, Skill, DifyAppType } from './types'
import { DEFAULT_CONFIG, DEFAULT_SKILLS } from './types'

const STORAGE_KEY_CONFIG = 'seatunnel_ai_config'
const STORAGE_KEY_CONVERSATIONS = 'seatunnel_ai_conversations'
const STORAGE_KEY_SKILLS = 'seatunnel_ai_skills'

// State
const isOpen = ref(false)
const isSettingsOpen = ref(false)
const isHistoryOpen = ref(false)
const conversations = ref<Conversation[]>([])
const currentConversationId = ref<string | null>(null)
const config = ref<AIConfig>(DEFAULT_CONFIG)
const skills = ref<Skill[]>(DEFAULT_SKILLS)
const isStreaming = ref(false)

// Initialize from localStorage
const initFromStorage = () => {
  try {
    const savedConfig = localStorage.getItem(STORAGE_KEY_CONFIG)
    if (savedConfig) {
      config.value = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) }
    }

    const savedConversations = localStorage.getItem(STORAGE_KEY_CONVERSATIONS)
    if (savedConversations) {
      conversations.value = JSON.parse(savedConversations)
    }

    const savedSkills = localStorage.getItem(STORAGE_KEY_SKILLS)
    if (savedSkills) {
      skills.value = JSON.parse(savedSkills)
    }
  } catch (e) {
    console.error('Failed to load AI assistant state:', e)
  }
}

// Save to localStorage
const saveConfig = () => {
  localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config.value))
}

const saveConversations = () => {
  localStorage.setItem(STORAGE_KEY_CONVERSATIONS, JSON.stringify(conversations.value))
}

const saveSkills = () => {
  localStorage.setItem(STORAGE_KEY_SKILLS, JSON.stringify(skills.value))
}

// Computed
const currentConversation = computed(() => {
  return conversations.value.find(c => c.id === currentConversationId.value) || null
})

const sortedConversations = computed(() => {
  return [...conversations.value].sort((a, b) => b.updatedAt - a.updatedAt)
})

// Actions
const toggleOpen = () => {
  isOpen.value = !isOpen.value
}

const openChat = () => {
  isOpen.value = true
}

const closeChat = () => {
  isOpen.value = false
}

const toggleSettings = () => {
  isSettingsOpen.value = !isSettingsOpen.value
  isHistoryOpen.value = false
}

const toggleHistory = () => {
  isHistoryOpen.value = !isHistoryOpen.value
  isSettingsOpen.value = false
}

const closeAllPanels = () => {
  isSettingsOpen.value = false
  isHistoryOpen.value = false
}

const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

const createConversation = (): Conversation => {
  const now = Date.now()
  const conversation: Conversation = {
    id: generateId(),
    title: 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
    provider: config.value.provider
  }
  conversations.value.unshift(conversation)
  currentConversationId.value = conversation.id
  saveConversations()
  closeAllPanels()
  return conversation
}

const selectConversation = (id: string) => {
  currentConversationId.value = id
  closeAllPanels()
}

const deleteConversation = (id: string) => {
  const index = conversations.value.findIndex(c => c.id === id)
  if (index !== -1) {
    conversations.value.splice(index, 1)
    if (currentConversationId.value === id) {
      currentConversationId.value = conversations.value.length > 0
        ? conversations.value[0].id
        : null
    }
    saveConversations()
  }
}

const clearAllConversations = () => {
  conversations.value = []
  currentConversationId.value = null
  saveConversations()
}

const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
  if (!currentConversation.value) {
    createConversation()
  }

  const newMessage: Message = {
    ...message,
    id: generateId(),
    timestamp: Date.now()
  }

  currentConversation.value!.messages.push(newMessage)
  currentConversation.value!.updatedAt = Date.now()

  // Update conversation title from first user message
  if (message.role === 'user' && currentConversation.value!.messages.filter(m => m.role === 'user').length === 1) {
    currentConversation.value!.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
  }

  saveConversations()
  return newMessage
}

const updateMessage = (messageId: string, updates: Partial<Message>) => {
  if (!currentConversation.value) return

  const message = currentConversation.value.messages.find(m => m.id === messageId)
  if (message) {
    Object.assign(message, updates)
    saveConversations()
  }
}

const updateConfig = (newConfig: Partial<AIConfig>) => {
  config.value = { ...config.value, ...newConfig }
  saveConfig()
}

const toggleSkill = (skillId: string) => {
  const skill = skills.value.find(s => s.id === skillId)
  if (skill) {
    skill.enabled = !skill.enabled
    saveSkills()
  }
}

// API calls
const sendToDify = async (message: string, onChunk: (chunk: string) => void): Promise<void> => {
  const { apiUrl, apiKey, appType } = config.value.dify

  if (!apiKey) {
    throw new Error('Dify API key is not configured')
  }

  // Determine endpoint based on app type
  let endpoint: string
  let requestBody: Record<string, unknown>

  switch (appType) {
    case 'chat':
      endpoint = `${apiUrl}/chat-messages`
      requestBody = {
        inputs: {},
        query: message,
        response_mode: 'streaming',
        user: 'seatunnel-user-' + Date.now()
      }
      if (currentConversation.value?.conversationId) {
        requestBody.conversation_id = currentConversation.value.conversationId
      }
      break

    case 'completion':
      endpoint = `${apiUrl}/completion-messages`
      requestBody = {
        inputs: { query: message },
        response_mode: 'streaming',
        user: 'seatunnel-user-' + Date.now()
      }
      break

    case 'workflow':
    default:
      endpoint = `${apiUrl}/workflows/run`
      requestBody = {
        inputs: { query: message },
        response_mode: 'streaming',
        user: 'seatunnel-user-' + Date.now()
      }
      break
  }

  console.log('Dify request:', endpoint, requestBody)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestBody)
  })

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Dify API error response:', errorText)
    throw new Error(`Dify API error: ${response.status} - ${errorText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          console.log('Dify stream data:', data)

          // Handle different event types based on app type
          if (appType === 'workflow') {
            // Workflow events: workflow_started, node_started, node_finished, workflow_finished, text_chunk
            if (data.event === 'text_chunk' && data.data?.text) {
              onChunk(data.data.text)
            } else if (data.event === 'node_finished' && data.data?.outputs?.text) {
              onChunk(data.data.outputs.text)
            }
          } else {
            // Chat/Completion events: message, agent_message
            if ((data.event === 'message' || data.event === 'agent_message') && data.answer) {
              onChunk(data.answer)
            }
          }

          // Save conversation_id for multi-turn (chat apps only)
          if (data.conversation_id && currentConversation.value && appType === 'chat') {
            currentConversation.value.conversationId = data.conversation_id
            saveConversations()
          }
        } catch (e) {
          // Ignore JSON parse errors for incomplete chunks
        }
      }
    }
  }
}

const sendToSpringAI = async (message: string, onChunk: (chunk: string) => void): Promise<void> => {
  const { apiUrl } = config.value.springAi

  const messages = currentConversation.value?.messages.map(m => ({
    role: m.role,
    content: m.content
  })) || []

  messages.push({ role: 'user', content: message })

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'text/event-stream'
    },
    body: JSON.stringify({
      messages,
      stream: true
    })
  })

  if (!response.ok) {
    throw new Error(`Spring AI API error: ${response.status}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data:')) {
        const data = line.slice(5).trim()
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data)
            const content = parsed.choices?.[0]?.delta?.content ||
                           parsed.result ||
                           parsed.content ||
                           data
            if (content) {
              onChunk(content)
            }
          } catch {
            // Plain text response
            onChunk(data)
          }
        }
      }
    }
  }
}

const sendMessage = async (content: string, skillId?: string) => {
  if (!content.trim() || isStreaming.value) return

  // Ensure we have a conversation
  if (!currentConversation.value) {
    createConversation()
  }

  // Add skill prompt if using a skill
  let finalContent = content
  if (skillId) {
    const skill = skills.value.find(s => s.id === skillId)
    if (skill?.prompt) {
      finalContent = `${skill.prompt}\n\n${content}`
    }
  }

  // Add user message
  addMessage({
    role: 'user',
    content,
    status: 'success',
    skillUsed: skillId
  })

  // Add assistant message placeholder
  const assistantMessage = addMessage({
    role: 'assistant',
    content: '',
    status: 'streaming'
  })

  isStreaming.value = true
  let responseContent = ''

  try {
    const onChunk = (chunk: string) => {
      responseContent += chunk
      updateMessage(assistantMessage.id, { content: responseContent })
    }

    if (config.value.provider === 'dify') {
      await sendToDify(finalContent, onChunk)
    } else {
      await sendToSpringAI(finalContent, onChunk)
    }

    updateMessage(assistantMessage.id, { status: 'success' })
  } catch (error) {
    updateMessage(assistantMessage.id, {
      content: responseContent || `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
      status: 'error'
    })
  } finally {
    isStreaming.value = false
  }
}

// Initialize
initFromStorage()

// Export store
export const useAIStore = () => ({
  // State
  isOpen,
  isSettingsOpen,
  isHistoryOpen,
  conversations,
  currentConversationId,
  config,
  skills,
  isStreaming,

  // Computed
  currentConversation,
  sortedConversations,

  // Actions
  toggleOpen,
  openChat,
  closeChat,
  toggleSettings,
  toggleHistory,
  closeAllPanels,
  createConversation,
  selectConversation,
  deleteConversation,
  clearAllConversations,
  addMessage,
  updateMessage,
  updateConfig,
  toggleSkill,
  sendMessage
})
