# TinyDx MCP — Rare Disease Diagnostic Navigator

## Project Identity
**TinyDx** is an MCP server that helps end the "diagnostic odyssey" for children with rare diseases. It is the **FIRST** MCP server for rare disease diagnostic support — FHIR-native, HPO-powered, and family-facing.

**Hackathon:** Agents Assemble — The Healthcare AI Endgame Challenge
**Platform:** Prompt Opinion (app.promptopinion.ai)
**Deadline:** May 11, 2026, 11:00 PM ET
**Prize:** $25,000 total, $7,500 Grand Prize
**Path:** Option 1 — MCP Server (Superpower)
**Author:** Pramod Misra, Director of Data Analytics & AI, Snellings Walters Insurance Agency

## The Emotional Core
> A child with a rare disease sees 7 doctors over 5.6 years. Each doctor sees one piece of the puzzle. Nobody sees the whole picture. 30% of these children don't survive past age 5. TinyDx assembles what no single doctor has seen.

## Architecture (DeepRare-Inspired, MCP-Native)

### Three-Layer Design (adapted from DeepRare, Nature Feb 2026):
1. **MCP Tool Layer** — 7 tools exposed via MCP protocol, callable by any Prompt Opinion agent
2. **AI Reasoning Layer** — Claude API for phenotype extraction, differential diagnosis with self-reflection loop, report generation
3. **Knowledge Layer** — HPO API + Orphanet API + OMIM API for rare disease matching

### Key Architecture Decisions:
- **Clinical Phenotype Pathway ONLY** — Operates BEFORE genetic testing (the upstream bottleneck)
- **Self-Reflection Loop** — generate differential → verify phenotype matches → refine ranking → assign confidence. Bounded to 3 iterations (Power of 15 Rule 2)
- **Family-Facing Output** — Navigator Report is the emotional differentiator no other tool produces
- **Phenopacket Export** — GA4GH v2.0 standard for global interoperability
- **SHARP Compliance** — Every tool accepts SHARP context for Prompt Opinion integration

## Tech Stack
- Runtime: TypeScript, Node.js >= 20
- MCP SDK: @modelcontextprotocol/sdk 1.12.1
- AI: @anthropic-ai/sdk 0.39.0 (Claude claude-sonnet-4-20250514)
- Schema: zod 3.24.4
- FHIR: Direct REST calls to FHIR R4
- Knowledge APIs: HPO (NLM), Orphanet (orphadata.com), OMIM (omim.org)
- Deploy: Docker → Cloud → Prompt Opinion Marketplace

## MCP Tools (7)
1. `assemble_symptom_timeline` — FHIR → unified chronological timeline across all providers
2. `extract_phenotype_terms` — AI maps clinical data to standardized HPO terms
3. `generate_differential` — Ranked rare disease candidates with reasoning + self-reflection loop
4. `suggest_diagnostic_pathway` — Recommends genetic tests, specialists, next steps
5. `create_navigator_report` — Family-friendly plain-language diagnostic summary
6. `analyze_family_history` — Hereditary pattern extraction from FHIR FamilyMemberHistory
7. `output_phenopacket` — GA4GH Phenopacket v2.0 export

## Environment Variables
```
ANTHROPIC_API_KEY=         # Required — Claude API key (never hardcode)
FHIR_BASE_URL=             # Default: https://hapi.fhir.org/baseR4
OMIM_API_KEY=              # Free research key from omim.org/api
HPO_API_BASE=              # Default: https://clinicaltables.nlm.nih.gov/api/hpo/v3
ORPHANET_API_BASE=         # Default: https://api.orphadata.com
PORT=3000
```

## Power of 15 Compliance (MANDATORY for all code)
- Rule 1: No recursion — all loops iterative
- Rule 2: All loops bounded (MAX_CANDIDATES=10, MAX_HPO_TERMS=50, MAX_FHIR_PAGES=20, MAX_REASONING_STEPS=3)
- Rule 4: Functions ≤60 lines
- Rule 5: ≥2 assertions per tool handler
- Rule 7: All API calls with try/catch + retry + backoff
- Rule 14: No secrets in code, no PHI in logs
- Rule 15: Exact dependency versions pinned

## Implementation Status
- [x] Project scaffold and domain types
- [x] Config loader with env var validation
- [x] FHIR client (Condition, Observation, Encounter, FamilyMemberHistory)
- [x] Timeline assembler
- [x] AI reasoning (phenotype extraction, differential with self-reflection, pathway, navigator report)
- [x] Main MCP server with 7 tools + SHARP context parsing
- [x] Dockerfile
- [ ] HPO API direct validation (supplement AI-driven extraction)
- [ ] Orphanet API cross-reference (supplement AI-driven differential)
- [ ] OMIM API enrichment (clinical synopses for top candidates)
- [ ] Synthetic patient creation + FHIR loading script
- [ ] Prompt Opinion platform registration + marketplace publishing
- [ ] SHARP extension spec deep integration
- [ ] End-to-end testing in Prompt Opinion
- [ ] Demo video (< 3 minutes)
- [ ] Devpost submission

## Key References
- DeepRare paper: https://www.nature.com/articles/s41586-025-10097-9
- Prompt Opinion platform: https://app.promptopinion.ai
- Prompt Opinion GitHub samples: https://github.com/prompt-opinion
- Getting started video: https://youtu.be/Qvs_QK4meHc
- Prompt Opinion Discord: https://discord.gg/JS2bZVruUg
- HPO: https://hpo.jax.org/ (API: clinicaltables.nlm.nih.gov/api/hpo/v3)
- Orphanet API: https://api.orphadata.com/
- OMIM API: https://www.omim.org/help/api
- Phenopackets: https://phenopacket-schema.readthedocs.io/
- HAPI FHIR test server: https://hapi.fhir.org/baseR4
- SYNTHEA: https://github.com/synthetichealth/synthea

## Critical Rules
1. **Synthetic data ONLY** — Real PHI = instant disqualification
2. **Must publish to Prompt Opinion Marketplace** — Stage 1 pass/fail gate
3. **Demo video INSIDE Prompt Opinion platform** — Not standalone
4. **SHARP compliance** — Most competitors will skip this; we won't
5. **Navigator Report** — The emotional payload that wins judges
6. **Reference DeepRare** — "Inspired by DeepRare (Nature 2026), TinyDx brings rare disease AI to the interoperable MCP ecosystem"
