# AI Usage

## AI tool used

- Claude sonnet 4.6

## What it helped with

AI was used selectively to speed up specific parts of the project, not to generate the project from scratch.

- **Seed data**: Generating the synthetic event rows in `seed.ts` — the users, timestamps, and boundary cases were designed by hand; AI was used to write the repetitive insert rows faster.
- **Frontend styling**: Accelerating the Tailwind utility class composition for layout, spacing, and color on the form and results components.
- **Boilerplate reduction**: Filling in repetitive TypeScript interface definitions and standard Express middleware patterns that follow well-established conventions.
- **Debugging assistance**: Identifying that Zod v4 changed `.errors` to `.issues` on `ZodError` when tests returned unexpected 500 responses.

## What AI did not do

- The architecture (DB injection, pure evaluator split, time-window decision, candidate-set approach) was designed and reasoned through independently.
- All business logic — `evaluateCondition`, `evaluateAudience`, the `asOf` UTC normalization, the zero-count handling — was written and verified by hand.
- The test cases and their boundary conditions were designed independently, based on the assignment requirements and the gaps analysis.
- The data model, API shape, and validation rules were decided before any code was generated.

## How AI output was used

Every AI suggestion was read, understood, and either accepted, modified, or rejected. No code was committed without being reviewed for correctness and clarity. The Zod schema, the Express error middleware ordering, and the frontend asOf date-picker conversion were all corrected after reviewing the generated output.
