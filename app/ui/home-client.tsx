'use client'

import Image from 'next/image'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'

type HomeClientProps = {
  initialService: string
  initialId: string
  initialKey: string
}

type BandwidthResponse = {
  monthly_bw_limit_b: number
  bw_counter_b: number
  bw_reset_day_of_month: number
}

type UsageState = {
  loading: boolean
  error: string
  data: BandwidthResponse | null
  fetchedAt: string
}

const DEFAULT_USAGE_STATE: UsageState = {
  loading: false,
  error: '',
  data: null,
  fetchedAt: '',
}

function formatGigabytes(bytes: number) {
  return `${(bytes / 1_000_000_000).toFixed(3)} GB`
}

function getLosAngelesDateParts(date: Date) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  const parts = formatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === 'year')?.value)
  const month = Number(parts.find((part) => part.type === 'month')?.value)
  const day = Number(parts.find((part) => part.type === 'day')?.value)

  return { year, month, day }
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function formatResetDate(resetDay: number) {
  const now = new Date()
  const { year, month, day } = getLosAngelesDateParts(now)

  let targetYear = year
  let targetMonth = month

  if (day > resetDay) {
    if (month === 12) {
      targetYear += 1
      targetMonth = 1
    } else {
      targetMonth += 1
    }
  }

  const safeDay = Math.min(resetDay, getDaysInMonth(targetYear, targetMonth))
  const monthText = String(targetMonth).padStart(2, '0')
  const dayText = String(safeDay).padStart(2, '0')

  return `${targetYear}-${monthText}-${dayText}`
}

function formatFetchedAt(date: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    day: '2-digit',
    hour12: false,
  }).format(date)
}

function buildSubscriptionUrl(params: {
  origin: string
  service: string
  id: string
  key: string
  useSecureMode: boolean
  excludeShadowsocks: boolean
  excludeVmess: boolean
  useDomains: boolean
}) {
  const url = new URL(params.useSecureMode ? '/api/sublink' : '/members/getsub.php', params.origin)

  if (params.useSecureMode) {
    url.searchParams.set('key', params.key)
  } else {
    url.searchParams.set('service', params.service)
    url.searchParams.set('id', params.id)
  }

  if (params.excludeShadowsocks) {
    url.searchParams.set('noss', '1')
  }

  if (params.excludeVmess) {
    url.searchParams.set('novmess', '1')
  }

  if (params.useDomains) {
    url.searchParams.set('usedomains', '1')
  }

  return url.toString()
}

function buildCounterPath(params: { service: string; id: string; key: string; useSecureMode: boolean }) {
  const searchParams = new URLSearchParams()

  if (params.useSecureMode) {
    searchParams.set('key', params.key)
    return `/api/counter?${searchParams.toString()}`
  }

  searchParams.set('service', params.service)
  searchParams.set('id', params.id)
  return `/members/getbwcounter.php?${searchParams.toString()}`
}

