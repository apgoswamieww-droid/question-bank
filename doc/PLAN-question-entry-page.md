# Question Entry Page — Design Plan

> **Goal**: A structured, step-by-step question entry form that follows the hierarchy:
> Standard → Subject → Chapter → Topic → Question Type → Exam Type → Language → Question Content → Correct Answer → Solution

---

## 1. Page Layout (3-Panel Design)

```
┌─────────────────────────────────────────────────────────────────┐
│  Breadcrumb: Question Banks > Std 10 > Maths > Ch 1 > Algebra  │
├──────────────────────┬──────────────────────────┬───────────────┤
│                      │                          │               │
│   LEFT PANEL         │   CENTER PANEL           │ RIGHT PANEL   │
│   (Filter/Tree)      │   (Question Editor)      │ (Metadata)    │
│                      │                          │               │
│   Standards          │   Question Content       │ Exam Type     │
│   ├─ Std 9           │   ┌──────────────────┐   │ Language      │
│   ├─ Std 10 ★        │   │ Tiptap Editor    │   │ Difficulty    │
│   │  ├─ Maths ★      │   │                  │   │ Marks         │
│   │  │  ├─ Ch1 ★     │   │  Question text   │   │ Tags          │
│   │  │  │  ├─ Topic1 │   │  with math,      │   │               │
│   │  │  │  └─ Topic2 │   │  images, etc.    │   │               │
│   │  │  └─ Ch2       │   │                  │   │               │
│   │  └─ Science      │   └──────────────────┘   │               │
│   └─ Std 11          │                          │               │
│                      │   Options (for MCQ)      │               │
│   Question Types     │   ┌──────────────────┐   │               │
│   ☑ MCQ Single       │   │ (A) Option 1     │   │               │
│   ☑ MCQ Multi        │   │ (B) Option 2     │   │               │
│   ☐ True/False       │   │ (C) Option 3     │   │               │
│   ☐ Fill Blank       │   │ (D) Option 4     │   │               │
│   ☐ Short Answer     │   └──────────────────┘   │               │
│   ☐ Long Answer      │                          │               │
│                      │   Correct Answer         │               │
│                      │   ┌──────────────────┐   │               │
│                      │   │ ✓ (B) Option 2   │   │               │
│                      │   └──────────────────┘   │               │
│                      │                          │               │
│                      │   Solution/Explanation   │               │
│                      │   ┌──────────────────┐   │               │
│                      │   │ Tiptap Editor    │   │               │
│                      │   └──────────────────┘   │               │
│                      │                          │               │
│                      │   [Save] [Save+Next]     │               │
│                      │   [Save as Draft]        │               │
│                      │                          │               │
├──────────────────────┴──────────────────────────┴───────────────┤
│  Question List (bottom strip, collapsible)                      │
│  #1 MCQ | Ch1 Topic1 | Easy | 1 mark | ✓ Saved                │
│  #2 Short | Ch1 Topic2 | Medium | 3 marks | ✓ Saved            │
│  #3 MCQ | Ch2 Topic1 | Hard | 2 marks | ⚠ Unsaved             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Hierarchy & Selection Flow

### Step-by-step selection (each step filters the next):

```
1. STANDARD (required)
   └─ Options: Std 1, Std 2, ... Std 12
   └─ Selection filters → Subjects available for this standard

2. SUBJECT (required)
   └─ Options: Maths, Science, English, Social Science, Gujarati, Hindi...
   └─ Selection filters → Chapters available for this subject+standard

3. CHAPTER (required)
   └─ Options: Ch 1 - Real Numbers, Ch 2 - Polynomials...
   └─ Selection filters → Topics available for this chapter

4. TOPIC (required)
   └─ Options: 1.1 Euclid's Division, 1.2 HCF & LCM, 1.3 Fundamental Theorem...
   └─ This is the finest granularity for categorization

5. QUESTION TYPE (required)
   └─ Options (with icons):
      ├─ MCQ (Single Answer)     → Shows 4 option fields + radio selector
      ├─ MCQ (Multiple Answers)  → Shows 4+ option fields + checkbox selectors
      ├─ True / False            → Shows T/F toggle
      ├─ Fill in the Blank       → Shows text input + accepted answers
      ├─ Short Answer            → Shows answer textarea (1-2 sentences)
      ├─ Long Answer / Essay     → Shows answer textarea + rubric
      ├─ Match the Following     → Shows paired left-right inputs
      ├─ Ordering / Sequence     → Shows draggable list
      └─ Numeric                 → Shows value + tolerance + unit

