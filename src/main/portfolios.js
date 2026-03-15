import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

function registryPath() {
  return join(app.getPath('home'), '.vinance', 'portfolios.json')
}

function load() {
  try {
    return JSON.parse(readFileSync(registryPath(), 'utf8'))
  } catch {
    return { portfolios: [], default: null }
  }
}

function save(reg) {
  const dir = join(app.getPath('home'), '.vinance')
  mkdirSync(dir, { recursive: true })
  writeFileSync(registryPath(), JSON.stringify(reg, null, 2))
}

export function listPortfolios() {
  const reg = load()
  return { portfolios: reg.portfolios, default: reg.default }
}

export function getDefaultPath() {
  return load().default
}

export function addPortfolio({ name, path }) {
  const reg = load()
  const idx = reg.portfolios.findIndex(p => p.path === path)
  const entry = { name, path, lastOpened: new Date().toISOString() }
  if (idx >= 0) reg.portfolios[idx] = entry
  else reg.portfolios.push(entry)
  save(reg)
  return entry
}

export function touchPortfolio(path) {
  const reg = load()
  const entry = reg.portfolios.find(p => p.path === path)
  if (entry) { entry.lastOpened = new Date().toISOString(); save(reg) }
}

export function setDefault(path) {
  const reg = load()
  reg.default = path
  save(reg)
}

export function removePortfolio(path) {
  const reg = load()
  reg.portfolios = reg.portfolios.filter(p => p.path !== path)
  if (reg.default === path) reg.default = reg.portfolios[0]?.path ?? null
  save(reg)
}

export function getPortfolioName(path) {
  const reg = load()
  return reg.portfolios.find(p => p.path === path)?.name ?? null
}
