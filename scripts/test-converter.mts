/**
 * Converter test harness.
 *
 * Run with:  npx -y tsx scripts/test-converter.mts
 *
 * Uses an injected MOCK mapping to prove pipeline behaviour
 * (sequence matching, reordering-capable rules, warnings,
 * mixed-content preservation). Real KAP golden data is asserted
 * ONLY when a verified table is present in the registry — until
 * then those checks report PENDING instead of fabricating results.
 */

import {
  convertGujaratiUnicodeToKap,
} from "../src/converter/GujaratiUnicodeToKap";
import { looksLikeLegacyKap } from "../src/converter/conversionUtils";
import {
  __resetMappingsForTests,
  __setMappingForTests,
  getMappingStatus,
} from "../src/converter/mappings";
import type { FontMapping } from "../src/converter/types";

let passed = 0;
let failed = 0;
let pending = 0;

function check(name: string, condition: boolean): void;
function check(name: string, actual: unknown, expected: unknown): void;
function check(name: string, conditionOrActual: unknown, expected?: unknown): void {
  if (expected === undefined) {
    if (conditionOrActual) {
      passed++;
      console.log(`  ok  ${name}`);
    } else {
      failed++;
      console.error(`FAIL  ${name}`);
    }
    return;
  }
  const actualStr = JSON.stringify(conditionOrActual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr === expectedStr) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}\n      expected ${expectedStr}\n      got      ${actualStr}`);
  }
}

function pendingCheck(name: string, detail: string): void {
  pending++;
  console.log(` PEND ${name} (${detail})`);
}

const MOCK: FontMapping = {
  font: "KAP112",
  verified: true,
  source: "test fixture",
  rules: [
    { unicode: "ક્ષ", kap: "<+" },        // conjunct beats single char
    { unicode: "કિ", kap: "izk" },        // pre-base matra reorder demo
    { unicode: "ગુ", kap: "F5" },
    { unicode: "જરા", kap: "[,F" },
    { unicode: "તી", kap: ";F" },
    { unicode: "ક", kap: "dk" },
    { unicode: "ં", kap: "M" },
  ],
};

// ---------------------------------------------------------------------------
// Honesty guards FIRST (registry still in shipped, unverified state)
// ---------------------------------------------------------------------------

console.log("\n== Honesty guards (shipped registry) ==\n");

const r11 = convertGujaratiUnicodeToKap("ગુજરાતી", "KAP110");
check("Unloaded mapping refuses to fabricate", r11.mappingAvailable, false);
check("Unloaded mapping returns input untouched", r11.output, "ગુજરાતી");
check("Unloaded mapping explains why", r11.warnings[0]?.reason.includes("not been provided"), true);

const status110 = getMappingStatus("KAP110");
check("Registry reports KAP110 unloaded", status110.loaded, false);
const status112 = getMappingStatus("KAP112");
check("KAP112 currently unloaded (partial data)", status112.loaded, false);

// Now inject the mock and run pipeline behaviour tests.
__setMappingForTests(MOCK);

console.log("\n== Pipeline behaviour (mock mapping) ==\n");

const r1 = convertGujaratiUnicodeToKap("", "KAP112");
check("Test 1: empty input -> no crash", r1.output, "");
check("Test 1: no warnings on empty", r1.warnings.length, 0);

const r2 = convertGujaratiUnicodeToKap("Hello World", "KAP112");
check("Test 2: english untouched", r2.output, "Hello World");
check("Test 2: zero gujarati counted", r2.totalGujaratiChars, 0);

const r3 = convertGujaratiUnicodeToKap("123456", "KAP112");
check("Test 3: numbers preserved", r3.output, "123456");

const r4 = convertGujaratiUnicodeToKap("Hello ક 123", "KAP112");
check("Test 4: mixed content", r4.output, "Hello dk 123");

const r5 = convertGujaratiUnicodeToKap("ક\nક", "KAP112");
check("Test 5: newline preserved", r5.output, "dk\ndk");

const r6 = convertGujaratiUnicodeToKap("ક્ષ", "KAP112");
check("Longest-sequence-first picks conjunct", r6.output, "<+");

const r7 = convertGujaratiUnicodeToKap("કિ", "KAP112");
check("Pre-base matra handled as one rule", r7.output, "izk");

const r8 = convertGujaratiUnicodeToKap("ગુજરાતી", "KAP112");
check("Sequence composition", r8.output, "F5[,F;F");

const r9 = convertGujaratiUnicodeToKap("ડ", "KAP112"); // not in mock map
check("Unsupported cluster preserved verbatim", r9.output.includes("ડ"), true);
check(
  "Unsupported cluster produces warning",
  r9.warnings.length > 0 && r9.warnings[0].reason === "unsupported_sequence",
  true
);
const pct =
  r9.totalGujaratiChars > 0
    ? Math.round((r9.convertedChars / r9.totalGujaratiChars) * 100)
    : 100;
check("Conversion percentage computed", pct, 0);

const r10 = convertGujaratiUnicodeToKap("ક ૐ ક", "KAP112");
check("Spaces between runs survive", r10.output, "dk ૐ dk");

// ---------------------------------------------------------------------------
console.log("\n== Honesty guards ==\n");

__resetMappingsForTests();

const r11b = convertGujaratiUnicodeToKap("ગુજરાતી", "KAP112");
check("Restored registry: KAP112 unloaded again", r11b.mappingAvailable, false);

// ---------------------------------------------------------------------------
console.log("\n== Legacy-detection heuristic ==\n");

check("Legacy sample detected", looksLikeLegacyKap("VF5[,F VF5[,F"), true);
check("Plain english NOT flagged", looksLikeLegacyKap("Hello World"), false);
check("Unicode gujarati NOT flagged", looksLikeLegacyKap("ગુજરાતી"), false);

// ---------------------------------------------------------------------------
console.log("\n== Golden samples (verified project data) ==\n");

const kap112Status = getMappingStatus("KAP112");
if (!kap112Status.loaded) {
  pendingCheck(
    "KAP112 golden: ગુજરાતી -> VF5[,F",
    "mapping table not yet supplied"
  );
} else {
  const gold = convertGujaratiUnicodeToKap("ગુજરાતી", "KAP112");
  check("KAP112 golden output", gold.output, "VF5[,F");
}

pendingCheck("KAP110/111/122 golden outputs", "mapping tables not yet supplied");

// ---------------------------------------------------------------------------
console.log(`\nResults: ${passed} passed, ${failed} failed, ${pending} pending\n`);
process.exit(failed > 0 ? 1 : 0);
