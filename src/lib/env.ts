import { z } from 'zod'

/**
 * Validação das variáveis de ambiente do servidor.
 *
 * Falha no boot com mensagem explícita em vez de deixar `undefined` propagar
 * até uma chamada de API que quebra em produção sem explicação.
 */
const envSchema = z
  .object({
    /** Qual implementação de FunnelRepository usar. Ver src/lib/data/funnel-repository.ts */
    DATA_SOURCE: z.enum(['mock', 'sheets']).default('mock'),

    /** Credenciais da service account do Google. Obrigatórias apenas com DATA_SOURCE=sheets. */
    GOOGLE_SERVICE_ACCOUNT_EMAIL: z.email().optional(),
    GOOGLE_PRIVATE_KEY: z.string().min(1).optional(),

    /** ID da planilha (o trecho entre /d/ e /edit na URL). */
    FUNNEL_SHEET_ID: z.string().min(1).optional(),
    /** Intervalo da aba do funil em notação A1, incluindo a linha de cabeçalho. */
    FUNNEL_SHEET_RANGE: z.string().min(1).default('funil!A:F'),

    /** Intervalo da aba de metas, na mesma planilha. */
    GOALS_SHEET_RANGE: z.string().min(1).default('metas!A:D'),

    /** Intervalo da aba de cadastro de canais, na mesma planilha. */
    CHANNELS_SHEET_RANGE: z.string().min(1).default('canais!A:D'),
  })
  .superRefine((value, ctx) => {
    if (value.DATA_SOURCE !== 'sheets') return

    const required = [
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
      'GOOGLE_PRIVATE_KEY',
      'FUNNEL_SHEET_ID',
    ] as const

    for (const key of required) {
      if (!value[key]) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} é obrigatório quando DATA_SOURCE=sheets`,
        })
      }
    }
  })

export type Env = z.infer<typeof envSchema>

function parseEnv(): Env {
  const parsed = envSchema.safeParse(process.env)

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(raiz)'}: ${issue.message}`)
      .join('\n')

    throw new Error(
      `Variáveis de ambiente inválidas:\n${details}\n\nCopie .env.example para .env.local e preencha os valores.`,
    )
  }

  return parsed.data
}

let cached: Env | undefined

/**
 * Lê e valida o ambiente uma única vez por processo.
 *
 * É uma função, e não uma constante exportada, para que a validação rode na
 * primeira leitura em tempo de request — e não durante o build, quando as
 * variáveis de produção ainda não estão disponíveis.
 */
export function getEnv(): Env {
  cached ??= parseEnv()
  return cached
}

/**
 * A chave privada da service account chega das env vars com `\n` literal
 * (dois caracteres) porque não há como quebrar linha num painel da Vercel.
 * O cliente OAuth precisa de quebras de linha reais.
 */
export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n')
}
