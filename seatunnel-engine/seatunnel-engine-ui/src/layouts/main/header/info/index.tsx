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

import { defineComponent, reactive } from 'vue'
import { NSpace, NButton, NDropdown, NAvatar, NDivider } from 'naive-ui'
import { overviewService } from '@/service/overview'
import type { Overview } from '@/service/overview/types'
import { useAuthStore } from '@/store/auth'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const Info = defineComponent({
  setup() {
    const { t } = useI18n()
    const authStore = useAuthStore()
    const router = useRouter()
    const data = reactive({} as Overview)
    overviewService.getOverview().then((res) => Object.assign(data, res))

    const handleLogout = () => {
      authStore.logout()
      router.push({ name: 'jobs' })
    }

    const handleLogin = () => {
      authStore.openLoginModal()
    }

    const dropdownOptions = [
      {
        label: t('auth.logout') || 'Logout',
        key: 'logout',
        icon: () => <span style={{ marginRight: '8px' }}>🚪</span>
      }
    ]

    const handleDropdownSelect = (key: string) => {
      if (key === 'logout') {
        handleLogout()
      }
    }

    return () => (
      <NSpace justify="center" align="center" wrap={false} class="h-16 mr-6">
        <h2 class="text-base font-bold">Version:</h2>
        <span class="text-base text-nowrap">{data.projectVersion}</span>
        <h2 class="text-base font-bold ml-4">Commit:</h2>
        <span class="text-base text-nowrap">{data.gitCommitAbbrev}</span>

        {/* User Info */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'rgba(255,255,255,0.3)',
            margin: '0 16px'
          }}
        />

        {authStore.isAuthenticated ? (
          <NDropdown
            options={dropdownOptions}
            onSelect={handleDropdownSelect}
            trigger="click"
            placement="bottom-end"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.15)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              class="hover:bg-white/25"
            >
              <NAvatar
                size={32}
                round
                style={{
                  backgroundColor: '#fff',
                  color: '#667eea',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}
              >
                {authStore.currentUser?.slice(0, 2)}
              </NAvatar>
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                <span style={{ fontSize: '13px', fontWeight: '500' }}>
                  {authStore.currentUser}
                </span>
                <span style={{ fontSize: '11px', opacity: 0.8 }}>
                  {t('auth.employee') || 'Employee'}
                </span>
              </div>
              <span style={{ fontSize: '12px', opacity: 0.7 }}>▼</span>
            </div>
          </NDropdown>
        ) : (
          <NButton
            size="small"
            ghost
            style={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.5)'
            }}
            onClick={handleLogin}
          >
            🔐 {t('auth.login') || 'Login'}
          </NButton>
        )}
      </NSpace>
    )
  }
})

export default Info
