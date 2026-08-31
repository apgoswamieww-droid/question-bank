# Question Bank SaaS — Implementation Plan

> **Working document** — Check off items as completed. Each phase must be finished before moving to the next.
>
> Last updated: August 31, 2026

---

## Phase 0: Database Foundation
> _Master data tables, migrations, and seed data_

### 0.1 Master Data Tables
- [ ] `standards` table (Std 1–12) + migration
- [ ] `subjects` table (Maths, Science, English, etc.) + migration
- [ ] `chapters` table (linked to subject + standard) + migration
- [ ] `topics` table (linked to chapter) + migration
- [ ] `exam_types` table (Board, Unit Test, Competitive, etc.) + migration
- [ ] `languages` table (English, Gujarati, Hindi, Bilingual) + migration
- [ ] `schools` table (institution master) + migration

### 0.2 Question Tables
- [ ] `questions` table (with all hierarchy FKs) + migration
- [ ] `question_options` table (for MCQ) + migration
- [ ] `question_payloads` table (type-specific data) + migration
- [ ] `question_images` table + migration

### 0.3 History & Analytics Tables
- [ ] `question_usage_log` table + migration
- [ ] `question_edit_history` table + migration
- [ ] `question_performance` table + migration
- [ ] `question_teacher_usage` table + migration
- [ ] `question_school_usage` table + migration

### 0.4 Indexes & RLS
- [ ] All indexes created (foreign keys, filters, GIN for tags)
- [ ] RLS policies for teachers (own data only)
- [ ] RLS policies for students (published only)
- [ ] RLS policies for admins (full access)
- [ ] Updated_at triggers on all tables

### 0.5 Seed Data
- [ ] Seed standards (Std 1–12)
- [ ] Seed subjects (Maths, Science, English, Social Science, Gujarati, Hindi)
- [ ] Seed exam types (Board GSEB, Board CBSE, Unit Test, Competitive, Practice)
- [ ] Seed languages (English, Gujarati, Hindi, Bilingual)

---

## Phase 1: API — Master Data CRUD
> _API endpoints for managing hierarchy data_

### 1.1 Standards API
- [ ] `GET /api/standards` — List all standards
- [ ] `POST /api/standards` — Create standard (admin only)
- [ ] `PATCH /api/standards/:id` — Update standard (admin only)
- [ ] `DELETE /api/standards/:id` — Delete standard (admin only)

### 1.2 Subjects API
- [ ] `GET /api/subjects` — List all subjects
- [ ] `POST /api/subjects` — Create subject (admin only)
- [ ] `PATCH /api/subjects/:id` — Update subject (admin only)
- [ ] `DELETE /api/subjects/:id` — Delete subject (admin only)

### 1.3 Chapters API
- [ ] `GET /api/subjects/:id/chapters` — Chapters for a subject+standard
- [ ] `POST /api/chapters` — Create chapter (admin only)
- [ ] `PATCH /api/chapters/:id` — Update chapter (admin only)
- [ ] `DELETE /api/chapters/:id` — Delete chapter (admin only)

### 1.4 Topics API
- [ ] `GET /api/chapters/:id/topics` — Topics for a chapter
- [ ] `POST /api/topics` — Create topic (admin only)
- [ ] `PATCH /api/topics/:id` — Update topic (admin only)
- [ ] `DELETE /api/topics/:id` — Delete topic (admin only)

### 1.5 Exam Types & Languages API
- [ ] `GET /api/exam-types` — List exam types
- [ ] `POST /api/exam-types` — Create exam type (admin only)
- [ ] `GET /api/languages` — List languages
- [ ] `POST /api/languages` — Create language (admin only)

### 1.6 Schools API
- [ ] `GET /api/schools` — List schools
- [ ] `POST /api/schools` — Create school (admin only)
- [ ] `PATCH /api/schools/:id` — Update school (admin only)
- [ ] `DELETE /api/schools/:id` — Delete school (admin only)

---

## Phase 2: API — Question CRUD
> _Core question management endpoints_

### 2.1 Questions API
- [ ] `POST /api/questions` — Create question
- [ ] `GET /api/questions` — List questions (with filters: standard, subject, chapter, topic, type, exam_type, language, difficulty, status, tags)
- [ ] `GET /api/questions/:id` — Get single question with options + payload
- [ ] `PATCH /api/questions/:id` — Update question
- [ ] `DELETE /api/questions/:id` — Delete question (soft delete or hard delete)
- [ ] `POST /api/questions/:id/duplicate` — Duplicate a question

