/**
 * AI-Analyzer Module
 * ==================
 * AI-assisted KAP Mapping Analyzer pipeline.
 *
 * SAFETY RULES:
 * - All AI output has status: "candidate" and humanVerified: false
 * - Only explicit human confirmation can promote a candidate
 * - Never set humanVerified=true programmatically
 * - Never set verified=true in mapping files
 * - Never copy mappings between fonts
 */

// Types
export type {
  CandidateStatus,
  MappingCandidate,
  CandidateMetadata,
  CrossFontComparison,
  SequenceAnalysis,
  SequenceAnchor,
  PotentialSequence,
  GlyphAnalysisRequest,
  ReferenceGlyph,
  GlyphAnalysisResponse,
  VisionProvider,
  ProviderConfig,
  FontAnalysis,
  ByteMappingEntry,
  GlyphInfo,
  ByteRange,
  CoverageInfo,
  GlyphDataset,
  GlyphDatasetEntry,
  CandidateFile,
  VerifiedFile,
  VerifiedMapping,
} from "./types";

export {
  CONFIDENCE_LEVELS,
  getConfidenceCategory,
  isGujaratiBlock,
  isValidKapOutput,
} from "./types";

// Providers
export { MockProvider } from "./mock-provider";
export {
  OpenAIVisionProvider,
  createOpenAIVisionProvider,
} from "./openai-vision-provider";
export type { OpenAIVisionConfig } from "./openai-vision-provider";

// Provider Factory
export {
  createProvider,
  isOpenAIConfigured,
  getConfiguredProviderType,
  getProviderStatus,
  ProviderConfigurationError,
} from "./provider-factory";
export type { ProviderType, ProviderFactoryConfig } from "./provider-factory";

// Caching
export { VisionCache, calculateFileHash, calculateFileChecksum } from "./vision-cache";
export type { CachedVisionResult, VisionCacheKey, VisionCacheConfig } from "./vision-cache";

// Rate Limiting
export { RateLimiter } from "./rate-limiter";
export type { RateLimiterConfig } from "./rate-limiter";

// Sequence Analysis
export {
  analyzeSequence,
  validateSequenceCandidate,
  getKnownSequences,
  KNOWN_ANCHORS,
} from "./sequence-analyzer";
export type {
  SequenceCandidate,
  SequenceAnalysisRequest,
  SequenceAnalysisResponse,
} from "./sequence-analyzer";

// Output Validation
export {
  validateModelOutput,
  validateCandidateSafety,
  validateAnalysisResponse,
} from "./output-validation";
export type {
  OutputValidationErrorType,
  OutputValidationError,
  OutputValidationResult,
} from "./output-validation";

// Candidate Generation
export {
  generateCandidates,
  addKnownAnchors,
  filterByConfidence,
  getBytesWithCandidates,
  getCandidatesForByte,
  getCandidateSummary,
} from "./candidate-generator";

// Candidate Validation
export type {
  ValidationErrorType,
  ValidationError,
  ValidationResult,
} from "./candidate-validation";

export {
  validateCandidate,
  findDuplicates,
  findConflicts,
  findAnchorContradictions,
  validateCandidateFile,
  filterValidCandidates,
  getValidationSummary,
} from "./candidate-validation";

// Confidence Scoring
export type { ConfidenceLevel } from "./confidence";

export {
  CONFIDENCE_LEVELS,
  getConfidenceLevel,
  getConfidenceLabel,
  getConfidenceColor,
  calculateCompositeConfidence,
  scoreCandidate,
  getConfidenceSummary,
  filterByConfidenceThreshold,
  sortByConfidence,
  getTopCandidates,
} from "./confidence";
