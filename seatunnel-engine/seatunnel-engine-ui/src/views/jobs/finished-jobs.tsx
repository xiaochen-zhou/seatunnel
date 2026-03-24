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

import { computed, defineComponent, h, onUnmounted, ref, watch } from 'vue'
import { NDataTable, NTag, NSelect, NInput, NSpace } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { JobsService } from '@/service/job'
import type { DataTableColumns } from 'naive-ui'
import { NButton } from 'naive-ui'
import type { Job, JobStatus } from '@/service/job/types'
import { useRouter } from 'vue-router'
import { getColorFromStatus } from '@/utils/getTypeFromStatus'

// Finished job status options with colors
const FINISHED_STATUS_OPTIONS: { label: string; value: JobStatus | ''; color?: string }[] = [
  { label: 'All Status', value: '' },
  { label: 'FINISHED', value: 'FINISHED', color: '#18a058' },
  { label: 'CANCELED', value: 'CANCELED', color: '#f0a020' },
  { label: 'FAILED', value: 'FAILED', color: '#d03050' },
  { label: 'CANCELING', value: 'CANCELING', color: '#f0a020' },
  { label: 'FAILING', value: 'FAILING', color: '#d03050' }
]

export default defineComponent({
  setup() {
    const { t } = useI18n()

    const jobs = ref([] as Job[])
    const page = ref(1)
    const pageSize = ref(10)
    const total = ref(0)

    // Filter states
    const selectedStatus = ref<JobStatus | ''>('')
    const searchKeyword = ref('')

    let timer: NodeJS.Timeout
    const fetch = async () => {
      // Pass status to API for server-side filtering
      const res = await JobsService.getFinishedJobs(
        page.value,
        pageSize.value,
        selectedStatus.value || undefined
      )
      jobs.value = res.data
      total.value = res.total
      timer = setTimeout(fetch, 5000)
    }
    onUnmounted(() => clearTimeout(timer))

    // Re-fetch when status filter changes
    watch(selectedStatus, () => {
      page.value = 1
      clearTimeout(timer)
      fetch()
    })

    fetch()

    // Filter by keyword (client-side, since server doesn't support it)
    const filteredJobs = computed(() => {
      if (!searchKeyword.value) {
        return jobs.value
      }
      const keyword = searchKeyword.value.toLowerCase()
      return jobs.value.filter(
        (job) =>
          job.jobName.toLowerCase().includes(keyword) ||
          job.jobId.toLowerCase().includes(keyword)
      )
    })

    const router = useRouter()
    function createColumns(): DataTableColumns<Job> {
      const view = (job: Job) => {
        router.push({ name: 'detail', params: { jobId: job.jobId } })
      }
      return [
        {
          title: 'No',
          key: 'No',
          width: 60,
          render: (row, index) => h('div', { class: 'text-gray-500' }, index + 1)
        },
        {
          title: 'Id',
          key: 'jobId',
          sorter: 'default',
          ellipsis: { tooltip: true }
        },
        {
          title: 'Name',
          key: 'jobName',
          sorter: 'default',
          ellipsis: { tooltip: true }
        },
        {
          title: 'Create Time',
          key: 'createTime',
          sorter: 'default',
          width: 180
        },
        {
          title: 'Finish Time',
          key: 'finishTime',
          sorter: 'default',
          width: 180
        },
        {
          title: 'Status',
          key: 'jobStatus',
          width: 120,
          render(row) {
            return (
              <NTag bordered={false} color={getColorFromStatus(row.jobStatus)} round size="small">
                {row.jobStatus}
              </NTag>
            )
          }
        },
        {
          title: 'Action',
          key: 'actions',
          width: 100,
          render(row) {
            return h(
              NButton,
              {
                strong: true,
                tertiary: true,
                size: 'small',
                type: 'primary',
                onClick: () => view(row)
              },
              { default: () => 'View' }
            )
          }
        }
      ]
    }

    // Render status option with color dot
    const renderStatusLabel = (option: { label: string; value: string; color?: string }) => {
      if (!option.value) {
        return h('span', {}, option.label)
      }
      return h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [
        h('span', {
          style: {
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: option.color || '#999'
          }
        }),
        h('span', {}, option.label)
      ])
    }

    const columns = createColumns()
    return () => (
      <div class="w-full bg-white p-6 border border-gray-100 rounded-xl shadow-sm">
        {/* Header */}
        <div class="flex items-center justify-between pb-4">
          <h2 class="font-bold text-xl text-gray-800">{t('jobs.finishedJobs')}</h2>
          <NTag type="info" round size="small">
            {filteredJobs.value.length} / {total.value}
          </NTag>
        </div>

        {/* Filter Controls */}
        <div
          class="mb-4 p-4 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0'
          }}
        >
          <div class="flex flex-wrap items-center gap-6">
            {/* Status Filter */}
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600">{t('jobs.statusFilter')}</span>
              <NSelect
                v-model:value={selectedStatus.value}
                options={FINISHED_STATUS_OPTIONS.map((opt) => ({
                  ...opt,
                  label: opt.value === '' ? t('jobs.allStatus') : opt.label
                }))}
                renderLabel={renderStatusLabel}
                style={{ width: '200px' }}
                size="small"
                clearable
                onClear={() => (selectedStatus.value = '')}
              />
            </div>

            <div
              style={{
                width: '1px',
                height: '24px',
                backgroundColor: '#e2e8f0'
              }}
            />

            {/* Keyword Search */}
            <div class="flex items-center gap-3 flex-1">
              <span class="text-sm font-medium text-gray-600">{t('jobs.searchPlaceholder')}</span>
              <NInput
                v-model:value={searchKeyword.value}
                placeholder={t('jobs.searchPlaceholder')}
                clearable
                size="small"
                style={{ maxWidth: '300px' }}
              >
                {{
                  prefix: () =>
                    h(
                      'span',
                      { style: { color: '#999', fontSize: '14px' } },
                      h('svg', {
                        xmlns: 'http://www.w3.org/2000/svg',
                        width: '16',
                        height: '16',
                        viewBox: '0 0 24 24',
                        fill: 'none',
                        stroke: 'currentColor',
                        'stroke-width': '2',
                        'stroke-linecap': 'round',
                        'stroke-linejoin': 'round',
                        innerHTML:
                          '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>'
                      })
                    )
                }}
              </NInput>
            </div>
          </div>
        </div>

        {/* Data Table */}
        <NDataTable
          columns={columns}
          data={filteredJobs.value}
          remote={true}
          striped
          size="small"
          pagination={{
            page: page.value,
            pageSize: pageSize.value,
            itemCount: total.value,
            showSizePicker: true,
            pageSizes: [10, 20, 50, 100, 500],
            showQuickJumper: true,
            prefix: ({ itemCount }) => `Total ${itemCount} items`,
            onUpdatePage: (newPage: number) => {
              page.value = newPage
              fetch()
            },
            onUpdatePageSize: (newPageSize: number) => {
              pageSize.value = newPageSize
              page.value = 1
              fetch()
            }
          }}
          bordered={false}
        />
      </div>
    )
  }
})
