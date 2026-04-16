# TinyDx — Implementation Plan (26-Day Sprint)

## Phase 1: Foundation (Apr 15-21)

### Day 1-2: Platform Setup
- [ ] Register at https://app.promptopinion.ai
- [ ] Register at https://agents-assemble.devpost.com/
- [ ] Watch getting started video: https://youtu.be/Qvs_QK4meHc
- [ ] Join Discord: https://discord.gg/JS2bZVruUg
- [ ] Read ALL sample projects at https://github.com/prompt-opinion
- [ ] Read SHARP extension specs documentation thoroughly
- [ ] Request OMIM API key at https://www.omim.org/api
- [ ] Set up .env with ANTHROPIC_API_KEY and other vars

### Day 2-3: Project Bootstrap
- [ ] `npm install` — verify all dependencies resolve
- [ ] `npx tsc --noEmit` — verify TypeScript compiles cleanly
- [ ] Test MCP server starts: `npx tsx src/index.ts` (should print "TinyDx MCP server started" to stderr)
- [ ] Test FHIR connectivity: query https://hapi.fhir.org/baseR4/Patient?_count=1
- [ ] Test Claude API: simple completion call to verify key works

### Day 3-4: Synthetic Patient Creation
- [ ] Create a compelling synthetic pediatric rare disease patient case (see DEMO_SCENARIO.md)
- [ ] Write FHIR Bundle JSON with: Patient, multiple Conditions, Observations, Encounters, FamilyMemberHistory
- [ ] Include symptoms consistent with 1-2 real rare diseases (e.g., Marfan syndrome, Ehlers-Danlos, or a less common one)
- [ ] Scatter symptoms across multiple encounters/dates to simulate diagnostic odyssey
- [ ] Load patient into HAPI FHIR: POST Bundle to https://hapi.fhir.org/baseR4
- [ ] Write `scripts/load-fhir-patient.ts` to automate this
- [ ] Verify data loads correctly by querying back

### Day 4-5: Core Tool Testing
- [ ] Test Tool 1 (assemble_symptom_timeline) with loaded patient
- [ ] Test Tool 2 (extract_phenotype_terms) — verify HPO term extraction quality
- [ ] Test Tool 3 (generate_differential) — verify differential includes the correct disease
- [ ] Verify self-reflection loop improves confidence scores
- [ ] Test Tool 6 (analyze_family_history) with family history data
- [ ] Iterate on prompts until output quality is high

## Phase 2: Knowledge Integration (Apr 22-28)

### Day 6-7: HPO API Integration
- [ ] Create `src/services/hpo.ts`
- [ ] Implement HPO term search: `GET clinicaltables.nlm.nih.gov/api/hpo/v3/search?terms={query}`
- [ ] Use HPO API to VALIDATE AI-extracted terms (cross-reference, correct IDs)
- [ ] Add HPO validation step after AI extraction in extract_phenotype_terms tool
- [ ] This ensures HPO IDs are real and correctly mapped

### Day 7-8: Orphanet API Integration
- [ ] Create `src/services/orphanet.ts`
- [ ] Implement disease-phenotype lookup via Orphadata API
- [ ] Query: given HPO terms, which Orphanet diseases match?
- [ ] Use as a secondary signal alongside AI-driven differential
- [ ] Merge Orphanet results with AI candidates for stronger ranking

### Day 8-9: OMIM API Integration
- [ ] Create `src/services/omim.ts`
- [ ] Implement clinical synopsis lookup for top candidate diseases
- [ ] Enrich generate_differential output with OMIM evidence
- [ ] Add OMIM references to evidence arrays in DiseaseCandidate

### Day 9-10: Pathway & Report Refinement
- [ ] Test Tool 4 (suggest_diagnostic_pathway) — verify recommendations are specific and actionable
- [ ] Test Tool 5 (create_navigator_report) — verify plain-language quality
- [ ] Test Tool 7 (output_phenopacket) — verify schema compliance
- [ ] Iterate on prompt engineering for all reasoning functions
- [ ] Run full pipeline end-to-end: timeline → phenotypes → differential → pathway → report → phenopacket

