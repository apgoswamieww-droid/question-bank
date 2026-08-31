import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import { fileRepo, resetStore } from "./fileRepo.js";
import bcrypt from "bcryptjs";

/**
 * Data layer for users, roles & permissions.
 * Primary backend: Supabase (Postgres) via the service-role client.
 * Fallback: the legacy JSON file (server/data/users.json) when Supabase
 * credentials are not configured — keeps local/dev mode working offline.
 */

const supabaseConfigured =
  Boolean(config.supabase.url) && Boolean(config.supabase.serviceRoleKey);

export const client = supabaseConfigured
  ? createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

// ---------------------------------------------------------------------------
// Permission constants (shared with frontend)
// ---------------------------------------------------------------------------
export const PERMISSIONS = {
  USERS_VIEW: "users.view",
  USERS_MANAGE: "users.manage",
  ROLES_MANAGE: "roles.manage",
  QUESTION_BANKS_VIEW: "question_banks.view",
  QUESTION_BANKS_MANAGE: "question_banks.manage",
  SETTINGS_VIEW: "settings.view",
};

export const ALL_PERMISSIONS = Object.values(PERMISSIONS);

// ---------------------------------------------------------------------------
// User repository
// ---------------------------------------------------------------------------
const rowToUser = (row) => ({
  id: row.id,
  email: row.email,
  name: row.full_name,
  passwordHash: row.password_hash,
  role: row.role,
  active: row.active,
  profileImage: row.profile_image ?? null,
  phone: row.phone ?? null,
  gender: row.gender ?? null,
  dateOfBirth: row.date_of_birth ?? null,
  address: row.address ?? null,
  hireDate: row.hire_date ?? null,
  subject: row.subject ?? null,
  qualification: row.qualification ?? null,
  createdAt: row.created_at,
});

const hashPassword = (plain) => bcrypt.hashSync(String(plain ?? ""), 12);

export async function listUsers() {
  if (client) {
    const { data, error } = await client
      .from("users")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(`Supabase users.list: ${error.message}`);
    return data.map(rowToUser);
  }
  return fileRepo.listUsers();
}

export async function getUserById(id) {
  if (client) {
    const { data, error } = await client
      .from("users")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`Supabase users.getById: ${error.message}`);
    return data ? rowToUser(data) : null;
  }
  return fileRepo.getUserById(id);
}

export async function findUserByLogin(identifier) {
  const needle = String(identifier ?? "").trim().toLowerCase();
  if (!needle) return null;
  const users = await listUsers();
  // Authentication is email-based only (username has been removed).
  return users.find((u) => u.active !== false && u.email.toLowerCase() === needle) || null;
}

export async function createUser({
  email,
  name,
  password,
  role,
  active = true,
  phone,
  gender,
  dateOfBirth,
  address,
  hireDate,
  subject,
  qualification,
  profileImage,
}) {
  if (client) {
    const { error } = await client.from("users").insert({
      // Legacy username column is kept populated with the email so the schema
      // stays satisfied; username is no longer part of the product.
      username: email,
      email,
      full_name: name,
      password_hash: hashPassword(password),
      role,
      active,
      profile_image: profileImage ?? null,
      phone: phone ?? null,
      gender: gender ?? null,
      date_of_birth: dateOfBirth ?? null,
      address: address ?? null,
      hire_date: hireDate ?? null,
      subject: subject ?? null,
      qualification: qualification ?? null,
    });
    if (error) throw new Error(`Supabase users.create: ${error.message}`);
    return findUserByLogin(email);
  }
  return fileRepo.createUser({
    email, name, password, role, active,
    phone, gender, dateOfBirth, address, hireDate, subject, qualification, profileImage,
  });
}

export async function updateUser(id, { name, email, password, active, phone, gender, dateOfBirth, address, hireDate, subject, qualification, profileImage }) {
  const patch = {};
  if (name !== undefined) patch.full_name = name;
  if (email !== undefined) { patch.email = email; patch.username = email; }
  if (active !== undefined) patch.active = active;
  if (profileImage !== undefined) patch.profile_image = profileImage || null;
  if (phone !== undefined) patch.phone = phone || null;
  if (gender !== undefined) patch.gender = gender || null;
  if (dateOfBirth !== undefined) patch.date_of_birth = dateOfBirth || null;
  if (address !== undefined) patch.address = address || null;
  if (hireDate !== undefined) patch.hire_date = hireDate || null;
  if (subject !== undefined) patch.subject = subject || null;
  if (qualification !== undefined) patch.qualification = qualification || null;
  if (password !== undefined && password) patch.password_hash = hashPassword(password);

  if (client) {
    const { error } = await client.from("users").update(patch).eq("id", id);
    if (error) throw new Error(`Supabase users.update: ${error.message}`);
    return getUserById(id);
  }
  return fileRepo.updateUser(id, { name, email, password, active, phone, gender, dateOfBirth, address, hireDate, subject, qualification, profileImage });
}

