#!/usr/bin/env node

/**
 * Direct test of schema conversion without running the full server
 */

import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

// Test Schema similar to what's in the server
const TestSchema = z.object({
  videoId: z.string().min(1, 'Video ID is required'),
  includeTranscript: z.boolean().optional().default(true),
  optimizeFor: z.enum(['seo', 'engagement', 'discovery']).optional().default('seo'),
});

console.log('🔍 Testing Zod to JSON Schema Conversion\n');
console.log('Original Zod Schema (internal representation):');
console.log('─'.repeat(80));
console.log('Contains _def:', !!TestSchema._def);
console.log('Is Zod Object:', TestSchema instanceof z.ZodType);

console.log('\n\nConverted JSON Schema:');
console.log('─'.repeat(80));

const jsonSchema = zodToJsonSchema(TestSchema);
console.log(JSON.stringify(jsonSchema, null, 2));

console.log('\n\n✅ Verification:');
console.log('─'.repeat(80));
console.log('Has $schema:', !!jsonSchema.$schema);
console.log('Has type:', !!jsonSchema.type);
console.log('Has properties:', !!jsonSchema.properties);
console.log('Has _def:', !!jsonSchema._def);

if (!jsonSchema._def && (jsonSchema.$schema || jsonSchema.type)) {
  console.log('\n✅ SUCCESS: Schema correctly converted to JSON Schema format!');
  console.log('This is the format that Claude Desktop expects.');
} else {
  console.log('\n❌ ERROR: Schema not properly converted!');
}

// Now test what it would look like in the TOOLS array
console.log('\n\n📋 Example Tool Definition:');
console.log('─'.repeat(80));

const exampleTool = {
  name: 'generate_metadata_suggestions',
  description: 'Erzeugt Metadaten-Vorschläge basierend auf Beschreibung/Transkript.',
  inputSchema: zodToJsonSchema(TestSchema),
};

console.log(JSON.stringify(exampleTool, null, 2));

console.log('\n\n🎯 Key Points:');
console.log('─'.repeat(80));
console.log('1. The inputSchema is now a proper JSON Schema object');
console.log('2. No _def property (which was the Zod internal structure)');
console.log('3. Has standard JSON Schema properties like type, properties, etc.');
console.log('4. This format is what MCP protocol expects and can serialize properly');