## Phase 3: Platform Integration (Apr 29 - May 5)

### Day 11-12: SHARP Deep Integration
- [ ] Study Prompt Opinion's SHARP extension specs in detail
- [ ] Implement proper SHARP context extraction in all tools
- [ ] Test SHARP context propagation with platform agents
- [ ] Ensure patient ID + FHIR token flow correctly through SHARP

### Day 12-13: Prompt Opinion Marketplace
- [ ] Configure MCP server for remote deployment (may need Streamable HTTP transport)
- [ ] Deploy to cloud (Railway, Fly.io, or AWS)
- [ ] Register MCP server in Prompt Opinion Marketplace
- [ ] Configure tool descriptions for maximum agent discoverability
- [ ] Test: can a Prompt Opinion agent discover and invoke TinyDx tools?

### Day 13-14: End-to-End Platform Testing
- [ ] Create a workspace in Prompt Opinion
- [ ] Configure an agent that uses TinyDx MCP tools
- [ ] Run full diagnostic flow within the platform
- [ ] Verify SHARP context propagation works end-to-end
- [ ] Fix any integration issues
- [ ] Screenshot/record intermediate results for demo video

### Day 14-15: Polish & Edge Cases
- [ ] Test with multiple synthetic patients (different rare diseases)
- [ ] Handle edge cases: missing FHIR data, no family history, ambiguous symptoms
- [ ] Add error messages that are helpful, not cryptic
- [ ] Ensure all tools return well-structured, parseable JSON
- [ ] Performance optimization: are any tools too slow?

## Phase 4: Demo & Submit (May 6-11)

### Day 16-17: Devpost Submission Text
- [ ] Write compelling project description:
  - Problem: The diagnostic odyssey (stats, emotional impact)
  - Solution: TinyDx MCP server (what it does, how it works)
  - Architecture: DeepRare-inspired 3-tier design
  - Differentiation: First MCP for rare disease, FHIR-native, family-facing
  - Impact: 300M people, $5K average family cost, 30% childhood mortality
  - Technology: MCP + FHIR + HPO + Orphanet + Claude + Phenopackets
- [ ] Include URL to published Prompt Opinion Marketplace listing
- [ ] Include architecture diagram (create as image)

### Day 17-18: Demo Video Script
- [ ] Write script (see DEMO_SCENARIO.md for structure)
- [ ] Record voiceover separately for clean audio
- [ ] Screen-record: Prompt Opinion agent calling TinyDx tools
- [ ] Show the FULL flow: scattered symptoms → unified timeline → HPO terms → differential → navigator report
- [ ] Add captions for accessibility
- [ ] Keep under 3 minutes (judges won't watch beyond)

### Day 18-19: Demo Video Production
- [ ] Record with OBS Studio
- [ ] Edit: tight cuts, no dead time
- [ ] Add opening stats screen: "5.6 years. 7 doctors. 7,000 diseases."
- [ ] Add closing screen: "TinyDx is live in the Prompt Opinion Marketplace."
- [ ] Upload to YouTube (public/unlisted)

### Day 19-20: Final Submission (Buffer Days)
- [ ] Final marketplace configuration check
- [ ] Final Devpost review
- [ ] Submit on Devpost BEFORE May 11 11pm ET
- [ ] Celebrate 🎉

## Risk Mitigation
- **HAPI FHIR server down?** → Pre-cache patient data locally as fallback
- **Prompt Opinion integration issues?** → Engage their Discord support early (Day 1)
- **Claude API rate limits?** → Use claude-sonnet-4-20250514 (faster, cheaper than Opus), add retry logic
- **Orphanet/OMIM APIs unreliable?** → Cache key disease-phenotype mappings locally
- **Demo video over 3 min?** → Script first, time it, then record. Judges stop at 3:00.
