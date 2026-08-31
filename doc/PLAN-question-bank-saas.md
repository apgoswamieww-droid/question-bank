# Question Bank SaaS — Architecture Plan

> This is the **base architecture** for the Question Bank module. It must be solid, secure, and optimized for both **web** and **mobile (app)** consumption.

---

## 1. Vision & Scope

Build a **cloud-based Question Bank** where:
- **Teachers** create, organize, and manage questions
- **Students** attempt tests/quizzes from question banks
- **Parents** view reports and performance
- **Admins** manage the platform, teachers, and content

This replaces the current file-based `.qbank` storage with a **server-backed, multi-tenant SaaS** system.

---

## 2. Core Concepts & Terminology

| Concept | Description |
|---------|-------------|
| **Question Bank** | A collection of questions organized by subject/topic (e.g., "Std 10 Maths — Chapter 1") |
| **Question** | A single question with type, content, options/answer, metadata |
| **Test/Quiz** | A selection of questions from one or more banks, configured for students |
| **Attempt** | A student's submission of answers for a test |
| **Subject** | Academic subject (Maths, Science, English…) |
| **Topic** | Sub-division within a subject (Algebra, Geometry…) |
| **Difficulty** | easy / medium / hard / expert |
| **Tags** | Freeform labels for filtering (e.g., "board-exam", "mid-term", "2025") |

---

## 3. Question Types

| Type | Code | Storage | Description |
|------|------|---------|-------------|
| Multiple Choice (Single) | `mcq_single` | Options array, one `correctIndex` | Classic MCQ |
| Multiple Choice (Multi) | `mcq_multi` | Options array, array of `correctIndexes` | One or more correct |
| True / False | `true_false` | Boolean `correctAnswer` | Simple T/F |
| Fill in the Blank | `fill_blank` | Array of accepted `answers` (case-insensitive) | Text input |
| Short Answer | `short_answer` | Model answer text (human-graded or keyword-match) | 1-2 sentence |
| Long Answer / Essay | `long_answer` | Model answer + rubric (JSON) | Human-graded |
| Match the Following | `match` | Pairs array `[{left, right}]` | Drag-match |
| Ordering / Sequence | `ordering` | Ordered array of items | Arrange in order |
| Image-Based | `image_based` | Same as above + required `image` URL | Question has image |
| Numeric | `numeric` | `correctValue`, `tolerance`, `unit` | Math/science numeric |

> All types share a common `Question` interface. Type-specific data lives in a `payload` JSON field.

---

## 4. Database Schema (Supabase/Postgres)

### 4.1 Entity Relationship Diagram (text)

```
subjects ──< topics ──< question_banks ──< questions
                                              │
                                          question_options (for MCQ types)
                                              │
                                          question_images
                                              │
                               tests ──< test_questions ──< attempts ──< attempt_answers
```

### 4.2 Tables

#### `subjects`
```sql
create table public.subjects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  icon        text,
  color       text,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

#### `topics`
```sql
create table public.topics (
  id          uuid primary key default gen_random_uuid(),
  subject_id  uuid not null references public.subjects(id) on delete cascade,
  name        text not null,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(subject_id, name)
);
```

#### `question_banks`
```sql
create table public.question_banks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  subject_id  uuid references public.subjects(id) on delete set null,
  topic_id    uuid references public.topics(id) on delete set null,
  owner_id    uuid not null references public.users(id) on delete cascade,
  status      text not null default 'draft' check (status in ('draft','published','archived')),
  visibility  text not null default 'private' check (visibility in ('private','shared','public')),
  tags        text[] default '{}',
  difficulty  text check (difficulty in ('easy','medium','hard','expert')),
  standard    text,  -- e.g. "Std 10"
  academic_year text,
  question_count int not null default 0,
  total_marks    int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

