'use client'

import { useState, useEffect } from 'react'
import {
  Sun,
  Moon,
  CloudSun,
  CloudMoon,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Droplets,
  Sunrise,
  Sunset,
  Thermometer,
  type LucideIcon,
} from 'lucide-react'

// Bear Lake Township, Kalkaska County — close enough for Cub Lake weather
const LAT = 44.75
const LON = -84.96

const FORECAST_URL =
  `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
  '&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day' +
  '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_probability_max' +
  '&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FDetroit&forecast_days=7'

interface Weather {
  temp: number
  feelsLike: number
  humidity: number
  code: number
  wind: number
  isDay: boolean
  sunrise: string
  sunset: string
  days: Array<{
    date: string
    code: number
    high: number
    low: number
    precipChance: number
  }>
}

// WMO weather codes → label + day/night icons
function describeCode(code: number, isDay: boolean): { label: string; icon: LucideIcon } {
  if (code === 0) return { label: isDay ? 'Clear skies' : 'Clear night', icon: isDay ? Sun : Moon }
  if (code <= 2) return { label: 'Partly cloudy', icon: isDay ? CloudSun : CloudMoon }
  if (code === 3) return { label: 'Overcast', icon: Cloud }
  if (code <= 48) return { label: 'Fog on the water', icon: CloudFog }
  if (code <= 57) return { label: 'Drizzle', icon: CloudDrizzle }
  if (code <= 67) return { label: 'Rain', icon: CloudRain }
  if (code <= 77) return { label: 'Snow', icon: CloudSnow }
  if (code <= 82) return { label: 'Rain showers', icon: CloudRain }
  if (code <= 86) return { label: 'Snow showers', icon: CloudSnow }
  return { label: 'Thunderstorm', icon: CloudLightning }
}

// The fun part — what kind of lake day is it?
function lakeVerdict(w: Weather): string {
  const { code, feelsLike, wind, isDay } = w
  if (code >= 95) return 'Storm rolling over the lake — board games and a good view.'
  if (code >= 71 && code <= 86) return 'The lake is wearing white. Cocoa weather.'
  if (code >= 61) return 'Rain on the cottage roof — the best sound there is.'
  if (code >= 51) return 'A soft drizzle — porch-sitting weather.'
  if (code >= 45) return 'Fog drifting off the water — moody and beautiful.'
  if (wind >= 20) return 'Whitecaps on Cub Lake — hold onto your hat.'
  if (feelsLike <= 32) return 'Frozen-lake quiet. Bundle up out there.'
  if (!isDay) return feelsLike >= 50 ? 'Fire pit night. Bring the marshmallows.' : 'Cold and starry — blanket on the deck kind of night.'
  if (feelsLike >= 75) return 'Perfect dock day — sunscreen and a cold drink.'
  if (feelsLike >= 58) return 'Coffee-on-the-dock weather. Go enjoy it.'
  return 'Crisp lake air — sweater on, walk the shoreline.'
}

function formatTime(isoLocal: string): string {
  // API returns local time like "2026-06-11T21:27" — format the HH:MM as 12-hour
  const [h, m] = isoLocal.slice(11, 16).split(':').map(Number)
  const period = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function dayLabel(dateStr: string, index: number): string {
  if (index === 0) return 'Today'
  const [y, mo, d] = dateStr.split('-').map(Number)
  return new Date(y, mo - 1, d).toLocaleDateString('en-US', { weekday: 'short' })
}

export function LakeReport() {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const res = await fetch(FORECAST_URL)
        if (!res.ok) throw new Error(`Weather API responded ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        setWeather({
          temp: Math.round(data.current.temperature_2m),
          feelsLike: Math.round(data.current.apparent_temperature),
          humidity: Math.round(data.current.relative_humidity_2m),
          code: data.current.weather_code,
          wind: Math.round(data.current.wind_speed_10m),
          isDay: data.current.is_day === 1,
          sunrise: data.daily.sunrise[0],
          sunset: data.daily.sunset[0],
          days: data.daily.time.map((date: string, i: number) => ({
            date,
            code: data.daily.weather_code[i],
            high: Math.round(data.daily.temperature_2m_max[i]),
            low: Math.round(data.daily.temperature_2m_min[i]),
            precipChance: data.daily.precipitation_probability_max[i] ?? 0,
          })),
        })
        setFailed(false)
      } catch (err) {
        console.error('Lake report fetch failed:', err)
        if (!cancelled) setFailed(true)
      }
    }

    load()
    const intervalId = setInterval(load, 30 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  const current = weather ? describeCode(weather.code, weather.isDay) : null

  return (
    <section id="weather" className="px-6 py-20 md:px-12 lg:px-20 relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute -top-10 left-1/4 w-72 h-72 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(70, 130, 180, 0.12)' }} />
        <div className="absolute bottom-0 right-1/4 w-56 h-56 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(212, 165, 116, 0.12)' }} />
      </div>

      <div className="max-w-6xl mx-auto relative">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-3 rounded-2xl" style={{ backgroundColor: 'rgba(70, 130, 180, 0.1)' }}>
            <CloudSun className="w-6 h-6" style={{ color: '#4682b4' }} />
          </div>
          <div>
            <h2 className="font-serif text-3xl md:text-4xl font-medium">The Lake Report</h2>
            <p className="text-muted-foreground mt-1">Live conditions at the cottage — updates every half hour</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
          {failed && !weather ? (
            <div className="p-10 text-center text-muted-foreground text-sm">
              Couldn&apos;t reach the weather station — check back in a bit.
            </div>
          ) : !weather || !current ? (
            <div className="p-8 md:p-10 animate-pulse space-y-6">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-2xl bg-muted" />
                <div className="space-y-3">
                  <div className="h-10 w-40 rounded-lg bg-muted" />
                  <div className="h-4 w-64 rounded-lg bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className={`h-28 rounded-2xl bg-muted ${i >= 4 ? 'hidden md:block' : ''}`} />
                ))}
              </div>
            </div>
          ) : (
            <div className="p-8 md:p-10">
              <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-12 mb-10">
                {/* Current conditions */}
                <div className="flex items-center gap-6">
                  <div
                    className="p-5 rounded-3xl shrink-0"
                    style={{ backgroundColor: weather.isDay ? 'rgba(212, 165, 116, 0.15)' : 'rgba(70, 130, 180, 0.12)', color: weather.isDay ? '#d4a574' : '#4682b4' }}
                  >
                    <current.icon className="w-12 h-12 md:w-14 md:h-14" strokeWidth={1.5} />
                  </div>
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-serif text-6xl md:text-7xl font-medium leading-none">{weather.temp}°</span>
                      <span className="text-muted-foreground text-lg">F</span>
                    </div>
                    <p className="text-lg font-medium mt-1.5">{current.label}</p>
                  </div>
                </div>

                {/* Verdict + detail chips */}
                <div className="flex-1">
                  <p className="font-serif text-xl md:text-2xl italic leading-snug mb-5" style={{ color: '#3d5a3c' }}>
                    &ldquo;{lakeVerdict(weather)}&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {[
                      { icon: Thermometer, label: `Feels like ${weather.feelsLike}°` },
                      { icon: Wind, label: `${weather.wind} mph wind` },
                      { icon: Droplets, label: `${weather.humidity}% humidity` },
                      { icon: Sunrise, label: formatTime(weather.sunrise) },
                      { icon: Sunset, label: formatTime(weather.sunset) },
                    ].map(({ icon: Icon, label }) => (
                      <span key={label} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-secondary/60 border border-border text-sm">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{label}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 7-day forecast */}
              <div className="grid grid-cols-4 md:grid-cols-7 gap-3">
                {weather.days.map((day, i) => {
                  const desc = describeCode(day.code, true)
                  return (
                    <div
                      key={day.date}
                      className={`flex flex-col items-center gap-2 py-4 px-2 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        i === 0 ? 'border-transparent' : 'bg-background border-border'
                      } ${i >= 4 ? 'hidden md:flex' : ''}`}
                      style={i === 0 ? { backgroundColor: 'rgba(61, 90, 60, 0.08)' } : undefined}
                      title={desc.label}
                    >
                      <span className={`text-xs font-semibold uppercase tracking-wider ${i === 0 ? '' : 'text-muted-foreground'}`} style={i === 0 ? { color: '#3d5a3c' } : undefined}>
                        {dayLabel(day.date, i)}
                      </span>
                      <desc.icon className="w-6 h-6" style={{ color: i === 0 ? '#3d5a3c' : '#4682b4' }} strokeWidth={1.75} />
                      <div className="text-sm">
                        <span className="font-semibold">{day.high}°</span>
                        <span className="text-muted-foreground"> / {day.low}°</span>
                      </div>
                      {day.precipChance >= 25 ? (
                        <span className="inline-flex items-center gap-1 text-xs" style={{ color: '#4682b4' }}>
                          <Droplets className="w-3 h-3" />
                          {day.precipChance}%
                        </span>
                      ) : (
                        <span className="text-xs text-transparent select-none">·</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <p className="text-xs text-muted-foreground mt-6 text-center">
                Kalkaska, Michigan · weather data by{' '}
                <a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground transition-colors">
                  Open-Meteo
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
