# TinyDx — Project Context & Competitive Intelligence

## Hackathon Details

### Judging Criteria (Equally Weighted)
1. **The AI Factor** — Does GenAI solve what rule-based software cannot?
2. **Potential Impact** — Significant pain point? Clear hypothesis for outcomes/cost/time improvement?
3. **Feasibility** — Could this exist in a real health system today? Respects privacy, safety, regulatory?

### Stage 1: Pass/Fail Technical Gate
- Project MUST be published to Prompt Opinion Marketplace
- MUST be an MCP Server or A2A Agent
- MUST be discoverable and invokable within Prompt Opinion
- MUST use synthetic/de-identified data only (no real PHI)

### Judge Profiles (Tailor Output to These People)
| Judge | Role | What They Care About |
|-------|------|---------------------|
| **Alice Zheng, MD, MBA, MPH** | Venture capitalist, ex-McKinsey | Women's health × AI, ROI narratives, market size, health equity |
| **Josh Mandel, MD** | Chief Architect for Health, Microsoft Research | FHIR standards purity, interoperability, data architecture |
| **Joshua Hickey** | Principal TPM, Mayo Clinic | Real clinical workflow feasibility, practical deployment |
| **Parth Tripathi** | Staff Engineer, Vertex AI Gemini, Google | Technical sophistication of AI layer, reasoning quality |
| **Piyush Mathur, MD** | Staff Anesthesiologist/Intensivist, Cleveland Clinic; Co-Founder BrainX | Clinician pain points, safety, critical care perspective |
| **Stephon Proctor, PhD, MBI** | ACHIO for Platform Innovation, Children's Hospital of Philadelphia (CHOP) | Pediatric angle, platform thinking, innovation in children's health |

### Why TinyDx Wins with THIS Judge Panel
- **Stephon Proctor (CHOP)** — Rare disease in children IS his world. CHOP is a global rare disease leader.
- **Alice Zheng** — Rare disease is a $200B+ market. Health equity angle (rare disease disparities).
- **Josh Mandel** — FHIR-native + HPO + Phenopackets = standards dream. He literally built FHIR.
- **Parth Tripathi** — Self-reflection loop, multi-step reasoning, HPO mapping = genuine AI sophistication.
- **Piyush Mathur** — The diagnostic odyssey causes real harm. He sees downstream consequences in the ICU.

## Competitive Landscape — What Exists

### DeepRare (Nature, Feb 2026) — THE benchmark
- Multi-agent LLM system (DeepSeek-V3 + 40 specialized tools)
- 64.4% Recall@1 on rare disease diagnosis, outperforms experienced physicians
- Three-tier MCP-inspired architecture: Central Host → Agent Servers → External Resources
- Self-reflection loop reduces hallucination (95.4% expert agreement on reasoning)
- **GAP:** NOT an MCP server. NOT FHIR-integrated. NOT a product. Research-only. No family output.
- **Our play:** "Inspired by DeepRare, TinyDx brings rare disease AI to the interoperable MCP ecosystem."

### Microsoft MAI-DxO (June 2025)
- AI Diagnostic Orchestrator with "chain-of-debate" reasoning
- 85% accuracy on 304 NEJM complex cases
- Combines GPT, Claude, Gemini, Llama
- **GAP:** General diagnostics, not rare-disease-specific. Not FHIR-native. Not MCP. Enterprise-only.

### Exomiser (Monarch Initiative) — Gold standard for genomic pathway
- Phenotype-driven variant prioritization using HPO
- 82-94% recall in top 5 for known diagnoses (100K Genomes Project)
- Java command-line tool, requires VCF files (whole exome/genome sequencing data)
- **GAP:** Requires GENOMIC data. Requires bioinformatics expertise. No API/MCP. No family output.
- **Our play:** TinyDx operates PRE-genetic testing. Complementary, not competitive.

### Face2Gene (FDNA)
- Facial recognition AI for genetic syndromes
- 48% accuracy on rare cases
- **GAP:** Facial-only. Misses non-syndromic diseases. Proprietary. Not FHIR.

### Phen2Gene / LIRICAL
- Phenotype-to-gene prioritization from HPO terms
- Fast, open source
- **GAP:** Require pre-extracted HPO terms. No NLP. No FHIR. No MCP. No family output.
- **Our play:** Could use Phen2Gene's H2GKB knowledge base to enhance differential scoring.