### 2.2 Question Options API
- [ ] `GET /api/questions/:id/options` — List options for a question
- [ ] `POST /api/questions/:id/options` — Add option to question
- [ ] `PATCH /api/options/:id` — Update option
- [ ] `DELETE /api/options/:id` — Delete option

### 2.3 Question Import/Export
- [ ] `POST /api/questions/import` — Bulk import (JSON format)
- [ ] `GET /api/questions/export` — Bulk export (JSON format)
- [ ] `GET /api/questions/export/csv` — Export as CSV

### 2.4 Auto-Log on Question Changes
- [ ] Log creation in `question_edit_history` on POST
- [ ] Log every field change in `question_edit_history` on PATCH
- [ ] Store old_value and new_value as JSONB
- [ ] Generate human-readable change_summary

---

## Phase 3: API — History & Analytics
> _Tracking and analytics endpoints_

### 3.1 Usage Tracking
- [ ] Auto-log to `question_usage_log` when question added to test
- [ ] Auto-upsert `question_teacher_usage` on test creation
- [ ] Auto-upsert `question_school_usage` on test creation
- [ ] Update `student_count` on test completion

### 3.2 Performance Tracking
- [ ] Update `question_performance` on each student answer
- [ ] Calculate `success_rate` = correct / total × 100
- [ ] Calculate `avg_time_sec` from attempt data
- [ ] Auto-difficulty rating based on success rate

### 3.3 History Endpoints
- [ ] `GET /api/questions/:id/history` — Full usage history
- [ ] `GET /api/questions/:id/usage` — Usage summary (count, teachers, schools)
- [ ] `GET /api/questions/:id/performance` — Student performance data
- [ ] `GET /api/questions/:id/edits` — Edit history (all changes)

### 3.4 Analytics Endpoints
- [ ] `GET /api/analytics/questions` — Dashboard overview stats
- [ ] `GET /api/analytics/most-used` — Most used questions (top 10/25/50)
- [ ] `GET /api/analytics/unused` — Questions never used
- [ ] `GET /api/analytics/by-school` — Usage grouped by school
- [ ] `GET /api/analytics/by-teacher` — Usage grouped by teacher
- [ ] `GET /api/analytics/over-time` — Usage trend (daily/weekly/monthly)
- [ ] `GET /api/analytics/performance` — Performance analytics (by subject, chapter, difficulty)

### 3.5 Quality Score Calculation
- [ ] Auto-calculate quality score on question update
- [ ] Score formula: usage(30%) + performance(30%) + recency(20%) + freshness(20%)
- [ ] Store in `questions.quality_score` column

---

## Phase 4: Admin Panel — Master Data Management UI
> _Admin pages for managing standards, subjects, chapters, topics_

### 4.1 Standards Management Page
- [ ] Create `StandardsPage.tsx` — List, add, edit, delete standards
- [ ] Add route `/admin/standards`
- [ ] Add to sidebar navigation

### 4.2 Subjects Management Page
- [ ] Create `SubjectsPage.tsx` — List, add, edit, delete subjects
- [ ] Add route `/admin/subjects`
- [ ] Add to sidebar navigation

### 4.3 Chapters Management Page
- [ ] Create `ChaptersPage.tsx` — List, add, edit, delete chapters
- [ ] Filter by subject + standard
- [ ] Add route `/admin/chapters`

### 4.4 Topics Management Page
- [ ] Create `TopicsPage.tsx` — List, add, edit, delete topics
- [ ] Filter by chapter
- [ ] Add route `/admin/topics`

### 4.5 Exam Types & Languages Management
- [ ] Create `ExamTypesPage.tsx` — List, add, edit, delete
- [ ] Create `LanguagesPage.tsx` — List, add, edit, delete
- [ ] Add routes

### 4.6 Schools Management Page
- [ ] Create `SchoolsPage.tsx` — List, add, edit, delete schools
- [ ] Link teachers to schools
- [ ] Add route `/admin/schools`

### 4.7 Shared Components
- [ ] Reusable `HierarchyTree.tsx` component (Std → Subject → Chapter → Topic)
- [ ] Reusable `MasterDataForm.tsx` component (for all master data CRUD)
- [ ] Reusable `MasterDataTable.tsx` component (sortable, filterable table)

---

## Phase 5: Admin Panel — Question Entry Page
> _The main question entry form with 3-panel layout_

### 5.1 Page Structure
- [ ] Create `QuestionEntryPage.tsx` — 3-panel layout (Left/Center/Right)
- [ ] Add route `/admin/questions/new`
- [ ] Add route `/admin/questions/:id/edit`
- [ ] Add to sidebar navigation