6. EXAM TYPE (required)
   └─ Options:
      ├─ Board Exam (GSEB / CBSE / ICSE)
      ├─ Unit Test
      ├─ Semester Exam
      ├─ Practice / Homework
      ├─ Competitive (JEE / NEET / GUJCET)
      └─ Custom (user types name)

7. LANGUAGE (required)
   └─ Options:
      ├─ English
      ├─ Gujarati
      ├─ Hindi
      ├─ Bilingual (English + Gujarati)
      └─ Custom

8. QUESTION CONTENT (required)
   └─ Tiptap rich text editor
   └─ Supports: text, math (LaTeX), images, tables, code blocks
   └─ This is the question stem/prompt

9. ANSWER (required, varies by type)
   └─ MCQ: Select correct option(s)
   └─ True/False: Select True or False
   └─ Fill Blank: Enter accepted answer(s)
   └─ Short/Long: Enter model answer
   └─ Numeric: Enter value + tolerance + unit

10. SOLUTION / EXPLANATION (optional)
    └─ Tiptap rich text editor
    └─ Detailed step-by-step solution
    └─ Shown to students after test submission
```

---

## 3. UI Components

### 3.1 Left Panel — Hierarchy Tree

```
┌─────────────────────────────┐
│ 🔍 Search standards...      │
├─────────────────────────────┤
│                             │
│ 📚 Standards                │
│  ▸ Std 9                    │
│  ▾ Std 10                   │
│    ▸ Maths                  │
│    ▾ Science                │
│      ▾ Ch 1 - Chemical     │
│        Reactions            │
│        ├─ 1.1 Types of     │
│        │   Reactions ★      │
│        ├─ 1.2 Activity     │
│        │   Series           │
│        └─ 1.3 Corrosion     │
│      ▸ Ch 2 - Acids...     │
│    ▸ English                │
│  ▸ Std 11                   │
│                             │
├─────────────────────────────┤
│ 📋 Question Type Filter     │
│  ☑ MCQ (Single)     (45)   │
│  ☑ MCQ (Multi)      (12)   │
│  ☐ True/False        (8)   │
│  ☐ Fill Blank        (3)   │
│  ☑ Short Answer     (20)   │
│  ☐ Long Answer       (5)   │
│                             │
├─────────────────────────────┤
│ 📝 Exam Type Filter         │
│  ☑ Board Exam               │
│  ☑ Unit Test                │
│  ☐ Competitive              │
├─────────────────────────────┤
│ 🌐 Language Filter          │
│  ☑ English                  │
│  ☑ Gujarati                 │
│  ☑ Bilingual                │
├─────────────────────────────┤
│ 📊 Stats                    │
│  Total: 93 questions        │
│  MCQ: 57 | Short: 20       │
│  Easy: 30 | Medium: 45     │
│  Hard: 18                   │
└─────────────────────────────┘
```

### 3.2 Center Panel — Question Editor

```
┌─────────────────────────────────────────────┐
│ Question #1 of 93     [← Prev] [Next →]    │
├─────────────────────────────────────────────┤
│                                             │
│ 📝 Question Content *                       │
│ ┌─────────────────────────────────────────┐ │
│ │ Tiptap Editor                           │ │
│ │                                         │ │
│ │ If the HCF of 6 and A is 2 and the     │ │
│ │ LCM of 6 and A is 60, find the value   │ │
│ │ of A.                                   │ │
│ │                                         │ │
│ │ [📷 Image] [∑ Math] [⊞ Table]          │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ ── Options (shown for MCQ types) ─────────  │
│                                             │
│ ☐ (A) [Tiptap: Option 1 editor    ]  [✓]  │
│ ☑ (B) [Tiptap: Option 2 editor    ]  [ ]  │  ← Correct answer
│ ☐ (C) [Tiptap: Option 3 editor    ]  [ ]  │    highlighted
│ ☐ (D) [Tiptap: Option 4 editor    ]  [ ]  │
│                                             │
│ [+ Add Option]                              │
│                                             │
│ ── Correct Answer (auto from above) ──────  │
│ Answer: (B) — auto-populated               │
│                                             │
│ ── Solution / Explanation (optional) ─────  │
│ ┌─────────────────────────────────────────┐ │
│ │ Tiptap Editor                           │ │
│ │                                         │ │
│ │ HCF(6, A) = 2                           │ │
│ │ LCM(6, A) = 60                          │ │
│ │ 6 × A = HCF × LCM                      │ │
│ │ 6 × A = 2 × 60                          │ │
│ │ A = 120 / 6 = 20                        │ │
│ │                                         │ │
│ └─────────────────────────────────────────┘ │
│                                             │
├─────────────────────────────────────────────┤
│ [💾 Save] [💾+➡ Save & Next] [📝 Save Draft] │
└─────────────────────────────────────────────┘
```

### 3.3 Right Panel — Metadata

```
┌─────────────────────────────┐
│ 📋 Question Metadata        │
├─────────────────────────────┤
│                             │
│ Standard *                  │
│ [Std 10          ▾]        │
│                             │
│ Subject *                   │
│ [Maths            ▾]        │
│                             │
│ Chapter *                   │
│ [Ch 1 - Real Num. ▾]       │
│                             │
│ Topic *                     │
│ [1.1 Euclid's Div. ▾]      │
│                             │
│ Question Type *             │
│ [MCQ (Single)     ▾]       │
│                             │
│ Exam Type *                 │
│ [Board Exam (GSEB) ▾]      │
│                             │
│ Language *                  │
│ [English           ▾]      │
│                             │
│ Difficulty *                │
│ [🟢 Easy    ]              │
│ [🟡 Medium ★]              │
│ [🔴 Hard    ]              │
│ [⚫ Expert  ]              │
│                             │
│ Marks *                     │
│ [1  ] [−] [+]              │
│                             │
│ Negative Marks              │
│ [0  ] [−] [+]              │
│                             │
│ Time Limit (sec)            │
│ [60 ] (optional)            │
│                             │
│ Tags                        │
│ [board-exam] [2025] [+Add] │
│                             │
│ Status                      │
│ ○ Draft  ● Published       │
│                             │
├─────────────────────────────┤
│ 📸 Question Image           │
│ ┌───────────────────────┐   │
│ │  [Upload Image]       │   │
│ │  or drag & drop       │   │
│ │  Max 5MB, PNG/JPG     │   │
│ └───────────────────────┘   │
│                             │
├─────────────────────────────┤
│ 📊 Quick Stats              │
│ Words: 42                   │
│ Images: 1                   │
│ Math expressions: 0         │
│ Created: Aug 31, 2026       │
│ Modified: Aug 31, 2026      │
└─────────────────────────────┘
```

---

## 4. Question Type → UI Mapping

### MCQ (Single Answer)
- Shows: 4 option fields (Tiptap editors)
- Answer: Radio button on each option
- Min options: 4, Max options: 6
- Can add/remove options dynamically

### MCQ (Multiple Answers)
- Shows: 4+ option fields (Tiptap editors)
- Answer: Checkbox on each option
- Min options: 4, Max options: 6
- At least one must be checked

### True / False
- Shows: Two large buttons "True" / "False"
- Answer: Click to select
- No option editors needed

### Fill in the Blank
- Shows: Question with `______` placeholder
- Answer: Text input for correct answer
- Additional: "Accepted answers" field (comma-separated)
- Toggle: Case sensitive / Case insensitive

### Short Answer
- Shows: Question editor
- Answer: Single textarea (1-2 sentences)
- No option fields

### Long Answer / Essay
- Shows: Question editor
- Answer: Large textarea with model answer
- Additional: Rubric builder (criteria + marks)

### Match the Following
- Shows: Paired left-right input rows
- Answer: Correct pairing
- Can add/remove pairs

### Ordering / Sequence
- Shows: Draggable list items
- Answer: Correct order
- Can add/remove items

### Numeric
- Shows: Question editor
- Answer: Value input + Tolerance ± + Unit dropdown
- Example: `9.8 ± 0.1 m/s²`

---

## 5. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + S` | Save question |
| `Ctrl + Shift + S` | Save & Next |
| `Ctrl + D` | Save as Draft |
| `Tab` | Move to next field (options, answer, solution) |
| `Shift + Tab` | Move to previous field |
| `Ctrl + 1-4` | Select option A-D as correct answer |
| `Ctrl + Enter` | Add new option (MCQ) |
| `Escape` | Cancel / Close modal |

---

## 6. Save Actions

### 6.1 Save (Save & Stay)
- Validates all required fields
- Saves question to database
- Shows success toast
- Stays on current question for editing

### 6.2 Save & Next (Save + Move to Next)
- Saves current question
- Moves to next question in list (or creates new if at end)
- Auto-fills same metadata (standard, subject, chapter, topic, exam type, language)
- Shows progress: "Saved! Moving to Question #2..."

### 6.3 Save as Draft
- Saves without validation of answer/solution
- Marks status as "draft"
- Can be completed later

### 6.4 Validation Rules (on Save)
| Field | Required? | Rule |
|-------|-----------|------|
| Standard | Yes | Must select |
| Subject | Yes | Must select |
| Chapter | Yes | Must select |
| Topic | Yes | Must select |
| Question Type | Yes | Must select |
| Exam Type | Yes | Must select |
| Language | Yes | Must select |
| Question Content | Yes | Non-empty Tiptap content |
| Options (MCQ) | Yes | Min 4, max 6, all non-empty |
| Correct Answer | Yes | Must select/enter |
| Difficulty | Yes | Must select |
| Marks | Yes | Min 1 |
| Solution | No | Optional |

---

## 7. Auto-Fill Behavior

When saving a question, the system remembers the **last-used metadata** and auto-fills for the next question:

```
Question 1: Std 10 > Maths > Ch 1 > Topic 1 > MCQ > Board > English
Question 2: Std 10 > Maths > Ch 1 > Topic 1 > MCQ > Board > English  ← auto-filled
Question 3: Std 10 > Maths > Ch 1 > Topic 2 > MCQ > Board > English  ← topic changed manually
```

This massively speeds up bulk question entry.

---

## 8. Bottom Strip — Question List

```
┌─────────────────────────────────────────────────────────────────┐
│ 📋 Questions (93)              [Filter] [Sort] [Export] [Import]│
├─────────────────────────────────────────────────────────────────┤
│ #  │ Type     │ Topic        │ Diff │ Marks │ Lang   │ Status │
│ 1  │ MCQ      │ 1.1 Euclid  │ Easy │ 1     │ EN     │ ✓ Saved│
│ 2  │ MCQ      │ 1.1 Euclid  │ Med  │ 1     │ GU     │ ✓ Saved│
│ 3  │ Short    │ 1.2 HCF     │ Hard │ 3     │ EN     │ ⚠ Draft│
│ 4  │ MCQ      │ 1.3 Fund.   │ Easy │ 1     │ BI     │ ✓ Saved│
│ ...│ ...      │ ...          │ ...  │ ...   │ ...    │ ...    │
└─────────────────────────────────────────────────────────────────┘
```

- Click a row → loads that question in the editor
- Drag to reorder (sort_order field)
- Bulk actions: Delete, Move to different chapter, Export selected
- Status indicator: ✓ Saved, ⚠ Unsaved, 📝 Draft

---

## 9. Import/Export

### Import
- **JSON**: Full question data with metadata
- **CSV**: Tabular format (one question per row)
- **From existing .qbank files**: Migration tool
- **Bulk paste**: Paste multiple MCQs from Word/PDF

### Export
- **JSON**: Full export with all metadata
- **CSV**: For spreadsheet analysis
- **PDF**: Print-ready question paper
- **LMS format**: Moodle, Google Forms compatible

---

## 10. Database Schema (Updated)

```sql
-- Hierarchy tables (master data)
CREATE TABLE standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- "Std 10"
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true
);

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- "Maths"
  icon TEXT,
  color TEXT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true
);

CREATE TABLE chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID REFERENCES subjects(id),
  standard_id UUID REFERENCES standards(id),
  name TEXT NOT NULL,  -- "Ch 1 - Real Numbers"
  number INT,
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  UNIQUE(subject_id, standard_id, name)
);

CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters(id),
  name TEXT NOT NULL,  -- "1.1 Euclid's Division Lemma"
  number TEXT,         -- "1.1"
  sort_order INT DEFAULT 0,
  active BOOLEAN DEFAULT true
);

-- Exam types (master data)
CREATE TABLE exam_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,  -- "Board Exam (GSEB)"
  category TEXT,              -- "board", "unit", "competitive"
  active BOOLEAN DEFAULT true
);

-- Languages (master data)
CREATE TABLE languages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,  -- "en", "gu", "hi"
  name TEXT NOT NULL,         -- "English", "Gujarati", "Hindi"
  native_name TEXT,           -- "ગુજરાતी"
  active BOOLEAN DEFAULT true
);

-- Questions table (updated)
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_id UUID REFERENCES question_banks(id),
  created_by UUID REFERENCES users(id),
  
  -- Hierarchy
  standard_id UUID REFERENCES standards(id),
  subject_id UUID REFERENCES subjects(id),
  chapter_id UUID REFERENCES chapters(id),
  topic_id UUID REFERENCES topics(id),
  
  -- Classification
  type TEXT NOT NULL,  -- mcq_single, mcq_multi, true_false, etc.
  exam_type_id UUID REFERENCES exam_types(id),
  language_id UUID REFERENCES languages(id),
  difficulty TEXT CHECK (difficulty IN ('easy','medium','hard','expert')),
  
  -- Content
  content JSONB NOT NULL,  -- Tiptap JSON
  explanation JSONB,       -- Solution Tiptap JSON
  image_url TEXT,          -- Optional question image
  
  -- Scoring
  marks INT NOT NULL DEFAULT 1,
  negative_marks INT DEFAULT 0,
  time_limit_sec INT,
  
  -- Metadata
  tags TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  sort_order INT DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Options (for MCQ types)
CREATE TABLE question_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,  -- "A", "B", "C", "D"
  content JSONB NOT NULL,  -- Tiptap JSON
  is_correct BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0
);

-- Type-specific payloads
CREATE TABLE question_payloads (
  question_id UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}',
  -- mcq_single: { "correctIndex": 2 }
  -- mcq_multi: { "correctIndexes": [0, 2] }
  -- true_false: { "correctAnswer": true }
  -- fill_blank: { "answers": ["20", "twenty"], "caseSensitive": false }
  -- numeric: { "value": 9.8, "tolerance": 0.1, "unit": "m/s²" }
  -- match: { "pairs": [{ "left": "A", "right": "1" }] }
  -- ordering: { "correctOrder": ["item3", "item1", "item2"] }
);
```

---

## 11. API Endpoints (Question Entry)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/standards` | List all standards |
| `GET` | `/api/subjects` | List all subjects |
| `GET` | `/api/subjects/:id/chapters` | Chapters for subject+standard |
| `GET` | `/api/chapters/:id/topics` | Topics for chapter |
| `GET` | `/api/exam-types` | List exam types |
| `GET` | `/api/languages` | List languages |
| `POST` | `/api/questions` | Create question |
| `PATCH` | `/api/questions/:id` | Update question |
| `DELETE` | `/api/questions/:id` | Delete question |
| `POST` | `/api/questions/:id/duplicate` | Duplicate question |
| `GET` | `/api/questions` | List questions (with filters) |
| `POST` | `/api/questions/import` | Bulk import |
| `GET` | `/api/questions/export` | Bulk export |

---

## 12. Implementation Priority

### Must Have (Phase 1)
- [ ] Hierarchy tree (left panel)
- [ ] Question entry form (center panel)
- [ ] Metadata panel (right panel)
- [ ] MCQ Single question type
- [ ] Save / Save & Next / Save as Draft
- [ ] Auto-fill metadata on next question
- [ ] Bottom question list strip

### Should Have (Phase 2)
- [ ] All question types
- [ ] Search and filter
- [ ] Bulk import/export
- [ ] Question duplication
- [ ] Image upload for questions

### Nice to Have (Phase 3)
- [ ] Drag-to-reorder questions
- [ ] Keyboard shortcuts
- [ ] Auto-save draft
- [ ] Question versioning
- [ ] AI-assisted question generation

---

*This plan defines the **Question Entry Page** specifically. The broader Question Bank SaaS architecture is in `PLAN-question-bank-saas.md`.*

---

## 13. Question History, Usage Analytics & Audit Log

> **Every question has a complete lifecycle history.** We track who created it, who used it, where it was used, how many times, and every change ever made.

---

### 13.1 What We Track

| Data Point | Why | Example |
|------------|-----|---------|
| **Created by** | Attribution, ownership | Teacher A created on Aug 31 |
| **Last edited by** | Who made latest change | Teacher B edited on Sep 2 |
| **Edit history** | Every change ever made | Changed answer from B→C on Sep 3 |
| **Used in tests** | Which tests used this question | Test "Unit Test 1" on Sep 5 |
| **Used by teachers** | Which teacher used it | Teacher A, Teacher C |
| **Used by schools** | Which school/institution | ABC School, XYZ Academy |
| **Usage count** | How many times used | Used 12 times total |
| **Repeat count** | How many times repeated in different tests | Repeated in 5 different tests |
| **Student performance** | How students answered this question | 65% answered correctly |
| **Average time** | How long students take | Avg 45 seconds |
| **Difficulty rating** | AI or student-reported difficulty | Rated "Hard" by 70% of students |
| **Last used date** | Recency tracking | Last used Sep 10 |
| **First used date** | When first deployed | First used Sep 5 |

---

### 13.2 Database Schema — History Tables

#### `question_usage_log` (every time a question appears in a test)
```sql
CREATE TABLE question_usage_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  test_id       UUID NOT NULL REFERENCES tests(id),
  used_by       UUID NOT NULL REFERENCES users(id),  -- teacher who created the test
  school_id     UUID REFERENCES schools(id),          -- which school/institution
  class_name    TEXT,                                  -- "Std 10 A", "Std 12 B"
  usage_type    TEXT NOT NULL CHECK (usage_type IN (
    'test',          -- used in a formal test
    'quiz',          -- used in a quick quiz
    'practice',      -- used in practice/homework
    'assignment',    -- used as assignment
    'mock_exam'      -- used in mock exam
  )),
  student_count INT DEFAULT 0,       -- how many students took this test
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_usage_question ON question_usage_log(question_id);
CREATE INDEX idx_usage_teacher ON question_usage_log(used_by);
CREATE INDEX idx_usage_school ON question_usage_log(school_id);
CREATE INDEX idx_usage_test ON question_usage_log(test_id);
```

#### `question_edit_history` (every change to a question)
```sql
CREATE TABLE question_edit_history (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  edited_by     UUID NOT NULL REFERENCES users(id),
  field_changed TEXT NOT NULL,       -- 'content', 'answer', 'marks', 'difficulty', etc.
  old_value     JSONB,              -- previous value (full JSON)
  new_value     JSONB,              -- new value (full JSON)
  change_summary TEXT,              -- human-readable: "Changed answer from B to C"
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_edit_history_question ON question_edit_history(question_id);
CREATE INDEX idx_edit_history_user ON question_edit_history(edited_by);
```

#### `question_performance` (aggregated student performance per question)
```sql
CREATE TABLE question_performance (
  question_id       UUID PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
  total_attempts    INT DEFAULT 0,     -- total students who attempted
  correct_count     INT DEFAULT 0,     -- how many got it right
  incorrect_count   INT DEFAULT 0,     -- how many got it wrong
  skipped_count     INT DEFAULT 0,     -- how many skipped
  avg_time_sec      FLOAT DEFAULT 0,   -- average time taken
  success_rate      FLOAT DEFAULT 0,   -- percentage correct (0-100)
  difficulty_rating TEXT,              -- calculated: 'easy','medium','hard'
  last_calculated   TIMESTAMPTZ DEFAULT now()
);
```

#### `question_school_usage` (per-school aggregation)
```sql
CREATE TABLE question_school_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  school_id     UUID NOT NULL REFERENCES schools(id),
  teacher_id    UUID NOT NULL REFERENCES users(id),
  usage_count   INT DEFAULT 1,
  first_used    TIMESTAMPTZ DEFAULT now(),
  last_used     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, school_id, teacher_id)
);

CREATE INDEX idx_school_usage_question ON question_school_usage(question_id);
CREATE INDEX idx_school_usage_school ON question_school_usage(school_id);
```

#### `question_teacher_usage` (per-teacher aggregation)
```sql
CREATE TABLE question_teacher_usage (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES users(id),
  usage_count   INT DEFAULT 1,
  first_used    TIMESTAMPTZ DEFAULT now(),
  last_used     TIMESTAMPTZ DEFAULT now(),
  UNIQUE(question_id, teacher_id)
);

CREATE INDEX idx_teacher_usage_question ON question_teacher_usage(question_id);
CREATE INDEX idx_teacher_usage_teacher ON question_teacher_usage(teacher_id);
```

#### `schools` (institution master table)
```sql
CREATE TABLE schools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  code        TEXT UNIQUE,            -- school code/ID
  district    TEXT,
  city        TEXT,
  state       TEXT,
  board       TEXT,                   -- GSEB, CBSE, ICSE
  type        TEXT,                   -- government, private, semi-govt
  contact_email TEXT,
  contact_phone TEXT,
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Link users (teachers) to schools
ALTER TABLE users ADD COLUMN school_id UUID REFERENCES schools(id);
```

---

### 13.3 Question History Panel (UI)

When viewing/editing a question, add a **"History" tab** on the right panel:

```
┌─────────────────────────────────────┐
│ 📋 Question Metadata  │  📜 History │
├─────────────────────────────────────┤
│                                     │
│ 📊 Usage Summary                    │
│ ┌─────────────────────────────────┐ │
│ │ Total Used:      12 times       │ │
│ │ Different Tests:  5 tests       │ │
│ │ Teachers Used:    3 teachers    │ │
│ │ Schools Used:     2 schools     │ │
│ │ Last Used:        Sep 10, 2026  │ │
│ │ Success Rate:     65%           │ │
│ │ Avg Time:         45 sec        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 👩‍🏫 Used By Teachers                │
│ ┌─────────────────────────────────┐ │
│ │ • Teacher A (ABC School)  ×5    │ │
│ │ • Teacher B (XYZ Academy) ×4    │ │
│ │ • Teacher C (ABC School)  ×3    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 🏫 Used By Schools                  │
│ ┌─────────────────────────────────┐ │
│ │ • ABC School    (8 times)       │ │
│ │ • XYZ Academy   (4 times)       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📝 Used In Tests                    │
│ ┌─────────────────────────────────┐ │
│ │ • Unit Test 1 (Sep 5)  45 stds  │ │
│ │ • Mid-Term   (Sep 8)  120 stds  │ │
│ │ • Practice   (Sep 10) 30 stds   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ 📈 Performance                      │
│ ┌─────────────────────────────────┐ │
│ │ ██████████░░░░░ 65% correct     │ │
│ │ ████████░░░░░░░ 30% incorrect   │ │
│ │ ██░░░░░░░░░░░░░  5% skipped    │ │
│ │                                 │ │
│ │ Avg Time: ████████░░ 45 sec     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ✏️ Edit History                     │
│ ┌─────────────────────────────────┐ │
│ │ Sep 3 — Teacher A               │ │
│ │   Changed answer: B → C         │ │
│ │                                 │ │
│ │ Sep 2 — Teacher B               │ │
│ │   Updated marks: 1 → 2          │ │
│ │                                 │ │
│ │ Aug 31 — Teacher A              │ │
│ │   Question created              │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

---

### 13.4 Question Analytics Dashboard (Admin View)

A separate page showing analytics across ALL questions:

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Question Analytics Dashboard                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│ │ Total Qs │ │ Most Used│ │ Avg Rate │ │ Unused   │           │
│ │  1,247   │ │  Q#234   │ │  72%     │ │  89 (7%) │           │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                 │
│ 🔥 Most Used Questions (Top 10)                                │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ #  │ Question     │ Used │ Teachers │ Schools │ Rate     │  │
│ │ 1  │ Q#234 - MCQ  │ 45   │ 8        │ 5       │ 82%     │  │
│ │ 2  │ Q#102 - MCQ  │ 38   │ 6        │ 4       │ 75%     │  │
│ │ 3  │ Q#567 - Short│ 32   │ 5        │ 3       │ 68%     │  │
│ │ ...│ ...           │ ...  │ ...      │ ...     │ ...     │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ⚠️ Unused Questions (Need attention)                           │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ 89 questions have never been used in any test             │  │
│ │ [View List] [Archive Unused] [Send to Teachers]          │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ 📈 Usage Over Time (Chart)                                     │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │   ╭──╮                                                    │  │
│ │  ╭╯  ╰──╮    ╭──╮                                        │  │
│ │ ╭╯      ╰──╮╭╯  ╰──╮                                     │  │
│ │ ╯          ╰╯      ╰──                                    │  │
│ │ Aug 25  Sep 1  Sep 5  Sep 10                              │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ 🏫 Usage by School                                             │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ ABC School:     ████████████████ 342 questions used       │  │
│ │ XYZ Academy:    ████████████     256 questions used       │  │
│ │ LMN Institute:  ████████         178 questions used       │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│ 👩‍🏫 Usage by Teacher                                           │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Teacher A:  ████████████████ 89 questions used            │  │
│ │ Teacher B:  ████████████     67 questions used            │  │
│ │ Teacher C:  ████████         45 questions used            │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 13.5 API Endpoints — History & Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/questions/:id/history` | Full usage history of a question |
| `GET` | `/api/questions/:id/usage` | Usage summary (count, teachers, schools) |
| `GET` | `/api/questions/:id/performance` | Student performance data |
| `GET` | `/api/questions/:id/edits` | Edit history (all changes) |
| `GET` | `/api/analytics/questions` | Question analytics dashboard |
| `GET` | `/api/analytics/most-used` | Most used questions |
| `GET` | `/api/analytics/unused` | Unused questions list |
| `GET` | `/api/analytics/by-school` | Usage grouped by school |
| `GET` | `/api/analytics/by-teacher` | Usage grouped by teacher |
| `GET` | `/api/analytics/over-time` | Usage trend over time |
| `GET` | `/api/analytics/performance` | Performance analytics |
| `GET` | `/api/teachers/:id/usage` | Questions used by a teacher |
| `GET` | `/api/schools/:id/usage` | Questions used by a school |

---

### 13.6 Automatic Tracking (Server-Side)

The server automatically logs history when:

```
1. QUESTION CREATED
   → INSERT INTO question_edit_history (field='created')

2. QUESTION EDITED (any field)
   → INSERT INTO question_edit_history (field, old_value, new_value)

3. QUESTION ADDED TO TEST
   → INSERT INTO question_usage_log (question_id, test_id, used_by)
   → UPSERT question_teacher_usage (increment count)
   → UPSERT question_school_usage (increment count)

4. STUDENT ANSWERS QUESTION (in test)
   → UPDATE question_performance (recalculate stats)

5. TEST COMPLETED
   → UPDATE question_performance (final stats)
   → UPDATE question_usage_log.student_count
```

---

### 13.7 Question Quality Score (Auto-calculated)

Each question gets an automatic **quality score** based on:

```
Quality Score = (Usage Score × 0.3) + (Performance Score × 0.3) + (Recency Score × 0.2) + (Freshness Score × 0.2)

Where:
  Usage Score     = min(100, usage_count × 5)           — more used = higher
  Performance Score = success_rate if 40-80%, else 50   — medium difficulty = best
  Recency Score   = 100 if used in last 30 days, else decays
  Freshness Score = 100 if created in last 90 days, else decays
```

This helps identify:
- **High quality questions**: Well-tested, appropriate difficulty, recently used
- **Stale questions**: Never used or not used recently
- **Problematic questions**: Too easy (90%+ correct) or too hard (<20% correct)

---

### 13.8 Alerts & Notifications

| Alert | Trigger | Who gets notified |
|-------|---------|-------------------|
| Unused question | Not used in 90 days | Question owner (teacher) |
| Overused question | Used more than 20 times | Admin (may need replacement) |
| Poor performance | Success rate < 20% or > 95% | Question owner |
| Duplicate detected | Similar question exists | Teacher (warning) |
| Question archived | Owner archived it | Teachers who used it |

---

*The Question History system ensures **full accountability** and **data-driven question quality improvement**. Every question's lifecycle is tracked from creation to retirement.*