export function HomeClient({ initialService, initialId, initialKey }: HomeClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [serviceInput, setServiceInput] = useState(initialService)
  const [idInput, setIdInput] = useState(initialId)
  const [service, setService] = useState(initialService)
  const [id, setId] = useState(initialId)
  const [key, setKey] = useState(initialKey)
  const [excludeShadowsocks, setExcludeShadowsocks] = useState(false)
  const [excludeVmess, setExcludeVmess] = useState(false)
  const [useDomains, setUseDomains] = useState(true)
  const [copyText, setCopyText] = useState('复制')
  const [usageState, setUsageState] = useState<UsageState>(DEFAULT_USAGE_STATE)
  const [origin, setOrigin] = useState('https://example.com')
  const [showQrModal, setShowQrModal] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('')
  const [qrCodeLoading, setQrCodeLoading] = useState(false)
  const [qrCodeError, setQrCodeError] = useState('')

  const useSecureMode = Boolean(key)
  const missingCredentials = !useSecureMode && (!service || !id)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    const nextService = searchParams.get('service') || ''
    const nextId = searchParams.get('id') || ''
    const nextKey = searchParams.get('key') || ''
    setService(nextService)
    setId(nextId)
    setKey(nextKey)
    setServiceInput(nextService)
    setIdInput(nextId)
  }, [searchParams])

  const counterPath = useMemo(
    () =>
      buildCounterPath({
        service,
        id,
        key,
        useSecureMode,
      }),
    [service, id, key, useSecureMode],
  )

  useEffect(() => {
    if (missingCredentials) {
      setUsageState(DEFAULT_USAGE_STATE)
      return
    }

    const controller = new AbortController()

    async function loadUsage() {
      setUsageState({ loading: true, error: '', data: null, fetchedAt: '' })

      try {
        const response = await fetch(counterPath, {
          signal: controller.signal,
          cache: 'no-store',
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = (await response.json()) as BandwidthResponse

        if (
          typeof data.monthly_bw_limit_b !== 'number' ||
          typeof data.bw_counter_b !== 'number' ||
          typeof data.bw_reset_day_of_month !== 'number'
        ) {
          throw new Error('Invalid response')
        }

        setUsageState({
          loading: false,
          error: '',
          data,
          fetchedAt: formatFetchedAt(new Date()),
        })
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        setUsageState({
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to load usage',
          data: null,
          fetchedAt: '',
        })
      }
    }

    void loadUsage()

    return () => controller.abort()
  }, [counterPath, missingCredentials])

  const subscriptionUrl = useMemo(
    () =>
      buildSubscriptionUrl({
        origin,
        service,
        id,
        key,
        useSecureMode,
        excludeShadowsocks,
        excludeVmess,
        useDomains,
      }),
    [origin, service, id, key, useSecureMode, excludeShadowsocks, excludeVmess, useDomains],
  )

  useEffect(() => {
    if (!showQrModal) {
      return
    }

    let active = true

    async function generateQrCode() {
      setQrCodeLoading(true)
      setQrCodeError('')

      try {
        const dataUrl = await QRCode.toDataURL(subscriptionUrl, {
          width: 360,
          margin: 2,
        })

        if (!active) {
          return
        }

        setQrCodeDataUrl(dataUrl)
      } catch (error) {
        if (!active) {
          return
        }

        setQrCodeError(error instanceof Error ? error.message : '生成二维码失败')
        setQrCodeDataUrl('')
      } finally {
        if (active) {
          setQrCodeLoading(false)
        }
      }
    }

    void generateQrCode()

    return () => {
      active = false
    }
  }, [showQrModal, subscriptionUrl])

  const usageMetrics = useMemo(() => {
    if (!usageState.data) {
      return null
    }

    const total = usageState.data.monthly_bw_limit_b
    const used = usageState.data.bw_counter_b
    const remaining = Math.max(total - used, 0)
    const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0

    return {
      used,
      total,
      remaining,
      percentage,
      resetDate: formatResetDate(usageState.data.bw_reset_day_of_month),
    }
  }, [usageState.data])

  async function copySubscriptionUrl() {
    try {
      await navigator.clipboard.writeText(subscriptionUrl)
      setCopyText('已复制')
      window.setTimeout(() => setCopyText('复制'), 1500)
    } catch {
      setCopyText('复制失败')
      window.setTimeout(() => setCopyText('复制'), 1500)
    }
  }

  function submitCredentials(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const params = new URLSearchParams(searchParams.toString())
    params.delete('key')
    params.set('service', serviceInput.trim())
    params.set('id', idInput.trim())
    router.push(`${pathname}?${params.toString()}`)
  }

  function openQrModal() {
    setQrCodeDataUrl('')
    setQrCodeError('')
    setShowQrModal(true)
  }

  function closeQrModal() {
    setShowQrModal(false)
  }

  function resetToManualMode() {
    router.push(pathname)
  }

  return (
    <main className="page-shell">
      <div className="background-orb orb-one" />
      <div className="background-orb orb-two" />
      <div className="background-grid" />

      {missingCredentials ? (
        <div className="modal-backdrop">
          <form className="modal-card entry-modal" onSubmit={submitCredentials}>
            <div className="modal-kicker">Just My Socks Mirror</div>
            <h1>订阅配置</h1>
            <p>输入订阅参数, 访问订阅详情页面和链接, 适合在官方地址不稳定时，快速查看剩余额度并生成可直接使用的订阅链接。</p>
            <label className="field">
              <span>service</span>
              <input value={serviceInput} onChange={(event) => setServiceInput(event.target.value)} required />
            </label>
            <label className="field">
              <span>id</span>
              <input value={idInput} onChange={(event) => setIdInput(event.target.value)} required />
            </label>
            <button className="primary-button" type="submit">
              进入面板
            </button>
          </form>
        </div>
      ) : null}

      {showQrModal ? (
        <div className="modal-backdrop" onClick={closeQrModal}>
          <div className="modal-card qr-modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="section-header qr-modal-header">
              <div>
                <div className="section-kicker">Quick Scan</div>
                <h2>订阅二维码</h2>
              </div>
              <button className="ghost-button" type="button" onClick={closeQrModal}>
                关闭
              </button>
            </div>
            <p className="qr-modal-text">用手机或其他设备扫描下面的二维码，即可导入当前已配置好的订阅地址。</p>
            <div className="qr-box">
              {qrCodeLoading ? <div className="status-placeholder">二维码生成中...</div> : null}
              {!qrCodeLoading && qrCodeError ? <div className="error-box">{qrCodeError}</div> : null}
              {!qrCodeLoading && !qrCodeError && qrCodeDataUrl ? (
                <Image className="qr-image" src={qrCodeDataUrl} alt="订阅二维码" width={360} height={360} unoptimized />
              ) : null}
            </div>
            <div className="link-box qr-link-box">{subscriptionUrl}</div>
          </div>
        </div>
      ) : null}

      <section className="top-strip compact-top-strip">
        <div className="brand-heading">Mirror Dashboard</div>
        <button className="primary-button top-strip-button" type="button" onClick={resetToManualMode}>
          {useSecureMode ? '退出短链' : '更换账号'}
        </button>
      </section>

      <section className="compact-hero">
        <div>
          <h1>订阅链接与额度面板</h1>
          <p>
            在官方地址不稳定时，快速生成镜像订阅链接、查看本月流量进度，并为手机设备提供二维码扫码入口。
          </p>
        </div>
      </section>

      <section className="dashboard-grid compact-grid">
        <article className="panel-card usage-card compact-card">
          <div className="section-header compact-header">
            <div>
              <div className="section-kicker">Bandwidth</div>
              <h2>本月总额度</h2>
            </div>
            <span className="inline-meta">{usageState.loading ? '同步中' : usageState.fetchedAt ? `截至 ${usageState.fetchedAt}` : ''}</span>
          </div>

          {usageMetrics ? (
            <>
              <div className="usage-hero-row compact-usage-row">
                <div>
                  <div className="usage-label">已使用</div>
                  <div className="usage-big">{formatGigabytes(usageMetrics.used)}</div>
                </div>
                <div className="usage-side-stat compact-side-stat">
                  <span>总额度</span>
                  <strong>{formatGigabytes(usageMetrics.total)}</strong>
                </div>
              </div>
              <div className="progress-track compact-progress">
                <div className="progress-bar" style={{ width: `${usageMetrics.percentage}%` }} />
              </div>
              <div className="usage-meta-grid compact-meta-grid">
                <div className="info-tile accent compact-tile">
                  <span>剩余流量</span>
                  <strong>{formatGigabytes(usageMetrics.remaining)}</strong>
                </div>
                <div className="info-tile compact-tile">
                  <span>重置日期</span>
                  <strong>{usageMetrics.resetDate}</strong>
                  <small>Los Angeles 时区</small>
                </div>
              </div>
            </>
          ) : usageState.error ? (
            <div className="error-box">获取额度失败：{usageState.error}</div>
          ) : (
            <div className="status-placeholder">等待加载额度信息</div>
          )}
        </article>

        <article className="panel-card subscription-card compact-card">
          <div className="section-header compact-header">
            <div>
              <div className="section-kicker">Subscription</div>
              <h2>订阅链接</h2>
            </div>
            <div className="action-row compact-actions">
              <button className="ghost-button" type="button" onClick={openQrModal}>
                二维码
              </button>
              <button className="primary-button" type="button" onClick={copySubscriptionUrl}>
                {copyText}
              </button>
            </div>
          </div>

          <div className="link-box link-box-highlight compact-link-box">{subscriptionUrl}</div>

          <div className="option-list compact-toggle-row">
            <label className="toggle-card compact-toggle-card">
              <input
                type="checkbox"
                checked={excludeShadowsocks}
                onChange={(event) => setExcludeShadowsocks(event.target.checked)}
              />
              <div>
                <strong>排除SS节点</strong>
              </div>
            </label>
            <label className="toggle-card compact-toggle-card">
              <input type="checkbox" checked={excludeVmess} onChange={(event) => setExcludeVmess(event.target.checked)} />
              <div>
                <strong>排除Vmess节点</strong>
              </div>
            </label>
            <label className="toggle-card compact-toggle-card active-default">
              <input type="checkbox" checked={useDomains} onChange={(event) => setUseDomains(event.target.checked)} />
              <div>
                <strong>排除IP节点</strong>
              </div>
            </label>
          </div>
        </article>
      </section>
    </main>
  )
}
