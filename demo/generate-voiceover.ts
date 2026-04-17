/**
 * Generate professional voiceover for TinyDx demo video using ElevenLabs API.
 *
 * Usage: ELEVENLABS_API_KEY=your-key npx tsx demo/generate-voiceover.ts
 *
 * Generates individual audio segments for each section of the demo,
 * then a combined full narration. Output: demo/audio/ directory.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const API_KEY = process.env.ELEVENLABS_API_KEY;
if (!API_KEY) {
  console.error("Error: Set ELEVENLABS_API_KEY environment variable");
  process.exit(1);
}

// Use a professional, warm male voice — "Adam" is a good default
// You can change this to any ElevenLabs voice ID
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "pNInz6obpgDQGcFmaJgB"; // "Adam"
const MODEL_ID = "eleven_multilingual_v2";

const OUTPUT_DIR = resolve(import.meta.dirname ?? ".", "audio");
mkdirSync(OUTPUT_DIR, { recursive: true });

// Script segments — each becomes a separate audio file
const SEGMENTS: Array<{ name: string; text: string }> = [
  {
    name: "01-hook",
    text: `Three hundred million people worldwide have a rare disease. On average, a child waits five point six years and sees seven different doctors before getting a diagnosis. Thirty percent of these children won't survive past age five.`,
  },
  {
    name: "02-problem",
    text: `The problem isn't that doctors miss things. It's that each doctor only sees one piece of the puzzle. The pediatrician sees tall stature. The ophthalmologist sees lens problems. The cardiologist sees a dilated aorta. But nobody connects the dots. TinyDx changes that.`,
  },
  {
    name: "03-what-is-tinydx",
    text: `TinyDx is the first MCP server built for rare disease diagnostics. It's FHIR-native, HPO-powered, and family-facing. Inspired by DeepRare, published in Nature in February twenty twenty-six, TinyDx brings rare disease AI to the interoperable MCP ecosystem. Any agent on the Prompt Opinion platform can use it.`,
  },
  {
    name: "04-demo-timeline",
    text: `Meet Lily Chen. She's six years old. She's seen five different specialists over three years. Each documented different symptoms, but nobody connected the dots. Watch what happens when we ask TinyDx to diagnose her. In seconds, TinyDx pulls every encounter, condition, and observation from FHIR and assembles what no single doctor has seen. A complete chronological picture across all five providers.`,
  },
  {
    name: "05-hpo-family",
    text: `Next, TinyDx maps each symptom to the global phenotype standard, the Human Phenotype Ontology. Twelve clinical findings become twelve standardized HPO terms, each validated against the real HPO database. It also analyzes family history. Lily's father is tall with scoliosis and glasses. Her grandmother died at forty-five from heart problems.`,
  },
  {
    name: "06-differential",
    text: `Now the AI reasoning engine, cross-referenced with the Orphanet rare disease knowledge base, generates a ranked differential diagnosis. Marfan Syndrome: high confidence, one hundred percent phenotype overlap. The self-reflection loop confirms it. Ectopia lentis plus aortic dilation plus skeletal features match the Ghent diagnostic criteria. The grandmother's death at forty-five from heart problems? Consistent with undiagnosed Marfan in the family.`,
  },
  {
    name: "07-pathway-report",
    text: `TinyDx doesn't stop at diagnosis. It recommends urgent FBN1 gene sequencing, cardiology follow-up, and cascade screening for the father. Then it generates something no other tool produces. A family navigator report. Plain language. No jargon. A document Lily's parents can hand to any new doctor, with questions to ask and resources like the Marfan Foundation.`,
  },
  {
    name: "08-second-patient",
    text: `And this isn't a one-disease demo. Here's Noah Williams, age seven, with seizures, developmental regression, and a cherry red spot. TinyDx identifies Tay-Sachs disease and recommends an urgent hexosaminidase enzyme assay. Two completely different rare diseases. One connective tissue, one lysosomal storage. Both correctly diagnosed.`,
  },
  {
    name: "09-close",
    text: `TinyDx is live in the Prompt Opinion Marketplace right now. Any agent can use it. FHIR-native. HPO-powered. Orphanet-validated. Phenopacket-interoperable. Seven tools. Seven thousand diseases. One mission. End the diagnostic odyssey. Because no child should wait five point six years for an answer.`,
  },
];

async function generateAudio(text: string, outputPath: string): Promise<void> {
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": API_KEY!,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.6,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`ElevenLabs API ${response.status}: ${errText.substring(0, 200)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  writeFileSync(outputPath, buffer);
  console.log(`  Saved: ${outputPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
}

async function main(): Promise<void> {
  console.log("Generating TinyDx demo voiceover with ElevenLabs\n");
  console.log(`Voice: ${VOICE_ID}`);
  console.log(`Model: ${MODEL_ID}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Generate individual segments
  for (const seg of SEGMENTS) {
    console.log(`Generating: ${seg.name}...`);
    const outPath = resolve(OUTPUT_DIR, `${seg.name}.mp3`);
    await generateAudio(seg.text, outPath);
  }

  // Generate full combined narration
  console.log("\nGenerating: full-narration (combined)...");
  const fullText = SEGMENTS.map((s) => s.text).join("\n\n");
  await generateAudio(fullText, resolve(OUTPUT_DIR, "full-narration.mp3"));

  console.log("\n=== Done! ===");
  console.log(`${SEGMENTS.length} segments + 1 full narration generated in ${OUTPUT_DIR}`);
  console.log("\nNext steps:");
  console.log("1. Record screen captures of Po Chat (Lily Chen + Noah Williams demos)");
  console.log("2. Use a video editor (DaVinci Resolve, CapCut, or similar) to:");
  console.log("   - Lay the audio segments over the screen recordings");
  console.log("   - Add text overlays for the opening stats");
  console.log("   - Add captions for accessibility");
  console.log("   - Keep total under 3:00");
  console.log("3. Upload to YouTube and link in DevPost submission");
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