### 5.2 Left Panel — Hierarchy Tree
- [ ] Create `QuestionTree.tsx` — Collapsible tree (Std → Subject → Chapter → Topic)
- [ ] Click node → filters question list
- [ ] Show question count per node
- [ ] Search/filter within tree
- [ ] Question type filter checkboxes
- [ ] Exam type filter checkboxes
- [ ] Language filter checkboxes

### 5.3 Center Panel — Question Editor
- [ ] Create `QuestionEditor.tsx` — Main question content area
- [ ] Integrate existing Tiptap editor for question content
- [ ] Add option fields (dynamic, MCQ types)
- [ ] Add correct answer selector (radio for single, checkbox for multi)
- [ ] Add solution/explanation Tiptap editor
- [ ] Add question image upload

### 5.4 Right Panel — Metadata
- [ ] Create `QuestionMetadata.tsx` — All dropdowns and fields
- [ ] Standard dropdown (auto-filtered)
- [ ] Subject dropdown (auto-filtered by standard)
- [ ] Chapter dropdown (auto-filtered by subject+standard)
- [ ] Topic dropdown (auto-filtered by chapter)
- [ ] Question type dropdown (triggers UI change)
- [ ] Exam type dropdown
- [ ] Language dropdown
- [ ] Difficulty selector (Easy/Medium/Hard/Expert)
- [ ] Marks input (+/- buttons)
- [ ] Negative marks input
- [ ] Time limit input (optional)
- [ ] Tags input (chip-style)
- [ ] Status toggle (Draft/Published)

### 5.5 Question Type Forms
- [ ] `MCQSingleForm.tsx` — 4 option fields + radio selector
- [ ] `MCQMultiForm.tsx` — 4+ option fields + checkbox selectors
- [ ] `TrueFalseForm.tsx` — Two large buttons
- [ ] `FillBlankForm.tsx` — Text input + accepted answers
- [ ] `ShortAnswerForm.tsx` — Textarea for model answer
- [ ] `LongAnswerForm.tsx` — Textarea + rubric builder
- [ ] `MatchForm.tsx` — Paired left-right inputs
- [ ] `OrderingForm.tsx` — Draggable list items
- [ ] `NumericForm.tsx` — Value + tolerance + unit

### 5.6 Save Actions
- [ ] Save (save & stay) — validates all required fields
- [ ] Save & Next (save + move to next/new question)
- [ ] Save as Draft (save without full validation)
- [ ] Auto-fill metadata from last question on Save & Next

### 5.7 Bottom Strip — Question List
- [ ] Create `QuestionListStrip.tsx` — Collapsible bottom panel
- [ ] Show all questions in current scope
- [ ] Click row → load question in editor
- [ ] Show status (saved/draft/unsaved)
- [ ] Drag to reorder (sort_order)
- [ ] Bulk actions (delete, move, export selected)
- [ ] Search within list
- [ ] Sort by any column

### 5.8 Keyboard Shortcuts
- [ ] `Ctrl+S` → Save
- [ ] `Ctrl+Shift+S` → Save & Next
- [ ] `Ctrl+D` → Save as Draft
- [ ] `Tab` / `Shift+Tab` → Navigate fields
- [ ] `Ctrl+1-4` → Select option as correct

---

## Phase 6: Admin Panel — Question History & Analytics UI
> _History tab on questions + analytics dashboard_

### 6.1 Question History Tab
- [ ] Create `QuestionHistory.tsx` — History panel (right panel tab)
- [ ] Usage summary (count, teachers, schools)
- [ ] Used by teachers list (with school, count)
- [ ] Used by schools list (with count)
- [ ] Used in tests list (with date, student count)
- [ ] Performance chart (correct/incorrect/skip bars)
- [ ] Edit timeline (chronological changes)

### 6.2 Analytics Dashboard
- [ ] Create `QuestionAnalyticsPage.tsx` — Full analytics page
- [ ] Add route `/admin/analytics`
- [ ] Add to sidebar navigation
- [ ] Overview stats cards (total, most used, avg rate, unused)
- [ ] Most Used Questions table (top 10/25/50)
- [ ] Unused Questions list (with action buttons)
- [ ] Usage Over Time chart (line chart)
- [ ] Usage by School bar chart
- [ ] Usage by Teacher bar chart
- [ ] Performance by Subject chart
- [ ] Performance by Difficulty chart

### 6.3 Question Quality Indicators
- [ ] Quality score badge on question cards
- [ ] Color coding: green (high), yellow (medium), red (low)
- [ ] Filter by quality score
- [ ] Sort by quality score

### 6.4 Alerts & Notifications
- [ ] Unused question alert (90 days)
- [ ] Overused question alert (>20 times)
- [ ] Poor performance alert (<20% or >95% correct)
- [ ] Notification to question owner

