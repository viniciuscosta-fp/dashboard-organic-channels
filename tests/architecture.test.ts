import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(import.meta.dirname, '..', 'src')

function listFiles(dir: string): string[] {
  let entries: string[]
  try {
    entries = readdirSync(dir)
  } catch {
    return []
  }

  return entries.flatMap((entry) => {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) return listFiles(full)
    return /\.tsx?$/.test(entry) ? [full] : []
  })
}

function importsOf(file: string): string[] {
  const contents = readFileSync(file, 'utf8')
  return [...contents.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((match) => match[1])
}

/**
 * A regra que sustenta a troca futura de Google Sheets por um banco: nenhum
 * componente conhece a fonte de dados. Se este teste falhar, a fronteira foi
 * rompida e a migração vira refactor de UI. Ver docs/decisions/0001.
 */
describe('fronteira entre UI e fonte de dados', () => {
  const componentFiles = listFiles(path.join(SRC, 'components'))

  it('encontra componentes para inspecionar', () => {
    expect(componentFiles.length).toBeGreaterThan(0)
  })

  it.each([
    ['google-auth-library', /google-auth-library/],
    ['o repositório de Sheets', /sheets-funnel-repository/],
    ['o parser de Sheets', /sheets-parser/],
    ['a validação de ambiente', /lib\/env/],
  ])('nenhum componente importa %s', (_label, forbidden) => {
    const offenders = componentFiles.filter((file) =>
      importsOf(file).some((specifier) => forbidden.test(specifier)),
    )

    expect(offenders.map((file) => path.relative(SRC, file))).toEqual([])
  })
})