### ARPA-H RAPID Program (Dec 2024)
- Major federal initiative for AI-powered rare disease diagnosis
- Still in funding/proposal stage — no tools yet
- **Our play:** CITE THIS. "The federal government just launched ARPA-H RAPID for this exact problem."

## The 5 Gaps TinyDx Fills (Our Competitive Moat)
1. **First MCP server for rare disease diagnostics** — Nobody has built this.
2. **FHIR-native** — Pulls from the patient's actual clinical record. No manual data entry.
3. **Pre-genetic testing** — The upstream bottleneck. Helps DECIDE if genomic testing is warranted.
4. **Family-facing output** — The Navigator Report. No other tool produces this.
5. **Interoperable via MCP/SHARP/Phenopackets** — Works in Prompt Opinion ecosystem + globally.

## Key APIs & Databases Available

### HPO API (NLM Clinical Tables) — FREE
- Base URL: `https://clinicaltables.nlm.nih.gov/api/hpo/v3/search`
- 13,000+ phenotype terms, 156,000+ disease annotations
- Parameters: `?terms={query}&maxList=10`
- Returns: term IDs, names, codes
- Also available as FHIR ValueSet $expand
- Docs: https://clinicaltables.nlm.nih.gov/apidoc/hpo/v3/doc.html

### Orphanet / Orphadata API — FREE
- Base URL: `https://api.orphadata.com/`
- Also: `https://api.orphacode.org/` (ORPHAcode-specific)
- 6,000+ rare diseases with ORPHAcodes
- Gene-disease associations, epidemiological data, phenotype-disease links
- Cross-referenced with OMIM, ICD-10, ICD-11, SNOMED-CT
- Download datasets: https://www.orphadata.com/

### OMIM API — FREE (key required)
- Base URL: `https://api.omim.org/api/`
- Request key: https://www.omim.org/api (free for research)
- 8,000+ disease entries with clinical synopses
- Gene-disease relationships, inheritance patterns
- Example: `https://api.omim.org/api/entry/search?search=marfan&include=clinicalSynopsis`

### GA4GH Phenopackets v2.0
- Standard schema for rare disease data exchange
- FHIR-compatible
- Docs: https://phenopacket-schema.readthedocs.io/
- Our output_phenopacket tool exports in this format

### HAPI FHIR Public Test Server — FREE
- Base URL: `https://hapi.fhir.org/baseR4`
- Load synthetic patients, query via REST
- No authentication needed for public instance

### SYNTHEA — FREE
- Synthetic patient generator with FHIR output
- GitHub: https://github.com/synthetichealth/synthea
- Does NOT natively generate rare disease patients
- Strategy: Generate base patient, then manually enrich with rare disease conditions

## Key Statistics for Demo Narrative
- 300M people affected by rare diseases worldwide (Nature, 2026)
- 5.6-year average diagnostic odyssey (Rare Barometer, 2024)
- 30% of children with rare diseases die before age 5 (Global Commission)
- 7+ physicians consulted on average (EveryLife Foundation)
- 80% of rare diseases are genetic (Global Genes)
- 7,000+ distinct rare diseases identified
- 50-80% remain undiagnosed after whole genome sequencing (100K Genomes Project)
- Average cost per family: ~$5,050 before successful diagnosis
- ARPA-H launched RAPID program specifically for this (Dec 2024)
- DeepRare published in Nature (Feb 2026) — validates AI approach at highest level
- The Nature News & Views article on DeepRare was prepared using Anthropic's Claude

## Prompt Opinion Platform Notes
- Built on three protocols: MCP, A2A (Agent-to-Agent), and FHIR
- SHARP extension specs handle healthcare context (patient IDs, FHIR tokens)
- Platform bridges EHR session credentials into SHARP context
- MCP servers must be published to the Marketplace to be discoverable
- Getting started video: https://youtu.be/Qvs_QK4meHc
- Discord for support: https://discord.gg/JS2bZVruUg
- Sample projects: https://github.com/prompt-opinion
- A2A v1 migration docs: https://docs.promptopinion.ai/a2a-v1-migration
- Register: https://app.promptopinion.ai
