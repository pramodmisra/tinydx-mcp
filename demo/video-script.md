# TinyDx Demo Video Script — 3 Minutes

## Target: Under 2:50 (leave buffer)

---

### [0:00–0:12] HOOK — Statistics on screen (no voiceover for first 5 sec)

**ON SCREEN (text overlay, dark background):**
```
5.6 years.
7 doctors.
7,000 diseases.
Nobody sees the whole picture.
```

**VOICEOVER (starts at 0:05):**
"Three hundred million people worldwide have a rare disease. On average, a child waits five point six years and sees seven different doctors before getting a diagnosis. Thirty percent of these children won't survive past age five."

---

### [0:12–0:30] THE PROBLEM

**ON SCREEN:** Show the Prompt Opinion platform, TinyDx agent selected

**VOICEOVER:**
"The problem isn't that doctors miss things. It's that each doctor only sees one piece of the puzzle. The pediatrician sees tall stature. The ophthalmologist sees lens problems. The cardiologist sees a dilated aorta. But nobody connects the dots. TinyDx changes that."

---

### [0:30–0:50] WHAT TINYDX IS

**ON SCREEN:** Show the TinyDx MCP server listing in the marketplace, the 7 tools visible

**VOICEOVER:**
"TinyDx is the first MCP server built for rare disease diagnostics. It's FHIR-native, HPO-powered, and family-facing. Inspired by DeepRare, published in Nature in February twenty twenty-six, TinyDx brings rare disease AI to the interoperable MCP ecosystem. Any agent on the Prompt Opinion platform can use it."

---

### [0:50–1:10] DEMO START — Assemble Timeline

**ON SCREEN:** Type "Diagnose patient lily-chen-001" in Po Chat. Show tool calls appearing.

**VOICEOVER:**
"Meet Lily Chen. She's six years old. She's seen five different specialists over three years. Each documented different symptoms, but nobody connected the dots. Watch what happens when we ask TinyDx to diagnose her."

**ON SCREEN:** Show the symptom timeline results appearing — scattered symptoms unified

**VOICEOVER:**
"In seconds, TinyDx pulls every encounter, condition, and observation from FHIR and assembles what no single doctor has seen — a complete chronological picture across all five providers."

---

### [1:10–1:30] HPO EXTRACTION + FAMILY HISTORY

**ON SCREEN:** Show the HPO terms and family history sections of the response

**VOICEOVER:**
"Next, TinyDx maps each symptom to the global phenotype standard — the Human Phenotype Ontology. Twelve clinical findings become twelve standardized HPO terms, each validated against the real HPO database. It also analyzes family history. Lily's father is tall with scoliosis and glasses. Her grandmother died at forty-five from heart problems."

---

### [1:30–2:00] DIFFERENTIAL DIAGNOSIS — The Big Reveal

**ON SCREEN:** Show the differential diagnosis results — Marfan Syndrome #1 HIGH confidence

**VOICEOVER:**
"Now the AI reasoning engine, cross-referenced with the Orphanet rare disease knowledge base, generates a ranked differential diagnosis. Marfan Syndrome: high confidence, one hundred percent phenotype overlap. The self-reflection loop confirms it — ectopia lentis plus aortic dilation plus skeletal features match the Ghent diagnostic criteria. The grandmother's death at forty-five from heart problems? Consistent with undiagnosed Marfan in the family."

---

### [2:00–2:20] PATHWAY + NAVIGATOR REPORT

**ON SCREEN:** Show the diagnostic pathway and navigator report sections

**VOICEOVER:**
"TinyDx doesn't stop at diagnosis. It recommends urgent FBN1 gene sequencing, cardiology follow-up, and cascade screening for the father. Then it generates something no other tool produces — a family navigator report. Plain language. No jargon. A document Lily's parents can hand to any new doctor, with questions to ask and resources like the Marfan Foundation."

---

### [2:20–2:40] SECOND PATIENT — Prove It's General

**ON SCREEN:** Briefly show Noah Williams result — Tay-Sachs identified

**VOICEOVER:**
"And this isn't a one-disease demo. Here's Noah Williams, age seven, with seizures, developmental regression, and a cherry red spot. TinyDx identifies Tay-Sachs disease and recommends an urgent hexosaminidase enzyme assay. Two completely different rare diseases — one connective tissue, one lysosomal storage — both correctly diagnosed."

---

### [2:40–2:55] IMPACT + CLOSE

**ON SCREEN:** Show the Prompt Opinion marketplace listing. Then closing stats.

**VOICEOVER:**
"TinyDx is live in the Prompt Opinion Marketplace right now. Any agent can use it. FHIR-native. HPO-powered. Orphanet-validated. Phenopacket-interoperable. Seven tools. Seven thousand diseases. One mission — end the diagnostic odyssey. Because no child should wait five point six years for an answer."

---

### [2:55–3:00] CLOSING CARD

**ON SCREEN (text overlay):**
```
TinyDx — Rare Disease Diagnostic Navigator
Live in the Prompt Opinion Marketplace
github.com/pramodmisra/tinydx-mcp
```

---

## Production Notes
- Total voiceover: ~650 words ≈ 2:45 at natural pace
- Screen recordings needed: Po Chat with Lily Chen full run, Noah Williams result, marketplace listing
- Add captions for accessibility (judges will notice)
- Background music: subtle, not distracting
