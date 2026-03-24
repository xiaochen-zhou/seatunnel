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

import { defineComponent, ref, Teleport, Transition } from 'vue'
import { NForm, NFormItem, NInput, NButton, NAlert } from 'naive-ui'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  setup() {
    const { t } = useI18n()
    const authStore = useAuthStore()
    const router = useRouter()

    const username = ref('')
    const password = ref('')
    const errorMsg = ref('')
    const loading = ref(false)

    const handleLogin = async () => {
      errorMsg.value = ''

      if (!username.value.trim()) {
        errorMsg.value = t('auth.usernameRequired') || 'Please enter employee ID'
        return
      }

      if (!password.value.trim()) {
        errorMsg.value = t('auth.passwordRequired') || 'Please enter password'
        return
      }

      loading.value = true
      await new Promise((resolve) => setTimeout(resolve, 500))

      const success = authStore.login(username.value.trim(), password.value.trim())
      loading.value = false

      if (success) {
        if (authStore.pendingRoute) {
          router.push({ name: authStore.pendingRoute })
        }
        username.value = ''
        password.value = ''
        errorMsg.value = ''
      } else {
        errorMsg.value =
          t('auth.invalidCredentials') || 'Invalid employee ID or password. Access denied.'
      }
    }

    const handleClose = () => {
      authStore.closeLoginModal()
      username.value = ''
      password.value = ''
      errorMsg.value = ''
      // Go back to previous page
      router.back()
    }

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleLogin()
      }
    }

    return () => (
      <Teleport to="body">
        <Transition name="modal-fade">
          {authStore.showLoginModal && (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {/* Backdrop with blur */}
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)'
                }}
                onClick={handleClose}
              />

              {/* Modal Card */}
              <div
                style={{
                  position: 'relative',
                  width: '420px',
                  backgroundColor: '#fff',
                  borderRadius: '20px',
                  boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)',
                  overflow: 'hidden',
                  animation: 'modalSlideIn 0.3s ease-out'
                }}
              >
                {/* Close Button */}
                <button
                  onClick={handleClose}
                  style={{
                    position: 'absolute',
                    top: '16px',
                    right: '16px',
                    width: '32px',
                    height: '32px',
                    border: 'none',
                    background: 'rgba(0, 0, 0, 0.05)',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '18px',
                    color: '#666',
                    transition: 'all 0.2s ease',
                    zIndex: 1
                  }}
                  onMouseover={(e) => {
                    ;(e.target as HTMLElement).style.background = 'rgba(0, 0, 0, 0.1)'
                    ;(e.target as HTMLElement).style.color = '#333'
                  }}
                  onMouseout={(e) => {
                    ;(e.target as HTMLElement).style.background = 'rgba(0, 0, 0, 0.05)'
                    ;(e.target as HTMLElement).style.color = '#666'
                  }}
                >
                  ✕
                </button>

                {/* Header */}
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 32px 24px',
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)'
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      margin: '0 auto 20px',
                      borderRadius: '20px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '32px',
                      boxShadow: '0 8px 24px rgba(102, 126, 234, 0.4)'
                    }}
                  >
                    🔐
                  </div>
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '24px',
                      fontWeight: '700',
                      color: '#1a1a2e',
                      letterSpacing: '-0.5px'
                    }}
                  >
                    {t('auth.title') || 'Authentication Required'}
                  </h2>
                  <p
                    style={{
                      margin: '10px 0 0',
                      fontSize: '14px',
                      color: '#666',
                      lineHeight: '1.5'
                    }}
                  >
                    {t('auth.subtitle') || 'Please enter your credentials to access this page'}
                  </p>
                </div>

                {/* Form */}
                <div style={{ padding: '28px 32px 32px' }} onKeydown={handleKeydown}>
                  {errorMsg.value && (
                    <NAlert
                      type="error"
                      showIcon
                      style={{ marginBottom: '20px', borderRadius: '10px' }}
                    >
                      {{
                        icon: () => <span style={{ fontSize: '16px' }}>⚠️</span>,
                        default: () => errorMsg.value
                      }}
                    </NAlert>
                  )}

                  <NForm labelPlacement="top" size="large">
                    <NFormItem label={t('auth.employeeId') || 'Employee ID'}>
                      <NInput
                        v-model:value={username.value}
                        placeholder={t('auth.employeeIdPlaceholder') || 'Enter your employee ID'}
                        style={{ borderRadius: '10px' }}
                      >
                        {{
                          prefix: () => (
                            <span style={{ color: '#999', marginRight: '4px' }}>👤</span>
                          )
                        }}
                      </NInput>
                    </NFormItem>

                    <NFormItem label={t('auth.password') || 'Password'}>
                      <NInput
                        v-model:value={password.value}
                        type="password"
                        showPasswordOn="click"
                        placeholder={t('auth.passwordPlaceholder') || 'Enter your password'}
                        style={{ borderRadius: '10px' }}
                      >
                        {{
                          prefix: () => (
                            <span style={{ color: '#999', marginRight: '4px' }}>🔑</span>
                          )
                        }}
                      </NInput>
                    </NFormItem>

                    <NButton
                      type="primary"
                      block
                      loading={loading.value}
                      onClick={handleLogin}
                      style={{
                        marginTop: '12px',
                        height: '48px',
                        borderRadius: '10px',
                        fontSize: '16px',
                        fontWeight: '600',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        border: 'none',
                        boxShadow: '0 4px 16px rgba(102, 126, 234, 0.4)'
                      }}
                    >
                      {loading.value
                        ? t('auth.verifying') || 'Verifying...'
                        : t('auth.login') || 'Login'}
                    </NButton>
                  </NForm>

                  <div
                    style={{
                      marginTop: '24px',
                      padding: '14px 16px',
                      backgroundColor: '#f8fafc',
                      borderRadius: '10px',
                      textAlign: 'center',
                      border: '1px solid #e2e8f0'
                    }}
                  >
                    <span style={{ fontSize: '13px', color: '#666' }}>
                      💡 {t('auth.hint') || 'Contact admin if you forgot your credentials'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Animation styles */}
              <style>
                {`
                  @keyframes modalSlideIn {
                    from {
                      opacity: 0;
                      transform: scale(0.9) translateY(-20px);
                    }
                    to {
                      opacity: 1;
                      transform: scale(1) translateY(0);
                    }
                  }
                  .modal-fade-enter-active,
                  .modal-fade-leave-active {
                    transition: opacity 0.3s ease;
                  }
                  .modal-fade-enter-from,
                  .modal-fade-leave-to {
                    opacity: 0;
                  }
                `}
              </style>
            </div>
          )}
        </Transition>
      </Teleport>
    )
  }
})
