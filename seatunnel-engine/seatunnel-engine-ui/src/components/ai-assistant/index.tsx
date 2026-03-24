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

import { defineComponent, ref, nextTick, watch, Transition, computed } from 'vue'
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
import { marked } from 'marked'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true
})

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
            marginBottom: '20px',
            animation: 'fadeInUp 0.3s ease-out'
          }}
        >
          {/* Role label */}
          <div
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: isUser ? '#667eea' : '#11998e',
              marginBottom: '6px',
              paddingLeft: isUser ? '0' : '48px',
              paddingRight: isUser ? '48px' : '0',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            {isUser ? (t('ai.you') || 'You') : (t('ai.assistant') || 'AI Assistant')}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              flexDirection: isUser ? 'row-reverse' : 'row',
              maxWidth: '90%'
            }}
          >
            {/* Avatar */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '12px',
                background: isUser
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '16px',
                flexShrink: 0,
                boxShadow: isUser
                  ? '0 4px 12px rgba(102, 126, 234, 0.3)'
                  : '0 4px 12px rgba(17, 153, 142, 0.3)'
              }}
            >
              {isUser ? '👤' : '🤖'}
            </div>

            {/* Message content */}
            <div
              class={isUser ? 'user-message' : 'ai-message markdown-body'}
              style={{
                padding: '14px 18px',
                borderRadius: isUser ? '20px 20px 6px 20px' : '20px 20px 20px 6px',
                backgroundColor: isUser
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#ffffff',
                background: isUser
                  ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  : '#ffffff',
                color: isUser ? '#fff' : '#2d3748',
                fontSize: '14px',
                lineHeight: '1.7',
                wordBreak: 'break-word',
                boxShadow: isUser
                  ? '0 4px 15px rgba(102, 126, 234, 0.25)'
                  : '0 2px 12px rgba(0, 0, 0, 0.08)',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                letterSpacing: '0.2px',
                border: isUser ? 'none' : '1px solid #e8ecf1'
              }}
            >
              {msg.status === 'streaming' && !msg.content ? (
                <div style={{ display: 'flex', gap: '6px', padding: '4px 0' }}>
                  <span class="typing-dot" style={{ animationDelay: '0s' }}>●</span>
                  <span class="typing-dot" style={{ animationDelay: '0.2s' }}>●</span>
                  <span class="typing-dot" style={{ animationDelay: '0.4s' }}>●</span>
                </div>
              ) : isUser ? (
                <span style={{ display: 'block', fontWeight: '400', whiteSpace: 'pre-wrap' }}>
                  {msg.content}
                </span>
              ) : (
                <div
                  innerHTML={marked.parse(msg.content || '') as string}
                  style={{ fontWeight: '400' }}
                />
              )}
              {msg.status === 'error' && (
                <span style={{
                  color: isUser ? '#ffcccc' : '#e53e3e',
                  marginLeft: '6px'
                }}> ⚠️</span>
              )}
            </div>
          </div>

          {/* Timestamp & Skill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '8px',
              paddingLeft: isUser ? '0' : '48px',
              paddingRight: isUser ? '48px' : '0'
            }}
          >
            <span style={{
              fontSize: '11px',
              color: '#a0aec0',
              fontWeight: '500'
            }}>
              {formatTime(msg.timestamp)}
            </span>
            {msg.skillUsed && (
              <NTag
                size="tiny"
                round
                bordered={false}
                style={{
                  backgroundColor: '#edf2f7',
                  color: '#4a5568',
                  fontSize: '10px',
                  padding: '2px 8px'
                }}
              >
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
                  <div style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, #f8fafc 0%, #edf2f7 100%)'
                  }}>
                    <NScrollbar style={{ flex: 1 }}>
                      <div style={{ padding: '24px 28px' }}>
                        {!store.currentConversation.value ||
                        store.currentConversation.value.messages.length === 0 ? (
                          <div
                            style={{
                              textAlign: 'center',
                              padding: '60px 30px',
                              color: '#4a5568'
                            }}
                          >
                            <div style={{
                              fontSize: '64px',
                              marginBottom: '20px',
                              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
                            }}>🤖</div>
                            <div style={{
                              fontSize: '22px',
                              fontWeight: '700',
                              marginBottom: '12px',
                              color: '#2d3748',
                              letterSpacing: '-0.5px'
                            }}>
                              {t('ai.welcome') || 'Welcome to AI Assistant'}
                            </div>
                            <div style={{
                              fontSize: '15px',
                              color: '#718096',
                              lineHeight: '1.6',
                              maxWidth: '400px',
                              margin: '0 auto'
                            }}>
                              {t('ai.welcomeHint') || 'Ask me anything about SeaTunnel! I can help with job analysis, error diagnosis, configuration, and more.'}
                            </div>
                            <div style={{
                              marginTop: '32px',
                              display: 'flex',
                              gap: '12px',
                              justifyContent: 'center',
                              flexWrap: 'wrap'
                            }}>
                              {store.skills.value.filter(s => s.enabled).slice(0, 3).map(skill => (
                                <div
                                  key={skill.id}
                                  style={{
                                    padding: '10px 16px',
                                    backgroundColor: '#fff',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    color: '#4a5568',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                                    border: '1px solid #e2e8f0',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease'
                                  }}
                                  onClick={() => { selectedSkill.value = skill.id }}
                                >
                                  {skill.icon} {skill.name}
                                </div>
                              ))}
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
                        padding: '10px 20px',
                        borderTop: '1px solid #e2e8f0',
                        display: 'flex',
                        gap: '10px',
                        overflowX: 'auto',
                        backgroundColor: '#fff'
                      }}
                    >
                      {store.skills.value.filter(s => s.enabled).map(renderSkillButton)}
                    </div>

                    {/* Input Area */}
                    <div
                      style={{
                        padding: '16px 20px 20px',
                        borderTop: '1px solid #e2e8f0',
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
                          style={{
                            borderRadius: '14px 0 0 14px',
                            fontSize: '14px',
                            backgroundColor: '#f7fafc',
                            border: '2px solid #e2e8f0',
                            transition: 'all 0.2s ease'
                          }}
                        />
                        <NButton
                          type="primary"
                          onClick={handleSend}
                          disabled={!inputValue.value.trim() || store.isStreaming.value}
                          loading={store.isStreaming.value}
                          style={{
                            borderRadius: '0 14px 14px 0',
                            height: 'auto',
                            minHeight: '42px',
                            minWidth: '50px',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            fontSize: '18px'
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
            color: #a0aec0;
            font-size: 18px;
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

          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          /* Custom scrollbar */
          .n-scrollbar-content::-webkit-scrollbar {
            width: 6px;
          }
          .n-scrollbar-content::-webkit-scrollbar-track {
            background: transparent;
          }
          .n-scrollbar-content::-webkit-scrollbar-thumb {
            background: #cbd5e0;
            border-radius: 3px;
          }
          .n-scrollbar-content::-webkit-scrollbar-thumb:hover {
            background: #a0aec0;
          }

          /* Markdown styles for AI messages */
          .markdown-body {
            line-height: 1.7;
          }
          .markdown-body p {
            margin: 0 0 12px 0;
          }
          .markdown-body p:last-child {
            margin-bottom: 0;
          }
          .markdown-body strong {
            font-weight: 600;
            color: #1a202c;
          }
          .markdown-body em {
            font-style: italic;
          }
          .markdown-body code {
            background-color: #edf2f7;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            font-size: 13px;
            color: #e53e3e;
          }
          .markdown-body pre {
            background-color: #1a202c;
            padding: 12px 16px;
            border-radius: 8px;
            overflow-x: auto;
            margin: 12px 0;
          }
          .markdown-body pre code {
            background: none;
            padding: 0;
            color: #e2e8f0;
            font-size: 13px;
          }
          .markdown-body ul, .markdown-body ol {
            margin: 8px 0;
            padding-left: 24px;
          }
          .markdown-body li {
            margin: 4px 0;
          }
          .markdown-body blockquote {
            border-left: 4px solid #667eea;
            padding-left: 16px;
            margin: 12px 0;
            color: #4a5568;
            font-style: italic;
          }
          .markdown-body a {
            color: #667eea;
            text-decoration: none;
          }
          .markdown-body a:hover {
            text-decoration: underline;
          }
          .markdown-body h1, .markdown-body h2, .markdown-body h3 {
            margin: 16px 0 8px 0;
            font-weight: 600;
            color: #1a202c;
          }
          .markdown-body h1 { font-size: 1.5em; }
          .markdown-body h2 { font-size: 1.3em; }
          .markdown-body h3 { font-size: 1.1em; }
          .markdown-body hr {
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 16px 0;
          }
          .markdown-body table {
            border-collapse: collapse;
            width: 100%;
            margin: 12px 0;
          }
          .markdown-body th, .markdown-body td {
            border: 1px solid #e2e8f0;
            padding: 8px 12px;
            text-align: left;
          }
          .markdown-body th {
            background-color: #f7fafc;
            font-weight: 600;
          }
        `}</style>
      </>
    )
  }
})
