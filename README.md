# Bulir Core API

API RESTful da plataforma de reservas de serviços (Desafio 1). Clientes reservam serviços de prestadores e pagam com o saldo que têm na plataforma.

**Stack:** NestJS 12 · TypeScript · Prisma · PostgreSQL · JWT · Swagger · Docker · Vitest

## Porquê PostgreSQL

O núcleo do negócio é dinheiro: débito do cliente, crédito do prestador e registo da reserva têm de acontecer **todos ou nenhum**. Uma base relacional com transações ACID e `Decimal` exato é a escolha natural (NoSQL exigiria compensações manuais). Os valores monetários são `Decimal(12,2)`, nunca `Float`.

## Como correr

```bash
cp .env.example .env        # preencher DATABASE_URL, DIRECT_URL e JWT_SECRET
npm install
npm run prisma:deploy       # aplica as migrações
npm run start:dev           # http://localhost:3000
npm test                    # testes (Prisma mockado)
```

### Com Docker (API + PostgreSQL, um único comando)

```bash
docker compose up --build   # http://localhost:3000, migrações aplicadas no arranque
```

Defina `JWT_SECRET` no ambiente para um segredo próprio. A imagem é multi-stage, corre como utilizador não-root e tem `HEALTHCHECK`.

### Documentação interativa (Swagger)

Com a API a correr: **`/docs`** (interface) e **`/docs-json`** (OpenAPI). Use *Authorize* com o token devolvido por `/auth/login`.

Base de dados local rápida com Docker:

```bash
docker run -d --name bulir-pg -e POSTGRES_PASSWORD=test -e POSTGRES_DB=bulir -p 55432:5432 postgres:16-alpine
# DATABASE_URL=DIRECT_URL=postgresql://postgres:test@localhost:55432/bulir
```

## Respostas e erros

Sucesso: `{ "success": true, "data": ... }`. Erro (formato único para todos os códigos):

```json
{ "success": false, "statusCode": 409, "message": "...", "errors": ["..."], "path": "/bookings", "timestamp": "..." }
```

`400` validação / saldo insuficiente · `401` token em falta ou inválido · `403` sem permissão · `404` não encontrado · `409` conflito (duplicado, já cancelada, serviço com reservas).

## Endpoints

Todos exigem `Authorization: Bearer <token>`, exceto `register`, `login` e `GET /`.

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| POST | `/auth/register` | público | Cadastro (nome, NIF, e-mail, senha, `role`). NIF e e-mail únicos (e-mail sem distinguir maiúsculas) |
| POST | `/auth/login` | público | `{ identifier, password }` com **e-mail ou NIF**. `email` ainda é aceite como alias |
| GET | `/users/me` | todos | Perfil e saldo |
| POST | `/users/deposit` | cliente | Carrega saldo (simulado, máx. 1.000.000) |
| GET | `/services` · `/services/:id` | todos | Lista / detalhe |
| POST | `/services` | prestador | Cria serviço (nome, descrição, preço > 0, até 2 casas) |
| PATCH | `/services/:id` | prestador dono | Edita; outro prestador recebe `403` |
| DELETE | `/services/:id` | prestador dono | Exclui; `409` se já tem reservas (preserva o histórico) |
| POST | `/bookings` | cliente | `{ serviceId }` reserva e move o dinheiro |
| GET | `/bookings` | todos | Histórico: cliente vê as suas, prestador as dos seus serviços |
| PATCH | `/bookings/:id/cancel` | cliente da reserva ou prestador do serviço | Devolve o valor por inteiro ao cliente e debita o prestador |

## Segurança

- **Rate limiting** (`@nestjs/throttler`): 120 pedidos/min por IP em toda a API e 10/min em `/auth/*` (força bruta e criação em massa de contas); excedido devolve `429`. Configurável por `THROTTLE_LIMIT` e `AUTH_THROTTLE_LIMIT`.
- **Cabeçalhos HTTP** com `helmet` (HSTS, `nosniff`, anti-clickjacking...).
- **SQL Injection:** acesso a dados só via Prisma (consultas parametrizadas). **XSS/mass assignment:** DTOs com `whitelist` e `forbidNonWhitelisted`. **CSRF:** o JWT segue no cabeçalho `Authorization`, não em cookie, por isso não há sessão ambiente para forjar.
- Senhas com `bcrypt`; e-mail e NIF nunca aparecem nas respostas sobre outros utilizadores.

## Decisões de design

- **Atomicidade sem locks manuais.** O débito do cliente é um único `UPDATE ... WHERE balance >= preço` dentro de `prisma.$transaction`. Verificar e debitar é um passo só, por isso pedidos concorrentes nunca gastam o mesmo saldo duas vezes e o saldo nunca fica negativo. Um saldo igual ao preço é suficiente.
- **Cancelamento idempotente.** A reserva passa de `CONFIRMED` a `CANCELLED` com `UPDATE ... WHERE status = 'CONFIRMED'`: com cancelamentos simultâneos só um reembolsa, os outros recebem `409`. Se o prestador já não tiver saldo para o estorno, tudo é revertido (`409`).
- **Autorização explícita.** `JwtAuthGuard` (sem Passport) autentica; `RolesGuard` + `@Roles()` aplicam o perfil; a posse do recurso (dono do serviço, participante da reserva) é verificada no service.
- **Validação por DTO** (`whitelist` + `forbidNonWhitelisted`) e filtro global que garante um único formato de erro.
- **Montante gravado na reserva** (`amount`): mudar o preço do serviço depois não altera o histórico nem o reembolso.

## Verificação feita

Além dos testes unitários, a lógica foi exercitada contra PostgreSQL real: com saldo para uma única reserva, 10 pedidos simultâneos produziram `201` + 9× `400` e saldo final 0; 5 cancelamentos simultâneos produziram `200` + 4× `409` com os saldos restaurados.
