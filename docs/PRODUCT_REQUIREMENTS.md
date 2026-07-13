# Product Requirements — Family Meal Log MVP (v0.1)

## 1. Product objective

Provide a household with a simple, reliable way to record daily food intake per family
member, and to see calories and macronutrients (protein, carbohydrate, fat) per meal and
per day. The **manual** logging path is the product's backbone and must work at all times;
photo-based AI recognition is an optional accelerator added later.

## 2. Target users

- **Primary:** the household "meal logger" — typically one adult who records meals for
  several family members (self, spouse, children, parents).
- **Secondary:** other adults in the family who may log their own meals.
- **Context:** casual, everyday use on a phone via WeChat; users are health-aware but not
  clinicians. They want low-friction entry, not precision lab data.

Not targeted: dieticians needing clinical accuracy, patients needing disease-specific
guidance (explicitly excluded), or businesses.

## 3. Core user journey

1. Open the Mini Program → sign in with WeChat (silent, server-derived identity).
2. Select which **family member** the meal is for.
3. Choose a **meal slot** (breakfast / lunch / dinner / snack).
4. Add food items **manually**: pick/enter a food, choose a portion unit and quantity.
5. The app converts portions to grams and computes calories + macros automatically.
6. (Optional, later) Upload a **photo** → AI proposes items → user **confirms/corrects**.
7. Save the meal.
8. View the **daily history** and **daily totals** for the selected member.

## 4. Functional requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR-1 | Authenticate the user via WeChat; derive identity (openid) server-side. | Must |
| FR-2 | Create and manage multiple family-member profiles under one account. | Must |
| FR-3 | Select an active family profile before logging. | Must |
| FR-4 | Record meals in four slots: breakfast, lunch, dinner, snack. | Must |
| FR-5 | Enter food items manually (from catalog or ad-hoc). | Must |
| FR-6 | Support portion units with gram-equivalent conversion. | Must |
| FR-7 | Compute calories, protein, carbohydrate, fat per item and per meal. | Must |
| FR-8 | Compute per-day totals per family member. | Must |
| FR-9 | Save, edit and delete meals. | Must |
| FR-10 | View daily meal history. | Must |
| FR-11 | Save reusable foods ("saved foods"). | Should |
| FR-12 | Define simple family recipes that resolve to nutrition per serving. | Should |
| FR-13 | Upload a meal photo to CloudBase storage. | Should (later) |
| FR-14 | Request AI food suggestions via a provider-neutral adapter. | Should (later) |
| FR-15 | Require explicit user confirmation/correction of AI suggestions before they count. | Must (when AI on) |
| FR-16 | Function fully with AI unavailable (mock or disabled). | Must |

## 5. Non-functional requirements

- **Reliability:** manual logging must never depend on AI, network AI calls, or a
  configured AI provider. AI failure degrades gracefully to manual.
- **Correctness:** nutrition math is centralized, unit-tested, and independent of AI.
- **Security & privacy:** identity derived server-side; no secrets/env IDs/keys in client
  code or the repo; least-privilege cloud functions; per-user data isolation.
- **Maintainability:** shared schemas/validation used by both client and server; TypeScript
  with strict mode; minimal third-party dependencies.
- **Environments:** separate development and production CloudBase environments.
- **Localization:** Chinese UI; English code identifiers.
- **Performance:** daily views should load quickly on typical mobile networks; keep reads
  scoped per user/day.

## 6. Explicitly excluded features (v0.1)

- Payments, subscriptions, or any commercial/monetization feature.
- Social feeds, sharing, comments, following.
- Medical advice, disease-specific recommendations, or clinical scoring.
- Wearable/health-platform integrations.
- A full design system / theming framework.
- Treating AI output as the authoritative source of nutrition.
- Multi-account family sharing across different WeChat users (single-owner model for v0.1).
- Deletion of family profiles (M1 implements create/list/update/select/set-default only;
  archive/soft-delete is deferred and will be designed later).
- Nutrition goals, calorie targets, or medical/health attributes on profiles (deferred).

## 7. MVP acceptance criteria

The MVP (across milestones) is accepted when:

1. A user can sign in and the app resolves a stable server-side identity.
2. A user can create ≥ 2 family profiles and switch the active one.
3. A user can log a meal in any of the four slots by manual entry.
4. Portion → gram conversion and calorie/macro calculation are correct and match the
   shared nutrition layer's tests.
5. Daily totals per family member equal the sum of that day's confirmed meal items.
6. A user can edit and delete a saved meal, and totals update accordingly.
7. Daily history shows meals grouped by slot for a chosen date.
8. With AI disabled or failing, every step above still works end-to-end.
9. When AI (mock) is enabled, suggestions appear but only affect the meal after explicit
   user confirmation/correction.
10. No secrets, env IDs, or API keys are present in the repository or client bundle.

### Acceptance for THIS foundation task (M0)

- Repository structure, docs, shared layer, config templates, and a minimal compilable
  Mini Program shell exist.
- `npm run validate` passes (type-check + shared build + structural/logic smoke tests).
- No real credentials committed.
