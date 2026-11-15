# Alterações ao backend (a notificar, com motivação)

Os Desafios 2 e 3 (web e mobile) pedem que se notifiquem alterações feitas ao backend, justificando-as. Resumo do que mudou e porquê.

| # | Alteração | Motivo | Compatível com clientes anteriores? |
|---|---|---|---|
| 1 | **Módulo `services`** (`GET/POST /services`, `GET/PATCH/DELETE /services/:id`) | Só existiam `auth` e `users`; as pastas `services` e `bookings` estavam vazias. Sem isto o web e o mobile não têm o que consumir. Requisitos 1.3 do Desafio 1 | Novo |
| 2 | **Módulo `bookings`** (`POST /bookings`, `GET /bookings`, `PATCH /bookings/:id/cancel`) | Requisitos 1.4, 2.1 e 2.2: reservar, histórico, cancelar, saldo atómico | Novo |
| 3 | **Login por e-mail ou NIF**: `POST /auth/login` aceita `{ identifier, password }` | O enunciado dos Desafios 2 e 3 exige "e-mail e senha, ou NIF e senha". O DTO anterior só aceitava e-mail (`@IsEmail`) | Sim: `email` continua aceite como alias |
| 4 | **`RolesGuard` + `@Roles()`** | Garantir que só prestadores criam/editam/excluem serviços e só clientes reservam (403), de forma declarativa e testável | Não altera contratos |
| 5 | **Cancelamento também pelo prestador** | A especificação do Desafio QA diz que o cancelamento pode ser feito pelo cliente **ou** pelo prestador do serviço | Novo comportamento |
| 6 | **Contraparte só com `id` e `name`** em serviços e reservas (sem `email`/`nif`) | Privacidade: o e-mail e o NIF de outros utilizadores não são necessários e não devem ser expostos (defeito D-01 do relatório de QA) | Cliente que lia `provider.email`/`nif` deixa de os receber; nenhum cliente oficial os usava |
| 7 | **Aviso quando `JWT_SECRET` não está definido** | Segurança (D-02 do relatório de QA): o fallback é um segredo público | Não altera comportamento |

## Pontos de atenção para quem avalia

- `POST /bookings` com saldo insuficiente devolve **400**. A especificação lista 400/401/403/404/409 sem indicar qual; a decisão está documentada no README.
- Excluir um serviço que já tem reservas devolve **409**, para preservar o histórico.
- Em produção é obrigatório definir `JWT_SECRET`.
