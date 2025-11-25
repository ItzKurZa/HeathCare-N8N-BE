// Test ElevenLabs SDK methods
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { config } from './src/config/env.js';

const client = new ElevenLabsClient({
    apiKey: config.elevenlabs.apiKey
});

console.log('🔍 Inspecting ElevenLabs Client...\n');
console.log('Available properties:');
console.log(Object.keys(client));
console.log('\n');

// Check for conversational AI methods
if (client.conversationalAi) {
    console.log('✅ conversationalAi found');
    console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.conversationalAi)));
} else {
    console.log('❌ conversationalAi NOT found');
}

if (client.conversationalAI) {
    console.log('✅ conversationalAI (uppercase) found');
    console.log('Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.conversationalAI)));
} else {
    console.log('❌ conversationalAI (uppercase) NOT found');
}

// Check other possible names
console.log('\n🔍 Looking for conversation/call related methods...');

// Check agents
if (client.conversationalAi.agents) {
    console.log('✅ conversationalAi.agents found');
    console.log('   Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.conversationalAi.agents)));
}

// Check conversations
if (client.conversationalAi.conversations) {
    console.log('✅ conversationalAi.conversations found');
    console.log('   Methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(client.conversationalAi.conversations)));
}
