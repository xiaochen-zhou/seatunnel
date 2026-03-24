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

import { createRouter, createWebHashHistory } from 'vue-router'
import routes from './routes'
import NProgress from 'nprogress'
import 'nprogress/nprogress.css'
import { useAuthStore, PROTECTED_ROUTES } from '@/store/auth'

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes
})

router.beforeEach((to, from, next) => {
  NProgress.start()

  const authStore = useAuthStore()
  const routeName = to.name as string

  // Check if route requires authentication (detail page is public)
  if (PROTECTED_ROUTES.includes(routeName) && routeName !== 'detail') {
    if (!authStore.isAuthenticated) {
      // Show login modal and stay on current page or go to detail if available
      authStore.openLoginModal(routeName)
      // Allow access to detail page without auth
      if (from.name === 'detail' || to.name === 'detail') {
        next()
      } else {
        next(false)
      }
      return
    }
  }

  next()
})

router.afterEach(() => {
  NProgress.done()
})

export default router