---

## Phase 7: Admin Panel — Test Creation & Management
> _Create tests from question banks_

### 7.1 Test Creation
- [ ] Create `TestCreatePage.tsx` — Test builder
- [ ] Select questions from banks (manual or auto)
- [ ] Configure: shuffle, time, marks, passing marks
- [ ] Preview test before publishing
- [ ] Save as draft or publish

### 7.2 Test Assignment
- [ ] Assign test to students (individual or bulk)
- [ ] Set start/end time
- [ ] Notify students (push notification)

### 7.3 Test Results
- [ ] Create `TestResultsPage.tsx` — View results
- [ ] Per-student scores
- [ ] Per-question analytics (correct/incorrect rates)
- [ ] Export results (CSV/PDF)

---

## Phase 8: Student Flow
> _Students take tests and view results_

### 8.1 Student Test List
- [ ] `GET /api/student/tests` — My assigned tests
- [ ] Show upcoming, in-progress, completed tests

### 8.2 Test Taking
- [ ] Start attempt → creates attempt record
- [ ] Show questions one by one or all at once
- [ ] Timer (server-side clock, not just client)
- [ ] Submit answer per question
- [ ] Final submit → auto-grade objective types

### 8.3 Results
- [ ] Show score immediately (if show_results enabled)
- [ ] Show correct answers (if show_answers enabled)
- [ ] Show detailed solution (if available)

---

## Phase 9: Mobile Optimization
> _API optimization and mobile-specific features_

### 9.1 API Optimization
- [ ] Cursor-based pagination on all list endpoints
- [ ] Field selection via `?fields=` query param
- [ ] Response compression (gzip/brotli)
- [ ] CDN for static assets (images)

### 9.2 Offline Support
- [ ] Cache question banks locally (SQLite on mobile)
- [ ] Delta sync (only fetch changes since last sync)
- [ ] Offline question viewing
- [ ] Queue answers when offline, sync when online

### 9.3 Push Notifications
- [ ] New test assigned notification
- [ ] Test results ready notification
- [ ] New question in followed subject notification

---

## Phase 10: Polish & Optimization
> _Final touches, performance, and testing_

### 10.1 Performance
- [ ] Database query optimization (EXPLAIN ANALYZE slow queries)
- [ ] Add materialized views for dashboard stats
- [ ] Implement response caching (5min for question banks)
- [ ] Code splitting for question editor
- [ ] Virtual scrolling for large question lists (1000+)
- [ ] Lazy load images in questions

### 10.2 Testing
- [ ] Unit tests for all API endpoints
- [ ] Integration tests for question CRUD flow
- [ ] Integration tests for test creation + taking flow
- [ ] Load testing (100 concurrent users)
- [ ] Security audit (SQL injection, XSS, CSRF)

### 10.3 Import/Export
- [ ] Import from `.qbank` files (migration tool)
- [ ] Import from CSV (bulk question entry)
- [ ] Export to JSON (full data)
- [ ] Export to CSV (spreadsheet)
- [ ] Export to PDF (print-ready question paper)
- [ ] Export to LMS format (Moodle, Google Forms)

### 10.4 Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] Database schema documentation
- [ ] User guide for teachers
- [ ] User guide for students
- [ ] Admin guide

---

## Progress Tracker

| Phase | Status | Started | Completed |
|-------|--------|---------|-----------|
| Phase 0: Database Foundation | ⬜ Not started | — | — |
| Phase 1: API — Master Data CRUD | ⬜ Not started | — | — |
| Phase 2: API — Question CRUD | ⬜ Not started | — | — |
| Phase 3: API — History & Analytics | ⬜ Not started | — | — |
| Phase 4: Admin — Master Data UI | ⬜ Not started | — | — |
| Phase 5: Admin — Question Entry | ⬜ Not started | — | — |
| Phase 6: Admin — History & Analytics UI | ⬜ Not started | — | — |
| Phase 7: Admin — Test Creation | ⬜ Not started | — | — |
| Phase 8: Student Flow | ⬜ Not started | — | — |
| Phase 9: Mobile Optimization | ⬜ Not started | — | — |
| Phase 10: Polish & Optimization | ⬜ Not started | — | — |

---

## Notes

- Each phase builds on the previous one
- Phase 0–3 are backend (database + API)
- Phase 4–7 are frontend (admin panel)
- Phase 8 is student-facing
- Phase 9–10 are optimization and polish
- **Current focus: Phase 0 — Database Foundation**

---

*This is the **working document**. Update checkboxes as work is completed. Add notes at the bottom of each phase if needed.*
