import { useState, useEffect, useMemo } from 'react'
import './App.css'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { Filter, TrendingUp, TrendingDown, DollarSign, Users, BarChart3, AlertTriangle, Clock } from 'lucide-react'

interface Opportunity {
  opp_id: string
  opp_name: string
  account_name: string
  partner_name: string
  opp_type: string
  region: string
  product: string
  stage: string
  amount_usd: number
  partner_margin_usd: number
  created_date: string
  close_date: string
  sales_rep: string
  partner_tier: string
}

function parseCSV(text: string): Opportunity[] {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim() })
    return {
      opp_id: row.opp_id || '',
      opp_name: row.opp_name || '',
      account_name: row.account_name || '',
      partner_name: row.partner_name || '',
      opp_type: row.opp_type || '',
      region: row.region || '',
      product: row.product || '',
      stage: row.stage || '',
      amount_usd: parseFloat(row.amount_usd) || 0,
      partner_margin_usd: parseFloat(row.partner_margin_usd) || 0,
      created_date: row.created_date || '',
      close_date: row.close_date || '',
      sales_rep: row.sales_rep || '',
      partner_tier: row.partner_tier || '',
    }
  })
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

const OPP_TYPE_COLORS: Record<string, string> = {
  Partner: '#6366f1',
  Direct: '#06b6d4',
  MSP: '#f59e0b',
  Unspecified: '#9ca3af',
  '': '#9ca3af',
}

const PIE_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#94a3b8', '#10b981', '#ef4444']

const OPEN_STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation']

interface Consumption {
  consumption_id: string
  linked_opp_id: string
  account_name: string
  partner_name: string
  product: string
  month: string
  consumption_units: number
  consumption_usd: number
  accelerated_vs_baseline_pct: number
}

function parseConsumptionCSV(text: string): Consumption[] {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',')
  return lines.slice(1).filter(line => line.trim()).map(line => {
    const values = line.split(',')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h.trim()] = (values[i] || '').trim() })
    return {
      consumption_id: row.consumption_id || '',
      linked_opp_id: row.linked_opp_id || '',
      account_name: row.account_name || '',
      partner_name: row.partner_name || '',
      product: row.product || '',
      month: row.month || '',
      consumption_units: parseFloat(row.consumption_units) || 0,
      consumption_usd: parseFloat(row.consumption_usd) || 0,
      accelerated_vs_baseline_pct: parseFloat(row.accelerated_vs_baseline_pct) || 0,
    }
  })
}

