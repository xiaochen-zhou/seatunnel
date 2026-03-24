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
import { defineStore } from 'pinia'

// Simple auth credentials
const VALID_CREDENTIALS = {
  username: '1215258',
  password: '3494269'
}

const STORAGE_KEY_AUTH = 'seatunnel_auth'
const STORAGE_KEY_USER = 'seatunnel_user'

// Routes that require authentication (jobs list needs auth, but job detail doesn't)
export const PROTECTED_ROUTES = ['overview', 'managers-workers', 'managers-master', 'jobs']

export const useAuthStore = defineStore('auth', () => {
  const isAuthenticated = ref(false)
  const showLoginModal = ref(false)
  const pendingRoute = ref<string | null>(null)
  const currentUser = ref<string | null>(null)

  // Check session storage on init
  const storedAuth = sessionStorage.getItem(STORAGE_KEY_AUTH)
  const storedUser = sessionStorage.getItem(STORAGE_KEY_USER)
  if (storedAuth === 'true' && storedUser) {
    isAuthenticated.value = true
    currentUser.value = storedUser
  }

  const login = (username: string, password: string): boolean => {
    if (username === VALID_CREDENTIALS.username && password === VALID_CREDENTIALS.password) {
      isAuthenticated.value = true
      currentUser.value = username
      sessionStorage.setItem(STORAGE_KEY_AUTH, 'true')
      sessionStorage.setItem(STORAGE_KEY_USER, username)
      showLoginModal.value = false
      return true
    }
    return false
  }

  const logout = () => {
    isAuthenticated.value = false
    currentUser.value = null
    sessionStorage.removeItem(STORAGE_KEY_AUTH)
    sessionStorage.removeItem(STORAGE_KEY_USER)
  }

  const openLoginModal = (routeName?: string) => {
    if (routeName) {
      pendingRoute.value = routeName
    }
    showLoginModal.value = true
  }

  const closeLoginModal = () => {
    showLoginModal.value = false
    pendingRoute.value = null
  }

  const requiresAuth = (routeName: string): boolean => {
    return PROTECTED_ROUTES.includes(routeName)
  }

  return {
    isAuthenticated,
    showLoginModal,
    pendingRoute,
    currentUser,
    login,
    logout,
    openLoginModal,
    closeLoginModal,
    requiresAuth
  }
})
