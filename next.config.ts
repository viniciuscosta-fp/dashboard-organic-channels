import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Habilita `use cache` / `cacheLife` / `cacheTag`, usados na camada de dados
  // para segurar a leitura da planilha por uma hora. Ver src/lib/data/funnel-service.ts
  cacheComponents: true,

  typedRoutes: true,
}

export default nextConfig