function App() {
  const [data, setData] = useState<Opportunity[]>([])
  const [consumptionData, setConsumptionData] = useState<Consumption[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'opportunities' | 'consumption' | 'pipeline'>('opportunities')
  const [selectedYear, setSelectedYear] = useState<string>('All')
  const [selectedRegion, setSelectedRegion] = useState<string>('All')
  const [selectedStage, setSelectedStage] = useState<string>('Closed Won')
  const [consSelectedYear, setConsSelectedYear] = useState<string>('All')

  useEffect(() => {
    Promise.all([
      fetch('/sf_opportunities.csv').then(res => res.text()),
      fetch('/consumption.csv').then(res => res.text()),
    ]).then(([oppText, consText]) => {
      setData(parseCSV(oppText))
      setConsumptionData(parseConsumptionCSV(consText))
      setLoading(false)
    })
  }, [])

  const stages = useMemo(() =>
    [...new Set(data.map(d => d.stage).filter(Boolean))].sort(),
    [data]
  )

  const stageFiltered = useMemo(() => {
    if (selectedStage === 'All') return data.filter(d => d.close_date)
    return data.filter(d => d.stage === selectedStage && d.close_date)
  }, [data, selectedStage])

  const years = useMemo(() => {
    const yrs = [...new Set(stageFiltered.map(d => d.close_date.substring(0, 4)))].sort()
    return yrs
  }, [stageFiltered])

  const regions = useMemo(() =>
    [...new Set(data.map(d => d.region).filter(Boolean))].sort(),
    [data]
  )

  const filtered = useMemo(() => {
    return stageFiltered.filter(d => {
      const year = d.close_date.substring(0, 4)
      const matchYear = selectedYear === 'All' || year === selectedYear
      const matchRegion = selectedRegion === 'All' || d.region === selectedRegion
      return matchYear && matchRegion
    })
  }, [stageFiltered, selectedYear, selectedRegion])

  const wonByOppType = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(d => {
      const key = d.opp_type || 'Unspecified'
      map[key] = (map[key] || 0) + d.amount_usd
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const yoyGrowth = useMemo(() => {
    const byYearType: Record<string, Record<string, number>> = {}
    stageFiltered.forEach(d => {
      const matchRegion = selectedRegion === 'All' || d.region === selectedRegion
      if (!matchRegion) return
      const year = d.close_date.substring(0, 4)
      const key = d.opp_type || 'Unspecified'
      if (!byYearType[year]) byYearType[year] = {}
      byYearType[year][key] = (byYearType[year][key] || 0) + d.amount_usd
    })

    const sortedYears = Object.keys(byYearType).sort()
    const oppTypes = [...new Set(stageFiltered.map(d => d.opp_type || 'Unspecified'))]

    return sortedYears.map(year => {
      const row: Record<string, string | number> = { year }
      oppTypes.forEach(type => {
        row[type] = byYearType[year]?.[type] || 0
      })
      return row
    })
  }, [stageFiltered, selectedRegion])

  const yoyPercentages = useMemo(() => {
    if (yoyGrowth.length < 2) return []
    const results: { type: string; growth: number; current: number; previous: number }[] = []
    const oppTypes = [...new Set(stageFiltered.map(d => d.opp_type || 'Unspecified'))]
    const latest = yoyGrowth[yoyGrowth.length - 1]
    const prev = yoyGrowth[yoyGrowth.length - 2]

    oppTypes.forEach(type => {
      const current = (latest[type] as number) || 0
      const previous = (prev[type] as number) || 0
      const growth = previous > 0 ? ((current - previous) / previous) * 100 : 0
      results.push({ type, growth, current, previous })
    })
    return results.sort((a, b) => b.current - a.current)
  }, [yoyGrowth, stageFiltered])

  const partnerAttachRate = useMemo(() => {
    const totalWon = filtered.reduce((sum, d) => sum + d.amount_usd, 0)
    const partnerMspWon = filtered.filter(d => d.opp_type === 'Partner' || d.opp_type === 'MSP').reduce((sum, d) => sum + d.amount_usd, 0)
    return totalWon > 0 ? (partnerMspWon / totalWon) * 100 : 0
  }, [filtered])

  const partnerAttachByYear = useMemo(() => {
    const byYear: Record<string, { total: number; partner: number }> = {}
    stageFiltered.forEach(d => {
      const matchRegion = selectedRegion === 'All' || d.region === selectedRegion
      if (!matchRegion) return
      const year = d.close_date.substring(0, 4)
      if (!byYear[year]) byYear[year] = { total: 0, partner: 0 }
      byYear[year].total += d.amount_usd
      if (d.opp_type === 'Partner' || d.opp_type === 'MSP') byYear[year].partner += d.amount_usd
    })
    return Object.entries(byYear)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, v]) => ({
        year,
        rate: v.total > 0 ? parseFloat(((v.partner / v.total) * 100).toFixed(1)) : 0,
        partnerWon: v.partner,
        totalWon: v.total,
      }))
  }, [stageFiltered, selectedRegion])

  const wonByRegion = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(d => {
      const key = d.region || 'Unknown'
      map[key] = (map[key] || 0) + d.amount_usd
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const partnerMspFiltered = useMemo(() =>
    filtered.filter(d => d.opp_type === 'Partner' || d.opp_type === 'MSP'),
    [filtered]
  )

  const partnerRanking = useMemo(() => {
    const map: Record<string, { partner: number; msp: number }> = {}
    filtered.forEach(d => {
      if (d.opp_type !== 'Partner' && d.opp_type !== 'MSP') return
      const name = d.partner_name || 'Unknown'
      if (!map[name]) map[name] = { partner: 0, msp: 0 }
      if (d.opp_type === 'Partner') map[name].partner += d.amount_usd
      if (d.opp_type === 'MSP') map[name].msp += d.amount_usd
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, Partner: v.partner, MSP: v.msp, total: v.partner + v.msp }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15)
  }, [filtered])

  const totalPartnerWon = useMemo(() => partnerMspFiltered.reduce((s, d) => s + d.amount_usd, 0), [partnerMspFiltered])
  const partnerDealCount = partnerMspFiltered.length
  const avgPartnerDealSize = partnerDealCount > 0 ? totalPartnerWon / partnerDealCount : 0

  // --- Consumption tab data ---
  const consYears = useMemo(() =>
    [...new Set(consumptionData.map(d => d.month.substring(0, 4)))].sort(),
    [consumptionData]
  )

  const consFiltered = useMemo(() => {
    if (consSelectedYear === 'All') return consumptionData
    return consumptionData.filter(d => d.month.substring(0, 4) === consSelectedYear)
  }, [consumptionData, consSelectedYear])

  const consTotalWithPartner = useMemo(() =>
    consFiltered.filter(d => d.partner_name).reduce((s, d) => s + d.consumption_usd, 0),
    [consFiltered]
  )
  const consTotalWithoutPartner = useMemo(() =>
    consFiltered.filter(d => !d.partner_name).reduce((s, d) => s + d.consumption_usd, 0),
    [consFiltered]
  )
  const consTotal = consTotalWithPartner + consTotalWithoutPartner

  const consMonthlyTrend = useMemo(() => {
    const map: Record<string, { withPartner: number; withoutPartner: number }> = {}
    consFiltered.forEach(d => {
      if (!map[d.month]) map[d.month] = { withPartner: 0, withoutPartner: 0 }
      if (d.partner_name) map[d.month].withPartner += d.consumption_usd
      else map[d.month].withoutPartner += d.consumption_usd
    })
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, 'With Partner': v.withPartner, 'Without Partner': v.withoutPartner }))
  }, [consFiltered])

  const consPartnerRanking = useMemo(() => {
    const map: Record<string, number> = {}
    consFiltered.forEach(d => {
      if (!d.partner_name) return
      map[d.partner_name] = (map[d.partner_name] || 0) + d.consumption_usd
    })
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15)
  }, [consFiltered])

  // --- Pipeline Inspection tab data ---
  const pipelineOpps = useMemo(() =>
    data.filter(d => OPEN_STAGES.includes(d.stage)),
    [data]
  )

  const partnerPipelineWoW = useMemo(() => {
    const partnerOpen = pipelineOpps.filter(d => d.opp_type === 'Partner' || d.opp_type === 'MSP')
    const weekMap: Record<string, number> = {}
    partnerOpen.forEach(d => {
      const date = new Date(d.created_date)
      const dayOfWeek = date.getDay()
      const diff = date.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1)
      const monday = new Date(date)
      monday.setDate(diff)
      const weekKey = monday.toISOString().substring(0, 10)
      weekMap[weekKey] = (weekMap[weekKey] || 0) + 1
    })
    const sorted = Object.entries(weekMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week, count }))
    return sorted.map((item, i) => ({
      week: item.week,
      count: item.count,
      change: i > 0 ? item.count - sorted[i - 1].count : 0,
    }))
  }, [pipelineOpps])

  const stalledOpps = useMemo(() => {
    const now = new Date()
    return pipelineOpps
      .filter(d => {
        if (d.opp_type !== 'Partner' && d.opp_type !== 'MSP') return false
        const created = new Date(d.created_date)
        const daysSinceCreated = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24))
        return daysSinceCreated > 30
      })
      .sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime())
  }, [pipelineOpps])

  const largeOppsNoPartner = useMemo(() => {
    return pipelineOpps
      .filter(d => d.amount_usd > 500000 && !d.partner_name)
      .sort((a, b) => b.amount_usd - a.amount_usd)
  }, [pipelineOpps])

  const consByProduct = useMemo(() => {
    const map: Record<string, { withPartner: number; withoutPartner: number }> = {}
    consFiltered.forEach(d => {
      const product = d.product || 'Unknown'
      if (!map[product]) map[product] = { withPartner: 0, withoutPartner: 0 }
      if (d.partner_name) map[product].withPartner += d.consumption_usd
      else map[product].withoutPartner += d.consumption_usd
    })
    return Object.entries(map)
      .map(([name, v]) => ({ name, 'With Partner': v.withPartner, 'Without Partner': v.withoutPartner, total: v.withPartner + v.withoutPartner }))
      .sort((a, b) => b.total - a.total)
  }, [consFiltered])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-lg text-slate-500">Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">SF Opportunities Dashboard</h1>
            <p className="text-sm text-slate-500 mt-0.5">Sales performance and partner analytics</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {activeTab === 'opportunities' && (
              <>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-400" />
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="All">All Years</option>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedRegion}
                    onChange={e => setSelectedRegion(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="All">All Regions</option>
                    {regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedStage}
                    onChange={e => setSelectedStage(e.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="All">All Stages</option>
                    {stages.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </>
            )}
            {activeTab === 'consumption' && (
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={consSelectedYear}
                  onChange={e => setConsSelectedYear(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="All">All Years</option>
                  {consYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-4">
          <button
            onClick={() => setActiveTab('opportunities')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'opportunities'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            SF Opportunities
          </button>
          <button
            onClick={() => setActiveTab('consumption')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'consumption'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Consumption
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'pipeline'
                ? 'bg-indigo-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Weekly Pipeline Inspection
          </button>
        </div>
      </header>

      <main className="px-4 py-6 sm:px-6 lg:px-8 space-y-6">
      {activeTab === 'opportunities' && (<>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Partner $ Won"
            value={formatCurrency(totalPartnerWon)}
            subtitle="MSP + Partner Deals"
            icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
            color="emerald"
          />
          <KPICard
            title="Deals Won"
            value={partnerDealCount.toString()}
            subtitle="MSP + Partner Deals"
            icon={<BarChart3 className="h-5 w-5 text-indigo-600" />}
            color="indigo"
          />
          <KPICard
            title="Avg Deal Size"
            value={formatCurrency(avgPartnerDealSize)}
            subtitle="MSP + Partner Deals"
            icon={<TrendingUp className="h-5 w-5 text-cyan-600" />}
            color="cyan"
          />
          <KPICard
            title="Partner Attach Rate"
            value={`${partnerAttachRate.toFixed(1)}%`}
            subtitle="(Partner + MSP) $ / Total $ Won"
            icon={<Users className="h-5 w-5 text-amber-600" />}
            color="amber"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4">$ Won by Opportunity Type</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={wonByOppType} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Amount Won']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {wonByOppType.map((entry) => (
                    <Cell key={entry.name} fill={OPP_TYPE_COLORS[entry.name] || '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4">$ Won by Opp Type (Year over Year)</h2>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={yoyGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                {[...new Set(stageFiltered.map(d => d.opp_type || 'Unspecified'))].map((type, i) => (
                  <Bar
                    key={type}
                    dataKey={type}
                    fill={OPP_TYPE_COLORS[type] || PIE_COLORS[i % PIE_COLORS.length]}
                    stackId="a"
                    radius={i === 0 ? [4, 4, 0, 0] : undefined}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 lg:col-span-1">
            <h2 className="text-base font-semibold text-slate-800 mb-4">YoY Growth by Opp Type</h2>
            {yoyPercentages.length > 0 ? (
              <div className="space-y-3">
                {yoyPercentages.map(item => (
                  <div key={item.type} className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-700">{item.type}</p>
                      <p className="text-xs text-slate-400">
                        {formatCurrency(item.previous)} &rarr; {formatCurrency(item.current)}
                      </p>
                    </div>
                    <div className={`flex items-center gap-1 text-sm font-semibold ${item.growth >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {item.growth >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      {item.growth >= 0 ? '+' : ''}{item.growth.toFixed(1)}%
                    </div>
                  </div>
                ))}
                <p className="text-xs text-slate-400 mt-2">
                  Comparing {yoyGrowth.length >= 2 ? `${yoyGrowth[yoyGrowth.length - 2].year} vs ${yoyGrowth[yoyGrowth.length - 1].year}` : ''}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Need at least 2 years of data</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 lg:col-span-1">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Partner Attach Rate Trend</h2>
            <p className="text-xs text-slate-400 mb-3">(Partner + MSP) $ Won / Total $ Won</p>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={partnerAttachByYear}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, 100]}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'rate') return [`${value}%`, 'Attach Rate']
                    return [formatCurrency(value), name]
                  }}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Bar dataKey="rate" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200 lg:col-span-1">
            <h2 className="text-base font-semibold text-slate-800 mb-4">$ Won by Region</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={wonByRegion}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }: { name: string; percent: number }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {wonByRegion.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [formatCurrency(value), 'Amount Won']}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <h2 className="text-base font-semibold text-slate-800 mb-4">$ Won by Partner (MSP vs Partner)</h2>
          <p className="text-xs text-slate-400 mb-3">Top partners ranked by total $ won (MSP + Partner deals)</p>
          {partnerRanking.length > 0 ? (
            <ResponsiveContainer width="100%" height={Math.max(300, partnerRanking.length * 36)}>
              <BarChart data={partnerRanking} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number, name: string) => [formatCurrency(value), name]}
                  contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="Partner" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                <Bar dataKey="MSP" stackId="a" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400">No MSP or Partner deals found</p>
          )}
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          <h2 className="text-base font-semibold text-slate-800 mb-4">
            Won Deals Detail
            <span className="ml-2 text-sm font-normal text-slate-400">({filtered.length} deals)</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Opp Name</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Partner</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Region</th>
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Close Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.slice(0, 50).map(d => (
                  <tr key={d.opp_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-2 max-w-48 truncate" title={d.opp_name}>{d.opp_name}</td>
                    <td className="px-3 py-2 text-slate-600">{d.account_name}</td>
                    <td className="px-3 py-2 text-slate-600">{d.partner_name || '\u2014'}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.opp_type === 'Partner' ? 'bg-indigo-100 text-indigo-700' :
                        d.opp_type === 'Direct' ? 'bg-cyan-100 text-cyan-700' :
                        d.opp_type === 'MSP' ? 'bg-amber-100 text-amber-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {d.opp_type || 'N/A'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{d.region}</td>
                    <td className="px-3 py-2 text-slate-600">{d.product}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{formatCurrency(d.amount_usd)}</td>
                    <td className="px-3 py-2 text-slate-500">{d.close_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 50 && (
              <p className="text-xs text-slate-400 mt-2 px-3">Showing 50 of {filtered.length} deals</p>
            )}
          </div>
        </div>
      </>)}

      {activeTab === 'consumption' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard
              title="Total Consumption"
              value={formatCurrency(consTotal)}
              subtitle="All deals"
              icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
              color="emerald"
            />
            <KPICard
              title="With Partners"
              value={formatCurrency(consTotalWithPartner)}
              subtitle={`${consTotal > 0 ? ((consTotalWithPartner / consTotal) * 100).toFixed(1) : 0}% of total`}
              icon={<Users className="h-5 w-5 text-indigo-600" />}
              color="indigo"
            />
            <KPICard
              title="Without Partners"
              value={formatCurrency(consTotalWithoutPartner)}
              subtitle={`${consTotal > 0 ? ((consTotalWithoutPartner / consTotal) * 100).toFixed(1) : 0}% of total`}
              icon={<BarChart3 className="h-5 w-5 text-cyan-600" />}
              color="cyan"
            />
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Consumption Trend (With vs Without Partners)</h2>
            <p className="text-xs text-slate-400 mb-3">Monthly consumption USD</p>
            {consMonthlyTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <LineChart data={consMonthlyTrend} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => {
                      const parts = v.split('-')
                      return `${parts[1]}/${parts[0].substring(2)}`
                    }}
                  />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label: string) => {
                      const d = new Date(label + '-01')
                      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                    }}
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="With Partner" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                  <Line type="monotone" dataKey="Without Partner" stroke="#9ca3af" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No consumption data found</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Consumption $ by Product (With vs Without Partners)</h2>
            <p className="text-xs text-slate-400 mb-3">Stacked by partner involvement</p>
            {consByProduct.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={consByProduct}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Bar dataKey="With Partner" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="Without Partner" stackId="a" fill="#9ca3af" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No consumption data found</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Total Consumption USD by Partner</h2>
            <p className="text-xs text-slate-400 mb-3">Top partners ranked by total consumption</p>
            {consPartnerRanking.length > 0 ? (
              <ResponsiveContainer width="100%" height={Math.max(300, consPartnerRanking.length * 36)}>
                <BarChart data={consPartnerRanking} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tickFormatter={formatCurrency} tick={{ fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" width={160} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(value: number) => [formatCurrency(value), 'Consumption']}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No partner consumption data found</p>
            )}
          </div>
        </>
      )}

      {activeTab === 'pipeline' && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KPICard
              title="Partner Open Pipeline"
              value={pipelineOpps.filter(d => d.opp_type === 'Partner' || d.opp_type === 'MSP').length.toString()}
              subtitle="# Deals excl. Closed Won & Lost"
              icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
              color="emerald"
            />
            <KPICard
              title="Stalled Opps"
              value={stalledOpps.length.toString()}
              subtitle="Partner/MSP, open >30 days"
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              color="amber"
            />
            <KPICard
              title="Large Opps w/o Partner"
              value={largeOppsNoPartner.length.toString()}
              subtitle=">$500K, no partner attached"
              icon={<AlertTriangle className="h-5 w-5 text-cyan-600" />}
              color="cyan"
            />
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4"># Partner Open Pipeline Changes — Week over Week</h2>
            <p className="text-xs text-slate-400 mb-3">Partner + MSP deal count in open stages (excl. Closed Won & Closed Lost)</p>
            {partnerPipelineWoW.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={partnerPipelineWoW}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis
                    dataKey="week"
                    tick={{ fontSize: 10 }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v)
                      return `${d.getMonth() + 1}/${d.getDate()}`
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip
                    labelFormatter={(label: string) => `Week of ${label}`}
                    formatter={(value: number, name: string) => [
                      value,
                      name === 'count' ? 'Deals Created' : 'WoW Change',
                    ]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend formatter={(value: string) => value === 'count' ? 'Deals Created' : 'WoW Change'} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="change" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-slate-400">No partner pipeline data found</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Stalled Partner Opportunities, &gt;30 Days
              <span className="ml-2 text-sm font-normal text-slate-400">({stalledOpps.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mb-3">Partner &amp; MSP opportunities open for more than 30 days</p>
            {stalledOpps.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2">Opp Name</th>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Partner</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Region</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Created</th>
                      <th className="px-3 py-2 text-right">Days Open</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stalledOpps.map(d => {
                      const daysOpen = Math.floor((new Date().getTime() - new Date(d.created_date).getTime()) / (1000 * 60 * 60 * 24))
                      return (
                        <tr key={d.opp_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2 max-w-48 truncate" title={d.opp_name}>{d.opp_name}</td>
                          <td className="px-3 py-2 text-slate-600">{d.account_name}</td>
                          <td className="px-3 py-2 text-slate-600">{d.partner_name || '\u2014'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                              d.opp_type === 'Partner' ? 'bg-indigo-100 text-indigo-700' :
                              d.opp_type === 'MSP' ? 'bg-amber-100 text-amber-700' :
                              d.opp_type === 'Direct' ? 'bg-cyan-100 text-cyan-700' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {d.opp_type || 'N/A'}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700">
                              {d.stage}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-600">{d.region}</td>
                          <td className="px-3 py-2 text-right font-medium text-slate-800">{d.amount_usd > 0 ? formatCurrency(d.amount_usd) : '\u2014'}</td>
                          <td className="px-3 py-2 text-slate-500">{d.created_date}</td>
                          <td className="px-3 py-2 text-right">
                            <span className={`font-semibold ${daysOpen > 90 ? 'text-red-600' : daysOpen > 60 ? 'text-amber-600' : 'text-slate-600'}`}>
                              {daysOpen}d
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No stalled opportunities found</p>
            )}
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
            <h2 className="text-base font-semibold text-slate-800 mb-4">
              Opportunities &gt;$500K Without Partners
              <span className="ml-2 text-sm font-normal text-slate-400">({largeOppsNoPartner.length})</span>
            </h2>
            <p className="text-xs text-slate-400 mb-3">Open pipeline deals over $500K with no partner attached</p>
            {largeOppsNoPartner.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      <th className="px-3 py-2">Opp Name</th>
                      <th className="px-3 py-2">Account</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2">Region</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {largeOppsNoPartner.map(d => (
                      <tr key={d.opp_id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-2 max-w-48 truncate" title={d.opp_name}>{d.opp_name}</td>
                        <td className="px-3 py-2 text-slate-600">{d.account_name}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.opp_type === 'Direct' ? 'bg-cyan-100 text-cyan-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {d.opp_type || 'N/A'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-600">{d.stage}</td>
                        <td className="px-3 py-2 text-slate-600">{d.region}</td>
                        <td className="px-3 py-2 text-slate-600">{d.product}</td>
                        <td className="px-3 py-2 text-right font-medium text-red-600">{formatCurrency(d.amount_usd)}</td>
                        <td className="px-3 py-2 text-slate-500">{d.created_date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-400">No opportunities &gt;$500K without partners found</p>
            )}
          </div>
        </>
      )}
      </main>
    </div>
  )
}

function KPICard({ title, value, subtitle, icon, color }: {
  title: string
  value: string
  subtitle?: string
  icon: React.ReactNode
  color: string
}) {
  const bgMap: Record<string, string> = {
    emerald: 'bg-emerald-50',
    indigo: 'bg-indigo-50',
    cyan: 'bg-cyan-50',
    amber: 'bg-amber-50',
  }
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${bgMap[color] || 'bg-slate-50'}`}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
          <p className="text-xl font-bold text-slate-900">{value}</p>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  )
}

export default App