export async function deleteUser(id) {
  if (client) {
    const { error } = await client.from("users").delete().eq("id", id);
    if (error) throw new Error(`Supabase users.delete: ${error.message}`);
    return true;
  }
  return fileRepo.deleteUser(id);
}

export async function setUserRole(id, role) {
  if (client) {
    const { error } = await client.from("users").update({ role }).eq("id", id);
    if (error) throw new Error(`Supabase users.setRole: ${error.message}`);
    return getUserById(id);
  }
  return fileRepo.setUserRole(id, role);
}

export async function countUsersByRole() {
  if (client) {
    const { data, error } = await client
      .from("users")
      .select("role");
    if (error) throw new Error(`Supabase users.count: ${error.message}`);
    const counts = { teacher: 0, student: 0, parent: 0, super_admin: 0 };
    for (const u of data) counts[u.role] = (counts[u.role] ?? 0) + 1;
    return counts;
  }
  return fileRepo.countUsersByRole();
}

// ---------------------------------------------------------------------------
// Roles & permissions repository
// ---------------------------------------------------------------------------
export async function listRoles() {
  if (client) {
    const { data, error } = await client.from("roles").select("*").order("code");
    if (error) throw new Error(`Supabase roles.list: ${error.message}`);
    return data;
  }
  return fileRepo.listRoles();
}

export async function listPermissions() {
  if (client) {
    const { data, error } = await client.from("permissions").select("*").order("code");
    if (error) throw new Error(`Supabase permissions.list: ${error.message}`);
    return data;
  }
  return fileRepo.listPermissions();
}

export async function listRolePermissions() {
  if (client) {
    const { data, error } = await client.from("role_permissions").select("*");
    if (error) throw new Error(`Supabase role_permissions.list: ${error.message}`);
    return data;
  }
  return fileRepo.listRolePermissions();
}

export async function permissionsForRole(roleCode) {
  const rows = await listRolePermissions();
  return rows
    .filter((r) => r.role_code === roleCode)
    .map((r) => r.permission_code);
}

export async function hasPermission(roleCode, permission) {
  if (roleCode === "super_admin") return true;
  const perms = await permissionsForRole(roleCode);
  return perms.includes(permission);
}

export async function setRolePermissions(roleCode, permissionCodes) {
  const unique = [...new Set(permissionCodes)];
  if (!client) {
    return fileRepo.setRolePermissions(roleCode, unique);
  }

  // Replace all rows for the role in a transaction-ish manner.
  const { error: delErr } = await client
    .from("role_permissions")
    .delete()
    .eq("role_code", roleCode);
  if (delErr) throw new Error(`Supabase role_permissions.delete: ${delErr.message}`);

  if (unique.length > 0) {
    const { error: insErr } = await client.from("role_permissions").insert(
      unique.map((permission_code) => ({ role_code: roleCode, permission_code }))
    );
    if (insErr) throw new Error(`Supabase role_permissions.insert: ${insErr.message}`);
  }

  // super_admin must always retain full permissions.
  return unique;
}

// One-time password-reset token store (file-backed, works across backends).
export const passwordResetStore = resetStore;

// ---------------------------------------------------------------------------
// Master Data: Standards
// ---------------------------------------------------------------------------
export async function listStandards() {
  if (!client) return [];
  const { data, error } = await client.from("standards").select("*").order("sort_order");
  if (error) throw new Error(`Supabase standards.list: ${error.message}`);
  return data;
}

export async function createStandard({ name, sort_order = 0 }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("standards").insert({ name, sort_order }).select().single();
  if (error) throw new Error(`Supabase standards.create: ${error.message}`);
  return data;
}

