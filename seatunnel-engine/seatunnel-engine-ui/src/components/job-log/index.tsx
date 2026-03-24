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

import { getJobLogs, getJobLogContent } from '@/service/job-log'
import type { JobLog } from '@/service/job-log/types'
import type { Job, Vertex } from '@/service/job/types'
import {
  NCollapse,
  NCollapseItem,
  NSpace,
  NInput,
  NButton,
  NSpin,
  NEmpty,
  NTag,
  NTooltip,
  NCheckbox,
  NCheckboxGroup,
  NCard,
  NGrid,
  NGi
} from 'naive-ui'
import { computed, defineComponent, ref, h, type PropType } from 'vue'
import { useI18n } from 'vue-i18n'

// Log level definitions with colors
const LOG_LEVELS = [
  { label: 'ERROR', value: 'ERROR', color: '#d03050', bgColor: '#fde8ec', pattern: /\bERROR\b/i },
  { label: 'WARN', value: 'WARN', color: '#f0a020', bgColor: '#fef6e6', pattern: /\bWARN(ING)?\b/i },
  { label: 'INFO', value: 'INFO', color: '#18a058', bgColor: '#e8f5ef', pattern: /\bINFO\b/i },
  { label: 'DEBUG', value: 'DEBUG', color: '#2080f0', bgColor: '#e8f4fd', pattern: /\bDEBUG\b/i }
]

// Stage type definitions
const STAGE_TYPES = {
  source: { label: 'Source', color: '#18a058', icon: '📥' },
  transform: { label: 'Transform', color: '#2080f0', icon: '⚙️' },
  sink: { label: 'Sink', color: '#f0a020', icon: '📤' }
}

