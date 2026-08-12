#!/usr/bin/env node
/**
 * Hook PostToolUse: formata com Prettier todo arquivo que o Claude editar.
 *
 * Existe para que formatação nunca seja assunto de code review nem de
 * instrução em prosa no CLAUDE.md — é comportamento determinístico do harness.
 *
 * Usa a API do Prettier em vez de `npx prettier` porque `npx` gasta cerca de um
 * segundo só resolvendo o binário. Nunca falha o hook: um erro aqui não pode
 * interromper o trabalho de quem está editando.
 */
import { readFile, writeFile } from 'node:fs/promises'

const FORMATTABLE = /\.(m?[jt]sx?|css|json|md)$/

async function readStdin() {
  let data = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) data += chunk
  return data
}

try {
  const payload = JSON.parse(await readStdin())
  const filePath = payload?.tool_input?.file_path

  if (filePath && FORMATTABLE.test(filePath)) {
    const { format, resolveConfig } = await import('prettier')
    const config = await resolveConfig(filePath)
    const source = await readFile(filePath, 'utf8')
    const formatted = await format(source, { ...config, filepath: filePath })

    if (formatted !== source) await writeFile(filePath, formatted)
  }
} catch {
  // Arquivo com sintaxe inválida, Prettier ausente, stdin vazio: silêncio.
}

process.exit(0)
