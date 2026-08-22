/**
 * Standalone CLI Utility: Manually sync faculty directory with Premier University website.
 * Loads credentials from local .env file.
 * 
 * Usage:
 *   1. Ensure .env file exists in project root with:
 *        SUPABASE_URL="https://<your-project>.supabase.co"
 *        SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
 *   2. Run:
 *        node scripts/sync_faculty.js
 */
require('./_load_env.js');
const { createClient } = require('@supabase/supabase-js');
const { syncFacultyWithSupabase } = require('../api/_lib/faculty-scraper.js');

const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('<your-project-id>') || supabaseServiceKey.includes('<your-secret-service-role-key>')) {
  console.error('\n❌ ERROR: Missing Supabase credentials in .env file.');
  console.error('Please create a .env file in the project root (see .env.example):');
  console.error('  SUPABASE_URL="https://<your-project-id>.supabase.co"');
  console.error('  SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"\n');
  console.error('Then run: node scripts/sync_faculty.js\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('\n======================================================');
  console.log('🔄 Premier University - Manual Faculty Sync');
  console.log(`Target Supabase: ${supabaseUrl}`);
  console.log('======================================================\n');

  try {
    console.log('Fetching live faculty directory from cse.puc.ac.bd...');
    const result = await syncFacultyWithSupabase(supabase);
    console.log('\n✅ Sync complete!');
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(`Total Scraped: ${result.scrapedCount}`);
    console.log(`New Suggestions Created: ${result.newSuggestionsCount}`);
    if (result.changes.length > 0) {
      console.log('\nDetected Changes:');
      result.changes.forEach((c, idx) => {
        console.log(`  ${idx + 1}. [${c.teacher_code}] ${c.name} - ${c.type}`);
      });
    } else {
      console.log('No new changes or discrepancies detected.');
    }
  } catch (err) {
    console.error('\n❌ Sync failed:', err.message);
    process.exit(1);
  }
}

main();