export default defineComponent({
  props: {
    jobId: {
      type: String,
      required: true
    },
    job: {
      type: Object as PropType<Job>,
      default: null
    }
  },
  setup(props) {
    const { t } = useI18n()
    const logList = ref<JobLog[]>([])
    const logContents = ref<Record<string, string>>({})
    const loadingLogs = ref<Record<string, boolean>>({})
    const selectedLevels = ref<string[]>(['ERROR', 'WARN', 'INFO', 'DEBUG'])
    const searchKeyword = ref('')

    // Fetch log list
    getJobLogs(props.jobId).then((res) => (logList.value = res))

    // Get stage info from job DAG
    const stageInfo = computed(() => {
      if (!props.job?.jobDag?.vertexInfoMap) return { sources: [], transforms: [], sinks: [] }
      const vertices = props.job.jobDag.vertexInfoMap
      return {
        sources: vertices.filter((v: Vertex) => v.type === 'source'),
        transforms: vertices.filter((v: Vertex) => v.type === 'transform'),
        sinks: vertices.filter((v: Vertex) => v.type === 'sink')
      }
    })

    // Load log content
    const loadLogContent = async (logName: string, logLink: string) => {
      if (logContents.value[logName]) return
      loadingLogs.value[logName] = true
      try {
        const content = await getJobLogContent(logLink)
        logContents.value[logName] = content
      } catch (error) {
        logContents.value[logName] = `Failed to load log: ${error}`
      } finally {
        loadingLogs.value[logName] = false
      }
    }

    // Handle collapse change - accordion mode
    const handleCollapseChange = (expandedNames: string[]) => {
      if (expandedNames.length > 0) {
        const logName = expandedNames[expandedNames.length - 1]
        const log = logList.value.find((l) => l.logName === logName)
        if (log && !logContents.value[logName]) {
          loadLogContent(logName, log.logLink)
        }
      }
    }

    // Filter log lines
    const filterLogContent = (content: string) => {
      if (!content) return []
      return content.split('\n').filter((line) => {
        const matchesLevel =
          selectedLevels.value.length === 0 ||
          selectedLevels.value.some((level) => {
            const levelDef = LOG_LEVELS.find((l) => l.value === level)
            return levelDef?.pattern.test(line)
          }) ||
          !LOG_LEVELS.some((l) => l.pattern.test(line))
        const matchesKeyword =
          !searchKeyword.value ||
          line.toLowerCase().includes(searchKeyword.value.toLowerCase())
        return matchesLevel && matchesKeyword
      })
    }

    // Highlight log line
    const highlightLine = (line: string) => {
      let highlighted = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
      LOG_LEVELS.forEach((level) => {
        highlighted = highlighted.replace(
          level.pattern,
          `<span style="color: ${level.color}; font-weight: bold;">$&</span>`
        )
      })
      if (searchKeyword.value) {
        const regex = new RegExp(
          `(${searchKeyword.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
          'gi'
        )
        highlighted = highlighted.replace(
          regex,
          '<mark style="background-color: #fff3cd; padding: 0 2px; border-radius: 2px;">$1</mark>'
        )
      }
      return highlighted
    }

    // Get log level counts
    const getLogLevelCounts = (content: string) => {
      if (!content) return {}
      const counts: Record<string, number> = {}
      LOG_LEVELS.forEach((level) => {
        const matches = content.match(new RegExp(level.pattern, 'gi'))
        counts[level.value] = matches ? matches.length : 0
      })
      return counts
    }

    const showOnlyErrors = () => (selectedLevels.value = ['ERROR'])
    const showOnlyWarnings = () => (selectedLevels.value = ['WARN'])
    const showAll = () => (selectedLevels.value = ['ERROR', 'WARN', 'INFO', 'DEBUG'])

    const searchIcon = () =>
      h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: '16',
        height: '16',
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        innerHTML: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>'
      })

    return () => (
      <div class="p-4">
        {/* Stage Info Cards */}
        {props.job?.jobDag?.vertexInfoMap && (
          <div class="mb-6">
            <h3 class="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <span>📊</span>
              <span>{t('log.pipeline') || 'Pipeline Stages'}</span>
            </h3>
            <NGrid cols={3} xGap={16} yGap={16}>
              <NGi>
                <NCard
                  size="small"
                  style={{
                    borderLeft: `4px solid ${STAGE_TYPES.source.color}`,
                    background: 'linear-gradient(135deg, #fff 0%, #fafbfc 100%)'
                  }}
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: '18px' }}>{STAGE_TYPES.source.icon}</span>
                    <span style={{ color: STAGE_TYPES.source.color, fontWeight: 'bold' }}>
                      {STAGE_TYPES.source.label}
                    </span>
                    <NTag size="tiny" round>{stageInfo.value.sources.length}</NTag>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    {stageInfo.value.sources.map((v: Vertex) => (
                      <NTag key={v.vertexId} size="small" bordered={false}>{v.vertexName}</NTag>
                    ))}
                  </div>
                </NCard>
              </NGi>
              <NGi>
                <NCard
                  size="small"
                  style={{
                    borderLeft: `4px solid ${STAGE_TYPES.transform.color}`,
                    background: 'linear-gradient(135deg, #fff 0%, #fafbfc 100%)'
                  }}
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: '18px' }}>{STAGE_TYPES.transform.icon}</span>
                    <span style={{ color: STAGE_TYPES.transform.color, fontWeight: 'bold' }}>
                      {STAGE_TYPES.transform.label}
                    </span>
                    <NTag size="tiny" round>{stageInfo.value.transforms.length}</NTag>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    {stageInfo.value.transforms.map((v: Vertex) => (
                      <NTag key={v.vertexId} size="small" bordered={false}>{v.vertexName}</NTag>
                    ))}
                  </div>
                </NCard>
              </NGi>
              <NGi>
                <NCard
                  size="small"
                  style={{
                    borderLeft: `4px solid ${STAGE_TYPES.sink.color}`,
                    background: 'linear-gradient(135deg, #fff 0%, #fafbfc 100%)'
                  }}
                >
                  <div class="flex items-center gap-2 mb-2">
                    <span style={{ fontSize: '18px' }}>{STAGE_TYPES.sink.icon}</span>
                    <span style={{ color: STAGE_TYPES.sink.color, fontWeight: 'bold' }}>
                      {STAGE_TYPES.sink.label}
                    </span>
                    <NTag size="tiny" round>{stageInfo.value.sinks.length}</NTag>
                  </div>
                  <div class="flex flex-wrap gap-1">
                    {stageInfo.value.sinks.map((v: Vertex) => (
                      <NTag key={v.vertexId} size="small" bordered={false}>{v.vertexName}</NTag>
                    ))}
                  </div>
                </NCard>
              </NGi>
            </NGrid>
          </div>
        )}

        {/* Filter Controls */}
        <div
          class="mb-4 p-4 rounded-lg"
          style={{
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
            border: '1px solid #e2e8f0'
          }}
        >
          <div class="flex flex-wrap items-center gap-6">
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-gray-600">{t('log.logLevel')}</span>
              <NCheckboxGroup v-model:value={selectedLevels.value}>
                <NSpace size="small">
                  {LOG_LEVELS.map((level) => (
                    <NCheckbox value={level.value} key={level.value}>
                      <NTag
                        size="small"
                        bordered={false}
                        round
                        style={{ backgroundColor: level.bgColor, color: level.color, fontWeight: '500' }}
                      >
                        {level.label}
                      </NTag>
                    </NCheckbox>
                  ))}
                </NSpace>
              </NCheckboxGroup>
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />
            <div class="flex items-center gap-2">
              <NButton size="small" type="error" secondary onClick={showOnlyErrors}>
                {t('log.errorOnly')}
              </NButton>
              <NButton size="small" type="warning" secondary onClick={showOnlyWarnings}>
                {t('log.warnOnly')}
              </NButton>
              <NButton size="small" secondary onClick={showAll}>
                {t('log.showAll')}
              </NButton>
            </div>
            <div style={{ width: '1px', height: '24px', backgroundColor: '#e2e8f0' }} />
            <div class="flex items-center gap-3 flex-1">
              <NInput
                v-model:value={searchKeyword.value}
                placeholder={t('log.searchPlaceholder')}
                clearable
                size="small"
                style={{ maxWidth: '300px' }}
              >
                {{ prefix: () => h('span', { style: { color: '#999' } }, searchIcon()) }}
              </NInput>
            </div>
          </div>
        </div>

        {/* Log List - Using NCollapse for proper accordion */}
        {logList.value.length === 0 ? (
          <NEmpty description={t('log.noLogs')}>
            {{ icon: () => h('span', { style: { fontSize: '48px', opacity: 0.5 } }, '📋') }}
          </NEmpty>
        ) : (
          <NCollapse accordion onUpdateExpandedNames={handleCollapseChange}>
            {logList.value.map((log) => {
              const content = logContents.value[log.logName] || ''
              const counts = getLogLevelCounts(content)
              const filteredLines = filterLogContent(content)
              const isLoading = loadingLogs.value[log.logName]

              return (
                <NCollapseItem name={log.logName} key={log.logName}>
                  {{
                    header: () => (
                      <div class="flex items-center gap-3">
                        <span style={{ fontSize: '16px' }}>📄</span>
                        <span style={{ fontWeight: '500' }}>{log.logName}</span>
                        <NTag size="small" bordered={false} type="info" round>
                          🖥️ {log.node}
                        </NTag>
                        {content && (
                          <div class="flex gap-2 ml-auto">
                            {counts['ERROR'] > 0 && (
                              <NTag size="small" type="error" round>❌ {counts['ERROR']}</NTag>
                            )}
                            {counts['WARN'] > 0 && (
                              <NTag size="small" type="warning" round>⚠️ {counts['WARN']}</NTag>
                            )}
                          </div>
                        )}
                      </div>
                    ),
                    default: () => (
                      <div style={{ padding: '8px 0' }}>
                        {isLoading ? (
                          <div class="flex flex-col items-center justify-center py-12">
                            <NSpin size="medium" />
                            <span class="mt-3 text-gray-500">{t('log.loading') || 'Loading...'}</span>
                          </div>
                        ) : (
                          <div>
                            <div
                              class="mb-3 px-3 py-2 rounded-md flex items-center justify-between"
                              style={{ backgroundColor: '#f8fafc' }}
                            >
                              <span class="text-sm text-gray-600">
                                {t('log.showing')} <strong>{filteredLines.length}</strong> {t('log.of')}{' '}
                                <strong>{content.split('\n').length}</strong> {t('log.lines')}
                              </span>
                              <NButton
                                size="tiny"
                                secondary
                                onClick={() => navigator.clipboard.writeText(filteredLines.join('\n'))}
                              >
                                📋 {t('log.copy') || 'Copy'}
                              </NButton>
                            </div>
                            <pre
                              style={{
                                whiteSpace: 'pre-wrap',
                                wordWrap: 'break-word',
                                backgroundColor: '#1e1e1e',
                                color: '#d4d4d4',
                                padding: '16px',
                                borderRadius: '8px',
                                overflow: 'auto',
                                maxHeight: '500px',
                                fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                                fontSize: '12px',
                                lineHeight: '1.6',
                                margin: 0
                              }}
                            >
                              {filteredLines.length === 0 ? (
                                <span style={{ color: '#666' }}>{t('log.noMatchingLines')}</span>
                              ) : (
                                filteredLines.map((line, index) => (
                                  <div
                                    key={index}
                                    innerHTML={highlightLine(line)}
                                    style={{
                                      padding: '3px 8px',
                                      borderRadius: '2px',
                                      marginBottom: '1px',
                                      backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)'
                                    }}
                                  />
                                ))
                              )}
                            </pre>
                          </div>
                        )}
                      </div>
                    )
                  }}
                </NCollapseItem>
              )
            })}
          </NCollapse>
        )}
      </div>
    )
  }
})