#### `questions`
```sql
create table public.questions (
  id              uuid primary key default gen_random_uuid(),
  bank_id         uuid not null references public.question_banks(id) on delete cascade,
  created_by      uuid not null references public.users(id),
  type            text not null check (type in (
    'mcq_single','mcq_multi','true_false','fill_blank',
    'short_answer','long_answer','match','ordering','image_based','numeric'
  )),
  content         jsonb not null,  -- Tiptap JSON or structured content
  explanation     jsonb,           -- Solution/explanation (Tiptap JSON)
  difficulty      text check (difficulty in ('easy','medium','hard','expert')),
  marks           int not null default 1,
  negative_marks  int not null default 0,
  time_limit_sec  int,             -- optional per-question time limit
  tags            text[] default '{}',
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

#### `question_options` (for MCQ types)
```sql
create table public.question_options (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  text        jsonb not null,       -- Tiptap JSON (supports math, images, rich text)
  is_correct  boolean not null default false,
  sort_order  int not null default 0
);
```

#### `question_payloads` (type-specific data)
```sql
-- Stores type-specific payload as JSONB for flexibility
create table public.question_payloads (
  question_id   uuid primary key references public.questions(id) on delete cascade,
  payload       jsonb not null default '{}',
  -- Examples:
  -- mcq_single: { "correctIndex": 2 }
  -- mcq_multi:  { "correctIndexes": [0, 2] }
  -- true_false: { "correctAnswer": true }
  -- fill_blank: { "answers": ["photosynthesis", "Photosynthesis"], "caseSensitive": false }
  -- numeric:    { "correctValue": 9.8, "tolerance": 0.1, "unit": "m/s²" }
  -- match:      { "pairs": [{ "left": "A", "right": "1" }, ...] }
  -- ordering:   { "correctOrder": ["item3", "item1", "item2"] }
  -- long_answer:{ "rubric": { "total": 5, "criteria": [...] } }
  created_at    timestamptz not null default now()
);
```

#### `question_images`
```sql
create table public.question_images (
  id          uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete cascade,
  url         text not null,
  alt_text    text,
  width       int,
  height      int,
  sort_order  int not null default 0
);
```

#### `tests` (quiz/exam configurations)
```sql
create table public.tests (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  bank_ids      uuid[] not null,         -- which question banks to pull from
  created_by    uuid not null references public.users(id),
  status        text not null default 'draft' check (status in ('draft','scheduled','active','completed')),
  start_time    timestamptz,
  end_time      timestamptz,
  duration_min  int not null default 60,
  total_marks   int not null default 0,
  passing_marks int,
  shuffle_questions boolean not null default false,
  shuffle_options   boolean not null default false,
  max_attempts  int not null default 1,
  show_results  boolean not null default true,
  show_answers  boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
```

#### `test_questions` (selected questions for a test)
```sql
create table public.test_questions (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.tests(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  sort_order  int not null default 0,
  marks       int not null default 1,
  unique(test_id, question_id)
);
```

#### `test_assignments` (who takes which test)
```sql
create table public.test_assignments (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.tests(id) on delete cascade,
  student_id  uuid not null references public.users(id) on delete cascade,
  assigned_by uuid references public.users(id),
  status      text not null default 'pending' check (status in ('pending','in_progress','completed','expired')),
  assigned_at timestamptz not null default now(),
  unique(test_id, student_id)
);
```

#### `attempts` (student test submissions)
```sql
create table public.attempts (
  id          uuid primary key default gen_random_uuid(),
  test_id     uuid not null references public.tests(id),
  student_id  uuid not null references public.users(id),
  started_at  timestamptz not null default now(),
  submitted_at timestamptz,
  score       int,
  total_marks int,
  status      text not null default 'in_progress' check (status in ('in_progress','submitted','graded')),
  time_spent_sec int
);
```

#### `attempt_answers` (individual answers)
```sql
create table public.attempt_answers (
  id            uuid primary key default gen_random_uuid(),
  attempt_id    uuid not null references public.attempts(id) on delete cascade,
  question_id   uuid not null references public.questions(id),
  answer        jsonb not null,  -- { "selectedIndexes": [0], "text": "...", "value": 42, ... }
  is_correct    boolean,
  marks_obtained int default 0,
  time_spent_sec int,
  answered_at   timestamptz not null default now()
);
```

### 4.3 Indexes for Performance
```sql
-- Question banks
CREATE INDEX idx_qbanks_owner ON question_banks(owner_id);
CREATE INDEX idx_qbanks_subject ON question_banks(subject_id);
CREATE INDEX idx_qbanks_status ON question_banks(status);
CREATE INDEX idx_qbanks_tags ON question_banks USING GIN(tags);

-- Questions
CREATE INDEX idx_questions_bank ON questions(bank_id);
CREATE INDEX idx_questions_type ON questions(type);
CREATE INDEX idx_questions_difficulty ON questions(difficulty);
CREATE INDEX idx_questions_tags ON questions USING GIN(tags);
CREATE INDEX idx_questions_active ON questions(is_active) WHERE is_active = true;

-- Tests
CREATE INDEX idx_tests_status ON tests(status);
CREATE INDEX idx_tests_created_by ON tests(created_by);

-- Attempts
CREATE INDEX idx_attempts_student ON attempts(student_id);
CREATE INDEX idx_attempts_test ON attempts(test_id);
CREATE INDEX idx_attempts_status ON attempts(status);
```

### 4.4 Row Level Security (RLS)
```sql
-- Teachers can only manage their own question banks
-- Students can only view published banks and their own attempts
-- Super admins have full access

ALTER TABLE question_banks ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

-- Teachers: full CRUD on their own banks
CREATE POLICY "teacher_manage_own_banks" ON question_banks
  FOR ALL USING (
    auth.uid() = owner_id
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Students: read published banks only
CREATE POLICY "student_view_published" ON question_banks
  FOR SELECT USING (
    status = 'published'
    OR owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Similar policies for questions, tests, attempts...
```

---

## 5. API Design (REST + Realtime)

### 5.1 Endpoints

#### Question Banks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/qbanks` | teacher+ | List my question banks |
| `POST` | `/api/qbanks` | teacher+ | Create question bank |
| `GET` | `/api/qbanks/:id` | teacher+ | Get bank with questions |
| `PATCH` | `/api/qbanks/:id` | owner | Update bank |
| `DELETE` | `/api/qbanks/:id` | owner | Delete bank |
| `POST` | `/api/qbanks/:id/publish` | owner | Publish bank |
| `POST` | `/api/qbanks/:id/archive` | owner | Archive bank |

#### Questions
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/qbanks/:bankId/questions` | teacher+ | List questions in bank |
| `POST` | `/api/qbanks/:bankId/questions` | owner | Add question to bank |
| `PATCH` | `/api/questions/:id` | owner | Update question |
| `DELETE` | `/api/questions/:id` | owner | Delete question |
| `POST` | `/api/questions/:id/duplicate` | owner | Duplicate question |
| `POST` | `/api/qbanks/:bankId/questions/import` | owner | Bulk import (JSON/CSV) |
| `GET` | `/api/qbanks/:bankId/questions/export` | owner | Export questions |

#### Tests
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/tests` | teacher+ | List tests I created |
| `POST` | `/api/tests` | teacher+ | Create test from bank(s) |
| `GET` | `/api/tests/:id` | teacher+ | Get test details |
| `PATCH` | `/api/tests/:id` | teacher+ | Update test |
| `POST` | `/api/tests/:id/assign` | teacher+ | Assign to students |
| `GET` | `/api/tests/:id/results` | teacher+ | View results |

#### Student Test Flow
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/student/tests` | student | My assigned tests |
| `POST` | `/api/student/tests/:id/start` | student | Start attempt |
| `POST` | `/api/student/tests/:id/answer` | student | Submit answer |
| `POST` | `/api/student/tests/:id/submit` | student | Submit entire test |
| `GET` | `/api/student/attempts/:id/result` | student | View my result |

#### Subjects & Topics
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/subjects` | all | List subjects |
| `POST` | `/api/subjects` | admin | Create subject |
| `GET` | `/api/subjects/:id/topics` | all | List topics |
| `POST` | `/api/subjects/:id/topics` | admin | Create topic |

### 5.2 Realtime (Supabase Realtime)
- **Test submissions**: Students see live countdown timer
- **Results**: Teachers see live attempt counts
- **Notifications**: New test assigned, test graded

---

## 6. Security Architecture

### 6.1 Authentication & Authorization
- JWT-based auth (existing system)
- Role-based access: `super_admin`, `teacher`, `student`, `parent`
- RLS policies on all tables (defense in depth)

### 6.2 Data Security
- **Images**: Stored in Supabase Storage with signed URLs (24h expiry)
- **Content validation**: Sanitize all JSONB content server-side
- **Rate limiting**: API rate limits per user (existing pattern)
- **CORS**: Restrict to known origins

### 6.3 Anti-Cheating (Tests)
- Shuffle questions and options per student
- Time-limited attempts with server-side clock
- Tab-switch detection (client-side, reported to server)
- IP-based anomaly detection (stretch goal)

### 6.4 Content Security
- Teachers can only edit their own banks
- Published banks are read-only for teachers (must unpublish to edit)
- Students never see correct answers until teacher releases them
- All image uploads scanned for malware (Supabase Storage built-in)

---

## 7. Cross-Platform Strategy (Web + Mobile)

### 7.1 Shared Backend
- **Single API server** serves both web and mobile
- Same Supabase database, same RLS policies
- Same JWT tokens (mobile stores in SecureStorage)

### 7.2 API Contract
- All endpoints return **JSON:API-compatible** responses
- Pagination via `offset`/`limit` or cursor-based
- Field selection via `?fields=` query param (reduce mobile bandwidth)

### 7.3 Mobile-Specific Considerations
- **Offline support**: Cache question banks locally (SQLite/AsyncStorage)
- **Image optimization**: Serve WebP, different sizes for mobile
- **Push notifications**: New test assigned, results ready
- **Biometric auth**: Fingerprint/face unlock on mobile

### 7.4 Web-Specific
- **Rich editor**: Tiptap-based question editor (existing)
- **Bulk operations**: Import/export CSV, bulk edit
- **Print**: Generate PDF question papers

---

## 8. Data Flow — Key Scenarios

### 8.1 Teacher Creates Question Bank
```
Teacher → Web/Mobile → POST /api/qbanks → Server validates → Supabase INSERT
→ Returns bank ID → Teacher adds questions → POST /api/qbanks/:id/questions
→ Server validates question type + payload → Supabase INSERT
→ Trigger updates question_count on question_banks
```

### 8.2 Teacher Creates Test
```
Teacher → Selects question banks → Configures (shuffle, time, marks)
→ POST /api/tests → Server selects questions from banks
→ Creates test_questions rows → Returns test with assigned questions
→ Teacher assigns to students → POST /api/tests/:id/assign
→ Server creates test_assignments → Supabase Realtime notifies students
```

### 8.3 Student Takes Test
```
Student → GET /api/student/tests → Sees assigned tests
→ POST /api/student/tests/:id/start → Server creates attempt
→ Student answers questions → POST /api/student/tests/:id/answer
→ On submit → POST /api/student/tests/:id/submit
→ Server auto-grades MCQ/true_false/fill_blank/numeric
→ Returns score (if show_results enabled)
```

### 8.4 Parent Views Report
```
Parent → GET /api/parent/reports → Server aggregates attempt data
→ Returns per-subject performance, trend charts, weak areas
```

---

## 9. Performance Optimization

### 9.1 Database
- **Indexes** on all foreign keys and filter columns
- **Materialized views** for dashboard stats (refresh on schedule)
- **Connection pooling** via Supabase (PgBouncer)
- **Query optimization**: Select only needed columns, paginate

### 9.2 API
- **Response caching**: Question banks rarely change → cache 5min
- **Compression**: gzip/brotli on all responses
- **CDN**: Serve static assets (images) via Supabase Storage CDN
- **Batch endpoints**: `/api/questions/batch` for bulk fetch

### 9.3 Mobile
- **Lazy loading**: Load questions on scroll
- **Image lazy load**: Load images only when visible
- **Offline cache**: Store recent question banks in SQLite
- **Delta sync**: Only fetch changed data since last sync

### 9.4 Web
- **Code splitting**: Load question editor only when needed
- **Virtual scrolling**: For large question lists (1000+ questions)
- **Web Worker**: Auto-grade in background thread

---

## 10. Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Database schema + migrations
- [ ] Subject/Topic CRUD API
- [ ] Question Bank CRUD API
- [ ] Question CRUD API (start with `mcq_single` only)
- [ ] Admin panel: Question Banks listing page
- [ ] Admin panel: Question Bank detail/editor page

### Phase 2: Question Types (Week 3-4)
- [ ] All question types (mcq_multi, true_false, fill_blank, short_answer, etc.)
- [ ] Question editor UI (web)
- [ ] Image upload for questions
- [ ] Import/Export questions (JSON, CSV)
- [ ] Question search and filtering

### Phase 3: Test Engine (Week 5-6)
- [ ] Test creation API
- [ ] Test assignment API
- [ ] Student test-taking flow (web)
- [ ] Auto-grading for objective types
- [ ] Results and reports

### Phase 4: Mobile (Week 7-8)
- [ ] Mobile API optimization
- [ ] Student test-taking (mobile)
- [ ] Offline support
- [ ] Push notifications

### Phase 5: Polish (Week 9-10)
- [ ] Anti-cheating measures
- [ ] Analytics dashboard
- [ ] Print PDF from question bank
- [ ] Performance optimization
- [ ] Load testing

---

## 11. Migration from Current System

### Current State
- `.qbank` files (JSON) stored locally
- Tiptap editor for question paper creation
- No cloud storage, no multi-user

### Migration Path
1. Build new cloud-based system alongside existing
2. Create import tool: `.qbank` → new API format
3. Gradually move teachers to new system
4. Keep legacy editor for offline/Electron use
5. Eventually deprecate file-based storage

---

## 12. Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| **Database** | Supabase (PostgreSQL) |
| **Auth** | Supabase Auth + JWT (existing) |
| **API** | Express.js (existing server) |
| **Storage** | Supabase Storage (images, files) |
| **Realtime** | Supabase Realtime (WebSocket) |
| **Web Editor** | Tiptap (existing) |
| **Web UI** | React + Tailwind (existing) |
| **Mobile** | React Native (TBD) or Expo |
| **State** | React Query / TanStack Query |
| **Offline** | SQLite (mobile), Service Worker (web) |

---

## 13. Open Questions

1. **Mobile framework**: React Native vs Flutter vs Expo? (Need to decide)
2. **Rich text on mobile**: How to render Tiptap JSON in React Native? (Use `react-native-render-html` + custom renderers)
3. **Image storage**: Supabase Storage vs Cloudflare R2 vs S3?
4. **Grading**: Auto-grade all objective types? Or only MCQ/TF?
5. **Versioning**: Should question banks have version history?

---

*This plan is the **foundation**. All implementation must follow this architecture. Changes to this plan require team discussion.*
