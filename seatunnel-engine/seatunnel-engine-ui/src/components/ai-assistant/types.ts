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

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  status?: 'sending' | 'streaming' | 'success' | 'error'
  skillUsed?: string
}

export interface Conversation {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  provider: 'dify' | 'spring-ai'
  conversationId?: string // Provider's conversation ID
}

export interface Skill {
  id: string
  name: string
  icon: string
  description: string
  prompt?: string
  enabled: boolean
}

export type DifyAppType = 'chat' | 'completion' | 'workflow'

export interface AIConfig {
  provider: 'dify' | 'spring-ai'
  dify: {
    apiUrl: string
    apiKey: string
    appType: DifyAppType
  }
  springAi: {
    apiUrl: string
  }
}

export const DEFAULT_CONFIG: AIConfig = {
  provider: 'dify',
  dify: {
    apiUrl: 'https://api.dify.ai/v1',
    apiKey: '',
    appType: 'workflow'
  },
  springAi: {
    apiUrl: 'http://localhost:8080/ai/chat'
  }
}

export const DEFAULT_SKILLS: Skill[] = [
  {
    id: 'job-analysis',
    name: 'Job Analysis',
    icon: '📊',
    description: 'Analyze job status and performance',
    prompt: 'Please analyze the following SeaTunnel job information:',
    enabled: true
  },
  {
    id: 'error-diagnosis',
    name: 'Error Diagnosis',
    icon: '🔍',
    description: 'Diagnose job errors and exceptions',
    prompt: 'Please help diagnose the following error:',
    enabled: true
  },
  {
    id: 'config-helper',
    name: 'Config Helper',
    icon: '⚙️',
    description: 'Help with SeaTunnel configuration',
    prompt: 'Please help with the following SeaTunnel configuration:',
    enabled: true
  },
  {
    id: 'sql-generator',
    name: 'SQL Generator',
    icon: '📝',
    description: 'Generate SQL queries for data sync',
    prompt: 'Please generate SQL based on the following requirements:',
    enabled: true
  }
]
