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

import { defineComponent, ref, nextTick, watch, Transition } from 'vue'
import {
  NButton,
  NInput,
  NScrollbar,
  NTooltip,
  NTag,
  NPopconfirm,
  NEmpty,
  NSelect,
  NSwitch,
  NInputGroup
} from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useAIStore } from './store'
import type { Message, Skill, Conversation } from './types'

export default defineComponent({
  name: 'AIAssistant',
  setup() {
    const { t } = useI18n()
    const store = useAIStore()

    const inputValue = ref('')
    const selectedSkill = ref<string | null>(null)
    const messagesEndRef = ref<HTMLDivElement | null>(null)

    // Auto scroll to bottom when messages change
    watch(
      () => store.currentConversation.value?.messages.length,
      () => {
        nextTick(() => {
          messagesEndRef.value?.scrollIntoView({ behavior: 'smooth' })
        })
      }
    )

    const handleSend = () => {
      if (!inputValue.value.trim() || store.isStreaming.value) return
      store.sendMessage(inputValue.value, selectedSkill.value || undefined)
      inputValue.value = ''
      selectedSkill.value = null
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    }

    const formatTime = (timestamp: number) => {
      return new Date(timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    const formatDate = (timestamp: number) => {
      const date = new Date(timestamp)
      const today = new Date()
      if (date.toDateString() === today.toDateString()) {
        return t('ai.today') || 'Today'
      }
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      if (date.toDateString() === yesterday.toDateString()) {
        return t('ai.yesterday') || 'Yesterday'
      }
      return date.toLocaleDateString()
    }

    // Render message bubble
    const renderMessage = (msg: Message) => {
      const isUser = msg.role === 'user'
      return (
        <div
          key={msg.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '16px'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              flexDirection: isUser ? 'row-reverse' : 'row',
              maxWidth: '85%'
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: isUser
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '14px',
                flexShrink: 0
              }}
            >
              {isUser ? '👤' : '🤖'}
            </div>

            {/* Message content */}
            <div
              style={{
                padding: '12px 16px',
                borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                backgroundColor: isUser ? '#667eea' : '#f0f2f5',
                color: isUser ? '#fff' : '#1a1a2e',
                fontSize: '14px',
                lineHeight: '1.6',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
            >
              {msg.status === 'streaming' && !msg.content ? (
                <div style={{ display: 'flex', gap: '4px' }}>
                  <span class="typing-dot" style={{ animationDelay: '0s' }}>●</span>
                  <span class="typing-dot" style={{ animationDelay: '0.2s' }}>●</span>
                  <span class="typing-dot" style={{ animationDelay: '0.4s' }}>●</span>
                </div>
              ) : (
                msg.content
              )}
              {msg.status === 'error' && (
                <span style={{ color: isUser ? '#ffcccc' : '#d03050' }}> ⚠️</span>
              )}
            </div>
          </div>

          {/* Timestamp & Skill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '4px',
              paddingLeft: isUser ? '0' : '40px',
              paddingRight: isUser ? '40px' : '0'
            }}
          >
            <span style={{ fontSize: '11px', color: '#999' }}>{formatTime(msg.timestamp)}</span>
            {msg.skillUsed && (
              <NTag size="tiny" round bordered={false}>
                {store.skills.value.find(s => s.id === msg.skillUsed)?.icon}{' '}
                {store.skills.value.find(s => s.id === msg.skillUsed)?.name}
              </NTag>
            )}
          </div>
        </div>
      )
    }

    // Render conversation item
    const renderConversationItem = (conv: Conversation) => (
      <div
        key={conv.id}
        onClick={() => store.selectConversation(conv.id)}
        style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '8px',
          cursor: 'pointer',
          backgroundColor: conv.id === store.currentConversationId.value ? '#e8f4fd' : '#f8fafc',
          border: conv.id === store.currentConversationId.value ? '1px solid #2080f0' : '1px solid transparent',
          transition: 'all 0.2s ease'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div
              style={{
                fontWeight: '500',
                fontSize: '14px',
                color: '#1a1a2e',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {conv.title}
            </div>
            <div style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>
              {formatDate(conv.updatedAt)} · {conv.messages.length} {t('ai.messages') || 'messages'}
            </div>
          </div>
          <NPopconfirm
            onPositiveClick={(e: Event) => {
              e.stopPropagation()
              store.deleteConversation(conv.id)
            }}
          >
            {{
              trigger: () => (
                <NButton
                  quaternary
                  circle
                  size="tiny"
                  onClick={(e: Event) => e.stopPropagation()}
                  style={{ color: '#999' }}
                >
                  🗑️
                </NButton>
              ),
              default: () => t('ai.confirmDelete') || 'Delete this conversation?'
            }}
          </NPopconfirm>
        </div>
      </div>
    )

    // Render skill button
    const renderSkillButton = (skill: Skill) => (
      <NTooltip key={skill.id}>
        {{
          trigger: () => (
            <NButton
              size="small"
              secondary={selectedSkill.value !== skill.id}
              type={selectedSkill.value === skill.id ? 'primary' : 'default'}
              onClick={() => {
                selectedSkill.value = selectedSkill.value === skill.id ? null : skill.id
              }}
              disabled={!skill.enabled}
              style={{ borderRadius: '20px' }}
            >
              {skill.icon} {skill.name}
            </NButton>
          ),
          default: () => skill.description
        }}
      </NTooltip>
    )

    return () => (
      <>
        {/* Floating Button */}
        <div
          onClick={store.toggleOpen}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 4px 20px rgba(102, 126, 234, 0.5)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            transition: 'all 0.3s ease',
            zIndex: 1000,
            transform: store.isOpen.value ? 'scale(0)' : 'scale(1)'
          }}
        >
          🤖
        </div>

        {/* Chat Window */}
        <Transition name="slide-up">
          {store.isOpen.value && (
            <div
              style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                width: '70%',
                maxWidth: '900px',
                height: '70vh',
                maxHeight: '700px',
                backgroundColor: '#fff',
                borderRadius: '20px',
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.15)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                zIndex: 1001
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '16px 20px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>🤖</span>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '16px' }}>
                      {t('ai.title') || 'AI Assistant'}
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.8 }}>
                      {store.config.value.provider === 'dify' ? 'Dify' : 'Spring AI'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <NTooltip>
                    {{
                      trigger: () => (
                        <NButton
                          quaternary
                          circle
                          size="small"
                          onClick={store.createConversation}
                          style={{ color: '#fff' }}
                        >
                          ➕
                        </NButton>
                      ),
                      default: () => t('ai.newChat') || 'New Chat'
                    }}
                  </NTooltip>
                  <NTooltip>
                    {{
                      trigger: () => (
                        <NButton
                          quaternary
                          circle
                          size="small"
                          onClick={store.toggleHistory}
                          style={{ color: '#fff' }}
                        >
                          📜
                        </NButton>
                      ),
                      default: () => t('ai.history') || 'History'
                    }}
                  </NTooltip>
                  <NTooltip>
                    {{
                      trigger: () => (
                        <NButton
                          quaternary
                          circle
                          size="small"
                          onClick={store.toggleSettings}
                          style={{ color: '#fff' }}
                        >
                          ⚙️
                        </NButton>
                      ),
                      default: () => t('ai.settings') || 'Settings'
                    }}
                  </NTooltip>
                  <NButton
                    quaternary
                    circle
                    size="small"
                    onClick={store.closeChat}
                    style={{ color: '#fff' }}
                  >
                    ✕
                  </NButton>
                </div>
              </div>

              {/* Main Content Area */}
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Settings Panel */}
                {store.isSettingsOpen.value && (
                  <div
                    style={{
                      width: '100%',
                      padding: '20px',
                      overflowY: 'auto',
                      backgroundColor: '#fafbfc'
                    }}
                  >
                    <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600' }}>
                      {t('ai.settings') || 'Settings'}
                    </h3>

                    {/* Provider Selection */}
                    <div style={{ marginBottom: '20px' }}>
                      <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                        {t('ai.provider') || 'Provider'}
                      </label>
                      <NSelect
                        value={store.config.value.provider}
                        onUpdateValue={(v: 'dify' | 'spring-ai') => store.updateConfig({ provider: v })}
                        options={[
                          { label: 'Dify', value: 'dify' },
                          { label: 'Spring AI', value: 'spring-ai' }
                        ]}
                      />
                    </div>

                    {/* Dify Config */}
                    {store.config.value.provider === 'dify' && (
                      <>
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                            {t('ai.appType') || 'App Type'}
                          </label>
                          <NSelect
                            value={store.config.value.dify.appType || 'workflow'}
                            onUpdateValue={(v: 'chat' | 'completion' | 'workflow') =>
                              store.updateConfig({
                                dify: { ...store.config.value.dify, appType: v }
                              })
                            }
                            options={[
                              { label: 'Chat App (对话应用)', value: 'chat' },
                              { label: 'Completion App (文本生成)', value: 'completion' },
                              { label: 'Workflow App (工作流)', value: 'workflow' }
                            ]}
                          />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                            API URL
                          </label>
                          <NInput
                            value={store.config.value.dify.apiUrl}
                            onUpdateValue={(v: string) =>
                              store.updateConfig({
                                dify: { ...store.config.value.dify, apiUrl: v }
                              })
                            }
                            placeholder="https://api.dify.ai/v1"
                          />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                            API Key
                          </label>
                          <NInput
                            value={store.config.value.dify.apiKey}
                            onUpdateValue={(v: string) =>
                              store.updateConfig({
                                dify: { ...store.config.value.dify, apiKey: v }
                              })
                            }
                            type="password"
                            showPasswordOn="click"
                            placeholder="app-xxxxxxxx"
                          />
                        </div>
                      </>
                    )}

                    {/* Spring AI Config */}
                    {store.config.value.provider === 'spring-ai' && (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{ fontSize: '14px', fontWeight: '500', marginBottom: '8px', display: 'block' }}>
                          API URL
                        </label>
                        <NInput
                          value={store.config.value.springAi.apiUrl}
                          onUpdateValue={(v: string) =>
                            store.updateConfig({
                              springAi: { ...store.config.value.springAi, apiUrl: v }
                            })
                          }
                          placeholder="http://localhost:8080/ai/chat"
                        />
                      </div>
                    )}

                    {/* Skills */}
                    <div style={{ marginTop: '24px' }}>
                      <h4 style={{ margin: '0 0 12px', fontSize: '14px', fontWeight: '600' }}>
                        {t('ai.skills') || 'Skills'}
                      </h4>
                      {store.skills.value.map(skill => (
                        <div
                          key={skill.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px',
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            marginBottom: '8px',
                            border: '1px solid #e8e8e8'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span style={{ fontSize: '20px' }}>{skill.icon}</span>
                            <div>
                              <div style={{ fontWeight: '500', fontSize: '14px' }}>{skill.name}</div>
                              <div style={{ fontSize: '12px', color: '#666' }}>{skill.description}</div>
                            </div>
                          </div>
                          <NSwitch
                            value={skill.enabled}
                            onUpdateValue={() => store.toggleSkill(skill.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* History Panel */}
                {store.isHistoryOpen.value && (
                  <div
                    style={{
                      width: '100%',
                      padding: '20px',
                      overflowY: 'auto',
                      backgroundColor: '#fafbfc'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>
                        {t('ai.history') || 'Chat History'}
                      </h3>
                      {store.conversations.value.length > 0 && (
                        <NPopconfirm onPositiveClick={store.clearAllConversations}>
                          {{
                            trigger: () => (
                              <NButton size="tiny" quaternary type="error">
                                {t('ai.clearAll') || 'Clear All'}
                              </NButton>
                            ),
                            default: () => t('ai.confirmClearAll') || 'Clear all conversations?'
                          }}
                        </NPopconfirm>
                      )}
                    </div>

                    {store.sortedConversations.value.length === 0 ? (
                      <NEmpty description={t('ai.noHistory') || 'No chat history'} />
                    ) : (
                      store.sortedConversations.value.map(renderConversationItem)
                    )}
                  </div>
                )}

                {/* Chat Messages */}
                {!store.isSettingsOpen.value && !store.isHistoryOpen.value && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <NScrollbar style={{ flex: 1 }}>
                      <div style={{ padding: '20px' }}>
                        {!store.currentConversation.value ||
                        store.currentConversation.value.messages.length === 0 ? (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '40px 20px',
                              color: '#666'
                            }}
                          >
                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🤖</div>
                            <div style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                              {t('ai.welcome') || 'Welcome to AI Assistant'}
                            </div>
                            <div style={{ fontSize: '14px', color: '#999' }}>
                              {t('ai.welcomeHint') || 'Ask me anything about SeaTunnel!'}
                            </div>
                          </div>
                        ) : (
                          store.currentConversation.value.messages.map(renderMessage)
                        )}
                        <div ref={messagesEndRef} />
                      </div>
                    </NScrollbar>

                    {/* Skills Bar */}
                    <div
                      style={{
                        padding: '8px 16px',
                        borderTop: '1px solid #f0f0f0',
                        display: 'flex',
                        gap: '8px',
                        overflowX: 'auto',
                        backgroundColor: '#fafbfc'
                      }}
                    >
                      {store.skills.value.filter(s => s.enabled).map(renderSkillButton)}
                    </div>

                    {/* Input Area */}
                    <div
                      style={{
                        padding: '16px',
                        borderTop: '1px solid #f0f0f0',
                        backgroundColor: '#fff'
                      }}
                    >
                      <NInputGroup>
                        <NInput
                          value={inputValue.value}
                          onUpdateValue={(v: string) => (inputValue.value = v)}
                          onKeydown={handleKeydown}
                          placeholder={
                            selectedSkill.value
                              ? `${store.skills.value.find(s => s.id === selectedSkill.value)?.icon} ${t('ai.inputPlaceholder') || 'Type your message...'}`
                              : t('ai.inputPlaceholder') || 'Type your message...'
                          }
                          disabled={store.isStreaming.value}
                          type="textarea"
                          autosize={{ minRows: 1, maxRows: 4 }}
                          style={{ borderRadius: '12px 0 0 12px' }}
                        />
                        <NButton
                          type="primary"
                          onClick={handleSend}
                          disabled={!inputValue.value.trim() || store.isStreaming.value}
                          loading={store.isStreaming.value}
                          style={{
                            borderRadius: '0 12px 12px 0',
                            height: 'auto',
                            minHeight: '34px'
                          }}
                        >
                          {store.isStreaming.value ? '' : '📤'}
                        </NButton>
                      </NInputGroup>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </Transition>

        {/* Styles */}
        <style>{`
          .slide-up-enter-active,
          .slide-up-leave-active {
            transition: all 0.3s ease;
          }
          .slide-up-enter-from,
          .slide-up-leave-to {
            opacity: 0;
            transform: scale(0.95);
          }

          .typing-dot {
            display: inline-block;
            animation: typing-bounce 1.4s infinite ease-in-out both;
            color: #666;
          }

          @keyframes typing-bounce {
            0%, 80%, 100% {
              transform: scale(0.6);
              opacity: 0.5;
            }
            40% {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </>
    )
  }
})