export async function updateStandard(id, { name, sort_order, active }) {
  if (!client) return null;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (sort_order !== undefined) patch.sort_order = sort_order;
  if (active !== undefined) patch.active = active;
  const { data, error } = await client.from("standards").update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase standards.update: ${error.message}`);
  return data;
}

export async function deleteStandard(id) {
  if (!client) return false;
  const { error } = await client.from("standards").delete().eq("id", id);
  if (error) throw new Error(`Supabase standards.delete: ${error.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// Master Data: Subjects
// ---------------------------------------------------------------------------
export async function listSubjects() {
  if (!client) return [];
  const { data, error } = await client.from("subjects").select("*").order("sort_order");
  if (error) throw new Error(`Supabase subjects.list: ${error.message}`);
  return data;
}

export async function createSubject({ name, icon, color, sort_order = 0 }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("subjects").insert({ name, icon, color, sort_order }).select().single();
  if (error) throw new Error(`Supabase subjects.create: ${error.message}`);
  return data;
}

export async function updateSubject(id, { name, icon, color, sort_order, active }) {
  if (!client) return null;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (icon !== undefined) patch.icon = icon;
  if (color !== undefined) patch.color = color;
  if (sort_order !== undefined) patch.sort_order = sort_order;
  if (active !== undefined) patch.active = active;
  const { data, error } = await client.from("subjects").update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase subjects.update: ${error.message}`);
  return data;
}

export async function deleteSubject(id) {
  if (!client) return false;
  const { error } = await client.from("subjects").delete().eq("id", id);
  if (error) throw new Error(`Supabase subjects.delete: ${error.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// Master Data: Chapters
// ---------------------------------------------------------------------------
export async function listChapters({ subject_id, standard_id } = {}) {
  if (!client) return [];
  let query = client.from("chapters").select("*").order("sort_order");
  if (subject_id) query = query.eq("subject_id", subject_id);
  if (standard_id) query = query.eq("standard_id", standard_id);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase chapters.list: ${error.message}`);
  return data;
}

export async function createChapter({ subject_id, standard_id, name, number, description, sort_order = 0 }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("chapters").insert({ subject_id, standard_id, name, number, description, sort_order }).select().single();
  if (error) throw new Error(`Supabase chapters.create: ${error.message}`);
  return data;
}

export async function updateChapter(id, { name, number, description, sort_order, active }) {
  if (!client) return null;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (number !== undefined) patch.number = number;
  if (description !== undefined) patch.description = description;
  if (sort_order !== undefined) patch.sort_order = sort_order;
  if (active !== undefined) patch.active = active;
  const { data, error } = await client.from("chapters").update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase chapters.update: ${error.message}`);
  return data;
}

export async function deleteChapter(id) {
  if (!client) return false;
  const { error } = await client.from("chapters").delete().eq("id", id);
  if (error) throw new Error(`Supabase chapters.delete: ${error.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// Master Data: Topics
// ---------------------------------------------------------------------------
export async function listTopics({ chapter_id } = {}) {
  if (!client) return [];
  let query = client.from("topics").select("*").order("sort_order");
  if (chapter_id) query = query.eq("chapter_id", chapter_id);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase topics.list: ${error.message}`);
  return data;
}

export async function createTopic({ chapter_id, name, number, description, sort_order = 0 }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("topics").insert({ chapter_id, name, number, description, sort_order }).select().single();
  if (error) throw new Error(`Supabase topics.create: ${error.message}`);
  return data;
}

export async function updateTopic(id, { name, number, description, sort_order, active }) {
  if (!client) return null;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (number !== undefined) patch.number = number;
  if (description !== undefined) patch.description = description;
  if (sort_order !== undefined) patch.sort_order = sort_order;
  if (active !== undefined) patch.active = active;
  const { data, error } = await client.from("topics").update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase topics.update: ${error.message}`);
  return data;
}

export async function deleteTopic(id) {
  if (!client) return false;
  const { error } = await client.from("topics").delete().eq("id", id);
  if (error) throw new Error(`Supabase topics.delete: ${error.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// Master Data: Question Levels
// ---------------------------------------------------------------------------
export async function listQuestionLevels() {
  if (!client) return [];
  const { data, error } = await client.from("question_levels").select("*").order("sort_order");
  if (error) throw new Error(`Supabase question_levels.list: ${error.message}`);
  return data;
}

export async function createQuestionLevel({ code, name, color, icon, sort_order = 0 }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("question_levels").insert({ code, name, color, icon, sort_order }).select().single();
  if (error) throw new Error(`Supabase question_levels.create: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Master Data: Exam Types
// ---------------------------------------------------------------------------
export async function listExamTypes() {
  if (!client) return [];
  const { data, error } = await client.from("exam_types").select("*").order("sort_order");
  if (error) throw new Error(`Supabase exam_types.list: ${error.message}`);
  return data;
}

export async function createExamType({ name, category, description, sort_order = 0 }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("exam_types").insert({ name, category, description, sort_order }).select().single();
  if (error) throw new Error(`Supabase exam_types.create: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Master Data: Languages
// ---------------------------------------------------------------------------
export async function listLanguages() {
  if (!client) return [];
  const { data, error } = await client.from("languages").select("*").order("name");
  if (error) throw new Error(`Supabase languages.list: ${error.message}`);
  return data;
}

export async function createLanguage({ code, name, native_name }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("languages").insert({ code, name, native_name }).select().single();
  if (error) throw new Error(`Supabase languages.create: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Master Data: Schools
// ---------------------------------------------------------------------------
export async function listSchools() {
  if (!client) return [];
  const { data, error } = await client.from("schools").select("*").order("name");
  if (error) throw new Error(`Supabase schools.list: ${error.message}`);
  return data;
}

export async function createSchool({ name, code, district, city, state, board, type, contact_email, contact_phone, address }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("schools").insert({ name, code, district, city, state, board, type, contact_email, contact_phone, address }).select().single();
  if (error) throw new Error(`Supabase schools.create: ${error.message}`);
  return data;
}

export async function updateSchool(id, { name, code, district, city, state, board, type, contact_email, contact_phone, address, active }) {
  if (!client) return null;
  const patch = {};
  if (name !== undefined) patch.name = name;
  if (code !== undefined) patch.code = code;
  if (district !== undefined) patch.district = district;
  if (city !== undefined) patch.city = city;
  if (state !== undefined) patch.state = state;
  if (board !== undefined) patch.board = board;
  if (type !== undefined) patch.type = type;
  if (contact_email !== undefined) patch.contact_email = contact_email;
  if (contact_phone !== undefined) patch.contact_phone = contact_phone;
  if (address !== undefined) patch.address = address;
  if (active !== undefined) patch.active = active;
  const { data, error } = await client.from("schools").update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase schools.update: ${error.message}`);
  return data;
}

export async function deleteSchool(id) {
  if (!client) return false;
  const { error } = await client.from("schools").delete().eq("id", id);
  if (error) throw new Error(`Supabase schools.delete: ${error.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// Questions CRUD
// ---------------------------------------------------------------------------
const rowToQuestion = (row) => ({
  id: row.id,
  bank_id: row.bank_id,
  created_by: row.created_by,
  standard_id: row.standard_id,
  subject_id: row.subject_id,
  chapter_id: row.chapter_id,
  topic_id: row.topic_id,
  type: row.type,
  exam_type_id: row.exam_type_id,
  language_id: row.language_id,
  difficulty: row.difficulty,
  level_id: row.level_id,
  exam_year: row.exam_year,
  content: row.content,
  explanation: row.explanation,
  image_url: row.image_url,
  marks: row.marks,
  negative_marks: row.negative_marks,
  time_limit_sec: row.time_limit_sec,
  quality_score: row.quality_score,
  tags: row.tags ?? [],
  status: row.status,
  sort_order: row.sort_order,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export async function createQuestion({
  bank_id, created_by, standard_id, subject_id, chapter_id, topic_id,
  type, exam_type_id, language_id, difficulty, level_id, exam_year,
  content, explanation, image_url, marks, negative_marks, time_limit_sec,
  tags, status, sort_order,
}) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("questions")
    .insert({
      bank_id: bank_id || null,
      created_by,
      standard_id: standard_id || null,
      subject_id: subject_id || null,
      chapter_id: chapter_id || null,
      topic_id: topic_id || null,
      type,
      exam_type_id: exam_type_id || null,
      language_id: language_id || null,
      difficulty: difficulty || null,
      level_id: level_id || null,
      exam_year: exam_year || null,
      content,
      explanation: explanation || null,
      image_url: image_url || null,
      marks: marks ?? 1,
      negative_marks: negative_marks ?? 0,
      time_limit_sec: time_limit_sec || null,
      tags: tags ?? [],
      status: status || "draft",
      sort_order: sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw new Error(`Supabase questions.create: ${error.message}`);
  return rowToQuestion(data);
}

export async function getQuestionById(id) {
  if (!client) return null;
  const { data, error } = await client.from("questions").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Supabase questions.getById: ${error.message}`);
  return data ? rowToQuestion(data) : null;
}

export async function listQuestions({ bank_id, standard_id, subject_id, chapter_id, topic_id, type, difficulty, level_id, exam_type_id, language_id, exam_year, status, tags, created_by, limit = 50, offset = 0 } = {}) {
  if (!client) return [];
  let query = client.from("questions").select("*").order("sort_order").order("created_at", { ascending: false });
  if (bank_id) query = query.eq("bank_id", bank_id);
  if (standard_id) query = query.eq("standard_id", standard_id);
  if (subject_id) query = query.eq("subject_id", subject_id);
  if (chapter_id) query = query.eq("chapter_id", chapter_id);
  if (topic_id) query = query.eq("topic_id", topic_id);
  if (type) query = query.eq("type", type);
  if (difficulty) query = query.eq("difficulty", difficulty);
  if (level_id) query = query.eq("level_id", level_id);
  if (exam_type_id) query = query.eq("exam_type_id", exam_type_id);
  if (language_id) query = query.eq("language_id", language_id);
  if (exam_year) query = query.eq("exam_year", exam_year);
  if (status) query = query.eq("status", status);
  if (created_by) query = query.eq("created_by", created_by);
  if (tags && tags.length > 0) query = query.overlaps("tags", tags);
  query = query.range(offset, offset + limit - 1);
  const { data, error } = await query;
  if (error) throw new Error(`Supabase questions.list: ${error.message}`);
  return data.map(rowToQuestion);
}

export async function countQuestions(filters = {}) {
  if (!client) return 0;
  let query = client.from("questions").select("id", { count: "exact", head: true });
  if (filters.bank_id) query = query.eq("bank_id", filters.bank_id);
  if (filters.standard_id) query = query.eq("standard_id", filters.standard_id);
  if (filters.subject_id) query = query.eq("subject_id", filters.subject_id);
  if (filters.chapter_id) query = query.eq("chapter_id", filters.chapter_id);
  if (filters.topic_id) query = query.eq("topic_id", filters.topic_id);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.created_by) query = query.eq("created_by", filters.created_by);
  const { count, error } = await query;
  if (error) throw new Error(`Supabase questions.count: ${error.message}`);
  return count ?? 0;
}

export async function updateQuestion(id, patch) {
  if (!client) return null;
  const dbPatch = {};
  const fieldMap = {
    bank_id: "bank_id", standard_id: "standard_id", subject_id: "subject_id",
    chapter_id: "chapter_id", topic_id: "topic_id", type: "type",
    exam_type_id: "exam_type_id", language_id: "language_id", difficulty: "difficulty",
    level_id: "level_id", exam_year: "exam_year", content: "content",
    explanation: "explanation", image_url: "image_url", marks: "marks",
    negative_marks: "negative_marks", time_limit_sec: "time_limit_sec",
    tags: "tags", status: "status", sort_order: "sort_order",
  };
  for (const [key, col] of Object.entries(fieldMap)) {
    if (patch[key] !== undefined) dbPatch[col] = patch[key];
  }
  if (Object.keys(dbPatch).length === 0) return getQuestionById(id);
  const { error } = await client.from("questions").update(dbPatch).eq("id", id);
  if (error) throw new Error(`Supabase questions.update: ${error.message}`);
  return getQuestionById(id);
}

export async function deleteQuestion(id) {
  if (!client) return false;
  const { error } = await client.from("questions").delete().eq("id", id);
  if (error) throw new Error(`Supabase questions.delete: ${error.message}`);
  return true;
}

export async function duplicateQuestion(id, createdBy) {
  const original = await getQuestionById(id);
  if (!original) return null;
  const { id: _omit, created_at, updated_at, quality_score, ...rest } = original;
  return createQuestion({ ...rest, created_by: createdBy, status: "draft" });
}

// ---------------------------------------------------------------------------
// Question Options
// ---------------------------------------------------------------------------
export async function listQuestionOptions(questionId) {
  if (!client) return [];
  const { data, error } = await client.from("question_options")
    .select("*").eq("question_id", questionId).order("sort_order");
  if (error) throw new Error(`Supabase options.list: ${error.message}`);
  return data;
}

export async function createQuestionOption({ question_id, label, content, is_correct, sort_order }) {
  if (!client) throw new Error("Supabase not configured");
  const { data, error } = await client.from("question_options")
    .insert({ question_id, label, content, is_correct: is_correct ?? false, sort_order: sort_order ?? 0 })
    .select().single();
  if (error) throw new Error(`Supabase options.create: ${error.message}`);
  return data;
}

export async function updateQuestionOption(id, patch) {
  if (!client) return null;
  const { data, error } = await client.from("question_options")
    .update(patch).eq("id", id).select().single();
  if (error) throw new Error(`Supabase options.update: ${error.message}`);
  return data;
}

export async function deleteQuestionOption(id) {
  if (!client) return false;
  const { error } = await client.from("question_options").delete().eq("id", id);
  if (error) throw new Error(`Supabase options.delete: ${error.message}`);
  return true;
}

export async function deleteQuestionOptionsByQuestion(questionId) {
  if (!client) return false;
  const { error } = await client.from("question_options").delete().eq("question_id", questionId);
  if (error) throw new Error(`Supabase options.deleteByQuestion: ${error.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// Question Payloads
// ---------------------------------------------------------------------------
export async function getQuestionPayload(questionId) {
  if (!client) return null;
  const { data, error } = await client.from("question_payloads")
    .select("*").eq("question_id", questionId).maybeSingle();
  if (error) throw new Error(`Supabase payload.get: ${error.message}`);
  return data;
}

export async function upsertQuestionPayload(questionId, payload) {
  if (!client) return null;
  const { data, error } = await client.from("question_payloads")
    .upsert({ question_id: questionId, payload }, { onConflict: "question_id" })
    .select().single();
  if (error) throw new Error(`Supabase payload.upsert: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Question Edit History
// ---------------------------------------------------------------------------
export async function logQuestionEdit({ question_id, edited_by, field_changed, old_value, new_value, change_summary }) {
  if (!client) return;
  const { error } = await client.from("question_edit_history")
    .insert({ question_id, edited_by, field_changed, old_value, new_value, change_summary });
  if (error) console.error(`Supabase edit_history.log: ${error.message}`);
}

export async function getQuestionEditHistory(questionId, limit = 50) {
  if (!client) return [];
  const { data, error } = await client.from("question_edit_history")
    .select("*").eq("question_id", questionId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Supabase edit_history.list: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Question Usage History
// ---------------------------------------------------------------------------
export async function logQuestionUsage({ question_id, test_id, used_by, school_id, class_name, usage_type, student_count }) {
  if (!client) return;
  const { error } = await client.from("question_usage_log")
    .insert({ question_id, test_id, used_by, school_id, class_name, usage_type, student_count });
  if (error) console.error(`Supabase usage.log: ${error.message}`);
}

export async function getQuestionUsageHistory(questionId) {
  if (!client) return [];
  const { data, error } = await client.from("question_usage_log")
    .select("*").eq("question_id", questionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Supabase usage.list: ${error.message}`);
  return data;
}

export async function getQuestionUsageSummary(questionId) {
  if (!client) return { total: 0, teachers: [], schools: [] };
  const { data: logs, error } = await client.from("question_usage_log")
    .select("*").eq("question_id", questionId);
  if (error) throw new Error(`Supabase usage.summary: ${error.message}`);
  const total = logs.length;
  const teacherMap = {};
  const schoolMap = {};
  for (const log of logs) {
    if (log.used_by) teacherMap[log.used_by] = (teacherMap[log.used_by] || 0) + 1;
    if (log.school_id) schoolMap[log.school_id] = (schoolMap[log.school_id] || 0) + 1;
  }
  return { total, teachers: Object.entries(teacherMap).map(([id, count]) => ({ id, count })), schools: Object.entries(schoolMap).map(([id, count]) => ({ id, count })) };
}

// ---------------------------------------------------------------------------
// Question Performance
// ---------------------------------------------------------------------------
export async function getQuestionPerformance(questionId) {
  if (!client) return null;
  const { data, error } = await client.from("question_performance")
    .select("*").eq("question_id", questionId).maybeSingle();
  if (error) throw new Error(`Supabase performance.get: ${error.message}`);
  return data;
}
