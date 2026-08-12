---
paths:
  - '**/*.test.ts'
  - '**/*.test.tsx'
  - 'tests/**'
---

# Testes

Vitest com ambiente jsdom. Teste unitário fica ao lado do código
(`funnel-query.test.ts`); teste que cobre o projeto inteiro fica em `tests/`.

## O que merece teste

- Toda função pura de `src/lib/**` — transformação, agregação, formatação
- Todo parser de fonte externa, incluindo os caminhos de erro
- A fronteira de arquitetura (`tests/architecture.test.ts`)

## O que não merece

Componente que só repassa props para markup. Testar que um `<h2>` contém o
texto que você acabou de passar não protege contra nada.

## Como escrever

Nome do teste descreve o comportamento em português, na voz do sistema:
`'ignora linhas em branco no fim do intervalo'`, não `'testa parseRows'`.

Dado de teste é declarado no arquivo do teste, não importado do mock de
produção — exceto quando o próprio mock é o objeto sob teste.

Caso de erro verifica a mensagem, não só o tipo. Uma mensagem que perdeu o
número da linha continua passando num teste que só checa `toThrowError(Error)`.
